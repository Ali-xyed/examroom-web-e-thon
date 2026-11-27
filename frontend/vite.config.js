import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env }
  // Map only public Supabase configuration into the browser bundle.
  const publicConfig = {
    VITE_SUPABASE_URL: env.VITE_SUPABASE_URL || env.SUPABASE_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY:
      env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY,
    VITE_API_URL: process.env.VERCEL ? process.env.VITE_API_URL || '' : env.VITE_API_URL || '',
  }
  if (!publicConfig.VITE_SUPABASE_URL || !publicConfig.VITE_SUPABASE_PUBLISHABLE_KEY) {
    throw new Error('Configure the Supabase URL and publishable key before building.')
  }
  return {
  plugins: [react()],
  define: Object.fromEntries(Object.entries(publicConfig).map(([key, value]) => [
    `import.meta.env.${key}`, JSON.stringify(value),
  ])),
  build: {
    outDir: 'dist',
  },
  }
})
