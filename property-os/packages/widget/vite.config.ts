import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'PropertyOSWidget',
      formats: ['iife'],
      fileName: () => 'widget.iife.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
    target: 'es2021',
    minify: 'terser',
  },
});
