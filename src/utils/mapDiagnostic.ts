export type MapDiagnostic = 'no_camera' | 'no_rooms' | 'bad_calibration';

export function mapDiagnostic({
  hasCamera,
  floorReady,
  imageReady,
  roomCount,
  hasTransform,
}: {
  hasCamera: boolean;
  floorReady: boolean;
  imageReady: boolean;
  roomCount: number;
  hasTransform: boolean;
}): MapDiagnostic | null {
  if (!hasCamera) return 'no_camera';
  if (!floorReady || !imageReady) return null;
  if (roomCount === 0) return 'no_rooms';
  if (!hasTransform) return 'bad_calibration';
  return null;
}
