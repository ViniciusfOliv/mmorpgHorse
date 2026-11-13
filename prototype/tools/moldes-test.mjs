// prototype/tools/moldes-test.mjs — node prototype/tools/moldes-test.mjs
// Testes do codec PNG e da normalização/validação dos moldes (sem rede).
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng, encodeGray } from './png.mjs';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { ICONES_NOVOS, FAMILIAS, RESERVADOS, ANTIGOS } from './icones-catalogo.mjs';
import { htmlFolhaIcones } from './folha-icones.mjs';
import { PAPEIS, paletaPng, normalizar, validar, ancoras, paraCinza, deCinza, sombrearRegioes, limparJoquei, limiarOtsu, classificarFamilias, limiaresDeTons, posProcessar, contornar, passada } from './moldes-lib.mjs';

let fails = 0, count = 0;
function section(t) { console.log('\n## ' + t); }
function test(name, fn) {
  count++;
  try { fn(); console.log('  ok  ' + name); }
  catch (e) { fails++; console.log('  FALHA ' + name + '\n       ' + (e.message || e)); }
}

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'pixellab');

function hex(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
// Monta um RGBA a partir de uma matriz de índices (0 = transparente).
function rgbaDeIdx(idx, w, h) {
  const out = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    if (!idx[i]) continue;
    const c = hex(PAPEIS[idx[i]]);
    out[i * 4] = c[0]; out[i * 4 + 1] = c[1]; out[i * 4 + 2] = c[2]; out[i * 4 + 3] = 255;
  }
  return out;
}
// Cavalo sintético 20x20: corpo 2/3, cabeça 4, jóquei 7/8, sela 9, contorno 1 em volta (sem buracos).
function cavaloIdx(comJoquei) {
  const w = 20, h = 20, idx = new Uint8Array(w * h);
  const set = (x, y, v) => { idx[y * w + x] = v; };
  for (let y = 6; y <= 13; y++) for (let x = 4; x <= 15; x++) set(x, y, (x + y) % 2 ? 2 : 3);
  for (let y = 4; y <= 7; y++) for (let x = 14; x <= 17; x++) set(x, y, 4);
  set(9, 6, 9); set(10, 6, 9);
  if (comJoquei) { set(9, 4, 7); set(10, 4, 7); set(9, 5, 8); set(10, 5, 8); }
  for (let y = 14; y <= 17; y++) set(6, y, 1);
  set(7, 17, 1);
  return { idx, w, h };
}

section('codec PNG');
test('encodePng/decodePng ida e volta (RGBA)', () => {
  const w = 5, h = 3, rgba = new Uint8Array(w * h * 4);
  for (let i = 0; i < rgba.length; i++) rgba[i] = (i * 37 + 11) & 255;
  const d = decodePng(encodePng({ width: w, height: h, rgba }));
  assert.strictEqual(d.width, w); assert.strictEqual(d.height, h);
  assert.deepStrictEqual(Array.from(d.rgba), Array.from(rgba));
});
test('encodeGray/decodePng ida e volta (cinza vira RGBA com R=G=B)', () => {
  const w = 4, h = 4, data = new Uint8Array(w * h);
  for (let i = 0; i < data.length; i++) data[i] = i * 15;
  const d = decodePng(encodeGray({ width: w, height: h, data }));
  assert.strictEqual(d.rgba.length, w * h * 4);
  for (let i = 0; i < data.length; i++) {
    assert.deepStrictEqual([d.rgba[i * 4], d.rgba[i * 4 + 1], d.rgba[i * 4 + 2], d.rgba[i * 4 + 3]], [data[i], data[i], data[i], 255]);
  }
});
test('decodePng lê um PNG real do PixelLab (64x64 RGBA)', () => {
  const d = decodePng(fs.readFileSync(path.join(DIR, 'raw', 'chamas-retrato-s1101.png')));
  assert.strictEqual(d.width, 64); assert.strictEqual(d.height, 64);
  assert.strictEqual(d.rgba.length, 64 * 64 * 4);
  let opacos = 0; for (let i = 3; i < d.rgba.length; i += 4) if (d.rgba[i] > 0) opacos++;
  assert.ok(opacos > 100, 'deveria ter pixels opacos');
});
test('decodePng recusa dado que não é PNG', () => {
  assert.throws(() => decodePng(Buffer.from('nao sou um png de jeito nenhum')), /PNG/);
});
test('paletaPng é um PNG 9x1 com as 9 cores', () => {
  const d = decodePng(paletaPng());
  assert.strictEqual(d.width, 9); assert.strictEqual(d.height, 1);
  for (let i = 0; i < 9; i++) assert.deepStrictEqual(Array.from(d.rgba.slice(i * 4, i * 4 + 3)), hex(PAPEIS[i + 1]));
});

section('normalização e validação');
test('PAPEIS tem 10 entradas (índice 0 nulo)', () => {
  assert.strictEqual(PAPEIS.length, 10); assert.strictEqual(PAPEIS[0], null);
});
test('normalizar exato: só cores da paleta ⇒ 0 aproximados', () => {
  const { idx, w, h } = cavaloIdx(true);
  const q = normalizar(rgbaDeIdx(idx, w, h), w, h);
  assert.strictEqual(q.aproximados, 0);
  assert.deepStrictEqual(Array.from(q.idx), Array.from(idx));
  assert.deepStrictEqual([...q.papeis].sort((a, b) => a - b), [1, 2, 3, 4, 7, 8, 9]);
});
test('normalizar: alfa < 128 vira 0 e cor próxima vira o papel mais perto (conta aproximado)', () => {
  const rgba = new Uint8Array([255, 0, 0, 100, 250, 10, 5, 255]);
  const q = normalizar(rgba, 2, 1);
  assert.deepStrictEqual(Array.from(q.idx), [0, 2]); assert.strictEqual(q.aproximados, 1);
});
test('cavalo sintético válido passa (retrato sem jóquei e com jóquei)', () => {
  const a = cavaloIdx(false), b = cavaloIdx(true);
  assert.deepStrictEqual(validar(normalizar(rgbaDeIdx(a.idx, a.w, a.h), a.w, a.h), { exigeJoquei: false }), { ok: true });
  assert.deepStrictEqual(validar(normalizar(rgbaDeIdx(b.idx, b.w, b.h), b.w, b.h), { exigeJoquei: true }), { ok: true });
});
test('5% de pixels ruidosos ⇒ rejeita com "fora da paleta"', () => {
  const { idx, w, h } = cavaloIdx(true);
  const rgba = rgbaDeIdx(idx, w, h);
  let ruido = 0, opacos = 0;
  for (let i = 0; i < w * h; i++) if (rgba[i * 4 + 3]) opacos++;
  const alvo = Math.ceil(opacos * 0.05);
  for (let i = 0; i < w * h && ruido < alvo; i++) {
    if (!rgba[i * 4 + 3] || idx[i] === 9) continue;
    if (i % 3) continue;
    rgba[i * 4] = 100; rgba[i * 4 + 1] = 90; rgba[i * 4 + 2] = 80; ruido++;
  }
  assert.ok(ruido / opacos > 0.02);
  const q = normalizar(rgba, w, h);
  assert.ok(q.aproximados > 0);
  const r = validar(q, { exigeJoquei: true });
  assert.strictEqual(r.ok, false); assert.match(r.motivo, /fora da paleta/);
});
test('sem papel 7 com exigeJoquei ⇒ rejeita com "faltam papéis"', () => {
  const { idx, w, h } = cavaloIdx(false);
  const r = validar(normalizar(rgbaDeIdx(idx, w, h), w, h), { exigeJoquei: true });
  assert.strictEqual(r.ok, false); assert.match(r.motivo, /faltam papéis/); assert.match(r.motivo, /7/);
});
test('silhueta com muitos buracos de transparência cercados por 2/3 ⇒ "silhueta aberta"', () => {
  const { idx, w, h } = cavaloIdx(true);
  // fura 6 pixels isolados dentro do corpo (cercados por 2/3)
  [[6, 8], [8, 10], [10, 8], [12, 10], [6, 12], [12, 12]].forEach(([x, y]) => { idx[y * w + x] = 0; });
  const r = validar(normalizar(rgbaDeIdx(idx, w, h), w, h), { exigeJoquei: true });
  assert.strictEqual(r.ok, false); assert.match(r.motivo, /silhueta aberta/);
});
test('até 4 buracos ainda é aceito', () => {
  const { idx, w, h } = cavaloIdx(true);
  [[6, 8], [8, 10], [10, 8], [12, 10]].forEach(([x, y]) => { idx[y * w + x] = 0; });
  assert.strictEqual(validar(normalizar(rgbaDeIdx(idx, w, h), w, h), { exigeJoquei: true }).ok, true);
});

section('âncoras e cinza');
test('ancoras numa forma retangular conhecida', () => {
  const w = 12, h = 12, idx = new Uint8Array(w * h);
  for (let y = 3; y <= 8; y++) for (let x = 2; x <= 9; x++) idx[y * w + x] = 2;
  idx[5 * w + 4] = 9; idx[5 * w + 6] = 9;
  const a = ancoras(idx, w, h);
  assert.deepStrictEqual(a.bbox, { x: 2, y: 3, w: 8, h: 6 });
  assert.strictEqual(a.footY, 8);
  // metade superior: linhas 3..6 (3 + floor(6/2)); mais à direita x=9 (empate ⇒ topo, y=3); mais à esquerda x=2, y=3
  assert.deepStrictEqual(a.nose, [9, 3]);
  assert.deepStrictEqual(a.rear, [2, 3]);
  assert.deepStrictEqual(a.saddle, [5, 5]);
});
test('ancoras sem papel 9 ⇒ saddle null', () => {
  const w = 4, h = 4, idx = new Uint8Array(w * h); idx[5] = 2; idx[6] = 2;
  assert.strictEqual(ancoras(idx, w, h).saddle, null);
});
test('passada numa forma conhecida: pernas contam (até a perna só de contorno), cauda não', () => {
  // 30×20: corpo 8..22 × 4..9; bbox y 2..17 (h 16) ⇒ terço de baixo = 5 linhas (13..17)
  const w = 30, h = 20, idx = new Uint8Array(w * h);
  const set = (x, y, v) => { idx[y * w + x] = v; };
  for (let y = 4; y <= 9; y++) for (let x = 8; x <= 22; x++) set(x, y, 2);
  set(15, 2, 7); set(15, 3, 7);                                              // jóquei (topo do bbox)
  for (let y = 10; y <= 15; y++) set(9, y, 3);                               // perna de trás (pelagem)…
  set(8, 16, 1); set(7, 16, 1); set(6, 17, 1); set(5, 17, 1);                // …que termina fina, só contorno
  for (let y = 10; y <= 14; y++) set(21, y, 2);                              // perna da frente…
  set(22, 15, 1); set(23, 16, 1); set(24, 17, 6); set(25, 17, 6);            // …até o casco (6)
  for (let y = 5; y <= 14; y++) for (let x = 1; x <= 3; x++) set(x, y, 4);   // cauda (crina) descendo até a faixa
  set(0, 15, 1); set(0, 16, 1);                                              // ponta escura da cauda, sem pelagem
  assert.strictEqual(ancoras(idx, w, h).bbox.h, 16);
  assert.strictEqual(passada(idx, w, h), 25 - 5, 'do casco de trás (x 5) ao da frente (x 25); a cauda (x 0–3) fica fora');
  assert.strictEqual(passada(new Uint8Array(w * h), w, h), 0, 'quadro vazio');
});
test('paraCinza/deCinza ida e volta', () => {
  const idx = Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const g = paraCinza(idx);
  assert.strictEqual(g[9], 225);
  assert.deepStrictEqual(Array.from(deCinza(g)), Array.from(idx));
  const ruidoso = Uint8Array.from(Array.from(g).map(v => Math.min(255, v + 4)));
  assert.deepStrictEqual(Array.from(deCinza(ruidoso)), Array.from(idx));
});

