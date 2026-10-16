// Borda neon pulsante em volta do campo de contato.
// Adaptado do componente "Pulsing Border" do 21st.dev (gerado pelo Shader Builder),
// que por sua vez adapta o Paper Shaders (https://shaders.paper.design/pulsing-border),
// licença Apache-2.0. Mudanças: cores da Korvex, caixa com cantos chanfrados que
// acompanha o tamanho real do campo, sem cursor, fundo preto para mesclar com "screen".

const VERT = `attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }`

const FRAG = `precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_box;     // meia largura/altura da caixa, em pixels
uniform float u_cut;    // tamanho do chanfro, em pixels
uniform float u_glow;   // 0..1 (intensidade geral)
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// distância até uma caixa com dois cantos chanfrados (superior esquerdo e inferior direito)
float sdChamferBox(vec2 p, vec2 b, float c) {
  vec2 d = abs(p) - b;
  float box = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
  if (p.x * p.y < 0.0) {
    float plane = (abs(p.x) + abs(p.y) - (b.x + b.y - c)) * 0.70710678;
    box = max(box, plane);
  }
  return box;
}

vec3 palette(float x) {
  x = clamp(x, 0.0, 1.0);
  vec3 col = mix(u_c1, u_c2, smoothstep(0.0, 0.55, x));
  return mix(col, u_c3, smoothstep(0.55, 1.0, x));
}

void main() {
  vec2 p = gl_FragCoord.xy - 0.5 * u_res;
  float d = sdChamferBox(p, u_box, u_cut);
  // posição ao longo do perímetro (0..1) para o pulso que corre em volta
  float perim = atan(p.y * u_box.x, p.x * u_box.y) / 6.2831853 + 0.5;
  float t = u_time;
  float pulse = 0.5 + 0.5 * sin(perim * 6.2831853 * 2.0 - t * 1.6);
  float pulse2 = 0.5 + 0.5 * sin(perim * 6.2831853 * 5.0 + t * 0.9);
  float trail = pow(pulse, 3.0) * 0.8 + pow(pulse2, 6.0) * 0.35;
  float line = 1.0 - smoothstep(0.6, 2.2, abs(d));          // a linha fina
  float halo = exp(-max(d, 0.0) / 9.0) * step(0.0, d);        // brilho para fora
  float inner = exp(-max(-d, 0.0) / 5.0) * step(d, 0.0) * 0.35;
  float a = (line * (0.55 + trail) + halo * (0.12 + trail * 0.55) + inner * trail) * u_glow;
  vec3 col = palette(trail) * a;
  col += (hash(gl_FragCoord.xy + t) - 0.5) * 0.012;           // grão leve
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}`

const hexToRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]
}

export function mountPulseBorder(canvas, target, opts = {}) {
  const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false })
  if (!gl) return null
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s }
  const prog = gl.createProgram()
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT))
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG))
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null
  gl.useProgram(prog)
  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const loc = gl.getAttribLocation(prog, 'a_position')
  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
  const u = (n) => gl.getUniformLocation(prog, n)
  const U = { res: u('u_res'), time: u('u_time'), box: u('u_box'), cut: u('u_cut'), glow: u('u_glow'), c1: u('u_c1'), c2: u('u_c2'), c3: u('u_c3') }
  gl.uniform3fv(U.c1, hexToRgb(opts.c1 || '#9b4dff'))
  gl.uniform3fv(U.c2, hexToRgb(opts.c2 || '#ff2d4f'))
  gl.uniform3fv(U.c3, hexToRgb(opts.c3 || '#ffd2e4'))

  let dpr = 1, glow = opts.glow ?? 0.85, glowTarget = glow
  const still = !!opts.still
  function resize() {
    const r = canvas.getBoundingClientRect()
    const t = target.getBoundingClientRect()
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.max(2, Math.round(r.width * dpr))
    canvas.height = Math.max(2, Math.round(r.height * dpr))
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.uniform2f(U.res, canvas.width, canvas.height)
    // a caixa é o próprio campo, centrado no canvas
    gl.uniform2f(U.box, (t.width / 2) * dpr, (t.height / 2) * dpr)
    gl.uniform1f(U.cut, (opts.cut || 12) * dpr)
  }

  let raf = 0, inView = false, start = performance.now()
  function draw(now) {
    raf = 0
    glow += (glowTarget - glow) * 0.08
    gl.uniform1f(U.glow, glow)
    gl.uniform1f(U.time, still ? 2.0 : (now - start) / 1000)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    const settling = Math.abs(glowTarget - glow) > 0.002
    if ((!still || settling) && inView && !document.hidden) raf = requestAnimationFrame(draw)
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(draw) }

  const ro = new ResizeObserver(() => { resize(); kick() })
  ro.observe(target)
  const io = new IntersectionObserver(([e]) => { inView = e.isIntersecting; if (inView) kick() })
  io.observe(canvas)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick() })
  resize()
  kick()

  return {
    // mais forte quando o campo está em foco
    setIntensity(v) { glowTarget = v; if (still) glow = v; kick() },
    dispose() { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect() },
  }
}
