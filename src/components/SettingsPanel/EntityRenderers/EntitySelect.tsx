import { SegmentedControl } from '@/components/common';
import { useTranslation, getEntityState } from '@/hooks';
import { useEntityLabel } from '@/hooks/useEntityLabel';
import { useDeviceEntities, useHass } from '@/contexts';
import type { EntityDefinition } from '@/config/entity-ui-mapping';
import './EntityRenderers.scss';

interface EntitySelectProps {
  definition: EntityDefinition;
  isChild?: boolean;
  label?: string;
}

function formatOptionLabel(option: string): string {
  return option
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function EntitySelect({ definition, isChild = false, label }: EntitySelectProps) {
  const { t } = useTranslation();
  const entityLabel = useEntityLabel(definition, label);
  const hass = useHass();
  const { get } = useDeviceEntities();
  const entityId = get(definition.platform, definition.key);
  const selectState = getEntityState(hass, entityId);
  const options = (selectState.attributes.options as string[]) ?? [];

  function handleChange(value: string): void {
    if (!entityId) return;
    hass.callService('select', 'select_option', {
      entity_id: entityId,
      option: value,
    });
  }

  if (!entityId || selectState.disabled || options.length === 0) return null;

  const currentValue = selectState.state ?? options[0] ?? '';

  if (definition.useSegmentedControl) {
    const segmentOptions = options.map((option) => ({
      value: option,
      label: formatOptionLabel(option),
    }));

    return (
      <div className={`entity-item entity-item--segmented ${isChild ? 'entity-item--child' : ''}`}>
        <div className="entity-item__info">
          <span className="entity-item__label">{entityLabel}</span>
          {definition.descriptionKey && (
            <span className="entity-item__description">{t(definition.descriptionKey)}</span>
          )}
        </div>
        <SegmentedControl
          options={segmentOptions}
          value={currentValue}
          onChange={handleChange}
          disabled={selectState.unavailable}
        />
      </div>
    );
  }

  return (
    <div className={`entity-item entity-item--select ${isChild ? 'entity-item--child' : ''}`}>
      <div className="entity-item__info">
        <span className="entity-item__label">{entityLabel}</span>
        {definition.descriptionKey && <span className="entity-item__description">{t(definition.descriptionKey)}</span>}
      </div>
      <select
        className="entity-item__select"
        value={currentValue}
        disabled={selectState.unavailable}
        onChange={(e) => handleChange(e.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {formatOptionLabel(option)}
          </option>
        ))}
      </select>
    </div>
  );
}