section('pós-processamento (cores livres → papéis)');
test('sombrearRegioes: terço de baixo de cada corrida vertical vira sombra; regioes limita as famílias', () => {
  // coluna 0: pelagem 3 ×6 ⇒ 2,2,2,2,3,3; coluna 1: pelagem ×2 ⇒ 2,2 (sem sombra); coluna 2: crina 5 ×3 ⇒ 4,4,5
  const w = 3, h = 6, idx = new Uint8Array(w * h);
  for (let y = 0; y < 6; y++) idx[y * w] = 3;
  idx[1] = 3; idx[w + 1] = 2; idx[2 * w + 1] = 1;
  for (let y = 0; y < 3; y++) idx[y * w + 2] = 5;
  const r = sombrearRegioes(idx, w, h);
  const col = (q, x) => Array.from({ length: h }, (_, y) => q[y * w + x]);
  assert.deepStrictEqual(col(r.idx, 0), [2, 2, 2, 2, 3, 3]);
  assert.deepStrictEqual(col(r.idx, 1), [2, 2, 1, 0, 0, 0]);
  assert.deepStrictEqual(col(r.idx, 2), [4, 4, 5, 0, 0, 0]);
  assert.strictEqual(r.alterados, 4 + 1 + 2);
  assert.strictEqual(idx[0], 3, 'não altera a entrada');
  const so = sombrearRegioes(idx, w, h, { regioes: [4] });
  assert.deepStrictEqual(col(so.idx, 0), [3, 3, 3, 3, 3, 3], 'pelagem fora das regiões fica como está');
});
test('limparJoquei no retrato: 7/8/9 viram o vizinho não-jóquei mais comum (desempate 4, 2, 6, 1)', () => {
  const w = 3, h = 3;
  const a = Uint8Array.from([4, 4, 4, 4, 7, 2, 2, 2, 2]); // 4 ×4, 2 ×4 ⇒ empate ⇒ 4
  assert.deepStrictEqual(Array.from(limparJoquei(a, w, h).idx), [4, 4, 4, 4, 4, 2, 2, 2, 2]);
  const b = Uint8Array.from([2, 2, 2, 2, 9, 9, 2, 6, 1]); // os dois 9 veem mais vizinhos 2 do que 6/1 ⇒ 2
  const rb = limparJoquei(b, w, h);
  assert.deepStrictEqual(Array.from(rb.idx), [2, 2, 2, 2, 2, 2, 2, 6, 1]);
  assert.strictEqual(rb.remapeados, 2);
});
test('limparJoquei com jóquei: fica o maior grupo, os a ≤ 2 px e o cinza a ≤ 4 px', () => {
  const caso = linha => limparJoquei(Uint8Array.from(linha), linha.length, 1, { comJoquei: true });
  const fim = linha => { const r = caso(linha); return [r.idx[linha.length - 1], r.remapeados]; };
  assert.deepStrictEqual(fim([7, 7, 7, 2, 8]), [8, 0], 'pele a 2 px fica');
  assert.deepStrictEqual(fim([7, 7, 7, 2, 2, 8]), [2, 1], 'pele a 3 px sai');
  assert.deepStrictEqual(fim([7, 7, 7, 2, 2, 2, 9]), [9, 0], 'sela (cinza) a 4 px fica');
  assert.deepStrictEqual(fim([7, 7, 7, 2, 2, 2, 2, 9]), [2, 1], 'cinza a 5 px ao lado sai');
  assert.deepStrictEqual(fim([7, 7, 7, 2, 8, 2, 7]), [7, 0], 'em cadeia: capacete a 2 px do rosto, que está a 2 px da seda');
  assert.deepStrictEqual(fim([7, 7, 7, 2, 8, 2, 2, 7]), [2, 1], 'a 3 px do último da cadeia sai');
  // cinza 6 linhas abaixo da seda (sela sob a calça) fica; o mesmo cinza deslocado para o lado sai
  const w = 10, h = 8, base = new Uint8Array(w * h).fill(2);
  base[1] = base[2] = base[3] = 7;
  const sob = Uint8Array.from(base); sob[6 * w + 2] = sob[6 * w + 3] = 9;
  assert.strictEqual(limparJoquei(sob, w, h, { comJoquei: true }).idx[6 * w + 2], 9, 'sela embaixo fica');
  const lado = Uint8Array.from(base); lado[6 * w + 8] = lado[6 * w + 9] = 9;
  assert.strictEqual(limparJoquei(lado, w, h, { comJoquei: true }).idx[6 * w + 8], 2, 'cinza fora da faixa sai');
});
test('limiarOtsu separa dois grupos e devolve -1 sem contraste', () => {
  const t = limiarOtsu([10, 12, 10, 200, 210]);
  assert.ok(t >= 12 && t < 200, 't = ' + t);
  assert.strictEqual(limiarOtsu([90, 90, 90]), -1);
});
test('classificarFamilias: famílias de cor ⇒ papéis; matiz sem família conta como aproximado', () => {
  // … roxo/magenta = sombra da seda (7); ciano = crina (4); laranja fica entre famílias ⇒ aproximado (amarelo)
  const cores = ['#101010', '#ff2020', '#801010', '#20e020', '#107010', '#2030ff', '#ffe020', '#ffc0cb', '#808080', '#af0785', '#00e0e0', '#ff8000'];
  const rgba = new Uint8Array(cores.length * 4);
  cores.forEach((c, i) => { rgba.set(hex(c), i * 4); rgba[i * 4 + 3] = 255; });
  const q = classificarFamilias(rgba, cores.length, 1);
  assert.deepStrictEqual(Array.from(q.idx), [1, 2, 2, 4, 4, 6, 7, 8, 9, 7, 4, 7]);
  assert.strictEqual(q.aproximados, 1); assert.strictEqual(q.opacos, 12);
});
test('limiaresDeTons usa todos os quadros juntos; lado < 10% ⇒ procedural', () => {
  const f = (vals, papel) => ({ idx: Uint8Array.from(vals.map(() => papel)), lum: Float32Array.from(vals) });
  // pelagem: 6 escuros num quadro e 4 claros no outro ⇒ um limiar só para os dois quadros
  const t = limiaresDeTons([f([40, 42, 41, 40, 43, 41], 2), f([180, 182, 181, 179], 2)]);
  assert.ok(t.pelagem.limiar >= 43 && t.pelagem.limiar < 179, 'limiar ' + t.pelagem.limiar);
  assert.strictEqual(t.pelagem.procedural, false);
  assert.strictEqual(t.crina.procedural, true, 'sem crina ⇒ procedural');
  const d = limiaresDeTons([f([100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 30], 4)]);
  assert.strictEqual(d.crina.procedural, true, '1 de 13 na sombra (< 10%)');
});
test('contornar fecha a borda só onde falta contorno', () => {
  // 5×5: bloco 3×3 de pelagem no centro, com a coluna da esquerda já contornada (1)
  const w = 5, h = 5, idx = new Uint8Array(w * h);
  for (let y = 1; y <= 3; y++) { idx[y * w + 1] = 1; idx[y * w + 2] = 2; idx[y * w + 3] = 2; }
  const r = contornar(idx, w, h);
  assert.strictEqual(r.adicionados, 2 + 2 + 3, 'em cima (2), embaixo (2) e à direita (3); nada à esquerda do contorno');
  assert.strictEqual(r.idx[0 * w + 2], 1); assert.strictEqual(r.idx[2 * w + 4], 1); assert.strictEqual(r.idx[2 * w + 0], 0);
});
test('posProcessar: Otsu na família equilibrada, procedural na desequilibrada', () => {
  // coluna 0: pelagem com lum 200,200,60 (sombra pelo limiar); coluna 1: crina toda lum 120 (procedural)
  const w = 2, h = 3, fam = { idx: Uint8Array.from([2, 4, 2, 4, 2, 4]), lum: Float32Array.from([200, 120, 200, 120, 60, 120]), aproximados: 0, opacos: 6, w, h };
  const r = posProcessar(fam, { pelagem: { limiar: 100, procedural: false }, crina: { limiar: -1, procedural: true } });
  assert.deepStrictEqual(Array.from(r.idx), [2, 4, 2, 4, 3, 5]);
  assert.deepStrictEqual([...r.papeis].sort(), [2, 3, 4, 5]); assert.strictEqual(r.sombreados, 1);
  assert.strictEqual(r.contornados, 0, 'sem pixel transparente, nada a contornar');
});

test('posProcessar sem contorno (retrato/parado) mantém a regra de silhueta: buraco 4×4 na pelagem é rejeitado', () => {
  // moldura de contorno 12×10 com pelagem (claro em cima, sombra embaixo), crina na 1ª linha e um buraco 4×4
  const w = 14, h = 12, idx = new Uint8Array(w * h), lum = new Float32Array(w * h);
  for (let y = 1; y <= 10; y++) for (let x = 1; x <= 12; x++) {
    const i = y * w + x, borda = y === 1 || y === 10 || x === 1 || x === 12;
    idx[i] = borda ? 1 : 2; lum[i] = borda ? 10 : (y < 6 ? 200 : 80);
  }
  for (let x = 2; x <= 4; x++) { idx[2 * w + x] = 4; lum[2 * w + x] = 150; }
  for (let y = 4; y <= 7; y++) for (let x = 6; x <= 9; x++) idx[y * w + x] = 0;
  const fam = { idx, lum, aproximados: 0, opacos: idx.filter(v => v).length, w, h };
  const tons = limiaresDeTons([fam]);
  const r = validar(posProcessar(fam, tons), { exigeJoquei: false });
  assert.strictEqual(r.ok, false); assert.match(r.motivo, /silhueta aberta/);
  assert.strictEqual(validar(posProcessar(fam, tons, { contorno: true }), { exigeJoquei: false }).ok, true,
    'com contorno (só no montado/galope) o buraco vira borda — por isso ele não vale para retrato e parado');
});
test('magenta que a limpeza tira do jóquei conta como aproximado', () => {
  const cores = ['#ff2020', '#ff2020', '#ff2020', '#ff2020', '#af0785', '#ff2020', '#ff2020', '#ff2020', '#ff2020'];
  const rgba = new Uint8Array(cores.length * 4);
  cores.forEach((c, i) => { rgba.set(hex(c), i * 4); rgba[i * 4 + 3] = 255; });
  const fam = classificarFamilias(rgba, 3, 3);
  assert.strictEqual(fam.aproximados, 0); assert.strictEqual(fam.magenta[4], 1);
  const q = posProcessar(fam, limiaresDeTons([fam]), { comJoquei: false });
  assert.strictEqual(q.aproximados, 1); assert.notStrictEqual(q.idx[4], 7);
});

section('moldes reais');
const moldes = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter(f => /^molde-.*\.json$/.test(f)) : [];
if (!moldes.length) console.log('  sem moldes reais — bloco pulado');
moldes.forEach(arq => {
  const J = JSON.parse(fs.readFileSync(path.join(DIR, arq), 'utf8'));
  const estilo = arq.replace(/^molde-|\.json$/g, '');
  // o galope tem J.frames quadros (9, ou 8 quando a API devolve 8)
  const nomes = ['retrato', 'parado'].concat(Array.from({ length: J.frames }, (_, i) => 'galope-' + i));
  const quadros = {};
  test(estilo + ': frames 8 ou 9 e ' + nomes.length + ' arquivos 64x64 em cinza = papel × 25 (0–225)', () => {
    assert.ok(J.frames === 8 || J.frames === 9, 'frames = ' + J.frames);
    nomes.forEach(n => {
      const f = path.join(DIR, 'molde-' + estilo + '-' + n + '.png');
      assert.ok(fs.existsSync(f), 'falta ' + path.basename(f));
      const d = decodePng(fs.readFileSync(f));
      assert.strictEqual(d.width, 64); assert.strictEqual(d.height, 64);
      const g = new Uint8Array(64 * 64);
      for (let i = 0; i < g.length; i++) g[i] = d.rgba[i * 4];
      // confere o cinza bruto (antes de deCinza, que já limitaria a 9): só múltiplos de 25 até 225
      g.forEach((v, i) => assert.ok(v % 25 === 0 && v <= 225, n + ' cinza ' + v + ' no pixel ' + i));
      const idx = deCinza(g);
      quadros[n] = { idx, w: 64, h: 64, papeis: new Set(idx.filter(v => v)), aproximados: 0 };
    });
  });
  test(estilo + ': validar ok em todos os quadros', () => {
    nomes.forEach(n => {
      const r = validar(quadros[n], { exigeJoquei: n !== 'retrato' });
      assert.strictEqual(r.ok, true, n + ': ' + r.motivo);
    });
  });
  test(estilo + ': footY e nose.x coerentes', () => {
    const a = ancoras(quadros.retrato.idx, 64, 64);
    assert.strictEqual(J.footY, a.footY);
    const n0 = ancoras(quadros['galope-0'].idx, 64, 64).nose[0];
    for (let i = 1; i < J.frames; i++) {
      const nx = ancoras(quadros['galope-' + i].idx, 64, 64).nose[0];
      assert.ok(Math.abs(nx - n0) <= 6, 'galope-' + i + ' nose.x ' + nx + ' vs ' + n0);
    }
  });
  // o jogo lê as âncoras e a larguraUtil do JSON (embutido pelo build): têm de bater com os PNGs
  test(estilo + ': ancoras de cada quadro e larguraUtil do JSON = recalculadas dos PNGs', () => {
    nomes.forEach(n => {
      assert.ok(J.ancoras && J.ancoras[n], 'JSON sem ancoras["' + n + '"]');
      assert.deepStrictEqual(J.ancoras[n], ancoras(quadros[n].idx, 64, 64), n);
    });
    assert.strictEqual(J.larguraUtil, ancoras(quadros.retrato.idx, 64, 64).bbox.w, 'larguraUtil');
  });
});

// Aceite do galope de corrida (spec 2026-11-09 §4): o galope de chamas é o padrão. Para os outros estilos,
// a maior passada ≥ 80 % da maior passada de chamas e, em cada quadro, a altura do contorno ≤ 110 % da
// altura média do galope de chamas (meio-galope = corpo alto e patas recolhidas).
section('galope de corrida');
const galopeIdx = estilo => {
  const J = JSON.parse(fs.readFileSync(path.join(DIR, 'molde-' + estilo + '.json'), 'utf8'));
  return Array.from({ length: J.frames }, (_, i) => {
    const d = decodePng(fs.readFileSync(path.join(DIR, 'molde-' + estilo + '-galope-' + i + '.png')));
    const g = new Uint8Array(64 * 64);
    for (let k = 0; k < g.length; k++) g[k] = d.rgba[k * 4];
    return deCinza(g);
  });
};
if (!moldes.includes('molde-chamas.json')) console.log('  sem o molde de chamas — bloco pulado');
else {
  const ch = galopeIdx('chamas');
  const passadaRef = Math.max(...ch.map(q => passada(q, 64, 64)));
  const alturaRef = ch.reduce((s, q) => s + ancoras(q, 64, 64).bbox.h, 0) / ch.length;
  console.log('  chamas (padrão): maior passada ' + passadaRef + ' px, altura média ' + alturaRef.toFixed(2) + ' px'
    + ' ⇒ exige passada ≥ ' + (0.8 * passadaRef).toFixed(1) + ' e altura ≤ ' + (1.1 * alturaRef).toFixed(1));
  moldes.map(a => a.replace(/^molde-|\.json$/g, '')).filter(e => e !== 'chamas').forEach(estilo => {
    test(estilo + ': galope de corrida (passada e altura contra chamas)', () => {
      const qs = galopeIdx(estilo);
      const ps = qs.map(q => passada(q, 64, 64)), hs = qs.map(q => ancoras(q, 64, 64).bbox.h);
      const medidas = 'passadas ' + ps.join(' ') + '; alturas ' + hs.join(' ');
      assert.ok(Math.max(...ps) >= 0.8 * passadaRef,
        'maior passada ' + Math.max(...ps) + ' < ' + (0.8 * passadaRef).toFixed(1) + ' (80 % de ' + passadaRef + ') — ' + medidas);
      hs.forEach((a, i) => assert.ok(a <= 1.1 * alturaRef,
        'galope-' + i + ': altura ' + a + ' > ' + (1.1 * alturaRef).toFixed(1) + ' (110 % de ' + alturaRef.toFixed(2) + ') — ' + medidas));
    });
  });
}

