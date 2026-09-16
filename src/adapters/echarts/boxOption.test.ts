import { boxStats, buildBoxOption, computeBoxBins, percentile } from './boxOption';
import type { AxisSpec } from '../../adapter';

const mainAxis: AxisSpec = {
  location: 'bottom',
  label: 'x',
  mapping: 'linear',
  inverted: false,
  kind: 'number',
};
const crossAxis: AxisSpec = {
  location: 'left',
  label: 'y',
  mapping: 'linear',
  inverted: false,
  kind: 'number',
};

describe('box statistics', () => {
  it('interpolates percentiles like the Flutter box chart', () => {
    const sorted = [1, 2, 3, 4];
    expect(percentile(sorted, 0.5)).toBe(2.5);
    expect(percentile(sorted, 0.25)).toBe(1.75);
    expect(boxStats([4, 1, 3, 2])).toEqual({
      min: 1,
      q1: 1.75,
      median: 2.5,
      q3: 3.25,
      max: 4,
      count: 4,
    });
    expect(boxStats([])).toBeNull();
  });

  it('bins the main axis and summarises the cross values per bin', () => {
    const bins = computeBoxBins({
      series: [
        {
          id: 'b',
          name: 'b',
          main: [0, 1, 2, 3, 4, 5, 6, 7],
          cross: [10, 20, 30, 40, 1, 2, 3, 4],
          color: '#000',
        },
      ],
      mainAxis,
      crossAxis,
      nBins: 2,
      selected: new Map(),
    });
    expect(bins.edges).toEqual([0, 3.5, 7]);
    const stats = bins.perSeries.get('b')!;
    expect(stats[0]).toMatchObject({ min: 10, max: 40, median: 25, count: 4 });
    expect(stats[1]).toMatchObject({ min: 1, max: 4, count: 4 });
    expect(bins.members.get('b')![1]).toEqual([4, 5, 6, 7]);
  });

  it('emits one custom datum per non-empty bin with [lo, hi, min, q1, median, q3, max, bin]', () => {
    const opt = buildBoxOption({
      series: [{ id: 'b', name: 'b', main: [0, 1, 9, 10], cross: [1, 3, 5, 7], color: '#000' }],
      mainAxis,
      crossAxis,
      nBins: 5,
      selected: new Map(),
    }) as any;
    expect(opt.series[0].type).toBe('custom');
    expect(opt.series[0].data).toHaveLength(2);
    expect(opt.series[0].data[0][7]).toBe(0);
    expect(opt.series[0].data[1][7]).toBe(4);
    expect(opt.yAxis.name).toBe('y');
  });
});

describe('box option: integer main axis', () => {
  it('bins whole values with half-integer edges and integer-only ticks', () => {
    const input = {
      series: [
        {
          id: 'b',
          name: 'b',
          main: new Float64Array([1, 2, 2, 3]),
          cross: new Float64Array([10, 20, 30, 40]),
          color: '#000',
        },
      ],
      mainAxis: { ...mainAxis, integer: true },
      crossAxis,
      nBins: 10,
      selected: new Map(),
    };
    const bins = computeBoxBins(input);
    expect(bins.edges).toEqual([0.5, 1.5, 2.5, 3.5]);
    const opt = buildBoxOption(input, bins) as any;
    expect(opt.xAxis.minInterval).toBe(1);
    expect(opt.yAxis.minInterval).toBeUndefined();
  });
});
