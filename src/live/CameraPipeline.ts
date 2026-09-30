import { Camera } from '@babylonjs/core/Cameras/camera'
import { Constants } from '@babylonjs/core/Engines/constants'
import { RenderTargetWrapper } from '@babylonjs/core/Engines/renderTargetWrapper'
import { RenderTargetTexture } from '@babylonjs/core/Materials/Textures/renderTargetTexture'
import { Texture } from '@babylonjs/core/Materials/Textures/texture'
import { Effect } from '@babylonjs/core/Materials/effect'
import { EffectRenderer, EffectWrapper } from '@babylonjs/core/Materials/effectRenderer'
import { PostProcess } from '@babylonjs/core/PostProcesses/postProcess'
import { DepthRenderer } from '@babylonjs/core/Rendering/depthRenderer'
import { Scene } from '@babylonjs/core/scene'

// Per-camera post-processing that mimics the camera: physical depth of field (bokeh) on the HDR
// scene, then the camera's display transform (exposure, white balance, tone curve), then the
// monitor's exposure-assist overlays.

// Background (nothing rendered) reads as depth 0 in the camera-space-Z depth map → treat as far away.
const FAR = 10000.0

// Shared lens maths: thin-lens circle of confusion radius, in full-resolution pixels.
const COC_COMMON = `
precision highp float;
varying vec2 vUV;
uniform float focusMm;
uniform float focalMm;
uniform float fNumber;
uniform float imageWidthMm;
uniform float widthPx;
uniform float maxRadiusPx;
uniform vec2 texelSize;

float cocSigned(float z) {
  float d = z * 1000.0;
  float s = max(focusMm, focalMm + 1.0);
  float cocMm = (focalMm * focalMm) / (fNumber * (s - focalMm)) * (d - s) / d;
  float r = 0.5 * cocMm / imageWidthMm * widthPx;
  return clamp(r, -maxRadiusPx, maxRadiusPx);
}
`

const DEPTH_FN = `
uniform sampler2D depthSampler;
float depthAt(vec2 uv) {
  float z = texture2D(depthSampler, uv).r;
  return (isnan(z) || z <= 0.0) ? ${FAR.toFixed(1)} : z;
}
`

// 1. Full-res capture of the HDR scene (kept for the sharp composite). Guards against NaN/Inf.
Effect.ShadersStore.previsCaptureFragmentShader = `
precision highp float;
varying vec2 vUV;
uniform sampler2D textureSampler;
void main(void) {
  vec3 c = texture2D(textureSampler, vUV).rgb;
  if (any(isnan(c))) c = vec3(0.0);
  // Keep within half-float range by scaling, not per-channel clamping, so colours keep their hue.
  float m = max(max(c.r, c.g), c.b);
  if (m > 60000.0) c *= 60000.0 / m;
  gl_FragColor = vec4(c, 1.0);
}
`

// 2. Half-res colour + signed CoC (negative = in front of the focal plane). Uses the nearest depth
// of the 2×2 footprint so foreground edges keep their blur.
Effect.ShadersStore.previsCocDownFragmentShader = COC_COMMON + DEPTH_FN + `
uniform sampler2D textureSampler;
void main(void) {
  vec2 o = texelSize * 0.5;
  float z = min(min(depthAt(vUV + vec2(-o.x, -o.y)), depthAt(vUV + vec2(o.x, -o.y))),
                min(depthAt(vUV + vec2(-o.x, o.y)), depthAt(vUV + vec2(o.x, o.y))));
  gl_FragColor = vec4(texture2D(textureSampler, vUV).rgb, cocSigned(z));
}
`

