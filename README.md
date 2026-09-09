# rubin-charts

Engine-independent chart core and Apache ECharts adapters for Rubin Observatory
data visualization. This is the TypeScript successor to the Flutter
[`rubin_chart`](https://github.com/lsst-sitcom/rubin_chart) package and is consumed
by [`rubintv-ddv`](https://github.com/ugyballoons/rubintv-ddv).

## Layout

- `src/core` — things a chart engine does not give you and that must behave
  identically whichever engine is used: `DataId` keys, axis mappings
  (linear / log10 / log e), pixel-space histogram binning, a KDBush spatial index
  for selection hit-testing, and the histogram bin-selection keyboard state
  machine ported from the Flutter package.
- `src/adapter.ts` — the `ChartAdapterProps` contract every chart window renders through.
- `src/adapters/echarts` — pure functions that turn adapter props into ECharts options.

## Develop

```
npm install
npm test
npm run build
```

Licensed under the GPL-3.0-or-later, like the rest of the Rubin Observatory software.
