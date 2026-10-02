import type { VacuumPhase } from '@/constants';

export type DockStatusLevel = 'good' | 'warning' | 'bad' | 'unknown';

export const DOCK_TASKS = [
  { key: 'start_auto_empty', labelKey: 'settings.station_controls.start_auto_empty' },
  { key: 'self_clean', labelKey: 'settings.station_controls.self_clean' },
  { key: 'manual_drying', labelKey: 'settings.station_controls.manual_drying' },
] as const;

const BAD_STATUS_VALUES = [
  'not installed',
  'not_installed',
  'missing',
  'empty',
  'full',
  'error',
  'fault',
  'off',
  'false',
  '0',
  'max water level',
  'warning',
  'abnormal',
];
const LOW_WATER_VALUES = ['low', 'low water', 'water low', 'low level'];
const GOOD_STATUS_VALUES = [
  'normal',
  'ok',
  'on',
  'true',
  'installed',
  'available',
  'ready',
  'good',
  'present',
  'standard',
  'medium',
  'high',
];

export function shouldOpenDockPopup(phase: VacuumPhase): boolean {
  return phase !== 'cleaning' && phase !== 'paused';
}

export function classifyDockStatus(value: unknown, warnWhenLow = false): DockStatusLevel {
  if (value === null || value === undefined) return 'unknown';
  if (typeof value === 'boolean') return value ? 'good' : 'bad';
  if (typeof value === 'number') return value > 0 ? 'good' : 'bad';

  const normalized = String(value).trim().toLowerCase();
  if (!normalized || normalized === 'unavailable' || normalized === 'unknown') return 'unknown';
  if (BAD_STATUS_VALUES.some((status) => normalized.includes(status))) return 'bad';
  if (warnWhenLow && LOW_WATER_VALUES.some((status) => normalized.includes(status))) return 'warning';
  if (GOOD_STATUS_VALUES.some((status) => normalized.includes(status))) return 'good';

  const numeric = Number(normalized);
  if (Number.isFinite(numeric)) return numeric > 0 ? 'good' : 'bad';
  return 'good';
}
