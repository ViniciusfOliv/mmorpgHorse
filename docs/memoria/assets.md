# Registro de assets

Todo asset que não foi feito à mão entra aqui. Serve para refazer/variar o asset e para a
**declaração de uso de IA**: na Steam, desde jan/2026, declara-se o conteúdo gerado por IA que o
jogador consome (arte, som, texto, página da loja); ferramentas de código não entram.

| Data | Arquivo(s) | Ferramenta | Prompt / parâmetros | Custo | Em uso no jogo? |
|---|---|---|---|---|---|
| 2026-11-05 | `prototype/assets/pixellab/{brasa,mare,ipe}.png` | PixelLab API v2 `create-image-pixflux` | Prompts e seeds (101/202/303) em `prototype/tools/pixellab-generate.mjs`; 64×64, vista lateral, contorno preto, sem fundo | 3 gerações da cota do plano (US$ 0 cobrado) | Não — só em `prototype/comparativo.html` |
| 2026-11-05 | `prototype/assets/pixellab/*-gallop-00..08.png` | PixelLab API v2 `animate-with-text-v3` | Ação: "galloping at full racing speed, legs extending and gathering, mane and tail flowing back"; 8 quadros pedidos (9 recebidos); mesmas seeds | 3 gerações da cota (~US$ 0,03 cada se pago) | Não — só em `prototype/comparativo.html` |
| — | `prototype/src/sprites.js` | Código (feito à mão) | Sprites desenhados por código | — | Sim |

As respostas cruas da API (sem as imagens) ficam em `prototype/assets/pixellab/*.json`.
