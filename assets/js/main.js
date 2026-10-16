// Korvex — comportamento da página.
// Contato: troque aqui. Preencha WHATSAPP (55 + DDD + número) para o formulário abrir o WhatsApp
// em vez do e-mail.
const CONFIG = {
  EMAIL: 'cv.korvex@gmail.com',
  WHATSAPP: '',
}

const $ = (s, el = document) => el.querySelector(s)
const $$ = (s, el = document) => [...el.querySelectorAll(s)]
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)'
const EASE_IN_OUT = 'cubic-bezier(0.77, 0, 0.175, 1)'

/* ---------- cabeçalho ---------- */
function initHeader() {
  const header = $('[data-header]')
  const toggle = $('[data-menu-toggle]')
  const label = $('[data-menu-label]')
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8)
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })

  const setMenu = (open) => {
    header.classList.toggle('is-open', open)
    toggle.setAttribute('aria-expanded', String(open))
    label.textContent = open ? 'Fechar menu' : 'Abrir menu'
  }
  toggle.addEventListener('click', () => setMenu(!header.classList.contains('is-open')))
  $$('.nav a').forEach((a) => a.addEventListener('click', () => setMenu(false)))
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false) })

  // marca no menu a seção que está na tela
  const links = new Map($$('.nav a[href^="#"]:not(.nav__cta)').map((a) => [a.getAttribute('href').slice(1), a]))
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const a = links.get(e.target.id)
      if (a) a.setAttribute('aria-current', e.isIntersecting ? 'true' : 'false')
    }
  }, { rootMargin: '-45% 0px -50% 0px' })
  links.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s) })
}

/* ---------- entrada das seções ---------- */
function initReveal() {
  const els = $$('[data-reveal]')
  // escalonamento curto entre irmãos que entram juntos
  const groups = new Map()
  for (const el of els) {
    const list = groups.get(el.parentElement) || []
    list.push(el)
    groups.set(el.parentElement, list)
  }
  groups.forEach((list) => list.forEach((el, i) => el.style.setProperty('--d', `${Math.min(i, 4) * 80}ms`)))
  if (reduced || !('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('is-in')); return }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target) }
    }
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 })
  els.forEach((el) => io.observe(el))
  window.addEventListener('beforeprint', () => els.forEach((el) => el.classList.add('is-in')))
}

/* ---------- topo: o K em 3D ---------- */
async function initHero() {
  const stage = $('[data-k-stage]')
  const canvas = $('[data-k-canvas]')
  const html = document.documentElement
  if (!stage || !canvas || !window.__webgl) return
  // se a imagem já apareceu (rede lenta), o 3D entra direto, sem a animação de acender
  const posterShown = !html.classList.contains('webgl')
  try {
    const { mountK } = await import('./k3d.js')
    const k = mountK(canvas, {
      host: stage,
      still: reduced,
      skipIntro: posterShown,
      onFirstFrame() {
        window.__kReady = true
        html.classList.add('webgl')
        canvas.classList.add('is-on')
      },
    })

    if (!reduced && finePointer) {
      let raf = 0, ex = 0, ey = 0
      window.addEventListener('pointermove', (e) => {
        ex = e.clientX; ey = e.clientY
        if (raf) return
        raf = requestAnimationFrame(() => {
          raf = 0
          const r = stage.getBoundingClientRect()
          const nx = (ex - (r.left + r.width / 2)) / (window.innerWidth / 2)
          const ny = (ey - (r.top + r.height / 2)) / (window.innerHeight / 2)
          k.setPointer(clamp(nx, -1, 1), clamp(ny, -1, 1))
        })
      }, { passive: true })
      document.documentElement.addEventListener('pointerleave', () => k.setPointer(0, 0))
    }

    // ao rolar, o K inclina e sobe um pouco enquanto sai de cena
    if (!reduced) {
      let sraf = 0
      const onScroll = () => {
        if (sraf) return
        sraf = requestAnimationFrame(() => {
          sraf = 0
          const r = stage.getBoundingClientRect()
          k.setScroll(clamp(-r.top / Math.max(1, r.height), 0, 1))
        })
      }
      window.addEventListener('scroll', onScroll, { passive: true })
    }

    // só desenha quando está na tela
    let visible = true
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting
      if (visible && !document.hidden) k.play(); else k.pause()
    }).observe(stage)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) k.pause(); else if (visible) k.play()
    })
  } catch (err) {
    console.warn('3D indisponível, usando a imagem.', err)
    html.classList.remove('webgl')
  }
}