// 3. Half-res bokeh gather: a golden-angle disc sized to this pixel's blur (tap count adapts to the
// radius), widened when an out-of-focus foreground object nearby reaches over this pixel.
Effect.ShadersStore.previsBokehFragmentShader = COC_COMMON + `
uniform sampler2D textureSampler;
const float GOLDEN = 2.39996323;
const int MAX_TAPS = BOKEH_TAPS;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void main(void) {
  vec4 c = texture2D(textureSampler, vUV);
  float cR = abs(c.a);

  // Foreground bleed: does a nearer, blurrier sample reach this pixel?
  float nearMax = c.a < 0.0 ? cR : 0.0;
  for (int i = 0; i < 12; i++) {
    float a = float(i) * 0.5235988;
    float r = maxRadiusPx * (i < 6 ? 0.5 : 1.0);
    vec4 s = texture2D(textureSampler, vUV + vec2(cos(a), sin(a)) * r * texelSize);
    if (s.a < 0.0 && -s.a >= r * 0.5) nearMax = max(nearMax, -s.a);
  }

  float kernel = max(cR, nearMax);
  if (kernel < 0.75) { gl_FragColor = vec4(c.rgb, nearMax); return; }

  // Samples are spaced ~2 full-res px apart (this pass runs at half resolution).
  float halfK = kernel * 0.5;
  int taps = int(clamp(halfK * halfK * 1.2 + 6.0, 6.0, float(MAX_TAPS)));
  float spin = hash(gl_FragCoord.xy) * 6.2831853;
  vec3 acc = c.rgb;
  float wsum = 1.0;
  for (int i = 0; i < MAX_TAPS; i++) {
    if (i >= taps) break;
    float r = sqrt((float(i) + 0.5) / float(taps)) * kernel;
    float a = float(i) * GOLDEN + spin;
    vec4 s = texture2D(textureSampler, vUV + vec2(cos(a), sin(a)) * r * texelSize);
    float sR = abs(s.a);
    // Signed CoC grows with depth, so a larger value = further away. Anything behind this pixel
    // can't spread further than this pixel's own disc (sharp foreground occludes blurred background).
    float reach = s.a > c.a ? min(sR, cR) : sR;
    float w = smoothstep(r - 1.5, r + 1.5, reach);
    acc += s.rgb * w;
    wsum += w;
  }
  gl_FragColor = vec4(acc / wsum, nearMax);
}
`

// 4. Full-res composite: in-focus pixels stay pin sharp; blur fades in as the CoC grows.
Effect.ShadersStore.previsDofCompositeFragmentShader = COC_COMMON + DEPTH_FN + `
uniform sampler2D textureSampler;
uniform sampler2D sharpSampler;
void main(void) {
  vec3 sharp = texture2D(sharpSampler, vUV).rgb;
  vec4 blurred = texture2D(textureSampler, vUV);
  float r = abs(cocSigned(depthAt(vUV)));
  float t = max(smoothstep(0.6, 2.0, r), smoothstep(0.6, 2.0, blurred.a));
  gl_FragColor = vec4(mix(sharp, blurred.rgb, t), 1.0);
}
`

// Camera display transform (scene-linear HDR → display sRGB), modelled on a Rec.709 camera look:
// exposure and white balance, faithful through the mids (18% grey stays 18%), then a soft shoulder
// into white. The shoulder is applied to the brightest channel and scales all three together, so hue
// never rotates; sources far past clip bleach towards white the way a sensor clips.
Effect.ShadersStore.previsDisplayFragmentShader = `
precision highp float;
varying vec2 vUV;
uniform sampler2D textureSampler;
uniform float exposure;
uniform vec3 wbGains;
const float KNEE = 0.6;
const float CLIP = 2.4;

float shoulder(float x) {
  return x <= KNEE ? x : KNEE + (1.0 - KNEE) * (1.0 - exp(-(x - KNEE) / (1.0 - KNEE)));
}
vec3 encodeSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main(void) {
  vec3 c = max(texture2D(textureSampler, vUV).rgb, 0.0) * exposure * wbGains;
  float n = max(max(c.r, c.g), c.b);
  if (n > KNEE) {
    float t = shoulder(n);
    c *= t / n;
    float bleach = clamp(log2(n / CLIP) / 3.0, 0.0, 1.0);
    c = mix(c, vec3(t), bleach);
  }
  gl_FragColor = vec4(encodeSrgb(clamp(c, 0.0, 1.0)), 1.0);
}
`

// Shared by every camera's display pass (the orbit view uses the active camera's settings).
export interface DisplaySettings {
  exposure: number
  wbGains: [number, number, number]
}

