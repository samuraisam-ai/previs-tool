<template>
  <div class="guide-page">
    <article class="guide">
      <div class="top">
        <div>
          <p class="kicker">User guide</p>
          <h1>Previs Tool <span>by Leverage AI</span></h1>
        </div>
        <button class="pdf" @click="print">Download PDF</button>
      </div>

      <section>
        <h2>What it's for</h2>
        <p>
          Plan a shoot before you're on set. Lay out the location to scale, dress it, place your cast, cameras and
          lights, then look through a real lens to see what the shot will be. Save those setups into a production and
          turn them into a storyboard. Everyone (director, DP, gaffer, production designer) works from the same plan,
          so the shoot day has fewer surprises.
        </p>
      </section>

      <section>
        <h2>Start in a minute</h2>
        <ol>
          <li>Open <b>Setups</b> and pick <b>Sample – 1-bedroom apartment</b> (or the 3-bedroom house).</li>
          <li>Open a setup and click <b>Open in Floor Plan</b>. The furnished set loads with its cast, cameras and lamps.</li>
          <li>Switch to <b>Live View</b> and choose a camera in <b>View</b> to see the shot.</li>
        </ol>
        <p class="note">The samples are yours to change. Undo with ⌘Z / Ctrl+Z. If you delete them, <b>Restore samples</b> in Setups brings them back.</p>
      </section>

      <section class="space">
        <h2>The three spaces</h2>

        <h3>1 · Floor Plan: build and block the set</h3>
        <figure><img src="/guide/plan.jpg" alt="Floor Plan with the 3-bedroom sample" /></figure>
        <ul>
          <li><b>Draw the location:</b> rooms (R), walls (W), doors (D), windows (N), doorways (O), all in exact metres.</li>
          <li><b>Elements</b> adds subjects (cast), cameras, Nanlite lights and props. Click anything to edit it in the right panel.</li>
          <li><b>Pointer / Hand</b> (V / H) switches between selecting and moving around the map. Scroll to zoom, F to fit.</li>
        </ul>

        <h3>Set dressing</h3>
        <div class="pair">
          <figure><img src="/guide/library.jpg" alt="Props library sorted by room" /></figure>
          <figure><img src="/guide/select.jpg" alt="A selected sofa with its panel" /></figure>
        </div>
        <ul>
          <li><b>Props library</b> (J) is organised by room. Click a prop to place it; wall art snaps to walls and small things sit on tables.</li>
          <li>Select a prop to set its <b>exact size</b>, shape options and the <b>material, colour and pattern</b> of every part. You can also upload your own image for art, posters and screens.</li>
          <li><b>Light it</b> on a lamp adds a real practical bulb that moves with the lamp.</li>
        </ul>

        <h3>2 · Live View: see the shot</h3>
        <div class="pair">
          <figure><img src="/guide/live.jpg" alt="Live View through Camera A" /></figure>
          <figure><img src="/guide/live-orbit.jpg" alt="Free orbit over the house" /></figure>
        </div>
        <ul>
          <li><b>View → a camera</b> shows its frame with real sensor, lens, T-stop, ISO, shutter, ND and white balance, plus a histogram and meter.</li>
          <li><b>Free orbit</b> flies around the set. <b>Walls</b> can be cut away to see inside.</li>
          <li><b>World light</b> (morning, day, evening, night) and <b>Blackout</b> (fixtures only) are in the Floor Plan panel.</li>
        </ul>

        <h3>3 · Setups: keep what works</h3>
        <figure><img src="/guide/setups.jpg" alt="Setups for a scene" /></figure>
        <ul>
          <li><b>Capture</b> (C in Floor Plan, or FRAME in Live View) saves the plan or the camera frame into a production → scene.</li>
          <li>Every capture remembers the whole set: <b>Open in Floor Plan</b> takes you straight back to it.</li>
          <li>Frames build the <b>Storyboard</b>, which you can print. <b>Export</b> shares a whole production as one file and <b>Import</b> opens it on another computer.</li>
        </ul>
      </section>

      <section>
        <h2>Blocking and coverage</h2>
        <ul>
          <li><b>T marks</b> (K): select a subject or camera, then click its marks in order. <b>P</b> plays the move.</li>
          <li><b>180° line</b> (L) between two subjects. Cameras that cross it are flagged.</li>
        </ul>
      </section>

      <section>
        <h2>Tips</h2>
        <table class="keys">
          <tr><td>V / H</td><td>Pointer / hand</td><td>J</td><td>Props library</td></tr>
          <tr><td>R W D N O</td><td>Room, wall, door, window, doorway</td><td>C</td><td>Capture setup</td></tr>
          <tr><td>K / P</td><td>Blocking marks / play</td><td>L</td><td>180° line</td></tr>
          <tr><td>⌘D · ⌘C ⌘V</td><td>Duplicate · copy, paste</td><td>⌘Z</td><td>Undo (⇧ to redo)</td></tr>
        </table>
        <ul>
          <li><b>Slower laptop?</b> In Live View set <b>Performance → Lite</b>. Big sets build in a moment while "Building set…" shows.</li>
          <li>Your work saves in this browser. <b>Export</b> productions to back them up or share them.</li>
        </ul>
      </section>
    </article>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'GuideView',
  setup() {
    // The browser's print dialog has "Save as PDF"; the print styles lay the guide out on A4.
    const print = () => window.print()
    return { print }
  }
})
</script>

