# Korvex — Soluções Digitais

Site institucional e portfólio da **Korvex**, de Cauã Moura e Vitor Ramos: landing pages, sites, aplicativos e Instagram para empresas.

> Estratégia / Tecnologia / Resultados

## O que tem no site

Uma página só, com navegação por âncoras:

1. **Topo**: o K da marca em 3D cromado, renderizado ao vivo (Three.js). Ele segue o mouse, acende as linhas neon ao carregar e inclina quando a página rola.
2. **Serviços**: quatro blocos com demonstrações animadas.
   - Landing page: um cursor clica em "Pedir orçamento" e os pedidos chegam.
   - Site: uma busca no Google encontra o site.
   - Aplicativo: alguém agenda um horário.
   - Instagram: um botão "Antes / Depois" organiza o perfil.
   - As bordas acendem perto do mouse (efeito "Glowing Effect", 21st.dev).
3. **Projetos**: o case da AB Transportes com prints reais. A página inteira rola sozinha no computador e no celular, e cada item da lista mostra uma parte do site.
4. **Processo**: um controle de arrastar leva a página da AB do briefing ao ar, nas etapas Conversa, Estratégia, Tecnologia e Resultados.
5. **Quem somos**: Cauã e Vitor.
6. **Contato**: um campo só com borda neon pulsante (shader "Pulsing Border", 21st.dev / Paper Shaders). Ele monta a mensagem e abre o e-mail (ou o WhatsApp, se configurado).
7. **Rodapé**: o KORVƎX cromado em largura total.

Tudo respeita a configuração de "reduzir movimento". Sem WebGL, o topo mostra uma imagem do K. Sem JavaScript, todo o conteúdo continua visível.

## Estrutura

```
index.html                    conteúdo e textos
assets/css/style.css          cores, fontes, layout e animações (variáveis no :root)
assets/js/main.js             menu, demonstrações, projetos, processo, contato (CONFIG no topo)
assets/js/k3d.js              o K em 3D (geometria traçada da logo, metal escovado, neon, bloom)
assets/js/pulse-border.js     a borda neon do campo de contato (WebGL)
assets/vendor/three/          Three.js r169 (licença MIT)
assets/fonts/                 Michroma e Manrope (licença OFL), servidas pelo próprio site
assets/img/                   K renderizado, favicon, imagem de compartilhamento, prints da AB
```

Site estático, sem build: abre direto em qualquer servidor e é bom para o Google, porque o texto já está no HTML.

## Trocar contatos

Em `assets/js/main.js`, no topo:

```js
const CONFIG = {
  EMAIL: 'cv.korvex@gmail.com',
  WHATSAPP: '', // ex.: '5519999999999'. Preenchido, o formulário abre o WhatsApp
}
```

## Rodar no computador

O 3D usa módulos JavaScript, então precisa de um servidor (abrir o arquivo direto não funciona):

```bash
npx serve .
# ou
python -m http.server 5500
```

## Publicar no GitHub Pages

1. Suba esta pasta para um repositório (ex.: `korvex-site`).
2. No GitHub, abra **Settings → Pages**.
3. Em **Source**, escolha **Deploy from a branch**, branch **main**, pasta **/ (root)**. Salve.
4. Em 1 ou 2 minutos o site fica em `https://pairon03.github.io/korvex-site/`.

Também funciona na Vercel ou Netlify: é só importar o repositório, sem configurar build.

## Antes de divulgar

- Trocar os monogramas CM e VR por fotos de vocês (classe `.mono` em "Quem somos").
- Conferir o texto sobre o Vitor (papel na empresa).
- Preencher o WhatsApp no `CONFIG`, quando tiver o número da Korvex.
- As demonstrações dos serviços usam uma doceria fictícia ("Doce Ponto") e estão marcadas como ilustrativas.
