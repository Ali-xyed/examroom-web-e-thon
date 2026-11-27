import { cp, mkdir, writeFile } from 'node:fs/promises'

const url = process.env.SUPABASE_URL?.replace(/\/$/, '')
const key = process.env.SUPABASE_PUBLISHABLE_KEY

if (!url || !key || !/^https:\/\/[a-z0-9]+\.supabase\.co$/i.test(url)) {
  throw new Error('Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY before building.')
}
if (!key.startsWith('sb_publishable_')) {
  throw new Error('Use the Supabase publishable key. Never use a privileged key in this build.')
}

await mkdir('dist', { recursive: true })
await cp('public', 'dist', { recursive: true })
await writeFile('dist/config.js', 'export default ' + JSON.stringify({ url, key }) + '\n')
