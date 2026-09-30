import { loadImageUrl } from '../store'
import { Capture, Scene, slugLine } from '../types'

// Prints storyboard pages through the browser's print dialog (which also saves as PDF): a clean
// white document in a hidden frame, one 6-panel page per landscape sheet.

const escape = (text: string) => text.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] as string))

const STYLE = `
@page { size: landscape; margin: 10mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: #111; }
.page { page-break-after: always; break-after: page; height: 100vh; display: flex; flex-direction: column; }
.page:last-child { page-break-after: auto; break-after: auto; }
header { display: flex; align-items: baseline; gap: 12px; font-size: 10pt; color: #555; border-bottom: 1px solid #ccc; padding-bottom: 4pt; margin-bottom: 8pt; }
header b { flex: 1; color: #111; font-size: 11pt; }
.grid { flex: 1; display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(2, auto); gap: 8pt 10pt; align-content: start; }
.shot { aspect-ratio: 16 / 9; border: 1px solid #999; background: #f2f2f2; position: relative; overflow: hidden; }
.shot img { width: 100%; height: 100%; object-fit: cover; display: block; }
.index { position: absolute; top: 3pt; left: 3pt; font-size: 7pt; background: rgba(255,255,255,0.85); padding: 0 3pt; }
.caption { font-size: 8.5pt; line-height: 1.3; padding-top: 3pt; min-height: 42pt; }
.caption .line b { margin-right: 4pt; }
.caption .dialogue { font-style: italic; }
.caption .cam { color: #666; font-size: 7.5pt; }
`

export async function printStoryboard(scene: Scene, productionTitle: string, pages: Array<Array<string | null>>, byId: (id: string) => Capture | undefined): Promise<void> {
  const html: string[] = []
  for (let p = 0; p < pages.length; p++) {
    const cells: string[] = []
    for (let k = 0; k < pages[p].length; k++) {
      const id = pages[p][k]
      const c = id ? byId(id) : undefined
      const url = c ? await loadImageUrl(c.imageId) : null
      const shot = c?.shot
      const cam = shot?.camera
      cells.push(`<div>
        <div class="shot"><span class="index">${p * 6 + k + 1}</span>${url ? `<img src="${url}">` : ''}</div>
        <div class="caption">${c ? `
          <div class="line"><b>Shot ${escape(c.number)}</b>${shot ? escape([shot.size, shot.movement].filter(Boolean).join(' · ')) : ''}</div>
          ${shot?.action ? `<div>${escape(shot.action)}</div>` : c.name ? `<div>${escape(c.name)}</div>` : ''}
          ${shot?.dialogue ? `<div class="dialogue">“${escape(shot.dialogue)}”</div>` : ''}
          ${cam ? `<div class="cam">${cam.lensMm}mm · T${cam.tStop} · ${cam.heightM.toFixed(2)} m</div>` : ''}` : ''}
        </div>
      </div>`)
    }
    html.push(`<section class="page"><header><span>${escape(productionTitle)}</span><b>${escape(slugLine(scene))}</b><span>Page ${p + 1} / ${pages.length}</span></header><div class="grid">${cells.join('')}</div></section>`)
  }

  const frame = document.createElement('iframe')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
  document.body.appendChild(frame)
  const doc = frame.contentDocument as Document
  doc.open()
  doc.write(`<!doctype html><html><head><title>${escape(`${productionTitle} — Scene ${scene.number} storyboard`)}</title><style>${STYLE}</style></head><body>${html.join('')}</body></html>`)
  doc.close()
  // Wait for every image before opening the print dialog.
  await Promise.all(Array.from(doc.images).map(img => (img.complete ? Promise.resolve() : new Promise(resolve => { img.onload = img.onerror = resolve }))))
  const win = frame.contentWindow as Window
  win.focus()
  win.print()
  // The print dialog blocks until closed in most browsers; remove the frame afterwards.
  setTimeout(() => frame.remove(), 1000)
}
