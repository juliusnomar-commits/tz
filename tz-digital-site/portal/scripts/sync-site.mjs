import { cpSync, existsSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'

const source = resolve(import.meta.dirname, '../..')
const publicDir = resolve(import.meta.dirname, '../public')
if (!existsSync(join(source, 'index.html'))) {
  if (!existsSync(join(publicDir, 'index.html'))) throw new Error('TZ Digital site files are missing')
  process.stdout.write('Using bundled TZ Digital site files.\n')
} else {
  for (const file of readdirSync(source).filter(name => name.endsWith('.html') || name === 'robots.txt' || name === 'sitemap.xml')) {
    cpSync(join(source, file), join(publicDir, file))
  }
  for (const directory of ['assets', 'css', 'js']) cpSync(join(source, directory), join(publicDir, directory), { recursive: true, force: true })
  process.stdout.write('Synced TZ Digital site into the portal public directory.\n')
}
