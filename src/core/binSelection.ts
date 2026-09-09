/**
 * Histogram / box-chart bin selection state machine, ported from the Flutter
 * rubin_chart package (`src/models/binned.dart`, `_updatedBinSelection`,
 * `_navigateBins`, `_findNextEmptyBin`). Pure functions over an immutable state
 * so the behaviour is engine-independent and unit-testable.
 *
 * Semantics preserved:
 * - plain click: single selection, sets the range pivot
 * - cmd/ctrl click: toggle a bin; adding one moves the pivot
 * - shift click: select pivot..bin, first un-selecting the previous shift range
 * - left/right arrow: move the selection, wrapping at the ends
 * - shift + arrow in the direction away from the pivot: extend, bridging into
 *   any contiguous already-selected block; towards the pivot: shrink
 */
export type SeriesKey = string;

export interface SelectedBin {
  readonly series: SeriesKey;
  readonly bin: number;
}

export interface BinSelectionState {
  /** Insertion-ordered bins per series; the last inserted drives keyboard navigation. */
  readonly selected: ReadonlyMap<SeriesKey, ReadonlySet<number>>;
  readonly pivot: SelectedBin | null;
  readonly lastRangeEnd: SelectedBin | null;
}

export interface Modifiers {
  readonly shift?: boolean;
  readonly cmdCtrl?: boolean;
}

export const emptyBinSelection: BinSelectionState = {
  selected: new Map(),
  pivot: null,
  lastRangeEnd: null,
};

class Draft {
  selected: Map<SeriesKey, Set<number>>;
  pivot: SelectedBin | null;
  lastRangeEnd: SelectedBin | null;
  constructor(s: BinSelectionState) {
    this.selected = new Map([...s.selected].map(([k, v]) => [k, new Set(v)]));
    this.pivot = s.pivot;
    this.lastRangeEnd = s.lastRangeEnd;
  }
  has(series: SeriesKey, bin: number): boolean {
    return this.selected.get(series)?.has(bin) ?? false;
  }
  add(series: SeriesKey, bin: number): void {
    let set = this.selected.get(series);
    if (!set) this.selected.set(series, (set = new Set()));
    set.add(bin);
  }
  remove(series: SeriesKey, bin: number): void {
    const set = this.selected.get(series);
    if (!set) return;
    set.delete(bin);
    if (set.size === 0) this.selected.delete(series);
  }
  range(series: SeriesKey, from: number, to: number): void {
    const step = from <= to ? 1 : -1;
    for (let i = from; i !== to + step; i += step) this.add(series, i);
  }
  freeze(): BinSelectionState {
    return { selected: this.selected, pivot: this.pivot, lastRangeEnd: this.lastRangeEnd };
  }
}

export function clearBinSelection(): BinSelectionState {
  return emptyBinSelection;
}

/** Click on a bin, or `null` for a click on empty chart area. */
export function clickBin(
  state: BinSelectionState,
  bin: SelectedBin | null,
  mods: Modifiers = {},
): BinSelectionState {
  if (bin === null) return emptyBinSelection;
  const d = new Draft(state);
  if (mods.shift) {
    selectRangeWithClick(d, bin);
  } else if (mods.cmdCtrl) {
    if (d.has(bin.series, bin.bin)) {
      d.remove(bin.series, bin.bin);
    } else {
      d.add(bin.series, bin.bin);
      d.pivot = bin;
      d.lastRangeEnd = null;
    }
  } else {
    d.selected.clear();
    d.add(bin.series, bin.bin);
    d.pivot = bin;
    d.lastRangeEnd = null;
  }
  return d.freeze();
}

function selectRangeWithClick(d: Draft, bin: SelectedBin): void {
  const series = bin.series;
  if (!d.selected.has(series) || !d.pivot) {
    d.add(series, bin.bin);
    d.pivot = bin;
    return;
  }
  const pivot = d.pivot.bin;
  const end = bin.bin;
  if (pivot === end) return;
  if (d.lastRangeEnd) {
    const prev = d.lastRangeEnd.bin;
    const [lo, hi] = pivot < prev ? [pivot, prev] : [prev, pivot];
    for (let i = lo; i <= hi; i++) d.remove(series, i);
  }
  d.lastRangeEnd = bin;
  d.range(series, pivot, end);
}

export type ArrowKey = 'left' | 'right';

/**
 * Keyboard navigation. `numBins` is the bin count of the series being navigated
 * (the series with the most recently selected bin).
 */
export function navigateBins(
  state: BinSelectionState,
  key: ArrowKey,
  numBins: number,
  mods: Modifiers = {},
): BinSelectionState {
  if (state.selected.size === 0 || numBins < 1) return state;
  const d = new Draft(state);
  const series = [...d.selected.keys()].at(-1)!;
  const bins = [...d.selected.get(series)!];
  const last = bins.at(-1)!;
  let next = key === 'left' ? last - 1 : last + 1;

  if (mods.shift) {
    if (next < 0 || next > numBins - 1) return state;
  } else {
    next = ((next % numBins) + numBins) % numBins;
    d.lastRangeEnd = null;
  }

  if (mods.shift) {
    const pivot = d.pivot?.bin ?? last;
    if (next === pivot) {
      d.remove(series, last);
    } else {
      const movingRight = next > pivot;
      const arrowMatchesDirection =
        (movingRight && key === 'right') || (!movingRight && key === 'left');
      if (arrowMatchesDirection) {
        const end = findNextEmptyBin(d, series, numBins, next, !movingRight);
        d.range(series, next, end);
        d.lastRangeEnd = { series, bin: end };
      } else {
        d.remove(series, last);
      }
    }
  } else {
    d.selected.clear();
    d.add(series, next);
    d.pivot = { series, bin: next };
  }
  return d.freeze();
}

/**
 * From `index`, walk in the given direction across any contiguous run of already
 * selected bins and return the far end of that run, or `index` itself when the
 * neighbour is unselected. This is what lets shift+arrow bridge two blocks.
 */
function findNextEmptyBin(
  d: Draft,
  series: SeriesKey,
  numBins: number,
  index: number,
  left: boolean,
): number {
  const step = left ? -1 : 1;
  let nearest = -1;
  let i = index + step;
  while (i >= 0 && i < numBins && d.has(series, i)) {
    nearest = i;
    i += step;
  }
  return nearest !== -1 ? nearest : index;
}

/** Flattened view for rendering and for resolving bins to data ids. */
export function selectedBinsOf(state: BinSelectionState, series: SeriesKey): readonly number[] {
  return [...(state.selected.get(series) ?? [])].sort((a, b) => a - b);
}
