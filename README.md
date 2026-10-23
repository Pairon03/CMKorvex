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
briefing.html       formulário de briefing para clientes (Vue via CDN, envio pelo FormSubmit)
assets/fonts/       Michroma e Manrope (licença OFL)
assets/img/         favicon, imagem de compartilhamento, K e telas da AB
```

## Briefing de clientes

O formulário fica em `https://vmkorvex.vercel.app/briefing.html` (fora do Google, com `noindex`). Cada envio vira uma linha na tabela `briefings` do Supabase, e o logo e as fotos vão para o bucket privado `briefings`, numa pasta com o id do briefing.

Para configurar (uma vez):

1. No Supabase, abra **SQL Editor**, cole `supabase/briefing.sql` e rode. Ele cria a tabela, o bucket e as permissões: visitantes só conseguem enviar, ninguém de fora lê nada.
2. Em **Project Settings → API**, copie a Project URL e a chave `anon public` para `SUPABASE_URL` e `SUPABASE_ANON_KEY` em `briefing.html`. Nunca use a chave `service_role` no site.
3. Para ver os briefings: **Table Editor → briefings** (fotos em **Storage → briefings**).

## Trocar contatos

Em `index.html`, procure por `EMAIL`:

```js
const EMAIL = 'vm.korvex@gmail.com'
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
