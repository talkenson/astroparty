import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/display/' : '/',
  server: {
    port: 5173,
  },
});