// ---------------------------------------------------------------- Marcas (zonas e camadas dos moldes)
// prototype/src/marcas.js: zonas por quadro (cara, patas, corpo), camadas das marcas e do jóquei, faíscas.
// Spec 2026-11-12-cavalos-marcas §3–§5. Papéis: 2 pelagem, 3 pelagem-sombra, 4/5 crina, 7 roupa, 9 sela.
section('Marcas');
const marcasMod = (() => {
  try { return { M: createRequire(import.meta.url)('../src/marcas.js') }; } catch (e) { return { erro: e }; }
})();
const Mc = () => { if (marcasMod.erro) throw marcasMod.erro; return marcasMod.M; };
const pelagem = v => v === 2 || v === 3;
const MARCA_VAZIA = { cara: 'nenhuma', patas: 0, corpo: 'liso' };

// Cavalo sintético 48×32 virado para a direita, com contorno 1 em volta de tudo:
//   corpo x 6–33 × y 11–20 (sombra nas 2 linhas de baixo); cabeça x 34–41 × y 5–13 e focinho x 42 × y 7–8;
//   crina x 33 × y 3–10; cauda x 2–5 × y 11–18; jóquei: capacete x 20–23 × y 1–2, rosto x 22–23 × y 3,
//   seda x 19–24 × y 5–8 (linha 4 de contorno no meio), sela x 18–25 × y 9–10;
//   pernas (pelagem a partir de y 21, casco 6 embaixo): traseira de longe x 8–9 até y 27, traseira de perto
//   x 12–13 até y 29, dianteira de longe x 27–28 até y 27, dianteira de perto x 31–32 até y 29.
// ancoras(): bbox x 1–43 × y 0–31 (w 43, h 32), footY 31, nose [43, 7], saddle [22, 10]; sem larguraUtil.
// Linha da barriga = 31 − 0,3·32 = 21,4 (pernas a partir de y 22). `extra(ret)` desenha mais antes do contorno.
const PERNAS_SINT = [[8, 9, 27], [12, 13, 29], [27, 28, 27], [31, 32, 29]];
function cavaloMarcas(pernas, extra) {
  const w = 48, h = 32, idx = new Uint8Array(w * h);
  const ret = (x0, y0, x1, y1, v) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) idx[y * w + x] = v; };
  ret(6, 11, 33, 18, 2); ret(6, 19, 33, 20, 3);
  ret(34, 5, 41, 13, 2); ret(42, 7, 42, 8, 2);
  ret(33, 3, 33, 10, 4); ret(2, 11, 5, 18, 4);
  (pernas || PERNAS_SINT).forEach(([a, b, f]) => { ret(a, 21, b, f, 2); ret(a, f + 1, b, f + 1, 6); });
  ret(20, 1, 23, 2, 7); ret(22, 3, 23, 3, 8); ret(19, 5, 24, 8, 7); ret(18, 9, 25, 10, 9);
  if (extra) extra(ret);
  const base = idx.slice();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (base[y * w + x]) continue;
    const viz = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
      const xx = x + dx, yy = y + dy;
      return xx >= 0 && yy >= 0 && xx < w && yy < h && base[yy * w + xx];
    });
    if (viz) idx[y * w + x] = 1;
  }
  return { idx, w, h, a: ancoras(idx, w, h) };
}

// Quadros reais (como o bloco "moldes reais": índice = round(cinza / 25)) com as âncoras do JSON.
const quadrosReais = {};
moldes.forEach(arq => {
  const J = JSON.parse(fs.readFileSync(path.join(DIR, arq), 'utf8'));
  const estilo = arq.replace(/^molde-|\.json$/g, '');
  const nomes = ['retrato', 'parado'].concat(Array.from({ length: J.frames }, (_, i) => 'galope-' + i));
  quadrosReais[estilo] = nomes.map(n => {
    const d = decodePng(fs.readFileSync(path.join(DIR, 'molde-' + estilo + '-' + n + '.png')));
    const idx = new Uint8Array(64 * 64);
    for (let i = 0; i < idx.length; i++) idx[i] = Math.round(d.rgba[i * 4] / 25);
    // a âncora leva a larguraUtil do molde, como o jogo passa (raio da cara igual em todos os quadros)
    return { nome: estilo + ' ' + n, quadro: n, idx, w: 64, h: 64, a: Object.assign({ larguraUtil: J.larguraUtil }, J.ancoras[n]) };
  });
});
const todosReais = () => Object.values(quadrosReais).flat();
const contar = (arr, f) => { let n = 0; for (let i = 0; i < arr.length; i++) if (f(arr[i], i)) n++; return n; };

test('zonas num molde sintético: cara perto do focinho, patas abaixo da barriga, 4 pernas na ordem fixa', () => {
  const { idx, w, h, a } = cavaloMarcas();
  assert.deepStrictEqual([a.bbox, a.footY, a.nose, a.saddle], [{ x: 1, y: 0, w: 43, h: 32 }, 31, [43, 7], [22, 10]]);
  const { zona, perna } = Mc().zonas(idx, w, h, a);
  assert.strictEqual(zona.length, w * h); assert.strictEqual(perna.length, w * h);
  const LIM = Mc().LIMITES;
  assert.ok(Object.isFrozen(LIM), 'LIMITES só leitura');
  const esperada = (anc) => {
    const r = LIM.caraRaio * (anc.larguraUtil || anc.bbox.w), barriga = anc.footY - LIM.barriga * anc.bbox.h;
    return (x, y, v) => !pelagem(v) ? 0
      : (y <= anc.nose[1] + LIM.caraBaixo && Math.hypot(x - anc.nose[0], y - anc.nose[1]) <= r) ? 1
      : y > barriga ? 2 : 3;
  };
  const z0 = esperada(a);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    assert.strictEqual(zona[i], z0(x, y, idx[i]), 'zona em (' + x + ',' + y + ')');
    assert.strictEqual(perna[i] >= 0, zona[i] === 2, 'perna só na zona das patas, em (' + x + ',' + y + ')');
  }
  // com larguraUtil na âncora, o raio sai dela (e não do bbox.w)
  const aL = Object.assign({ larguraUtil: 30 }, a), zL = Mc().zonas(idx, w, h, aL).zona, eL = esperada(aL);
  for (let i = 0; i < w * h; i++) assert.strictEqual(zL[i], eL(i % w, (i / w) | 0, idx[i]), 'larguraUtil: pixel ' + i);
  assert.notDeepStrictEqual(Array.from(zL), Array.from(zona), 'larguraUtil muda o raio');
  assert.strictEqual(zona[8 * w + 40], 1, 'cabeça é cara'); assert.strictEqual(zona[15 * w + 10], 3, 'lombo é corpo');
  assert.strictEqual(zona[11 * w + 40], 3, 'abaixo do corte (nose.y + caraBaixo) não é cara');
  assert.strictEqual(zona[21 * w + 12], 3, 'coxa acima da linha da barriga é corpo');
  // ordem fixa: 0 traseira de perto, 1 dianteira de perto, 2 traseira de longe, 3 dianteira de longe
  assert.deepStrictEqual([perna[29 * w + 12], perna[29 * w + 31], perna[27 * w + 8], perna[27 * w + 27]], [0, 1, 2, 3]);
  assert.deepStrictEqual([perna[22 * w + 13], perna[22 * w + 32], perna[22 * w + 9], perna[22 * w + 28]], [0, 1, 2, 3]);
});

test('pernas: componentes; cascos separados partem a componente; lado pela sela; de perto = a maior; > 2 num lado junta a menor', () => {
  const pernaEm = (c, x, y) => Mc().zonas(c.idx, c.w, c.h, c.a).perna[y * c.w + x];
  // só as duas traseiras (as duas à esquerda da sela, x 22): de perto 0 (16 px), de longe 2 (12 px)
  const tras = cavaloMarcas([[8, 9, 27], [12, 13, 29]]);
  assert.deepStrictEqual([pernaEm(tras, 12, 29), pernaEm(tras, 8, 27)], [0, 2]);
  // sem dianteiras, 2 meias vão para as 2 traseiras achadas (a perna 1 não existe)
  const m2 = Mc().camadaMarcas(tras.idx, tras.w, tras.h, tras.a, { cara: 'nenhuma', patas: 2, corpo: 'liso' }, 1);
  assert.ok(m2[29 * tras.w + 12] && m2[27 * tras.w + 8], '2 meias nas 2 traseiras');
  // traseiras em Λ: uma componente só (coxa junta em y 22–23), cascos separados embaixo (x 8–9 e x 12–13)
  // ⇒ partida no vão (corte em x 11); a parte da direita tem mais pixels (18 × 16) e é a de perto
  const lambda = cavaloMarcas([[27, 28, 27], [31, 32, 29]], ret => {
    ret(8, 21, 13, 23, 2); ret(8, 24, 9, 28, 2); ret(8, 29, 9, 29, 6); ret(12, 24, 13, 29, 2); ret(12, 30, 13, 30, 6);
  });
  assert.strictEqual(lambda.a.footY, 31);
  assert.deepStrictEqual([pernaEm(lambda, 12, 29), pernaEm(lambda, 11, 22), pernaEm(lambda, 8, 28), pernaEm(lambda, 10, 22)], [0, 0, 2, 2]);
  assert.deepStrictEqual([pernaEm(lambda, 31, 29), pernaEm(lambda, 27, 27)], [1, 3]);
  // três grupos: as duas traseiras e a dianteira de perto
  const tres = cavaloMarcas([[8, 9, 27], [12, 13, 29], [31, 32, 29]]);
  assert.deepStrictEqual([pernaEm(tres, 12, 29), pernaEm(tres, 31, 29), pernaEm(tres, 8, 27)], [0, 1, 2]);
  // uma de cada lado: as duas são "de perto"
  const duas = cavaloMarcas([[12, 13, 27], [27, 28, 29]]);
  assert.deepStrictEqual([pernaEm(duas, 12, 27), pernaEm(duas, 27, 29)], [0, 1]);
  // 3 traseiras: a menor (x 15, 3 px) junta com a vizinha mais perto (x 12–13); sobram 4 pernas
  const cinco = cavaloMarcas(PERNAS_SINT.concat([[15, 15, 24]]));
  const z = Mc().zonas(cinco.idx, cinco.w, cinco.h, cinco.a);
  assert.strictEqual(new Set(Array.from(z.perna).filter(p => p >= 0)).size, 4);
  assert.strictEqual(z.perna[24 * cinco.w + 15], z.perna[29 * cinco.w + 12], 'x 15 junta com a perna x 12–13');
});

test('zonas nos 4 moldes reais (parado e os 9 quadros do galope): cara e ≥ 2 pernas achadas', () => {
  const estilos = Object.keys(quadrosReais);
  assert.strictEqual(estilos.length, 4, 'moldes reais: ' + estilos.join(', '));
  estilos.forEach(estilo => {
    const linha = [];
    quadrosReais[estilo].forEach(q => {
      const { zona, perna } = Mc().zonas(q.idx, q.w, q.h, q.a);
      const cara = contar(zona, v => v === 1);
      const pernas = new Set(Array.from(perna).filter(p => p >= 0)).size;
      linha.push(q.quadro.replace('galope-', 'g') + ' ' + cara + '/' + pernas);
      assert.ok(cara > 0, q.nome + ': nenhuma cara');
      assert.ok(pernas >= 2, q.nome + ': ' + pernas + ' perna(s)');
      for (let i = 0; i < zona.length; i++) assert.strictEqual(zona[i] > 0, pelagem(q.idx[i]), q.nome + ' pixel ' + i);
    });
    console.log('       ' + estilo + ' (pixels de cara/pernas): ' + linha.join(' · '));
  });
});

// Manchas 8-conexas dos pixels ≠ 0 de uma camada (cada uma, a lista dos seus índices).
function manchas(c, w, h) {
  const visto = new Uint8Array(w * h), out = [];
  for (let i = 0; i < w * h; i++) {
    if (!c[i] || visto[i]) continue;
    const m = [], pilha = [i];
    visto[i] = 1;
    while (pilha.length) {
      const j = pilha.pop(), x = j % w, y = (j / w) | 0;
      m.push(j);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy, k = yy * w + xx;
        if (xx >= 0 && yy >= 0 && xx < w && yy < h && c[k] && !visto[k]) { visto[k] = 1; pilha.push(k); }
      }
    }
    out.push(m);
  }
  return out;
}