/* ---------- borda que acende perto do ponteiro (Glowing Effect, 21st.dev) ---------- */
function initGlow() {
  if (!finePointer || reduced) return
  const items = $$('[data-glow]').map((el) => ({ el, glow: $('.tile__glow', el), angle: 0, active: false }))
  if (!items.length) return
  const PROXIMITY = 72
  let px = -1e5, py = -1e5, raf = 0, last = 0

  function tick(now) {
    raf = 0
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016
    last = now
    let moving = false
    for (const it of items) {
      const r = it.el.getBoundingClientRect()
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2
      const near = px > r.left - PROXIMITY && px < r.right + PROXIMITY && py > r.top - PROXIMITY && py < r.bottom + PROXIMITY
      if (near !== it.active) {
        it.active = near
        it.glow.style.setProperty('--active', near ? '1' : '0')
        if (near) {
          // a primeira vez que acende já nasce apontando para o ponteiro
          const a = Math.atan2(py - cy, px - cx) * 180 / Math.PI + 90
          if (!it.seen) { it.angle = a; it.seen = true }
        }
      }
      if (!near) continue
      const target = Math.atan2(py - cy, px - cx) * 180 / Math.PI + 90
      const diff = ((((target - it.angle + 180) % 360) + 360) % 360) - 180
      if (Math.abs(diff) > 0.15) {
        it.angle += diff * (1 - Math.exp(-dt * 7))
        moving = true
      }
      it.glow.style.setProperty('--start', it.angle.toFixed(2))
    }
    if (moving) raf = requestAnimationFrame(tick)
    else last = 0
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(tick) }
  document.addEventListener('pointermove', (e) => { px = e.clientX; py = e.clientY; kick() }, { passive: true })
  window.addEventListener('scroll', kick, { passive: true })
  document.documentElement.addEventListener('pointerleave', () => { px = py = -1e5; kick() })
}

/* ---------- demonstrações dos serviços ---------- */
// Cada demonstração roda em ciclos só enquanto está visível; com "reduzir movimento",
// mostra o estado final parado.
function runWhenVisible(el, cycle) {
  let gen = 0, alive = false
  const io = new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !alive) {
      alive = true
      const g = ++gen
      const ok = () => alive && g === gen
      ;(async () => {
        while (ok()) {
          if (document.hidden) { await sleep(400); continue }
          try { await cycle(ok) } catch (err) { console.warn(err); return }
        }
      })()
    } else if (!e.isIntersecting && alive) {
      alive = false
      gen++
    }
  }, { threshold: 0.3 })
  io.observe(el)
}

function moveTo(el, x, y, dur) {
  const from = getComputedStyle(el).transform
  el.getAnimations().forEach((a) => a.cancel())
  const anim = el.animate(
    [{ transform: from === 'none' ? `translate(${x}px, ${y}px)` : from }, { transform: `translate(${x}px, ${y}px)` }],
    { duration: dur, easing: EASE_IN_OUT, fill: 'forwards' },
  )
  return anim.finished.catch(() => {})
}

