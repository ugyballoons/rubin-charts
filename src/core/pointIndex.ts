import KDBush from 'kdbush';
import type { Mapping } from './mapping';

/**
 * Static spatial index over a series, built in *linear* (post-mapping) space so
 * it survives pan and zoom and only needs rebuilding when data or mapping changes.
 * Replaces the quadtree in the Flutter rubin_chart package.
 */
export class PointIndex {
  private readonly tree: KDBush;
  readonly size: number;

  constructor(
    x: ArrayLike<number>,
    y: ArrayLike<number>,
    private readonly xMap: Mapping,
    private readonly yMap: Mapping,
  ) {
    if (x.length !== y.length) throw new RangeError('x and y must have equal length');
    this.size = x.length;
    this.tree = new KDBush(this.size, 64, Float64Array);
    for (let i = 0; i < this.size; i++) {
      this.tree.add(xMap.forward(x[i]), yMap.forward(y[i]));
    }
    this.tree.finish();
  }

  /** Point indices inside a rectangle given in data units (any corner order). */
  rangeInData(x0: number, y0: number, x1: number, y1: number): number[] {
    const ax = this.xMap.forward(x0);
    const bx = this.xMap.forward(x1);
    const ay = this.yMap.forward(y0);
    const by = this.yMap.forward(y1);
    return this.tree.range(Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by));
  }

  /** Point indices inside a rectangle given in linear (mapped) units. */
  rangeInLinear(minX: number, minY: number, maxX: number, maxY: number): number[] {
    return this.tree.range(minX, minY, maxX, maxY);
  }

  /**
   * Nearest point to (x, y) in linear units within a half-width box, or -1.
   * Mirrors the Flutter ±10px pick box, which the caller converts to linear units.
   */
  nearestInLinear(x: number, y: number, halfW: number, halfH: number): number {
    const candidates = this.tree.range(x - halfW, y - halfH, x + halfW, y + halfH);
    let best = -1;
    let bestD = Infinity;
    for (const i of candidates) {
      const dx = this.tree.coords[2 * i] - x;
      const dy = this.tree.coords[2 * i + 1] - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }
}
