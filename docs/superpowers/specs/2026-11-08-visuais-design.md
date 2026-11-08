# Visuais — Moldes de cavalo recoloridos, ícones e marca — Design

Status: **aguardando revisão do Vinicius**. Aprovado em conversa em 2026-11-08 (seções 1–4). Depois de
aprovado vira plano (`docs/superpowers/plans/`); ao final atualiza `docs/memoria/assets.md`, GDD §5 e
`CLAUDE.md` §7.

Frente de visuais pedida pelo Vinicius em 2026-11-08 ("usar os novos visuais também, com o pixellab e
canvas pagos"), adiantada para antes das expedições a pedido dele (opção 2). Branch: `claude/visuais`.
Referências: sprites PixelLab dos 3 iniciais gerados em 2026-11-05 (`prototype/assets/pixellab/`,
`prototype/comparativo.html`), sprites por código em `prototype/src/sprites.js`.

## 1. Objetivo

Trocar os cavalos desenhados por código por **arte do PixelLab recolorida pelo jogo**, trocar os ícones
de caracteres/emoji da interface por **ícones pixel do PixelLab** e dar ao jogo um **logotipo e uma capa**
feitos no Canva — sem mudar nenhuma regra e gastando pouco: 4 moldes servem para as 16 montarias, para
qualquer potro e para as 8 sedas da corrida.

Pergunta que o protótipo precisa responder: a arte gerada, recolorida pela paleta de cada cavalo, fica
boa o bastante na corrida (8 cavalos pequenos em movimento) para ser o caminho de produção?

## 2. Decisões (com a origem)

| Decisão | Origem |
|---|---|
| Visuais antes das expedições (fundos e biomas ficam para depois) | Vinicius (opção 2) |
| Poucos moldes recoloridos pelo jogo, não um sprite por montaria | Vinicius (opção A) |
| Escopo: cavalos + 16 ícones de interface + logotipo e capa (Canva); fundos continuam por código | Vinicius (opção A) |
| Gasto autorizado por lote com teto; repetições dentro do teto sem nova pergunta | Vinicius (opção A); teto **US$ 5** (sugestão aceita) |
| Credencial do PixelLab só pelo formulário seguro da sessão; nunca na conversa nem no código | CLAUDE.md §9 |
| Fallback: sem moldes carregados, o jogo desenha por código como hoje | seção 1 aprovada |
| Ícones como `<img class="icone" alt="">` com o rótulo de texto mantido ao lado | seção 2 aprovada |

## 3. Pipeline dos cavalos

### 3.1 Moldes (geração, offline)

4 estilos de crina, um por elemento: `chamas` (Fogo), `ondas` (Água), `folhas` (Grama), `lisa` (Neutro).
Cada estilo tem **base** (parado) e **galope** de 9 quadros, 64×64, vista lateral, de frente para a
direita, contorno preto, fundo transparente, jóquei montado. Os prompts exigem cores chapadas e
separadas para os 8 papéis (sem degradê), com estas cores de referência:

| Índice | Papel | Cor de referência no prompt |
|---|---|---|
| 0 | transparente | — |
| 1 | contorno | preto `#000000` |
| 2 | pelo | vermelho `#ff0000` |
| 3 | sombra do pelo | vinho `#800000` |
| 4 | crina e cauda | verde `#00ff00` |
| 5 | sombra da crina | verde escuro `#008000` |
| 6 | casco e detalhe (focinho, meia) | azul `#0000ff` |
| 7 | seda do jóquei | amarelo `#ffff00` |
| 8 | pele do jóquei | rosa `#ffc0cb` |
| 9 | sela e rédea | cinza `#808080` |

### 3.2 Normalização (offline)

Para cada quadro: cada pixel opaco recebe o índice do papel cuja cor de referência está mais próxima
(distância RGB); pixels com alfa < 128 viram 0. Rejeita o quadro se encontrar menos de 7 papéis ou se o
contorno não fechar a silhueta (teste: flood fill a partir das bordas não entra no corpo). Salva
`prototype/assets/pixellab/molde-<estilo>-base.png` e `molde-<estilo>-galope-0..8.png` como PNG em tons
de cinza (valor = índice × 25) e `molde-<estilo>.json`:

```
{ "estilo": "chamas", "w": 64, "h": 64, "footY": 61, "nose": [58, 20], "rear": [8, 28], "saddle": [30, 18],
  "frames": 9, "seed": 1101, "gerado": "2026-11-08" }
```

`footY` = última linha com pixel não transparente no quadro base; `nose`/`rear` = pixel opaco mais à
direita/esquerda na metade superior; `saddle` = centro do papel 9. A câmera da corrida usa `nose` e
`rear` como usa `Sprites.ANCHORS` hoje.

### 3.3 No jogo (`prototype/src/sprites.js`, `build.mjs`)

- `build.mjs` embute os 40 PNGs como `data:` numa tabela `window.__MOLDES` (≈ 60 KB) e os JSONs.
- `Sprites.loadMolds(table)` decodifica cada PNG num canvas, lê os índices e guarda; `Sprites.moldsReady`
  vira `true` quando os 4 estilos carregaram; falha em qualquer um deixa `false` (sem exceção).
- `Sprites.drawHorse(ctx, x, y, o)`: se `moldsReady`, usa o molde do estilo do elemento (`o.element`),
  pinta cada índice com a cor da montaria e do corredor e desenha na escala pedida; senão, o desenho por
  código atual. Cores: 2 `palette.coat`, 3 `palette.coatShade` (ou `shade(coat, 0.35)`), 4
  `palette.mane`, 5 `shade(mane, 0.35)`, 6 `palette.accent`, 7 `o.silks`, 8 pele fixa `#e8b48a`, 9 sela
  fixa `#5a3a22`, 1 contorno `#1a1405`. As mesmas funções `shade`/`light` de hoje.
- Cache: um canvas recolorido por (estilo, quadro, paleta, seda), chave = string das cores; limpo ao
  trocar de tela.
- Âncoras: `Sprites.anchorsFor(element)` devolve as do molde quando carregado, senão `ANCHORS`.
- Tamanho na tela: os moldes são 64×64 contra 40×32 dos sprites por código; `drawHorse` aplica
  `scale × 0.5` aos moldes para manter o cavalo com o mesmo tamanho na pista e nos retratos (a altura
  útil do molde é ~40 px), e `footY` alinha os cascos à linha do chão como hoje.
- `?semmoldes=1` na URL pula o `loadMolds` (para testar a queda).

### 3.4 `comparativo.html`

Passa a mostrar, para cada um dos 4 estilos: o molde cru, o mapa de papéis colorido por índice, o
recolorido com a paleta de cada uma das 16 montarias e as 8 sedas, e o sprite por código ao lado;
galope animado em 1× e 3×. É onde eu valido antes de ligar no jogo.

## 4. Ícones e marca

### 4.1 Ícones (PixelLab)

16 ícones, pedidos um a um, 32×32 e reduzidos para 16×16 (vizinho mais próximo) quando a redução
preservar a leitura; contorno escuro; paleta do jogo (`--ouro #f2c230`, creme `#f1e9d4`, verde-painel
`#16271f`, mais a cor do tema do ícone):

| Arquivo | Uso | Substitui |
|---|---|---|
| `aba-estabulo` cavalo, `aba-correr` bandeira quadriculada, `aba-expedicao` bússola, `aba-haras` dois corações, `aba-loja` carrinho | barra de abas | emojis |
| `slot-ferraduras`, `slot-sela`, `slot-estribos`, `slot-testeira`, `slot-armadura` | slots do equipamento (chips e tela da Montaria) | `+N`/`—` continuam como texto sobre o ícone |
| `moeda-ouro`, `pedra-negra` | cabeçalho, preços, saldos | 🪙 / 🪨 |
| `el-fogo` chama, `el-agua` gota, `el-grama` folha, `el-neutro` círculo | selos de elemento | emojis |

Salvos em `prototype/assets/icons/<nome>.png`, embutidos como `data:` pelo `build.mjs` numa tabela
`window.__ICONES`; no HTML viram `<img class="icone icone--<nome>" src="…" alt="" width="16" height="16">`
com o rótulo de texto mantido ao lado (acessibilidade igual). `game.css` ganha `.icone` (pixelado:
`image-rendering: pixelated`).

### 4.2 Marca (Canva)

- **Logotipo "Galope Elemental"**: horizontal, pixel/retrô, fundo transparente (ou na cor `--noite`
  se o plano não exportar transparência), exportado em PNG 1024 px de largura →
  `prototype/assets/marca/logo.png`; entra na tela inicial no lugar do título em fonte pixel e,
  reduzido (altura 24 px), no cabeçalho da casca.
- **Capa** 1024×500 (formato do Google Play): cavalos dos 3 elementos em corrida, título, fundo noturno
  → `prototype/assets/marca/capa.png` e `docs/capa.png` (usada no `README.md`).

Feitos com o conector do Canva da sessão (design → export PNG). Não há mais nada do Canva nesta frente.

## 5. Ferramenta, credencial e lote

- **Credencial:** `request_credential` para `api.pixellab.ai` (Bearer) no início da execução; o proxy
  injeta nas chamadas; o script manda um valor fictício no cabeçalho. Nunca na conversa nem no repositório.
- **Script** `prototype/tools/pixellab-moldes.mjs` (substitui `pixellab-generate.mjs`, que sai do
  repositório e fica citado em `assets.md`): `--lote moldes|icones|tudo`, `--only <id>`, `--dry-run`
  (prompts + custo estimado, sem API), `--teto 5` (lê o saldo antes e depois de cada chamada, soma o
  `usage.usd` real e para antes de passar). Por item: chama a API, salva o cru em
  `prototype/assets/pixellab/raw/` (ou `assets/icons/raw/`), normaliza, salva o final e **acrescenta a
  linha em `docs/memoria/assets.md`** (data, arquivo, endpoint, prompt, seed, custo real, em uso).
  Quadro rejeitado na normalização ou chamada com erro ⇒ item marcado para repetição com outra seed,
  contando no teto. Respostas cruas em JSON ao lado, como hoje.
- **Lote aprovado** (teto US$ 5): 4 bases + 4 galopes + 16 ícones + repetições; logotipo e capa no Canva
  (cota do plano). Estimativa total < US$ 2.

## 6. Verificação

- **`prototype/tools/moldes-test.mjs`** (Node, sem canvas): lê os PNGs finais e os JSONs e confere, por
  estilo: 10 quadros do mesmo tamanho; só índices 0–9; ≥ 7 papéis em cada quadro; `footY` = última linha
  opaca do quadro base; `nose.x` dos quadros de galope dentro de ±6 px do da base. Entra no
  `scripts/check.sh` como etapa 3b, executada só se `prototype/assets/pixellab/molde-*.json` existir.
- **`ui-test.mjs`:** após o `load` da tela inicial, `window.Sprites.moldsReady === true`; na corrida,
  nenhum erro de console e o cavalo na tela (já verificado); barra de abas e cabeçalho com `img.icone`
  com `alt=""` e rótulo de texto ao lado; contexto `?semmoldes=1`: `moldsReady === false` e a corrida
  desenha (canvas da pista com pixels não vazios na faixa do jogador, como a verificação de câmera já
  faz).
- **Capturas oficiais** regeneradas (todas mudam de propósito).
- Unitários (58) e balanceamento (34) inalterados; `sim.js`, `gear.js`, `breed.js`, `data.js` e o save
  não mudam.

## 7. Documentação

`docs/memoria/assets.md` (uma linha por arquivo; o script escreve), `README.md` (capa), GDD §5 (a arte do
protótipo: moldes recoloridos, ícones, marca), `CLAUDE.md` §7 (script novo; "gasta créditos, sempre
pedir confirmação" continua), memória (`ESTADO.md`, `decisoes.md`), esta spec com "Histórico de ajustes".

## 8. Fora de escopo

Fundos e biomas · inimigos · retratos individuais por montaria · ícones de skills · sons (ElevenLabs) ·
página da loja completa · trocar a pista por código.

## 9. Riscos

- **Mapeamento de cores ruim** em alguns quadros (degradê, anti-aliasing): prompt com cores chapadas,
  repetição com outra seed dentro do teto, correção manual no `comparativo.html`.
- **Estilo do PixelLab destoando da pista por código**: mesma paleta e contorno; se destoar muito, a
  pista entra na próxima frente.
- **Canva sem fundo transparente** no plano: fundo na cor `--noite`.
- **Custo por chamada maior que o estimado**: o script para no teto e eu mostro o parcial.
- **Tamanho do build**: ~60 KB de moldes + ~20 KB de ícones + logotipo; aceitável para o protótipo.
