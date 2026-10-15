# Korvex — Soluções Digitais

Site institucional e portfólio da **Korvex**, empresa de Cauã Moura e Vitor Ramos: landing pages, sites, aplicativos e Instagram para empresas.

> Estratégia / Tecnologia / Resultados

## Seções

Uma página só, com navegação por âncoras:

1. **Topo** — chamada principal e o K da marca com brilho de aço
2. **Faixa do lema** — Estratégia / Tecnologia / Resultados
3. **Serviços** — landing pages (carro-chefe), sites, aplicativos, Instagram
4. **Projetos** — case da AB Transportes + chamada para o próximo cliente
5. **Como trabalhamos** — as 4 etapas do processo
6. **Quem somos** — os dois sócios e os valores da Korvex
7. **Contato** — formulário que monta a mensagem e abre o e-mail (ou WhatsApp)

## Estrutura

```
index.html              todo o conteúdo e os textos (copy)
assets/css/style.css    cores, fontes e layout (variáveis no :root)
assets/js/main.js       menu, efeitos, formulário e dados de contato (CONFIG)
assets/img/             logo (K recortado), favicon, imagem de compartilhamento e fotos do case
```

Site estático, sem build: abre direto no navegador e é bom para o Google, porque todo o texto já está no HTML.

## Trocar contatos

Em `assets/js/main.js`, no topo:

```js
const CONFIG = {
  EMAIL: 'cv.korvex@gmail.com',
  WHATSAPP: '', // ex.: '5519999999999' — preenchido, aparece o botão "Enviar pelo WhatsApp"
}
```

## Rodar no computador

Qualquer servidor estático serve, por exemplo:

```bash
npx serve .
# ou
python -m http.server 5500
```

## Publicar no GitHub Pages

1. No GitHub, abra **Settings → Pages**.
2. Em **Source**, escolha **Deploy from a branch**, branch **main**, pasta **/ (root)**. Salve.
3. Em 1 ou 2 minutos o site fica em `https://pairon03.github.io/korvex-site/`.

Também funciona na Vercel ou Netlify: é só importar o repositório, sem configurar build.
