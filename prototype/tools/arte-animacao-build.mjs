// prototype/tools/arte-animacao-build.mjs — monta prototype/arte/animacao-amostra.html, a amostra da animação
// ambiente (entrega 1 da frente de animação, 2026-11-23): o molde prototype/arte/animacao.html com o motor
// prototype/arte/animacao.js e, em data: URI, as imagens que ele anima (camadas do Litoral, arena da Fornalha, cenas da
// Expedição e do Haras), os moldes dos cavalos (retrato e parado, com as âncoras) e a Nunito da interface.
// Não lê nem escreve nada em prototype/src/ ou prototype/dist/; não gasta crédito.
// Uso: node prototype/tools/arte-animacao-build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ } from './pixellab-comum.mjs';

const ARTE = path.join(RAIZ, 'prototype', 'assets', 'arte');
const PIX = path.join(RAIZ, 'prototype', 'assets', 'pixellab');
const FONTES = path.join(RAIZ, 'prototype', 'assets', 'fontes');
const uri = (f, tipo = 'image/png') => `data:${tipo};base64,${fs.readFileSync(f).toString('base64')}`;

const manifesto = JSON.parse(fs.readFileSync(path.join(ARTE, 'regioes.json'), 'utf8'));
const imagens = {};
for (const c of ['nuvens', 'horizonte', 'meio', 'arquibancada', 'frente']) imagens['litoral/' + c] = uri(path.join(ARTE, 'litoral', c + '.png'));
imagens['ginasios/fogo'] = uri(path.join(ARTE, 'ginasios', 'finais', 'fogo.png'));
imagens['telas/expedicao'] = uri(path.join(ARTE, 'telas', 'finais', 'cena-expedicao.png'));
imagens['telas/haras'] = uri(path.join(ARTE, 'telas', 'finais', 'cena-haras.png'));

const moldes = {};
const TODOS = ['esguio', 'padrao', 'robusto'].flatMap(p => ['lisa', 'chamas', 'ondas', 'folhas'].map(c => `${p}-${c}`));
for (const k of TODOS) {
  const j = JSON.parse(fs.readFileSync(path.join(PIX, `molde-${k}.json`), 'utf8'));
  moldes[k] = {
    ancoras: { retrato: j.ancoras.retrato, parado: j.ancoras.parado },
    png: { retrato: uri(path.join(PIX, `molde-${k}-retrato.png`)), parado: uri(path.join(PIX, `molde-${k}-parado.png`)) }
  };
}
// o piloto e o lote pago do idle (prototype/tools/arte-animacao-piloto.mjs): quadros em papéis (cinza), por molde e
// ação-seed; do lote, só a seed escolhida (escolhas-todos.json)
const piloto = {};
const DIR_IDLE = path.join(PIX, 'idle');
const escolhas = fs.existsSync(path.join(DIR_IDLE, 'escolhas-todos.json')) ? JSON.parse(fs.readFileSync(path.join(DIR_IDLE, 'escolhas-todos.json'), 'utf8')) : {};
if (fs.existsSync(DIR_IDLE)) for (const f of fs.readdirSync(DIR_IDLE).sort()) {
  const m = /^([a-z]+-[a-z]+)-retrato-(\w+)-s(\d+)-(\d+)\.png$/.exec(f); if (!m) continue;
  const [, molde, acao, seed, q] = m;
  if (molde !== 'padrao-lisa' && !(escolhas[molde] && escolhas[molde][acao] && String(escolhas[molde][acao].seed) === seed)) continue;
  ((piloto[molde] ||= {})[`${acao}-${seed}`] ||= [])[+q] = uri(path.join(DIR_IDLE, f));
}
const dados = { imagens, moldes, piloto, regioes: { litoral: { posicao: manifesto.litoral.posicao || {} } } };

let html = fs.readFileSync(path.join(RAIZ, 'prototype', 'arte', 'animacao.html'), 'utf8');
const js = fs.readFileSync(path.join(RAIZ, 'prototype', 'arte', 'animacao.js'), 'utf8');
const troca = (marca, valor) => { if (!html.includes(marca)) throw new Error('falta ' + marca); html = html.split(marca).join(valor); };
troca('/*__N600__*/', uri(path.join(FONTES, 'nunito-latin-600-normal.woff2'), 'font/woff2'));
troca('/*__N800__*/', uri(path.join(FONTES, 'nunito-latin-800-normal.woff2'), 'font/woff2'));
troca('/*__DADOS__*/', JSON.stringify(dados));
troca('/*__JS__*/', js);
const saida = path.join(RAIZ, 'prototype', 'arte', 'animacao-amostra.html');
fs.writeFileSync(saida, html);
console.log(`${path.relative(RAIZ, saida)}: ${(html.length / 1024).toFixed(0)} KB`);
