/**
 * convexHull.ts — Compute inflated convex hull for cluster rendering.
 * hullPath() returns an SVG path string (legacy, used by MiniGraph/SVG rendering).
 * hullPoints() returns a point array for Canvas rendering (Graph.tsx).
 */
import { polygonHull } from "d3-polygon";

export function hullPath(points: [number, number][], padding = 18): string {
  if (points.length === 0) return "";

  if (points.length < 3) {
    const cx = points.reduce((s, p) => s + p[0], 0) / points.length;
    const cy = points.reduce((s, p) => s + p[1], 0) / points.length;
    const r = padding;
    return `M ${cx} ${cy} m -${r} 0 a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 -${r * 2} 0`;
  }

  const hull = polygonHull(points);
  if (!hull) return "";

  const cx = hull.reduce((s, p) => s + p[0], 0) / hull.length;
  const cy = hull.reduce((s, p) => s + p[1], 0) / hull.length;

  const inflated = hull.map(([x, y]): [number, number] => {
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    return [x + (dx / dist) * padding, y + (dy / dist) * padding];
  });

  return `M ${inflated.map(p => p.join(" ")).join(" L ")} Z`;
}

/**
 * Canvas-ready hull: returns an inflated convex hull as a point array.
 * Falls back to a circle polygon for < 3 points.
 */
export function hullPoints(points: [number, number][], padding = 18): [number, number][] | null {
  if (points.length === 0) return null;

  if (points.length < 3) {
    const cx = points.reduce((s, p) => s + p[0], 0) / points.length;
    const cy = points.reduce((s, p) => s + p[1], 0) / points.length;
    return Array.from({ length: 16 }, (_, i) => {
      const angle = (i / 16) * Math.PI * 2;
      return [cx + Math.cos(angle) * padding, cy + Math.sin(angle) * padding] as [number, number];
    });
  }

  const hull = polygonHull(points);
  if (!hull) return null;

  const cx = hull.reduce((s, p) => s + p[0], 0) / hull.length;
  const cy = hull.reduce((s, p) => s + p[1], 0) / hull.length;

  return hull.map(([x, y]): [number, number] => {
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    return [x + (dx / dist) * padding, y + (dy / dist) * padding];
  });
}
