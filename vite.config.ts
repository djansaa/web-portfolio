import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: '/web-portfolio/',
  build: {
    rollupOptions: {
      input: {
        home: fileURLToPath(new URL('./index.html', import.meta.url)),
        art: fileURLToPath(new URL('./art/index.html', import.meta.url)),
        dev: fileURLToPath(new URL('./dev/index.html', import.meta.url)),
      },
    },
  },
});
