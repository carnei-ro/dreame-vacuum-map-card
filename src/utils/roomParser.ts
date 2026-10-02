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
  [key: string]: unknown;
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
  if (room.x0 === undefined || room.y0 === undefined || room.x1 === undefined || room.y1 === undefined) {
    logger.warn('Room missing coordinates:', room);
    return '';
  }

  const toMap = (x: number, y: number) => transform.vacuumToMap({ x, y });

  const tl = toMap(room.x0, room.y0);
  const tr = toMap(room.x1, room.y0);
  const br = toMap(room.x1, room.y1);
  const bl = toMap(room.x0, room.y1);

  return `M ${tl.x} ${tl.y} L ${tr.x} ${tr.y} L ${br.x} ${br.y} L ${bl.x} ${bl.y} Z`;
}
