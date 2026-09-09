import {
  clickBin,
  emptyBinSelection,
  navigateBins,
  selectedBinsOf,
  type BinSelectionState,
} from './binSelection';

const S = 'h';
const b = (bin: number) => ({ series: S, bin });
const sel = (s: BinSelectionState) => selectedBinsOf(s, S);

describe('clickBin', () => {
  it('plain click replaces the selection and sets the pivot', () => {
    let s = clickBin(emptyBinSelection, b(3));
    s = clickBin(s, b(5));
    expect(sel(s)).toEqual([5]);
    expect(s.pivot).toEqual(b(5));
  });
  it('click on empty area clears', () => {
    const s = clickBin(clickBin(emptyBinSelection, b(3)), null);
    expect(sel(s)).toEqual([]);
  });
  it('cmd-click toggles non-contiguous bins', () => {
    let s = clickBin(emptyBinSelection, b(1));
    s = clickBin(s, b(4), { cmdCtrl: true });
    s = clickBin(s, b(7), { cmdCtrl: true });
    expect(sel(s)).toEqual([1, 4, 7]);
    s = clickBin(s, b(4), { cmdCtrl: true });
    expect(sel(s)).toEqual([1, 7]);
    expect(s.pivot).toEqual(b(7));
  });
  it('shift-click selects pivot..bin and replaces the previous shift range', () => {
    let s = clickBin(emptyBinSelection, b(4));
    s = clickBin(s, b(8), { shift: true });
    expect(sel(s)).toEqual([4, 5, 6, 7, 8]);
    s = clickBin(s, b(6), { shift: true });
    expect(sel(s)).toEqual([4, 5, 6]);
    s = clickBin(s, b(2), { shift: true });
    expect(sel(s)).toEqual([2, 3, 4]);
  });
  it('shift-click with nothing selected on that series just adds the bin', () => {
    const s = clickBin(emptyBinSelection, b(2), { shift: true });
    expect(sel(s)).toEqual([2]);
  });
});

describe('navigateBins', () => {
  const n = 5;
  it('moves and wraps without shift', () => {
    let s = clickBin(emptyBinSelection, b(4));
    s = navigateBins(s, 'right', n);
    expect(sel(s)).toEqual([0]);
    s = navigateBins(s, 'left', n);
    expect(sel(s)).toEqual([4]);
    expect(s.pivot).toEqual(b(4));
  });
  it('does nothing when empty', () => {
    expect(navigateBins(emptyBinSelection, 'right', n)).toBe(emptyBinSelection);
  });
  it('shift+arrow extends away from the pivot and shrinks towards it', () => {
    let s = clickBin(emptyBinSelection, b(1));
    s = navigateBins(s, 'right', n, { shift: true });
    s = navigateBins(s, 'right', n, { shift: true });
    expect(sel(s)).toEqual([1, 2, 3]);
    s = navigateBins(s, 'left', n, { shift: true });
    expect(sel(s)).toEqual([1, 2]);
    s = navigateBins(s, 'left', n, { shift: true });
    expect(sel(s)).toEqual([1]);
  });
  it('shift+arrow stops at the ends instead of wrapping', () => {
    let s = clickBin(emptyBinSelection, b(4));
    const t = navigateBins(s, 'right', n, { shift: true });
    expect(t).toBe(s);
    s = clickBin(emptyBinSelection, b(0));
    expect(navigateBins(s, 'left', n, { shift: true })).toBe(s);
  });
  it('shift+arrow bridges into a contiguous selected block', () => {
    // select 0, cmd-select 3 and 4, pivot on 0 again, then extend right
    let s = clickBin(emptyBinSelection, b(3));
    s = clickBin(s, b(4), { cmdCtrl: true });
    s = clickBin(s, b(0), { cmdCtrl: true });
    s = navigateBins(s, 'right', n, { shift: true }); // 0,1 ... then 2 is empty
    expect(sel(s)).toEqual([0, 1, 3, 4]);
    s = navigateBins(s, 'right', n, { shift: true }); // next=2, neighbours 3,4 selected -> range 2..4
    expect(sel(s)).toEqual([0, 1, 2, 3, 4]);
    expect(s.lastRangeEnd).toEqual(b(4));
  });
});
