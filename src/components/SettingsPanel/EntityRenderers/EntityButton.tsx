import { useCallback } from 'react';
import { useTranslation, getEntityState } from '@/hooks';
import { useDeviceEntities, useHass } from '@/contexts';
import type { EntityDefinition } from '@/config/entity-ui-mapping';
import './EntityRenderers.scss';

interface EntityButtonProps {
  definition: EntityDefinition;
  isChild?: boolean;
  buttonLabel?: string;
  label?: string;
}

export function EntityButton({ definition, isChild = false, buttonLabel, label }: EntityButtonProps) {
  const { t } = useTranslation();
  const hass = useHass();
  const { get } = useDeviceEntities();
  const entityId = get(definition.platform, definition.key);
  const buttonState = getEntityState(hass, entityId);

  const handlePress = useCallback(() => {
    if (!entityId) return;
    hass.callService('button', 'press', {
      entity_id: entityId,
    });
  }, [entityId, hass]);

  if (!entityId || buttonState.disabled) return null;

  return (
    <div className={`entity-item ${isChild ? 'entity-item--child' : ''}`}>
      <div className="entity-item__info">
        <span className="entity-item__label">{label ?? t(definition.labelKey)}</span>
        {definition.descriptionKey && <span className="entity-item__description">{t(definition.descriptionKey)}</span>}
      </div>
      <button className="entity-item__button" disabled={buttonState.unavailable} onClick={handlePress}>
        {buttonLabel ?? t('common.run')}
      </button>
    </div>
  );
}