function createDisplay(camera: Camera, engine: ReturnType<Scene['getEngine']>, display: DisplaySettings): PostProcess {
  const pass = new PostProcess('display', 'previsDisplay', ['exposure', 'wbGains'], null, 1, camera,
    Texture.BILINEAR_SAMPLINGMODE, engine, false, null, Constants.TEXTURETYPE_HALF_FLOAT)
  pass.onApply = effect => {
    effect.setFloat('exposure', display.exposure)
    effect.setFloat3('wbGains', display.wbGains[0], display.wbGains[1], display.wbGains[2])
  }
  return pass
}

Effect.ShadersStore.previsMonitorFragmentShader = `
precision highp float;
varying vec2 vUV;
uniform sampler2D textureSampler;
uniform float zebras;
uniform float zebraLevel;
uniform float falseColour;
uniform float noiseAmp;
uniform float time;

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

vec3 falseColourMap(float ire, float grey) {
  vec3 g = vec3(grey * 0.9);
  if (ire < 2.5) return vec3(0.5, 0.0, 0.6);   // crushed
  if (ire < 10.0) return vec3(0.1, 0.35, 1.0);  // near black
  if (ire < 38.0) return g;
  if (ire < 45.0) return vec3(0.2, 0.85, 0.2);  // 18% grey
  if (ire < 52.0) return g;
  if (ire < 58.0) return vec3(1.0, 0.55, 0.7);  // skin, one stop over grey
  if (ire < 92.0) return g;
  if (ire < 98.0) return vec3(1.0, 0.9, 0.0);   // near clip
  return vec3(1.0, 0.0, 0.0);                   // clipped
}

void main(void) {
  vec3 col = texture2D(textureSampler, vUV).rgb;
  // Sensor noise: grows with gain above base ISO and is most visible in the shadows.
  float n = hash(gl_FragCoord.xy + fract(time) * 97.0) - 0.5;
  col += n * noiseAmp * (1.0 - 0.6 * col);
  col = clamp(col, 0.0, 1.0);
  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  float ire = luma * 100.0;
  if (falseColour > 0.5) col = falseColourMap(ire, luma);
  if (zebras > 0.5 && ire >= zebraLevel) {
    float stripe = step(0.5, fract((gl_FragCoord.x + gl_FragCoord.y) / 12.0));
    col = mix(col, vec3(stripe), 0.7);
  }
  gl_FragColor = vec4(col, 1.0);
}
`

export interface PipelineSettings {
  // Recorded image width / height (e.g. 16/9). Post-process targets span the whole canvas and are
  // stretched into the letterboxed image, so vertical offsets need this to keep bokeh circular.
  imageAspect: number
  focusM: number
  focalMm: number
  fNumber: number
  imageWidthMm: number
  zebras: boolean
  zebraLevel: number
  falseColour: boolean
  noiseAmp: number
}

export const MAX_BLUR_RADIUS_PX = 64

const LENS_UNIFORMS = ['focusMm', 'focalMm', 'fNumber', 'imageWidthMm', 'widthPx', 'maxRadiusPx', 'texelSize']

export class CameraPipeline {
  private depth: DepthRenderer
  private passes: PostProcess[] = []
  private monitor: PostProcess
  settings: PipelineSettings = {
    imageAspect: 16 / 9, focusM: 2, focalMm: 35, fNumber: 4, imageWidthMm: 35.6,
    zebras: false, zebraLevel: 95, falseColour: false, noiseAmp: 0
  }

  private scene: Scene
  private scopeTarget: RenderTargetWrapper | null = null
  private scopeRenderer: EffectRenderer | null = null
  private scopeWrapper: EffectWrapper | null = null
  private scopeBuffer: WebGLBuffer | null = null

