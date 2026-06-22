/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    // Only run app tests here; Edge Function tests run under Deno (CI), not Vitest.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
