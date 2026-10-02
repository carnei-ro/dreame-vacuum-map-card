import { Droplets, Sun, Trash2, type LucideIcon } from 'lucide-react';
import { Modal } from '@/components/common';
import { useDeviceEntities, useHass } from '@/contexts';
import { useTranslation } from '@/hooks';
import { getEntityState } from '@/hooks/useEntityState';
import { classifyDockStatus, DOCK_TASKS } from '@/utils/dockPopup';
import './DockPopup.scss';

const TASK_ICONS: Record<(typeof DOCK_TASKS)[number]['key'], LucideIcon> = {
  start_auto_empty: Trash2,
  self_clean: Droplets,
  manual_drying: Sun,
};

interface DockPopupProps {
  opened: boolean;
  onClose: () => void;
}

const DOCK_STATUSES = [
  { key: 'clean_water_tank_status', labelKey: 'dock_popup.clean_water_tank', warnWhenLow: true },
  { key: 'dirty_water_tank_status', labelKey: 'dock_popup.used_water_tank', warnWhenLow: false },
  { key: 'dust_bag_status', labelKey: 'dock_popup.dust_bag', warnWhenLow: false },
  { key: 'detergent_status', labelKey: 'dock_popup.detergent', warnWhenLow: false },
] as const;

export function DockPopup({ opened, onClose }: DockPopupProps) {
  const hass = useHass();
  const { get } = useDeviceEntities();
  const { t } = useTranslation();

  const tasks = DOCK_TASKS.flatMap((task) => {
    const entityId = get('button', task.key);
    return entityId ? [{ ...task, entityId, state: getEntityState(hass, entityId) }] : [];
  });

  const handleTask = (entityId: string): void => {
    void hass.callService('button', 'press', { entity_id: entityId });
    onClose();
  };

  return (
    <Modal opened={opened} onClose={onClose} className="dock-popup-modal">
      <section className="dock-popup">
        <h2 className="dock-popup__title">{t('dock_popup.information')}</h2>

        <div className="dock-popup__status-grid">
          {DOCK_STATUSES.map((status) => {
            const entityId = get('sensor', status.key);
            const state = getEntityState(hass, entityId).state;
            const level = classifyDockStatus(state, status.warnWhenLow);

            return (
              <div className="dock-popup__status" key={status.key}>
                <span className={`dock-popup__status-dot dock-popup__status-dot--${level}`} />
                <div>
                  <span className="dock-popup__status-label">{t(status.labelKey)}</span>
                  {level !== 'unknown' && (
                    <span className={`dock-popup__status-value dock-popup__status-value--${level}`}>{state}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {tasks.length > 0 && (
          <>
            <div className="dock-popup__divider" />
            <h2 className="dock-popup__title">{t('dock_popup.tasks')}</h2>
            <div className="dock-popup__tasks">
              {tasks.map((task) => {
                const Icon = TASK_ICONS[task.key];
                return (
                  <button
                    className="dock-popup__task"
                    key={task.key}
                    disabled={task.state.unavailable}
                    onClick={() => handleTask(task.entityId)}
                  >
                    <Icon className="dock-popup__task-icon" aria-hidden="true" />
                    <span>{t(task.labelKey)}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </section>
    </Modal>
  );
}
