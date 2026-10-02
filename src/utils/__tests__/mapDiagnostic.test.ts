import { describe, expect, it } from 'vitest';
import { mapDiagnostic } from '../mapDiagnostic';

const ready = { hasCamera: true, floorReady: true, imageReady: true, roomCount: 2, hasTransform: true };

describe('mapDiagnostic', () => {
  it('reports a missing camera before other map problems', () => {
    expect(mapDiagnostic({ ...ready, hasCamera: false, roomCount: 0, hasTransform: false })).toBe('no_camera');
  });

  it('stays quiet while the selected floor is still loading', () => {
    expect(mapDiagnostic({ ...ready, floorReady: false, roomCount: 0, hasTransform: false })).toBeNull();
  });

  it('reports an empty room list once the image is ready', () => {
    expect(mapDiagnostic({ ...ready, roomCount: 0 })).toBe('no_rooms');
  });

  it('reports missing calibration when rooms exist but the transform does not', () => {
    expect(mapDiagnostic({ ...ready, hasTransform: false })).toBe('bad_calibration');
  });
});