function initLandingDemo() {
  const demo = $('[data-demo="lp"]')
  if (!demo) return
  const box = $('.mb', demo)
  const cta = $('[data-cta]', demo)
  const cursor = $('[data-cursor]', demo)
  const list = $('[data-toasts]', demo)
  const LEADS = [
    ['Novo pedido de orçamento', 'Bolo de 2 kg para sábado'],
    ['Mensagem no WhatsApp', 'Vocês entregam no centro?'],
    ['Novo pedido de orçamento', 'Kit festa com 40 docinhos'],
    ['Mensagem no WhatsApp', 'Tem bolo de pote hoje?'],
  ]
  let n = 0

  function layoutToasts() {
    const items = [...list.children].filter((t) => !t.classList.contains('is-leaving'))
    items.forEach((t, i) => t.style.setProperty('--i', String(i)))
    items.slice(3).forEach((t) => {
      t.classList.add('is-leaving')
      setTimeout(() => t.remove(), 420)
    })
  }
  function pushToast([title, sub]) {
    const li = document.createElement('li')
    li.className = 'toast is-entering'
    li.innerHTML = `<i></i><b></b><span></span>`
    li.querySelector('b').textContent = title
    li.querySelector('span').textContent = sub
    list.prepend(li)
    layoutToasts()
    li.getBoundingClientRect() // aplica o estado de entrada antes da transição
    requestAnimationFrame(() => li.classList.remove('is-entering'))
  }

  if (reduced) { pushToast(LEADS[1]); pushToast(LEADS[0]); return }

  runWhenVisible(demo, async (ok) => {
    const b = box.getBoundingClientRect()
    const c = cta.getBoundingClientRect()
    const tx = c.left - b.left + c.width * 0.62
    const ty = c.top - b.top + c.height * 0.5
    const sx = b.width * 0.9, sy = b.height * 0.92
    cursor.style.opacity = '1'
    cursor.getAnimations().forEach((a) => a.cancel())
    cursor.style.transform = `translate(${sx}px, ${sy}px)`
    await sleep(500)
    if (!ok()) return
    await moveTo(cursor, tx, ty, 950)
    if (!ok()) return
    cta.classList.add('is-pressed')
    await sleep(150)
    cta.classList.remove('is-pressed')
    pushToast(LEADS[n++ % LEADS.length])
    await sleep(700)
    if (!ok()) return
    await moveTo(cursor, b.width * 0.78, b.height * 0.8, 800)
    await sleep(1500)
  })
}

function initSearchDemo() {
  const demo = $('[data-demo="serp"]')
  if (!demo) return
  const q = $('[data-query]', demo)
  const result = $('[data-result]', demo)
  const QUERIES = ['doceria perto de mim', 'bolo de aniversário sob encomenda', 'doces para festa no bairro']
  let n = 0
  if (reduced) { result.classList.add('is-lit'); return }
  runWhenVisible(demo, async (ok) => {
    const text = QUERIES[n++ % QUERIES.length]
    demo.classList.add('is-typing')
    result.classList.remove('is-lit')
    q.textContent = ''
    await sleep(500)
    for (const ch of text) {
      if (!ok()) return
      q.textContent += ch
      await sleep(45 + Math.random() * 55)
    }
    await sleep(380)
    demo.classList.remove('is-typing')
    await sleep(520)
    result.classList.add('is-lit')
    await sleep(2800)
  })
}

function initAppDemo() {
  const demo = $('[data-demo="app"]')
  if (!demo) return
  const phone = $('.phone', demo)
  const slot = $('[data-slot]', demo)
  const confirm = $('[data-confirm]', demo)
  const tap = $('[data-tap]', demo)
  if (reduced) { slot.classList.add('is-picked'); return }

  async function tapOn(target) {
    const p = phone.getBoundingClientRect()
    const r = target.getBoundingClientRect()
    const x = r.left - p.left + r.width / 2
    const y = r.top - p.top + r.height / 2
    tap.getAnimations().forEach((a) => a.cancel())
    await tap.animate(
      [
        { transform: `translate(${x}px, ${y}px) scale(0.6)`, opacity: 0 },
        { transform: `translate(${x}px, ${y}px) scale(1)`, opacity: 1, offset: 0.35 },
        { transform: `translate(${x}px, ${y}px) scale(1.25)`, opacity: 0 },
      ],
      { duration: 520, easing: EASE_OUT },
    ).finished.catch(() => {})
  }

  runWhenVisible(demo, async (ok) => {
    demo.classList.remove('is-done')
    slot.classList.remove('is-picked')
    await sleep(900)
    if (!ok()) return
    tapOn(slot)
    await sleep(160)
    slot.classList.add('is-picked')
    await sleep(800)
    if (!ok()) return
    tapOn(confirm)
    confirm.classList.add('is-pressed')
    await sleep(150)
    confirm.classList.remove('is-pressed')
    await sleep(120)
    demo.classList.add('is-done')
    await sleep(2600)
  })
}

