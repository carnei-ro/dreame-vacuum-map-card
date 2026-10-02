import type { CalibrationPoint, Room } from '@/types/homeassistant';

export interface MapPoint {
  x: number;
  y: number;
}

export interface MapDimensions {
  top: number;
  left: number;
  height: number;
  width: number;
  gridSize: number;
  scale: number;
  padding: [number, number, number, number];
  crop: [number, number, number, number];
}

export type MapRotation = 0 | 90 | 180 | 270;
export type MapTransformSource = 'calibration' | 'dimensions' | 'room_estimate';

export interface MapTransform {
  source: MapTransformSource;
  commandSafe: boolean;
  vacuumToMap(point: MapPoint): MapPoint;
  mapToVacuum(point: MapPoint): MapPoint;
}

interface AffineMatrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

interface ResolveMapTransformInput {
  calibrationPoints: CalibrationPoint[] | null;
  dimensions: MapDimensions | null;
  rooms: Room[];
  rotation: MapRotation;
  imageWidth: number;
  imageHeight: number;
}

const DETERMINANT_EPSILON = 1e-9;
const ROUND_TRIP_TOLERANCE = 1e-6;
const ROOM_PADDING_RATIO = 0.05;

function isFinitePoint(point: MapPoint): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

function determinant(x1: number, y1: number, x2: number, y2: number): number {
  return x1 * y2 - x2 * y1;
}

function isDegenerateBasis(x1: number, y1: number, x2: number, y2: number): boolean {
  const det = Math.abs(determinant(x1, y1, x2, y2));
  const scale = Math.max(Math.hypot(x1, y1) * Math.hypot(x2, y2), 1);
  return det <= DETERMINANT_EPSILON * scale;
}

function applyMatrix(matrix: AffineMatrix, point: MapPoint): MapPoint {
  return {
    x: matrix.a * point.x + matrix.b * point.y + matrix.c,
    y: matrix.d * point.x + matrix.e * point.y + matrix.f,
  };
}

function invertMatrix(matrix: AffineMatrix): AffineMatrix | null {
  const det = determinant(matrix.a, matrix.d, matrix.b, matrix.e);
  const scale = Math.max(Math.hypot(matrix.a, matrix.d) * Math.hypot(matrix.b, matrix.e), 1);
  if (Math.abs(det) <= DETERMINANT_EPSILON * scale) {
    return null;
  }

  const a = matrix.e / det;
  const b = -matrix.b / det;
  const d = -matrix.d / det;
  const e = matrix.a / det;

  return {
    a,
    b,
    c: -(a * matrix.c + b * matrix.f),
    d,
    e,
    f: -(d * matrix.c + e * matrix.f),
  };
}

function distance(first: MapPoint, second: MapPoint): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function createTransform(
  points: CalibrationPoint[],
  source: MapTransformSource,
  commandSafe: boolean
): MapTransform | null {
  const validPoints = points.filter((point) => isFinitePoint(point.vacuum) && isFinitePoint(point.map));
  if (validPoints.length < 3) {
    return null;
  }

  for (let firstIndex = 0; firstIndex < validPoints.length - 2; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < validPoints.length - 1; secondIndex += 1) {
      for (let thirdIndex = secondIndex + 1; thirdIndex < validPoints.length; thirdIndex += 1) {
        const p0 = validPoints[firstIndex];
        const p1 = validPoints[secondIndex];
        const p2 = validPoints[thirdIndex];

        const sx1 = p1.vacuum.x - p0.vacuum.x;
        const sy1 = p1.vacuum.y - p0.vacuum.y;
        const sx2 = p2.vacuum.x - p0.vacuum.x;
        const sy2 = p2.vacuum.y - p0.vacuum.y;
        const tx1 = p1.map.x - p0.map.x;
        const ty1 = p1.map.y - p0.map.y;
        const tx2 = p2.map.x - p0.map.x;
        const ty2 = p2.map.y - p0.map.y;

        if (isDegenerateBasis(sx1, sy1, sx2, sy2) || isDegenerateBasis(tx1, ty1, tx2, ty2)) {
          continue;
        }

        const sourceDet = determinant(sx1, sy1, sx2, sy2);
        const inverseSource = {
          a: sy2 / sourceDet,
          b: -sx2 / sourceDet,
          d: -sy1 / sourceDet,
          e: sx1 / sourceDet,
        };

        const matrix: AffineMatrix = {
          a: tx1 * inverseSource.a + tx2 * inverseSource.d,
          b: tx1 * inverseSource.b + tx2 * inverseSource.e,
          c: 0,
          d: ty1 * inverseSource.a + ty2 * inverseSource.d,
          e: ty1 * inverseSource.b + ty2 * inverseSource.e,
          f: 0,
        };
        matrix.c = p0.map.x - matrix.a * p0.vacuum.x - matrix.b * p0.vacuum.y;
        matrix.f = p0.map.y - matrix.d * p0.vacuum.x - matrix.e * p0.vacuum.y;

        const inverse = invertMatrix(matrix);
        if (!inverse) {
          continue;
        }

        const hasInvalidResidual = validPoints.some((point) => {
          const mapped = applyMatrix(matrix, point.vacuum);
          const roundTrip = applyMatrix(inverse, mapped);
          return (
            distance(mapped, point.map) > ROUND_TRIP_TOLERANCE ||
            distance(roundTrip, point.vacuum) > ROUND_TRIP_TOLERANCE
          );
        });
        if (hasInvalidResidual) {
          continue;
        }

        return {
          source,
          commandSafe,
          vacuumToMap: (point) => applyMatrix(matrix, point),
          mapToVacuum: (point) => applyMatrix(inverse, point),
        };
      }
    }
  }

  return null;
}

