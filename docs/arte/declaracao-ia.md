# Declaração de uso de IA (Steam) — rascunho

Rascunho do texto para o formulário de conteúdo gerado por IA da Steam ("AI Generated Content Disclosure"), montado a
partir de `docs/memoria/assets.md` em 2026-11-20 (direção de arte, etapa 8). Atualizar quando entrar asset novo,
e conferir de novo antes de publicar a página: só conta o que o jogador **vê ou ouve** no jogo e na página da loja.
Ferramentas de código (assistentes de programação) não entram.

## Categoria

**Conteúdo pré-gerado** (pre-generated): todo asset de IA foi gerado durante o desenvolvimento, revisado e escolhido por
uma pessoa, e entra no jogo como arquivo fixo. **Não há geração de conteúdo por IA durante o jogo** (live-generated):
o jogo não chama nenhum serviço de IA.

## Texto proposto (inglês, para o formulário)

> Galope Elemental uses AI-assisted pixel art created during development. Horse sprite bases, interface icons, race
> backgrounds, trainer portraits, gym arenas, menu scenes, map terrains and the logo emblem were generated with
> PixelLab and Retro Diffusion, then selected by the developer and finished by hand-written code (fixed palette,
> pixel-grid cleanup, recoloring, composition). The logo lettering, the race track, weather effects and most of the
> interface are drawn by code. No AI content is generated while the game is running.

## Texto proposto (português, para a página e o README)

> Galope Elemental usa pixel art feita com ajuda de IA durante o desenvolvimento. As bases dos cavalos, os ícones, os
> cenários das corridas, os treinadores, as arenas dos ginásios, as cenas das telas, os mapas e o emblema do logo foram
> gerados com PixelLab e Retro Diffusion, escolhidos pelo desenvolvedor e acabados por código (paleta fixa, limpeza na
> grade de pixel, recoloração, composição). As letras do logo, a pista, os efeitos de clima e a maior parte da interface
> são desenhados por código. Nada é gerado por IA durante o jogo.

## O que o jogador vê, por origem

| Conteúdo | Origem | Onde está registrado |
|---|---|---|
| Moldes dos cavalos (portes e elementos; cores trocadas por código) | PixelLab (pixflux e animação) | `assets.md`: moldes, mestres e versões de elemento |
| Ícones de 24 × 24 (complexos) | PixelLab Pro | `assets.md`: ícones Pro |
| Ícones de 16 × 16 (simples) | **código**, desenhados à mão em mapas de texto (`icones16-mapas.mjs`) | `assets.md`: conjunto final dos ícones |
| Camadas das 5 regiões de corrida (nuvens, horizonte, meio, frente, arquibancada) | Retro Diffusion e PixelLab (Pixen) | `assets.md`: regiões |
| Pista, céu, sol, cercas, clima, partículas | **código** | `prototype/src/sprites.js`, `fx.js` |
| Treinadores dos ginásios (corpo 32 × 48 e busto 64 × 64) | PixelLab Pro, a partir da arte anterior também do PixelLab | `assets.md`: treinadores |
| Arenas dos 3 ginásios | Retro Diffusion | `assets.md`: arenas abertas |
| Cenas das abas e mapas das trilhas | Retro Diffusion (cenas) e PixelLab Pixen (mapas); caminho e paradas por código | `assets.md`: telas |
| Emblema do logo e ícone do app | PixelLab Pro | `assets.md`: marca |
| Letreiro do logo, destaque do Play e capa | **código** (o destaque e a capa são uma captura da cena do jogo com o logo) | `assets.md`: marca |
| Fonte (Galmuri) | fonte de pessoa (OFL), não é IA | `docs/arte/creditos.md` |
| Logo e capa antigos do Canva | Canva (IA) — **saem** quando a arte nova entrar no jogo | `assets.md`: logotipo e capa |

## Antes de publicar

- [ ] Conferir que nenhum asset do Canva sobrou no jogo nem na página (se sobrar, citar o Canva no texto).
- [ ] Se entrar som ou voz (ElevenLabs), incluir no texto e na tabela.
- [ ] Reler os termos de uso do PixelLab e da Retro Diffusion sobre uso comercial na data da publicação.
