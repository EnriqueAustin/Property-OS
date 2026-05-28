import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/propertyos-booking.ts',
      name: 'PropertyOSWidget',
      formats: ['iife'],
      fileName: () => 'widget.js',
    },
    outDir: 'dist',
    minify: 'terser',
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
