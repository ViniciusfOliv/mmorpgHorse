// prototype/tools/icones16-mapas.mjs — ícones pequenos (16 × 16) desenhados em código, pixel a pixel (plano da direção
// de arte, etapa 4; decisão do Vinicius em 2026-11-20: em 16 × 16 a IA sozinha não chega à qualidade, os simples são
// desenhados à mão em mapas, com a versão do PixelLab como rascunho; os complexos vão para 24 × 24 pelo /resize).
// Regras do guia: só cores da Resurrect 64, contorno de 1 px em 2e222f, luz de cima e da esquerda (brilho em cima à
// esquerda, sombra embaixo à direita), sem alfa parcial.
// Uso: node prototype/tools/icones16-mapas.mjs → prototype/assets/arte/icones16/<id>.png
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePng } from './png.mjs';

// letra → cor (Resurrect 64); '.' é transparente
export const CORES = {
  K: '2e222f', W: 'ffffff', L: 'c7dcd0', l: '9babb2', d: '625565',
  o: 'fbff86', y: 'fbb954', Y: 'f9c22b', O: 'f79617', R: 'cd683d',           // ouro: brilho → sombra
  F: 'fb6b1d', f: 'ea4f36', v: 'ae2334',                                       // fogo
  s: '8fd3ff', c: '4d9be6', b: '4d65b4', n: '323353',                          // água
  h: '91db69', m: '1ebc73', g: '239063', G: '165a4c',                          // grama
  p: 'f68181', r: 'e83b3b', x: 'ae2334',                                       // coração
};

export const MAPAS = {
  'moeda-ouro': [
    '................',
    '.....KKKKKK.....',
    '...KKyyyyyyKK...',
    '..KyyyyYYYYYOK..',
    '.KyyYYYYYYYYYOK.',
    '.KyYYYOOOOYYYOK.',
    '.KyYYOyYYYOYYOK.',
    '.KYYYOYYYYOYYOK.',
    '.KYYYOYYYYOYOOK.',
    '.KYYYOYYYYOYOOK.',
    '.KYYYYOOOOYYOOK.',
    '.KYYYYYYYYYOOOK.',
    '..KOYYYYYYOOOK..',
    '...KKOOOOOOKK...',
    '.....KKKKKK.....',
    '................',
  ],
  'el-fogo': [
    '.......K........',
    '......KFK.......',
    '......KFFK......',
    '.....KFFFK......',
    '.....KFYFFK.....',
    '....KFFYYFFK....',
    '....KFYYoYFFK...',
    '...KFFYooYYFK...',
    '...KFYYoooYFFK..',
    '..KFFYooWoYYFK..',
    '..KFYYooooYYFK..',
    '..KfFYYooYYFfK..',
    '..KffFYYYYFffK..',
    '...KffFFFFffK...',
    '....KKffffKK....',
    '......KKKK......',
  ],
  'el-agua': [
    '.......KK.......',
    '......KssK......',
    '......KscK......',
    '.....KsccK......',
    '.....KscccK.....',
    '....KsWcccbK....',
    '....KsWccccK....',
    '...KsWccccccK...',
    '...KsWcccccbK...',
    '..KsWcccccccbK..',
    '..KscccccccbbK..',
    '..KsccccccbbbK..',
    '...KcccccbbbK...',
    '....KbbbbbbK....',
    '.....KKKKKK.....',
    '................',
  ],
  'el-grama': [
    '................',
    '..........KKK...',
    '.......KKKhhK...',
    '.....KKhhhhmK...',
    '....KhhhhhmmK...',
    '...KhhhhmmmgK...',
    '...KhhhmmgmgK...',
    '..KhhhmmgmmgK...',
    '..KhhmmgmmgK....',
    '..KhmmgmmggK....',
    '..KhmgmmggK.....',
    '...KgmmggK......',
    '...KgggKK.......',
    '..KGKKK.........',
    '.KGK............',
    '.KK.............',
  ],
  'st-vel': [
    '.........KKKK...',
    '........KoyYK...',
    '.......KoyYK....',
    '......KoyYK.....',
    '.....KoyYK......',
    '....KoyYYKKKK...',
    '...KoyYYYYYOK...',
    '...KKKKyYYOK....',
    '......KyYOK.....',
    '.....KyYOK......',
    '....KyYOK.......',
    '...KyYOK........',
    '...KYOK.........',
    '..KYOK..........',
    '..KOK...........',
    '..KK............',
  ],
  'ui-dado': [
    '................',
    '..KKKKKKKKKKKK..',
    '.KWWWWWWWWWWLLK.',
    '.KWKKWWWWWWWLlK.',
    '.KWKKWWWWWWWLlK.',
    '.KWWWWWWWWWWLlK.',
    '.KWWWWWKKWWWLlK.',
    '.KWWWWWKKWWWLlK.',
    '.KWWWWWWWWWWLlK.',
    '.KWWWWWWWWKKLlK.',
    '.KWWWWWWWWKKLlK.',
    '.KWWWWWWWWWWLlK.',
    '.KLLLLLLLLLLLlK.',
    '.KllllllllllllK.',
    '..KKKKKKKKKKKK..',
    '................',
  ],
  'ui-estrela': [
    '.......K........',
    '......KoK.......',
    '......KoK.......',
    '.....KoYYK......',
    'KKKKKKoYYKKKKKK.',
    'KoooooyYYYYYYOK.',
    '.KoyYYYYYYYYOK..',
    '..KyYYYYYYYOK...',
    '...KYYYYYYOK....',
    '...KYYYYYYOK....',
    '..KYYYOKOYYOK...',
    '..KYYOK.KOYOK...',
    '.KYYOK...KOYOK..',
    '.KYOK.....KOOK..',
    '.KKK.......KKK..',
    '................',
  ],
  'st-est': [
    '................',
    '..KKKK...KKKK...',
    '.KpprrK.KrrrrK..',
    'KpWprrrKrrrrrxK.',
    'KpprrrrrrrrrrxK.',
    'KprrrrrrrrrrrxK.',
    'KrrrrWrrrrrrrxK.',
    'KrrrWrWrrWrrxxK.',
    'KWWWrrrWWrWWWWK.',
    '.KrrrrrrWrrrxK..',
    '..KrrrrrrrrxK...',
    '...KrrrrrrxK....',
    '....KrrrrxK.....',
    '.....KrrxK......',
    '......KxK.......',
    '.......K........',
  ],
};

// mapa → { width, height, rgba }; confere o tamanho e as letras
export function desenhar(id) {
  const m = MAPAS[id];
  if (!m || m.length !== 16 || m.some(l => l.length !== 16)) throw new Error(`${id}: o mapa tem de ter 16 linhas de 16 letras`);
  const rgba = new Uint8Array(16 * 16 * 4);
  m.forEach((linha, y) => [...linha].forEach((ch, x) => {
    if (ch === '.') return;
    const h = CORES[ch];
    if (!h) throw new Error(`${id}: letra desconhecida "${ch}" em ${x},${y}`);
    rgba.set([parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 255], (y * 16 + x) * 4);
  }));
  return { width: 16, height: 16, rgba };
}

if (process.argv[1] && process.argv[1].endsWith('icones16-mapas.mjs')) {
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'arte', 'icones16');
  fs.mkdirSync(dir, { recursive: true });
  for (const id of Object.keys(MAPAS)) { fs.writeFileSync(path.join(dir, id + '.png'), encodePng(desenhar(id))); console.log('  ' + id); }
}
