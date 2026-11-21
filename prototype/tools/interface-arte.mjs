// prototype/tools/interface-arte.mjs — peças de pixel e fontes embutidas da interface (usado pelo build e pelos testes).
// As peças são mapas de caracteres pintados com tokens do :root do game.css; viram PNGs em data: URL nas propriedades
// --arte-<nome>, e o CSS do jogo as usa em background (sem border-image). As fontes (Galmuri, TTF) vão em data:, sem
// depender de rede.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { encodePng } from './png.mjs';

// legenda: caractere -> token (ex.: '--sombra'); '.' é sempre transparente e não entra na legenda.
// ⓘ: disco claro com o "i" vazado em --sombra (o ponto em cima, a haste de 3 pixels embaixo). Com o contorno escuro em
// volta de um quadrado claro, o "i" dividia o claro em duas colunas e a peça lia como um "H".
const AJUDA = ['..TTT..', '.TTkTT.', 'TTTTTTT', 'TTTkTTT', 'TTTkTTT', '.TTkTT.', '..TTT..'];
export const PECAS = [
  { nome: 'rebite', mapa: ['.k.', 'kYg', '.g.'], legenda: { k: '--sombra', Y: '--ouro-claro', g: '--ouro-escuro' } },
  { nome: 'prego', mapa: ['.k.', 'kSs', '.s.'], legenda: { k: '--sombra', S: '--prego-luz', s: '--prego' } },
  { nome: 'veio', mapa: [
    'wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww',
    'wwwvvvvwwwwwwwwwwwwwvvvvvwwwwwww',
    'wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww',
    'wwwwwwwwwwvvvvvvwwwwwwwwwwwwvvvw',
    'vvvwwwwwwwwwwwwwwwwvvvvwwwwwwwww',
    'wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww',
    'wwwwwvvvvvvwwwwwwwwwwwwwwvvvvwww',
    'vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv'], legenda: { w: '--madeira', v: '--madeira-2' } },
  { nome: 'ajuda', mapa: AJUDA, legenda: { k: '--sombra', T: '--texto-2' } },
  { nome: 'ajuda-ativa', mapa: AJUDA, legenda: { k: '--sombra', T: '--ouro' } },
  // ícones dos cinco itens (spec de itens §13; o jogo mostra em 32px: .item-icone--<id> no game.css), 16x16 com
  // contorno --sombra. Torrão: cubo de açúcar (topo claro, as faces em dois tons).
  { nome: 'item-torrao', mapa: [
    '................',
    '.......kk.......',
    '.....kkWWkk.....',
    '...kkWWWWWWkk...',
    '.kkWWWWWWWWWWkk.',
    'kWWWWWWWWWWWWWWk',
    'kSSWWWWWWWWWWDDk',
    'kSSSSWWWWWWDDDDk',
    'kSSSSSSWWDDDDDDk',
    'kSWSSSSSDDDDDDDk',
    'kSSSSSSSDDDWDDDk',
    'kSSSSWSSDDDDDDDk',
    '.kkSSSSSDDDDDkk.',
    '...kkSSSDDDkk...',
    '.....kkSDkk.....',
    '.......kk.......'], legenda: { k: '--sombra', W: '--texto', S: '--prata', D: '--texto-2' } },
  // Estrela de treino: estrela de cinco pontas em três ouros (claro à esquerda, escuro na borda direita)
  { nome: 'item-estrela', mapa: [
    '.......kk.......',
    '......kYOk......',
    '......kYOk......',
    '.....kYYOOk.....',
    'kkkkkYYYOOOkkkkk',
    'kYYYYYYYOOOOOOGk',
    '.kYYYYYYOOOOOGk.',
    '..kYYYYYOOOOGk..',
    '...kYYYYOOOGk...',
    '...kYYYYOOOGk...',
    '..kYYYYOOOOOGk..',
    '..kYYYkkkkOOGk..',
    '.kYYkk....kkOGk.',
    '.kYk........kGk.',
    'kkk..........kkk',
    '................'], legenda: { k: '--sombra', Y: '--ouro-claro', O: '--ouro', G: '--ouro-escuro' } },
  // Rédea nova: a volta da rédea de couro com as duas argolas de metal do freio
  { nome: 'item-redea', mapa: [
    '................',
    '....kkkkkkkk....',
    '...kMMMMMMMMk...',
    '..kMkkkkkkkkMk..',
    '..kMk......kMk..',
    '..kMk......kMk..',
    '..kNk......kNk..',
    '..kNk......kNk..',
    '.kkNkk....kkNkk.',
    'kPPPPk....kPPPPk',
    'kPkkQk....kPkkQk',
    'kPQQQk....kPQQQk',
    '.kkNk......kNkk.',
    '...kNk....kNk...',
    '....kNNNNNNk....',
    '.....kkkkkk.....'], legenda: { k: '--sombra', M: '--madeira-luz', N: '--madeira', P: '--prego-luz', Q: '--prego' } },
  // Cupom de troca de skill: o bilhete com os recortes dos lados e as duas setas da troca
  { nome: 'item-cupom', mapa: [
    '................',
    '................',
    '.kkkkkkkkkkkkkk.',
    'kTTTTTTTTTTTTTTk',
    'kTTTTTTTTWTTTTTk',
    'kTTWWWWWWWWTTTTk',
    '.kTTTTTTTWTTTTk.',
    '..kTTTTTTTTTTk..',
    '..kTTTTTTTTTTk..',
    '.kTTTWTTTTTTTTk.',
    'kTTTWWWWWWWWTTTk',
    'kTTTTWTTTTTTTTTk',
    'kttttttttttttttk',
    '.kkkkkkkkkkkkkk.',
    '................',
    '................'], legenda: { k: '--sombra', T: '--seda-7', t: '--linha', W: '--texto' } },
  // Manual de doma: o livro de capa vermelha, com a lombada, a borda das folhas e a ferradura de ouro na capa
  { nome: 'item-manual', mapa: [
    '................',
    '.kkkkkkkkkkkkkk.',
    '.kBRRRRRRRRRRRk.',
    '.kBRRRRRRRRRRRk.',
    '.kBRRRYRRRYRRRk.',
    '.kBRRRYRRRYRRRk.',
    '.kBRRRYRRRYRRRk.',
    '.kBRRRRYYYRRRRk.',
    '.kBRRRRRRRRRRRk.',
    '.kBRRRRRRRRRRRk.',
    '.kBRRRRRRRRRRRk.',
    '.kBRRRRRRRRRRRk.',
    '.kBPPPPPPPPPPPk.',
    '.kkkkkkkkkkkkkk.',
    '................',
    '................'], legenda: { k: '--sombra', B: '--madeira-2', R: '--seda-0', Y: '--ouro', P: '--texto' } }
];

