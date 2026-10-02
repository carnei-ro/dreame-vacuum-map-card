import { useCallback } from 'react';
import { Toggle } from '@/components/common';
import { useTranslation, getEntityState } from '@/hooks';
import { useEntityLabel } from '@/hooks/useEntityLabel';
import { useDeviceEntities, useHass } from '@/contexts';
import type { EntityDefinition } from '@/config/entity-ui-mapping';
import './EntityRenderers.scss';

interface EntitySwitchProps {
  definition: EntityDefinition;
  isChild?: boolean;
  label?: string;
}

export function EntitySwitch({ definition, isChild = false, label }: EntitySwitchProps) {
  const { t } = useTranslation();
  const entityLabel = useEntityLabel(definition, label);
  const hass = useHass();
  const { get } = useDeviceEntities();
  const entityId = get(definition.platform, definition.key);
  const switchState = getEntityState(hass, entityId);

  const handleToggle = useCallback(
    (newValue: boolean) => {
      if (!entityId) return;
      hass.callService('switch', newValue ? 'turn_on' : 'turn_off', {
        entity_id: entityId,
      });
    },
    [entityId, hass]
  );

  if (!entityId || switchState.disabled) return null;

  return (
    <div className={`entity-item ${isChild ? 'entity-item--child' : ''}`}>
      <div className="entity-item__info">
        <span className="entity-item__label">{entityLabel}</span>
        {definition.descriptionKey && <span className="entity-item__description">{t(definition.descriptionKey)}</span>}
      </div>
      <Toggle checked={switchState.isOn} disabled={switchState.unavailable} onChange={handleToggle} />
    </div>
  );
}