test('meias nos 44 quadros reais: 1 meia = uma mancha só; cada perna achada a mais pinta mais; no galope a 1ª meia fica atrás', () => {
  const linhas = [];
  Object.keys(quadrosReais).forEach(estilo => {
    const lin = [];
    quadrosReais[estilo].forEach(q => {
      const { perna } = Mc().zonas(q.idx, q.w, q.h, q.a);
      const nPernas = new Set(Array.from(perna).filter(p => p >= 0)).size;
      const L = [0, 1, 2, 3, 4].map(n => Array.from(Mc().camadaMarcas(q.idx, q.w, q.h, q.a, { cara: 'nenhuma', patas: n, corpo: 'liso' }, 1)));
      const m1 = manchas(L[1], q.w, q.h);
      assert.strictEqual(m1.length, 1, q.nome + ': 1 meia em ' + m1.length + ' manchas');
      for (let n = 0; n < 4; n++) {
        if (nPernas >= n + 1) assert.notDeepStrictEqual(L[n + 1], L[n], q.nome + ': ' + (n + 1) + ' meia(s) = ' + n + ' (' + nPernas + ' pernas)');
        else assert.deepStrictEqual(L[n + 1], L[n], q.nome + ': meia a mais sem perna achada');
      }
      if (/^galope-/.test(q.quadro)) {
        const cx = m1[0].reduce((soma, i) => soma + i % q.w, 0) / m1[0].length;
        assert.ok(cx < q.a.saddle[0], q.nome + ': 1ª meia na frente (x ' + cx.toFixed(1) + ', sela ' + q.a.saddle[0] + ')');
      }
      lin.push(q.quadro.replace('galope-', 'g') + ' ' + nPernas);
    });
    linhas.push(estilo + ': ' + lin.join(' · '));
  });
  console.log('       pernas achadas — ' + linhas.join('\n       pernas achadas — '));
});

test('cara presa ao focinho: nos 9 quadros do galope, a borda de baixo (em relação ao nose) varia ≤ 2 px e a área ≤ 20%', () => {
  Object.keys(quadrosReais).forEach(estilo => {
    const fundos = [], areas = [];
    quadrosReais[estilo].filter(q => /^galope-/.test(q.quadro)).forEach(q => {
      const { zona } = Mc().zonas(q.idx, q.w, q.h, q.a);
      let fundo = -1, area = 0;
      zona.forEach((v, i) => { if (v === 1) { area++; fundo = Math.max(fundo, (i / q.w) | 0); } });
      fundos.push(fundo - q.a.nose[1]); areas.push(area);
    });
    const [fMin, fMax, aMin, aMax] = [Math.min(...fundos), Math.max(...fundos), Math.min(...areas), Math.max(...areas)];
    const medidas = estilo + ': borda − nose ' + fundos.join(' ') + '; área ' + areas.join(' ');
    assert.ok(fMax - fMin <= 2, medidas);
    assert.ok(aMax - aMin <= 0.2 * aMin, medidas + ' (' + (100 * (aMax - aMin) / aMin).toFixed(0) + '%)');
    console.log('       ' + medidas + ' (' + (100 * (aMax - aMin) / aMin).toFixed(0) + '%)');
  });
});

// Cada marca sozinha: o que ela pinta e em que zona.
const MARCAS_SOZINHAS = [
  [{ cara: 'estrela' }, 1], [{ cara: 'listra' }, 1], [{ cara: 'frente' }, 1],
  [{ patas: 1 }, 2], [{ patas: 2 }, 2], [{ patas: 3 }, 2], [{ patas: 4 }, 2],
  [{ corpo: 'malhado' }, 3], [{ corpo: 'pintado' }, 3], [{ corpo: 'ruao' }, 3]
].map(([m, z]) => [Object.assign({}, MARCA_VAZIA, m), z]);
const quadrosTeste = () => [Object.assign({ nome: 'sintético', quadro: 'sintético' }, cavaloMarcas())].concat(todosReais());

test('cada marca só muda pixels de pelagem da zona dela; contorno, crina, jóquei e sela intactos', () => {
  quadrosTeste().forEach(q => {
    const { zona } = Mc().zonas(q.idx, q.w, q.h, q.a);
    const vazia = Mc().camadaMarcas(q.idx, q.w, q.h, q.a, MARCA_VAZIA, 7);
    assert.strictEqual(contar(vazia, v => v), 0, q.nome + ': nenhuma marca pinta algo');
    const uniao = new Uint8Array(q.w * q.h);
    MARCAS_SOZINHAS.forEach(([m, z]) => {
      const c = Mc().camadaMarcas(q.idx, q.w, q.h, q.a, m, 12345);
      const nome = q.nome + ' ' + JSON.stringify(m);
      assert.strictEqual(c.length, q.w * q.h);
      for (let i = 0; i < c.length; i++) {
        if (!c[i]) continue;
        assert.ok(pelagem(q.idx[i]), nome + ': pintou o papel ' + q.idx[i] + ' no pixel ' + i);
        assert.strictEqual(zona[i], z, nome + ': fora da zona ' + z + ' no pixel ' + i);
        if (c[i] === 3) assert.strictEqual(m.corpo, 'pintado', nome + ': escuro sem ser pintado');
        else assert.strictEqual(c[i], q.idx[i] === 2 ? 1 : 2, nome + ': branco 1 na pelagem, 2 na sombra');
        uniao[i] = c[i];
      }
    });
    // as zonas não se cruzam: todas as marcas juntas = a soma das marcas sozinhas
    const juntas = Mc().camadaMarcas(q.idx, q.w, q.h, q.a, { cara: 'frente', patas: 4, corpo: 'ruao' }, 12345);
    const soma = new Uint8Array(q.w * q.h);
    [{ cara: 'frente' }, { patas: 4 }, { corpo: 'ruao' }].forEach(m => {
      Mc().camadaMarcas(q.idx, q.w, q.h, q.a, Object.assign({}, MARCA_VAZIA, m), 12345).forEach((v, i) => { if (v) soma[i] = v; });
    });
    assert.deepStrictEqual(Array.from(juntas), Array.from(soma), q.nome + ': frente + 4 meias + ruão');
  });
});

test('estrela de 2 a 3 px; listra de testa a focinho, mais fina que a frente; meias = 3 linhas de baixo das N primeiras pernas', () => {
  quadrosTeste().forEach(q => {
    const { zona, perna } = Mc().zonas(q.idx, q.w, q.h, q.a);
    const nCara = contar(zona, v => v === 1);
    const camada = m => Mc().camadaMarcas(q.idx, q.w, q.h, q.a, Object.assign({}, MARCA_VAZIA, m), 99);
    const est = contar(camada({ cara: 'estrela' }), v => v);
    assert.ok(est >= 2 && est <= 3, q.nome + ': estrela com ' + est + ' px');
    const lis = camada({ cara: 'listra' });
    const nLis = contar(lis, v => v);
    assert.ok(nLis >= 3 && nLis < 0.5 * nCara, q.nome + ': listra com ' + nLis + ' px (cara ' + nCara + ')');
    // a listra desce até o focinho: tem um pixel a até 3 px do nose
    let perto = false;
    lis.forEach((v, i) => { if (v && Math.hypot(i % q.w - q.a.nose[0], ((i / q.w) | 0) - q.a.nose[1]) <= 3) perto = true; });
    assert.ok(perto, q.nome + ': listra longe do focinho');
    // meias: as N primeiras pernas ACHADAS na ordem fixa, só as 3 linhas de baixo de cada uma
    const fundo = [-1, -1, -1, -1];
    perna.forEach((p, i) => { if (p >= 0) fundo[p] = Math.max(fundo[p], (i / q.w) | 0); });
    const achadas = [0, 1, 2, 3].filter(p => fundo[p] >= 0);
    for (let n = 1; n <= 4; n++) {
      const c = camada({ patas: n }), com = achadas.slice(0, n);
      for (let i = 0; i < c.length; i++) {
        const y = (i / q.w) | 0, deve = com.includes(perna[i]) && y >= fundo[perna[i]] - 2;
        assert.strictEqual(!!c[i], deve, q.nome + ' ' + n + ' meia(s): pixel ' + i);
      }
    }
  });
});

test('frente cobre a zona da cara; ruao troca de 25% a 35% do corpo', () => {
  quadrosTeste().forEach(q => {
    const { zona } = Mc().zonas(q.idx, q.w, q.h, q.a);
    const f = Mc().camadaMarcas(q.idx, q.w, q.h, q.a, Object.assign({}, MARCA_VAZIA, { cara: 'frente' }), 1);
    for (let i = 0; i < f.length; i++) assert.strictEqual(!!f[i], zona[i] === 1, q.nome + ' frente: pixel ' + i);
    [1, 2, 0xDEADBEEF].forEach(semente => {
      const r = Mc().camadaMarcas(q.idx, q.w, q.h, q.a, Object.assign({}, MARCA_VAZIA, { corpo: 'ruao' }), semente);
      const corpo = contar(zona, v => v === 3), trocados = contar(r, v => v);
      const frac = trocados / corpo;
      assert.ok(frac >= 0.25 && frac <= 0.35, q.nome + ' ruão (semente ' + semente + '): ' + (100 * frac).toFixed(1) + '% de ' + corpo);
    });
  });
});

// Mapa "posição relativa à sela → pintado ou não" dos pixels de corpo de um quadro (o tom, 1 ou 2, segue o
// papel do pixel naquele quadro; o que não pode mudar é ONDE o padrão cai).
function relativoASela(q, m, semente) {
  const { zona } = Mc().zonas(q.idx, q.w, q.h, q.a);
  const c = Mc().camadaMarcas(q.idx, q.w, q.h, q.a, Object.assign({}, MARCA_VAZIA, m), semente);
  const mapa = new Map();
  for (let i = 0; i < c.length; i++) {
    if (zona[i] !== 3) continue;
    mapa.set(((i % q.w) - q.a.saddle[0]) + ',' + (((i / q.w) | 0) - q.a.saddle[1]), c[i] > 0);
  }
  return mapa;
}
function mesmoPadraoNoGalope(m) {
  Object.keys(quadrosReais).forEach(estilo => {
    const galope = quadrosReais[estilo].filter(q => /^galope-/.test(q.quadro));
    assert.strictEqual(galope.length, 9, estilo);
    const mapas = galope.map(q => relativoASela(q, m, 0xC0FFEE));
    mapas.forEach((mp, k) => assert.ok(Array.from(mp.values()).some(v => v), estilo + ' ' + galope[k].nome + ': ' + m.corpo + ' vazio'));
    let comuns = 0;
    for (let i = 0; i < mapas.length; i++) for (let j = i + 1; j < mapas.length; j++) {
      mapas[i].forEach((v, k) => {
        if (!mapas[j].has(k)) return;
        comuns++;
        assert.strictEqual(mapas[j].get(k), v, estilo + ' ' + m.corpo + ': ' + galope[i].nome + ' × ' + galope[j].nome + ' em ' + k);
      });
    }
    assert.ok(comuns > 1000, estilo + ': poucos pixels em comum (' + comuns + ')');
  });
}

test('malhado: o mesmo padrão nos 9 quadros do galope, em coordenadas relativas à sela', () => {
  mesmoPadraoNoGalope({ corpo: 'malhado' });
});

test('pintado e ruão: o mesmo padrão nos 9 quadros do galope; sementes diferentes ⇒ malhados diferentes', () => {
  mesmoPadraoNoGalope({ corpo: 'pintado' });
  mesmoPadraoNoGalope({ corpo: 'ruao' });
  const q = quadrosTeste()[0];
  const camada = s => Array.from(Mc().camadaMarcas(q.idx, q.w, q.h, q.a, Object.assign({}, MARCA_VAZIA, { corpo: 'malhado' }), s));
  assert.deepStrictEqual(camada(42), camada(42), 'determinístico');
  assert.notDeepStrictEqual(camada(42), camada(43), 'semente muda as manchas');
  // retrato (sem sela): a referência é o centro da caixa; o malhado aparece
  todosReais().filter(r => r.quadro === 'retrato').forEach(r => {
    assert.strictEqual(r.a.saddle, null);
    const c = Mc().camadaMarcas(r.idx, r.w, r.h, r.a, Object.assign({}, MARCA_VAZIA, { corpo: 'malhado' }), 42);
    assert.ok(contar(c, v => v) > 0, 'retrato sem malhado');
  });
});

test('Review Focus 2: quadro sem pernas e sem cara ⇒ meias e estrela não pintam nada, sem exceção', () => {
  // pelagem só no meio; a "cabeça" e as "pernas" são só contorno (longe do focinho e acima da barriga)
  const w = 40, h = 30, idx = new Uint8Array(w * h);
  for (let y = 10; y <= 14; y++) for (let x = 2; x <= 10; x++) idx[y * w + x] = 2;
  for (let x = 30; x <= 35; x++) idx[x] = 1;
  for (let y = 15; y <= 25; y++) idx[y * w + 4] = 1;
  const a = ancoras(idx, w, h);
  const { zona, perna } = Mc().zonas(idx, w, h, a);
  assert.strictEqual(contar(zona, v => v === 1), 0); assert.strictEqual(contar(zona, v => v === 2), 0);
  assert.strictEqual(contar(perna, p => p >= 0), 0);
  ['estrela', 'listra', 'frente'].forEach(cara => {
    const c = Mc().camadaMarcas(idx, w, h, a, { cara, patas: 4, corpo: 'liso' }, 5);
    assert.strictEqual(contar(c, v => v), 0, cara + ' + 4 meias');
  });
  // quadro vazio, âncora ausente e marcas/padrão inválidos: camadas zeradas, sem lançar
  const vazio = new Uint8Array(w * h), av = ancoras(vazio, w, h);
  assert.strictEqual(av.nose, null);
  [av, null, undefined].forEach(anc => {
    assert.strictEqual(contar(Mc().zonas(vazio, w, h, anc).zona, v => v), 0);
    assert.strictEqual(contar(Mc().zonas(idx, w, h, anc).zona, v => v === 1 || v === 2), 0);
    assert.strictEqual(contar(Mc().camadaMarcas(vazio, w, h, anc, { cara: 'frente', patas: 4, corpo: 'malhado' }, 5), v => v), 0);
    assert.strictEqual(contar(Mc().camadaJoquei(vazio, w, h, anc, 'xadrez'), v => v), 0);
  });
  [null, undefined, {}, { cara: 'x', patas: 7, corpo: 'y' }].forEach(m => {
    assert.strictEqual(contar(Mc().camadaMarcas(idx, w, h, a, m, 5), v => v), 0, JSON.stringify(m));
  });
});

