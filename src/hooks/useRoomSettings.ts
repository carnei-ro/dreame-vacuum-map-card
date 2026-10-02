import { useCallback, useMemo } from 'react';
import type { Hass, HassEntity } from '@/types/homeassistant';
import { DREAME_SEGMENT_NUMBERS, DREAME_SEGMENT_SELECTS } from '@/constants';
import { useDeviceEntities } from '@/contexts/useVacuumCard';
import { logger } from '@/utils/logger';

const PLACEHOLDER_STATES = new Set(['unavailable', 'unknown', 'none']);

/** Option strings the integration publishes for these selects. Used when HA replaces them with the unavailable placeholder. */
const SUCTION_OPTIONS = ['quiet', 'standard', 'strong', 'turbo'];
const SUCTION_BY_CODE: Record<number, string> = {
  0: 'quiet',
  1: 'standard',
  2: 'strong',
  3: 'turbo',
};
const CLEANING_TIMES_OPTIONS = ['1x', '2x', '3x'];
const CLEANING_TIMES_BY_CODE: Record<number, string> = { 1: '1x', 2: '2x', 3: '3x' };
const MOP_PRESSURE_OPTIONS = ['light', 'normal'];
const MOP_PRESSURE_BY_CODE: Record<number, string> = { 0: 'light', 2: 'normal' };
const MOP_TEMPERATURE_OPTIONS = ['normal', 'warm'];
const MOP_TEMPERATURE_BY_CODE: Record<number, string> = { 0: 'normal', 1: 'warm' };

interface SelectReading {
  value: string | null;
  options: string[];
}

function isPlaceholderState(state: string | null | undefined): boolean {
  return !state || PLACEHOLDER_STATES.has(state.toLowerCase());
}

function publishedOptions(options: unknown): string[] {
  if (!Array.isArray(options)) return [];
  return options.filter((option): option is string => typeof option === 'string' && !isPlaceholderState(option));
}

