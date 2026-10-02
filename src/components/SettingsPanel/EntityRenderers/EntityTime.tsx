import { useCallback } from 'react';
import { useTranslation, getEntityState } from '@/hooks';
import { useEntityLabel } from '@/hooks/useEntityLabel';
import { useDeviceEntities, useHass } from '@/contexts';
import type { EntityDefinition } from '@/config/entity-ui-mapping';
import './EntityRenderers.scss';

interface EntityTimeProps {
  definition: EntityDefinition;
  isChild?: boolean;
  label?: string;
}

export function EntityTime({ definition, isChild = false, label }: EntityTimeProps) {
  const { t } = useTranslation();
  const entityLabel = useEntityLabel(definition, label);
  const hass = useHass();
  const { get } = useDeviceEntities();
  const entityId = get(definition.platform, definition.key);
  const timeState = getEntityState(hass, entityId);
  const timeValue = timeState.state ? timeState.state.substring(0, 5) : '00:00';

  const handleChange = useCallback(
    (value: string) => {
      if (!entityId) return;
      hass.callService('time', 'set_value', {
        entity_id: entityId,
        time: value,
      });
    },
    [entityId, hass]
  );

  if (!entityId || timeState.disabled) return null;

  return (
    <div className={`entity-item entity-item--time ${isChild ? 'entity-item--child' : ''}`}>
      <div className="entity-item__info">
        <span className="entity-item__label">{entityLabel}</span>
        {definition.descriptionKey && <span className="entity-item__description">{t(definition.descriptionKey)}</span>}
      </div>
      <input
        type="time"
        className="entity-item__time-input"
        value={timeValue}
        disabled={timeState.unavailable}
        onChange={(e) => handleChange(e.target.value)}
      />
    </div>
  );
}