test('camadaJoquei: padrão só no papel 7; liso ⇒ zero pixels 1; capacete = grupo de cima do papel 7; manta = papel 9', () => {
  const PADROES = createRequire(import.meta.url)('../src/data.js').JOQUEI.padroes;
  // sintético: capacete x 20–23 × y 1–2; seda x 19–24 × y 5–8; sela x 18–25 × y 9–10
  const s = cavaloMarcas();
  PADROES.forEach(p => {
    const c = Mc().camadaJoquei(s.idx, s.w, s.h, s.a, p);
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
      const i = y * s.w + x, v = s.idx[i];
      const capacete = v === 7 && y <= 2;
      if (capacete) assert.strictEqual(c[i], 2, p + ': capacete em (' + x + ',' + y + ')');
      else if (v === 9) assert.strictEqual(c[i], 3, p + ': manta em (' + x + ',' + y + ')');
      else if (v === 7) assert.ok(c[i] === 0 || c[i] === 1, p + ': seda em (' + x + ',' + y + ')');
      else assert.strictEqual(c[i], 0, p + ': papel ' + v + ' em (' + x + ',' + y + ')');
    }
    const n1 = contar(c, v => v === 1);
    assert.strictEqual(n1 === 0, p === 'liso', p + ': ' + n1 + ' pixels de padrão');
  });
  assert.strictEqual(contar(Mc().camadaJoquei(s.idx, s.w, s.h, s.a, 'nao-existe'), v => v === 1), 0, 'padrão inválido = liso');
  // moldes reais (parado e galope): capacete no alto, padrão só na seda abaixo dele e minoria nela
  todosReais().filter(q => q.quadro !== 'retrato').forEach(q => {
    let topo = q.h;
    q.idx.forEach((v, i) => { if (v === 7) topo = Math.min(topo, (i / q.w) | 0); });
    PADROES.forEach(p => {
      const c = Mc().camadaJoquei(q.idx, q.w, q.h, q.a, p), nome = q.nome + ' ' + p;
      let capMin = q.h, capMax = -1, seda = 0, padrao = 0, padraoMin = q.h;
      for (let i = 0; i < c.length; i++) {
        const v = q.idx[i], y = (i / q.w) | 0;
        if (c[i] === 2) { assert.strictEqual(v, 7, nome); capMin = Math.min(capMin, y); capMax = Math.max(capMax, y); }
        if (c[i] === 3) assert.strictEqual(v, 9, nome);
        if (v === 9) assert.strictEqual(c[i], 3, nome + ': toda a sela vira manta');
        if (c[i] === 1) { assert.strictEqual(v, 7, nome); padrao++; padraoMin = Math.min(padraoMin, y); }
        if (v === 7 && c[i] !== 2) seda++;
      }
      assert.strictEqual(capMin, topo, nome + ': o capacete começa no topo do papel 7');
      assert.ok(capMax - capMin <= 8, nome + ': capacete alto demais (' + capMin + '–' + capMax + ')');
      if (p === 'liso') { assert.strictEqual(padrao, 0, nome); return; }
      assert.ok(padrao > 0, nome + ': padrão vazio');
      assert.ok(padraoMin > capMax, nome + ': padrão acima da linha do capacete');
      assert.ok(padrao < seda - padrao, nome + ': padrão ' + padrao + ' ≥ base ' + (seda - padrao));
    });
  });
});

test('faiscas: determinístico; n itens; dx, dy em [0,1]', () => {
  const M = Mc();
  assert.deepStrictEqual(M.N_FAISCAS, { comum: 0, magico: 0, raro: 3, lendario: 5, mitico: 5 });
  assert.deepStrictEqual(M.BRILHO, { comum: 0, magico: 0.25, raro: 0.30, lendario: 0.45, mitico: 0.45 });
  [0, 1, 0x811c9dc5, 0xFFFFFFFF].forEach(semente => {
    [0, 3, 5].forEach(n => {
      const f = M.faiscas(semente, n);
      assert.strictEqual(f.length, n);
      assert.deepStrictEqual(M.faiscas(semente, n), f, 'determinístico');
      f.forEach(o => {
        assert.deepStrictEqual(Object.keys(o).sort(), ['dx', 'dy', 'fase']);
        assert.ok(o.dx >= 0 && o.dx <= 1 && o.dy >= 0 && o.dy <= 1, JSON.stringify(o));
        assert.ok(o.fase >= 0 && o.fase < 1, JSON.stringify(o));
      });
    });
  });
  assert.notDeepStrictEqual(M.faiscas(1, 5), M.faiscas(2, 5), 'semente muda as posições');
  // em volta da caixa: cada faísca encostada numa das 4 bordas (a até 0,2 dela)
  M.faiscas(0xABCDEF, 5).forEach(o => assert.ok(Math.min(o.dx, o.dy, 1 - o.dx, 1 - o.dy) <= 0.2, JSON.stringify(o)));
  ['x', -1, NaN, null, -Infinity].forEach(n => assert.deepStrictEqual(M.faiscas(1, n), [], 'n inválido ⇒ nenhuma'));
  // n preso a [0, 16] (Infinity travava o laço)
  [16, 17, 1e9, Infinity].forEach(n => assert.strictEqual(M.faiscas(1, n).length, 16, 'n = ' + n));
});

test('marcas.js: puro (sem Math.random, sem DOM, sem canvas) e UMD', () => {
  const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'marcas.js'), 'utf8');
  const codigo = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  ['Math.random', 'document', 'window', 'getContext', 'Date.now'].forEach(p => assert.ok(!codigo.includes(p), 'usa ' + p));
  assert.ok(/root\.Marcas\s*=/.test(codigo) && /module\.exports\s*=/.test(codigo), 'UMD');
  assert.ok(!/\b(let|const)\b|=>/.test(codigo), 'ES5');
});

// ---------------------------------------------------------------- Catálogo de ícones
section('Catálogo de ícones');
{
  const GameData = createRequire(import.meta.url)('../src/data.js');
  const ids = ICONES_NOVOS.map(i => i.id);
  test('catálogo tem 58 ícones, ids únicos, só [a-z0-9-]', () => {
    assert.strictEqual(ICONES_NOVOS.length, 58);
    assert.strictEqual(new Set(ids).size, 58);
    for (const i of ICONES_NOVOS) assert.match(i.id, /^[a-z0-9-]+$/);
  });
  test('nenhum id novo repete um dos 16 de hoje', () => {
    assert.strictEqual(ANTIGOS.length, 16);
    for (const i of ICONES_NOVOS) assert.ok(!ANTIGOS.includes(i.id), i.id);
  });
  test('cobre o jogo: st- por STAT_KEYS, sk- por SKILLS, sk-tipo- por TYPE_SKILLS, cl- por WEATHERS, pi- por SURFACES, liga- por LEAGUES, rar- por RARITIES', () => {
    const esperados = [
      ...GameData.STAT_KEYS.map(k => 'st-' + k),
      ...Object.keys(GameData.SKILLS).map(k => 'sk-' + k),
      ...Object.keys(GameData.TYPE_SKILLS).map(k => 'sk-tipo-' + k),
      ...Object.keys(GameData.WEATHERS).map(k => 'cl-' + k),
      ...Object.keys(GameData.SURFACES).map(k => 'pi-' + k),
      ...GameData.LEAGUES.map(l => 'liga-' + l.id),
      ...Object.keys(GameData.RARITIES).map(k => 'rar-' + k),
    ];
    for (const e of esperados) assert.ok(ids.includes(e), 'falta ' + e);
  });
  test('famílias válidas; cor nula ou #rrggbb; descrição sem dígitos', () => {
    assert.deepStrictEqual(FAMILIAS.map(f => f.id), ['ui', 'st', 'sk', 'cl-pi', 'liga-rar-podio', 'reservado']);
    for (const i of ICONES_NOVOS) {
      assert.ok(FAMILIAS.some(f => f.id === i.familia), i.id + ': família ' + i.familia);
      assert.ok(i.cor === null || /^#[0-9a-f]{6}$/.test(i.cor), i.id + ': cor ' + i.cor);
      assert.ok(!/\d/.test(i.desc), i.id + ': dígito na descrição');
    }
  });
  // Seed base 2201 + índice; item refeito (linha com { seed }) usa a base + 100 (refação) ou + 200 (2ª refação).
  test('seeds 2201..2258 na ordem da tabela (refeitos: base + 100 ou + 200)', () => {
    let refeitos = 0;
    ICONES_NOVOS.forEach((i, k) => {
      const base = 2201 + k;
      assert.ok(i.seed === base || i.seed === base + 100 || i.seed === base + 200, i.id + ': seed ' + i.seed + ' (esperado ' + base + ', ' + (base + 100) + ' ou ' + (base + 200) + ')');
      if (i.seed !== base) refeitos++;
    });
    assert.ok(refeitos > 0, 'nenhum item refeito encontrado');
  });
  // Todo PNG de assets/icons (fora raw/) é conhecido, 32x32, de canto transparente e com algo desenhado.
  test('PNGs de assets/icons: conhecidos, 32x32, fundo transparente, ao menos um pixel opaco', () => {
    const dirIcons = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'icons');
    const conhecidos = new Set([...ids, ...ANTIGOS]);
    const arquivos = fs.readdirSync(dirIcons).filter(f => f.endsWith('.png'));
    for (const f of arquivos) {
      const id = f.slice(0, -4);
      assert.ok(conhecidos.has(id), f + ': fora do catálogo e dos 16 antigos');
      const { width, height, rgba } = decodePng(fs.readFileSync(path.join(dirIcons, f)));
      assert.strictEqual(width + 'x' + height, '32x32', f + ': tamanho');
      assert.strictEqual(rgba[3], 0, f + ': canto superior esquerdo não é transparente');
      let opaco = false;
      for (let p = 3; p < rgba.length; p += 4) if (rgba[p] >= 128) { opaco = true; break; }
      assert.ok(opaco, f + ': sem pixel opaco');
    }
    // Ícone sem arquivo (ainda não gerado/refeito) é só aviso.
    const tem = new Set(arquivos.map(f => f.slice(0, -4)));
    for (const id of conhecidos) if (!tem.has(id)) console.log('  aviso: sem arquivo: ' + id);
  });
  test('RESERVADOS são os 5 da spec §2.6 e estão no catálogo', () => {
    assert.deepStrictEqual(RESERVADOS, ['item-redea', 'moeda-gema', 'ins-fogo', 'ins-agua', 'ins-grama']);
    for (const r of RESERVADOS) assert.strictEqual(ICONES_NOVOS.find(i => i.id === r).familia, 'reservado', r);
  });
  test('folha: cada id do catálogo e dos 16 aparece; sem arquivo vira "falta"; reservado marcado', () => {
    const html = htmlFolhaIcones({ 'st-vel': 'data:image/png;base64,AA==' }, ICONES_NOVOS, ANTIGOS);
    for (const i of [...ids, ...ANTIGOS]) assert.ok(html.includes(i), i);
    assert.ok(html.includes('>falta<'));
    assert.ok(html.includes('>reservado<'));
    assert.ok(html.startsWith('<!doctype html>'));
    assert.ok(html.includes('alt="st-vel"'));
  });
  test('folha é determinística', () => {
    const f = () => htmlFolhaIcones({ 'st-vel': 'data:image/png;base64,AA==' }, ICONES_NOVOS, ANTIGOS);
    assert.strictEqual(f(), f());
  });
}

// ---------------------------------------------------------------- Portes: critérios (spec 2026-11-13-cavalos-portes §4–§5)
// prototype/tools/portes-criterios.mjs: medidas do corpo (só pelagem e o contorno dela) e os critérios automáticos
// de aceite dos 12 moldes novos, sobre moldes sintéticos montados aqui.
section('Portes: critérios');
const portesCrit = await import('./portes-criterios.mjs').then(M => ({ M }), erro => ({ erro }));
const Pc = () => { if (portesCrit.erro) throw portesCrit.erro; return portesCrit.M; };

