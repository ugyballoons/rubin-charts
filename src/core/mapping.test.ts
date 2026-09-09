import { log10Mapping, logEMapping, linearMapping, mappingFor } from './mapping';

describe('mapping', () => {
  it('round-trips', () => {
    for (const m of [linearMapping, log10Mapping, logEMapping]) {
      for (const v of [0.5, 1, 7, 1234.5]) expect(m.inverse(m.forward(v))).toBeCloseTo(v, 9);
    }
  });
  it('resolves by kind', () => {
    expect(mappingFor('log10')).toBe(log10Mapping);
  });
});