<style scoped>
.guide-page { height: 100%; overflow-y: auto; }
.guide { max-width: 860px; margin: 0 auto; padding: 32px 24px 64px; line-height: 1.55; font-size: 15px; }
.top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.kicker { margin: 0; color: var(--accent); font-size: 12px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; }
h1 { margin: 4px 0 8px; font-size: 30px; }
h1 span { font-size: 15px; font-weight: 400; color: var(--muted); }
h2 { margin: 28px 0 8px; font-size: 20px; }
h3 { margin: 20px 0 8px; font-size: 16px; color: var(--accent); }
p, ul, ol { margin: 6px 0; }
li { margin: 3px 0; }
.note { color: var(--muted); font-size: 14px; }
.pdf { flex-shrink: 0; background: var(--accent); border-color: var(--accent); color: #1a1a1a; font-weight: 600; }
.pdf:hover { background: #ffc46e; }
figure { margin: 10px 0; }
figure img { display: block; width: 100%; border-radius: 8px; border: 1px solid var(--line); }
.pair { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.pair figure { margin: 0; }
.keys { border-collapse: collapse; width: 100%; font-size: 14px; margin: 6px 0 10px; }
.keys td { padding: 5px 8px; border-bottom: 1px solid var(--line); }
.keys td:nth-child(odd) { font-weight: 600; white-space: nowrap; color: var(--accent); }
@media (max-width: 640px) {
  .guide { padding: 20px 16px 48px; }
  .pair { grid-template-columns: 1fr; }
  .top { flex-direction: column; }
}

/* Print / Save as PDF: black on white A4, about three pages. */
@media print {
  .guide-page { height: auto; overflow: visible; }
  .guide { max-width: none; padding: 0; font-size: 10.5pt; line-height: 1.4; color: #111; }
  .pdf { display: none; }
  .kicker, h3, .keys td:nth-child(odd) { color: #b26b00; }
  h1 span, .note { color: #555; }
  h2 { margin-top: 14px; font-size: 14pt; }
  h3 { margin-top: 10px; font-size: 11.5pt; }
  figure { margin: 6px 0; break-inside: avoid; }
  figure img { border-color: #ccc; max-height: 7.2cm; object-fit: cover; object-position: top; }
  .pair { gap: 8px; }
  .keys td { border-color: #ddd; padding: 3px 6px; }
  section { break-inside: auto; }
  h2, h3 { break-after: avoid; }
}
</style>

<style>
@media print {
  @page { size: A4; margin: 14mm; }
  html, body, #app { height: auto !important; background: #fff !important; color: #111 !important; }
  .shell > header { display: none !important; }
  .shell, .shell > main { display: block !important; height: auto !important; }
}
</style>
