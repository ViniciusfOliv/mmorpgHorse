# Registro de assets

Todo asset que não foi feito à mão entra aqui. Serve para refazer ou variar o asset e para a
**declaração de uso de IA** (na Steam, desde jan/2026, declara-se o conteúdo gerado por IA que o
jogador vê ou ouve; ferramentas de código não entram).

Os prompts completos, as seeds e os parâmetros de cada arquivo estão em
`prototype/tools/pixellab-moldes.mjs` e nas respostas cruas da API em `prototype/assets/pixellab/raw/`
e `prototype/assets/icons/raw/`. Com elas, `--reprocessar` refaz os arquivos finais sem rede e sem custo.

| Lote | Arquivos | Ferramenta | Como foi pedido | Seeds finais | No jogo? |
|---|---|---|---|---|---|
| Moldes de cavalo (2026-11-08 e 09) | `prototype/assets/pixellab/molde-{chamas,ondas,folhas,lisa}-{retrato,parado,galope-0..8}.png` e `molde-*.json` | PixelLab API v2: `create-image-pixflux` (retrato, parado, pose de corrida) e `animate-with-text-v3` (galope de 9 quadros) | 64×64, vista lateral, cores de papel pedidas por texto e classificadas no script (matiz e Otsu); o galope de ondas, folhas e lisa foi guiado pelo 1º quadro do galope de chamas (`init_image_strength` 300) | chamas 1101, 1111 · ondas 1201, 1511 · folhas 1301, 1601 · lisa 1411, 1421, 1721 | Sim |
| Ícones (2026-11-08 e 09) | `prototype/assets/icons/*.png` (16: 5 abas, 5 slots, Ouro, Pedra Negra, 3 tipos e `el-geral`, o das skills gerais: era `el-neutro`, renomeado em 2026-11-11 com o cru em `raw/` e o nome de saída no script, sem gerar de novo) | PixelLab `create-image-pixflux` | 32×32, "<objeto> icon, pixel art game ui icon, centered, simple, readable at small size", contorno preto, paleta do jogo em `color_image` | 2101 a 2116; trocados: expedição 2153, estribos 2128 | Sim |
| Logotipo (2026-11-08) | `prototype/assets/marca/logo.png` (320×63, 64 cores) | Canva `create-design` (design DAHaWgeoGqw) | logotipo pixel art "Galope Elemental"; fundo removido por chave de cor e redimensionado | — | Sim |
| Capa (2026-11-08) | `docs/capa.png` (1024×500) | Canva `create-design` (design DAHaWnkxNO4) | capa noturna com 3 cavalos de Fogo, Água e Grama; título corrigido à mão (a IA escreveu "Calope") | — | README e futura página da loja |
| Pista, clima, efeitos e interface | `prototype/src/sprites.js`, `prototype/src/fx.js`, `prototype/src/game.css` | código, feito à mão | — | — | Sim |

## Custo
- **PixelLab:** 69 gerações da cota do plano entre 2026-11-08 e 09 (saldo 1994 → 1925), US$ 0 avulso.
  O número inclui o experimento de paleta, tentativas rejeitadas e a rodada de crinas próprias por
  estilo, que não passou nos critérios (os galopes guiados pelo de chamas ficaram).
- **Canva:** plano pago, sem custo avulso.
- Em 2026-11-05 foram 6 gerações para sprites prontos dos 3 iniciais; o jogo passou a usar os moldes
  e esses arquivos saíram do repositório em 2026-11-10 (estão no histórico do git).
- As tentativas rejeitadas que não fazem parte da cadeia de seeds também saíram em 2026-11-10.
