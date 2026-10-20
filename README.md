# Korvex — Soluções Digitais

Site institucional e portfólio da **Korvex**, de Cauã Moura e Vitor Ramos: landing pages, sites e consultoria de marca no Instagram para empresas.

> Estratégia / Tecnologia / Resultados

## O que tem no site

Uma página só, pensada como um projetor de hologramas (CSS 3D, sem WebGL, leve no celular):

1. **Topo**: o projetor monta exemplos de projeto sozinho (landing page, site, Instagram).
2. **Serviços**: quatro cartões; cada um abre o "Monte o seu" com o serviço escolhido.
3. **Monte o seu**: o visitante escolhe tipo, segmento, nome do negócio e cor, vê o holograma e gera a mensagem do pedido.
4. **Projeto**: AB Transportes, com as telas reais em camadas e o link do site no ar.
5. **Como trabalhamos**, **Quem somos** e **Contato**.
6. Atalho de comandos: tecla K (ou o botão "Comandos").

Os negócios de exemplo nos hologramas são fictícios. Tudo respeita "reduzir movimento".

## Estrutura

```
index.html          página, estilos e código (tudo num arquivo)
assets/fonts/       Michroma e Manrope (licença OFL)
assets/img/         favicon, imagem de compartilhamento, K e telas da AB
```

## Trocar contatos

Em `index.html`, procure por `EMAIL`:

```js
const EMAIL = 'cv.korvex@gmail.com'
```

## Rodar no computador

Abra o `index.html` direto no navegador, ou rode um servidor local:

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
