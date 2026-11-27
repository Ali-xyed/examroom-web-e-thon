import {build} from 'esbuild'
import { cp, mkdir, writeFile } from 'node:fs/promises'

const url = process.env.SUPABASE_URL?.trim().replace(/\/$/, '')
const key = process.env.SUPABASE_PUBLISHABLE_KEY?.trim()

if (!url || !/^https:\/\/[a-z0-9]+\.supabase\.co$/i.test(url)) {
  throw new Error('Set SUPABASE_URL to the hosted Supabase project URL before building.')
}
if (!key?.startsWith('sb_publishable_')) {
  throw new Error('Use the Supabase publishable key. Never use a privileged key in this build.')
}

await mkdir('dist', { recursive: true })
await cp('public', 'dist', { recursive: true })
await mkdir('dist/vendor', {recursive:true})
await cp('node_modules/jspdf/dist/jspdf.umd.min.js', 'dist/vendor/jspdf.umd.min.js')
await cp('node_modules/jspdf/LICENSE', 'dist/vendor/jspdf.LICENSE')
await writeFile('dist/config.js', 'export default ' + JSON.stringify({ url, key }) + '\n')

await build({stdin:{contents:"export {createClient} from '@supabase/supabase-js'",resolveDir:process.cwd()},bundle:true,format:'esm',platform:'browser',outfile:'dist/vendor/supabase.js',minify:true})