function numericAttribute(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Room selects report state "unavailable" and options ["unavailable"] whenever the integration's
 * segment_available_fn is false. The numeric code stays in attributes.value.
 */
export function readRoomSelect(
  entity: Pick<HassEntity, 'state' | 'attributes'> | undefined,
  fallbackOptions: readonly string[],
  optionByCode: Readonly<Record<number, string>>
): SelectReading {
  if (!entity) return { value: null, options: [] };

  const published = publishedOptions(entity.attributes.options);
  const options = published.length > 0 ? published : [...fallbackOptions];
  const state = isPlaceholderState(entity.state) ? null : entity.state;
  if (state && options.includes(state)) {
    return { value: state, options };
  }

  const fromCode = optionByCode[numericAttribute(entity.attributes.value) ?? Number.NaN] ?? null;
  if (fromCode && options.includes(fromCode)) {
    return { value: fromCode, options };
  }

  return { value: null, options };
}

export function readWetnessLevel(entity: Pick<HassEntity, 'state'> | undefined): number | null {
  if (!entity || isPlaceholderState(entity.state)) return null;
  const parsed = Number(entity.state);
  return Number.isFinite(parsed) ? parsed : null;
}

export interface RoomSetting {
  roomId: number;
  roomName: string;
  // Suction level
  suctionLevel: string | null;
  suctionLevelOptions: string[];
  // Wetness level (slider)
  wetnessLevel: number | null;
  wetnessMin: number;
  wetnessMax: number;
  // Cleaning times (cycles)
  cleaningTimes: string | null;
  cleaningTimesOptions: string[];
  // Mop pressure (Light/Normal)
  mopPressure: string | null;
  mopPressureOptions: string[];
  // Mop temperature (Normal/Warm)
  mopTemperature: string | null;
  mopTemperatureOptions: string[];
  // Whether entities exist for this room
  hasEntities: boolean;
  suctionEntityId?: string;
  wetnessEntityId?: string;
  cleaningTimesEntityId?: string;
  mopPressureEntityId?: string;
  mopTemperatureEntityId?: string;
}

interface UseRoomSettingsOptions {
  hass: Hass;
  rooms: Array<{ id: number; name: string }>;
}

interface UseRoomSettingsReturn {
  roomSettings: Map<number, RoomSetting>;
  setSuctionLevel: (roomId: number, value: string) => void;
  setWetnessLevel: (roomId: number, value: number) => void;
  setCleaningTimes: (roomId: number, value: string) => void;
  setMopPressure: (roomId: number, value: string) => void;
  setMopTemperature: (roomId: number, value: string) => void;
}

/**
 * Hook to read and write per-room cleaning settings from Home Assistant entities
 *
 */
export function useRoomSettings({ hass, rooms }: UseRoomSettingsOptions): UseRoomSettingsReturn {
  const { getRoom } = useDeviceEntities();
  const roomEntityIds = useMemo(() => {
    return rooms.map((room) => ({
      roomId: room.id,
      roomName: room.name,
      suctionEntityId: getRoom(room.id, 'select', DREAME_SEGMENT_SELECTS.SUCTION_LEVEL.key),
      wetnessEntityId: getRoom(room.id, 'number', DREAME_SEGMENT_NUMBERS.WETNESS_LEVEL.key),
      cleaningTimesEntityId: getRoom(room.id, 'select', DREAME_SEGMENT_SELECTS.CLEANING_TIMES.key),
      mopPressureEntityId: getRoom(room.id, 'select', DREAME_SEGMENT_SELECTS.MOP_PRESSURE.key),
      mopTemperatureEntityId: getRoom(room.id, 'select', DREAME_SEGMENT_SELECTS.MOP_TEMPERATURE.key),
    }));
  }, [getRoom, rooms]);

  // Build room settings map from HA entity states
  // Only recalculate when relevant entities change
  const roomSettings = useMemo(() => {
    const settings = new Map<number, RoomSetting>();

    for (const entityIds of roomEntityIds) {
      const suctionEntity = entityIds.suctionEntityId ? hass.states[entityIds.suctionEntityId] : undefined;
      const wetnessEntity = entityIds.wetnessEntityId ? hass.states[entityIds.wetnessEntityId] : undefined;
      const cleaningTimesEntity = entityIds.cleaningTimesEntityId
        ? hass.states[entityIds.cleaningTimesEntityId]
        : undefined;
      const mopPressureEntity = entityIds.mopPressureEntityId ? hass.states[entityIds.mopPressureEntityId] : undefined;
      const mopTemperatureEntity = entityIds.mopTemperatureEntityId
        ? hass.states[entityIds.mopTemperatureEntityId]
        : undefined;

      // Check if at least one entity exists
      const hasEntities = !!(
        suctionEntity ||
        wetnessEntity ||
        cleaningTimesEntity ||
        mopPressureEntity ||
        mopTemperatureEntity
      );

      const suction = readRoomSelect(suctionEntity, SUCTION_OPTIONS, SUCTION_BY_CODE);
      const cleaningTimes = readRoomSelect(cleaningTimesEntity, CLEANING_TIMES_OPTIONS, CLEANING_TIMES_BY_CODE);
      const mopPressure = readRoomSelect(mopPressureEntity, MOP_PRESSURE_OPTIONS, MOP_PRESSURE_BY_CODE);
      const mopTemperature = readRoomSelect(mopTemperatureEntity, MOP_TEMPERATURE_OPTIONS, MOP_TEMPERATURE_BY_CODE);

      settings.set(entityIds.roomId, {
        roomId: entityIds.roomId,
        roomName: entityIds.roomName,
        suctionLevel: suction.value,
        suctionLevelOptions: suction.options,
        wetnessLevel: readWetnessLevel(wetnessEntity),
        wetnessMin: finiteOr(wetnessEntity?.attributes?.min, 1),
        wetnessMax: finiteOr(wetnessEntity?.attributes?.max, 32),
        cleaningTimes: cleaningTimes.value,
        cleaningTimesOptions: cleaningTimes.options,
        mopPressure: mopPressure.value,
        mopPressureOptions: mopPressure.options,
        mopTemperature: mopTemperature.value,
        mopTemperatureOptions: mopTemperature.options,
        hasEntities,
        suctionEntityId: entityIds.suctionEntityId,
        wetnessEntityId: entityIds.wetnessEntityId,
        cleaningTimesEntityId: entityIds.cleaningTimesEntityId,
        mopPressureEntityId: entityIds.mopPressureEntityId,
        mopTemperatureEntityId: entityIds.mopTemperatureEntityId,
      });
    }

    return settings;
  }, [hass.states, roomEntityIds]);

  // Set suction level for a room
  const setSuctionLevel = useCallback(
    (roomId: number, value: string) => {
      const entityId = getRoom(roomId, 'select', DREAME_SEGMENT_SELECTS.SUCTION_LEVEL.key);
      if (!entityId) return;
      logger.debug('RoomSettings', 'Setting suction level:', { roomId, value, entityId });
      hass.callService('select', 'select_option', { entity_id: entityId, option: value });
    },
    [getRoom, hass]
  );

  const setWetnessLevel = useCallback(
    (roomId: number, value: number) => {
      const entityId = getRoom(roomId, 'number', DREAME_SEGMENT_NUMBERS.WETNESS_LEVEL.key);
      if (!entityId) return;
      logger.debug('RoomSettings', 'Setting wetness level:', { roomId, value, entityId });
      hass.callService('number', 'set_value', { entity_id: entityId, value });
    },
    [getRoom, hass]
  );

  const setCleaningTimes = useCallback(
    (roomId: number, value: string) => {
      const entityId = getRoom(roomId, 'select', DREAME_SEGMENT_SELECTS.CLEANING_TIMES.key);
      if (!entityId) return;
      logger.debug('RoomSettings', 'Setting cleaning times:', { roomId, value, entityId });
      hass.callService('select', 'select_option', { entity_id: entityId, option: value });
    },
    [getRoom, hass]
  );

  const setMopPressure = useCallback(
    (roomId: number, value: string) => {
      const entityId = getRoom(roomId, 'select', DREAME_SEGMENT_SELECTS.MOP_PRESSURE.key);
      if (!entityId) return;
      logger.debug('RoomSettings', 'Setting mop pressure:', { roomId, value, entityId });
      hass.callService('select', 'select_option', { entity_id: entityId, option: value });
    },
    [getRoom, hass]
  );

  const setMopTemperature = useCallback(
    (roomId: number, value: string) => {
      const entityId = getRoom(roomId, 'select', DREAME_SEGMENT_SELECTS.MOP_TEMPERATURE.key);
      if (!entityId) return;
      logger.debug('RoomSettings', 'Setting mop temperature:', { roomId, value, entityId });
      hass.callService('select', 'select_option', { entity_id: entityId, option: value });
    },
    [getRoom, hass]
  );

  return {
    roomSettings,
    setSuctionLevel,
    setWetnessLevel,
    setCleaningTimes,
    setMopPressure,
    setMopTemperature,
  };
}
