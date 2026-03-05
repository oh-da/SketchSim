import { describe, it, expect } from 'vitest';
import { computeAcceleration, DEFAULT_IDM_PARAMS } from '../idm';
import { DEFAULT_FREE_FLOW_SPEED } from '@/utils/constants';

const params = {
  ...DEFAULT_IDM_PARAMS,
  desiredSpeed: DEFAULT_FREE_FLOW_SPEED, // 13.9 m/s
};

describe('IDM computeAcceleration', () => {
  it('free flow from rest → max acceleration', () => {
    const a = computeAcceleration(params, 0, null, null);
    expect(a).toBeCloseTo(params.maxAccel, 1);
  });

  it('at desired speed with no leader → acceleration ≈ 0', () => {
    const a = computeAcceleration(params, params.desiredSpeed, null, null);
    expect(Math.abs(a)).toBeLessThan(0.01);
  });

  it('close to stopped leader → strong deceleration', () => {
    const a = computeAcceleration(params, 10, 3, 0);
    expect(a).toBeLessThan(-1);
  });

  it('following at desired headway and same speed → acceleration ≈ 0', () => {
    const speed = 10;
    // Desired gap: minGap + speed * T = 2 + 10 * 1 = 12m
    const a = computeAcceleration(params, speed, 12, speed);
    expect(Math.abs(a)).toBeLessThan(0.5);
  });

  it('approaching faster than leader → negative acceleration', () => {
    const a = computeAcceleration(params, 15, 20, 5);
    expect(a).toBeLessThan(0);
  });

  it('gap <= 0 → emergency braking', () => {
    const a = computeAcceleration(params, 10, 0, 5);
    expect(a).toBe(-params.comfortDecel * 2);
  });

  it('acceleration is clamped to maxAccel', () => {
    const a = computeAcceleration(params, 0, null, null);
    expect(a).toBeLessThanOrEqual(params.maxAccel);
  });

  it('deceleration is clamped', () => {
    const a = computeAcceleration(params, 20, 0.1, 0);
    expect(a).toBeGreaterThanOrEqual(-params.comfortDecel * 2);
  });
});
