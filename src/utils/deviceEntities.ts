import { logger } from './logger';

export interface EntityRegistryEntry {
  entity_id: string;
  unique_id: string;
  device_id: string | null;
  translation_key?: string | null;
  entity_category?: 'config' | 'diagnostic' | null;
  disabled_by?: string | null;
}

export interface DiscoveredEntity {
  entityId: string;
  domain: string;
  translationKey: string;
}

export interface DeviceEntityIndex {
  entities: Map<string, string>;
  rooms: Map<string, string>;
  extras: DiscoveredEntity[];
}

const CONFIG_DOMAINS = new Set(['switch', 'select', 'number', 'button', 'time']);
const EXTRA_MAP_KEYS = new Set(['saved_map', 'wifi_map']);
const ROOM_ID_PATTERN = /_room_(\d+)_/;

export function entityLookupKey(domain: string, translationKey: string): string {
  return `${domain}:${translationKey}`;
}

export function roomLookupKey(segmentId: number, domain: string, translationKey: string): string {
  return `${segmentId}:${entityLookupKey(domain, translationKey)}`;
}

export function indexDeviceEntities(
  entries: readonly EntityRegistryEntry[],
  deviceId: string,
  curatedKeys: ReadonlySet<string>
): DeviceEntityIndex {
  const entities = new Map<string, string>();
  const rooms = new Map<string, string>();
  const extras: DiscoveredEntity[] = [];

  for (const entry of entries) {
    if (entry.device_id !== deviceId || entry.disabled_by || !entry.translation_key) {
      continue;
    }
    if (EXTRA_MAP_KEYS.has(entry.translation_key) || entry.unique_id.includes('_shortcut_')) {
      continue;
    }

    const domain = entry.entity_id.split('.')[0];
    if (!domain) {
      continue;
    }

    const roomMatch = entry.unique_id.match(ROOM_ID_PATTERN);
    if (roomMatch) {
      rooms.set(roomLookupKey(Number(roomMatch[1]), domain, entry.translation_key), entry.entity_id);
      continue;
    }

    const key = entityLookupKey(domain, entry.translation_key);
    if (entities.has(key)) {
      logger.warn('Duplicate companion entity ignored:', key, entry.entity_id);
      continue;
    }

    entities.set(key, entry.entity_id);
    const category = entry.entity_category ?? null;
    if (CONFIG_DOMAINS.has(domain) && (category === null || category === 'config') && !curatedKeys.has(key)) {
      extras.push({ entityId: entry.entity_id, domain, translationKey: entry.translation_key });
    }
  }

  return { entities, rooms, extras };
}