// Tokens `--nome: #hex;` do primeiro bloco :root { … } (valor em #rrggbb minúsculo; o que não é hex fica de fora).
export function lerTokens(css) {
  const m = css.match(/:root\s*\{([\s\S]*?)\n\}/) || css.match(/:root\s*\{([\s\S]*?)\}/);
  const out = {};
  if (!m) return out;
  for (const t of m[1].matchAll(/(--[\w-]+)\s*:\s*#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\s*;/g)) {
    let h = t[2].toLowerCase();
    if (h.length === 3) h = [...h].map((c) => c + c).join('');
    out[t[1]] = '#' + h;
  }
  return out;
}

export function validarPeca(peca, tokens) {
  const nome = peca.nome;
  const mapa = peca.mapa || [];
  const alt = mapa.length, larg = alt ? mapa[0].length : 0;
  if (!(larg >= 1 && larg <= 64 && alt >= 1 && alt <= 64)) throw new Error(`peça "${nome}": tamanho ${larg}x${alt} fora de 1–64`);
  mapa.forEach((lin, i) => {
    if (lin.length !== larg) throw new Error(`peça "${nome}": linha ${i + 1} tem largura ${lin.length} (esperado ${larg})`);
    for (const c of lin) {
      if (c === '.') continue;
      if (!Object.prototype.hasOwnProperty.call(peca.legenda, c)) throw new Error(`peça "${nome}": linha ${i + 1} usa "${c}", que não está na legenda`);
    }
  });
  for (const [c, tok] of Object.entries(peca.legenda)) {
    if (!Object.prototype.hasOwnProperty.call(tokens, tok)) throw new Error(`peça "${nome}": o token ${tok} (legenda "${c}") não existe no :root`);
  }
}

export function validarCatalogo(pecas, tokens) {
  const vistos = new Set();
  for (const p of pecas) {
    if (vistos.has(p.nome)) throw new Error(`peça "${p.nome}": nome repetido no catálogo`);
    vistos.add(p.nome);
    validarPeca(p, tokens);
  }
}

export function pecaRgba(peca, tokens) {
  const width = peca.mapa[0].length, height = peca.mapa.length;
  const rgba = new Uint8Array(width * height * 4);
  peca.mapa.forEach((lin, y) => [...lin].forEach((c, x) => {
    if (c === '.') return;
    const h = tokens[peca.legenda[c]], i = (y * width + x) * 4;
    rgba[i] = parseInt(h.slice(1, 3), 16); rgba[i + 1] = parseInt(h.slice(3, 5), 16); rgba[i + 2] = parseInt(h.slice(5, 7), 16); rgba[i + 3] = 255;
  }));
  return { width, height, rgba };
}

export function cssArte(css) {
  const tokens = lerTokens(css);
  validarCatalogo(PECAS, tokens);
  const linhas = PECAS.map((p) => `  --arte-${p.nome}: url(data:image/png;base64,${Buffer.from(encodePng(pecaRgba(p, tokens))).toString('base64')});`);
  return ':root {\n' + linhas.join('\n') + '\n}';
}

// Galmuri (Lee Minseo, OFL 1.1; guia de arte §6), subconjunto latino em TTF: uma família por arquivo (o negrito é uma
// família própria, para o navegador nunca sintetizar nem trocar de arquivo pelo peso)
const FONTES = [
  { familia: 'Galmuri11 Bold', arquivo: 'galmuri11-bold-latin.ttf' },
  { familia: 'Galmuri11', arquivo: 'galmuri11-latin.ttf' },
  { familia: 'Galmuri9', arquivo: 'galmuri9-latin.ttf' },
  { familia: 'Galmuri7', arquivo: 'galmuri7-latin.ttf' }
];

// root = a pasta prototype/. Embutidas: o jogo abre sem rede e sem piscar de fonte.
export async function cssFontes(root) {
  const faces = [];
  for (const f of FONTES) {
    const b64 = (await readFile(join(root, 'assets', 'fontes', f.arquivo))).toString('base64');
    faces.push(`@font-face {\n  font-family: '${f.familia}';\n  font-style: normal;\n  font-weight: 400;\n  font-display: block;\n  src: url(data:font/ttf;base64,${b64}) format('truetype');\n}`);
  }
  return faces.join('\n');
}
