import { Modal, Accordion } from '@/components/common';
import { useTranslation } from '@/hooks';
import { useDeviceEntities } from '@/contexts';
import { EntityRenderer } from './EntityRenderers';
import {
  AI_DETECTION_SECTION,
  CARPET_SETTINGS_SECTION,
  DOCK_SETTINGS_SECTION,
  EDGE_CORNER_SECTION,
  FLOOR_SETTINGS_SECTION,
  MAP_SETTINGS_SECTION,
  QUICK_ACTIONS_SECTION,
  QUICK_SETTINGS_SECTION,
  VOLUME_SECTION,
  type EntityPlatform,
  type SectionDefinition,
} from '@/config/entity-ui-mapping';
import { AIDetectionSection } from './sections/AIDetectionSection';
import { CarpetSettingsSection } from './sections/CarpetSettingsSection';
import { ConsumablesSection } from './sections/ConsumablesSection';
import { DeviceInfoSection } from './sections/DeviceInfoSection';
import { DockSettingsSection } from './sections/DockSettingsSection';
import { EdgeCornerSection } from './sections/EdgeCornerSection';
import { FloorSettingsSection } from './sections/FloorSettingsSection';
import { MapSettingsSection } from './sections/MapSettingsSection';
import { QuickSettingsSection } from './sections/QuickSettingsSection';
import { VolumeSection } from './sections/VolumeSection';
import {
  Brain,
  Gauge,
  Info,
  Layers,
  Settings2,
  Volume2,
  Footprints,
  CornerDownRight,
  Dock,
  Map,
  Ellipsis,
} from 'lucide-react';
import './SettingsPanel.scss';

interface SettingsPanelProps {
  opened: boolean;
  onClose: () => void;
}

function sectionHasEntities(section: SectionDefinition, getEntity: DeviceEntityLookup): boolean {
  return section.entities.some((entity) => getEntity(entity.platform, entity.key));
}

type DeviceEntityLookup = (domain: string, translationKey: string) => string | undefined;

export function SettingsPanel({ opened, onClose }: SettingsPanelProps) {
  const { t } = useTranslation();
  const { status, get, extras } = useDeviceEntities();
  const entitiesReady = status === 'ready';

  return (
    <Modal opened={opened} onClose={onClose}>
      <div className="settings-panel">
        <h2 className="settings-panel__title">{t('settings.title')}</h2>

        <div className="settings-panel__scroll-wrapper">
          <div className="settings-panel__sections">
            <Accordion title={t('settings.consumables.title')} icon={<Gauge />}>
              <ConsumablesSection />
            </Accordion>

            {entitiesReady &&
              (sectionHasEntities(QUICK_SETTINGS_SECTION, get) || sectionHasEntities(QUICK_ACTIONS_SECTION, get)) && (
                <Accordion title={t('settings.quick_settings.title')} icon={<Settings2 />}>
                  <QuickSettingsSection />
                </Accordion>
              )}

            {entitiesReady && sectionHasEntities(CARPET_SETTINGS_SECTION, get) && (
              <Accordion title={t('settings.carpet.title')} icon={<Layers />}>
                <CarpetSettingsSection />
              </Accordion>
            )}

            {entitiesReady && sectionHasEntities(FLOOR_SETTINGS_SECTION, get) && (
              <Accordion title={t('settings.floor.title')} icon={<Footprints />}>
                <FloorSettingsSection />
              </Accordion>
            )}

            {entitiesReady && sectionHasEntities(EDGE_CORNER_SECTION, get) && (
              <Accordion title={t('settings.edge_corner.title')} icon={<CornerDownRight />}>
                <EdgeCornerSection />
              </Accordion>
            )}

            {entitiesReady && sectionHasEntities(VOLUME_SECTION, get) && (
              <Accordion title={t('settings.volume.title')} icon={<Volume2 />}>
                <VolumeSection />
              </Accordion>
            )}

            {entitiesReady && sectionHasEntities(DOCK_SETTINGS_SECTION, get) && (
              <Accordion title={t('settings.dock.title')} icon={<Dock />}>
                <DockSettingsSection />
              </Accordion>
            )}

            {entitiesReady && sectionHasEntities(AI_DETECTION_SECTION, get) && (
              <Accordion title={t('settings.ai_detection.title')} icon={<Brain />}>
                <AIDetectionSection />
              </Accordion>
            )}

            {entitiesReady && sectionHasEntities(MAP_SETTINGS_SECTION, get) && (
              <Accordion title={t('settings.map.title')} icon={<Map />}>
                <MapSettingsSection />
              </Accordion>
            )}

            {extras.length > 0 && (
              <Accordion title={t('settings.more.title')} icon={<Ellipsis />}>
                {extras.map((extra) => (
                  <EntityRenderer
                    key={extra.entityId}
                    label={extra.friendlyName}
                    definition={{
                      key: extra.translationKey,
                      platform: extra.domain as EntityPlatform,
                      labelKey: 'settings.more.title',
                    }}
                  />
                ))}
              </Accordion>
            )}

            <Accordion title={t('settings.device_info.title')} icon={<Info />}>
              <DeviceInfoSection />
            </Accordion>
          </div>
        </div>
      </div>
    </Modal>
  );
}
