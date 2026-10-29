import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:3000',
    launchOptions: {
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
      ],
    },
  },
  webServer: {
    command: 'npm run dev -- --port 3000',
    url: 'http://localhost:3000/api/config',
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      ...process.env,
      DARE_PAID_MODE: 'false',
      DARE_DEV_STORE: '',
      DARE_STRIPE_MOCK: '',
      STRIPE_SECRET_KEY: '',
      NEXT_PUBLIC_SUPABASE_URL: '',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
    },
  },
})
