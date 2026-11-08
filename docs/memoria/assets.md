# Registro de assets

Todo asset que não foi feito à mão entra aqui. Serve para refazer/variar o asset e para a
**declaração de uso de IA**: na Steam, desde jan/2026, declara-se o conteúdo gerado por IA que o
jogador consome (arte, som, texto, página da loja); ferramentas de código não entram.

| Data | Arquivo(s) | Ferramenta | Prompt / parâmetros | Custo | Em uso no jogo? |
|---|---|---|---|---|---|
| 2026-11-05 | `prototype/assets/pixellab/{brasa,mare,ipe}.png` | PixelLab API v2 `create-image-pixflux` | Prompts e seeds (101/202/303) em `prototype/tools/pixellab-generate.mjs`; 64×64, vista lateral, contorno preto, sem fundo | 3 gerações da cota do plano (US$ 0 cobrado) | Não — só em `prototype/comparativo.html` |
| 2026-11-05 | `prototype/assets/pixellab/*-gallop-00..08.png` | PixelLab API v2 `animate-with-text-v3` | Ação: "galloping at full racing speed, legs extending and gathering, mane and tail flowing back"; 8 quadros pedidos (9 recebidos); mesmas seeds | 3 gerações da cota (~US$ 0,03 cada se pago) | Não — só em `prototype/comparativo.html` |
| 2026-11-08 | `prototype/assets/marca/logo.png` (640×125, fundo transparente por chave de cor; original 1024×1024) | Canva `create-design` (design DAHaWgeoGqw) | Logotipo pixel art "Galope Elemental" com cavalo de crina de fogo, água e folhas; fundo #0b1910 removido e redimensionado | Plano Canva pago (sem custo avulso) | Não (até a Task 4) |
| 2026-11-08 | `prototype/assets/marca/capa.png` e `docs/capa.png` (1024×500, faixa central do 1280×720) | Canva `create-design` "YouTube Thumbnail" (design DAHaWnkxNO4) | Capa noturna com 3 cavalos de Fogo, Água e Grama em pista; título "Galope Elemental" (corrigido à mão no editor: a IA escreveu "Calope") e "Corra, cruze e aposte". Rascunho descartado: DAHaWr7G4io (1024×256, título cortado) | Plano Canva pago (sem custo avulso) | Não — página da loja e README |
| — | `prototype/src/sprites.js` | Código (feito à mão) | Sprites desenhados por código | — | Sim |

As respostas cruas da API (sem as imagens) ficam em `prototype/assets/pixellab/*.json`.
