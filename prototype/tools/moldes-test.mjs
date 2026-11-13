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
import { PAPEIS, paletaPng, normalizar, validar, ancoras, paraCinza, deCinza, sombrearRegioes, limparJoquei, limiarOtsu, classificarFamilias, limiaresDeTons, posProcessar, contornar, passada, sombraMagenta, sedaNaPelagem, crinaEscura, corrigirGrupo, modoNatural } from './moldes-lib.mjs';

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

section('correções de grupo (tarefa 6a: seda no corpo, crina escura e jóquei no cru de cores naturais)');
// Imagem RGBA a partir de um mapa de letras (cada linha uma string; '.' = transparente) e das cores de cada letra.
function rgbaDeMapa(linhas, cores) {
  const w = linhas[0].length, h = linhas.length, rgba = new Uint8Array(w * h * 4);
  linhas.forEach((l, y) => [...l].forEach((ch, x) => {
    if (ch === '.') return;
    rgba.set(hex(cores[ch]), (y * w + x) * 4); rgba[(y * w + x) * 4 + 3] = 255;
  }));
  return { rgba, w, h };
}
const famDe = (linhas, cores) => { const m = rgbaDeMapa(linhas, cores); return classificarFamilias(m.rgba, m.w, m.h); };
// o caminho antigo (sem correção de grupo) e o novo, para um grupo de quadros com jóquei
const papeisSem = (fams, opts) => { const t = limiaresDeTons(fams); return fams.map(f => posProcessar(f, t, opts).idx); };
const papeisCom = (fams, opts) => { const g = corrigirGrupo(fams, opts); return papeisSem(g.fams, opts); };
const pos = (linhas, ch) => { const r = []; linhas.forEach((l, y) => [...l].forEach((c, x) => { if (c === ch) r.push(y * linhas[0].length + x); })); return r; };
// pelagem carmim (#bc0254, 334°) com a sombra puxando para o roxo (#3c0229, 320°: cai na faixa magenta), seda amarela
const CORES_CARMIM = { C: '#bc0254', d: '#3c0229', Y: '#ffff00', P: '#ffc0cb', k: '#050203' };
const MAPA_CARMIM = [
  '....kYYYk.....',
  '....kYPYk.....',
  '....kYYYk.....',
  'kkkkddddCCCCkk',
  'kCCCddddCCCCCk',
  'kCCddddddCCCCk',
  'kCCCCCCCCCCCCk',
  'kkkkkkkkkkkkkk',
];
test('sombraMagenta: a sombra roxa da pelagem carmim vira pelagem (antes: seda no corpo, a listra do galope da Maré)', () => {
  const f = famDe(MAPA_CARMIM, CORES_CARMIM), ds = pos(MAPA_CARMIM, 'd');
  assert.ok(ds.every(i => f.idx[i] === 7 && f.magenta[i] === 1), 'a sombra cai na faixa magenta (seda)');
  const antes = papeisSem([f], { comJoquei: true })[0];
  assert.ok(ds.every(i => antes[i] === 7), 'sem a correção, encostada no jóquei, a limpeza a mantinha como seda');
  const sm = sombraMagenta([f]);
  assert.deepStrictEqual([sm.cores, sm.pixels], [[0x3c0229], ds.length]);
  assert.ok(ds.every(i => sm.fams[0].idx[i] === 2 && !sm.fams[0].magenta[i]), 'vira família 2, sem a marca de magenta');
  assert.strictEqual(f.idx[ds[0]], 7, 'pura: não altera a entrada');
  const depois = papeisCom([f], { comJoquei: true })[0];
  assert.ok(ds.every(i => depois[i] === 3), 'e sai como sombra da pelagem pelo Otsu (lum 24 × 67)');
  assert.ok(pos(MAPA_CARMIM, 'Y').every(i => depois[i] === 7), 'a seda continua seda');
});
test('sombraMagenta: a sombra escura da seda rosa (encosta no jóquei) e a sela magenta clara continuam seda', () => {
  // P = seda rosa clara (#e254a4, magenta clara: não é candidata), m = sombra dela (#78184d, escura: candidata), S = sela
  // magenta clara (#fc0898) em cima da pelagem castanha (#85363b)
  const L = ['..PPPP....', '..PmmP....', '..PmmP....', '..YYYY....', 'CCSSSSCCCC', 'CCCSSCCCCC', 'CCCCCCCCCC'];
  const f = famDe(L, { P: '#e254a4', m: '#78184d', Y: '#ffff00', S: '#fc0898', C: '#85363b' });
  const sm = sombraMagenta([f]);
  assert.deepStrictEqual([sm.cores, sm.pixels], [[], 0]);
  assert.strictEqual(sm.fams[0], f, 'nada a mudar: o mesmo quadro');
});
test('sombraMagenta: decide por cor no grupo todo (o galope não pisca) e em cadeia', () => {
  // quadro 1: a sombra d (#3c0229) só encosta na seda e em e; no quadro 0 ela encosta mais na pelagem, e no grupo a
  // pelagem ganha ⇒ pelagem nos dois quadros. e (#4b012c) só encosta em d: vira pelagem em cadeia, depois que d virou.
  const cores = { C: '#bc0254', d: '#3c0229', e: '#4b012c', Y: '#ffff00' };
  const q0 = famDe(['CCCCCCCCCC', 'CddddddddC', 'CCCCCCCCCC', 'CddddddddC', 'CCCCCCCCCC'], cores);
  const q1 = famDe(['YYYYY', 'YdddY', 'YdedY', 'YdddY', 'YYYYY'], cores);
  const sm = sombraMagenta([q0, q1]);
  assert.deepStrictEqual(sm.cores, [0x3c0229, 0x4b012c]);
  assert.strictEqual(Array.from(sm.fams[1].idx).join(''), '7777772227722277222777777', 'no quadro 1 também, cercada de seda');
  // sozinho, o quadro 1 não converte nada (só encosta na seda); sem o quadro 1, e não aparece
  assert.deepStrictEqual(sombraMagenta([q1]).cores, []);
  assert.deepStrictEqual(sombraMagenta([q0]).cores, [0x3c0229]);
});
// cavalo de cores naturais (o robusto de 2026-11-13): pelagem castanha, crina e cauda pretas grossas, contorno preto
// fino, patas pretas, jóquei de seda carmim (a mesma família da pelagem) com capacete amarelo, rosto e calça branca
const CORES_NATURAL = { k: '#090605', c: '#885035', s: '#54251d', n: '#181626', Y: '#fbd26e', P: '#f9b799', J: '#90274c', H: '#ec578e', W: '#fcfbfb', b: '#0b0808' };
const MAPA_NATURAL = [
  '.........kYYk..........',
  '.........kPPk.....kk...',
  '........kJHJk....knnk..',
  '........kJJJk...knnnck.',
  '........kJHJk..knnnccck',
  '.......kWWWWWkknnnccck.',
  '..kk..kYWbbWYknnncck...',
  '.knnkkkYYbbYYknnncck...',
  '.knnkcckYbbYkccccck....',
  '.knnkccckYYkcccccck....',
  '.knnkcccccccccccsck....',
  '.knnkcsssssssssssck....',
  '..knkkkkkkkkkkkkkk.....',
  '..knk.kbbk...kbbk......',
  '..knk.kbbk...kbbk......',
  '...k..kbbk...kbbk......',
  '......kbbk...kbbk......',
  '......kkkk...kkkk......',
];
test('modo natural: grupo sem nenhum pixel da família crina; com crina pedida, nada muda', () => {
  const f = famDe(MAPA_NATURAL, CORES_NATURAL);
  assert.strictEqual(modoNatural([f]), true);
  const verde = famDe(MAPA_NATURAL, Object.assign({}, CORES_NATURAL, { n: '#008000' }));
  assert.strictEqual(modoNatural([verde]), false);
  const g = corrigirGrupo([verde], { comJoquei: true });
  assert.deepStrictEqual([g.natural, g.seda.pixels, g.crina], [false, 0, [0]]);
  assert.strictEqual(g.fams[0], verde, 'grupo com crina pedida passa sem mudança');
});
test('sedaNaPelagem: a seda carmim que caiu na família da pelagem volta a ser seda (o jóquei escuro do robusto-folhas)', () => {
  const f = famDe(MAPA_NATURAL, CORES_NATURAL), J = pos(MAPA_NATURAL, 'J'), H = pos(MAPA_NATURAL, 'H');
  assert.ok([...J, ...H].every(i => f.idx[i] === 2), 'a seda carmim (#90274c, #ec578e) cai na família 2, como a pelagem');
  const antes = papeisSem([f], { comJoquei: true })[0];
  const capacete = pos(MAPA_NATURAL, 'Y').filter(i => i < MAPA_NATURAL[0].length);
  assert.ok(capacete.every(i => antes[i] !== 7), 'sem a correção: o capacete fica solto e a limpeza o apaga');
  const sp = sedaNaPelagem([f]);
  assert.deepStrictEqual(sp.cores, [0x90274c, 0xec578e], 'o brilho #ec578e entra em cadeia (só encosta na sombra da seda)');
  assert.ok(pos(MAPA_NATURAL, 'c').every(i => sp.fams[0].idx[i] === 2), 'a pelagem fica pelagem');
  const depois = papeisCom([f], { comJoquei: true })[0];
  assert.ok([...J, ...H, ...capacete].every(i => depois[i] === 7), 'tronco e capacete de seda');
  assert.ok(pos(MAPA_NATURAL, 'P').every(i => depois[i] === 8), 'o rosto fica (pele)');
});
test('crinaEscura: a crina e a cauda pretas grossas viram crina; contorno fino, patas, bota sob o jóquei e borda ficam', () => {
  const f = sedaNaPelagem([famDe(MAPA_NATURAL, CORES_NATURAL)]).fams[0], L = MAPA_NATURAL[0].length;
  const r = crinaEscura(f, { comJoquei: true, evitar: new Set([0x90274c, 0xec578e]) });
  const no = (x, y) => r.fam.idx[y * L + x];
  assert.ok(r.pixels > 0);
  assert.strictEqual(no(17, 4), 4, 'crina (miolo da mancha no pescoço)'); assert.strictEqual(no(2, 8), 4, 'cauda');
  assert.strictEqual(no(3, 14), 4, 'a cauda inteira, também abaixo da metade (o componente começa no alto)');
  assert.strictEqual(no(1, 8), 1, 'a borda da cauda (encosta no fundo) fica contorno');
  assert.strictEqual(no(7, 14), 1, 'a pata preta (começa embaixo da barriga) fica');
  assert.strictEqual(no(9, 7), 1, 'a bota entre a calça e a manta (dentro da caixa do jóquei) fica');
  assert.strictEqual(no(10, 8), 1);
  assert.strictEqual(no(9, 12), 1, 'a linha fina do contorno da barriga fica');
  assert.strictEqual(f.idx[4 * L + 17], 1, 'pura');
  // sem jóquei (retrato), a mesma imagem não tem caixa: a bota vira crina — o retrato natural não tem jóquei
  assert.strictEqual(crinaEscura(f).fam.idx[7 * L + 9], 4);
});
test('corrigirGrupo no cru natural: crina e jóquei de volta, e a forma passa (papéis 4, 7 e 8)', () => {
  const f = famDe(MAPA_NATURAL, CORES_NATURAL), m = rgbaDeMapa(MAPA_NATURAL, CORES_NATURAL);
  const sem = posProcessar(f, limiaresDeTons([f]), { comJoquei: true });
  assert.match(validar(sem, { exigeJoquei: true }).motivo, /faltam papéis: 4 \(crina\)/);
  const g = corrigirGrupo([f], { comJoquei: true }), q = posProcessar(g.fams[0], limiaresDeTons(g.fams), { comJoquei: true });
  assert.deepStrictEqual([g.natural, g.seda.cores.length > 0, g.crina[0] > 0], [true, true, true]);
  assert.ok([4, 7, 8].every(p => q.papeis.has(p)), [...q.papeis].join(','));
  assert.strictEqual(m.w, MAPA_NATURAL[0].length);
});
// Os crus de verdade (raw/ é versionado): os defeitos da folha final de 2026-11-13 e os crus do lote antigo.
const RAW = path.join(DIR, 'raw');
const lerCruRaw = nome => decodePng(fs.readFileSync(path.join(RAW, nome)));
const grupoCru = (base, n) => (n ? Array.from({ length: n }, (_, i) => `${base}-${i}.png`) : [base + '.png']).map(f => classificarFamilias(lerCruRaw(f).rgba, 64, 64));
const temCru = nome => fs.existsSync(path.join(RAW, nome));
if (!temCru('portes-padrao-ondas-galope-c3505g100m4102-s3405-0.png')) console.log('  sem os crus dos portes — bloco pulado');
else {
  test('cru padrao-ondas (galope 3405): a sombra carmim não sobra como seda no corpo; antes, 2005 pixels', () => {
    const fams = grupoCru('portes-padrao-ondas-galope-c3505g100m4102-s3405', 9), sombra = new Set([0x3c0229, 0x4b012c, 0x6a0238, 0x76013c]);
    const conta = papeis => papeis.reduce((n, q, k) => n + q.filter((v, i) => v === 7 && sombra.has(fams[k].cor[i])).length, 0);
    assert.strictEqual(conta(papeisSem(fams, { comJoquei: true, contorno: true })), 2005);
    assert.strictEqual(conta(papeisCom(fams, { comJoquei: true, contorno: true })), 0);
  });
  test('crus do robusto (parado das 4 versões): crina achada e a forma passa; no folhas, o jóquei de seda e pele', () => {
    for (const [base, falta] of [['portes-robusto-lisa-parado-g35padrao3102-s5103', /faltam papéis: 4/], ['portes-robusto-chamas-parado-g100m5103-s3503', /fora da paleta/],
      ['portes-robusto-ondas-parado-g100m5103-s3406', /fora da paleta/], ['portes-robusto-folhas-parado-g100m5103-s3609', /faltam papéis: 4 \(crina\), 8/]]) {
      const fams = grupoCru(base), t0 = limiaresDeTons(fams), q0 = posProcessar(fams[0], t0, { comJoquei: true });
      assert.ok(!q0.papeis.has(4) && !q0.papeis.has(5), base + ': antes, sem crina (a crina preta saía como contorno)');
      assert.match(validar(q0, { exigeJoquei: true }).motivo, falta);
      const g = corrigirGrupo(fams, { comJoquei: true }), q = posProcessar(g.fams[0], limiaresDeTons(g.fams), { comJoquei: true });
      const crina = q.idx.filter(v => v === 4 || v === 5).length;
      assert.ok(g.natural && crina >= 80, `${base}: ${crina} pixels de crina`);
      if (/folhas/.test(base)) {
        assert.strictEqual(validar(q, { exigeJoquei: true }).ok, true, validar(q, { exigeJoquei: true }).motivo);
        assert.deepStrictEqual(g.seda.cores, [0x7d273c, 0x90274c, 0xa9496f, 0xd95480, 0xec578e]);
        assert.ok(q.idx.filter(v => v === 7).length >= 100 && q.idx.filter(v => v === 8).length >= 5, 'seda e rosto de volta');
      }
    }
  });
}
test('crus do lote antigo (os 4 moldes do jogo e as tentativas deles): nenhuma correção de grupo se aplica', () => {
  const crus = fs.existsSync(RAW) ? fs.readdirSync(RAW).filter(f => f.endsWith('.png') && !f.startsWith('portes-')) : [];
  const grupos = new Map();
  for (const f of crus) { const m = /^(.*-galope-.*)-\d+\.png$/.exec(f), k = m ? m[1] : f; grupos.set(k, [...(grupos.get(k) || []), f]); }
  let n = 0;
  for (const [k, arqs] of grupos) {
    const fams = arqs.map(f => lerCruRaw(f)).filter(d => d.width === 64).map(d => classificarFamilias(d.rgba, 64, 64));
    if (!fams.length) continue;
    n++;
    for (const comJoquei of [false, true]) {
      const g = corrigirGrupo(fams, { comJoquei });
      assert.ok(!g.natural && !g.sombraMagenta.pixels && g.fams.every((f, i) => f === fams[i]), k);
    }
  }
  if (crus.length) assert.ok(n >= 16, 'grupos: ' + n);
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
// dx/dy deslocam tudo; furos abre 6 buracos isolados no tronco (reprova na forma, "silhueta aberta", sem mudar o
// corpo medido); sem = as pernas que não saem (0 e 1 as de trás, 2 e 3 as da frente: sem [1, 3] ⇒ 2 pernas). Medidas esperadas (corpo = pelagem + contorno encostado nela): topo 9 (contorno da orelha),
// footY 43 (contorno do casco) ⇒ altura 35; corpo de x 9 a x 46 ⇒ comprimento 38; nose [46, 12]; espessura 14 na
// coluna 28 (meio do corpo: contorno do lombo em y 19 até o da barriga em y 32).
function sintPorte({ esp = 12, perna = 10, comp = 30, coladas = false, joquei = false, crina = 'normal', dx = 0, dy = 0, top = 20, furos = false, sem = [] } = {}) {
  const w = 64, h = 64, idx = new Uint8Array(w * h);
  const ret = (x0, y0, x1, y1, v) => {
    for (let y = y0 + dy; y <= y1 + dy; y++) for (let x = x0 + dx; x <= x1 + dx; x++) if (x >= 0 && y >= 0 && x < w && y < h) idx[y * w + x] = v;
  };
  const fim = 10 + comp - 1;
  ret(10, top, fim, top + esp - 3, 2); ret(10, top + esp - 2, fim, top + esp - 1, 3);
  ret(fim + 1, top - 8, fim + 6, top + 1, 2); ret(fim + 5, top - 10, fim + 5, top - 9, 2);
  if (crina === 'grande') ret(fim - 7, top - 16, fim, top - 1, 4); else ret(fim - 3, top - 6, fim, top - 1, 4);
  ret(4, top, 9, top + 10, 4);
  [[12, 13], coladas ? [14, 15] : [17, 18], [fim - 8, fim - 7], [fim - 3, fim - 2]].forEach(([a, b], k) => {
    if (sem.includes(k)) return;
    ret(a, top + esp, b, top + esp + perna - 1, 2); ret(a, top + esp + perna, b, top + esp + perna, 6);
  });
  if (joquei) { ret(22, top, 27, top + 1, 9); ret(23, top - 8, 26, top - 1, 7); ret(24, top - 10, 25, top - 9, 8); ret(23, top - 12, 26, top - 11, 7); }
  const base = idx.slice();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (base[y * w + x]) continue;
    if ((x > 0 && base[y * w + x - 1]) || (x < w - 1 && base[y * w + x + 1]) || (y > 0 && base[(y - 1) * w + x]) || (y < h - 1 && base[(y + 1) * w + x])) idx[y * w + x] = 1;
  }
  if (furos) for (const [x, y] of [[14, 3], [18, 5], [22, 3], [26, 6], [30, 4], [34, 7]]) idx[(top + y + dy) * w + x + dx] = 0;
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
  assert.ok(ok.length === 3 && ok.every(formaCriterio), JSON.stringify(ok)); // retrato, parado e galope
  assert.deepStrictEqual(falhos(ok), []);
  const m = moldeSint();
  m.retrato = sintPorte({ coladas: true }); m.ancoras.retrato = ancoras(m.retrato, 64, 64);
  const r = Pc().criterioPernas(m), ret = r.find(c => /retrato/.test(c.criterio));
  assert.strictEqual(ret.ok, false); assert.strictEqual(ret.valor, 3); assert.match(ret.limite, /4/);
  assert.deepStrictEqual(falhos(r), [ret.criterio], 'só o retrato reprova');
  // galope (regra de 2026-11-13): pelo menos 2 em todo quadro, e só isso — nada mais de "4 em 5 dos 9"
  assert.strictEqual(Pc().LIMITES.galopeMin, 2); assert.ok(!('galopeQuatro' in Pc().LIMITES), 'saiu a regra dos 5 de 9');
  const comPernas = (ns) => {
    const g = moldeSint();
    ns.forEach((n, i) => { g.galope[i] = sintPorte({ joquei: true, sem: [[1, 2, 3], [1, 3], [1], []][n - 1] }); g.ancoras['galope-' + i] = ancoras(g.galope[i], 64, 64); });
    return Pc().criterioPernas(g).filter(c => /galope/.test(c.criterio));
  };
  assert.deepStrictEqual([1, 2, 3].map(n => Pc().pernas(sintPorte({ sem: [[1, 2, 3], [1, 3], [1]][n - 1] }), 64, 64)), [1, 2, 3], 'o sintético sai com 1, 2 e 3 pernas');
  const dois = comPernas([2, 2, 2, 2, 2, 2, 2, 2, 2]);                   // 2 em todo quadro (nenhum com 4) passa
  assert.strictEqual(dois.length, 1, 'um critério só de pernas no galope'); assert.ok(dois.every(formaCriterio));
  assert.deepStrictEqual([dois[0].criterio, dois[0].ok, dois[0].valor, dois[0].limite, dois[0].quadros], ['pernas no galope (todo quadro)', true, 2, '≥ 2', new Array(9).fill(2)]);
  const um = comPernas([4, 3, 4, 4, 1, 4, 4, 4, 4]);                     // um quadro com 1 reprova, mesmo com 7 de 4
  assert.deepStrictEqual([um[0].ok, um[0].valor], [false, 1]);
  assert.deepStrictEqual(falhos(comPernas([3, 3, 2, 3, 3, 2, 3, 3, 3])), [], 'pernas coladas e cruzadas (2 e 3) passam');
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
  assert.strictEqual(ok.length, 4, '9 quadros, lombo, nose.x contra a pose de corrida e comprimento'); assert.ok(ok.every(formaCriterio));
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

// O CLI de verdade (pasta assets/pixellab de hoje), com fetch, sockets e http trocados por funções que avisam e lançam:
// qualquer tentativa de rede aparece no stderr. O que ele lista depende do que já foi gerado em raw/ e novos/ (desde
// 2026-11-13 os mestres estão lá), então aqui só entra o que vale em qualquer estado; a previsão de um lote vazio (12
// chamadas) é conferida com o dryRunPortes numa pasta temporária, mais abaixo.
const BLOQUEIO_REDE = 'data:text/javascript,' + encodeURIComponent([
  'import net from "node:net"; import tls from "node:tls"; import http from "node:http"; import https from "node:https";',
  'const proibido = (o) => () => { process.stderr.write("REDE PROIBIDA: " + o + "\\n"); throw new Error("rede proibida no teste: " + o); };',
  'globalThis.fetch = proibido("fetch");',
  'net.Socket.prototype.connect = proibido("net.Socket.connect"); net.connect = net.createConnection = proibido("net.connect");',
  'tls.connect = proibido("tls.connect"); http.request = http.get = proibido("http"); https.request = https.get = proibido("https");',
].join('\n'));
const cliPortes = args => spawnSync(process.execPath, ['--import', BLOQUEIO_REDE, path.join(path.dirname(fileURLToPath(import.meta.url)), 'pixellab-moldes.mjs'), '--lote', 'portes', ...args],
  { encoding: 'utf8', env: Object.assign({}, process.env, { NODE_USE_ENV_PROXY: '' }) });

test('dry-run: --lote portes --fase mestres sem --gerar lista os 3 itens e as 4 etapas de cada, sem rede', () => {
  const novos = path.join(DIR, 'novos'), existia = fs.existsSync(novos);
  const r = cliPortes(['--fase', 'mestres']);
  assert.strictEqual(r.status, 0, 'saída ' + r.status + '\n' + r.stderr + r.stdout);
  assert.ok(!/REDE PROIBIDA/.test(r.stderr), r.stderr);
  assert.match(r.stdout, /nenhuma chamada à API/);
  assert.match(r.stdout, /Itens: 3 \(padrao-lisa, esguio-lisa, robusto-lisa\)/);
  assert.match(r.stdout, /Total previsto: \d+ gerações em \d+ chamadas novas/);
  // cada etapa aparece numa chamada prevista ou entre as reaproveitadas de raw/
  for (const ch of ['esguio-lisa', 'padrao-lisa', 'robusto-lisa']) for (const e of ['retrato', 'parado', 'corrida', 'galope']) {
    assert.ok(r.stdout.includes(ch + '/' + e), 'falta ' + ch + '/' + e);
  }
  assert.strictEqual(fs.existsSync(novos), existia, 'o dry-run não cria a pasta novos/');
});

test('dry-run: --refazer no CLI roda sem rede; chave ou etapa inválida e --refazer com --reprocessar dão erro de uso', () => {
  const r = cliPortes(['--fase', 'mestres', '--refazer', 'padrao-lisa:corrida', '--refazer', 'esguio-lisa:parado']);
  assert.ok(!/REDE PROIBIDA/.test(r.stderr), r.stderr);
  if (fs.existsSync(path.join(DIR, 'novos', 'criterios.json'))) {
    assert.strictEqual(r.status, 0, 'saída ' + r.status + '\n' + r.stderr + r.stdout);
    assert.match(r.stdout, /nenhuma chamada à API/);
    assert.match(r.stdout, /AVISO: --refazer padrao-lisa: /); assert.match(r.stdout, /AVISO: --refazer esguio-lisa: /);
  } else assert.match(r.stderr, /ainda não tem registro/);
  for (const [args, msg] of [
    [['--refazer', 'padrao-lisa:pescoco'], /--refazer padrao-lisa:pescoco: use <porte>-<estilo>:<etapa>/],
    [['--refazer', 'padrao-lisa'], /use <porte>-<estilo>:<etapa>/],
    [['--refazer', 'padrao-chamas:retrato'], /--refazer padrao-chamas: não está na fase "mestres"/],
    [['--refazer', 'padrao-lisa:corrida', '--reprocessar'], /--refazer não anda com --reprocessar/],
  ]) {
    const e = cliPortes(['--fase', 'mestres', ...args]);
    assert.strictEqual(e.status, 2, args.join(' ') + ': saída ' + e.status + '\n' + e.stdout);
    assert.match(e.stderr, msg); assert.ok(!/REDE PROIBIDA/.test(e.stderr));
  }
  const m = spawnSync(process.execPath, [path.join(path.dirname(fileURLToPath(import.meta.url)), 'pixellab-moldes.mjs'), '--lote', 'moldes', '--refazer', 'lisa:parado'], { encoding: 'utf8' });
  assert.strictEqual(m.status, 2); assert.match(m.stderr, /só valem com --lote portes/);
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
      chamadas.push({ ep, porte, estilo, etapa, seed: corpo.seed, guia: !!corpo.init_image, forca: corpo.init_image_strength, init: corpo.init_image ? corpo.init_image.base64 : null });
      const op = Object.assign({}, CORPO_FALSO[porte], { joquei: etapa !== 'retrato', crina: estilo === 'lisa' ? 'normal' : 'grande' },
        regras.parada ? regras.parada({ porte, estilo, etapa, seed: corpo.seed }) : {});
      const r = { image: { type: 'base64', base64: b64png(rgbaDeIdx(sintPorte(op), 64, 64)) }, usage: { type: 'generations', generations: 1 } };
      return { resultado: r, respostas: [r] };
    }
    chamadas.push({ ep, seed: corpo.seed, frames: corpo.frame_count });
    const f0 = decodePng(Buffer.from(corpo.first_frame.base64, 'base64')).rgba;
    const dys = (regras.pula && regras.pula(corpo.seed) ? [0, 0, 0, 0, 4, 0, 0, 0, 0] : [0, 1, 2, 1, 0, 1, 2, 1, 0]).slice(0, regras.quadros ? regras.quadros(corpo.seed) : 9);
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

// ---------------------------------------------------------------- Portes: rodada de correção 1 (revisão da Task 4)
section('Portes: rodada de correção 1');

await testA('gasto.json ilegível: o --gerar para antes de qualquer chamada, o arquivo não é sobrescrito e o dry-run avisa em destaque', async () => {
  const D = pastaTemp(), arq = path.join(D.dirs.novos, 'gasto.json');
  fs.mkdirSync(D.dirs.novos, { recursive: true });
  const conflito = '<<<<<<< HEAD\n{ "geracoes": 80, "chamadas": 80, "rodadas": [] }\n=======\n{ "geracoes": 12 }\n>>>>>>> outra\n';
  fs.writeFileSync(arq, conflito);
  assert.throws(() => Pl().lerGasto(D.dirs.novos), e => e instanceof Pl().GastoIlegivel && e.fatal && /não é JSON/.test(e.message));
  const api = apiFalsa(CENARIO);
  await assert.rejects(semRede(() => Pl().rodarPortes({ fase: 'mestres', modo: 'gerar', executar: api.executar, dirs: D.dirs, log: () => {} })), /gasto\.json ilegível/);
  assert.strictEqual(api.chamadas.length, 0, 'nenhuma chamada');
  assert.strictEqual(fs.readFileSync(arq, 'utf8'), conflito, 'o gasto.json ilegível não é sobrescrito');
  const linhas = [];
  await Pl().dryRunPortes({ fase: 'mestres', dirs: D.dirs }, l => linhas.push(l));
  const txt = linhas.join('\n');
  assert.match(txt, /^!!! AVISO: .*gasto\.json ilegível/m); assert.match(txt, /já gastas DESCONHECIDO \(gasto\.json ilegível\), sobram \?/);
  assert.ok(!/já gastas 0/.test(txt)); assert.match(txt, /o --gerar recusa rodar/);
  // outros jeitos de estar ilegível; os válidos passam; sem arquivo, nada foi gasto
  for (const [conteudo, motivo] of [['{"geracoes":"80"}', /"geracoes" = "80"/], ['{"geracoes":-1}', /= -1/], ['{"geracoes":null}', /= null/],
    ['[]', /não é um objeto/], ['{"geracoes":5,"chamadas":"x"}', /"chamadas"/], ['{"geracoes":5,"rodadas":{}}', /"rodadas"/]]) {
    fs.writeFileSync(arq, conteudo);
    assert.throws(() => Pl().lerGasto(D.dirs.novos), motivo, conteudo);
  }
  fs.writeFileSync(arq, '{"geracoes":7.5}');
  assert.deepStrictEqual(Pl().lerGasto(D.dirs.novos), { geracoes: 7.5, chamadas: 0, rodadas: [] });
  fs.unlinkSync(arq);
  assert.strictEqual(Pl().lerGasto(D.dirs.novos).geracoes, 0);
  // o --reprocessar não paga nem grava o gasto: segue com o aviso e deixa o arquivo como está
  fs.writeFileSync(arq, conflito);
  const r = await semRede(() => Pl().rodarPortes({ fase: 'mestres', modo: 'reprocessar', dirs: D.dirs, log: () => {} }));
  assert.ok(r.avisos.some(a => /ilegível/.test(a))); assert.strictEqual(fs.readFileSync(arq, 'utf8'), conflito);
  fs.rmSync(D.raiz, { recursive: true, force: true });
});

// Pasta E: galope de 8 quadros nos mestres (o padrão acerta na 2ª seed, o robusto nunca); no piloto, o retrato do padrão
// passa no mesmo corpo na seed A (3402) mas reprova na forma, e as seeds B e C reprovam só no nose.x.
const E = pastaTemp();
const CENARIO_E = {
  parada: ({ porte, estilo, etapa, seed }) => (porte === 'padrao' && estilo === 'chamas' && etapa === 'retrato'
    ? (seed === 3402 ? { furos: true } : { dx: 3 }) : {}),
  quadros: seed => ([3102, 3103, 3203, 3303].includes(seed) ? 8 : 9),
};

await testA('galope com 8 quadros reprova no critério dos 9 (fica como o melhor, marcado); a folha anima 8 sem quadro vazio', async () => {
  const api = apiFalsa(CENARIO_E);
  await semRede(() => Pl().rodarPortes({ fase: 'mestres', modo: 'gerar', executar: api.executar, dirs: E.dirs, log: () => {} }));
  const C = lerJ(path.join(E.dirs.novos, 'criterios.json'));
  const gp = C.itens['padrao-lisa'].etapas.galope;
  assert.deepStrictEqual([gp.escolhida, gp.tentativas.length], [3202, 2]);
  assert.ok(gp.tentativas[0].criterios.some(c => c.criterio === 'galope: 9 quadros' && !c.ok && c.valor === 8), 'a 1ª, com 8, reprova');
  const rob = C.itens['robusto-lisa'];
  assert.deepStrictEqual([rob.ok, rob.final, rob.etapas.galope.tentativas.length, rob.etapas.galope.escolhida], [false, true, 3, 3103]);
  assert.ok(rob.falhas.includes('galope: 9 quadros = 8 (= 9)'), rob.falhas.join(' | '));
  assert.strictEqual(lerJ(path.join(E.dirs.novos, 'molde-robusto-lisa.json')).frames, 8);
  assert.ok(!fs.existsSync(path.join(E.dirs.novos, 'molde-robusto-lisa-galope-8.png')));
  const F = await import('./folha-portes.mjs'), html = F.htmlFolhaMestres(F.dadosMestres(E.dirs.novos));
  const fig = ch => html.slice(html.indexOf('id="' + ch + '"'), html.indexOf('</article>', html.indexOf('id="' + ch + '"')));
  assert.match(fig('robusto-lisa'), /animation-name:desliza512;animation-timing-function:steps\(8\)/);
  assert.match(fig('robusto-lisa'), /animation-name:desliza2048;animation-timing-function:steps\(8\)/);
  assert.ok(!/desliza576|steps\(9\)/.test(fig('robusto-lisa')), 'sem o 9º quadro vazio');
  assert.match(fig('padrao-lisa'), /animation-name:desliza576;animation-timing-function:steps\(9\)/);
  for (const d of [512, 2048, 576, 2304]) assert.ok(html.includes(`@keyframes desliza${d} { to { background-position: -${d}px 0; } }`), 'keyframes ' + d);
  assert.match(fig('robusto-lisa'), /NÃO<\/span> galope: 9 quadros: 8/);
});

await testA('piloto: passa no mesmo corpo se QUALQUER seed passar (A passa no corpo e reprova na forma; B e C só no nose.x)', async () => {
  const api = apiFalsa(CENARIO_E);
  await semRede(() => Pl().rodarPortes({ fase: 'piloto', modo: 'gerar', executar: api.executar, dirs: E.dirs, log: () => {} }));
  const C = lerJ(path.join(E.dirs.novos, 'criterios.json'));
  const ret = C.itens['padrao-chamas'].etapas.retrato;
  assert.deepStrictEqual(ret.tentativas.map(t => t.seed), [3402, 3502, 3602]);
  const mc = t => t.criterios.filter(c => /^mesmo corpo/.test(c.criterio));
  assert.ok(mc(ret.tentativas[0]).every(c => c.ok) && ret.tentativas[0].criterios.some(c => c.criterio === 'forma (retrato)' && !c.ok), 'A: corpo ok, forma não');
  assert.ok(ret.tentativas.slice(1).every(t => mc(t).filter(c => !c.ok).map(c => c.criterio).join() === 'mesmo corpo no retrato: nose.x'), 'B e C: só o nose.x');
  assert.strictEqual(ret.escolhida, 3502, 'a escolhida (a melhor) é a B: o veredito não pode olhar só para ela');
  assert.deepStrictEqual([C.piloto.padrao.mesmoCorpo, C.piloto.padrao.retrato, C.piloto.padrao.parado.ok], [true, { ok: true, seed: 3402 }, true]);
  assert.deepStrictEqual([C.piloto.esguio.mesmoCorpo, C.piloto.robusto.mesmoCorpo], [true, true]);
  assert.ok(Pl().itensDaFase('versoes', { piloto: C.piloto }).every(i => i.guia), 'as versões do padrão continuam com init_image');
});

await testA('--sem-guia: aquela versão sai sem init_image (3701+), o piloto não muda e a entrada anterior vai para o histórico', async () => {
  // argumentos
  const v = (o, n = E.dirs.novos) => Pl().validarArgsPortes(Object.assign({ fase: 'versoes' }, o), n);
  assert.match(v({ fase: 'mestres', semGuia: ['padrao-ondas'] }), /só nas fases piloto e versoes/);
  assert.match(v({ semGuia: ['padrao-xx'] }), /use <porte>-<estilo>/);
  assert.match(v({ semGuia: ['padrao-ondas-1'] }), /use <porte>-<estilo>/);
  assert.match(v({ fase: 'piloto', semGuia: ['padrao-ondas'] }), /só tem as versões de chamas/);
  assert.strictEqual(v({ semGuia: ['padrao-ondas', 'padrao-chamas'] }), null);
  const C0 = lerJ(path.join(E.dirs.novos, 'criterios.json'));
  const it = Pl().itensDaFase('versoes', { piloto: C0.piloto, semGuia: ['padrao-ondas', 'padrao-chamas'] });
  assert.deepStrictEqual(it.filter(i => i.porte === 'padrao').map(i => i.chave + (i.guia ? '+' : '') + ' ' + i.seedBase), ['padrao-chamas 3702', 'padrao-ondas 3705', 'padrao-folhas+ 3408']);
  // versões guiadas primeiro; depois a padrao-ondas sem guia
  await semRede(() => Pl().rodarPortes({ fase: 'versoes', modo: 'gerar', executar: apiFalsa(CENARIO_E).executar, dirs: E.dirs, log: () => {} }));
  const C1 = lerJ(path.join(E.dirs.novos, 'criterios.json')), piloto = JSON.stringify(C1.piloto), gasto1 = lerJ(path.join(E.dirs.novos, 'gasto.json')).geracoes;
  assert.strictEqual(C1.itens['padrao-ondas'].variante, 'init_image do mestre');
  const linhas = [];
  await Pl().dryRunPortes({ fase: 'versoes', only: 'padrao-ondas', semGuia: ['padrao-ondas'], dirs: E.dirs }, l => linhas.push(l));
  assert.match(linhas.join('\n'), /AVISO: --sem-guia padrao-ondas: sai sem init_image \(receita do primeiro lote, seed base 3705\); o registro do piloto não muda/);
  assert.match(linhas.join('\n'), /Total previsto: 4 gerações em 4 chamadas novas/);
  const api = apiFalsa(CENARIO_E), log = [];
  const r = await semRede(() => Pl().rodarPortes({ fase: 'versoes', only: 'padrao-ondas', semGuia: ['padrao-ondas'], modo: 'gerar', executar: api.executar, dirs: E.dirs, log: m => log.push(m) }));
  assert.strictEqual(r.parada, null);
  assert.deepStrictEqual(api.chamadas.map(c => (c.etapa || 'galope') + ' ' + c.seed + (c.guia ? ' guiada' : '')), ['retrato 3705', 'parado 3705', 'corrida 3705', 'galope 3705']);
  const C2 = lerJ(path.join(E.dirs.novos, 'criterios.json')), e = C2.itens['padrao-ondas'];
  assert.deepStrictEqual([e.variante, e.guia, e.seedBase, e.ok], ['sem init_image', null, 3705, true]);
  assert.strictEqual(e.historico.length, 1); assert.strictEqual(e.historico[0].variante, 'init_image do mestre');
  assert.strictEqual(e.historico[0].etapas.retrato.tentativas[0].seed, 3405, 'as tentativas da receita anterior ficam');
  assert.strictEqual(JSON.stringify(C2.piloto), piloto, 'o registro do piloto não muda');
  assert.deepStrictEqual(lerJ(path.join(E.dirs.novos, 'molde-padrao-ondas.json')).seeds, { retrato: 3705, parado: 3705, montado: 3705, galope: 3705 });
  assert.strictEqual(lerJ(path.join(E.dirs.novos, 'gasto.json')).geracoes, gasto1 + 4);
  // de novo: nada novo a gerar e o histórico não duplica
  await semRede(() => Pl().rodarPortes({ fase: 'versoes', only: 'padrao-ondas', semGuia: ['padrao-ondas'], modo: 'gerar', executar: apiFalsa(CENARIO_E).executar, dirs: E.dirs, log: () => {} }));
  assert.strictEqual(lerJ(path.join(E.dirs.novos, 'criterios.json')).itens['padrao-ondas'].historico.length, 1);
  // na fase piloto: o chamas sem guia não reescreve o veredito do piloto
  await semRede(() => Pl().rodarPortes({ fase: 'piloto', only: 'esguio-chamas', semGuia: ['esguio-chamas'], modo: 'gerar', executar: apiFalsa(CENARIO_E).executar, dirs: E.dirs, log: () => {} }));
  const C3 = lerJ(path.join(E.dirs.novos, 'criterios.json'));
  assert.strictEqual(JSON.stringify(C3.piloto), piloto);
  assert.deepStrictEqual([C3.itens['esguio-chamas'].variante, C3.itens['esguio-chamas'].historico[0].variante], ['sem init_image', 'init_image do mestre']);
});

await testA('--guia-galope-mestre: a corrida sai guiada pelo 1º quadro cru do galope do mestre (força 300) e o galope parte dela', async () => {
  const v = o => Pl().validarArgsPortes(Object.assign({ fase: 'versoes' }, o), E.dirs.novos);
  assert.match(v({ guiaGalope: ['padrao-chamas'] }), /não está na fase "versoes"/);
  assert.match(v({ fase: 'mestres', guiaGalope: ['padrao-lisa'] }), /só nas fases piloto e versoes/);
  assert.strictEqual(v({ guiaGalope: ['robusto-folhas'] }), null);
  const quadro0 = 'portes-robusto-lisa-galope-c3103-s3103-0.png'; // o galope escolhido do mestre (8 quadros, o melhor)
  const linhas = [];
  await Pl().dryRunPortes({ fase: 'versoes', only: 'robusto-folhas', guiaGalope: ['robusto-folhas'], dirs: E.dirs }, l => linhas.push(l));
  const txt = linhas.join('\n');
  assert.match(txt, new RegExp('robusto-folhas/corrida +seed 3409[^\\n]*\\n[^\\n]*\\[init_image = raw/' + quadro0.replace(/\./g, '\\.') + '; init_image_strength 300\\]'));
  assert.match(txt, /Total previsto: 2 gerações em 2 chamadas novas \(\+ 2 reaproveitadas de raw\/\)/, 'retrato e parado vêm de raw/');
  const gasto0 = lerJ(path.join(E.dirs.novos, 'gasto.json')).geracoes, api = apiFalsa(CENARIO_E);
  const r = await semRede(() => Pl().rodarPortes({ fase: 'versoes', only: 'robusto-folhas', guiaGalope: ['robusto-folhas'], modo: 'gerar', executar: api.executar, dirs: E.dirs, log: () => {} }));
  assert.strictEqual(r.parada, null);
  assert.deepStrictEqual(api.chamadas.map(c => (c.etapa || 'galope') + ' ' + c.seed), ['corrida 3409', 'galope 3409']);
  const cor = api.chamadas[0];
  assert.deepStrictEqual([cor.guia, cor.forca], [true, Pl().FORCA_GUIA_GALOPE]); assert.strictEqual(Pl().FORCA_GUIA_GALOPE, 300);
  assert.strictEqual(cor.init, fs.readFileSync(path.join(E.dirs.raw, quadro0)).toString('base64'), 'init_image = o 1º quadro cru do galope do mestre');
  const e = lerJ(path.join(E.dirs.novos, 'criterios.json')).itens['robusto-folhas'];
  assert.deepStrictEqual([e.variante, e.guiaGalope, e.ok], ['init_image do mestre + corrida guiada pelo galope do mestre', { init_image_strength: 300, quadro: 'raw/' + quadro0 }, true]);
  const tc = e.etapas.corrida.tentativas[0];
  assert.deepStrictEqual([tc.init_image, tc.init_image_strength], ['raw/' + quadro0, 300]);
  assert.match(tc.arquivo, /^raw\/portes-robusto-folhas-corrida-gm300c3103s3103-s3409\.png$/);
  assert.match(e.etapas.galope.tentativas[0].arquivo, /^raw\/portes-robusto-folhas-galope-c3409gm300c3103s3103-s3409-0\.\.8\.png$/);
  assert.strictEqual(e.etapas.retrato.tentativas[0].init_image_strength, Pl().FORCA_GUIA, 'retrato e parado continuam guiados pelo mestre no mesmo estado');
  assert.strictEqual(e.historico[0].variante, 'init_image do mestre');
  assert.strictEqual(lerJ(path.join(E.dirs.novos, 'gasto.json')).geracoes, gasto0 + 2);
});
fs.rmSync(E.raiz, { recursive: true, force: true });

// ---------------------------------------------------------------- Portes: Task 5a (decisões da folha dos mestres)
// A regra nova do galope no caminho do lote, o --reprocessar que reavalia sem gastar, a escolha que continua valendo,
// o --refazer com seeds novas e o pedido novo do robusto (com o texto antigo reconhecendo os crus dele).
section('Portes: refazer, regra do galope e pedido do robusto');
const crusDe = dir => Object.fromEntries((fs.existsSync(dir) ? fs.readdirSync(dir) : []).map(f => [f, fs.readFileSync(path.join(dir, f))]));
const iguaisAntes = (antes, dir) => Object.keys(antes).filter(f => !fs.existsSync(path.join(dir, f)) || !fs.readFileSync(path.join(dir, f)).equals(antes[f]));
const etapasDe = cs => cs.map(c => (c.etapa ? c.porte + '/' + c.etapa : 'galope') + ' ' + c.seed);
// Pasta F: a pose de corrida do padrão sai com 2 pernas em toda seed (passa, e o galope que parte dela também); a do
// esguio sai com 1 perna na seed 3101 (reprova) e com 4 na 3201; na refação do padrão, a corrida da seed 4102 sai com 1.
const F = pastaTemp();
const CENARIO_F = {
  parada: ({ porte, estilo, etapa, seed }) => Object.assign({},
    porte === 'padrao' && estilo === 'lisa' && etapa === 'corrida' ? { sem: [1, 3] } : {},
    porte === 'padrao' && estilo === 'lisa' && etapa === 'corrida' && seed === 4102 ? { sem: [1, 2, 3] } : {},
    porte === 'esguio' && estilo === 'lisa' && etapa === 'corrida' && seed === 3101 ? { sem: [1, 2, 3] } : {}),
};

await testA('regra nova no lote: corrida e galope com 2 pernas passam; corrida com 1 perna reprova; limites gravados', async () => {
  const api = apiFalsa(CENARIO_F);
  const r = await semRede(() => Pl().rodarPortes({ fase: 'mestres', modo: 'gerar', executar: api.executar, dirs: F.dirs, log: () => {} }));
  assert.strictEqual(r.parada, null);
  const C = lerJ(path.join(F.dirs.novos, 'criterios.json')), p = C.itens['padrao-lisa'];
  assert.strictEqual(p.ok, true, p.falhas.join(' | '));
  const pc = p.etapas.corrida.tentativas[0].criterios.find(c => /pose de corrida/.test(c.criterio));
  assert.deepStrictEqual([p.etapas.corrida.escolhida, pc.ok, pc.valor, pc.limite], [3102, true, 2, '≥ 2']);
  const pg = p.etapas.galope.tentativas[0].criterios.filter(c => /^pernas/.test(c.criterio));
  assert.deepStrictEqual(pg.map(c => [c.criterio, c.ok, c.quadros.join('')]), [['pernas no galope (todo quadro)', true, '222222222']]);
  const ec = C.itens['esguio-lisa'].etapas.corrida;
  assert.deepStrictEqual([ec.escolhida, ec.tentativas.map(t => t.seed + (t.ok ? '✓' : '✗')).join(' ')], [3201, '3101✗ 3201✓']);
  assert.ok(ec.tentativas[0].criterios.some(c => /pose de corrida/.test(c.criterio) && !c.ok && c.valor === 1));
  assert.deepStrictEqual([C.limites.galopeMin, 'galopeQuatro' in C.limites], [2, false]);
  assert.ok(Object.values(C.itens).every(e => Object.values(e.etapas).every(x => x.refacao === 0)) && C.itens['padrao-lisa'].refacoes.corrida === 0);
});

await testA('--reprocessar dos mestres reavalia com a regra nova e atualiza o criterios.json, sem rede, sem custo e sem mexer nos finais', async () => {
  // o criterios.json como se tivesse saído com a regra antiga: o galope do padrão reprovado no "4 em 5 dos 9"
  const arq = path.join(F.dirs.novos, 'criterios.json'), C0 = lerJ(arq), g0 = C0.itens['padrao-lisa'].etapas.galope.tentativas[0];
  g0.criterios.push({ criterio: 'pernas no galope (quadros com 4)', ok: false, valor: 0, limite: '≥ 5 de 9' }); g0.ok = false;
  Object.assign(C0.itens['padrao-lisa'], { ok: false, falhas: ['galope: pernas no galope (quadros com 4) = 0 (≥ 5 de 9)'] });
  C0.limites = Object.assign({}, C0.limites, { galopeMin: 3, galopeQuatro: 5 });
  fs.writeFileSync(arq, JSON.stringify(C0, null, 2) + '\n');
  const finais = crusDe(F.dirs.novos), gasto = fs.readFileSync(path.join(F.dirs.novos, 'gasto.json'));
  const r = await semRede(() => Pl().rodarPortes({ fase: 'mestres', modo: 'reprocessar', executar: () => { throw new Error('chamou a API'); }, dirs: F.dirs, log: () => {} }));
  assert.strictEqual(r.parada, null);
  const C = lerJ(arq);
  assert.strictEqual(C.itens['padrao-lisa'].ok, true, C.itens['padrao-lisa'].falhas.join(' | '));
  assert.ok(!fs.readFileSync(arq, 'utf8').includes('quadros com 4'), 'nenhum critério da regra antiga sobra');
  assert.deepStrictEqual([C.limites.galopeMin, 'galopeQuatro' in C.limites], [2, false]);
  assert.ok(fs.readFileSync(path.join(F.dirs.novos, 'gasto.json')).equals(gasto), 'o gasto não muda');
  assert.deepStrictEqual(iguaisAntes(finais, F.dirs.novos).filter(f => f !== 'criterios.json'), [], 'os finais não mudam');
});

await testA('escolha que continua valendo não muda: a corrida reavaliada não troca de seed nem pede outro galope', async () => {
  // a corrida 3101 do esguio, que reprovou, passa a ser aprovada (mesmo pedido, imagem boa): a 3201, que tem o galope,
  // continua a escolhida — o laço segue até ela só pelo que já está em raw/
  const c1 = path.join(F.dirs.raw, 'portes-esguio-lisa-corrida-s3101.png');
  fs.copyFileSync(path.join(F.dirs.raw, 'portes-esguio-lisa-corrida-s3201.png'), c1);
  const linhas = [];
  await semRede(() => Pl().dryRunPortes({ fase: 'mestres', dirs: F.dirs }, l => linhas.push(l)));
  assert.match(linhas.join('\n'), /Total previsto: 0 gerações em 0 chamadas novas/);
  assert.match(linhas.join('\n'), /esguio-lisa\/corrida \(seed 3101\), esguio-lisa\/corrida \(seed 3201\)/, 'as duas reavaliadas, ambas aprovadas');
  const finais = crusDe(F.dirs.novos);
  const api = apiFalsa(CENARIO_F);
  await semRede(() => Pl().rodarPortes({ fase: 'mestres', modo: 'gerar', executar: api.executar, dirs: F.dirs, log: () => {} }));
  assert.strictEqual(api.chamadas.length, 0);
  const ec = lerJ(path.join(F.dirs.novos, 'criterios.json')).itens['esguio-lisa'].etapas.corrida;
  assert.deepStrictEqual([ec.escolhida, ec.tentativas.map(t => t.seed + (t.ok ? '✓' : '✗')).join(' ')], [3201, '3101✓ 3201✓']);
  assert.deepStrictEqual(iguaisAntes(finais, F.dirs.novos).filter(f => f !== 'criterios.json'), []);
  // sem a escolha anterior (criterios.json sem o esguio), vale a 1ª aprovada e o galope teria de sair da 3101
  const arq = path.join(F.dirs.novos, 'criterios.json'), guardado = fs.readFileSync(arq), C = lerJ(arq);
  delete C.itens['esguio-lisa']; fs.writeFileSync(arq, JSON.stringify(C));
  const l2 = [];
  await semRede(() => Pl().dryRunPortes({ fase: 'mestres', dirs: F.dirs }, l => l2.push(l)));
  assert.match(l2.join('\n'), /esguio-lisa\/galope +seed 3101[^\n]*\n[^\n]*first_frame = esguio-lisa\/corrida seed 3101/);
  fs.writeFileSync(arq, guardado);
});

await testA('--manter-escolhas (só no --reprocessar): a escolha gravada fica, mesmo reprovada, e a etapa grava a que seria escolhida', async () => {
  // a folha já revista não troca de desenho num reprocessamento depois de mudar a classificação (tarefa 6a)
  const G = pastaTemp(), sem = () => { throw new Error('chamou a API'); };
  await semRede(() => Pl().rodarPortes({ fase: 'mestres', modo: 'gerar', executar: apiFalsa(CENARIO).executar, dirs: G.dirs, log: () => {} }));
  // padrão/retrato: a 3102 reprovou (pernas coladas) e a 3202 foi escolhida; o registro passa a ter a 3102 escolhida
  const arq = path.join(G.dirs.novos, 'criterios.json'), C0 = lerJ(arq);
  assert.deepStrictEqual(C0.itens['padrao-lisa'].etapas.retrato.tentativas.map(t => t.seed + (t.ok ? '✓' : '✗')), ['3102✗', '3202✓']);
  C0.itens['padrao-lisa'].etapas.retrato.escolhida = 3102;
  // robusto/galope: os 3 galopes reprovaram (pulam); a 3103 passa a ser estável (todos os quadros = o 1º) e a 3203 vira
  // um erro de API registrado (cru de erro, sem imagem; no registro, com o custo contado na rodada dele)
  const gal = C0.itens['robusto-lisa'].etapas.galope;
  assert.deepStrictEqual([gal.escolhida, gal.tentativas.map(t => t.seed + (t.ok ? '✓' : '✗')).join(' ')], [3103, '3103✗ 3203✗ 3303✗']);
  const base = s => path.join(G.dirs.raw, `portes-robusto-lisa-galope-c3103-s${s}`);
  for (let i = 1; i < 9; i++) fs.copyFileSync(base(3103) + '-0.png', `${base(3103)}-${i}.png`);
  const e3203 = lerJ(base(3203) + '.json');
  fs.writeFileSync(base(3203) + '.json', JSON.stringify({ endpoint: e3203.endpoint, data: e3203.data, pedido: e3203.pedido, erro: 'HTTP 502 (teste)' }));
  for (let i = 0; i < 9; i++) fs.unlinkSync(`${base(3203)}-${i}.png`);
  Object.assign(gal.tentativas[1], { ok: false, motivo: 'POST /animate-with-text-v3 → HTTP 502 (teste)', geracoes: 1 });
  delete gal.tentativas[1].criterios;
  fs.writeFileSync(arq, JSON.stringify(C0, null, 2) + '\n');
  const linhas = [];
  const r = await semRede(() => Pl().rodarPortes({ fase: 'mestres', modo: 'reprocessar', manterEscolhas: true, executar: sem, dirs: G.dirs, log: l => linhas.push(l) }));
  assert.strictEqual(r.parada, null);
  const ret = lerJ(arq).itens['padrao-lisa'].etapas.retrato;
  assert.deepStrictEqual([ret.escolhida, ret.ok, ret.mantida], [3102, false, { seria: 3202, seriaOk: true }]);
  assert.deepStrictEqual(r.mantidas, [{ rotulo: 'padrao-lisa/retrato', seed: 3102, ok: false, seria: 3202, seriaOk: true }]);
  assert.match(linhas.join('\n'), /retrato: escolha mantida \(--manter-escolhas\): seed 3102; pelos critérios de hoje seria a seed 3202 \(aprovada\)/);
  const J = lerJ(path.join(G.dirs.novos, 'molde-padrao-lisa.json'));
  assert.strictEqual(J.seeds.retrato, 3102, 'o final é regravado com a escolha mantida');
  // as etapas em que a escolhida já é a melhor não ganham `mantida`
  assert.ok(Object.values(lerJ(arq).itens['esguio-lisa'].etapas).every(x => !('mantida' in x)));
  // as tentativas pagas continuam no registro, também depois da 1ª aprovada, e o erro guarda o custo contado
  const gal1 = lerJ(arq).itens['robusto-lisa'].etapas.galope;
  assert.deepStrictEqual([gal1.escolhida, 'mantida' in gal1, gal1.tentativas.map(t => `${t.seed}${t.ok ? '✓' : '✗'}${t.geracoes}`).join(' ')], [3103, false, '3103✓1 3203✗1 3303✗1']);
  const Fo = await import('./folha-portes.mjs');
  assert.match(Fo.htmlFolhaMestres(Fo.dadosMestres(G.dirs.novos)), /retrato 3102: escolha mantida no reprocessamento \(--manter-escolhas\); pelos critérios de hoje seria a seed 3202 \(aprovada\)/);
  // sem a opção, a regra de sempre: a anterior reprovada perde para a aprovada
  await semRede(() => Pl().rodarPortes({ fase: 'mestres', modo: 'reprocessar', executar: sem, dirs: G.dirs, log: () => {} }));
  const ret2 = lerJ(arq).itens['padrao-lisa'].etapas.retrato;
  assert.deepStrictEqual([ret2.escolhida, ret2.ok, 'mantida' in ret2], [3202, true, false]);
  // (e, como sempre, o laço para na 1ª aprovada: o registro do galope fica só com a 3103)
  assert.deepStrictEqual(lerJ(arq).itens['robusto-lisa'].etapas.galope.tentativas.map(t => t.seed), [3103]);
  // erros de uso: só com --reprocessar
  await assert.rejects(() => Pl().rodarPortes({ fase: 'mestres', modo: 'plano', manterEscolhas: true, dirs: G.dirs }), /--manter-escolhas só anda com --reprocessar/);
  assert.match(Pl().validarArgsPortes({ fase: 'mestres', manterEscolhas: true }, G.dirs.novos), /--manter-escolhas só anda com --reprocessar/);
  assert.strictEqual(Pl().validarArgsPortes({ fase: 'mestres', manterEscolhas: true, reprocessar: true }, G.dirs.novos), null);
  const cli = cliPortes(['--fase', 'mestres', '--manter-escolhas']);
  assert.deepStrictEqual([cli.status, /--manter-escolhas só anda com --reprocessar/.test(cli.stderr), /REDE PROIBIDA/.test(cli.stderr)], [2, true, false]);
  const cliM = spawnSync(process.execPath, ['--import', BLOQUEIO_REDE, path.join(path.dirname(fileURLToPath(import.meta.url)), 'pixellab-moldes.mjs'), '--lote', 'moldes', '--manter-escolhas'], { encoding: 'utf8' });
  assert.deepStrictEqual([cliM.status, /--manter-escolhas só vale com --lote portes/.test(cliM.stderr)], [2, true]);
});

await testA('--refazer padrao-lisa:corrida: corrida e galope em seeds novas (4102+); retrato e parado intactos; histórico, teto e retomada', async () => {
  const v = o => Pl().validarArgsPortes(Object.assign({ fase: 'mestres' }, o), F.dirs.novos);
  assert.strictEqual(v({ refazer: ['padrao-lisa:corrida', 'esguio-lisa:parado'] }), null);
  assert.match(v({ refazer: ['padrao-lisa:pescoco'] }), /--refazer padrao-lisa:pescoco: use <porte>-<estilo>:<etapa>/);
  assert.match(v({ refazer: ['padrao-lisa'] }), /use <porte>-<estilo>:<etapa>/);
  assert.match(v({ refazer: ['padrao-lisa:corrida:x'] }), /use <porte>-<estilo>:<etapa>/);
  assert.match(v({ refazer: ['padrao-chamas:retrato'] }), /não está na fase "mestres"/);
  assert.match(v({ refazer: ['padrao-lisa:corrida'], only: 'esguio' }), /fora do --only esguio/);
  assert.match(v({ refazer: ['padrao-lisa:corrida'], reprocessar: true }), /não anda com --reprocessar/);
  assert.match(Pl().validarArgsPortes({ fase: 'piloto', refazer: ['padrao-chamas:retrato'] }, F.dirs.novos), /ainda não tem registro/);
  assert.deepStrictEqual(Pl().lerRefazer(['padrao-lisa:corrida', 'padrao-lisa:retrato']).pedidos, { 'padrao-lisa': ['retrato', 'corrida', 'galope'] }, 'corrida ⇒ galope; repetível');
  assert.deepStrictEqual(Pl().seedsDoItem({ chave: 'padrao-lisa', seedBase: 3102, refacoes: { corrida: 1 } }, 'corrida', ['padrao-lisa/corrida']), [4102, 4202, 4302, 4152]);
  // dry-run: as 2 chamadas, sem rede
  const linhas = [];
  await semRede(() => Pl().dryRunPortes({ fase: 'mestres', refazer: ['padrao-lisa:corrida'], dirs: F.dirs }, l => linhas.push(l)));
  const txt = linhas.join('\n');
  assert.match(txt, /AVISO: --refazer padrao-lisa: corrida \(refação 1: seeds 4102, 4202, 4302\), galope \(refação 1: seeds 4102, 4202, 4302; parte da corrida nova\)/);
  assert.deepStrictEqual(txt.match(/POST \S+ +\S+ +seed \d+/g), ['POST /create-image-pixflux  padrao-lisa/corrida    seed 4102', 'POST /animate-with-text-v3  padrao-lisa/galope     seed 4102']);
  assert.match(txt, /Total previsto: 2 gerações em 2 chamadas novas/);
  assert.match(txt, /padrao-lisa\/retrato \(seed 3102\), padrao-lisa\/parado \(seed 3102\)/, 'retrato e parado reaproveitados');
  // gerar com o teto apertado: a corrida 4102 (1 perna) e a 4202 saem; o galope passaria do teto e não sai
  const arqC = path.join(F.dirs.novos, 'criterios.json'), C0 = lerJ(arqC), crus = crusDe(F.dirs.raw);
  const g0 = lerJ(path.join(F.dirs.novos, 'gasto.json')).geracoes;
  const api = apiFalsa(CENARIO_F);
  const r1 = await semRede(() => Pl().rodarPortes({ fase: 'mestres', teto: g0 + 2, refazer: ['padrao-lisa:corrida'], modo: 'gerar', executar: api.executar, dirs: F.dirs, log: () => {} }));
  assert.match(r1.parada || '', /^TETO: parou antes de padrao-lisa\/galope/);
  assert.deepStrictEqual(etapasDe(api.chamadas), ['padrao/corrida 4102', 'padrao/corrida 4202']);
  const C1 = lerJ(arqC), p1 = C1.itens['padrao-lisa'];
  assert.deepStrictEqual(p1.refacoes, { retrato: 0, parado: 0, corrida: 1, galope: 1 });
  assert.strictEqual(p1.historico.length, 1);
  assert.deepStrictEqual([p1.historico[0].refazer, Object.keys(p1.historico[0].etapas), p1.historico[0].refacoes], [['corrida', 'galope'], ['corrida', 'galope'], { corrida: 0, galope: 0 }]);
  assert.deepStrictEqual(p1.historico[0].etapas, { corrida: C0.itens['padrao-lisa'].etapas.corrida, galope: C0.itens['padrao-lisa'].etapas.galope }, 'a tentativa anterior inteira');
  assert.deepStrictEqual([p1.etapas.corrida.escolhida, p1.etapas.corrida.refacao, p1.etapas.corrida.tentativas.map(t => t.seed + (t.ok ? '✓' : '✗')).join(' ')], [4202, 1, '4102✗ 4202✓']);
  assert.deepStrictEqual(p1.etapas.retrato, C0.itens['padrao-lisa'].etapas.retrato, 'o retrato não muda');
  assert.deepStrictEqual(p1.etapas.parado, C0.itens['padrao-lisa'].etapas.parado, 'o parado não muda');
  assert.strictEqual(lerJ(path.join(F.dirs.novos, 'gasto.json')).geracoes, g0 + 2, 'conta no teto somado');
  // de novo, com o mesmo --refazer: o item ficou pela metade, então a refação 1 é retomada (só o galope sai, na 1ª
  // seed da refação dele, a partir da corrida escolhida)
  const api2 = apiFalsa(CENARIO_F), log2 = [];
  const r2 = await semRede(() => Pl().rodarPortes({ fase: 'mestres', refazer: ['padrao-lisa:corrida'], modo: 'gerar', executar: api2.executar, dirs: F.dirs, log: m => log2.push(m) }));
  assert.strictEqual(r2.parada, null);
  assert.deepStrictEqual(etapasDe(api2.chamadas), ['galope 4102']);
  assert.ok(log2.some(m => /AVISO: --refazer padrao-lisa: o item ficou pela metade/.test(m)));
  const p2 = lerJ(arqC).itens['padrao-lisa'];
  assert.deepStrictEqual([p2.ok, p2.refacoes.corrida, p2.refacoes.galope, p2.historico.length, p2.etapas.galope.escolhida], [true, 1, 1, 1, 4102]);
  assert.strictEqual(p2.etapas.galope.tentativas[0].arquivo, 'raw/portes-padrao-lisa-galope-c4202-s4102-0..8.png');
  const J = lerJ(path.join(F.dirs.novos, 'molde-padrao-lisa.json'));
  assert.deepStrictEqual(J.seeds, { retrato: 3102, parado: 3102, montado: 4202, galope: 4102 }, 'o final em novos/ regravado');
  const g = lerJ(path.join(F.dirs.novos, 'gasto.json'));
  assert.deepStrictEqual([g.geracoes, g.rodadas.slice(-2).map(x => x.refazer)], [g0 + 3, [['padrao-lisa:corrida'], ['padrao-lisa:corrida']]]);
  assert.deepStrictEqual(iguaisAntes(crus, F.dirs.raw), [], 'nenhum cru antigo sobrescrito');
  assert.ok(Object.keys(crusDe(F.dirs.raw)).filter(f => !(f in crus)).every(f => /-s4[12]02/.test(f)), 'só crus novos, nas seeds novas');
  // sem --refazer, a corrida fica na refação 1 (nada novo); um --refazer de novo, com o item completo, só abre a 2ª
  // (5102+) com --nova-refacao (os testes da rodada de correção 1, mais abaixo, conferem o --gerar)
  const api3 = apiFalsa(CENARIO_F);
  await semRede(() => Pl().rodarPortes({ fase: 'mestres', modo: 'gerar', executar: api3.executar, dirs: F.dirs, log: () => {} }));
  assert.strictEqual(api3.chamadas.length, 0);
  assert.strictEqual(lerJ(arqC).itens['padrao-lisa'].etapas.corrida.escolhida, 4202);
  const l3 = [];
  await semRede(() => Pl().dryRunPortes({ fase: 'mestres', refazer: ['padrao-lisa:corrida'], novaRefacao: true, dirs: F.dirs }, l => l3.push(l)));
  assert.match(l3.join('\n'), /corrida \(refação 2: seeds 5102, 5202, 5302\)/); assert.match(l3.join('\n'), /padrao-lisa\/corrida +seed 5102/);
});

await testA('--refazer esguio-lisa:parado refaz só o parado (4101+); retrato, corrida e galope seguem', async () => {
  const arqC = path.join(F.dirs.novos, 'criterios.json'), C0 = lerJ(arqC).itens['esguio-lisa'];
  const api = apiFalsa(CENARIO_F);
  const r = await semRede(() => Pl().rodarPortes({ fase: 'mestres', refazer: ['esguio-lisa:parado'], modo: 'gerar', executar: api.executar, dirs: F.dirs, log: () => {} }));
  assert.strictEqual(r.parada, null);
  assert.deepStrictEqual(etapasDe(api.chamadas), ['esguio/parado 4101']);
  const e = lerJ(arqC).itens['esguio-lisa'];
  assert.deepStrictEqual(e.refacoes, { retrato: 0, parado: 1, corrida: 0, galope: 0 });
  assert.deepStrictEqual([e.historico.length, e.historico[0].refazer, e.historico[0].etapas.parado], [1, ['parado'], C0.etapas.parado]);
  for (const x of ['retrato', 'corrida', 'galope']) assert.deepStrictEqual(e.etapas[x], C0.etapas[x], x + ' não muda');
  assert.deepStrictEqual(lerJ(path.join(F.dirs.novos, 'molde-esguio-lisa.json')).seeds, { retrato: 3101, parado: 4101, montado: 3201, galope: 3101 });
  // a folha dos mestres diz o que foi refeito
  const Fo = await import('./folha-portes.mjs'), html = Fo.htmlFolhaMestres(Fo.dadosMestres(F.dirs.novos));
  assert.ok(html.includes('parado 4101, refeita (refação 1)') && html.includes('corrida 4202, refeita (refação 1) (2 tentativas)'), 'refação na folha');
  assert.ok(html.includes('retrato 3101 ·'), 'etapa sem refação sai como antes');
});

// Rodada de correção 1 (revisão da Task 5a): o mesmo --refazer rodado de novo depois de terminado não gasta sem
// --nova-refacao; a refação interrompida retoma sem ela (o teste do padrão acima, com o teto); reprovado sai 0.
await testA('--refazer repetido numa refação terminada: sem --nova-refacao, 0 chamadas e erro (--gerar) ou aviso (dry-run); com ela, a refação 2 (5101+)', async () => {
  const arqC = path.join(F.dirs.novos, 'criterios.json'), arqG = path.join(F.dirs.novos, 'gasto.json');
  const v = o => Pl().validarArgsPortes(Object.assign({ fase: 'mestres', refazer: ['esguio-lisa:parado'] }, o), F.dirs.novos);
  assert.match(v({ gerar: true }), /^--refazer esguio-lisa: a refação 1 de parado já terminou \(um --refazer repetido\)\. Para abrir a próxima \(parado 2\).*--nova-refacao/);
  assert.strictEqual(v({}), null, 'o dry-run roda (e avisa)');
  assert.strictEqual(v({ gerar: true, novaRefacao: true }), null);
  assert.match(Pl().validarArgsPortes({ fase: 'mestres', novaRefacao: true }, F.dirs.novos), /--nova-refacao só vale com --refazer/);
  assert.match(v({ gerar: true, refazer: ['padrao-lisa:corrida', 'esguio-lisa:parado'] }), /padrao-lisa: a refação 1 de corrida e a refação 1 de galope já terminaram/);
  // --gerar sem a confirmação: erro antes de qualquer chamada, nada gravado
  const C0 = fs.readFileSync(arqC), G0 = fs.readFileSync(arqG), api = apiFalsa(CENARIO_F);
  await assert.rejects(semRede(() => Pl().rodarPortes({ fase: 'mestres', refazer: ['esguio-lisa:parado'], modo: 'gerar', executar: api.executar, dirs: F.dirs, log: () => {} })),
    e => e.fatal && /a refação 1 de parado já terminou/.test(e.message));
  assert.strictEqual(api.chamadas.length, 0);
  assert.ok(fs.readFileSync(arqC).equals(C0) && fs.readFileSync(arqG).equals(G0), 'criterios.json e gasto.json intactos');
  // dry-run sem a confirmação: o aviso em destaque e nada previsto
  const l1 = [];
  await semRede(() => Pl().dryRunPortes({ fase: 'mestres', refazer: ['esguio-lisa:parado'], dirs: F.dirs }, l => l1.push(l)));
  const t1 = l1.join('\n');
  assert.match(t1, /^!!! AVISO: --refazer esguio-lisa: a refação 1 de parado já terminou/m); assert.match(t1, /o --gerar recusa rodar assim/);
  assert.match(t1, /Total previsto: 0 gerações em 0 chamadas novas/); assert.ok(!/esguio-lisa\/parado +seed 5101/.test(t1));
  // com --nova-refacao: a refação 2, no bloco 5101+
  const l2 = [];
  await semRede(() => Pl().dryRunPortes({ fase: 'mestres', refazer: ['esguio-lisa:parado'], novaRefacao: true, dirs: F.dirs }, l => l2.push(l)));
  assert.match(l2.join('\n'), /parado \(refação 2: seeds 5101, 5201, 5301\)/); assert.match(l2.join('\n'), /Total previsto: 1 gerações em 1 chamadas novas/);
  const api2 = apiFalsa(CENARIO_F);
  const r = await semRede(() => Pl().rodarPortes({ fase: 'mestres', refazer: ['esguio-lisa:parado'], novaRefacao: true, modo: 'gerar', executar: api2.executar, dirs: F.dirs, log: () => {} }));
  assert.strictEqual(r.parada, null);
  assert.deepStrictEqual(etapasDe(api2.chamadas), ['esguio/parado 5101']);
  const e = lerJ(arqC).itens['esguio-lisa'];
  assert.deepStrictEqual([e.refacoes.parado, e.etapas.parado.escolhida, e.historico.length, e.historico[1].refacoes], [2, 5101, 2, { parado: 1 }]);
  // o galope que vem junto com a 1ª refação da corrida não pede a confirmação, mesmo com o galope já refeito antes
  const api3 = apiFalsa(CENARIO_F);
  await semRede(() => Pl().rodarPortes({ fase: 'mestres', refazer: ['robusto-lisa:galope'], modo: 'gerar', executar: api3.executar, dirs: F.dirs, log: () => {} }));
  assert.strictEqual(Pl().validarArgsPortes({ fase: 'mestres', refazer: ['robusto-lisa:corrida'], gerar: true }, F.dirs.novos), null);
  await semRede(() => Pl().rodarPortes({ fase: 'mestres', refazer: ['robusto-lisa:corrida'], modo: 'gerar', executar: api3.executar, dirs: F.dirs, log: () => {} }));
  assert.deepStrictEqual(etapasDe(api3.chamadas), ['galope 4103', 'robusto/corrida 4103', 'galope 5103']);
  assert.deepStrictEqual(lerJ(arqC).itens['robusto-lisa'].refacoes, { retrato: 0, parado: 0, corrida: 1, galope: 2 });
});
fs.rmSync(F.raiz, { recursive: true, force: true });

await testA('código de saída do lote: rodada completa com item reprovado sai 0; teto e item incompleto saem 1; o CLI usa a mesma regra', async () => {
  const K = pastaTemp();
  const r = await semRede(() => Pl().rodarPortes({ fase: 'mestres', modo: 'gerar', executar: apiFalsa(CENARIO).executar, dirs: K.dirs, log: () => {} }));
  assert.deepStrictEqual([r.parada, r.falhas, r.incompletos, Pl().codigoSaidaPortes(r)], [null, 1, 0, 0], 'o robusto reprova no lombo e a saída é 0');
  const rp = await semRede(() => Pl().rodarPortes({ fase: 'mestres', modo: 'reprocessar', dirs: K.dirs, log: () => {} }));
  assert.deepStrictEqual([rp.falhas, Pl().codigoSaidaPortes(rp)], [1, 0], '--reprocessar com reprovado também sai 0');
  fs.unlinkSync(path.join(K.dirs.raw, 'portes-esguio-lisa-parado-s3101.png')); fs.unlinkSync(path.join(K.dirs.raw, 'portes-esguio-lisa-parado-s3101.json'));
  const ri = await semRede(() => Pl().rodarPortes({ fase: 'mestres', modo: 'reprocessar', dirs: K.dirs, log: () => {} }));
  assert.deepStrictEqual([ri.parada, ri.incompletos, Pl().codigoSaidaPortes(ri)], [null, 1, 1], 'item incompleto (falta cru) sai 1');
  const T = pastaTemp();
  const rt = await semRede(() => Pl().rodarPortes({ fase: 'mestres', teto: 3, modo: 'gerar', executar: apiFalsa(CENARIO).executar, dirs: T.dirs, log: () => {} }));
  assert.ok(/^TETO/.test(rt.parada)); assert.strictEqual(Pl().codigoSaidaPortes(rt), 1);
  const cli = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'pixellab-moldes.mjs'), 'utf8');
  const gp = cli.slice(cli.indexOf('async function gerarPortes'), cli.indexOf('const args = lerArgs'));
  assert.ok(/return codigo;/.test(gp) && /const codigo = codigoSaidaPortes\(r\)/.test(gp) && !/return r\.parada \|\| r\.falhas/.test(gp), 'o gerarPortes sai pela mesma regra');
  for (const x of [K, T]) fs.rmSync(x.raiz, { recursive: true, force: true });
});

await testA('pedido do robusto: o texto novo sai nos pedidos; o antigo (versão 1) reconhece os crus dele; cru com outro pedido não é refeito por cima', async () => {
  const T = Pl().TEXTOS_PORTE;
  assert.deepStrictEqual(T.robusto.map(v => v.versao), [1, 2]);
  assert.strictEqual(T.robusto[0].texto, 'short stocky robust horse inspired by the Crioulo breed, low and wide, deep thick chest, short thick muscular neck, short strong sturdy legs, full thick mane, compact heavy body, clearly shorter and wider than an average horse');
  assert.strictEqual(Pl().TEXTO_PORTE.robusto, T.robusto[1].texto);
  for (const k of ['Crioulo', 'barrel', 'draft', 'shorter than the depth of the body', 'large heavy head', 'low heavy stance']) assert.ok(T.robusto[1].texto.includes(k), k);
  // esguio e padrão não mudam
  assert.deepStrictEqual([T.esguio.length, T.padrao.length], [1, 1]);
  assert.strictEqual(Pl().TEXTO_PORTE.esguio, 'tall slender lean horse inspired by the Mangalarga breed, very long thin legs, long slim neck held high, small refined head, tail set and carried high, narrow light body, clearly taller and thinner than an average horse');
  assert.strictEqual(Pl().TEXTO_PORTE.padrao, 'balanced medium build horse inspired by the Campolina breed, average proportions, slightly convex head profile, medium length neck and legs, well proportioned body');
  // as 4 pernas separadas continuam nas poses paradas do robusto
  assert.match(Pl().pedidoPorte({ porte: 'robusto', estilo: 'lisa', mestre: true }, 'parado', 1).description, /barrel-shaped.*all four legs clearly visible and separated/);
  // dry-run numa pasta vazia: os 12 de sempre, e o robusto com o texto novo
  const H = pastaTemp(), linhas = [];
  await semRede(() => Pl().dryRunPortes({ fase: 'mestres', dirs: H.dirs }, l => linhas.push(l)));
  const txt = linhas.join('\n');
  assert.match(txt, /Total previsto: 12 gerações em 12 chamadas novas/);
  const rob = txt.split('\n').filter((l, i, a) => /POST \S+ +robusto-lisa\/(retrato|parado|corrida) /.test(a[i - 1] || ''));
  assert.strictEqual(rob.length, 3); assert.ok(rob.every(l => l.includes(T.robusto[1].texto) && !l.includes(T.robusto[0].texto)));
  // crus do robusto pedidos com o texto antigo: reaproveitados (versaoTexto 1), sem chamada nem sobrescrita
  const v2 = T.robusto.pop();
  try {
    await semRede(() => Pl().rodarPortes({ fase: 'mestres', modo: 'gerar', executar: apiFalsa().executar, dirs: H.dirs, log: () => {} }));
  } finally { T.robusto.push(v2); }
  const crus = crusDe(H.dirs.raw), api = apiFalsa();
  await semRede(() => Pl().rodarPortes({ fase: 'mestres', modo: 'gerar', executar: api.executar, dirs: H.dirs, log: () => {} }));
  assert.strictEqual(api.chamadas.length, 0); assert.deepStrictEqual(iguaisAntes(crus, H.dirs.raw), []);
  const rt = lerJ(path.join(H.dirs.novos, 'criterios.json')).itens['robusto-lisa'].etapas.retrato.tentativas[0];
  assert.deepStrictEqual([rt.versaoTexto, rt.prompt.includes(T.robusto[0].texto)], [1, true]);
  assert.strictEqual(lerJ(path.join(H.dirs.novos, 'criterios.json')).itens['padrao-lisa'].etapas.retrato.tentativas[0].versaoTexto, 1);
  // --refazer do robusto: o texto novo, nas seeds novas
  const l2 = [];
  await semRede(() => Pl().dryRunPortes({ fase: 'mestres', refazer: ['robusto-lisa:retrato,parado,corrida,galope'], dirs: H.dirs }, l => l2.push(l)));
  const t2 = l2.join('\n');
  assert.deepStrictEqual(t2.match(/POST \S+ +\S+ +seed \d+/g).map(x => x.replace(/ +/g, ' ')), ['retrato', 'parado', 'corrida'].map(e => `POST /create-image-pixflux robusto-lisa/${e} seed 4103`).concat('POST /animate-with-text-v3 robusto-lisa/galope seed 4103'));
  const r2 = t2.split('\n').filter((l, i, a) => /POST \S+ +robusto-lisa\/(retrato|parado|corrida) +seed 4103/.test(a[i - 1] || ''));
  assert.strictEqual(r2.length, 3); assert.ok(r2.every(l => l.includes(T.robusto[1].texto)));
  // um cru com o mesmo nome e outro pedido (nenhum texto conhecido): o --gerar para antes de pagar e não o sobrescreve
  const arq = path.join(H.dirs.raw, 'portes-robusto-lisa-parado-s3103.json'), reg = lerJ(arq);
  reg.pedido.description = 'outro pedido qualquer'; fs.writeFileSync(arq, JSON.stringify(reg, null, 2) + '\n');
  const antes = fs.readFileSync(arq), api3 = apiFalsa();
  const r3 = await semRede(() => Pl().rodarPortes({ fase: 'mestres', modo: 'gerar', executar: api3.executar, dirs: H.dirs, log: () => {} }));
  assert.match(r3.parada || '', /^ERRO FATAL: raw\/portes-robusto-lisa-parado-s3103: já existe um cru de robusto-lisa\/parado seed 3103 com outro pedido/);
  assert.strictEqual(api3.chamadas.length, 0); assert.ok(fs.readFileSync(arq).equals(antes));
  const l3 = [];
  await semRede(() => Pl().dryRunPortes({ fase: 'mestres', dirs: H.dirs }, l => l3.push(l)));
  assert.match(l3.join('\n'), /O --gerar PARARIA aqui \(a lista acima vai só até este ponto\): ERRO FATAL: raw\/portes-robusto-lisa-parado-s3103/);
  fs.rmSync(H.raiz, { recursive: true, force: true });
});

// ---------------------------------------------------------------- Portes: Task 5b (decisões da folha v2)
// --escolher: a escolha manual de uma tentativa já paga (sem rede e sem custo), com os critérios aceitos na folha;
// --guia-mestre: o mestre guiado por outro mestre (o robusto pelo padrão), com a força do init_image caindo a cada tentativa.
section('Portes: escolha manual e mestre guiado por outro');
// Pasta G: o parado do esguio sai com 2 pernas na seed 3101 e com buracos (forma) em todas as outras, também na refação
// (4101+); a corrida do esguio sai com 1 perna na 3101 e passa na 3201; no robusto guiado (refação 2), o retrato e o parado
// da seed base (5103) saem com duas pernas coladas. Na refação 3 do robusto, os 3 retratos reprovam nos 2 critérios dos
// portes: o 6103 com o corpo do padrão (o mais longe), o 6203 quase lá (o mais perto) e o 6303 no meio.
const G = pastaTemp(), arqCG = path.join(G.dirs.novos, 'criterios.json'), arqGG = path.join(G.dirs.novos, 'gasto.json');
const CENARIO_G = {
  parada: ({ porte, estilo, etapa, seed }) => Object.assign({},
    porte === 'esguio' && estilo === 'lisa' && etapa === 'parado' ? (seed === 3101 ? { sem: [1, 3] } : { furos: true }) : {},
    porte === 'esguio' && estilo === 'lisa' && etapa === 'corrida' && seed === 3101 ? { sem: [1, 2, 3] } : {},
    porte === 'robusto' && estilo === 'lisa' && (etapa === 'retrato' || etapa === 'parado') && seed === 5103 ? { coladas: true } : {},
    porte === 'robusto' && estilo === 'lisa' && etapa === 'retrato' ? ({ 6103: { esp: 12, perna: 10 }, 6203: { esp: 14, perna: 6 }, 6303: { esp: 13, perna: 8 } })[seed] || {} : {}),
};
const MOTIVO = 'aceito na folha pelo Vinicius: desenho melhor, 2 pernas visíveis';
const moldeG = n => path.join(G.dirs.novos, `molde-esguio-lisa${n ? '-' + n : ''}.${n ? 'png' : 'json'}`);
let parado3101 = null;

await testA('--escolher: sem chamada nenhuma, troca pela tentativa do histórico, regrava novos/, aceita os critérios e mantém o histórico', async () => {
  const api = apiFalsa(CENARIO_G);
  await semRede(() => Pl().rodarPortes({ fase: 'mestres', modo: 'gerar', executar: api.executar, dirs: G.dirs, log: () => {} }));
  parado3101 = fs.readFileSync(moldeG('parado'));
  assert.deepStrictEqual([lerJ(arqCG).itens['esguio-lisa'].etapas.parado.escolhida, lerJ(arqCG).itens['esguio-lisa'].ok], [3101, false]);
  // a refação 1 do parado (4101+) reprova na forma nas 3 seeds e fica com a 4101, como no lote de verdade
  await semRede(() => Pl().rodarPortes({ fase: 'mestres', refazer: ['esguio-lisa:parado'], modo: 'gerar', executar: api.executar, dirs: G.dirs, log: () => {} }));
  const C1 = lerJ(arqCG), e1 = C1.itens['esguio-lisa'];
  assert.deepStrictEqual([e1.etapas.parado.escolhida, e1.etapas.parado.refacao, e1.historico.length, e1.ok], [4101, 1, 1, false]);
  assert.ok(!fs.readFileSync(moldeG('parado')).equals(parado3101));
  // erros de uso
  const v = o => Pl().validarArgsPortes(Object.assign({ fase: 'mestres', escolher: ['esguio-lisa:parado=3101'], motivo: MOTIVO }, o), G.dirs.novos, G.dirs.raw);
  assert.strictEqual(v({}), null);
  assert.match(v({ escolher: ['esguio-lisa:parado=9999'] }), /^--escolher esguio-lisa:parado=9999: a seed 9999 não está nas tentativas de parado \(seeds tentadas: 4101, 4201, 4301, 3101, 3201, 3301\)/);
  assert.match(v({ motivo: null }), /--escolher pede --motivo/); assert.match(v({ motivo: '  ' }), /--escolher pede --motivo/);
  assert.match(v({ gerar: true }), /não anda com --gerar/); assert.match(v({ reprocessar: true }), /não anda com --gerar nem com --reprocessar/);
  assert.match(v({ refazer: ['esguio-lisa:parado'] }), /não anda com --refazer/); assert.match(v({ only: 'esguio' }), /nem --only/);
  assert.match(v({ escolher: ['esguio-lisa:pescoco=3101'] }), /use <porte>-<estilo>:<etapa>=<seed>/);
  assert.match(v({ escolher: ['esguio-lisa:parado'] }), /use <porte>-<estilo>:<etapa>=<seed>/);
  assert.match(v({ escolher: ['esguio-lisa:parado=3101', 'esguio-lisa:parado=3201'] }), /repetido/);
  assert.match(v({ escolher: ['padrao-chamas:parado=3101'] }), /não está na fase "mestres"/);
  assert.match(Pl().validarArgsPortes({ fase: 'mestres', motivo: MOTIVO }, G.dirs.novos, G.dirs.raw), /--motivo só vale com --escolher/);
  // a cópia sem imagem (cru apagado) também é erro de uso
  const cru3201 = path.join(G.dirs.raw, 'portes-esguio-lisa-parado-s3201.png'), b3201 = fs.readFileSync(cru3201);
  fs.unlinkSync(cru3201);
  try { assert.match(v({ escolher: ['esguio-lisa:parado=3201'] }), /a tentativa seed 3201 de parado não serve: raw\/portes-esguio-lisa-parado-s3201\.png sem imagem em raw\//); } finally { fs.writeFileSync(cru3201, b3201); }
  // a escolha: modo escolher, sem executar (qualquer chamada lançaria) — nada pago, nenhum cru novo
  const gasto = fs.readFileSync(arqGG), crus = crusDe(G.dirs.raw), log = [];
  const r = await semRede(() => Pl().rodarPortes({ fase: 'mestres', escolher: ['esguio-lisa:parado=3101'], motivo: MOTIVO, modo: 'escolher', dirs: G.dirs, log: m => log.push(m) }));
  assert.deepStrictEqual([r.parada, r.itens, r.falhas, r.incompletos, r.naoGravados, Pl().codigoSaidaPortes(r)], [null, ['esguio-lisa'], 0, 0, [], 0]);
  assert.ok(fs.readFileSync(arqGG).equals(gasto), 'o gasto não muda');
  assert.deepStrictEqual([iguaisAntes(crus, G.dirs.raw), Object.keys(crusDe(G.dirs.raw)).length], [[], Object.keys(crus).length], 'raw/ intacto');
  const e = lerJ(arqCG).itens['esguio-lisa'], x = e.etapas.parado;
  assert.deepStrictEqual([e.ok, e.completo, e.falhas, e.aceitos], [true, true, [], ['parado: pernas no parado = 2 (= 4)']]);
  assert.deepStrictEqual([x.escolhida, x.ok, x.refacao, x.escolha.manual, x.escolha.seed, x.escolha.motivo, x.escolha.refacao, x.escolha.origem, x.escolha.aceitos, x.escolha.arquivo],
    [3101, false, 1, true, 3101, MOTIVO, 0, 'refação 0, no histórico', ['pernas no parado'], 'raw/portes-esguio-lisa-parado-s3101.png']);
  assert.ok(!Number.isNaN(Date.parse(x.escolha.data)));
  // as tentativas da refação 1 ficam; a 3101 entra no fim, importada do histórico, com o critério aceito
  assert.deepStrictEqual(x.tentativas.map(t => t.seed + (t.importada ? 'i' : '') + (t.manual ? 'm' : '')), ['4101', '4201', '4301', '3101im']);
  assert.deepStrictEqual(x.tentativas[3].criterios.filter(c => !c.ok).map(c => [c.criterio, c.aceito]), [['pernas no parado', true]]);
  assert.deepStrictEqual(x.tentativas.slice(0, 3), e1.etapas.parado.tentativas, 'as da refação atual, como estavam');
  // o histórico de antes inteiro, mais a linha da escolha
  assert.deepStrictEqual(e.historico.slice(0, 1), e1.historico);
  assert.deepStrictEqual(e.historico[1], { escolher: ['parado'], data: x.escolha.data, motivo: MOTIVO, antes: { parado: { escolhida: 4101, ok: false, refacao: 1 } } });
  // o molde regravado com o parado 3101 (o mesmo PNG da 1ª rodada); as outras etapas e os outros itens como estavam
  assert.ok(fs.readFileSync(moldeG('parado')).equals(parado3101));
  assert.deepStrictEqual(lerJ(moldeG()).seeds, { retrato: 3101, parado: 3101, montado: 3201, galope: 3101 });
  for (const ch of ['padrao-lisa', 'robusto-lisa']) assert.deepStrictEqual(lerJ(arqCG).itens[ch], C1.itens[ch], ch);
  for (const k of ['retrato', 'corrida', 'galope']) assert.deepStrictEqual(e.etapas[k], e1.etapas[k], k);
  assert.ok(log.some(m => /esguio-lisa\/parado: escolha manual, seed 3101 \(refação 0, no histórico; raw\/portes-esguio-lisa-parado-s3101\.png\)/.test(m)), log.join('\n'));
  // direto no rodarPortes, seed inexistente também para antes de gravar
  await assert.rejects(semRede(() => Pl().rodarPortes({ fase: 'mestres', escolher: ['esguio-lisa:parado=9999'], motivo: MOTIVO, modo: 'escolher', dirs: G.dirs, log: () => {} })), e2 => e2.fatal && /a seed 9999 não está/.test(e2.message));
});

await testA('--escolher: a escolha vale nas rodadas seguintes (0 chamadas) e a folha mostra "escolha manual — aceito na folha"', async () => {
  const antes = lerJ(arqCG).itens['esguio-lisa'], api = apiFalsa(CENARIO_G);
  await semRede(() => Pl().rodarPortes({ fase: 'mestres', modo: 'gerar', executar: api.executar, dirs: G.dirs, log: () => {} }));
  assert.strictEqual(api.chamadas.length, 0);
  const e = lerJ(arqCG).itens['esguio-lisa'];
  assert.deepStrictEqual([e.etapas.parado.escolhida, e.ok, e.historico.length, e.etapas.parado.escolha], [3101, true, antes.historico.length, antes.etapas.parado.escolha]);
  assert.ok(fs.readFileSync(moldeG('parado')).equals(parado3101));
  const rp = await semRede(() => Pl().rodarPortes({ fase: 'mestres', modo: 'reprocessar', dirs: G.dirs, log: () => {} }));
  assert.deepStrictEqual([rp.incompletos, lerJ(arqCG).itens['esguio-lisa'].etapas.parado.escolhida], [0, 3101], 'o --reprocessar também');
  const linhas = [];
  await semRede(() => Pl().dryRunPortes({ fase: 'mestres', dirs: G.dirs }, l => linhas.push(l)));
  const txt = linhas.join('\n');
  assert.match(txt, /Escolhas manuais \(0 geração; valem até um --refazer da etapa\): esguio-lisa\/parado \(seed 3101, refação 0, no histórico; aceito na folha: pernas no parado\)/);
  assert.match(txt, /Total previsto: 0 gerações em 0 chamadas novas/);
  const Fo = await import('./folha-portes.mjs'), html = Fo.htmlFolhaMestres(Fo.dadosMestres(G.dirs.novos));
  assert.ok(html.includes(`parado 3101: escolha manual — aceito na folha: ${MOTIVO}`), 'a linha da escolha');
  assert.match(html, /<span class="aceito">aceito na folha<\/span> pernas no parado: 2/);
  assert.ok(!/<span class="nao">NÃO<\/span> pernas no parado/.test(html.slice(html.indexOf('id="esguio-lisa"'))), 'não sai como reprovado');
  assert.match(html, /id="esguio-lisa"><h2>[^<]*<small>esguio-lisa<\/small><span class="selo aceito">aceito na folha<\/span>/);
  assert.ok(html.includes('parado 3101 (escolha manual, da refação 0, no histórico) (4 tentativas)'));
});

await testA('--escolher da corrida não muda o galope: avisa, o galope fica escolhido e nada é animado de novo; --refazer tira a escolha', async () => {
  const galope = Array.from({ length: 9 }, (_, i) => fs.readFileSync(moldeG('galope-' + i)));
  const r = await semRede(() => Pl().rodarPortes({ fase: 'mestres', escolher: ['esguio-lisa:corrida=3101'], motivo: 'corrida mais baixa', modo: 'escolher', dirs: G.dirs, log: () => {} }));
  assert.ok(r.avisos.some(a => /^--escolher esguio-lisa:corrida=3101: o galope escolhido \(seed 3101, raw\/portes-esguio-lisa-galope-c3201-s3101-0\.\.8\.png\) partiu de outra corrida \(esguio-lisa\/corrida seed 3201\); ele continua o escolhido e não é refeito/.test(a)), r.avisos.join(' | '));
  const e = lerJ(arqCG).itens['esguio-lisa'];
  assert.deepStrictEqual([e.etapas.corrida.escolhida, e.etapas.corrida.escolha.aceitos, e.etapas.galope.escolhida, /o galope continua o escolhido/.test(e.etapas.galope.escolha.automatico), e.etapas.parado.escolhida],
    [3101, ['pernas na pose de corrida (o quadro 0 do galope)'], 3101, true, 3101]);
  assert.ok(e.etapas.galope.tentativas.find(t => t.seed === 3101).criterios.every(c => c.ok), 'o galope medido contra a corrida de onde saiu (3201)');
  assert.deepStrictEqual(lerJ(moldeG()).seeds, { retrato: 3101, parado: 3101, montado: 3101, galope: 3101 });
  galope.forEach((b, i) => assert.ok(fs.readFileSync(moldeG('galope-' + i)).equals(b), 'galope-' + i));
  const api = apiFalsa(CENARIO_G);
  await semRede(() => Pl().rodarPortes({ fase: 'mestres', modo: 'gerar', executar: api.executar, dirs: G.dirs, log: () => {} }));
  assert.strictEqual(api.chamadas.length, 0, 'nenhum galope novo a partir da corrida escolhida');
  // o --refazer do parado tira a escolha manual dele (seeds novas, 5101+); as da corrida e do galope ficam
  const l = [];
  await semRede(() => Pl().dryRunPortes({ fase: 'mestres', refazer: ['esguio-lisa:parado'], novaRefacao: true, dirs: G.dirs }, x => l.push(x)));
  const txt = l.join('\n');
  assert.deepStrictEqual(txt.match(/POST \S+ +\S+ +seed \d+/g).map(x => x.replace(/ +/g, ' ')), ['POST /create-image-pixflux esguio-lisa/parado seed 5101']);
  assert.match(txt, /Escolhas manuais [^\n]*esguio-lisa\/corrida \(seed 3101[^\n]*esguio-lisa\/galope \(seed 3101/);
  assert.ok(!/Escolhas manuais [^\n]*esguio-lisa\/parado/.test(txt));
});

const REFORCO = 'same horse redrawn shorter and stockier: much shorter legs, deeper barrel body, thicker neck';
const CMD_GUIA = { fase: 'mestres', refazer: ['robusto-lisa:retrato,parado,corrida,galope'], novaRefacao: true, guiaMestre: ['robusto-lisa=padrao-lisa'] };

await testA('--guia-mestre: erros de uso (sem --refazer, o mesmo porte, sem reforço, fora dos mestres, guia refeito junto, guia sem o cru)', async () => {
  const v = o => Pl().validarArgsPortes(Object.assign({ fase: 'mestres', refazer: ['robusto-lisa:retrato,parado,corrida,galope'], guiaMestre: ['robusto-lisa=padrao-lisa'] }, o), G.dirs.novos, G.dirs.raw);
  assert.strictEqual(v({}), null);
  assert.match(v({ refazer: [] }), /^--guia-mestre robusto-lisa=padrao-lisa: anda com o --refazer de robusto-lisa com retrato, parado ou corrida/);
  assert.match(v({ refazer: ['robusto-lisa:galope'] }), /anda com o --refazer de robusto-lisa com retrato, parado ou corrida/);
  assert.match(v({ guiaMestre: ['robusto-lisa=robusto-lisa'] }), /o mestre não guia a si mesmo/);
  assert.match(v({ guiaMestre: ['padrao-lisa=esguio-lisa'], refazer: ['padrao-lisa:retrato'] }), /o padrao não tem reforço de proporção/);
  assert.match(v({ guiaMestre: ['robusto-chamas=padrao-lisa'] }), /use <porte>-lisa=<porte>-lisa/);
  assert.match(v({ guiaMestre: ['robusto-lisa=padrao-lisa', 'robusto-lisa=esguio-lisa'] }), /dois guias/);
  assert.match(v({ refazer: ['robusto-lisa:retrato', 'padrao-lisa:retrato'] }), /o guia padrao-lisa não pode ser refeito na mesma rodada/);
  assert.match(Pl().validarArgsPortes({ fase: 'piloto', guiaMestre: ['robusto-lisa=padrao-lisa'] }, G.dirs.novos, G.dirs.raw), /só na fase mestres/);
  assert.match(v({ refazer: ['robusto-lisa:parado,corrida'] }), /a força do parado e da corrida sai do retrato aceito, e o retrato escolhido de robusto-lisa não saiu guiado por outro mestre: refaça o retrato junto \(--refazer robusto-lisa:retrato,parado,corrida\)/);
  assert.deepStrictEqual(Pl().lerGuiasMestre(['robusto-lisa=padrao-lisa', 'esguio-lisa=padrao-lisa']).guias, { 'robusto-lisa': 'padrao-lisa', 'esguio-lisa': 'padrao-lisa' });
  // o guia sem o cru escolhido da corrida: erro de uso só quando a corrida é refeita
  const cru = path.join(G.dirs.raw, 'portes-padrao-lisa-corrida-s3102.png'), guardado = fs.readFileSync(cru);
  fs.unlinkSync(cru);
  try {
    assert.match(v({}), /--guia-mestre robusto-lisa=padrao-lisa: falta o cru escolhido de padrao-lisa\/corrida em .*raw\/ \(seed 3102\)/);
    assert.strictEqual(v({ refazer: ['robusto-lisa:retrato,parado'] }), null, 'só as etapas refeitas precisam do cru do guia');
  } finally { fs.writeFileSync(cru, guardado); }
});

await testA('--guia-mestre robusto-lisa=padrao-lisa: o dry-run do comando prevê 4 chamadas (pior caso 12), init_image = os crus do padrão, forças 90/60/35', async () => {
  // a 1ª refação do robusto (sem guia), como a de 2026-11-13; o comando do exemplo abre a 2ª, com --nova-refacao
  await semRede(() => Pl().rodarPortes({ fase: 'mestres', refazer: ['robusto-lisa:retrato,parado,corrida,galope'], modo: 'gerar', executar: apiFalsa(CENARIO_G).executar, dirs: G.dirs, log: () => {} }));
  assert.strictEqual(Pl().validarArgsPortes(Object.assign({ gerar: true }, CMD_GUIA), G.dirs.novos, G.dirs.raw), null, 'o --gerar do comando passa na validação');
  assert.match(Pl().validarArgsPortes(Object.assign({}, CMD_GUIA, { gerar: true, novaRefacao: false }), G.dirs.novos, G.dirs.raw), /a refação 1 de retrato.*já terminaram/, 'a mesma trava de refação');
  const linhas = [], crus = crusDe(G.dirs.raw), criterios = fs.readFileSync(arqCG);
  await semRede(() => Pl().dryRunPortes(Object.assign({ dirs: G.dirs }, CMD_GUIA), l => linhas.push(l)));
  const txt = linhas.join('\n');
  assert.deepStrictEqual(txt.match(/POST \S+ +\S+ +seed \d+/g).map(x => x.replace(/ +/g, ' ')),
    ['retrato', 'parado', 'corrida'].map(e => `POST /create-image-pixflux robusto-lisa/${e} seed 5103`).concat('POST /animate-with-text-v3 robusto-lisa/galope seed 5103'));
  assert.match(txt, /Total previsto: 4 gerações em 4 chamadas novas \(\+ \d+ reaproveitadas de raw\/\); no pior caso \(3 seeds por etapa\), 12;/);
  assert.ok(txt.includes('[init_image = raw/portes-padrao-lisa-retrato-s3102.png; init_image_strength 90]'), 'retrato: a 1ª força');
  // o parado e a corrida usam a força do retrato aceito, que o dry-run ainda não sabe
  for (const e of ['parado', 'corrida']) assert.ok(txt.includes(`[init_image = raw/portes-padrao-lisa-${e}-s3102.png; init_image_strength = a do retrato aceito (o retrato ainda não saiu)]`), e);
  assert.match(txt, /AVISO: --guia-mestre robusto-lisa=padrao-lisa: retrato com init_image = raw\/portes-padrao-lisa-retrato-s3102\.png, parado com init_image = raw\/portes-padrao-lisa-parado-s3102\.png, corrida com init_image = raw\/portes-padrao-lisa-corrida-s3102\.png;/);
  assert.match(txt, /retrato: forças 90 \(seed 5103\), 60 \(seed 5203\), 35 \(seed 5303\), parando na 1ª que passa nos critérios; parado e corrida: a força do retrato aceito \(ou do melhor, se os 3 reprovarem\), a mesma em todas as seeds \(5103, 5203, 5303\), parando na 1ª que passa; o galope parte da corrida aceita/);
  assert.ok(!/!!! AVISO: --refazer robusto-lisa/.test(txt), 'com --guia-mestre, nenhum aviso de guia perdida');
  const textos = txt.split('\n').filter((l, i, a) => /POST \S+ +robusto-lisa\/(retrato|parado|corrida) /.test(a[i - 1] || ''));
  assert.ok(textos.length === 3 && textos.every(l => l.includes(`${Pl().TEXTO_PORTE.robusto}, ${REFORCO}, `)), 'o texto do robusto (v2) e o reforço logo depois');
  assert.deepStrictEqual([Pl().REFORCO_PROPORCAO.robusto, [...Pl().FORCAS_GUIA_MESTRE]], [REFORCO, [90, 60, 35]]);
  assert.deepStrictEqual(iguaisAntes(crus, G.dirs.raw), []); assert.ok(fs.readFileSync(arqCG).equals(criterios), 'o dry-run não grava');
  // sem --guia-mestre, o pedido de sempre (o mesmo de antes desta tarefa)
  assert.ok(!Pl().pedidoPorte({ porte: 'robusto', estilo: 'lisa', mestre: true }, 'retrato', 1).description.includes(REFORCO));
});

await testA('--guia-mestre com a API falsa: o retrato aprovado na 2ª (força 60) para no meio; parado e corrida pedem 60 em toda tentativa; o cru leva força e guia no nome; a guia fica gravada', async () => {
  const api = apiFalsa(CENARIO_G), g0 = lerJ(arqGG).geracoes;
  const r = await semRede(() => Pl().rodarPortes(Object.assign({ modo: 'gerar', executar: api.executar, dirs: G.dirs, log: () => {} }, CMD_GUIA)));
  assert.strictEqual(r.parada, null);
  // o parado 5103 reprova (pernas coladas) e o 5203 passa: as duas tentativas com a força do retrato aceito, 60
  assert.deepStrictEqual(api.chamadas.map(c => (c.etapa || 'galope') + ' ' + c.seed + (c.forca ? ' f' + c.forca : '')), ['retrato 5103 f90', 'retrato 5203 f60', 'parado 5103 f60', 'parado 5203 f60', 'corrida 5103 f60', 'galope 5103']);
  for (const c of api.chamadas.filter(x => x.etapa)) {
    assert.strictEqual(c.init, fs.readFileSync(path.join(G.dirs.raw, `portes-padrao-lisa-${c.etapa}-s3102.png`)).toString('base64'), c.etapa + ': init_image = o cru do padrão');
  }
  assert.strictEqual(lerJ(arqGG).geracoes, g0 + 6, 'conta no teto somado');
  for (const f of ['retrato-g90padrao3102-s5103', 'retrato-g60padrao3102-s5203', 'parado-g60padrao3102-s5103', 'parado-g60padrao3102-s5203', 'corrida-g60padrao3102-s5103', 'galope-c5103g60padrao3102-s5103-0']) {
    assert.ok(fs.existsSync(path.join(G.dirs.raw, `portes-robusto-lisa-${f}.png`)), f);
  }
  assert.ok(!fs.readdirSync(G.dirs.raw).some(f => /g35padrao/.test(f)), 'a 3ª tentativa não saiu');
  const rob = lerJ(arqCG).itens['robusto-lisa'], tr = rob.etapas.retrato.tentativas;
  assert.deepStrictEqual([rob.ok, rob.refacoes, rob.etapas.retrato.escolhida, rob.historico.length, rob.historico[1].refacoes], [true, { retrato: 2, parado: 2, corrida: 2, galope: 2 }, 5203, 2, { retrato: 1, parado: 1, corrida: 1, galope: 1 }]);
  assert.deepStrictEqual(tr.map(t => [t.seed, t.init_image_strength, t.init_image, t.guiaMestre, t.ok]),
    [[5103, 90, 'raw/portes-padrao-lisa-retrato-s3102.png', 'padrao-lisa', false], [5203, 60, 'raw/portes-padrao-lisa-retrato-s3102.png', 'padrao-lisa', true]]);
  assert.ok(tr[1].criterios.some(c => /^portes: altura\/comprimento do robusto/.test(c.criterio) && c.ok) && tr[1].criterios.some(c => /^portes: espessura/.test(c.criterio)), 'os portes distintos no aceite do retrato');
  assert.ok(tr.every(t => t.prompt.includes(REFORCO)));
  assert.deepStrictEqual(rob.guiaMestre.retrato, { mestre: 'padrao-lisa', seed: 3102, arquivo: 'raw/portes-padrao-lisa-retrato-s3102.png', refacao: 2, forcas: [90, 60, 35], reforco: REFORCO });
  assert.deepStrictEqual(Object.keys(rob.guiaMestre), ['retrato', 'parado', 'corrida']);
  for (const e of ['parado', 'corrida']) {
    assert.deepStrictEqual([rob.guiaMestre[e].forcas, rob.guiaMestre[e].forcaDoRetrato], [[60], { seed: 5203, forca: 60 }], e + ': a força do retrato aceito, gravada');
    assert.ok(rob.etapas[e].tentativas.every(t => t.init_image_strength === 60 && t.guiaMestre === 'padrao-lisa'), e);
  }
  assert.strictEqual(rob.etapas.galope.tentativas[0].arquivo, 'raw/portes-robusto-lisa-galope-c5103g60padrao3102-s5103-0..8.png', 'o galope parte da corrida aceita');
  // de novo, sem opções: a guia gravada refaz os mesmos pedidos ⇒ tudo reaproveitado; o --reprocessar também
  const api2 = apiFalsa(CENARIO_G);
  await semRede(() => Pl().rodarPortes({ fase: 'mestres', modo: 'gerar', executar: api2.executar, dirs: G.dirs, log: () => {} }));
  assert.deepStrictEqual([api2.chamadas.length, lerJ(arqCG).itens['robusto-lisa'].etapas.retrato.escolhida], [0, 5203]);
  const rp = await semRede(() => Pl().rodarPortes({ fase: 'mestres', modo: 'reprocessar', dirs: G.dirs, log: () => {} }));
  assert.deepStrictEqual([rp.incompletos, lerJ(arqCG).itens['robusto-lisa'].ok], [0, true]);
  // a folha mostra a guia e a força da escolhida
  const Fo = await import('./folha-portes.mjs'), html = Fo.htmlFolhaMestres(Fo.dadosMestres(G.dirs.novos));
  assert.ok(html.includes('retrato 5203, refeita (refação 2) (2 tentativas), guiada por padrao-lisa com força 60'), 'a força da escolhida');
  assert.ok(html.includes('Guia de outro mestre: retrato com init_image = raw/portes-padrao-lisa-retrato-s3102.png (forças 90, 60, 35 por tentativa); parado com init_image = raw/portes-padrao-lisa-parado-s3102.png (força 60, a do retrato aceito (seed 5203))'));
  assert.ok(html.includes('parado 5203, refeita (refação 2) (2 tentativas), guiada por padrao-lisa com força 60'));
  // com o retrato guiado gravado, o parado guiado sem refazer o retrato passa na validação (a força vem dele)
  assert.strictEqual(Pl().validarArgsPortes({ fase: 'mestres', refazer: ['robusto-lisa:parado'], guiaMestre: ['robusto-lisa=padrao-lisa'] }, G.dirs.novos, G.dirs.raw), null);
  // o piloto do robusto parte do mestre guiado: o init_image é o cru escolhido dele (com a marca da guia no nome)
  const lp = [];
  await semRede(() => Pl().dryRunPortes({ fase: 'piloto', only: 'robusto', dirs: G.dirs }, l => lp.push(l)));
  assert.match(lp.join('\n'), /init_image = raw\/portes-robusto-lisa-retrato-g60padrao3102-s5203\.png; init_image_strength 100\]/);
  assert.ok(!/o mestre robusto-lisa ainda não está/.test(lp.join('\n')));
});
// Rodada de correção 1 (revisão da Task 5b): o desempate pela distância aos limites, a força do retrato no parado e na
// corrida (acima, no teste da API falsa) e o aviso de guia perdida num --refazer sem --guia-mestre.
test('faltaDoLimite: a distância normalizada ao limite de cada tipo de critério (0 quando passa)', () => {
  const f = (valor, limite, ok = false) => Math.round(Pl().faltaDoLimite({ criterio: 'x', ok, valor, limite }) * 1000) / 1000;
  assert.deepStrictEqual([f(1, '≤ 0,92'), f(0.943, '≤ 0,92'), f(1, '≥ 1,15'), f(1.143, '≥ 1,15'), f(2, '= 4'), f(-5, '|Δ| ≤ 2 px'), f(5, '|Δ| ≤ 2 px'), f(5, 'varia ≤ 3 px'), f(8, '±6 px'), f(1, '≥ 2')],
    [0.087, 0.025, 0.13, 0.006, 0.5, 1.5, 1.5, 0.667, 0.333, 0.5]);
  assert.deepStrictEqual([f(3, 'paleta, papéis obrigatórios e silhueta fechada (validar)'), f(null, '≤ 0,92'), f(1, '≤ 0,92', true)], [3, 1e6, 0]);
});

await testA('desempate: com os 3 retratos reprovando os mesmos 2 critérios dos portes, fica o mais perto dos limites (não o 1º); parado e corrida usam a força dele', async () => {
  const api = apiFalsa(CENARIO_G), log = [];
  const r = await semRede(() => Pl().rodarPortes(Object.assign({ modo: 'gerar', executar: api.executar, dirs: G.dirs, log: m => log.push(m) }, CMD_GUIA)));
  assert.strictEqual(r.parada, null);
  assert.deepStrictEqual(api.chamadas.map(c => (c.etapa || 'galope') + ' ' + c.seed + (c.forca ? ' f' + c.forca : '')), ['retrato 6103 f90', 'retrato 6203 f60', 'retrato 6303 f35', 'parado 6103 f60', 'corrida 6103 f60', 'galope 6103']);
  const ret = lerJ(arqCG).itens['robusto-lisa'].etapas.retrato;
  const falhas = ret.tentativas.map(t => t.criterios.filter(c => !c.ok).map(c => c.criterio).join(' + '));
  assert.deepStrictEqual(falhas, Array(3).fill('portes: altura/comprimento do robusto ÷ a do padrão + portes: espessura/comprimento do robusto ÷ a do padrão'), 'as 3 reprovam nos mesmos 2');
  const soma = t => t.criterios.filter(c => !c.ok).reduce((s, c) => s + Pl().faltaDoLimite(c), 0);
  assert.ok(soma(ret.tentativas[1]) < soma(ret.tentativas[2]) && soma(ret.tentativas[2]) < soma(ret.tentativas[0]), ret.tentativas.map(soma).join(' '));
  assert.deepStrictEqual([ret.escolhida, ret.refacao], [6203, 3], 'fica a mais perto (força 60), não a 1ª (força 90)');
  assert.ok(log.some(m => /robusto-lisa\/retrato: reprovada nas 3 seeds; fica a melhor, a seed 6203/.test(m)));
  assert.deepStrictEqual(lerJ(arqCG).itens['robusto-lisa'].guiaMestre.parado.forcaDoRetrato, { seed: 6203, forca: 60 });
});

await testA('--refazer de uma etapa que saiu guiada, sem --guia-mestre: aviso em destaque no dry-run e no log do --gerar', async () => {
  const sem = { fase: 'mestres', refazer: ['robusto-lisa:retrato'], novaRefacao: true };
  const l1 = [];
  await semRede(() => Pl().dryRunPortes(Object.assign({ dirs: G.dirs }, sem), l => l1.push(l)));
  const aviso = /^!!! AVISO: --refazer robusto-lisa:retrato: a refação 3 de retrato saiu guiada por padrao-lisa \(--guia-mestre\), e a refação 4 sai SEM guia, só pelo texto\. Para manter a guia, repita com --guia-mestre robusto-lisa=padrao-lisa\.$/m;
  assert.match(l1.join('\n'), aviso);
  assert.match(l1.join('\n'), /^!{20,}$/m, 'em destaque');
  assert.match(l1.join('\n'), /robusto-lisa\/retrato +seed 7103[^\n]*\n {7}(?![^\n]*init_image)/, 'e o pedido sai sem init_image');
  const l2 = [];
  await semRede(() => Pl().dryRunPortes(Object.assign({ dirs: G.dirs, guiaMestre: ['robusto-lisa=padrao-lisa'] }, sem), l => l2.push(l)));
  assert.ok(!/AVISO: --refazer robusto-lisa:retrato: a refação/.test(l2.join('\n')), 'com --guia-mestre, sem o aviso');
  const log = [], api = apiFalsa(CENARIO_G);
  await semRede(() => Pl().rodarPortes(Object.assign({ modo: 'gerar', executar: api.executar, dirs: G.dirs, log: m => log.push(m) }, sem)));
  assert.ok(log.some(m => aviso.test(m.split('\n').find(x => x.startsWith('!!! AVISO')) || '')), 'no log do --gerar');
  assert.deepStrictEqual(api.chamadas.map(c => (c.etapa || 'galope') + ' ' + c.seed + (c.guia ? ' guiada' : '')), ['retrato 7103'], 'só o retrato, sem guia; o parado e a corrida seguem com a força gravada');
});
fs.rmSync(G.raiz, { recursive: true, force: true });

test('CLI: --escolher e --guia-mestre sem rede; os erros de uso saem 2 antes de gravar qualquer coisa', () => {
  const temCrit = fs.existsSync(path.join(DIR, 'novos', 'criterios.json'));
  for (const [args, msg] of [
    [['--escolher', 'esguio-lisa:parado=9999', '--motivo', 'x'], temCrit ? /--escolher esguio-lisa:parado=9999: a seed 9999 não está nas tentativas de parado/ : /ainda não tem registro/],
    [['--escolher', 'esguio-lisa:parado=3101'], /--escolher pede --motivo/],
    [['--escolher', 'esguio-lisa:parado=3101', '--motivo', 'x', '--gerar'], /não anda com --gerar/],
    [['--escolher', 'esguio-lisa:parado=3101', '--motivo', 'x', '--refazer', 'esguio-lisa:parado'], /não anda com --refazer/],
    [['--motivo', 'x'], /--motivo só vale com --escolher/],
    [['--guia-mestre', 'robusto-lisa=padrao-lisa'], /anda com o --refazer de robusto-lisa/],
    [['--guia-mestre', 'robusto-lisa=robusto-lisa', '--refazer', 'robusto-lisa:retrato'], /o mestre não guia a si mesmo/],
  ]) {
    const e = cliPortes(['--fase', 'mestres', ...args]);
    assert.strictEqual(e.status, 2, args.join(' ') + ': saída ' + e.status + '\n' + e.stdout + e.stderr);
    assert.match(e.stderr, msg); assert.ok(!/REDE PROIBIDA/.test(e.stderr));
  }
  const m = spawnSync(process.execPath, [path.join(path.dirname(fileURLToPath(import.meta.url)), 'pixellab-moldes.mjs'), '--lote', 'moldes', '--escolher', 'lisa:parado=1'], { encoding: 'utf8' });
  assert.strictEqual(m.status, 2); assert.match(m.stderr, /--escolher e --motivo só valem com --lote portes/);
  // o dry-run guiado no estado de hoje (só leitura)
  if (temCrit) {
    const r = cliPortes(['--fase', 'mestres', '--refazer', 'robusto-lisa:retrato', '--nova-refacao', '--guia-mestre', 'robusto-lisa=padrao-lisa']);
    assert.strictEqual(r.status, 0, r.stderr + r.stdout); assert.ok(!/REDE PROIBIDA/.test(r.stderr), r.stderr);
    assert.match(r.stdout, /AVISO: --guia-mestre robusto-lisa=padrao-lisa: (retrato com init_image = raw\/portes-padrao-lisa-retrato-s\d+\.png|ignorado)/);
  }
});

console.log('\n' + count + ' testes, ' + fails + ' falhas');
process.exit(fails ? 1 : 0);
