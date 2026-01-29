import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/controller/' : '/',
  server: {
    port: 5174,
  },
});