function initInstagramDemo() {
  const demo = $('[data-demo="ig"]')
  const seg = $('[data-seg]')
  if (!demo || !seg) return
  const buttons = $$('[data-ig]', seg)
  let manual = false
  const set = (after) => {
    demo.classList.toggle('is-after', after)
    seg.classList.toggle('is-before', !after)
    buttons.forEach((b) => b.setAttribute('aria-checked', String((b.dataset.ig === 'depois') === after)))
  }
  buttons.forEach((b) => b.addEventListener('click', () => { manual = true; set(b.dataset.ig === 'depois') }))
  seg.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return
    e.preventDefault()
    manual = true
    const after = e.key === 'ArrowRight' || e.key === 'ArrowDown'
    set(after)
    buttons[after ? 1 : 0].focus()
  })
  set(true)
  if (reduced) return
  // alterna sozinho até a pessoa tocar no controle
  runWhenVisible(demo, async (ok) => {
    await sleep(1600)
    if (!ok() || manual) { await sleep(1000); return }
    set(false)
    await sleep(2200)
    if (!ok() || manual) return
    set(true)
    await sleep(2600)
  })
}

/* ---------- projetos: índice com prévia ---------- */
function initWork() {
  const rows = $$('[data-view]')
  const panels = $$('[data-panel]')
  const phone = $('[data-phone]')
  if (!rows.length) return
  const show = (name) => {
    rows.forEach((r) => {
      const on = r.dataset.view === name
      r.classList.toggle('is-active', on)
      r.setAttribute('aria-pressed', String(on))
    })
    panels.forEach((p) => p.classList.toggle('is-on', p.dataset.panel === name))
    phone && phone.classList.toggle('is-away', name !== 'full')
  }
  rows.forEach((r) => {
    r.addEventListener('click', () => show(r.dataset.view))
    if (finePointer) r.addEventListener('pointerenter', () => show(r.dataset.view))
  })

  // a página inteira rola sozinha, devagar, enquanto está na tela
  const scrollers = $$('.scroller')
  const measure = (img) => {
    const frame = img.parentElement
    const travel = Math.max(0, img.offsetHeight - frame.offsetHeight)
    img.style.setProperty('--travel', `${travel}px`)
    img.style.setProperty('--dur', `${Math.max(16, travel / 85).toFixed(1)}s`)
  }
  scrollers.forEach((img) => {
    if (img.complete) measure(img)
    else img.addEventListener('load', () => measure(img), { once: true })
  })
  new ResizeObserver(() => scrollers.forEach(measure)).observe(document.body)
  if (reduced) return
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) e.target.classList.toggle('is-running', e.isIntersecting)
  }, { threshold: 0.15 })
  scrollers.forEach((img) => io.observe(img))
}

