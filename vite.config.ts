import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [dts({ include: ['src'], exclude: ['src/**/*.test.ts'] })],
  build: {
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: 'rubin-charts' },
    rollupOptions: { external: ['echarts', 'echarts/core', /^echarts\//, 'kdbush'] },
    sourcemap: true,
  },
  test: { globals: true, environment: 'node', include: ['src/**/*.test.ts'] },
});
