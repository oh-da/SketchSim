import { DEFAULT_SCALE, VEHICLE_LENGTH } from './constants';

export function pxToMeters(px: number, scale = DEFAULT_SCALE): number {
  return px * scale;
}

export function metersToPx(m: number, scale = DEFAULT_SCALE): number {
  return m / scale;
}

export class ScaleContext {
  metersPerPx: number;
  vehicleLengthM = VEHICLE_LENGTH;

  constructor(metersPerPx = DEFAULT_SCALE) {
    this.metersPerPx = metersPerPx;
  }

  toPx(meters: number): number {
    return meters / this.metersPerPx;
  }

  toMeters(px: number): number {
    return px * this.metersPerPx;
  }

  vehicleLengthPx(): number {
    return this.toPx(this.vehicleLengthM);
  }
}