/* ---------- processo: arrastar pelas etapas ---------- */
function initProcess() {
  const root = $('[data-process]')
  if (!root) return
  const range = $('[data-range]', root)
  const clause = $('[data-clause]', root)
  const text = $('[data-text]', root)
  const out = $('[data-out]', root)
  const url = $('[data-url]', root)
  const goes = $$('[data-go]', root)
  const STAGES = [
    {
      name: 'Conversa', url: 'Briefing',
      clause: 'Primeiro, a conversa',
      text: 'Entendemos o seu negócio, quem compra de você e o que precisa acontecer quando alguém abre o site.',
      out: 'Você recebe: proposta com escopo, prazo e valor.',
    },
    {
      name: 'Estratégia', url: 'Rascunho · estrutura e textos',
      clause: 'Depois, a estratégia',
      text: 'Definimos a ordem das seções e escrevemos o texto. É aqui que a página aprende a vender.',
      out: 'Você recebe: estrutura e textos para aprovar.',
    },
    {
      name: 'Tecnologia', url: 'Prévia · em construção',
      clause: 'Então, a tecnologia',
      text: 'Criamos o visual com a cara da sua marca e programamos do zero, leve e rápido no celular.',
      out: 'Você recebe: um link de prévia para comentar.',
    },
    {
      name: 'Resultados', url: 'abtransportes · no ar',
      clause: 'Por fim, os resultados',
      text: 'Publicamos, ligamos o domínio e acompanhamos os primeiros contatos para ajustar o que for preciso.',
      out: 'Você recebe: o site no ar e no seu nome.',
    },
  ]
  let current = 0
  let touched = false

  const setFill = (v) => range.style.setProperty('--fill', `calc(16px + (100% - 32px) * ${v / 3})`)

  function swap(el, value) {
    if (el.textContent === value) return
    el.getAnimations().forEach((a) => a.cancel())
    if (reduced) { el.textContent = value; return }
    const outAnim = el.animate(
      [{ opacity: 1, filter: 'blur(0px)' }, { opacity: 0, filter: 'blur(3px)' }],
      { duration: 110, easing: 'ease-out', fill: 'forwards' },
    )
    outAnim.finished.then(() => {
      el.textContent = value
      el.animate(
        [{ opacity: 0, filter: 'blur(3px)', transform: 'translateY(6px)' }, { opacity: 1, filter: 'blur(0px)', transform: 'none' }],
        { duration: 240, easing: EASE_OUT, fill: 'forwards' },
      )
    }).catch(() => { el.textContent = value })
  }

  function setStage(i) {
    i = clamp(Math.round(i), 0, 3)
    if (i === current) return
    current = i
    const s = STAGES[i]
    root.dataset.stage = String(i)
    range.setAttribute('aria-valuetext', s.name)
    goes.forEach((b) => (Number(b.dataset.go) === i ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current')))
    swap(clause, s.clause)
    swap(text, s.text)
    swap(out, s.out)
    url.textContent = s.url
  }

  function markTouched() { touched = true }

  // arrastar é contínuo; ao soltar, o controle encaixa na etapa mais próxima
  let snapRaf = 0
  function snapTo(target) {
    cancelAnimationFrame(snapRaf)
    const from = Number(range.value)
    if (reduced || Math.abs(from - target) < 0.001) { range.value = String(target); setFill(target); setStage(target); return }
    const t0 = performance.now(), dur = 220
    const step = (now) => {
      const t = Math.min(1, (now - t0) / dur)
      const e = 1 - Math.pow(1 - t, 3)
      const v = from + (target - from) * e
      range.value = String(v)
      setFill(v)
      if (t < 1) snapRaf = requestAnimationFrame(step)
    }
    snapRaf = requestAnimationFrame(step)
    setStage(target)
  }

  range.addEventListener('input', () => {
    markTouched()
    cancelAnimationFrame(snapRaf)
    const v = Number(range.value)
    setFill(v)
    setStage(Math.round(v))
  })
  range.addEventListener('change', () => snapTo(Math.round(Number(range.value))))
  range.addEventListener('pointerup', () => snapTo(Math.round(Number(range.value))))
  range.addEventListener('keydown', (e) => {
    const map = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }
    if (e.key in map) { e.preventDefault(); markTouched(); snapTo(clamp(current + map[e.key], 0, 3)) }
    else if (e.key === 'Home') { e.preventDefault(); markTouched(); snapTo(0) }
    else if (e.key === 'End') { e.preventDefault(); markTouched(); snapTo(3) }
  })
  goes.forEach((b) => b.addEventListener('click', () => { markTouched(); snapTo(Number(b.dataset.go)) }))
  range.step = 'any'
  setFill(0)
}

/* ---------- contato ---------- */
function initContact() {
  const form = $('[data-contact]')
  if (!form) return
  const input = $('#msg')
  const err = $('[data-error]')
  const note = $('[data-note]')
  const copyBtn = $('[data-copy]')

  $$('[data-chip]').forEach((chip) => chip.addEventListener('click', () => {
    const start = chip.dataset.chip
    const current = input.value.trim()
    if (!current || /^Quero /.test(current)) input.value = start
    else input.value = `${current} ${start.toLowerCase()}`
    input.focus()
    const end = input.value.length
    input.setSelectionRange(end, end)
    err.hidden = true
    input.removeAttribute('aria-invalid')
  }))

  input.addEventListener('input', () => {
    if (input.value.trim()) { err.hidden = true; input.removeAttribute('aria-invalid') }
  })

  form.addEventListener('submit', (e) => {
    e.preventDefault()
    const msg = input.value.trim()
    if (!msg) {
      err.hidden = false
      input.setAttribute('aria-invalid', 'true')
      input.focus()
      return
    }
    const body = `${msg}\n\n(Mensagem enviada pelo site da Korvex)`
    let href
    if (CONFIG.WHATSAPP) {
      href = `https://wa.me/${CONFIG.WHATSAPP}?text=${encodeURIComponent(`Olá, Korvex! ${msg}`)}`
    } else {
      href = `mailto:${CONFIG.EMAIL}?subject=${encodeURIComponent('Orçamento pelo site')}&body=${encodeURIComponent(body)}`
    }
    const a = document.createElement('a')
    a.href = href
    if (href.startsWith('https:')) { a.target = '_blank'; a.rel = 'noopener' }
    document.body.appendChild(a)
    a.click()
    a.remove()
    note.textContent = CONFIG.WHATSAPP
      ? 'Abrimos o WhatsApp com a sua mensagem pronta. É só tocar em enviar.'
      : `Abrimos o seu e-mail com a mensagem pronta. Se nada abriu, escreva para ${CONFIG.EMAIL}.`
  })

  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(CONFIG.EMAIL)
      copyBtn.textContent = 'Copiado'
    } catch {
      const range = document.createRange()
      range.selectNodeContents($('#mail'))
      const sel = window.getSelection()
      sel.removeAllRanges()
      sel.addRange(range)
      copyBtn.textContent = 'Selecionado'
    }
    setTimeout(() => { copyBtn.textContent = 'Copiar' }, 2200)
  })

  // borda neon do campo: só carrega quando o contato chega perto da tela
  const canvas = $('[data-pulse]')
  const field = $('[data-field]')
  if (!canvas || !field) return
  const io = new IntersectionObserver(async ([e]) => {
    if (!e.isIntersecting) return
    io.disconnect()
    try {
      const { mountPulseBorder } = await import('./pulse-border.js')
      const pulse = mountPulseBorder(canvas, field, { still: reduced, cut: 14, glow: 0.7 })
      if (!pulse) return
      input.addEventListener('focus', () => pulse.setIntensity(1.15))
      input.addEventListener('blur', () => pulse.setIntensity(0.7))
    } catch (err) { console.warn(err) }
  }, { rootMargin: '200px 0px' })
  io.observe(canvas)
}

/* ---------- início ---------- */
window.__mainReady = true
const year = $('[data-year]')
if (year) year.textContent = String(new Date().getFullYear())

initHeader()
initReveal()
initGlow()
initLandingDemo()
initSearchDemo()
initAppDemo()
initInstagramDemo()
initWork()
initProcess()
initContact()
initHero()
