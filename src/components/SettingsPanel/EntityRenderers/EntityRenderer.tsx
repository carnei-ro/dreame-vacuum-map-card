import { EntitySwitch } from './EntitySwitch';
import { EntitySelect } from './EntitySelect';
import { EntityNumber } from './EntityNumber';
import { EntityButton } from './EntityButton';
import { EntityTime } from './EntityTime';
import { getEntityState } from '@/hooks';
import { useDeviceEntities, useHass } from '@/contexts';
import type { EntityDefinition } from '@/config/entity-ui-mapping';

interface EntityRendererProps {
  definition: EntityDefinition;
  isChild?: boolean;
  label?: string;
}

export function EntityRenderer({ definition, isChild = false, label }: EntityRendererProps) {
  const hass = useHass();
  const { get } = useDeviceEntities();

  if (definition.parentKey) {
    const parentState = getEntityState(hass, get('switch', definition.parentKey));
    if (!parentState.isOn) {
      return null;
    }
  }

  const isChildItem = isChild || !!definition.parentKey;

  switch (definition.platform) {
    case 'switch':
      return <EntitySwitch definition={definition} isChild={isChildItem} label={label} />;
    case 'select':
      return <EntitySelect definition={definition} isChild={isChildItem} label={label} />;
    case 'number':
      return <EntityNumber definition={definition} isChild={isChildItem} label={label} />;
    case 'button':
      return <EntityButton definition={definition} isChild={isChildItem} label={label} />;
    case 'time':
      return <EntityTime definition={definition} isChild={isChildItem} label={label} />;
    default:
      return null;
  }
}
