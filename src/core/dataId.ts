/** Universal row identifier for Rubin exposure/visit data, shared across every chart. */
export interface DataId {
  readonly dayObs: number; // YYYYMMDD
  readonly seqNum: number;
}

/** Stable string key usable in Set/Map. */
export type DataIdKey = string & { readonly __brand: 'DataIdKey' };

export function dataIdKey(id: DataId): DataIdKey {
  return `${id.dayObs}:${id.seqNum}` as DataIdKey;
}

export function parseDataIdKey(key: DataIdKey): DataId {
  const sep = key.indexOf(':');
  return { dayObs: Number(key.slice(0, sep)), seqNum: Number(key.slice(sep + 1)) };
}

/** Sort order used by focal-plane playback: dayObs, then seqNum. */
export function compareDataId(a: DataId, b: DataId): number {
  return a.dayObs - b.dayObs || a.seqNum - b.seqNum;
}
