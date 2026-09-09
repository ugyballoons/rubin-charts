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
      style: (o: object) => o,
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
    expect(some.series[0].renderItem({}, api(0)).style.opacity).toBe(0.35);
    expect(some.series[0].renderItem({}, api(1)).style.opacity).toBe(1);
  });
});
