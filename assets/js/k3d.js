// Korvex — o K cromado em 3D, renderizado ao vivo no navegador (Three.js r169).
// A geometria foi traçada da logo original (pixels da arte 1080×1080, eixo y para baixo).
// Cada lâmina vira uma placa de metal escovado com chanfro; as linhas neon percorrem as
// bordas internas como na arte, e o bloom dá o brilho.

import * as THREE from '../vendor/three/three.module.min.js'
import { EffectComposer } from '../vendor/three/postprocessing/EffectComposer.js'
import { RenderPass } from '../vendor/three/postprocessing/RenderPass.js'
import { UnrealBloomPass } from '../vendor/three/postprocessing/UnrealBloomPass.js'
import { OutputPass } from '../vendor/three/postprocessing/OutputPass.js'

// ---------- geometria da marca ----------
const CENTER = [537.5, 527.5]
const SCALE = 6 / 610 // o K inteiro fica com 6 unidades de largura

const BLADES = [
  // haste: a lâmina alta da esquerda
  { pts: [[285, 421], [477.5, 311], [377.5, 529], [232.5, 744]], depth: 0.17, z: 0, brush: 68.6 },
  // espinha: a lâmina fina entre a haste e os braços
  { pts: [[232.5, 744], [377.5, 529], [402.5, 521], [430, 545], [402.5, 552], [290, 685]], depth: 0.1, z: -0.06, brush: 52.7 },
  // braço de cima
  { pts: [[402.5, 521], [677.5, 334], [812.5, 320], [572.5, 482.5]], depth: 0.17, z: 0.02, brush: 26.1 },
  // perna de baixo
  { pts: [[430, 545], [557.5, 516], [842.5, 725], [655, 694]], depth: 0.17, z: 0, brush: -23.6 },
]

// linhas neon (mesmas posições da arte)
const NEON = [
  { // vermelho: da ponta de baixo até o encontro com a perna
    pts: [[232.5, 744], [290, 685], [402.5, 552], [430, 545], [557.5, 516]],
    stops: [[0, '#ff2d4f', 5.2], [0.55, '#ff2d4f', 3.6], [1, '#ff3d6e', 2.6]],
  },
  { // violeta → magenta → violeta: espinha e base do braço de cima
    pts: [[246, 726], [381, 531], [402.5, 526], [572.5, 487], [812.5, 322]],
    stops: [[0, '#8f4dff', 2.6], [0.38, '#c03cff', 3.4], [0.55, '#ff3cc8', 4.6], [0.72, '#c43cff', 3.2], [1, '#9b4dff', 3.6]],
  },
]

// pontos de brilho (lens flare) nas pontas, como na arte
const FLARES = [
  { at: [232.5, 744], color: '#ff2d4f', size: 0.62, power: 2.6 },
  { at: [572.5, 484], color: '#ff2d6a', size: 0.5, power: 2.2 },
  { at: [812.5, 321], color: '#ff2d4f', size: 0.5, power: 2.2, streak: true },
  { at: [677.5, 334], color: '#ff3355', size: 0.3, power: 1.2 },
]

const toV2 = ([x, y]) => new THREE.Vector2((x - CENTER[0]) * SCALE, -(y - CENTER[1]) * SCALE)

// ---------- texturas geradas ----------
function brushedTexture() {
  const c = document.createElement('canvas')
  c.width = 512; c.height = 512
  const g = c.getContext('2d')
  g.fillStyle = 'rgb(120,120,120)'
  g.fillRect(0, 0, 512, 512)
  // riscos finos e longos, como aço escovado
  for (let i = 0; i < 2600; i++) {
    const y = Math.random() * 512
    const x = Math.random() * 512
    const len = 60 + Math.random() * 420
    const v = 90 + Math.random() * 90
    g.strokeStyle = `rgba(${v},${v},${v},${0.18 + Math.random() * 0.35})`
    g.lineWidth = 0.6 + Math.random() * 1.4
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + len, y + (Math.random() - 0.5) * 1.2); g.stroke()
    if (x + len > 512) { g.beginPath(); g.moveTo(x - 512, y); g.lineTo(x + len - 512, y); g.stroke() }
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.NoColorSpace
  return t
}

function glowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  r.addColorStop(0, 'rgba(255,255,255,1)')
  r.addColorStop(0.18, 'rgba(255,255,255,0.55)')
  r.addColorStop(0.45, 'rgba(255,255,255,0.12)')
  r.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = r
  g.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// ---------- ambiente (estúdio de luz) ----------
// O cromo só fica bonito refletindo alguma coisa: um estúdio escuro com faixas de luz
// brancas e as cores da marca, gerado na hora (sem baixar HDRI).
function studioEnvironment(renderer) {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x000000)
  const plane = new THREE.PlaneGeometry(1, 1)
  const panel = (hex, intensity, pos, size, look = [0, 0, 0], map = null) => {
    const color = new THREE.Color(hex).multiplyScalar(intensity)
    const m = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ color, map, side: THREE.DoubleSide }))
    m.position.set(...pos)
    m.scale.set(size[0], size[1], 1)
    m.lookAt(...look)
    scene.add(m)
  }
  // fundo atrás da câmera: faixas suaves que viram o brilho escovado das faces
  const bands = document.createElement('canvas')
  bands.width = 8; bands.height = 256
  const bg = bands.getContext('2d')
  const grad = bg.createLinearGradient(0, 0, 0, 256)
  grad.addColorStop(0, '#08080c'); grad.addColorStop(0.3, '#22222b'); grad.addColorStop(0.42, '#f2f3f7')
  grad.addColorStop(0.5, '#3c3d46'); grad.addColorStop(0.64, '#121218'); grad.addColorStop(0.78, '#a9abb5')
  grad.addColorStop(0.86, '#24242c'); grad.addColorStop(1, '#09090d')
  bg.fillStyle = grad; bg.fillRect(0, 0, 8, 256)
  const bandTex = new THREE.CanvasTexture(bands)
  bandTex.colorSpace = THREE.SRGBColorSpace
  panel('#ffffff', 1.6, [0, 0, 10], [24, 14], [0, 0, 0], bandTex)
  panel('#ffffff', 1.1, [0, 4.6, 7], [12, 2])          // softbox alto, à frente
  panel('#ffffff', 3.8, [-5.4, 0.4, 3.6], [0.34, 8])   // filete vertical à esquerda
  panel('#ffffff', 3.2, [0, 5.4, 1.5], [12, 0.4])      // filete no teto
  panel('#ffffff', 3.0, [-3.6, 4.4, 4.2], [7, 0.34])    // filete alto à esquerda (borda de cima da haste)
  panel('#ff2d4f', 5.5, [-1.5, -4.6, 3.6], [9, 0.4])   // filete vermelho no chão
  panel('#9b4dff', 4.2, [5.6, -0.6, 3.2], [0.32, 7])   // filete violeta à direita
  panel('#e23ccb', 1.6, [4.5, 3.2, 3], [3.5, 0.28])    // toque magenta no alto à direita
  panel('#24123a', 0.5, [0, 0, -7], [16, 9])           // brilho fraco atrás do objeto
  const pmrem = new THREE.PMREMGenerator(renderer)
  const rt = pmrem.fromScene(scene, 0.035)
  pmrem.dispose()
  plane.dispose()
  return rt.texture
}