export function fitAffine(points: CalibrationPoint[]): MapTransform | null {
  return createTransform(points, 'calibration', true);
}

function rotateMapPoint(point: MapPoint, dimensions: MapDimensions, rotation: MapRotation): MapPoint {
  let width = Math.trunc(
    dimensions.width * dimensions.scale +
      dimensions.padding[0] +
      dimensions.padding[2] -
      dimensions.crop[0] -
      dimensions.crop[2]
  );
  let height = Math.trunc(
    dimensions.height * dimensions.scale +
      dimensions.padding[1] +
      dimensions.padding[3] -
      dimensions.crop[1] -
      dimensions.crop[3]
  );
  let { x, y } = point;

  for (let degree = rotation; degree > 0; degree -= 90) {
    const nextX = y;
    const nextY = width - x;
    x = nextX;
    y = nextY;
    [width, height] = [height, width];
  }

  return { x, y };
}

function dimensionsToMap(point: MapPoint, dimensions: MapDimensions, rotation: MapRotation): MapPoint {
  const unrotated = {
    x:
      ((point.x - dimensions.left) / dimensions.gridSize) * dimensions.scale +
      dimensions.padding[0] -
      dimensions.crop[0],
    y:
      ((dimensions.height * dimensions.gridSize - 1 - (point.y - dimensions.top)) / dimensions.gridSize) *
        dimensions.scale +
      dimensions.padding[1] -
      dimensions.crop[1],
  };

  return rotateMapPoint(unrotated, dimensions, rotation);
}

function transformFromDimensions(dimensions: MapDimensions, rotation: MapRotation): MapTransform | null {
  const vacuumPoints: MapPoint[] = [
    { x: 0, y: 0 },
    { x: 1000, y: 0 },
    { x: 0, y: 1000 },
  ];
  const points = vacuumPoints.map((vacuum) => ({
    vacuum,
    map: dimensionsToMap(vacuum, dimensions, rotation),
  }));

  return createTransform(points, 'dimensions', true);
}

function transformFromRooms(
  rooms: Room[],
  imageWidth: number,
  imageHeight: number,
  rotation: MapRotation
): MapTransform | null {
  const bounds = rooms.flatMap((room) => {
    if (room.x0 === undefined || room.y0 === undefined || room.x1 === undefined || room.y1 === undefined) {
      return [];
    }
    return [
      { x: room.x0, y: room.y0 },
      { x: room.x1, y: room.y1 },
    ];
  });
  if (bounds.length === 0 || imageWidth <= 0 || imageHeight <= 0) {
    return null;
  }

  const minX = Math.min(...bounds.map((point) => point.x));
  const maxX = Math.max(...bounds.map((point) => point.x));
  const minY = Math.min(...bounds.map((point) => point.y));
  const maxY = Math.max(...bounds.map((point) => point.y));
  if (minX === maxX || minY === maxY) {
    return null;
  }

  const left = imageWidth * ROOM_PADDING_RATIO;
  const right = imageWidth * (1 - ROOM_PADDING_RATIO);
  const top = imageHeight * ROOM_PADDING_RATIO;
  const bottom = imageHeight * (1 - ROOM_PADDING_RATIO);
  const vacuumPoints = [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: minX, y: maxY },
  ];
  const mapPoints: Record<MapRotation, MapPoint[]> = {
    0: [
      { x: left, y: bottom },
      { x: right, y: bottom },
      { x: left, y: top },
    ],
    90: [
      { x: left, y: top },
      { x: left, y: bottom },
      { x: right, y: top },
    ],
    180: [
      { x: right, y: top },
      { x: left, y: top },
      { x: right, y: bottom },
    ],
    270: [
      { x: right, y: bottom },
      { x: right, y: top },
      { x: left, y: bottom },
    ],
  };

  return createTransform(
    vacuumPoints.map((vacuum, index) => ({ vacuum, map: mapPoints[rotation][index] })),
    'room_estimate',
    false
  );
}

export function resolveMapTransform({
  calibrationPoints,
  dimensions,
  rooms,
  rotation,
  imageWidth,
  imageHeight,
}: ResolveMapTransformInput): MapTransform | null {
  if (calibrationPoints) {
    const calibrationTransform = fitAffine(calibrationPoints);
    if (calibrationTransform) {
      return calibrationTransform;
    }
  }

  if (dimensions) {
    const dimensionsTransform = transformFromDimensions(dimensions, rotation);
    if (dimensionsTransform) {
      return dimensionsTransform;
    }
  }

  return transformFromRooms(rooms, imageWidth, imageHeight, rotation);
}