// Cavalo sintético 64×64 de lado, virado para a direita, com contorno 1 em volta de tudo. Com os padrões
// (top 20, esp 12, perna 10, comp 30): tronco x 10–39 × y 20–31 (sombra nas 2 linhas de baixo); cabeça x 40–45 ×
// y 12–21 e orelha x 44 × y 10–11; crina x 36–39 × y 14–19 ('grande': x 32–39 × y 4–19); cauda x 4–9 × y 20–30;
// pernas de pelagem x 12–13, 17–18 (coladas: 14–15), 31–32 e 36–37, de y 32 até y 41, casco (6) em y 42.
// joquei: sela x 22–27 × y 20–21, seda x 23–26 × y 12–19, rosto x 24–25 × y 10–11, capacete x 23–26 × y 8–9.
// dx/dy deslocam tudo. Medidas esperadas (corpo = pelagem + contorno encostado nela): topo 9 (contorno da orelha),
// footY 43 (contorno do casco) ⇒ altura 35; corpo de x 9 a x 46 ⇒ comprimento 38; nose [46, 12]; espessura 14 na
// coluna 28 (meio do corpo: contorno do lombo em y 19 até o da barriga em y 32).
function sintPorte({ esp = 12, perna = 10, comp = 30, coladas = false, joquei = false, crina = 'normal', dx = 0, dy = 0, top = 20 } = {}) {
  const w = 64, h = 64, idx = new Uint8Array(w * h);
  const ret = (x0, y0, x1, y1, v) => {
    for (let y = y0 + dy; y <= y1 + dy; y++) for (let x = x0 + dx; x <= x1 + dx; x++) if (x >= 0 && y >= 0 && x < w && y < h) idx[y * w + x] = v;
  };
  const fim = 10 + comp - 1;
  ret(10, top, fim, top + esp - 3, 2); ret(10, top + esp - 2, fim, top + esp - 1, 3);
  ret(fim + 1, top - 8, fim + 6, top + 1, 2); ret(fim + 5, top - 10, fim + 5, top - 9, 2);
  if (crina === 'grande') ret(fim - 7, top - 16, fim, top - 1, 4); else ret(fim - 3, top - 6, fim, top - 1, 4);
  ret(4, top, 9, top + 10, 4);
  for (const [a, b] of [[12, 13], coladas ? [14, 15] : [17, 18], [fim - 8, fim - 7], [fim - 3, fim - 2]]) {
    ret(a, top + esp, b, top + esp + perna - 1, 2); ret(a, top + esp + perna, b, top + esp + perna, 6);
  }
  if (joquei) { ret(22, top, 27, top + 1, 9); ret(23, top - 8, 26, top - 1, 7); ret(24, top - 10, 25, top - 9, 8); ret(23, top - 12, 26, top - 11, 7); }
  const base = idx.slice();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (base[y * w + x]) continue;
    if ((x > 0 && base[y * w + x - 1]) || (x < w - 1 && base[y * w + x + 1]) || (y > 0 && base[(y - 1) * w + x]) || (y < h - 1 && base[(y + 1) * w + x])) idx[y * w + x] = 1;
  }
  return idx;
}
// molde no formato dos critérios: retrato sem jóquei, parado com jóquei e 9 quadros de galope (parado deslocado)
function moldeSint(op = {}, galopeDy = [0, 1, 2, 1, 0, 1, 2, 1, 0]) {
  const retrato = sintPorte(op), parado = sintPorte(Object.assign({}, op, { joquei: true }));
  const galope = galopeDy.map(d => sintPorte(Object.assign({}, op, { joquei: true, dy: (op.dy || 0) + d })));
  const anc = { retrato: ancoras(retrato, 64, 64), parado: ancoras(parado, 64, 64) };
  galope.forEach((q, i) => { anc['galope-' + i] = ancoras(q, 64, 64); });
  return { w: 64, h: 64, retrato, parado, galope, ancoras: anc, larguraUtil: anc.retrato.bbox.w };
}
const falhos = lista => lista.filter(c => !c.ok).map(c => c.criterio);
const formaCriterio = c => typeof c.criterio === 'string' && typeof c.ok === 'boolean' && 'valor' in c && typeof c.limite === 'string';

test('medidas num retângulo conhecido: altura, comprimento e espessura do corpo, sem a crina nem o jóquei', () => {
  const r = sintPorte();
  const m = Pc().medidas(r, 64, 64, ancoras(r, 64, 64));
  assert.deepStrictEqual([m.altura, m.comprimento, m.espessura, m.footY, m.nose], [35, 38, 14, 43, [46, 12]]);
  // a crina grande (até y 4, contorno em y 3) muda o bbox e as âncoras, mas não o corpo
  const g = sintPorte({ crina: 'grande' }), ag = ancoras(g, 64, 64);
  assert.ok(ag.bbox.y < 9, 'a crina grande sobe o bbox (y ' + ag.bbox.y + ')');
  const mg = Pc().medidas(g, 64, 64, ag);
  assert.deepStrictEqual([mg.altura, mg.comprimento, mg.espessura, mg.footY, mg.nose], [35, 38, 14, 43, [46, 12]]);
  // jóquei e sela: altura, comprimento e focinho iguais; a espessura vai para a coluna da sela (x 25), do topo da
  // sela (y 20, sobre o lombo) até o contorno da barriga (y 32)
  const j = sintPorte({ joquei: true, crina: 'grande' }), aj = ancoras(j, 64, 64);
  assert.deepStrictEqual(aj.saddle, [25, 21]);
  const mj = Pc().medidas(j, 64, 64, aj);
  assert.deepStrictEqual([mj.altura, mj.comprimento, mj.espessura, mj.footY, mj.nose], [35, 38, 13, 43, [46, 12]]);
  // pernas mais longas sobem a altura; tronco mais grosso sobe a espessura; o comprimento fica
  const e = sintPorte({ perna: 14, esp: 15 }), me = Pc().medidas(e, 64, 64, ancoras(e, 64, 64));
  assert.deepStrictEqual([me.altura, me.comprimento, me.espessura], [42, 38, 17]);
  // sem âncora, calcula a do quadro; quadro vazio não lança
  assert.deepStrictEqual(Pc().medidas(r, 64, 64), m);
  const v = Pc().medidas(new Uint8Array(64 * 64), 64, 64);
  assert.deepStrictEqual([v.altura, v.comprimento, v.espessura], [0, 0, 0]);
});

test('pernas: 4 separadas = 4; duas coladas contam como uma', () => {
  assert.strictEqual(Pc().pernas(sintPorte(), 64, 64, ancoras(sintPorte(), 64, 64)), 4);
  assert.strictEqual(Pc().pernas(sintPorte({ joquei: true }), 64, 64), 4);
  assert.strictEqual(Pc().pernas(sintPorte({ coladas: true }), 64, 64), 3);
});

test('criterioPernas: o sintético de 4 pernas passa; com duas pernas coladas reprova o retrato', () => {
  const ok = Pc().criterioPernas(moldeSint());
  assert.ok(ok.length >= 4 && ok.every(formaCriterio), JSON.stringify(ok));
  assert.deepStrictEqual(falhos(ok), []);
  const m = moldeSint();
  m.retrato = sintPorte({ coladas: true }); m.ancoras.retrato = ancoras(m.retrato, 64, 64);
  const r = Pc().criterioPernas(m), ret = r.find(c => /retrato/.test(c.criterio));
  assert.strictEqual(ret.ok, false); assert.strictEqual(ret.valor, 3); assert.match(ret.limite, /4/);
  assert.deepStrictEqual(falhos(r), [ret.criterio], 'só o retrato reprova');
  // galope: pelo menos 3 em todo quadro e 4 em pelo menos 5 dos 9 — 5 quadros com pernas coladas reprovam
  const g = moldeSint();
  [0, 2, 4, 6, 8].forEach(i => { g.galope[i] = sintPorte({ joquei: true, coladas: true }); g.ancoras['galope-' + i] = ancoras(g.galope[i], 64, 64); });
  const fg = falhos(Pc().criterioPernas(g));
  assert.strictEqual(fg.length, 1, fg.join(' | ')); assert.match(fg[0], /galope/);
  // só os estados presentes entram (o script confere cada etapa sozinha)
  const so = Pc().criterioPernas({ w: 64, h: 64, retrato: sintPorte(), ancoras: {} });
  assert.strictEqual(so.length, 1); assert.strictEqual(so[0].ok, true);
});

test('criterioMesmoCorpo: deslocado 2 px passa, 3 px reprova; uma crina maior não muda o resultado', () => {
  const mestre = moldeSint();
  const c2 = Pc().criterioMesmoCorpo(moldeSint({ dx: 2 }), mestre);
  assert.strictEqual(c2.length, 10, 'retrato e parado × footY, nose.x, nose.y, altura e comprimento');
  assert.ok(c2.every(formaCriterio));
  assert.deepStrictEqual(falhos(c2), []);
  assert.deepStrictEqual(c2.filter(c => /nose\.x/.test(c.criterio)).map(c => c.valor), [2, 2]);
  const c3 = falhos(Pc().criterioMesmoCorpo(moldeSint({ dx: 3 }), mestre));
  assert.strictEqual(c3.length, 2, c3.join(' | ')); c3.forEach(n => assert.match(n, /nose\.x/));
  assert.strictEqual(falhos(Pc().criterioMesmoCorpo(moldeSint({ dy: 3 }), mestre)).length, 4, 'dy 3: footY e nose.y nos 2 estados, e nada mais');
  assert.deepStrictEqual(falhos(Pc().criterioMesmoCorpo(moldeSint({ crina: 'grande' }), mestre)), []);
  assert.deepStrictEqual(Pc().criterioMesmoCorpo(moldeSint({ crina: 'grande' }), mestre).map(c => c.valor), new Array(10).fill(0));
});

test('criterioPortes: esguio ≥ 1,10 × a altura/comprimento do padrão; robusto ≤ 0,92 e espessura ≥ 1,15', () => {
  const padrao = moldeSint();
  const crit = (op, nome) => Pc().criterioPortes({ padrao, [nome]: moldeSint(op) });
  const esgOk = crit({ perna: 14 }, 'esguio');                              // altura 39 / 35 = 1,114
  assert.strictEqual(esgOk.length, 1); assert.ok(esgOk.every(formaCriterio));
  assert.strictEqual(esgOk[0].ok, true, JSON.stringify(esgOk)); assert.ok(Math.abs(esgOk[0].valor - 39 / 35) < 0.001);
  assert.strictEqual(crit({ perna: 12 }, 'esguio')[0].ok, false, 'altura 37 / 35 = 1,057');
  const robOk = crit({ esp: 15, perna: 4 }, 'robusto');                     // altura 32 / 35 = 0,914; espessura 17 / 14 = 1,214
  assert.strictEqual(robOk.length, 2); assert.deepStrictEqual(falhos(robOk), [], JSON.stringify(robOk));
  assert.deepStrictEqual(falhos(crit({ esp: 15, perna: 6 }, 'robusto')).length, 1, 'altura 34 / 35 = 0,971');
  assert.match(falhos(crit({ esp: 15, perna: 6 }, 'robusto'))[0], /altura/);
  assert.match(falhos(crit({ esp: 13, perna: 6 }, 'robusto'))[0], /espessura/, 'espessura 15 / 14 = 1,071');
  const tres = Pc().criterioPortes({ esguio: moldeSint({ perna: 14 }), padrao, robusto: moldeSint({ esp: 15, perna: 4 }) });
  assert.strictEqual(tres.length, 3); assert.deepStrictEqual(falhos(tres), []);
  // sem o padrão não há referência: cada critério reprova, com valor nulo, sem lançar
  const sem = Pc().criterioPortes({ esguio: moldeSint({ perna: 14 }) });
  assert.strictEqual(sem.length, 1); assert.strictEqual(sem[0].ok, false); assert.strictEqual(sem[0].valor, null);
});

test('criterioGalope: lombo estável passa; o lombo pulando 4 px reprova', () => {
  const ok = Pc().criterioGalope(moldeSint());
  assert.strictEqual(ok.length, 3, 'lombo, nose.x contra a pose de corrida e comprimento'); assert.ok(ok.every(formaCriterio));
  assert.deepStrictEqual(falhos(ok), [], JSON.stringify(ok));
  const pulo = Pc().criterioGalope(moldeSint({}, [0, 0, 0, 0, 4, 0, 0, 0, 0]));
  assert.deepStrictEqual(falhos(pulo).length, 1); assert.match(falhos(pulo)[0], /lombo/);
  assert.strictEqual(pulo.find(c => /lombo/.test(c.criterio)).valor, 4);
  // focinho a 7 px da pose de corrida (o quadro 0, ou molde.corrida) reprova; comprimento mudando 5 px reprova
  const m = moldeSint();
  m.galope[3] = sintPorte({ joquei: true, dx: 7 }); m.ancoras['galope-3'] = ancoras(m.galope[3], 64, 64);
  assert.match(falhos(Pc().criterioGalope(m)).join(), /nose/);
  const c = moldeSint();
  c.galope[5] = sintPorte({ joquei: true, comp: 25 }); c.ancoras['galope-5'] = ancoras(c.galope[5], 64, 64);
  assert.match(falhos(Pc().criterioGalope(c)).join(), /comprimento/);
});

// Os 4 moldes de hoje (um porte só, o antigo) pelos critérios novos: só informação, não falha.
test('moldes de hoje: os 4 rodam pelos critérios sem lançar e o relatório sai impresso', () => {
  const lidos = {};
  for (const estilo of ['chamas', 'ondas', 'folhas', 'lisa']) {
    const J = JSON.parse(fs.readFileSync(path.join(DIR, 'molde-' + estilo + '.json'), 'utf8'));
    const idxDe = n => { const d = decodePng(fs.readFileSync(path.join(DIR, 'molde-' + estilo + '-' + n + '.png'))); return Uint8Array.from({ length: 64 * 64 }, (_, i) => Math.round(d.rgba[i * 4] / 25)); };
    lidos[estilo] = { w: 64, h: 64, retrato: idxDe('retrato'), parado: idxDe('parado'),
      galope: Array.from({ length: J.frames }, (_, i) => idxDe('galope-' + i)), ancoras: J.ancoras, larguraUtil: J.larguraUtil };
  }
  const linha = l => l.map(c => (c.ok ? 'ok ' : 'NÃO ') + c.criterio + ' = ' + (typeof c.valor === 'number' ? Math.round(c.valor * 1000) / 1000 : c.valor) + ' (' + c.limite + ')').join('; ');
  for (const [estilo, m] of Object.entries(lidos)) {
    const md = Pc().medidas(m.retrato, 64, 64, m.ancoras.retrato);
    console.log('       ' + estilo + ' — retrato: altura ' + md.altura + ', comprimento ' + md.comprimento + ', espessura ' + md.espessura + ', footY ' + md.footY + ', nose ' + JSON.stringify(md.nose));
    console.log('         pernas: ' + linha(Pc().criterioPernas(m)));
    console.log('         galope: ' + linha(Pc().criterioGalope(m)));
    if (estilo !== 'lisa') console.log('         mesmo corpo (contra lisa), falhas: ' + (falhos(Pc().criterioMesmoCorpo(m, lidos.lisa)).join(', ') || 'nenhuma'));
  }
  console.log('         portes (lisa nos 3 papéis): ' + linha(Pc().criterioPortes({ esguio: lidos.lisa, padrao: lidos.lisa, robusto: lidos.lisa })));
});

