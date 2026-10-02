import { useCallback, useState } from 'react';
import { useTranslation, getEntityState } from '@/hooks';
import { useDeviceEntities, useHass } from '@/contexts';
import type { EntityDefinition } from '@/config/entity-ui-mapping';
import './EntityRenderers.scss';

interface EntityNumberProps {
  definition: EntityDefinition;
  isChild?: boolean;
  label?: string;
}

function finiteOrNull(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function EntityNumber({ definition, isChild = false, label }: EntityNumberProps) {
  const { t } = useTranslation();
  const hass = useHass();
  const { get } = useDeviceEntities();
  const entityId = get(definition.platform, definition.key);
  const numberState = getEntityState(hass, entityId);
  const reportedValue = finiteOrNull(numberState.state);

  const min = definition.min ?? finiteOrNull(numberState.attributes.min) ?? 0;
  const max = definition.max ?? finiteOrNull(numberState.attributes.max) ?? 100;
  const step = definition.step ?? finiteOrNull(numberState.attributes.step) ?? 1;

  const [localValue, setLocalValue] = useState(reportedValue ?? min);
  const [syncedValue, setSyncedValue] = useState(reportedValue);

  // Object.is treats NaN as equal. !== does not, and that re-rendered forever.
  if (!Object.is(reportedValue, syncedValue)) {
    setSyncedValue(reportedValue);
    setLocalValue(reportedValue ?? min);
  }

  // Commit on release only: dragging a range input fires onChange for every
  // intermediate step, which would send one service call per step.
  const handleCommit = useCallback(() => {
    if (!entityId || reportedValue === null || localValue === reportedValue) return;
    hass.callService('number', 'set_value', {
      entity_id: entityId,
      value: localValue,
    });
  }, [entityId, hass, localValue, reportedValue]);

  if (!entityId || numberState.disabled) return null;

  const renderHint = definition.renderHint ?? 'slider';
  const sliderClass =
    renderHint === 'volume'
      ? 'entity-item__slider--volume'
      : renderHint === 'brightness'
        ? 'entity-item__slider--brightness'
        : '';

  return (
    <div className={`entity-item entity-item--slider ${isChild ? 'entity-item--child' : ''}`}>
      <div className="entity-item__info">
        <span className="entity-item__label">{label ?? t(definition.labelKey)}</span>
        {definition.descriptionKey && <span className="entity-item__description">{t(definition.descriptionKey)}</span>}
      </div>
      <div className={`entity-item__slider-container ${sliderClass}`}>
        <input
          type="range"
          className="entity-item__slider"
          min={min}
          max={max}
          step={step}
          value={localValue}
          disabled={numberState.unavailable || reportedValue === null}
          onChange={(e) => setLocalValue(Number(e.target.value))}
          onMouseUp={handleCommit}
          onTouchEnd={handleCommit}
          onKeyUp={handleCommit}
          onBlur={handleCommit}
        />
        <span className="entity-item__slider-value">
          {Math.round(localValue)}
          {renderHint === 'volume' || renderHint === 'brightness' ? '%' : ''}
        </span>
      </div>
    </div>
  );
}
