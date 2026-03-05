import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { Position } from '@/types/network';
import { MIN_SEGMENT_LENGTH } from '@/utils/constants';
import { polylineLength } from '@/utils/geometry';

export interface RawSegment {
  id: string;
  startPoint: Position;
  endPoint: Position;
  points: Position[];
  isArrow: boolean;
}

export interface RawText {
  id: string;
  center: Position;
  text: string;
  numericValue: number | null;
}

export interface RawEllipse {
  id: string;
  center: Position;
  radiusX: number;
  radiusY: number;
}

export interface ParseResult {
  segments: RawSegment[];
  texts: RawText[];
  ellipses: RawEllipse[];
}

/**
 * Convert Excalidraw's relative point offsets to absolute canvas coordinates.
 * Excalidraw stores line points as [dx, dy] relative to element (x, y).
 */
function toAbsolutePoints(
  element: ExcalidrawElement & { points?: readonly (readonly number[])[] },
): Position[] {
  const pts = element.points;
  if (!pts || pts.length === 0) {
    return [{ x: element.x, y: element.y }];
  }
  return pts.map((p) => ({
    x: element.x + p[0],
    y: element.y + p[1],
  }));
}

export function parseElements(elements: readonly ExcalidrawElement[]): ParseResult {
  const segments: RawSegment[] = [];
  const texts: RawText[] = [];
  const ellipses: RawEllipse[] = [];

  for (const el of elements) {
    if (el.isDeleted) continue;

    if (el.type === 'line' || el.type === 'arrow') {
      const points = toAbsolutePoints(
        el as ExcalidrawElement & { points: readonly (readonly number[])[] },
      );
      if (points.length < 2) continue;

      // Filter short segments
      const len = polylineLength(points);
      if (len < MIN_SEGMENT_LENGTH) continue;

      segments.push({
        id: el.id,
        startPoint: points[0],
        endPoint: points[points.length - 1],
        points,
        isArrow: el.type === 'arrow',
      });
    } else if (el.type === 'text') {
      const textEl = el as ExcalidrawElement & {
        text: string;
        width: number;
        height: number;
      };
      const value = parseFloat(textEl.text.trim());
      texts.push({
        id: el.id,
        center: {
          x: el.x + (textEl.width ?? 0) / 2,
          y: el.y + (textEl.height ?? 0) / 2,
        },
        text: textEl.text,
        numericValue: Number.isNaN(value) ? null : value,
      });
    } else if (el.type === 'ellipse') {
      const width = (el as ExcalidrawElement & { width: number }).width ?? 0;
      const height = (el as ExcalidrawElement & { height: number }).height ?? 0;
      ellipses.push({
        id: el.id,
        center: { x: el.x + width / 2, y: el.y + height / 2 },
        radiusX: width / 2,
        radiusY: height / 2,
      });
    }
  }

  return { segments, texts, ellipses };
}
