import type { Hass, Room } from '@/types/homeassistant';
import type { MapTransform } from './mapTransform';
import { logger } from './logger';

interface CameraRoomData {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  room_id: number;
  name: string;
  icon?: string;
  visibility?: string;
  x?: number;
  y?: number;
  outline?: unknown;
  outlines?: unknown;
  [key: string]: unknown;
}

interface RoomPoint {
  x: number;
  y: number;
}

const MIN_RING_AREA = 1e-6;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseRing(value: unknown): RoomPoint[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const points = value.flatMap((point) => {
    if (!Array.isArray(point) || point.length !== 2 || !isFiniteNumber(point[0]) || !isFiniteNumber(point[1])) {
      return [];
    }
    return [{ x: point[0], y: point[1] }];
  });

  return points.length >= 3 ? points : null;
}

function parseRoomRings(room: CameraRoomData): RoomPoint[][] | undefined {
  if (Array.isArray(room.outlines)) {
    const rings = room.outlines.flatMap((outline) => {
      const ring = parseRing(outline);
      return ring ? [ring] : [];
    });
    if (rings.length > 0) {
      return rings;
    }
  }

  const outline = parseRing(room.outline);
  return outline ? [outline] : undefined;
}

function ringArea(points: RoomPoint[]): number {
  return Math.abs(
    points.reduce((area, point, index) => {
      const next = points[(index + 1) % points.length];
      return area + point.x * next.y - next.x * point.y;
    }, 0) / 2
  );
}

function projectRing(points: RoomPoint[], transform: MapTransform): RoomPoint[] | null {
  const projected = points.map(({ x, y }) => transform.vacuumToMap({ x, y }));
  return projected.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y)) && ringArea(projected) > MIN_RING_AREA
    ? projected
    : null;
}

function createPath(rings: RoomPoint[][]): string {
  return rings
    .map(
      (ring) =>
        `M ${ring[0].x} ${ring[0].y} ${ring
          .slice(1)
          .map(({ x, y }) => `L ${x} ${y}`)
          .join(' ')} Z`
    )
    .join(' ');
}

/**
 * Resolve the display name of a room.
 *
 * Dreame devices only expose room names from a fixed English catalogue, so the card
 * lets users override them via the `room_names` config option. Lookup order:
 * segment id first (stable across renames), then the device-provided name.
 */
export function resolveRoomName(roomId: number, deviceName: string, roomNames?: Record<string, string>): string {
  if (!roomNames) return deviceName;
  return roomNames[String(roomId)] ?? roomNames[deviceName] ?? deviceName;
}

export function parseRooms(roomsValue: unknown, roomNames?: Record<string, string>): Room[] {
  if (typeof roomsValue !== 'object' || roomsValue === null || Array.isArray(roomsValue)) {
    return [];
  }

  const roomsData = roomsValue as Record<string, CameraRoomData>;
  return Object.values(roomsData).map((room) => ({
    id: room.room_id,
    name: resolveRoomName(room.room_id, room.name, roomNames),
    icon: room.icon,
    visibility: room.visibility,
    rings: parseRoomRings(room),
    x0: room.x0,
    y0: room.y0,
    x1: room.x1,
    y1: room.y1,
    x: room.x,
    y: room.y,
  }));
}

export function parseRoomsFromCamera(hass: Hass, cameraEntityId: string, roomNames?: Record<string, string>): Room[] {
  const cameraEntity = hass.states[cameraEntityId];
  if (!cameraEntity?.attributes?.rooms) {
    logger.debug('RoomParser', 'No rooms found in camera entity:', cameraEntityId);
    return [];
  }

  return parseRooms(cameraEntity.attributes.rooms, roomNames);
}

export function createRoomPath(room: Room, transform: MapTransform): string {
  if (room.rings?.length) {
    const projectedRings = room.rings.flatMap((ring) => {
      const projected = projectRing(ring, transform);
      return projected ? [projected] : [];
    });
    return projectedRings.length > 0 ? createPath(projectedRings) : '';
  }

  if (room.x0 === undefined || room.y0 === undefined || room.x1 === undefined || room.y1 === undefined) {
    logger.warn('Room missing coordinates:', room);
    return '';
  }

  const projected = projectRing(
    [
      { x: room.x0, y: room.y0 },
      { x: room.x1, y: room.y0 },
      { x: room.x1, y: room.y1 },
      { x: room.x0, y: room.y1 },
    ],
    transform
  );
  return projected ? createPath([projected]) : '';
}
