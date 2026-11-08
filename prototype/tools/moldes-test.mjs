// prototype/tools/moldes-test.mjs — node prototype/tools/moldes-test.mjs
// Testes do codec PNG e da normalização/validação dos moldes (sem rede).
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng, encodeGray } from './png.mjs';
import { PAPEIS, paletaPng, normalizar, validar, ancoras, paraCinza, deCinza } from './moldes-lib.mjs';

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
test('decodePng lê o PNG real brasa.png (64x64 RGBA)', () => {
  const d = decodePng(fs.readFileSync(path.join(DIR, 'brasa.png')));
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
test('paraCinza/deCinza ida e volta', () => {
  const idx = Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const g = paraCinza(idx);
  assert.strictEqual(g[9], 225);
  assert.deepStrictEqual(Array.from(deCinza(g)), Array.from(idx));
  const ruidoso = Uint8Array.from(Array.from(g).map(v => Math.min(255, v + 4)));
  assert.deepStrictEqual(Array.from(deCinza(ruidoso)), Array.from(idx));
});

section('moldes reais');
const moldes = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter(f => /^molde-.*\.json$/.test(f)) : [];
if (!moldes.length) console.log('  sem moldes reais — bloco pulado');
moldes.forEach(arq => {
  const J = JSON.parse(fs.readFileSync(path.join(DIR, arq), 'utf8'));
  const estilo = arq.replace(/^molde-|\.json$/g, '');
  const nomes = ['retrato', 'parado'].concat(Array.from({ length: 9 }, (_, i) => 'galope-' + i));
  const quadros = {};
  test(estilo + ': 11 arquivos 64x64 com índices 0–9', () => {
    nomes.forEach(n => {
      const f = path.join(DIR, 'molde-' + estilo + '-' + n + '.png');
      assert.ok(fs.existsSync(f), 'falta ' + path.basename(f));
      const d = decodePng(fs.readFileSync(f));
      assert.strictEqual(d.width, 64); assert.strictEqual(d.height, 64);
      const g = new Uint8Array(64 * 64);
      for (let i = 0; i < g.length; i++) g[i] = d.rgba[i * 4];
      const idx = deCinza(g);
      idx.forEach(v => assert.ok(v >= 0 && v <= 9, n + ' índice ' + v));
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
    for (let i = 1; i < 9; i++) {
      const nx = ancoras(quadros['galope-' + i].idx, 64, 64).nose[0];
      assert.ok(Math.abs(nx - n0) <= 6, 'galope-' + i + ' nose.x ' + nx + ' vs ' + n0);
    }
  });
});

console.log('\n' + count + ' testes, ' + fails + ' falhas');
process.exit(fails ? 1 : 0);
