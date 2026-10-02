import { useMemo } from 'react';
import { CARD_COMPANION_ENTITIES } from '@/config/entity-ui-mapping';
import { useDeviceEntities } from '@/contexts/useVacuumCard';

type CardCompanionName = keyof typeof CARD_COMPANION_ENTITIES;

export type VacuumEntityIds = Partial<Record<CardCompanionName, string>>;

export function useVacuumEntityIds(): VacuumEntityIds {
  const { get } = useDeviceEntities();

  return useMemo(() => {
    const ids: VacuumEntityIds = {};
    for (const [name, { platform, key }] of Object.entries(CARD_COMPANION_ENTITIES)) {
      ids[name as CardCompanionName] = get(platform, key);
    }
    return ids;
  }, [get]);
}
