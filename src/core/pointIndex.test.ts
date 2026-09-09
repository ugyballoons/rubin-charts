import { PointIndex } from './pointIndex';
import { linearMapping, log10Mapping } from './mapping';

describe('PointIndex', () => {
  const x = new Float64Array([1, 10, 100, 1000]);
  const y = new Float64Array([0, 1, 2, 3]);

  it('range queries in data units on a log axis', () => {
    const idx = new PointIndex(x, y, log10Mapping, linearMapping);
    expect(idx.rangeInData(5, -1, 500, 5).sort()).toEqual([1, 2]);
    // corner order does not matter
    expect(idx.rangeInData(500, 5, 5, -1).sort()).toEqual([1, 2]);
  });

  it('finds the nearest point inside a pick box', () => {
    const idx = new PointIndex(x, y, linearMapping, linearMapping);
    expect(idx.nearestInLinear(11, 1.2, 5, 5)).toBe(1);
    expect(idx.nearestInLinear(50, 50, 1, 1)).toBe(-1);
  });

  it('handles 100k points quickly', () => {
    const n = 100_000;
    const bx = new Float64Array(n);
    const by = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      bx[i] = Math.random();
      by[i] = Math.random();
    }
    const t0 = performance.now();
    const idx = new PointIndex(bx, by, linearMapping, linearMapping);
    const hits = idx.rangeInData(0.25, 0.25, 0.5, 0.5);
    const ms = performance.now() - t0;
    expect(hits.length).toBeGreaterThan(n * 0.05);
    expect(hits.length).toBeLessThan(n * 0.08);
    expect(ms).toBeLessThan(500);
  });
});
