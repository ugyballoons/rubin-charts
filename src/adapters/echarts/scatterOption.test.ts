import { buildScatterOption, msToMjd, selectionOverlaySeries, superscript } from './scatterOption';
import type { AxisSpec, SeriesSpec } from '../../adapter';
import { dataIdKey } from '../../core/dataId';

const ids = [1, 2, 3].map((s) => dataIdKey({ dayObs: 20240101, seqNum: s }));
const series: SeriesSpec = {
  id: 's1',
  name: 'ra vs dec',
  x: new Float64Array([1, 2, 3]),
  y: new Float64Array([4, 5, 6]),
  dataIds: ids,
  marker: { color: '#058b8c', size: 5 },
};
const xAxis: AxisSpec = {
  location: 'bottom',
  label: 'ra',
  mapping: 'linear',
  inverted: false,
  kind: 'number',
};
const yAxis: AxisSpec = {
  location: 'left',
  label: 'dec',
  mapping: 'log10',
  inverted: true,
  kind: 'number',
};

describe('buildScatterOption', () => {
  it('maps axes, inversion and log mapping', () => {
    const opt = buildScatterOption({
      series: [series],
      xAxis,
      yAxis,
      selected: new Set(),
      drillDown: null,
    }) as any;
    expect(opt.xAxis.type).toBe('value');
    expect(opt.yAxis).toMatchObject({ type: 'log', logBase: 10, inverse: true });
    expect(opt.dataZoom[0]).toMatchObject({ moveOnMouseWheel: true, zoomOnMouseWheel: 'shift' });
  });

  it('draws selection as an overlay instead of touching the base dataset', () => {
    const opt = buildScatterOption({
      series: [series],
      xAxis,
      yAxis,
      selected: new Set([ids[1]]),
      drillDown: null,
    }) as any;
    expect(opt.dataset[0].source).toBeInstanceOf(Float64Array);
    expect(opt.dataset[0].source.length).toBe(6);
    const overlay = opt.series.find((s: any) => s.id === '__selected__');
    expect(overlay.data).toEqual([[2, 5]]);
  });

  it('drill-down filters the base data', () => {
    const opt = buildScatterOption({
      series: [series],
      xAxis,
      yAxis,
      selected: new Set(),
      drillDown: new Set([ids[0], ids[2]]),
    }) as any;
    expect(Array.from(opt.dataset[0].source)).toEqual([1, 4, 3, 6]);
  });

  it('enables large mode above the threshold', () => {
    const opt = buildScatterOption({
      series: [series],
      xAxis,
      yAxis,
      selected: new Set(),
      drillDown: null,
      largeThreshold: 2,
    }) as any;
    expect(opt.series[0].large).toBe(true);
  });

  it('exposes the overlay alone for merge updates', () => {
    const overlay = selectionOverlaySeries([series], new Set([ids[0], ids[2]])) as any;
    expect(overlay.id).toBe('__selected__');
    expect(overlay.data).toEqual([
      [1, 4],
      [3, 6],
    ]);
  });

  it('labels category axes from the spec', () => {
    const opt = buildScatterOption({
      series: [series],
      xAxis: { ...xAxis, kind: 'category', categories: ['a', 'b', 'c'] },
      yAxis,
      selected: new Set(),
      drillDown: null,
    }) as any;
    expect(opt.xAxis).toMatchObject({ type: 'category', data: ['a', 'b', 'c'] });
  });

  it('formats MJD and base-e labels', () => {
    expect(msToMjd(Date.UTC(2000, 0, 1, 12))).toBeCloseTo(51544.5, 6);
    expect(superscript(-12)).toBe('⁻¹²');
  });
});
