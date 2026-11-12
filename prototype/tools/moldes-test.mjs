// prototype/tools/moldes-test.mjs — node prototype/tools/moldes-test.mjs
// Testes do codec PNG e da normalização/validação dos moldes (sem rede).
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng, encodeGray } from './png.mjs';
import { createRequire } from 'node:module';
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
  // Seed base 2201 + índice; item refeito (linha com { seed }) usa a base + 100.
  test('seeds 2201..2258 na ordem da tabela (refeitos: base + 100)', () => {
    let refeitos = 0;
    ICONES_NOVOS.forEach((i, k) => {
      const base = 2201 + k;
      assert.ok(i.seed === base || i.seed === base + 100, i.id + ': seed ' + i.seed + ' (esperado ' + base + ' ou ' + (base + 100) + ')');
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

console.log('\n' + count + ' testes, ' + fails + ' falhas');
process.exit(fails ? 1 : 0);
