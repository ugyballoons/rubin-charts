import type { DataIdKey } from './core/dataId';
import type { MappingKind } from './core/mapping';

export type SeriesId = string;
export type AxisLocation = 'left' | 'right' | 'top' | 'bottom' | 'radial' | 'angular';

export interface Marker {
  readonly color: string;
  readonly size: number;
  readonly edgeColor?: string;
}

export interface SeriesSpec {
  readonly id: SeriesId;
  readonly name: string;
  readonly x: Float64Array | readonly string[];
  readonly y: Float64Array;
  /** One key per point, aligned with x/y. */
  readonly dataIds: readonly DataIdKey[];
  readonly marker: Marker;
}

export interface AxisBounds {
  readonly min: number;
  readonly max: number;
}

export interface AxisSpec {
  readonly location: AxisLocation;
  readonly label: string;
  readonly mapping: MappingKind;
  readonly inverted: boolean;
  readonly kind: 'number' | 'category' | 'datetime';
  /**
   * For number axes: the values are whole numbers (ids, counts, detector
   * numbers). Ticks then land only on integers and histogram and box bins
   * are integer-wide with edges at half-integers, so no value sits on an edge.
   */
  readonly integer?: boolean;
  /** For datetime axes: label ticks as Modified Julian Date instead of calendar dates. */
  readonly mjdLabels?: boolean;
  /** For category axes: the labels; series values are indices into this list. */
  readonly categories?: readonly string[];
  /** When set the axis ignores zoom and pan. */
  readonly fixedBounds?: AxisBounds;
}

export type CursorTool = 'select' | 'drillDown';

/**
 * The contract every chart window renders through. Adapters translate these
 * props into engine options and DOM events into the callbacks; hit-testing,
 * binning and keyboard state machines live in `core` and stay engine-independent.
 */
export interface ChartAdapterProps {
  readonly series: readonly SeriesSpec[];
  readonly axes: readonly AxisSpec[];
  readonly selected: ReadonlySet<DataIdKey>;
  readonly drillDown: ReadonlySet<DataIdKey> | null;
  readonly tool: CursorTool;
  /** `committed=false` is the live preview broadcast during a drag. */
  onSelect(ids: ReadonlySet<DataIdKey>, committed: boolean): void;
  onZoom(bounds: readonly AxisBounds[]): void;
  onAxisTap(location: AxisLocation): void;
  onLegendTap(series: SeriesId): void;
}