test('dry-run: --lote portes --fase mestres sem --gerar lista 3 itens e 12 chamadas, sem rede', () => {
  const novos = path.join(DIR, 'novos'), existia = fs.existsSync(novos);
  // fetch, sockets e http trocados por funções que avisam e lançam: qualquer tentativa de rede aparece no stderr
  const bloqueio = 'data:text/javascript,' + encodeURIComponent([
    'import net from "node:net"; import tls from "node:tls"; import http from "node:http"; import https from "node:https";',
    'const proibido = (o) => () => { process.stderr.write("REDE PROIBIDA: " + o + "\\n"); throw new Error("rede proibida no teste: " + o); };',
    'globalThis.fetch = proibido("fetch");',
    'net.Socket.prototype.connect = proibido("net.Socket.connect"); net.connect = net.createConnection = proibido("net.connect");',
    'tls.connect = proibido("tls.connect"); http.request = http.get = proibido("http"); https.request = https.get = proibido("https");',
  ].join('\n'));
  const r = spawnSync(process.execPath, ['--import', bloqueio, path.join(path.dirname(fileURLToPath(import.meta.url)), 'pixellab-moldes.mjs'), '--lote', 'portes', '--fase', 'mestres'],
    { encoding: 'utf8', env: Object.assign({}, process.env, { NODE_USE_ENV_PROXY: '' }) });
  assert.strictEqual(r.status, 0, 'saída ' + r.status + '\n' + r.stderr + r.stdout);
  assert.ok(!/REDE PROIBIDA/.test(r.stderr), r.stderr);
  assert.match(r.stdout, /nenhuma chamada à API/);
  assert.match(r.stdout, /Itens: 3 \(padrao-lisa, esguio-lisa, robusto-lisa\)/);
  assert.match(r.stdout, /Total previsto: 12 gerações em 12 chamadas novas/);
  for (const ch of ['esguio-lisa', 'padrao-lisa', 'robusto-lisa']) for (const e of ['retrato', 'parado', 'corrida', 'galope']) {
    assert.ok(r.stdout.includes(ch + '/' + e), 'falta ' + ch + '/' + e);
  }
  assert.strictEqual(fs.existsSync(novos), existia, 'o dry-run não cria a pasta novos/');
});

// ---------------------------------------------------------------- Portes: geração com API falsa (pasta temporária)
// O caminho do lote (rodarPortes) com um `executar` falso que desenha cavalos sintéticos: sem rede (fetch trocado por
// um que lança), sem --gerar e sem tocar em assets/pixellab (raw/ e novos/ numa pasta temporária).
section('Portes: geração com API falsa');
const portesLote = await import('./pixellab-portes.mjs').then(M => ({ M }), erro => ({ erro }));
const Pl = () => { if (portesLote.erro) throw portesLote.erro; return portesLote.M; };
async function testA(name, fn) {
  count++;
  try { await fn(); console.log('  ok  ' + name); } catch (e) { fails++; console.log('  FALHA ' + name + '\n       ' + (e.stack || e.message || e)); }
}
const CORPO_FALSO = { padrao: {}, esguio: { perna: 14 }, robusto: { esp: 15, perna: 4 } };
const b64png = rgba => encodePng({ width: 64, height: 64, rgba }).toString('base64');
function descer(rgba, dy) {
  const out = new Uint8Array(rgba.length);
  for (let y = 0; y < 64; y++) if (y - dy >= 0 && y - dy < 64) out.set(rgba.subarray((y - dy) * 256, (y - dy + 1) * 256), y * 256);
  return out;
}
// API falsa: o pixflux devolve o cavalo sintético do porte (lido do texto) e da etapa; o animate devolve 9 quadros
// = o first_frame descido de 0 a 2 px (estável), ou com o lombo pulando 4 px quando regras.pula(seed).
function apiFalsa(regras = {}) {
  const chamadas = [];
  const executar = async (ep, corpo) => {
    if (ep === '/create-image-pixflux') {
      const d = corpo.description;
      const porte = /Mangalarga/.test(d) ? 'esguio' : /Crioulo/.test(d) ? 'robusto' : 'padrao';
      const estilo = /flames/.test(d) ? 'chamas' : /waves/.test(d) ? 'ondas' : /leaves/.test(d) ? 'folhas' : 'lisa';
      const etapa = /no rider/.test(d) ? 'retrato' : /full gallop/.test(d) ? 'corrida' : 'parado';
      chamadas.push({ ep, porte, estilo, etapa, seed: corpo.seed, guia: !!corpo.init_image, forca: corpo.init_image_strength });
      const op = Object.assign({}, CORPO_FALSO[porte], { joquei: etapa !== 'retrato', crina: estilo === 'lisa' ? 'normal' : 'grande' },
        regras.parada ? regras.parada({ porte, estilo, etapa, seed: corpo.seed }) : {});
      const r = { image: { type: 'base64', base64: b64png(rgbaDeIdx(sintPorte(op), 64, 64)) }, usage: { type: 'generations', generations: 1 } };
      return { resultado: r, respostas: [r] };
    }
    chamadas.push({ ep, seed: corpo.seed, frames: corpo.frame_count });
    const f0 = decodePng(Buffer.from(corpo.first_frame.base64, 'base64')).rgba;
    const dys = regras.pula && regras.pula(corpo.seed) ? [0, 0, 0, 0, 4, 0, 0, 0, 0] : [0, 1, 2, 1, 0, 1, 2, 1, 0];
    const post = { background_job_id: 'falso', usage: { type: 'generations', generations: 1 } };
    const job = { status: 'completed', last_response: { images: dys.map(dy => ({ type: 'base64', base64: b64png(descer(f0, dy)) })), usage: { type: 'generations', generations: 1 } } };
    return { resultado: { post, job }, respostas: [post, job] };
  };
  return { executar, chamadas };
}
const semRede = async fn => {
  const antes = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('rede proibida no teste'); };
  try { return await fn(); } finally { globalThis.fetch = antes; }
};
const pastaTemp = () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'portes-teste-'));
  return { raiz, dirs: { raw: path.join(raiz, 'raw'), novos: path.join(raiz, 'novos') } };
};
const lerJ = f => JSON.parse(fs.readFileSync(f, 'utf8'));
// regras do cenário: o retrato do padrão na seed base sai com duas pernas coladas; o galope do robusto pula sempre;
// no piloto, o chamas do esguio sai deslocado 3 px (reprova no mesmo corpo nas 3 seeds)
const CENARIO = {
  parada: ({ porte, estilo, etapa, seed }) => Object.assign({},
    porte === 'padrao' && estilo === 'lisa' && etapa === 'retrato' && seed === 3102 ? { coladas: true } : {},
    porte === 'esguio' && estilo === 'chamas' ? { dx: 3 } : {}),
  pula: seed => seed % 100 === 3,
};
const A = pastaTemp(), logA = [];
const quietoA = m => logA.push(m);

await testA('mestres: 3 seeds por etapa, para na 1ª aprovada; o melhor galope fica e o item sai marcado; finais no formato de hoje', async () => {
  const api = apiFalsa(CENARIO);
  const r = await semRede(() => Pl().rodarPortes({ fase: 'mestres', modo: 'gerar', executar: api.executar, dirs: A.dirs, log: quietoA }));
  assert.strictEqual(r.parada, null, r.parada);
  // 10 imagens paradas (o retrato do padrão uma vez a mais) e 5 galopes (o do robusto nas 3 seeds)
  assert.deepStrictEqual(api.chamadas.map(c => c.ep + ' ' + (c.porte ? c.porte + '/' + c.etapa : 'galope') + ' ' + c.seed), [
    '/create-image-pixflux padrao/retrato 3102', '/create-image-pixflux padrao/retrato 3202', '/create-image-pixflux padrao/parado 3102',
    '/create-image-pixflux padrao/corrida 3102', '/create-image-pixflux esguio/retrato 3101', '/create-image-pixflux esguio/parado 3101',
    '/create-image-pixflux esguio/corrida 3101', '/create-image-pixflux robusto/retrato 3103', '/create-image-pixflux robusto/parado 3103',
    '/create-image-pixflux robusto/corrida 3103', '/animate-with-text-v3 galope 3102', '/animate-with-text-v3 galope 3101',
    '/animate-with-text-v3 galope 3103', '/animate-with-text-v3 galope 3203', '/animate-with-text-v3 galope 3303',
  ]);
  assert.ok(api.chamadas.every(c => !c.guia), 'mestre sem init_image');
  const g = lerJ(path.join(A.dirs.novos, 'gasto.json'));
  assert.deepStrictEqual([g.geracoes, g.chamadas, g.rodadas.length, g.rodadas[0].geracoes], [15, 15, 1, 15]);
  const C = lerJ(path.join(A.dirs.novos, 'criterios.json'));
  const ret = C.itens['padrao-lisa'].etapas.retrato;
  assert.deepStrictEqual([ret.escolhida, ret.tentativas.length, ret.tentativas[0].ok, ret.tentativas[1].ok], [3202, 2, false, true]);
  assert.ok(ret.tentativas[0].criterios.some(c => c.criterio === 'pernas no retrato' && !c.ok && c.valor === 3));
  assert.ok(ret.tentativas.every(t => t.prompt && t.arquivo && t.geracoes === 1 && !('_buf' in t)), 'cada tentativa com prompt, arquivo cru e custo');
  assert.strictEqual(C.itens['padrao-lisa'].ok, true); assert.strictEqual(C.itens['esguio-lisa'].ok, true);
  const rob = C.itens['robusto-lisa'];
  assert.deepStrictEqual([rob.ok, rob.completo, rob.final, rob.etapas.galope.tentativas.length, rob.etapas.galope.escolhida], [false, true, true, 3, 3103]);
  assert.ok(rob.falhas.length === 1 && /^galope: lombo na coluna da sela = 4/.test(rob.falhas[0]), rob.falhas.join(' | '));
  assert.ok(logA.some(m => /fica o melhor galope, a seed 3103/.test(m)));
  // portes distintos nos 3 mestres (o esguio e o robusto também já passaram no aceite do próprio retrato)
  assert.deepStrictEqual(C.portes.faltam, []); assert.strictEqual(C.portes.criterios.length, 3);
  assert.ok(C.portes.criterios.every(c => c.ok), JSON.stringify(C.portes.criterios));
  assert.ok(C.itens['esguio-lisa'].etapas.retrato.tentativas[0].criterios.some(c => /esguio/.test(c.criterio) && c.ok));
  // os finais: 3 JSON + 33 PNGs, com os campos dos moldes de hoje, na mesma ordem
  const arqs = fs.readdirSync(A.dirs.novos).filter(f => /^molde-/.test(f));
  assert.strictEqual(arqs.length, 3 * 12);
  const J = lerJ(path.join(A.dirs.novos, 'molde-padrao-lisa.json')), hoje = lerJ(path.join(DIR, 'molde-chamas.json'));
  assert.deepStrictEqual(Object.keys(J), Object.keys(hoje));
  assert.deepStrictEqual([J.estilo, J.w, J.h, J.frames, J.seeds], ['padrao-lisa', 64, 64, 9, { retrato: 3202, parado: 3102, montado: 3102, galope: 3102 }]);
  const m = Pl().lerMolde(A.dirs.novos, 'padrao-lisa');
  assert.deepStrictEqual(J.ancoras.retrato, ancoras(m.retrato, 64, 64));
  assert.deepStrictEqual(falhos(Pc().criterioPernas(m)), []);
});

await testA('mestres de novo: tudo reaproveitado de raw/, nenhuma chamada e o gasto não muda', async () => {
  const antes = fs.readFileSync(path.join(A.dirs.novos, 'molde-robusto-lisa-galope-4.png'));
  const api = apiFalsa(CENARIO);
  const r = await semRede(() => Pl().rodarPortes({ fase: 'mestres', modo: 'gerar', executar: api.executar, dirs: A.dirs, log: () => {} }));
  assert.strictEqual(api.chamadas.length, 0); assert.strictEqual(r.gasto, 0);
  assert.strictEqual(lerJ(path.join(A.dirs.novos, 'gasto.json')).geracoes, 15);
  assert.ok(fs.readFileSync(path.join(A.dirs.novos, 'molde-robusto-lisa-galope-4.png')).equals(antes));
});

