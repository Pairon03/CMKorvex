// Korvex — comportamento da página.
// Dados de contato: troque aqui. Deixe WHATSAPP vazio ('') para esconder o botão de WhatsApp.
const CONFIG = {
  EMAIL: 'cv.korvex@gmail.com',
  WHATSAPP: '', // formato: 55 + DDD + número, ex.: '5519999999999'
}

const $ = (s, el = document) => el.querySelector(s)
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

// ano do rodapé
const year = $('#year')
if (year) year.textContent = new Date().getFullYear()

// ---------- cabeçalho: fundo ao rolar + menu no celular ----------
const header = $('.header')
const menuBtn = $('.menu-btn')
const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 10)
onScroll()
window.addEventListener('scroll', onScroll, { passive: true })

function setMenu(open) {
  header.classList.toggle('is-open', open)
  menuBtn.setAttribute('aria-expanded', String(open))
  menuBtn.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu')
}
menuBtn.addEventListener('click', () => setMenu(!header.classList.contains('is-open')))
document.querySelectorAll('.nav a').forEach((a) => a.addEventListener('click', () => setMenu(false)))
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false) })

// ---------- o K inclina levemente seguindo o mouse ----------
const emblem = $('#emblem')
if (emblem && !reduced && window.matchMedia('(hover: hover)').matches) {
  const hero = $('.hero')
  hero.addEventListener('pointermove', (e) => {
    const r = hero.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5
    const y = (e.clientY - r.top) / r.height - 0.5
    emblem.style.setProperty('--ry', `${(x * 14).toFixed(2)}deg`)
    emblem.style.setProperty('--rx', `${(-y * 10).toFixed(2)}deg`)
  })
  hero.addEventListener('pointerleave', () => {
    emblem.style.setProperty('--ry', '0deg')
    emblem.style.setProperty('--rx', '0deg')
  })
}

// ---------- copiar e-mail ----------
const copyBtn = $('#copy-mail')
copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(CONFIG.EMAIL)
    copyBtn.textContent = 'Copiado'
  } catch {
    const sel = window.getSelection()
    const range = document.createRange()
    range.selectNodeContents($('#mail-addr'))
    sel.removeAllRanges(); sel.addRange(range)
    copyBtn.textContent = 'Selecionado'
  }
  setTimeout(() => { copyBtn.textContent = 'Copiar' }, 2200)
})

// ---------- formulário: monta a mensagem e abre e-mail ou WhatsApp ----------
const form = $('#lead-form')
const waBtn = $('#btn-wa')
const err = $('#form-error')
const note = $('#form-note')
if (CONFIG.WHATSAPP) waBtn.hidden = false

function buildMessage(data) {
  const servicos = data.getAll('servico')
  const linhas = [
    `Olá, Korvex! Me chamo ${data.get('nome').trim()}${data.get('empresa').trim() ? `, da ${data.get('empresa').trim()}` : ''}.`,
    servicos.length ? `Tenho interesse em: ${servicos.join(', ')}.` : '',
    data.get('mensagem').trim() ? `\n${data.get('mensagem').trim()}` : '',
  ]
  return linhas.filter(Boolean).join('\n')
}

form.addEventListener('submit', (e) => {
  e.preventDefault()
  const nome = $('#f-nome')
  if (!nome.value.trim()) {
    err.hidden = false
    nome.setAttribute('aria-invalid', 'true')
    nome.focus()
    return
  }
  err.hidden = true
  nome.removeAttribute('aria-invalid')

  const data = new FormData(form)
  const msg = buildMessage(data)
  const via = e.submitter && e.submitter.dataset.via

  let url
  if (via === 'whatsapp' && CONFIG.WHATSAPP) {
    url = `https://wa.me/${CONFIG.WHATSAPP}?text=${encodeURIComponent(msg)}`
  } else {
    const assunto = `Orçamento: ${data.getAll('servico').join(', ') || 'projeto digital'}`
    url = `mailto:${CONFIG.EMAIL}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(msg)}`
  }
  const a = document.createElement('a')
  a.href = url
  if (url.startsWith('https:')) { a.target = '_blank'; a.rel = 'noopener' }
  document.body.appendChild(a)
  a.click()
  a.remove()

  note.hidden = false
  note.textContent = via === 'whatsapp'
    ? 'Abrimos o WhatsApp com a sua mensagem pronta. É só tocar em enviar.'
    : `Abrimos seu aplicativo de e-mail com a mensagem pronta. Se nada abriu, escreva para ${CONFIG.EMAIL}.`
})

$('#f-nome').addEventListener('input', (e) => {
  if (e.target.value.trim()) { err.hidden = true; e.target.removeAttribute('aria-invalid') }
})
