// Turns an exported production (Setups → Export, a .previs.json file) into set-link files in
// public/sets, one per scene: scene 7 becomes public/sets/d07.json, opened by ?set=d07.
//   npm run make:sets -- "path/to/30 Days · Week 1.previs.json"
// Each set uses the scene's starred capture, else its first storyboard frame, else its first
// setup. A frame opens through its camera; a setup opens in orbit. Title = the scene's synopsis
// (or its location).
const fs = require('fs')
const path = require('path')

const file = process.argv[2]
if (!file) {
  console.error('Usage: npm run make:sets -- <production.previs.json>')
  process.exit(1)
}
const data = JSON.parse(fs.readFileSync(file, 'utf8'))
if (data.format !== 'previs-production') {
  console.error(`${file} is not a Previs production export.`)
  process.exit(1)
}

const outDir = path.join(__dirname, '..', 'public', 'sets')
fs.mkdirSync(outDir, { recursive: true })

const slugFor = number => {
  const m = String(number).trim().toLowerCase().match(/^(\d+)([a-z]*)$/)
  return m ? `d${m[1].padStart(2, '0')}${m[2]}` : null
}

const live = data.captures.filter(c => !c.archived)
for (const sceneId of data.production.sceneOrder) {
  const sc = data.scenes.find(s => s.id === sceneId)
  if (!sc) continue
  const slug = slugFor(sc.number)
  if (!slug) {
    console.warn(`Skipped scene "${sc.number}": number it with the post's day (e.g. 7 or 12A).`)
    continue
  }
  const byId = id => live.find(c => c.id === id)
  const frames = sc.frameOrder.map(byId).filter(Boolean)
  const setupsList = sc.setupOrder.map(byId).filter(Boolean)
  const capture = [...frames, ...setupsList].find(c => c.starred) || frames[0] || setupsList[0]
  if (!capture) {
    console.warn(`Skipped scene ${sc.number}: it has no setups or frames.`)
    continue
  }
  const view = capture.kind === 'frame' && capture.shot ? capture.shot.camera.name : 'orbit'
  const set = { format: 'previs-set', title: sc.synopsis || sc.location || `Day ${sc.number}`, view, scene: JSON.parse(capture.sceneJson) }
  fs.writeFileSync(path.join(outDir, `${slug}.json`), JSON.stringify(set))
  console.log(`${slug}.json  ·  ${set.title}  ·  ${view === 'orbit' ? 'orbit' : `through ${view}`}  ·  from "${capture.name}"`)
  console.log(`  https://previs-tool.vercel.app/?set=${slug}&utm_source=instagram&utm_medium=social&utm_campaign=30days&utm_content=${slug}`)
}
