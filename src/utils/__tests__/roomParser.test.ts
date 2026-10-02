import { describe, expect, it } from 'vitest';
import type { Room } from '@/types/homeassistant';
import { fitAffine, type MapTransform } from '../mapTransform';
import { createRoomPath, parseRooms } from '../roomParser';

function createTransform(mapX: { x: number; y: number }, mapY: { x: number; y: number }): MapTransform {
  const transform = fitAffine([
    { vacuum: { x: 0, y: 0 }, map: { x: 0, y: 0 } },
    { vacuum: { x: 10, y: 0 }, map: mapX },
    { vacuum: { x: 0, y: 10 }, map: mapY },
  ]);
  if (!transform) {
    throw new Error('Test calibration must produce a valid transform');
  }
  return transform;
}

const identityTransform = createTransform({ x: 10, y: 0 }, { x: 0, y: 10 });
const rotatedTransform = createTransform({ x: 0, y: 10 }, { x: -10, y: 0 });
const room: Room = { id: 1, name: 'Kitchen', x0: 0, y0: 0, x1: 10, y1: 20 };

describe('createRoomPath', () => {
  it('projects room bounds through 0 and 90 degree transforms', () => {
    expect(createRoomPath(room, identityTransform)).toBe('M 0 0 L 10 0 L 10 20 L 0 20 Z');
    expect(createRoomPath(room, rotatedTransform)).toBe('M 0 0 L 0 10 L -20 10 L -20 0 Z');
  });

  it('projects every valid outline ring as a closed subpath', () => {
    const outlinedRoom: Room = {
      id: 1,
      name: 'Kitchen',
      rings: [
        [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
        ],
        [
          { x: 2, y: 2 },
          { x: 2, y: 4 },
          { x: 4, y: 4 },
        ],
      ],
    };

    expect(createRoomPath(outlinedRoom, identityTransform)).toBe('M 0 0 L 10 0 L 10 10 Z M 2 2 L 2 4 L 4 4 Z');
  });

  it('rejects collapsed bounds and outline rings', () => {
    expect(createRoomPath({ ...room, x1: 0 }, identityTransform)).toBe('');
    expect(
      createRoomPath(
        {
          id: 1,
          name: 'Kitchen',
          rings: [
            [
              { x: 0, y: 0 },
              { x: 5, y: 5 },
              { x: 10, y: 10 },
            ],
          ],
        },
        identityTransform
      )
    ).toBe('');
  });
});

describe('parseRooms', () => {
  it('keeps valid outline rings and discards malformed siblings', () => {
    const [parsedRoom] = parseRooms({
      kitchen: {
        room_id: 1,
        name: 'Kitchen',
        x0: 0,
        y0: 0,
        x1: 10,
        y1: 10,
        outlines: [
          [
            [0, 0],
            [10, 0],
            [10, 10],
          ],
          [[0, 0], null, [Number.NaN, 2], [1, 1]],
          [
            [2, 2],
            [2, 4],
            ['invalid', 4],
            [4, 4],
          ],
        ],
      },
    });

    expect(parsedRoom.rings).toEqual([
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
      [
        { x: 2, y: 2 },
        { x: 2, y: 4 },
        { x: 4, y: 4 },
      ],
    ]);
  });

  it('uses a singular outline when no valid outlines ring exists', () => {
    const [parsedRoom] = parseRooms({
      kitchen: {
        room_id: 1,
        name: 'Kitchen',
        x0: 0,
        y0: 0,
        x1: 10,
        y1: 10,
        outlines: [
          [
            [0, 0],
            [1, 1],
          ],
        ],
        outline: [
          [0, 0],
          [10, 0],
          [10, 10],
        ],
      },
    });

    expect(parsedRoom.rings).toHaveLength(1);
  });

  it('falls back to room bounds when no outline is valid', () => {
    const [parsedRoom] = parseRooms({
      kitchen: {
        room_id: 1,
        name: 'Kitchen',
        x0: 0,
        y0: 0,
        x1: 10,
        y1: 10,
        outline: [[0, 0], ['invalid', 0], null],
      },
    });

    expect(parsedRoom.rings).toBeUndefined();
    expect(createRoomPath(parsedRoom, identityTransform)).toBe('M 0 0 L 10 0 L 10 10 L 0 10 Z');
  });
});
