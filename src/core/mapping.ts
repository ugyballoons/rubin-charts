/** Axis value mapping: data value -> linear (screen-proportional) value and back. */
export type MappingKind = 'linear' | 'log10' | 'logE';

export interface Mapping {
  readonly kind: MappingKind;
  forward(value: number): number;
  inverse(linear: number): number;
}

export const linearMapping: Mapping = {
  kind: 'linear',
  forward: (v) => v,
  inverse: (l) => l,
};

export const log10Mapping: Mapping = {
  kind: 'log10',
  forward: (v) => Math.log10(v),
  inverse: (l) => 10 ** l,
};

export const logEMapping: Mapping = {
  kind: 'logE',
  forward: (v) => Math.log(v),
  inverse: (l) => Math.exp(l),
};

export function mappingFor(kind: MappingKind): Mapping {
  switch (kind) {
    case 'linear':
      return linearMapping;
    case 'log10':
      return log10Mapping;
    case 'logE':
      return logEMapping;
  }
}