await testA('teto somado entre rodadas: a chamada que passaria do teto não sai; a rodada seguinte retoma de raw/', async () => {
  const B = pastaTemp(), api = apiFalsa(CENARIO);
  const r1 = await semRede(() => Pl().rodarPortes({ fase: 'mestres', teto: 5, modo: 'gerar', executar: api.executar, dirs: B.dirs, log: () => {} }));
  assert.match(r1.parada || '', /^TETO: parou antes de esguio-lisa\/parado/);
  assert.strictEqual(api.chamadas.length, 5);
  assert.deepStrictEqual([lerJ(path.join(B.dirs.novos, 'gasto.json')).geracoes, lerJ(path.join(B.dirs.novos, 'gasto.json')).rodadas[0].parada.slice(0, 5)], [5, 'TETO:']);
  const C1 = lerJ(path.join(B.dirs.novos, 'criterios.json'));
  assert.deepStrictEqual([C1.itens['padrao-lisa'].completo, C1.itens['esguio-lisa'].completo], [false, false]);
  assert.ok(!fs.existsSync(path.join(B.dirs.novos, 'molde-padrao-lisa.json')), 'sem final antes do galope');
  // o dry-run vê o gasto e o que já está em raw/
  const linhas = [];
  await Pl().dryRunPortes({ fase: 'mestres', teto: 5, dirs: B.dirs }, l => linhas.push(l));
  assert.match(linhas.join('\n'), /já gastas 5, sobram 0/);
  assert.match(linhas.join('\n'), /cortou 8 chamada\(s\), a partir de esguio-lisa\/parado/);
  assert.match(linhas.join('\n'), /padrao-lisa\/retrato \(seed 3102, reprovada\), padrao-lisa\/retrato \(seed 3202\)/);
  const api2 = apiFalsa(CENARIO);
  const r2 = await semRede(() => Pl().rodarPortes({ fase: 'mestres', teto: 90, modo: 'gerar', executar: api2.executar, dirs: B.dirs, log: () => {} }));
  assert.strictEqual(r2.parada, null); assert.strictEqual(api2.chamadas.length, 10);
  const g = lerJ(path.join(B.dirs.novos, 'gasto.json'));
  assert.deepStrictEqual([g.geracoes, g.chamadas, g.rodadas.map(x => x.geracoes)], [15, 15, [5, 10]]);
  fs.rmSync(B.raiz, { recursive: true, force: true });
});

await testA('piloto com init_image do mestre; reprovado no mesmo corpo ⇒ as versões daquele porte saem sem init_image', async () => {
  const api = apiFalsa(CENARIO);
  const r = await semRede(() => Pl().rodarPortes({ fase: 'piloto', modo: 'gerar', executar: api.executar, dirs: A.dirs, log: () => {} }));
  assert.strictEqual(r.parada, null);
  const paradas = api.chamadas.filter(c => c.porte);
  assert.ok(paradas.length && paradas.every(c => c.guia && c.forca === Pl().FORCA_GUIA && c.estilo === 'chamas'), 'piloto: chamas com init_image');
  // o esguio deslocado 3 px: retrato e parado nas 3 seeds (3401, 3501, 3601); a corrida não tem o critério
  assert.deepStrictEqual(paradas.filter(c => c.porte === 'esguio').map(c => c.etapa + ' ' + c.seed),
    ['retrato 3401', 'retrato 3501', 'retrato 3601', 'parado 3401', 'parado 3501', 'parado 3601', 'corrida 3401']);
  const C = lerJ(path.join(A.dirs.novos, 'criterios.json'));
  assert.deepStrictEqual([C.piloto.esguio.mesmoCorpo, C.piloto.padrao.mesmoCorpo, C.piloto.robusto.mesmoCorpo], [false, true, true]);
  assert.ok(C.itens['esguio-chamas'].falhas.some(f => /mesmo corpo no retrato: nose\.x/.test(f)));
  assert.ok(C.itens['esguio-chamas'].etapas.retrato.tentativas[0].init_image.startsWith('raw/portes-esguio-lisa-retrato-s3101'));
  assert.ok(C.itens['padrao-chamas'].ok, C.itens['padrao-chamas'].falhas.join(' | '));
  assert.strictEqual(lerJ(path.join(A.dirs.novos, 'gasto.json')).geracoes, 15 + api.chamadas.length);
  // versões: o esguio sem init_image (chamas refeito) e os outros dois portes com
  const itens = Pl().itensDaFase('versoes', { piloto: C.piloto });
  assert.deepStrictEqual(itens.map(i => i.chave + (i.guia ? '+' : '') + ' ' + i.seedBase), [
    'esguio-chamas 3701', 'esguio-ondas 3704', 'esguio-folhas 3707', 'padrao-ondas+ 3405', 'padrao-folhas+ 3408', 'robusto-ondas+ 3406', 'robusto-folhas+ 3409']);
  const linhas = [];
  await Pl().dryRunPortes({ fase: 'versoes', dirs: A.dirs }, l => linhas.push(l));
  const txt = linhas.join('\n');
  assert.match(txt, /Itens: 7 \(/);
  assert.match(txt, /o piloto de esguio reprovou no "mesmo corpo" nas 3 seeds: as versões de esguio saem sem init_image/);
  assert.match(txt, /padrao-ondas\/retrato +seed 3405/);
  assert.match(txt, /init_image = raw\/portes-padrao-lisa-retrato-s3202\.png; init_image_strength/);
  assert.ok(!/esguio-ondas\/retrato[^\n]*\n[^\n]*init_image/.test(txt), 'esguio sem init_image');
});

await testA('versões: o porte do piloto reprovado sai sem init_image (seeds 3701+); os outros com o mestre no mesmo estado', async () => {
  const api = apiFalsa(CENARIO), log = [];
  const r = await semRede(() => Pl().rodarPortes({ fase: 'versoes', modo: 'gerar', executar: api.executar, dirs: A.dirs, log: m => log.push(m) }));
  assert.strictEqual(r.parada, null);
  assert.ok(log.some(m => /^AVISO: o piloto de esguio reprovou no "mesmo corpo" nas 3 seeds: as versões de esguio saem sem init_image/.test(m)), 'o script diz');
  const paradas = api.chamadas.filter(c => c.porte);
  assert.ok(paradas.filter(c => c.porte === 'esguio').every(c => !c.guia && c.seed >= 3701), 'esguio sem init_image');
  assert.ok(paradas.filter(c => c.porte !== 'esguio').every(c => c.guia && c.seed >= 3405 && c.seed < 3700), 'padrão e robusto com init_image');
  assert.deepStrictEqual([...new Set(paradas.map(c => c.porte + '-' + c.estilo))].sort(),
    ['esguio-chamas', 'esguio-folhas', 'esguio-ondas', 'padrao-folhas', 'padrao-ondas', 'robusto-folhas', 'robusto-ondas']);
  assert.strictEqual(fs.readdirSync(A.dirs.novos).filter(f => /^molde-.*\.json$/.test(f)).length, 12);
  assert.ok(lerJ(path.join(A.dirs.novos, 'gasto.json')).geracoes <= Pl().TETO_PADRAO);
});

await testA('folha dos mestres: os 3 em 1× e 4×, o galope animado, os critérios e o reprovado marcado; determinística', async () => {
  const F = await import('./folha-portes.mjs');
  const d = F.dadosMestres(A.dirs.novos), html = F.htmlFolhaMestres(d);
  assert.ok(html.startsWith('<!doctype html>')); assert.strictEqual(html, F.htmlFolhaMestres(F.dadosMestres(A.dirs.novos)));
  for (const ch of ['esguio-lisa', 'padrao-lisa', 'robusto-lisa']) assert.ok(html.includes('id="' + ch + '"'), ch);
  assert.match(html, /<title>Mestres dos portes<\/title>/);
  assert.strictEqual((html.match(/class="anim g1"/g) || []).length, 3); assert.strictEqual((html.match(/class="anim g4"/g) || []).length, 3);
  assert.strictEqual((html.match(/em 4×"/g) || []).length, 3 * 2 + 3, 'retrato e parado em 4× (img) e o galope em 4× (aria-label)');
  assert.ok(!/https?:\/\//.test(html.replace(/xmlns="[^"]*"/g, '')), 'autocontida: nada de rede');
  assert.strictEqual(d.portes.length, 3); assert.ok(d.portes.every(c => c.ok));
  assert.match(html, /id="robusto-lisa"[^>]*>.*?reprovado/s);
  assert.match(html, /NÃO<\/span> galope: lombo na coluna da sela: 4/);
  for (const c of ['pernas no retrato', 'pernas no parado', 'pernas no galope (todo quadro)', 'galope: nose.x contra a pose de corrida', 'portes: altura/comprimento do esguio']) assert.ok(html.includes(c), c);
  // sem um mestre: "falta"; sem o padrão: os portes distintos dizem que falta a régua
  const sem = F.dadosMestres(A.dirs.novos);
  sem.itens[1].molde = null; sem.portes = []; sem.semPadrao = true;
  const h2 = F.htmlFolhaMestres(sem);
  assert.match(h2, /falta: molde-padrao-lisa/); assert.match(h2, /sem o mestre do padrão/);
});

await testA('folha final: com os 12, embute os scripts e a tabela __MOLDES de novos/; com menos, diz o que falta e desenha direto', async () => {
  const F = await import('./folha-portes.mjs');
  const { lerMoldes } = await import('./arte-embutida.mjs');
  const d = F.dadosFinal(A.dirs.novos);
  assert.deepStrictEqual(d.faltam, []);
  assert.deepStrictEqual(Object.keys(d.cavalos), ['chamas', 'ondas', 'folhas']);
  assert.deepStrictEqual(d.cavalos.chamas.map(m => m.id + ' ' + m.raridade), ['brasa comum', 'w-ticao magico', 'w-boitata mitico']);
  assert.deepStrictEqual(d.cavalos.folhas.map(m => m.id + ' ' + m.raridadeDoCavalo + '→' + m.raridade), ['ipe comum→comum', 'w-mandacaru magico→magico', 'w-jequitiba lendario→mitico']);
  const avisos = [], moldes = await lerMoldes(path.dirname(A.dirs.novos), avisos, 'novos');
  assert.deepStrictEqual(avisos, []); assert.strictEqual(Object.keys(moldes.estilos).length, 12);
  const fontes = Object.fromEntries(['data.js', 'sim.js', 'breed.js', 'marcas.js', 'sprites.js'].map(n => [n, fs.readFileSync(path.join(DIR, '..', '..', 'src', n), 'utf8')]));
  const html = F.htmlFolhaFinal(d, { fontes, moldes });
  assert.match(html, /<title>Folha final dos portes<\/title>/);
  assert.match(html, /window\.__MOLDES = \{"estilos":/); assert.ok(html.includes('Sprites.drawHorse(g, x0, y0, o)'));
  assert.strictEqual((html.match(/data-chave="/g) || []).length, 9);
  assert.ok(html.includes('root.Sprites = factory'), 'sprites.js embutido');
  assert.match(html, /id="esguio-chamas"[^>]*>.*?reprovado/s, 'o piloto reprovado no mesmo corpo sai marcado');
  assert.ok(!/Faltam/.test(html));
  // com menos de 12: diz quais faltam e desenha direto, sem scripts
  const parcial = F.dadosFinal(A.dirs.novos);
  parcial.faltam = ['robusto-folhas']; parcial.itens.find(i => i.chave === 'robusto-folhas').molde = null;
  const h2 = F.htmlFolhaFinal(parcial, { fontes, moldes });
  assert.match(h2, /Faltam 1 dos 12 moldes: robusto-folhas/); assert.ok(!h2.includes('<script>')); assert.match(h2, /class="anim g4"/);
  // o build não lê novos/: o lerMoldes padrão continua só em assets/pixellab
  assert.ok(!Object.keys((await lerMoldes(path.join(DIR, '..', '..'))).estilos).some(k => /-/.test(k)), 'sem chave de porte vinda de novos/');
});

await testA('--reprocessar refaz os finais de novos/ só de raw/, sem chamada e sem mexer no gasto', async () => {
  const antes = {};
  for (const f of fs.readdirSync(A.dirs.novos).filter(f => /^molde-.*-lisa/.test(f))) { antes[f] = fs.readFileSync(path.join(A.dirs.novos, f)); fs.unlinkSync(path.join(A.dirs.novos, f)); }
  const gasto = fs.readFileSync(path.join(A.dirs.novos, 'gasto.json'));
  const r = await semRede(() => Pl().rodarPortes({ fase: 'mestres', modo: 'reprocessar', executar: () => { throw new Error('chamou a API'); }, dirs: A.dirs, log: () => {} }));
  assert.strictEqual(r.parada, null);
  for (const [f, buf] of Object.entries(antes)) assert.ok(fs.readFileSync(path.join(A.dirs.novos, f)).equals(buf), f);
  assert.ok(fs.readFileSync(path.join(A.dirs.novos, 'gasto.json')).equals(gasto));
  // sem a imagem crua, o item fica incompleto (os outros seguem)
  fs.unlinkSync(path.join(A.dirs.raw, 'portes-esguio-lisa-parado-s3101.png'));
  fs.unlinkSync(path.join(A.dirs.raw, 'portes-esguio-lisa-parado-s3101.json'));
  const r2 = await semRede(() => Pl().rodarPortes({ fase: 'mestres', modo: 'reprocessar', dirs: A.dirs, log: () => {} }));
  const C = lerJ(path.join(A.dirs.novos, 'criterios.json'));
  assert.strictEqual(r2.parada, null);
  assert.ok(C.itens['esguio-lisa'].falhas.some(f => /faltaria gerar esguio-lisa\/parado seed 3101/.test(f)), C.itens['esguio-lisa'].falhas.join(' | '));
  assert.strictEqual(C.itens['padrao-lisa'].ok, true);
});
fs.rmSync(A.raiz, { recursive: true, force: true });

console.log('\n' + count + ' testes, ' + fails + ' falhas');
process.exit(fails ? 1 : 0);
