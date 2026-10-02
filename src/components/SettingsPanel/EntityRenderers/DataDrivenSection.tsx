import { EntityRenderer } from './EntityRenderer';
import type { SectionDefinition } from '@/config/entity-ui-mapping';
import './EntityRenderers.scss';

interface DataDrivenSectionProps {
  section: SectionDefinition;
  className?: string;
}

export function DataDrivenSection({ section, className }: DataDrivenSectionProps) {
  const renderedEntities = section.entities.map((entityDef) => (
    <EntityRenderer key={entityDef.key} definition={entityDef} />
  ));

  const hasVisibleEntities = renderedEntities.some((el) => el !== null);
  if (!hasVisibleEntities) {
    return null;
  }

  return <div className={`data-driven-section ${className ?? ''}`}>{renderedEntities}</div>;
}
