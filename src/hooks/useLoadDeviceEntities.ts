import { useEffect, useMemo, useRef, useState } from 'react';
import type { Hass, HassEntity } from '@/types/homeassistant';
import { curatedCompanionKeys } from '@/config/entity-ui-mapping';
import {
  indexDeviceEntities,
  type DeviceEntityIndex,
  type EntityRegistryEntry,
  entityLookupKey,
  roomLookupKey,
} from '@/utils/deviceEntities';
import { logger } from '@/utils/logger';

export interface DeviceEntityExtra {
  entityId: string;
  domain: string;
  translationKey: string;
  friendlyName: string;
}

export interface DeviceEntities {
  status: 'loading' | 'ready' | 'error';
  get: (domain: string, translationKey: string) => string | undefined;
  getRoom: (segmentId: number, domain: string, translationKey: string) => string | undefined;
  extras: DeviceEntityExtra[];
}

interface RegistryEntity extends EntityRegistryEntry {
  device_id: string | null;
}

const EMPTY_INDEX: DeviceEntityIndex = { entities: new Map(), rooms: new Map(), extras: [] };

function friendlyName(entity: HassEntity | undefined, translationKey: string): string {
  const name = entity?.attributes.friendly_name;
  return typeof name === 'string' && name.length > 0 ? name : translationKey.replaceAll('_', ' ');
}

export function useLoadDeviceEntities(hass: Hass, vacuumEntityId: string): DeviceEntities {
  const [status, setStatus] = useState<DeviceEntities['status']>('loading');
  const [index, setIndex] = useState<DeviceEntityIndex>(EMPTY_INDEX);
  const hassRef = useRef(hass);
  const reportedError = useRef(false);
  hassRef.current = hass;

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    reportedError.current = false;
    setStatus('loading');
    setIndex(EMPTY_INDEX);

    async function load(): Promise<void> {
      const currentHass = hassRef.current;
      try {
        const vacuum = await currentHass.callWS<RegistryEntity>({
          type: 'config/entity_registry/get',
          entity_id: vacuumEntityId,
        });
        if (!vacuum.device_id) {
          throw new Error(`Vacuum ${vacuumEntityId} is not attached to a device`);
        }
        const entries = await currentHass.callWS<EntityRegistryEntry[]>({ type: 'config/entity_registry/list' });
        if (!active) return;
        setIndex(indexDeviceEntities(entries, vacuum.device_id, curatedCompanionKeys()));
        setStatus('ready');
        reportedError.current = false;
      } catch (error) {
        if (!active) return;
        if (!reportedError.current) {
          logger.error(
            'Entity discovery failed. Companion controls stay hidden until the entity registry can be read.',
            error
          );
          reportedError.current = true;
        }
        setIndex(EMPTY_INDEX);
        setStatus('error');
      }
    }

    void load().then(async () => {
      const connection = hassRef.current.connection;
      if (!active || !connection) return;
      unsubscribe = await connection.subscribeEvents(() => {
        void load();
      }, 'entity_registry_updated');
      if (!active) unsubscribe();
    });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [vacuumEntityId]);

  return useMemo(() => {
    const ready = status === 'ready';
    return {
      status,
      get: (domain, translationKey) =>
        ready ? index.entities.get(entityLookupKey(domain, translationKey)) : undefined,
      getRoom: (segmentId, domain, translationKey) =>
        ready ? index.rooms.get(roomLookupKey(segmentId, domain, translationKey)) : undefined,
      extras: ready
        ? index.extras.flatMap((extra) => {
            const entity = hass.states[extra.entityId];
            return entity ? [{ ...extra, friendlyName: friendlyName(entity, extra.translationKey) }] : [];
          })
        : [],
    };
  }, [hass.states, index, status]);
}