  constructor(scene: Scene, camera: Camera, display: DisplaySettings, tier: { msaa: number; bokehTaps: number }) {
    const engine = scene.getEngine()
    this.scene = scene
    const HALF = Constants.TEXTURETYPE_HALF_FLOAT
    const LINEAR = Texture.BILINEAR_SAMPLINGMODE
    this.depth = scene.enableDepthRenderer(camera, false, true, Texture.NEAREST_SAMPLINGMODE, true)
    // A placed camera doesn't move between plan edits: render its depth once per change.
    this.depth.getDepthMap().refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE

    const capture = new PostProcess('capture', 'previsCapture', null, null, 1, camera, LINEAR, engine, false, null, HALF)
    // The scene renders into this target, so it carries the anti-aliasing (MSAA) for the image.
    capture.samples = tier.msaa
    const cocDown = new PostProcess('cocDown', 'previsCocDown', LENS_UNIFORMS, ['depthSampler'], 0.5, camera, LINEAR, engine, false, null, HALF)
    const bokeh = new PostProcess('bokeh', 'previsBokeh', LENS_UNIFORMS, null, 0.5, camera, LINEAR, engine, false, `#define BOKEH_TAPS ${tier.bokehTaps}`, HALF)
    const composite = new PostProcess('dofComposite', 'previsDofComposite', LENS_UNIFORMS, ['depthSampler', 'sharpSampler'], 1, camera, LINEAR, engine, false, null, HALF)

    // All lens passes work in full-resolution pixel units, whatever resolution they run at.
    const setLens = (effect: Effect) => {
      const s = this.settings
      const width = capture.width
      effect.setFloat('focusMm', s.focusM * 1000)
      effect.setFloat('focalMm', s.focalMm)
      effect.setFloat('fNumber', s.fNumber)
      effect.setFloat('imageWidthMm', s.imageWidthMm)
      effect.setFloat('widthPx', width)
      effect.setFloat('maxRadiusPx', MAX_BLUR_RADIUS_PX * (width / 1920))
      // One "pixel" is 1/width of the image across; the same distance down is aspect × larger in uv.
      effect.setFloat2('texelSize', 1 / width, s.imageAspect / width)
    }
    cocDown.onApply = effect => {
      setLens(effect)
      effect.setTexture('depthSampler', this.depth.getDepthMap())
    }
    bokeh.onApply = setLens
    composite.onApply = effect => {
      setLens(effect)
      effect.setTexture('depthSampler', this.depth.getDepthMap())
      effect.setTextureFromPostProcess('sharpSampler', capture)
    }

    // HDR in, display out.
    const imaging = createDisplay(camera, engine, display)

    const monitor = this.monitor = new PostProcess(
      'monitor', 'previsMonitor', ['zebras', 'zebraLevel', 'falseColour', 'noiseAmp', 'time'],
      null, 1, camera, Texture.NEAREST_SAMPLINGMODE, engine
    )
    monitor.onApply = effect => {
      const s = this.settings
      effect.setFloat('zebras', s.zebras ? 1 : 0)
      effect.setFloat('zebraLevel', s.zebraLevel)
      effect.setFloat('falseColour', s.falseColour ? 1 : 0)
      effect.setFloat('noiseAmp', s.noiseAmp)
      effect.setFloat('time', performance.now() / 1000)
    }
    this.passes = [capture, cocDown, bokeh, composite, imaging, monitor]
  }

  // Re-render the depth map after the scene changed.
  invalidate(): void {
    this.depth.getDepthMap().resetRefreshCounter()
  }

