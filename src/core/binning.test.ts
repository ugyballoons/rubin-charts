import { binIndex, binValues, integerBinEdges, pixelSpaceBinEdges } from './binning';
import { linearMapping, log10Mapping } from './mapping';

describe('pixelSpaceBinEdges', () => {
  it('is uniform in data space on a linear axis', () => {
    expect(pixelSpaceBinEdges(4, { min: 0, max: 8 }, linearMapping)).toEqual([0, 2, 4, 6, 8]);
  });
  it('is log-spaced on a log axis so bars have equal pixel width', () => {
    const e = pixelSpaceBinEdges(3, { min: 1, max: 1000 }, log10Mapping);
    expect(e.map((v) => Math.round(v))).toEqual([1, 10, 100, 1000]);
  });
  it('rejects bad nBins', () => {
    expect(() => pixelSpaceBinEdges(0, { min: 0, max: 1 }, linearMapping)).toThrow(RangeError);
  });
});

describe('binIndex / binValues', () => {
  const edges = [0, 1, 2, 3];
  it('places values, with inclusive right edge on the last bin', () => {
    expect(binIndex(edges, 0)).toBe(0);
    expect(binIndex(edges, 0.99)).toBe(0);
    expect(binIndex(edges, 1)).toBe(1);
    expect(binIndex(edges, 3)).toBe(2);
    expect(binIndex(edges, 3.1)).toBe(-1);
    expect(binIndex(edges, -1)).toBe(-1);
  });
  it('counts and records members', () => {
    const r = binValues([0.2, 0.4, 1.5, 2.9, 9], edges);
    expect(Array.from(r.counts)).toEqual([2, 1, 1]);
    expect(r.members).toEqual([[0, 1], [2], [3]]);
  });
});

describe('integerBinEdges', () => {
  it('puts edges at half-integers, one value per bin when they fit', () => {
    expect(integerBinEdges(10, { min: 3, max: 7 })).toEqual([2.5, 3.5, 4.5, 5.5, 6.5, 7.5]);
  });
  it('widens bins to whole numbers of values when the range exceeds nBins', () => {
    const edges = integerBinEdges(4, { min: 0, max: 9 }); // 10 values, width 3
    expect(edges).toEqual([-0.5, 2.5, 5.5, 8.5, 11.5]);
    expect(binIndex(edges, 2)).toBe(0);
    expect(binIndex(edges, 3)).toBe(1);
    expect(binIndex(edges, 9)).toBe(3);
  });
  it('handles a single value and rejects a bad bin count', () => {
    expect(integerBinEdges(5, { min: 4, max: 4 })).toEqual([3.5, 4.5]);
    expect(() => integerBinEdges(0, { min: 0, max: 1 })).toThrow(RangeError);
  });
});
