import { buildPolarOption, radiansLabel } from './polarOption';
import type { AxisSpec, SeriesSpec } from '../../adapter';
import { dataIdKey } from '../../core/dataId';

const ids = [1, 2, 3].map((s) => dataIdKey({ dayObs: 20240101, seqNum: s }));
const series: SeriesSpec = {
  id: 'p',
  name: 'alt/az',
  x: new Float64Array([0, 90, 180]), // azimuth
  y: new Float64Array([80, 45, 10]), // altitude
  dataIds: ids,
  marker: { color: '#058b8c', size: 5 },
};
const radial: AxisSpec = {
  location: 'radial',
  label: 'altitude',
  mapping: 'linear',
  inverted: true,
  kind: 'number',
};
const angular: AxisSpec = {
  location: 'angular',
  label: 'azimuth',
  mapping: 'linear',
  inverted: false,
  kind: 'number',
};

describe('polar option', () => {
  it('uses the astronomy convention: zero at top, clockwise, invertible radius', () => {
    const opt = buildPolarOption({
      series: [series],
      radialAxis: radial,
      angularAxis: angular,
      selected: new Set(),
      drillDown: null,
    }) as any;
    expect(opt.angleAxis).toMatchObject({ startAngle: 90, clockwise: true, min: 0, max: 360 });
    expect(opt.radiusAxis).toMatchObject({ inverse: true, name: 'altitude' });
    expect(opt.series[0].coordinateSystem).toBe('polar');
  });

  it('stores [radius, angle] rows and converts radians to degrees', () => {
    const rad: SeriesSpec = { ...series, x: new Float64Array([0, Math.PI / 2, Math.PI]) };
    const opt = buildPolarOption({
      series: [rad],
      radialAxis: radial,
      angularAxis: angular,
      angleUnit: 'radians',
      selected: new Set(),
      drillDown: null,
    }) as any;
    expect(Array.from(opt.dataset[0].source).map((v: any) => Math.round(v))).toEqual([
      80, 0, 45, 90, 10, 180,
    ]);
  });

  it('drill-down filters and selection overlays', () => {
    const opt = buildPolarOption({
      series: [series],
      radialAxis: radial,
      angularAxis: angular,
      selected: new Set([ids[1]]),
      drillDown: new Set([ids[1], ids[2]]),
    }) as any;
    expect(Array.from(opt.dataset[0].source)).toEqual([45, 90, 10, 180]);
    expect(opt.series.at(-1).data).toEqual([[45, 90]]);
  });

  it('labels radians as fractions of pi', () => {
    expect([0, 45, 90, 135, 180, 270, 360].map(radiansLabel)).toEqual([
      '0',
      'π/4',
      'π/2',
      '3π/4',
      'π',
      '3π/2',
      '0',
    ]);
  });
});