  // The graded image before the monitor's assist overlays (false colour, zebras) — what scopes
  // measure. It's shrunk to 256×144 on the GPU and read back asynchronously (WebGL2 pixel buffer +
  // fence), so rendering never waits: ~150 KB instead of a full-frame stall.
  readGraded(): Promise<{ data: Uint8Array; width: number; height: number }> | null {
    const source = this.monitor.inputTexture?.texture
    const engine = this.scene.getEngine()
    const gl = (engine as unknown as { _gl: WebGL2RenderingContext })._gl
    if (!source || !gl || typeof gl.fenceSync !== 'function') return null
    const W = 256
    const H = 144
    if (!this.scopeTarget) {
      this.scopeTarget = engine.createRenderTargetTexture({ width: W, height: H }, {
        generateMipMaps: false, type: Constants.TEXTURETYPE_UNSIGNED_BYTE, samplingMode: Texture.BILINEAR_SAMPLINGMODE, generateDepthBuffer: false
      })
      this.ensureCopyEffect()
      this.scopeBuffer = gl.createBuffer()
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.scopeBuffer)
      gl.bufferData(gl.PIXEL_PACK_BUFFER, W * H * 4, gl.STREAM_READ)
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null)
    }
    const wrapper = this.scopeWrapper as EffectWrapper
    if (!wrapper.effect.isReady()) return null
    wrapper.onApplyObservable.addOnce(() => { wrapper.effect._bindTexture('source', source) })
    const renderer = this.scopeRenderer as EffectRenderer
    renderer.render(wrapper, this.scopeTarget)
    engine.bindFramebuffer(this.scopeTarget)
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.scopeBuffer)
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, 0)
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null)
    engine.unBindFramebuffer(this.scopeTarget)
    engine.restoreDefaultFramebuffer()
    const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)
    gl.flush()
    const buffer = this.scopeBuffer
    return new Promise((resolve, reject) => {
      const poll = () => {
        if (!fence) { reject(new Error('no fence')); return }
        if (gl.clientWaitSync(fence, 0, 0) === gl.TIMEOUT_EXPIRED) { setTimeout(poll, 4); return }
        gl.deleteSync(fence)
        const data = new Uint8Array(W * H * 4)
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buffer)
        gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, data)
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null)
        resolve({ data, width: W, height: H })
      }
      poll()
    })
  }

  // A plain texture copy (resampling to the target size), shared by scopes and stills.
  private ensureCopyEffect(): void {
    if (this.scopeWrapper) return
    const engine = this.scene.getEngine()
    this.scopeRenderer = new EffectRenderer(engine)
    this.scopeWrapper = new EffectWrapper({
      engine, name: 'scopeDown', samplerNames: ['source'],
      fragmentShader: 'precision highp float; varying vec2 vUV; uniform sampler2D source; void main(void) { gl_FragColor = vec4(texture2D(source, vUV).rgb, 1.0); }'
    })
  }

  // The clean graded frame at full render resolution (no zebras, false colour or OSD), for
  // storyboard stills. Synchronous: call right after a frame has been drawn. Rows are bottom-up.
  // The pass textures span the whole canvas with the letterboxed frame stretched across them, so
  // the copy resamples back to the recording `aspect` (e.g. 16:9).
  readStill(aspect: number): { data: Uint8Array; width: number; height: number } | null {
    const source = this.monitor.inputTexture?.texture
    const engine = this.scene.getEngine()
    const gl = (engine as unknown as { _gl: WebGL2RenderingContext })._gl
    if (!source || !gl) return null
    this.ensureCopyEffect()
    const wrapper = this.scopeWrapper as EffectWrapper
    if (!wrapper.effect.isReady()) return null
    const width = source.width
    const height = Math.round(width / aspect)
    const target = engine.createRenderTargetTexture({ width, height }, {
      generateMipMaps: false, type: Constants.TEXTURETYPE_UNSIGNED_BYTE, samplingMode: Texture.BILINEAR_SAMPLINGMODE, generateDepthBuffer: false
    })
    try {
      wrapper.onApplyObservable.addOnce(() => { wrapper.effect._bindTexture('source', source) })
      ;(this.scopeRenderer as EffectRenderer).render(wrapper, target)
      engine.bindFramebuffer(target)
      const data = new Uint8Array(width * height * 4)
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data)
      engine.unBindFramebuffer(target)
      engine.restoreDefaultFramebuffer()
      return { data, width, height }
    } finally {
      target.dispose()
    }
  }

  dispose(camera: Camera): void {
    this.passes.forEach(pass => pass.dispose(camera))
    this.scene.disableDepthRenderer(camera)
    this.scopeTarget?.dispose()
    this.scopeWrapper?.dispose()
    this.scopeRenderer?.dispose()
    if (this.scopeBuffer) (this.scene.getEngine() as unknown as { _gl: WebGL2RenderingContext })._gl.deleteBuffer(this.scopeBuffer)
  }
}

// The orbit camera only gets the display transform (HDR input so bright sources clip naturally).
export function attachDisplay(scene: Scene, camera: Camera, display: DisplaySettings): PostProcess {
  return createDisplay(camera, scene.getEngine(), display)
}
