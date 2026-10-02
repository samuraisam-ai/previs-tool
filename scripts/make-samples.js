// Regenerates the built-in sample sets (public/samples/*.json) from the house builders in
// src/props/demoHouse.ts. Run after catalogue or builder changes: npm run make:samples
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
// Inside the project, so the compiled files resolve 'vue' etc. from node_modules.
const out = path.join(root, 'node_modules/.cache/previs-samples')
fs.rmSync(out, { recursive: true, force: true })
// Compile just the builder and what it imports. The installed @types/node is newer than this
// TypeScript can parse, so type errors are ignored here (the app build type-checks properly).
try {
  execSync(`npx tsc --outDir "${out}" --module commonjs --target es2019 --moduleResolution node --esModuleInterop --skipLibCheck --downlevelIteration --resolveJsonModule src/props/demoHouse.ts`, { cwd: root, stdio: 'pipe' })
} catch (e) {
  if (!fs.existsSync(path.join(out, 'props/demoHouse.js'))) throw e
}
global.window = { setTimeout, clearTimeout }
const { buildHouse, THREE_BED, ONE_BED } = require(path.join(out, 'props/demoHouse'))
const { snapshotScene } = require(path.join(out, 'plan/history'))
const { scene } = require(path.join(out, 'scene/store'))

for (const [file, spec] of [['house-3bed.json', THREE_BED], ['house-1bed.json', ONE_BED]]) {
  buildHouse(spec)
  fs.writeFileSync(path.join(root, 'public/samples', file), snapshotScene())
  const count = kind => scene.items.filter(i => i.kind === kind).length
  console.log(`${file}: ${count('prop')} props, ${count('light')} practicals, ${scene.rooms.length} rooms, ${scene.openings.length} openings`)
}
fs.rmSync(out, { recursive: true, force: true })
