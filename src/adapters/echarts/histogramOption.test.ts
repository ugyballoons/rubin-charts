import { buildHistogramOption, computeHistogramBins } from './histogramOption';
import type { AxisSpec } from '../../adapter';

const values = new Float64Array([1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]);
const series = [{ id: 'h', name: 'h', values, color: '#058b8c' }];
const logAxis: AxisSpec = {
  location: 'bottom',
  label: 'x',
  mapping: 'log10',
  inverted: false,
  kind: 'number',
};

describe('histogram option: datetime and category axes', () => {
  it('uses a time axis with optional MJD labels for datetime data', () => {
    const t0 = Date.UTC(2025, 10, 1);
    const opt = buildHistogramOption({
      series: [
        {
          id: 't',
          name: 't',
          values: new Float64Array([t0, t0 + 3.6e6, t0 + 7.2e6]),
          color: '#000',
        },
      ],
      mainAxis: {
        location: 'bottom',
        label: 'obs_start',
        mapping: 'linear',
        inverted: false,
        kind: 'datetime',
        mjdLabels: true,
      },
      nBins: 2,
      selected: new Map(),
    }) as any;
    expect(opt.xAxis.type).toBe('time');
    expect(opt.xAxis.axisLabel.formatter(Date.UTC(2000, 0, 1, 12))).toBe('51544.500');
  });

  it('bins one bar per category for categorical data', () => {
    const bins = computeHistogramBins({
      series: [{ id: 'c', name: 'c', values: new Float64Array([0, 1, 1, 2, 2, 2]), color: '#000' }],
      mainAxis: {
        location: 'bottom',
        label: 'band',
        mapping: 'linear',
        inverted: false,
        kind: 'category',
        categories: ['g', 'r', 'i'],
      },
      nBins: 99,
      selected: new Map(),
    });
    expect(bins.edges).toEqual([-0.5, 0.5, 1.5, 2.5]);
    expect(Array.from(bins.perSeries.get('c')!.counts)).toEqual([1, 2, 3]);
    const opt = buildHistogramOption(
      {
        series: [{ id: 'c', name: 'c', values: new Float64Array([0, 1]), color: '#000' }],
        mainAxis: {
          location: 'bottom',
          label: 'band',
          mapping: 'linear',
          inverted: false,
          kind: 'category',
          categories: ['g', 'r', 'i'],
        },
        nBins: 3,
        selected: new Map(),
      },
      bins,
    ) as any;
    expect(opt.xAxis).toMatchObject({ type: 'category', data: ['g', 'r', 'i'] });
  });
});

describe('histogram option: linked selection inner bars', () => {
  it('draws an inner bar of the selected count when selectedCounts is given', () => {
    const api = (bin: number) => ({
      value: (i: number) => [1, 3, 10, bin, 2][i],
      coord: (v: number[]) => [v[0] * 10, 100 - v[1] * 10],
    });
    const opt = buildHistogramOption({
      series,
      mainAxis: logAxis,
      nBins: 3,
      selected: new Map(),
      selectedCounts: new Map([['h', [2, 0, 0]]]),
    }) as any;
    const item = opt.series[0].renderItem({}, api(0));
    expect(item.type).toBe('group');
    expect(item.children).toHaveLength(2);
    expect(item.children[0].style.opacity).toBe(0.35);
    expect(item.children[1].shape.height).toBe(20);
    const none = buildHistogramOption({
      series,
      mainAxis: logAxis,
      nBins: 3,
      selected: new Map(),
      selectedCounts: new Map([['h', [0, 0, 0]]]),
    }) as any;
    expect(none.series[0].renderItem({}, api(0)).type).toBe('rect');
  });
});

describe('histogram option', () => {
  it('bins uniformly in pixel space on a log axis', () => {
    const bins = computeHistogramBins({ series, mainAxis: logAxis, nBins: 3, selected: new Map() });
    expect(bins.edges.map((e) => Math.round(e))).toEqual([1, 10, 100, 1000]);
    expect(Array.from(bins.perSeries.get('h')!.counts)).toEqual([3, 3, 4]);
  });

  it('emits one custom series per input series with [lo, count, hi, bin] rows', () => {
    const opt = buildHistogramOption({
      series,
      mainAxis: logAxis,
      nBins: 3,
      selected: new Map(),
    }) as any;
    expect(opt.series).toHaveLength(1);
    expect(opt.series[0].type).toBe('custom');
    expect(opt.series[0].data[0][1]).toBe(3);
    expect(opt.series[0].data[0][3]).toBe(0);
    expect(opt.xAxis).toMatchObject({ type: 'log', logBase: 10 });
    expect(opt.yAxis).toMatchObject({ name: 'count', inverse: false });
  });

  it('flips orientation and inverts the count axis for a left-located main axis', () => {
    const opt = buildHistogramOption({
      series,
      mainAxis: { ...logAxis, location: 'left' },
      nBins: 3,
      selected: new Map(),
    }) as any;
    expect(opt.yAxis.type).toBe('log');
    expect(opt.xAxis).toMatchObject({ name: 'count', inverse: true });
    expect(opt.series[0].data[0][0]).toBe(3); // count first when horizontal
  });

  it('dims unselected bins only when something is selected', () => {
    const api = (bin: number) => ({
      value: (i: number) => [1, 3, 10, bin][i],
      coord: (v: number[]) => [v[0] * 10, 100 - v[1] * 10],
    });
    const none = buildHistogramOption({
      series,
      mainAxis: logAxis,
      nBins: 3,
      selected: new Map(),
    }) as any;
    expect(none.series[0].renderItem({}, api(0)).style.opacity).toBe(1);
    const some = buildHistogramOption({
      series,
      mainAxis: logAxis,
      nBins: 3,
      selected: new Map([['h', new Set([1])]]),
    }) as any;
    expect(some.series[0].renderItem({}, api(0)).style.opacity).toBe(0.2);
    expect(some.series[0].renderItem({}, api(1)).style.opacity).toBe(1);
  });
});

describe('histogram option: integer axis', () => {
  const intAxis: AxisSpec = { ...logAxis, mapping: 'linear', integer: true };
  it('bins whole values with half-integer edges and integer-only ticks', () => {
    const input = {
      series: [{ id: 'i', name: 'i', values: new Float64Array([1, 2, 2, 3, 5]), color: '#000' }],
      mainAxis: intAxis,
      nBins: 20,
      selected: new Map(),
    };
    const bins = computeHistogramBins(input);
    expect(bins.edges).toEqual([0.5, 1.5, 2.5, 3.5, 4.5, 5.5]);
    expect(Array.from(bins.perSeries.get('i')!.counts)).toEqual([1, 2, 1, 0, 1]);
    const opt = buildHistogramOption(input, bins) as any;
    expect(opt.xAxis.minInterval).toBe(1);
  });
  it('keeps pixel-space bins on a log axis even when integer', () => {
    const bins = computeHistogramBins({
      series,
      mainAxis: { ...logAxis, integer: true },
      nBins: 3,
      selected: new Map(),
    });
    expect(bins.edges).toEqual([1, 10, 100, 1000]);
  });
});