// ---------- montagem ----------
function buildK(renderer) {
  const group = new THREE.Group()
  const brush = brushedTexture()
  brush.anisotropy = renderer.capabilities.getMaxAnisotropy()

  const edgeMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 1, roughness: 0.12, envMapIntensity: 1.8,
  })

  for (const b of BLADES) {
    const shape = new THREE.Shape(b.pts.map(toV2))
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: b.depth, curveSegments: 1, steps: 1,
      bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.038, bevelSegments: 5,
    })
    geo.translate(0, 0, -b.depth / 2 + b.z)
    const tex = brush.clone()
    tex.needsUpdate = true
    tex.repeat.set(0.34, 0.34)
    tex.center.set(0.5, 0.5)
    tex.rotation = THREE.MathUtils.degToRad(b.brush)
    const faceMat = new THREE.MeshPhysicalMaterial({
      color: 0x9fa4af, metalness: 1, roughness: 0.4, roughnessMap: tex,
      anisotropy: 0.75, anisotropyRotation: THREE.MathUtils.degToRad(b.brush),
      clearcoat: 0.35, clearcoatRoughness: 0.18, envMapIntensity: 1.3,
    })
    const mesh = new THREE.Mesh(geo, [faceMat, edgeMat])
    group.add(mesh)
  }

  // neon
  const front = 0.17 / 2 + 0.05 + 0.012
  const tubes = []
  for (const n of NEON) {
    const pts = n.pts.map((p) => { const v = toV2(p); return new THREE.Vector3(v.x, v.y, front) })
    const path = new THREE.CurvePath()
    for (let i = 0; i < pts.length - 1; i++) path.add(new THREE.LineCurve3(pts[i], pts[i + 1]))
    const SEG = 260, RAD = 8
    const geo = new THREE.TubeGeometry(path, SEG, 0.0115, RAD, false)
    const colors = new Float32Array(geo.attributes.position.count * 3)
    const stops = n.stops.map(([t, hex, k]) => [t, new THREE.Color(hex).multiplyScalar(k)])
    const tmp = new THREE.Color()
    for (let v = 0; v < geo.attributes.position.count; v++) {
      const t = Math.floor(v / (RAD + 1)) / SEG
      let i = 0
      while (i < stops.length - 2 && t > stops[i + 1][0]) i++
      const [t0, c0] = stops[i], [t1, c1] = stops[i + 1]
      tmp.copy(c0).lerp(c1, THREE.MathUtils.clamp((t - t0) / (t1 - t0), 0, 1))
      colors[v * 3] = tmp.r; colors[v * 3 + 1] = tmp.g; colors[v * 3 + 2] = tmp.b
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.userData.count = geo.index.count
    geo.setDrawRange(0, 0)
    group.add(mesh)
    tubes.push(mesh)
  }

  // brilhos nas pontas
  const glow = glowTexture()
  const flares = []
  for (const f of FLARES) {
    const v = toV2(f.at)
    const mat = new THREE.SpriteMaterial({
      map: glow, color: new THREE.Color(f.color).multiplyScalar(f.power),
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, toneMapped: false, transparent: true,
    })
    const s = new THREE.Sprite(mat)
    s.position.set(v.x, v.y, front + 0.02)
    s.userData = { size: f.size, base: f.power, color: new THREE.Color(f.color) }
    s.scale.setScalar(0.0001)
    group.add(s)
    flares.push(s)
    if (f.streak) {
      const m2 = mat.clone()
      m2.color = new THREE.Color(f.color).multiplyScalar(f.power * 0.7)
      const st = new THREE.Sprite(m2)
      st.position.copy(s.position)
      st.userData = { size: f.size, streak: true, base: f.power * 0.7, color: new THREE.Color(f.color) }
      st.scale.setScalar(0.0001)
      group.add(st)
      flares.push(st)
    }
  }
  return { group, tubes, flares }
}

const easeOut = (t) => 1 - Math.pow(1 - t, 3)
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const clamp01 = (t) => Math.min(1, Math.max(0, t))

/**
 * Monta o K num <canvas>.
 * opts.still: renderiza o estado final e para (movimento reduzido / pôster).
 * opts.onFirstFrame: chamado quando o primeiro quadro foi desenhado.
 */
