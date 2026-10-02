import { useState, useCallback } from 'react';
import { useTransformContext, useTransformEffect } from 'react-zoom-pan-pinch';
import type { Zone } from '@/types/homeassistant';
import { useMachineState } from '@/contexts';
import { logger } from '@/utils/logger';

interface ZoneOverlayProps {
  zones: Zone[];
  onZonesChange: (zones: Zone[]) => void;
  clearZoneLabel: string;
  contentRef: React.RefObject<HTMLDivElement | null>;
}

type ResizeHandle = 'top' | 'right' | 'bottom' | 'left' | null;

/**
 * Zone selection overlay that works inside TransformComponent.
 * Handles zone creation (click) and resizing (drag edge handles).
 * The zone rectangle pans/zooms with the map content.
 */
export function ZoneOverlay({ zones, onZonesChange, clearZoneLabel, contentRef }: ZoneOverlayProps) {
  const transformContext = useTransformContext();
  const { phase } = useMachineState();
  const isInCleaningSession = phase === 'cleaning' || phase === 'paused';
  const [resizingHandle, setResizingHandle] = useState<ResizeHandle>(null);
  const [resizingIndex, setResizingIndex] = useState<number | null>(null);

  // Track scale reactively to counter-scale handles for consistent visual size
  const [scale, setScale] = useState(transformContext.state.scale);
  useTransformEffect(
    useCallback((state) => {
      setScale(state.state.scale);
    }, [])
  );
  const handleScale = 1 / scale;
  const [resizeStartZone, setResizeStartZone] = useState<Zone | null>(null);

  const getContentCoordinates = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const content = contentRef.current;
      if (!content) return null;

      const rect = content.getBoundingClientRect();
      const { scale } = transformContext.state;

      // Get position relative to the transformed content
      const x = (clientX - rect.left) / scale;
      const y = (clientY - rect.top) / scale;

      // Convert to percentage of content size
      const contentWidth = rect.width / scale;
      const contentHeight = rect.height / scale;

      const xPercent = Math.max(0, Math.min(100, (x / contentWidth) * 100));
      const yPercent = Math.max(0, Math.min(100, (y / contentHeight) * 100));

      return { x: xPercent, y: yPercent };
    },
    [contentRef, transformContext]
  );

  const handleContentClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (resizingHandle) return;
      e.stopPropagation();

      const coords = getContentCoordinates(e.clientX, e.clientY);
      if (!coords) return;

      const size = 15;
      const newZone: Zone = {
        x1: Math.max(0, coords.x - size / 2),
        y1: Math.max(0, coords.y - size / 2),
        x2: Math.min(100, coords.x + size / 2),
        y2: Math.min(100, coords.y + size / 2),
      };

      logger.debug('Zone', 'Created at click:', coords, newZone);
      onZonesChange([...zones, newZone]);
    },
    [getContentCoordinates, onZonesChange, resizingHandle, zones]
  );

  const handleResizeStart = (event: React.MouseEvent | React.TouchEvent, index: number, handle: ResizeHandle) => {
    event.stopPropagation();
    event.preventDefault();
    const zone = zones[index];
    if (!zone) return;

    setResizingIndex(index);
    setResizingHandle(handle);
    setResizeStartZone(zone);
  };

  const getClientPosition = (e: React.MouseEvent | React.TouchEvent) => {
    if ('touches' in e && e.touches.length > 0) {
      return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
    }
    return { clientX: (e as React.MouseEvent).clientX, clientY: (e as React.MouseEvent).clientY };
  };

  const handleResizeMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!resizingHandle || !resizeStartZone) return;

      const { clientX, clientY } = getClientPosition(e);
      const coords = getContentCoordinates(clientX, clientY);
      if (!coords) return;

      const newZone: Zone = { ...resizeStartZone };
      const minSize = 5;

      switch (resizingHandle) {
        case 'top':
          newZone.y1 = Math.min(coords.y, resizeStartZone.y2 - minSize);
          break;
        case 'bottom':
          newZone.y2 = Math.max(coords.y, resizeStartZone.y1 + minSize);
          break;
        case 'left':
          newZone.x1 = Math.min(coords.x, resizeStartZone.x2 - minSize);
          break;
        case 'right':
          newZone.x2 = Math.max(coords.x, resizeStartZone.x1 + minSize);
          break;
      }

      if (resizingIndex === null) return;
      onZonesChange(zones.map((existing, index) => (index === resizingIndex ? newZone : existing)));
    },
    [resizingHandle, resizingIndex, resizeStartZone, getContentCoordinates, onZonesChange, zones]
  );

  const handleResizeEnd = useCallback(() => {
    setResizingHandle(null);
    setResizingIndex(null);
    setResizeStartZone(null);
  }, []);

  const handleClearZone = (event: React.MouseEvent, index: number) => {
    event.stopPropagation();
    onZonesChange(zones.filter((_, zoneIndex) => zoneIndex !== index));
    setResizingHandle(null);
    setResizingIndex(null);
    setResizeStartZone(null);
  };

  return (
    <div
      className="vacuum-map__zone-container"
      onClick={handleContentClick}
      onMouseMove={handleResizeMove}
      onMouseUp={handleResizeEnd}
      onMouseLeave={handleResizeEnd}
      onTouchMove={handleResizeMove}
      onTouchEnd={handleResizeEnd}
      onTouchCancel={handleResizeEnd}
    >
      {zones.map((zone, index) => (
        <div
          key={`${zone.x1}-${zone.y1}-${zone.x2}-${zone.y2}-${index}`}
          className="vacuum-map__zone"
          style={{
            left: `${zone.x1}%`,
            top: `${zone.y1}%`,
            width: `${zone.x2 - zone.x1}%`,
            height: `${zone.y2 - zone.y1}%`,
          }}
          onClick={(event) => event.stopPropagation()}
        >
          {!isInCleaningSession && (
            <>
              <div
                className="vacuum-map__zone-handle vacuum-map__zone-handle--top"
                style={{ transform: `translateX(-50%) scale(${handleScale})` }}
                onMouseDown={(event) => handleResizeStart(event, index, 'top')}
                onTouchStart={(event) => handleResizeStart(event, index, 'top')}
                title="Resize"
              />
              <div
                className="vacuum-map__zone-handle vacuum-map__zone-handle--right"
                style={{ transform: `translateY(-50%) scale(${handleScale})` }}
                onMouseDown={(event) => handleResizeStart(event, index, 'right')}
                onTouchStart={(event) => handleResizeStart(event, index, 'right')}
                title="Resize"
              />
              <div
                className="vacuum-map__zone-handle vacuum-map__zone-handle--bottom"
                style={{ transform: `translateX(-50%) scale(${handleScale})` }}
                onMouseDown={(event) => handleResizeStart(event, index, 'bottom')}
                onTouchStart={(event) => handleResizeStart(event, index, 'bottom')}
                title="Resize"
              />
              <div
                className="vacuum-map__zone-handle vacuum-map__zone-handle--left"
                style={{ transform: `translateY(-50%) scale(${handleScale})` }}
                onMouseDown={(event) => handleResizeStart(event, index, 'left')}
                onTouchStart={(event) => handleResizeStart(event, index, 'left')}
                title="Resize"
              />
              <button
                className="vacuum-map__zone-clear"
                style={{ transform: `scale(${handleScale})` }}
                onClick={(event) => handleClearZone(event, index)}
                title={clearZoneLabel}
              >
                ×
              </button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
