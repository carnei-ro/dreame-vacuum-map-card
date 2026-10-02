import { describe, expect, it } from 'vitest';
import { readRoomSelect, readWetnessLevel } from '../useRoomSettings';

const SUCTION_OPTIONS = ['quiet', 'standard', 'strong', 'turbo'];
const SUCTION_BY_CODE: Record<number, string> = {
  0: 'quiet',
  1: 'standard',
  2: 'strong',
  3: 'turbo',
};
const CLEANING_TIMES_OPTIONS = ['1x', '2x', '3x'];
const CLEANING_TIMES_BY_CODE: Record<number, string> = { 1: '1x', 2: '2x', 3: '3x' };

describe('readRoomSelect', () => {
  it('keeps a published option and its current state', () => {
    expect(
      readRoomSelect(
        { state: 'standard', attributes: { options: ['quiet', 'standard', 'strong', 'turbo'], value: 1 } },
        SUCTION_OPTIONS,
        SUCTION_BY_CODE
      )
    ).toEqual({
      value: 'standard',
      options: ['quiet', 'standard', 'strong', 'turbo'],
    });
  });

  it('recovers the saved suction code when Home Assistant publishes the unavailable placeholder', () => {
    expect(
      readRoomSelect(
        { state: 'unavailable', attributes: { options: ['unavailable'], value: 1 } },
        SUCTION_OPTIONS,
        SUCTION_BY_CODE
      )
    ).toEqual({
      value: 'standard',
      options: SUCTION_OPTIONS,
    });
  });

  it('recovers cleaning times as the integration option label', () => {
    expect(
      readRoomSelect(
        { state: 'unavailable', attributes: { options: ['unavailable'], value: 1 } },
        CLEANING_TIMES_OPTIONS,
        CLEANING_TIMES_BY_CODE
      )
    ).toEqual({
      value: '1x',
      options: CLEANING_TIMES_OPTIONS,
    });
  });

  it('returns nothing when the entity is missing', () => {
    expect(readRoomSelect(undefined, SUCTION_OPTIONS, SUCTION_BY_CODE)).toEqual({ value: null, options: [] });
  });
});

describe('readWetnessLevel', () => {
  it('ignores the unavailable placeholder', () => {
    expect(readWetnessLevel({ state: 'unavailable' })).toBeNull();
  });

  it('reads a numeric state', () => {
    expect(readWetnessLevel({ state: '16' })).toBe(16);
  });
});