export function mountK(canvas, opts = {}) {
  const still = !!opts.still
  const host = opts.host || canvas.parentElement
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.preserve })
  renderer.setClearColor(0x000000, 1)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = still ? 1.12 : 0
  renderer.outputColorSpace = THREE.SRGBColorSpace

  const scene = new THREE.Scene()
  scene.environment = studioEnvironment(renderer)
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100)

  const { group, tubes, flares } = buildK(renderer)
  const pivot = new THREE.Group()
  pivot.add(group)
  scene.add(pivot)
  const BASE = { x: 0.07, y: -0.2 }

  const target = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: 4 })
  const composer = new EffectComposer(renderer, target)
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(new THREE.Vector2(2, 2), 0.7, 0.5, 0.86)
  composer.addPass(bloom)
  composer.addPass(new OutputPass())

  let w = 0, h = 0
  const maxDpr = opts.maxDpr || (matchMedia('(max-width: 720px)').matches ? 1.5 : 1.75)
  function resize() {
    const r = host.getBoundingClientRect()
    const nw = Math.max(2, Math.round(r.width)), nh = Math.max(2, Math.round(r.height))
    if (nw === w && nh === h) return false
    w = nw; h = nh
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr)
    renderer.setPixelRatio(dpr)
    renderer.setSize(w, h, false)
    composer.setPixelRatio(dpr)
    composer.setSize(w, h)
    camera.aspect = w / h
    // enquadra o K inteiro com folga para a inclinação e o brilho
    const objW = 6 * 1.34, objH = 4.3 * 1.5
    const fov = THREE.MathUtils.degToRad(camera.fov)
    const needH = Math.max(objH, objW / camera.aspect)
    camera.position.set(0, 0, needH / (2 * Math.tan(fov / 2)))
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
    return true
  }

  // estado do ponteiro (mola criticamente amortecida: segue a mão com inércia, sem quicar)
  const spring = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 }
  function setPointer(nx, ny) { spring.tx = nx; spring.ty = ny }
  let scrollP = 0
  function setScroll(p) { scrollP = Math.min(1, Math.max(0, p)) }

  function applyState(intro, time) {
    // intro: 0 → 1 (acender as luzes, desenhar o neon, o K gira até o lugar)
    const lights = easeOut(clamp01((intro - 0.04) / 0.5))
    const draw = easeInOut(clamp01((intro - 0.22) / 0.55))
    const pop = easeOut(clamp01((intro - 0.68) / 0.3))
    const settle = easeOut(clamp01(intro / 0.85))

    renderer.toneMappingExposure = 1.12 * lights
    for (const t of tubes) t.geometry.setDrawRange(0, Math.floor(t.userData.count * draw / 3) * 3)
    for (const f of flares) {
      const breathe = 1 + Math.sin(time * 1.3 + f.position.x * 2) * 0.06
      const k = Math.max(0.0001, pop)
      if (f.userData.streak) f.scale.set(f.userData.size * 3.4 * k, f.userData.size * 0.11 * k, 1)
      else f.scale.setScalar(f.userData.size * k * breathe)
    }
    const float = Math.sin(time * 0.7) * 0.035
    pivot.position.y = float + scrollP * 0.7
    pivot.rotation.x = BASE.x + spring.y * 0.22 + scrollP * 0.55
    pivot.rotation.y = BASE.y - (1 - settle) * 0.55 + spring.x * 0.34
    pivot.rotation.z = Math.sin(time * 0.4) * 0.012
    group.scale.setScalar((0.955 + 0.045 * settle) * (1 - scrollP * 0.08))
    scene.environmentRotation.y = Math.sin(time * 0.23) * 0.38
    scene.environmentRotation.x = Math.cos(time * 0.17) * 0.06
  }

  let raf = 0, running = false, start = 0, last = 0, firstFrame = false, disposed = false
  const INTRO_MS = opts.introMs || 2400

  function frame(now) {
    raf = 0
    if (disposed) return
    if (!start) start = now
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016)
    last = now
    // mola
    const k = 48, c = 13
    spring.vx += (k * (spring.tx - spring.x) - c * spring.vx) * dt
    spring.vy += (k * (spring.ty - spring.y) - c * spring.vy) * dt
    spring.x += spring.vx * dt
    spring.y += spring.vy * dt
    const intro = clamp01((now - start) / INTRO_MS)
    resize()
    applyState(intro, (now - start) / 1000)
    composer.render()
    if (!firstFrame) { firstFrame = true; opts.onFirstFrame && opts.onFirstFrame() }
    if (running) raf = requestAnimationFrame(frame)
  }

  function renderStill() {
    spring.x = spring.tx; spring.y = spring.ty
    resize()
    applyState(1, 0)
    composer.render()
    if (!firstFrame) { firstFrame = true; opts.onFirstFrame && opts.onFirstFrame() }
  }

  function play() {
    if (still || running || disposed) return
    running = true
    last = 0
    raf = requestAnimationFrame(frame)
  }
  if (opts.skipIntro) start = performance.now() - INTRO_MS
  function pause() {
    running = false
    if (raf) cancelAnimationFrame(raf)
    raf = 0
  }

  let ro = null
  if (still) {
    renderStill()
    ro = new ResizeObserver(() => { if (resize()) renderStill() })
    ro.observe(host)
  } else {
    resize()
    play()
  }

  return {
    setPointer,
    setScroll(p) { setScroll(p); if (still && !disposed) renderStill() },
    play,
    pause,
    renderStill,
    dispose() {
      disposed = true
      pause()
      ro && ro.disconnect()
      composer.dispose?.()
      target.dispose()
      renderer.dispose()
    },
  }
}
