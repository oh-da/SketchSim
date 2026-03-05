import {
  IDM_MAX_ACCEL,
  IDM_COMFORT_DECEL,
  IDM_MIN_GAP,
  IDM_DESIRED_HEADWAY,
} from '@/utils/constants';

export interface IDMParams {
  desiredSpeed: number;
  maxAccel: number;
  comfortDecel: number;
  minGap: number;
  desiredHeadway: number;
}

export const DEFAULT_IDM_PARAMS: Omit<IDMParams, 'desiredSpeed'> = {
  maxAccel: IDM_MAX_ACCEL,
  comfortDecel: IDM_COMFORT_DECEL,
  minGap: IDM_MIN_GAP,
  desiredHeadway: IDM_DESIRED_HEADWAY,
};

/**
 * Intelligent Driver Model — compute acceleration.
 * Pure function, all units in meters and seconds.
 */
export function computeAcceleration(
  params: IDMParams,
  currentSpeed: number,
  gapToLeader: number | null,
  leaderSpeed: number | null,
): number {
  const { desiredSpeed, maxAccel, comfortDecel, minGap, desiredHeadway } = params;

  // Free-road acceleration
  const vRatio = desiredSpeed > 0 ? currentSpeed / desiredSpeed : 0;
  const aFree = maxAccel * (1 - vRatio ** 4);

  // No leader → free flow only
  if (gapToLeader === null || leaderSpeed === null) {
    return clampAccel(aFree, maxAccel, comfortDecel);
  }

  // Emergency: gap <= 0
  if (gapToLeader <= 0) {
    return -comfortDecel * 2;
  }

  // Interaction term
  const deltaV = currentSpeed - leaderSpeed;
  const sqrtAB = Math.sqrt(maxAccel * comfortDecel);
  const sStar =
    minGap +
    Math.max(0, currentSpeed * desiredHeadway + (currentSpeed * deltaV) / (2 * sqrtAB));

  const aInteraction = -maxAccel * (sStar / gapToLeader) ** 2;

  return clampAccel(aFree + aInteraction, maxAccel, comfortDecel);
}

function clampAccel(a: number, maxAccel: number, comfortDecel: number): number {
  return Math.max(-comfortDecel * 2, Math.min(maxAccel, a));
}
