import { describe, expect, it } from 'vitest';
import { curatedCompanionKeys } from '@/config/entity-ui-mapping';
import { indexDeviceEntities, type EntityRegistryEntry } from '../deviceEntities';

const curated = new Set(['switch:child_lock', 'select:cleaning_mode', 'select:suction_level']);

function entry(
  overrides: Partial<EntityRegistryEntry> & Pick<EntityRegistryEntry, 'entity_id' | 'unique_id'>
): EntityRegistryEntry {
  return {
    device_id: 'device-x40',
    translation_key: 'cleaning_mode',
    entity_category: 'config',
    disabled_by: null,
    ...overrides,
  };
}

describe('indexDeviceEntities', () => {
  const entries: EntityRegistryEntry[] = [
    entry({
      entity_id: 'sensor.sparse_state',
      unique_id: 'mac-sparse_state',
      device_id: 'device-sparse',
      translation_key: 'state',
      entity_category: 'diagnostic',
    }),
    entry({
      entity_id: 'select.kitchen_bot_mode',
      unique_id: 'mac-x40_cleaning_mode',
      translation_key: 'cleaning_mode',
    }),
    entry({
      entity_id: 'select.x40_suction_level',
      unique_id: 'mac-x40_suction_level',
      translation_key: 'suction_level',
    }),
    entry({
      entity_id: 'select.x40_room_3_suction_level',
      unique_id: 'mac-x40_room_3_suction_level',
      translation_key: 'suction_level',
    }),
    entry({
      entity_id: 'camera.x40_map_2',
      unique_id: 'mac-x40_map_2',
      translation_key: 'saved_map',
      entity_category: null,
    }),
    entry({
      entity_id: 'camera.x40_map',
      unique_id: 'mac-x40_map_map',
      translation_key: 'map',
      entity_category: null,
    }),
    entry({
      entity_id: 'switch.x40_disabled',
      unique_id: 'mac-x40_disabled',
      translation_key: 'child_lock',
      disabled_by: 'user',
    }),
    entry({
      entity_id: 'button.x40_shortcut_1',
      unique_id: 'mac-x40_shortcut_1',
      translation_key: 'shortcut',
      entity_category: null,
    }),
    entry({
      entity_id: 'switch.other_device_feature',
      unique_id: 'mac-other_future_feature',
      device_id: 'device-other',
      translation_key: 'future_feature',
    }),
    entry({
      entity_id: 'switch.rich_future_feature',
      unique_id: 'mac-rich_future_feature',
      device_id: 'device-rich',
      translation_key: 'future_feature',
    }),
    entry({
      entity_id: 'sensor.rich_state',
      unique_id: 'mac-rich_state',
      device_id: 'device-rich',
      translation_key: 'state',
      entity_category: 'diagnostic',
    }),
  ];

  it('keeps a sparse model limited to its own device entities', () => {
    const index = indexDeviceEntities(entries, 'device-sparse', curated);

    expect(index.entities.get('sensor:state')).toBe('sensor.sparse_state');
    expect(index.entities.size).toBe(1);
    expect(index.extras).toEqual([]);
    expect(index.rooms.size).toBe(0);
  });

  it('resolves renamed entities without adopting room, saved-map, or other-device entries', () => {
    const index = indexDeviceEntities(entries, 'device-x40', curated);

    expect(index.entities.get('select:cleaning_mode')).toBe('select.kitchen_bot_mode');
    expect(index.entities.get('select:suction_level')).toBe('select.x40_suction_level');
    expect(index.entities.get('camera:map')).toBe('camera.x40_map');
    expect(index.entities.has('camera:saved_map')).toBe(false);
    expect(index.entities.has('switch:child_lock')).toBe(false);
    expect(index.rooms.get('3:select:suction_level')).toBe('select.x40_room_3_suction_level');
    expect([...index.entities.values(), ...index.rooms.values()]).not.toContain('switch.other_device_feature');
    expect(index.extras).toEqual([]);
  });

  it('returns an uncurated config entity from a richer model as an extra', () => {
    const index = indexDeviceEntities(entries, 'device-rich', curated);

    expect(index.extras).toEqual([
      { entityId: 'switch.rich_future_feature', domain: 'switch', translationKey: 'future_feature' },
    ]);
    expect(index.entities.has('sensor:state')).toBe(true);
  });

  it('keeps cleaning-modal and map-selector entities out of More', () => {
    const cardEntries: EntityRegistryEntry[] = [
      entry({
        entity_id: 'number.x40_wetness_level',
        unique_id: 'mac_wetness_level',
        translation_key: 'wetness_level',
      }),
      entry({
        entity_id: 'select.x40_cleaning_route',
        unique_id: 'mac_cleaning_route',
        translation_key: 'cleaning_route',
      }),
      entry({ entity_id: 'select.x40_selected_map', unique_id: 'mac_selected_map', translation_key: 'selected_map' }),
      entry({
        entity_id: 'switch.x40_future_feature',
        unique_id: 'mac_future_feature',
        translation_key: 'future_feature',
      }),
    ];

    const index = indexDeviceEntities(cardEntries, 'device-x40', curatedCompanionKeys());

    expect(index.extras.map((extra) => extra.entityId)).toEqual(['switch.x40_future_feature']);
  });
});
