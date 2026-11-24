# Referências: tela inicial, mapa dos ginásios, inventário e animação ambiente

_2026-11-23 · pesquisa pedida pelo Vinicius no chat de coordenação. Links conferidos na busca; fontes de fã marcadas.
Base para as specs de cada frente (nada aqui está aprovado ainda)._

## 1. Tela inicial e menu principal
- **Stardew Valley** — tela-título viva, com segredos ao tocar (o "E" do logo, as folhas da placa).
  https://forums.stardewvalley.net/threads/title-screen-secrets-shift-a-little-to-the-left-after-opening-and-closing-language-menu.43702/post-179136
- **Terraria** — o sol e a lua do menu se arrastam e trocam o logo. https://terraria.wiki.gg/wiki/Logo
- **Coromon** (criaturas, pixel art, celular + Steam) — botão de skins na própria tela-título; o remaster tem menos
  toques. https://coromon.wiki.gg/wiki/Build_Notes
- **Cassette Beasts** — menu com tema do mundo (um toca-fitas); um redesign aponta pouco contraste no item ativo.
  https://medium.com/@davy_delbeke/redesigning-cassette-beasts-ui-a1c49452ea59
- **Umamusume: Pretty Derby** (corrida de cavalos, celular) — o cavalo favorito recebe o jogador; as ações principais
  ficam ao alcance do polegar. https://gamingonphone.com/reviews/umamusume-pretty-derby-game-review
- **Horse Racing Manager** (Steam) — o que evitar: o sprite é pixel art, mas o menu tem cara de software.
  https://store.steampowered.com/app/2740170/Horse_Racing_Manager/
- **Artigo "main menus are the game"** (Mega Man X, Dragon Age, Chest Quest) — a ação principal responde com uma
  animação. https://gamedeveloper.com/design/setting-the-tone-main-menus-are-the-game
- **Recomendações:** a cena é a pista, com o cavalo ativo em idle, o clima do dia e bandeirolas, e tocar no cavalo dá
  uma reação; botão "Correr" grande embaixo e as seções numa barra de ícones; ao tocar em "Correr", o cavalo dispara
  e a tela segue para a sala; a primeira sessão pula a tela-título; o cosmético de Gema aparece na própria cena; o item
  em foco tem contraste alto.

## 2. Mapa-múndi e seleção de fases
- **Shovel Knight: King of Cards** — cada mapa é uma tela de tabuleiro; caminho sólido para o que já se anda,
  pontilhado para o que pede vencer a fase.
  https://www.yachtclubgames.com/blog/knight-knight-s-map-building-secret-paths
- **Super Mario World** — o caminho se desenha ao vencer; há saídas secretas.
  https://gamedeveloper.com/design/touring-super-mario-world-in-2014
- **Super Mario Bros. Wonder** — dificuldade em estrelas no mapa; outros jogadores aparecem andando.
  https://nintendo.com/us/whatsnew/ask-the-developer-vol-11-super-mario-bros-wonder-part-1
- **Pokémon (Town Map)** — ícone do líder no mapa e viagem só para lugares já visitados.
  https://bulbapedia.bulbagarden.net/wiki/Town_Map
- **Slay the Spire** — mapa de nós vertical, que cabe no retrato. https://github.com/yurkth/stsmapgen
- **Candy Crush Saga** — mapa linear refeito em 2022 para ficar mais legível.
  https://www.gamedeveloper.com/design/rethinking-progression-in-mobile-puzzle-games
- **Hollow Knight** — névoa sobre o que ainda não foi conquistado.
  https://gamedeveloper.com/design/how-the-i-hollow-knight-i-devs-mapped-out-their-metroidvania-
- **Lunch Bug** — nós com 3 estados, um mascote que anda até o próximo nó, folhas em parallax.
  https://gamedeveloper.com/art/polishing-a-level-select-screen-process-and-implementation
- **Recomendações:** mapa de tela única em retrato, com as 3 regiões; caminho em tiles de pista que vai de pontilhado
  a pintado tile a tile ao vencer; o cavalo do jogador anda entre os nós num trote; estados legíveis (travado,
  disponível pulsando, atual com o cavalo em idle, vencido com estrelas ou insígnia, revanche do dia); névoa sobre a
  região que ainda não foi liberada; transição com zoom inteiro e íris na cor do elemento.

