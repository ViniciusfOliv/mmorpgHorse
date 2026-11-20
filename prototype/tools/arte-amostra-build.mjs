// prototype/tools/arte-amostra-build.mjs — monta prototype/arte/corrida-amostra.html, a amostra da direção de arte
// (docs/arte/guia.md), autocontida: embute em data: URI as camadas escolhidas, os moldes de galope dos cavalos, as
// três fontes Galmuri e a captura atual da corrida (prototype/screens/final-06-corrida.png), para comparar.
// Não lê nem escreve nada em prototype/src/ ou prototype/dist/.   Uso: node prototype/tools/arte-amostra-build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ } from './pixellab-comum.mjs';

const ARTE = path.join(RAIZ, 'prototype', 'assets', 'arte');
const uri = (f, tipo = 'image/png') => `data:${tipo};base64,${fs.readFileSync(f).toString('base64')}`;
// as camadas escolhidas (docs/memoria/assets.md, 2026-11-20)
const camadas = {
  chapadas: 'emendas/chapadas-pl-pixen-s7301-0-emenda-s7402-0.png',
  cerrado: 'emendas/cerrado-rd-core-s7201-0-emenda-s7401-0.png',
  frente: 'emendas/frente-rd-core-s7201-1-emenda-s7403-0.png',
  nuvens: 'camadas/nuvens-rd-plus-s7501-1.png',
  arquibancada: 'camadas/arquibancada-rd-core-s7601-1.png',
};
const moldes = {};
for (const k of ['padrao-chamas', 'esguio-ondas', 'robusto-folhas', 'padrao-ondas', 'robusto-chamas', 'esguio-folhas']) {
  const dir = path.join(RAIZ, 'prototype', 'assets', 'pixellab');
  const j = JSON.parse(fs.readFileSync(path.join(dir, `molde-${k}.json`), 'utf8'));
  moldes[k] = { ancoras: j.ancoras, galope: Array.from({ length: 9 }, (_, i) => uri(path.join(dir, `molde-${k}-galope-${i}.png`))) };
}
const dados = {
  camadas: Object.fromEntries(Object.entries(camadas).map(([k, f]) => [k, uri(path.join(ARTE, f))])),
  moldes,
};
const F = path.join(RAIZ, 'prototype', 'assets', 'fontes');
let html = fs.readFileSync(path.join(RAIZ, 'prototype', 'arte', 'amostra.html'), 'utf8');
const js = fs.readFileSync(path.join(RAIZ, 'prototype', 'arte', 'amostra.js'), 'utf8');
const troca = (marca, valor) => { if (!html.includes(marca)) throw new Error('falta ' + marca); html = html.split(marca).join(valor); };
troca('/*__G7__*/', uri(path.join(F, 'galmuri7-latin.ttf'), 'font/ttf'));
troca('/*__G9__*/', uri(path.join(F, 'galmuri9-latin.ttf'), 'font/ttf'));
troca('/*__G11__*/', uri(path.join(F, 'galmuri11-bold-latin.ttf'), 'font/ttf'));
troca('/*__CAPTURA__*/', uri(path.join(RAIZ, 'prototype', 'screens', 'final-06-corrida.png')));
troca('/*__ARTE__*/', JSON.stringify(dados));
troca('/*__JS__*/', js);
const saida = path.join(RAIZ, 'prototype', 'arte', 'corrida-amostra.html');
fs.writeFileSync(saida, html);
console.log(`${path.relative(RAIZ, saida)}: ${(html.length / 1024).toFixed(0)} KB`);
