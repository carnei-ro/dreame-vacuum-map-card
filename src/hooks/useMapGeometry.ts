import { useMemo } from 'react';
import type { CalibrationPoint, Hass, Room } from '@/types/homeassistant';
import { resolveMapTransform, type MapDimensions, type MapRotation, type MapTransform } from '@/utils/mapTransform';
import { parseRooms } from '@/utils/roomParser';

export interface MapGeometry {
  rooms: Room[];
  rotation: MapRotation;
  transform: MapTransform | null;
}

interface UseMapGeometryParams {
  hass: Hass;
  mapEntityId: string;
  imageWidth: number;
  imageHeight: number;
  roomNames?: Record<string, string>;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseTuple(value: unknown): [number, number, number, number] | null {
  if (!Array.isArray(value) || value.length !== 4 || !value.every(isFiniteNumber)) {
    return null;
  }
  return [value[0], value[1], value[2], value[3]];
}

function parseCalibrationPoints(value: unknown): CalibrationPoint[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const points: CalibrationPoint[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) {
      return null;
    }
    const point = item as {
      vacuum?: { x?: unknown; y?: unknown };
      map?: { x?: unknown; y?: unknown };
    };
    if (
      !isFiniteNumber(point.vacuum?.x) ||
      !isFiniteNumber(point.vacuum.y) ||
      !isFiniteNumber(point.map?.x) ||
      !isFiniteNumber(point.map.y)
    ) {
      return null;
    }
    points.push({
      vacuum: { x: point.vacuum.x, y: point.vacuum.y },
      map: { x: point.map.x, y: point.map.y },
    });
  }

  return points.length >= 3 ? points : null;
}

function parseMapDimensions(attributes: Record<string, unknown>): MapDimensions | null {
  const { top, left, height, width, grid_size: gridSize } = attributes;
  if (
    !isFiniteNumber(top) ||
    !isFiniteNumber(left) ||
    !isFiniteNumber(height) ||
    !isFiniteNumber(width) ||
    !isFiniteNumber(gridSize) ||
    height <= 0 ||
    width <= 0 ||
    gridSize <= 0
  ) {
    return null;
  }

  const scale = attributes.scale === undefined ? 1 : attributes.scale;
  if (!isFiniteNumber(scale) || scale <= 0) {
    return null;
  }

  const padding: [number, number, number, number] | null =
    attributes.padding === undefined ? [0, 0, 0, 0] : parseTuple(attributes.padding);
  const crop: [number, number, number, number] | null =
    attributes.crop === undefined ? [0, 0, 0, 0] : parseTuple(attributes.crop);
  if (!padding || !crop) {
    return null;
  }

  return { top, left, height, width, gridSize, scale, padding, crop };
}

function parseRotation(value: unknown): MapRotation {
  return value === 90 || value === 180 || value === 270 ? value : 0;
}

export function useMapGeometry({
  hass,
  mapEntityId,
  imageWidth,
  imageHeight,
  roomNames,
}: UseMapGeometryParams): MapGeometry {
  const mapEntity = hass.states[mapEntityId];
  const attributes = mapEntity?.attributes;

  return useMemo(() => {
    const rooms = parseRooms(attributes?.rooms, roomNames);
    const rotation = parseRotation(attributes?.rotation);
    const transform = resolveMapTransform({
      calibrationPoints: parseCalibrationPoints(attributes?.calibration_points),
      dimensions: parseMapDimensions(attributes ?? {}),
      rooms,
      rotation,
      imageWidth,
      imageHeight,
    });

    return { rooms, rotation, transform };
  }, [attributes, imageWidth, imageHeight, roomNames]);
}