## 3. Inventário e equipamento
- **Black Desert** (montaria, fonte de fã) — 5 slots funcionais e 4 decorativos, conjuntos com bônus a partir de 3
  peças. https://blackdesertonline.fandom.com/wiki/Mount_Equipment?oldid=7653
- **Diablo 3 e 4** — cor por raridade; comparação em verde e vermelho; um número-resumo do item.
  https://www.denofgeek.com/games/diablo-4-best-hidden-setting-compare-gear · https://us.diablo3.com/blog/20120910
- **Path of Exile** — a grade "Tetris" só vale se organizar o inventário fizer parte do jogo; para nós, não faz.
  https://outof.games/news/6699-inventory-systems-in-games-lost-in-the-grid/
- **Stardew Valley no celular** — arrastar, botão organizar, fonte grande; cuidado com o toque que vaza para trás da
  interface. https://wiki.stardewvalley.net/Mobile_Controls
- **Legends of IdleOn** (guia de fã) — espaço de inventário limitado e ampliável.
  https://www.digitaltq.com/wiki/idleon/beginner-guide
- **Recomendações:** silhueta do cavalo com os slots no corpo e uma aba "Visual" para os cosméticos; raridade pela
  moldura, com brilho por color cycling no Lendário; comparação ao tocar numa folha inferior (verde/vermelho e a
  diferença de Poder); grade de 1 slot por item, com filtros e botão Organizar; alvos de toque de 44 px no mínimo.

## 4. Animação ambiente em pixel art
- **Mark Ferrari / color cycling em HTML5** — água, lava, névoa e chuva só girando a paleta, rodando até no iPhone
  3GS. http://www.effectgames.com/effect/article-Old_School_Color_Cycling_with_HTML5.html
- **Slynyrd, Pixelblog 10 (água), 23 (parallax) e 46 (cena de corrida)** —
  https://www.slynyrd.com/blog/2018/10/12/pixelblog-10-water-in-motion ·
  https://www.slynyrd.com/blog/2019/11/12/pixelblog-23-parallax-scrolling ·
  https://slynyrd.com/blog/2023/9/25/pixelblog-46-anti-gravity-racing-scene
- **Idle de personagem** — respirar com 1 px, piscar de forma irregular.
  https://itch.io/blog/559673/pixel-art-idle-cycle-animation-tutorial
- **Cavalos abertos para estudo** — https://opengameart.org/content/animated-horse (Idle, Eat, Walk, Run)
- **PixelLab (API v2, documentação atual)** — tem animação de objeto (`/v2/objects/{id}/animations`), animação por
  imagem de referência mais texto (`/v2/animate-with-text-v3`; 4 quadros para loops de idle) e VFX (`/v2/vfx`: fogo,
  fumaça). Não anima tiles nem mapa. **Gasta créditos.** https://api.pixellab.ai/v2/llms.txt
- **Retro Diffusion (RD Animation)** — só sprites de 32 e 48 px e VFX; não anima cenário.
  https://help.scenario.com/en/articles/retro-diffusion-models-the-essentials/
- **Recomendações:**
  - Color cycling por código para lava, água, brilho e céu, que custa zero de arte.
  - Loops de 4 a 6 quadros para os props, em fase trocada.
  - Nuvens e pássaros por código, em parallax inteiro.
  - Idle do cavalo em camadas: respiração mais variações raras (piscar, cauda, orelha, cavar, comer), com RNG só
    cosmético, fora da seed.
  - Partículas por código.
  - PixelLab `animate-with-text-v3` de 4 quadros para o idle dos moldes e os props grandes, e `/v2/vfx` para o vulcão.

## Não confirmado
Game UI Database (403), Kingdom Rush, Sea of Stars e Eastward (não acharam descrição do mapa), Dicey Dungeons, Diablo
Immortal no celular, interface do IdleOn e do Umamusume (só reviews), Saint11.
