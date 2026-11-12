// prototype/tools/icones-catalogo.mjs — catálogo dos 58 ícones novos (spec 2026-11-12-icones-design.md §2).
// Só dados e pequenos exports: o script do PixelLab (lote icones2) e a folha de conferência leem daqui.
// Descrição = pedido ao PixelLab (inglês, objeto simples, sem letras nem números); cor = cor do tema que se
// soma à paleta da interface ('#rrggbb') ou null (o "—" da spec). Seed = 2201 + índice, salvo seed própria
// (refação de um item).

export const FAMILIAS = [
  { id: 'ui', nome: 'No lugar dos emojis e símbolos' },
  { id: 'st', nome: 'Status' },
  { id: 'sk', nome: 'Skills' },
  { id: 'cl-pi', nome: 'Clima e piso' },
  { id: 'liga-rar-podio', nome: 'Ligas, raridades e pódio' },
  { id: 'reservado', nome: 'Reservados para recursos que estão chegando' },
];

// Fogo #ff8a4c, Água #62b8ff, Grama #86d86a, gerais #f2c230
const FOGO = '#ff8a4c', AGUA = '#62b8ff', GRAMA = '#86d86a', GERAL = '#f2c230';

// [familia, id, descrição, cor, opções]; opções.seed = seed própria (refação: descrição reescrita, seed base + 100; 2ª refação, base + 200)
const TABELA = [
  // §2.1
  ['ui', 'ui-perfil', 'jockey riding helmet with a short visor, side view', '#ff6b5e'],
  ['ui', 'ui-dado', 'white six-sided die showing three pips, slight three-quarter view', '#ffffff'],
  ['ui', 'ui-macho', 'blue Mars symbol: a thick blue ring with a short arrow attached at its upper right edge, the arrow pointing diagonally outward to the upper right, nothing below the ring', '#62b8ff', { seed: 2403 }],  // 2ª refação 2026-11-12 (seed base + 200): era "bold blue male gender symbol: a thick blue ring with a short arrow pointing diagonally up and to the right"; antes "male symbol: a circle with an arrow pointing to the upper right"
  ['ui', 'ui-femea', 'female symbol: a circle with a small cross below it', '#ff8ad8'],
  ['ui', 'ui-estrela', 'five-pointed star, filled solid gold', null],
  ['ui', 'ui-estrela-vazia', 'hollow five-pointed star: thick light gray star outline with an empty transparent center', '#a9b5ae', { seed: 2306 }],  // refação 2026-11-12: era "five-pointed star outline only, hollow dark center" ('#5a6b63')
  ['ui', 'ui-corcel', 'small pennant flag on a short pole with a horseshoe emblem', null],
  // §2.2
  ['st', 'st-vel', 'lightning bolt', '#ffd86a'],
  ['st', 'st-acel', 'bold orange arrow pointing right with three orange speed lines behind it', '#ff8a4c', { seed: 2309 }],  // refação 2026-11-12: era "bold forward arrow with three motion lines behind it"
  ['st', 'st-man', 'thick teal curved arrow sweeping around a bend from the bottom left to the top right', '#5fd3c8', { seed: 2310 }],  // refação 2026-11-12: era "curved arrow turning around a bend"
  ['st', 'st-forca', 'flexed strong arm', '#86d86a'],
  ['st', 'st-est', 'heart with a pulse line across it', '#ff6b5e'],
  ['st', 'st-garra', 'three bright blue diagonal claw scratch marks with white highlights', '#62b8ff', { seed: 2313 }],  // refação 2026-11-12: era "three diagonal claw slash marks"
  ['st', 'st-sorte', 'four-leaf clover', '#7be07a'],
  // §2.3 (cor pelo elemento da skill)
  ['sk', 'sk-arranque', 'small yellow rocket launching to the right with a flame burst behind it', GERAL, { seed: 2415 }],  // 2ª refação 2026-11-12 (seed base + 200): era "yellow explosive burst star with three speed lines trailing to the left"; antes "horseshoe with a speed burst behind it"
  ['sk', 'sk-sprint', 'double chevron arrow pointing right', GERAL],
  ['sk', 'sk-drift', 'yellow curved tire skid mark swooping in an arc, with small gray dust puffs at the end', GERAL, { seed: 2317 }],  // refação 2026-11-12: era "curved skid trail with small dust puffs"
  ['sk', 'sk-saida-rapida', 'arrow curving out of a bend and shooting forward', GERAL],
  ['sk', 'sk-folego-de-montanha', 'small mountain with a puff of breath', GERAL],
  ['sk', 'sk-segundo-ar', 'yellow spiral wind gust swirl with a small plus sign next to it', GERAL, { seed: 2320 }],  // refação 2026-11-12: era "wind swirl with a small plus sign"
  ['sk', 'sk-arrancada-final', 'checkered finish flag with an upward arrow', GERAL],
  ['sk', 'sk-dado-viciado', 'die with one glowing extra pip and a small sparkle', GERAL],
  ['sk', 'sk-sol-a-pino', 'blazing sun with sharp rays', FOGO],
  ['sk', 'sk-chama-final', 'flame shaped like an arrow pointing right', FOGO],
  ['sk', 'sk-pe-na-chuva', 'horseshoe under falling raindrops', AGUA],
  ['sk', 'sk-canto-da-iara', 'seashell with two music notes', AGUA],
  ['sk', 'sk-nascente', 'small blue water fountain spring bubbling up from a gray rock, single isolated object, no scenery', AGUA, { seed: 2327 }],  // refação 2026-11-12: era "water spring bubbling up between rocks"
  ['sk', 'sk-nevoa-amiga', 'soft mist cloud with a small leaf', GRAMA],
  ['sk', 'sk-casco-firme', 'hoof pressing down on a rock step', GRAMA],
  ['sk', 'sk-tipo-fogo', 'orange fire blaze streaking horizontally to the right with a long flame trail', FOGO, { seed: 2330 }],  // refação 2026-11-12: era "tall blazing flame with a motion trail"
  ['sk', 'sk-tipo-grama', 'tree roots gripping the ground', GRAMA],
  ['sk', 'sk-tipo-agua', 'tall cresting ocean wave', AGUA],
  // §2.4
  ['cl-pi', 'cl-sol', 'sun with short rays', '#ffd86a'],
  ['cl-pi', 'cl-chuva', 'rain cloud with falling drops', '#62b8ff'],
  ['cl-pi', 'cl-nevoa', 'three horizontal wavy fog bands', '#9fb8a8'],
  ['cl-pi', 'cl-nublado', 'gray cloud', '#b8c2cc'],
  ['cl-pi', 'pi-grama', 'tuft of grass on a thin strip of soil', '#5fa34a'],
  ['cl-pi', 'pi-terra', 'clump of brown earth with small stones', '#9a6b3f'],
  ['cl-pi', 'pi-areia', 'small rounded pale sand dune with wavy ridge lines, side view', '#e2c27a', { seed: 2339 }],  // refação 2026-11-12: era "small sand dune"
  // §2.5
  ['liga-rar-podio', 'liga-bronze', 'shield badge with a horse head silhouette, plain', '#b0703c'],
  ['liga-rar-podio', 'liga-prata', 'metallic silver gray shield badge with a dark horse head silhouette and one small star', '#b8c2cc', { seed: 2341 }],  // refação 2026-11-12: era "shield badge with a horse head silhouette and one small star"
  ['liga-rar-podio', 'liga-ouro', 'shiny bright gold shield badge with a dark horse head silhouette and two small stars', '#f2c230', { seed: 2342 }],  // refação 2026-11-12: era "shield badge with a horse head silhouette and two small stars"
  ['liga-rar-podio', 'liga-platina', 'shield badge with a horse head silhouette and three small stars', '#5fd3c8'],
  ['liga-rar-podio', 'liga-diamante', 'light blue crystal shield badge with a white horse head silhouette and a blue diamond gem on top', '#7ab8ff', { seed: 2344 }],  // refação 2026-11-12: era "shield badge with a horse head silhouette and a diamond on top"
  ['liga-rar-podio', 'liga-lenda', 'shield badge with a horse head silhouette, a crown on top and flames around it', '#ff7a3d'],
  ['liga-rar-podio', 'rar-comum', 'plain dull gray stone round medallion with a gray horse head, no sparkles', '#9e9e9e', { seed: 2346 }],  // refação 2026-11-12: era "round medallion with a horse head, plain"
  ['liga-rar-podio', 'rar-magico', 'round medallion with a horse head and two small sparkles', '#4caf50'],
  ['liga-rar-podio', 'rar-raro', 'blue round medallion with a white horse head and four small blue sparkles', '#2196f3', { seed: 2348 }],  // refação 2026-11-12: era "round medallion with a horse head and four small sparkles"
  ['liga-rar-podio', 'rar-lendario', 'orange round medallion with a white horse head, orange sparkles and a glowing orange rim', '#ff9800', { seed: 2349 }],  // refação 2026-11-12: era "round medallion with a horse head, sparkles and a glowing rim"
  ['liga-rar-podio', 'rar-mitico', 'purple round medallion with a white horse head, purple sparkles and a radiant violet aura', '#9c27b0', { seed: 2350 }],  // refação 2026-11-12: era "round medallion with a horse head, sparkles and a radiant aura"
  ['liga-rar-podio', 'podio-1', 'gold medal hanging from a ribbon', '#f2c230'],
  ['liga-rar-podio', 'podio-2', 'silver medal hanging from a ribbon', '#b8c2cc'],
  ['liga-rar-podio', 'podio-3', 'bronze medal hanging from a ribbon', '#b0703c'],
  // §2.6
  ['reservado', 'item-redea', 'coiled leather horse reins with a metal buckle', '#9a6b3f'],
  ['reservado', 'moeda-gema', 'faceted cut gemstone with a sparkle', '#5fd3c8'],
  ['reservado', 'ins-fogo', 'round pin badge with a flame emblem inside a ring', '#ff8a4c'],
  ['reservado', 'ins-agua', 'round pin badge with a water drop emblem inside a ring', '#62b8ff'],
  ['reservado', 'ins-grama', 'round pin badge with a leaf emblem inside a ring', '#86d86a'],
];

export const ICONES_NOVOS = TABELA.map(([familia, id, desc, cor, op = {}], i) => ({ id, familia, desc, cor, seed: op.seed || 2201 + i }));

// Ícones sem tela ainda (spec §2.6): só o wiki e a folha de conferência os mostram.
export const RESERVADOS = ['item-redea', 'moeda-gema', 'ins-fogo', 'ins-agua', 'ins-grama'];

// Os 16 ícones de hoje (lote `icones`).
export const ANTIGOS = [
  'aba-estabulo', 'aba-correr', 'aba-expedicao', 'aba-haras', 'aba-loja',
  'slot-ferraduras', 'slot-sela', 'slot-estribos', 'slot-testeira', 'slot-armadura',
  'moeda-ouro', 'pedra-negra', 'el-fogo', 'el-agua', 'el-grama', 'el-geral',
];
