// prototype/tools/arte-paleta.mjs — a paleta do guia de arte (docs/arte/guia.md §3) e o acabamento por código que
// todo asset gerado recebe (guia §10): quantizar para a paleta em CIELAB, alfa binário e conferência.
// Sem dependências: usa o png.mjs do projeto.

// Resurrect 64 (Kerrie Lake), na ordem da lista pública.
export const RESURRECT64 = [
  '2e222f', '3e3546', '625565', '966c6c', 'ab947a', '694f62', '7f708a', '9babb2', 'c7dcd0', 'ffffff',
  '6e2727', 'b33831', 'ea4f36', 'f57d4a', 'ae2334', 'e83b3b', 'fb6b1d', 'f79617', 'f9c22b', '7a3045',
  '9e4539', 'cd683d', 'e6904e', 'fbb954', '4c3e24', '676633', 'a2a947', 'd5e04b', 'fbff86', '165a4c',
  '239063', '1ebc73', '91db69', 'cddf6c', '313638', '374e4a', '547e64', '92a984', 'b2ba90', '0b5e65',
  '0b8a8f', '0eaf9b', '30e1b9', '8ff8e2', '323353', '484a77', '4d65b4', '4d9be6', '8fd3ff', '45293f',
  '6b3e75', '905ea9', 'a884f3', 'eaaded', '753c54', 'a24b6f', 'cf657f', 'ed8099', '831c5d', 'c32454',
  'f04f78', 'f68181', 'fca790', 'fdcbb0',
];

// Paletas de região (até 32 cores da mestra; guia §3). As 5 regiões das pistas aprovadas pelo Vinicius em 2026-11-20
// (plano da direção de arte, etapa 3): Cerrado, Várzea, Planalto, Sertão e Litoral.
export const REGIOES = {
  cerrado: [
    '4d65b4', '4d9be6', '8fd3ff', 'c7dcd0', 'ffffff',            // céu e nuvens
    '7f708a', '9babb2', '966c6c', 'ab947a', '694f62',            // chapadas ao longe
    '165a4c', '239063', '1ebc73', '91db69', '547e64', '92a984', '676633', 'a2a947', '374e4a', // vegetação
    'f79617', 'f9c22b', 'fbb954',                                // ipê amarelo, sol, ouro
    '6e2727', '9e4539', 'cd683d', 'e6904e', 'b33831', '4c3e24',  // terra vermelha, madeira
    '2e222f', '3e3546',                                          // escuros (contorno, sombra)
    'fdcbb0', 'e83b3b',                                          // pele, torcida
  ],
  varzea: [
    '4d65b4', '4d9be6', '8fd3ff', 'c7dcd0', 'ffffff',            // céu, garças
    '0b5e65', '0b8a8f', '0eaf9b', '30e1b9', '8ff8e2',            // água da lagoa
    '165a4c', '239063', '1ebc73', '91db69', '547e64', '92a984', '374e4a', // mata ciliar, aguapé
    '4c3e24', '676633', '9e4539', 'cd683d', 'e6904e', 'ab947a', '966c6c', // madeira, barro
    '2e222f', '3e3546', '313638',                                // escuros
    'f9c22b', 'fbb954', 'fdcbb0', 'e83b3b', '9babb2',            // sol, pele, torcida, névoa
  ],
  planalto: [
    '323353', '484a77', '4d65b4', '4d9be6', '8fd3ff', 'c7dcd0', 'ffffff', // céu frio e alto
    '676633', 'a2a947', 'cddf6c', '92a984', 'b2ba90', '547e64', '374e4a', '165a4c', '239063', // campos, araucárias
    '625565', '7f708a', '9babb2', '694f62',                      // pedra
    '4c3e24', '9e4539', 'cd683d', 'e6904e', 'ab947a', '966c6c',  // terra, madeira
    '2e222f', '3e3546',                                          // escuros
    'f9c22b', 'e83b3b', 'b33831', 'fdcbb0',                      // flores, telha, torcida, pele
  ],
  sertao: [
    '4d9be6', '8fd3ff', 'c7dcd0', 'ffffff',                      // céu claro e quente
    'e6904e', 'cd683d', '9e4539', '6e2727', 'ab947a', '966c6c', '4c3e24', 'fca790', // chão, adobe, barro
    '625565', '7f708a', '9babb2', '694f62',                      // caatinga seca
    '165a4c', '239063', '547e64', '92a984', '676633', 'a2a947',  // mandacaru, juazeiro
    'd5e04b', 'cddf6c',                                          // cana
    'f79617', 'f9c22b', 'fbb954', 'fbff86',                      // sol
    '2e222f', '3e3546', 'fdcbb0', 'e83b3b',                      // escuros, pele, torcida
  ],
  litoral: [
    '4d65b4', '4d9be6', '8fd3ff', 'c7dcd0', 'ffffff',            // céu
    '0b5e65', '0b8a8f', '0eaf9b', '30e1b9', '8ff8e2', '323353',  // mar
    'fdcbb0', 'fca790', 'e6904e', 'ab947a', 'fbb954',            // areia, dunas
    '165a4c', '239063', '1ebc73', '91db69', '676633', '4c3e24', '9e4539', // coqueiros, troncos
    '2e222f', '3e3546',                                          // escuros
    'f9c22b', 'e83b3b', 'f04f78', 'cd683d', '547e64', '966c6c', '9babb2', // flores, toldos, torcida, névoa
  ],
};

// Climas: troca de paleta das camadas (guia §3). Cada cor da mestra é misturada `k` com `rumo` e volta para a mestra
// (a mesma conta da amostra, prototype/arte/amostra.js).
export const CLIMAS = {
  sol: { rumo: null, k: 0 },
  nublado: { rumo: '7f708a', k: 0.38 },
  chuva: { rumo: '323353', k: 0.42 },
  nevoa: { rumo: 'c7dcd0', k: 0.5 },
};

export const rgbDe = h => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];

function lab([r, g, b]) {
  const l = v => { v /= 255; return v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92; };
  r = l(r); g = l(g); b = l(b);
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047, y = r * 0.2126 + g * 0.7152 + b * 0.0722,
    z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

// Quantiza { width, height, rgba } para a paleta (lista de hex): cor mais próxima em CIELAB, sem pontilhado; alfa
// binário (≥ 128 opaco). Devolve uma cópia.
export function quantizar(img, paleta) {
  const P = paleta.map(rgbDe), PL = P.map(lab), cache = new Map();
  const out = new Uint8Array(img.rgba);
  for (let i = 0; i < out.length; i += 4) {
    if (out[i + 3] < 128) { out[i] = out[i + 1] = out[i + 2] = out[i + 3] = 0; continue; }
    out[i + 3] = 255;
    const chave = (out[i] << 16) | (out[i + 1] << 8) | out[i + 2];
    let k = cache.get(chave);
    if (k === undefined) {
      const L = lab([out[i], out[i + 1], out[i + 2]]);
      let melhor = Infinity;
      PL.forEach((p, j) => { const d = (p[0] - L[0]) ** 2 + (p[1] - L[1]) ** 2 + (p[2] - L[2]) ** 2; if (d < melhor) { melhor = d; k = j; } });
      cache.set(chave, k);
    }
    [out[i], out[i + 1], out[i + 2]] = P[k];
  }
  return { width: img.width, height: img.height, rgba: out };
}

// Imagem de paleta (uma linha, um pixel por cor), RGB opaco: o input_palette da Retro Diffusion.
export function imagemPaleta(paleta) {
  const rgba = new Uint8Array(paleta.length * 4);
  paleta.forEach((h, i) => { rgba.set([...rgbDe(h), 255], i * 4); });
  return { width: paleta.length, height: 1, rgba };
}

// Conferência do guia §10. Devolve contagens; quem chama decide o que reprova.
//   fora: pixels opacos fora da paleta · alfa: pixels com alfa parcial
//   falso: true se a imagem parece ampliada 2× (em x ou em y, os pares alinhados em posição par são quase sempre iguais e
//          bem mais iguais que os pares em posição ímpar; em pixel art 1:1 as duas taxas ficam parecidas)
//   emenda: a junta entre a última e a primeira coluna comparada às juntas internas (≤ 1 = não destoa; ver abaixo)
export function conferir(img, paleta) {
  const ok = new Set(paleta.map(h => h.toLowerCase()));
  const W = img.width, H = img.height, p = img.rgba;
  let fora = 0, alfa = 0, opacos = 0;
  const hex = i => [0, 1, 2].map(c => p[i + c].toString(16).padStart(2, '0')).join('');
  for (let i = 0; i < p.length; i += 4) {
    const a = p[i + 3];
    if (a !== 0 && a !== 255) alfa++;
    if (a === 255) { opacos++; if (!ok.has(hex(i))) fora++; }
  }
  const igual = (u, v) => p[u] === p[v] && p[u + 1] === p[v + 1] && p[u + 2] === p[v + 2] && p[u + 3] === p[v + 3];
  const at = (x, y) => (y * W + x) * 4;
  function pares(eixoX) {
    const taxa = [0, 0], tot = [0, 0];
    for (let y = 0; y < H - (eixoX ? 0 : 1); y++) for (let x = 0; x < W - (eixoX ? 1 : 0); x++) {
      const u = at(x, y), v = eixoX ? at(x + 1, y) : at(x, y + 1);
      if (p[u + 3] === 0 && p[v + 3] === 0) continue;
      const par = (eixoX ? x : y) % 2;
      tot[par]++; if (igual(u, v)) taxa[par]++;
    }
    return [taxa[0] / (tot[0] || 1), taxa[1] / (tot[1] || 1)];
  }
  const [px0, px1] = pares(true), [py0, py1] = pares(false);
  const falso = (px0 > 0.97 && px0 - px1 > 0.15) || (py0 > 0.97 && py0 - py1 > 0.15);
  // emenda: quantas linhas mudam entre a última e a primeira coluna, dividido pelo percentil 95 da mesma contagem entre
  // colunas vizinhas da própria imagem (contagem, não taxa: uma borda quase vazia não vira alarme). ≤ 1: a junta não é
  // mais diferente que as juntas internas mais diferentes; bem acima de 1: costura.
  function difere(xa, xb) {
    let d = 0;
    for (let y = 0; y < H; y++) if (!igual(at(xa, y), at(xb, y))) d++;
    return d;
  }
  const internas = [];
  for (let x = 0; x < W - 1; x++) internas.push(difere(x, x + 1));
  internas.sort((x, y) => x - y);
  const p95 = Math.max(2, internas[Math.floor(internas.length * 0.95)] || 0);
  const emenda = difere(W - 1, 0) / p95;
  return { fora, alfa, opacos, falso, pares: { px0, px1, py0, py1 }, emenda };
}

// Limpa um candidato recortado de uma folha (o modo Pro do PixelLab corta 64 candidatos de uma folha só e os quadros
// trazem pedaços dos vizinhos): fica só o maior grupo de pixels opacos (vizinhança de 8), recusa (null) se ele encostar
// na borda (o ícone saiu cortado) e o centraliza num quadro lado × lado.
export function limparRecorte(img, lado = img.width) {
  const W = img.width, H = img.height, p = img.rgba, grupo = new Int32Array(W * H).fill(-1);
  let melhor = -1, tamMelhor = 0, n = 0;
  for (let i = 0; i < W * H; i++) {
    if (p[i * 4 + 3] === 0 || grupo[i] >= 0) continue;
    const fila = [i]; grupo[i] = n; let tam = 0;
    while (fila.length) {
      const j = fila.pop(), x = j % W, y = (j / W) | 0; tam++;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy, k = ny * W + nx;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || grupo[k] >= 0 || p[k * 4 + 3] === 0) continue;
        grupo[k] = n; fila.push(k);
      }
    }
    if (tam > tamMelhor) { tamMelhor = tam; melhor = n; }
    n++;
  }
  if (melhor < 0) return null;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let i = 0; i < W * H; i++) if (grupo[i] === melhor) { const x = i % W, y = (i / W) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (x0 === 0 || y0 === 0 || x1 === W - 1 || y1 === H - 1) return null;
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  if (w > lado || h > lado) return null;
  const ox = Math.floor((lado - w) / 2), oy = Math.floor((lado - h) / 2), out = new Uint8Array(lado * lado * 4);
  for (let i = 0; i < W * H; i++) if (grupo[i] === melhor) {
    const x = i % W - x0 + ox, y = ((i / W) | 0) - y0 + oy;
    out.set(p.subarray(i * 4, i * 4 + 4), (y * lado + x) * 4);
  }
  return { width: lado, height: lado, rgba: out };
}

// Folha de candidatos do modo Pro remontada (os quadros em ordem, lado a lado): separa cada ícone pelos grupos de pixels
// opacos (vizinhança de 8). Grupos pequenos demais (< minPx) são sujeira; os maiores que lado × lado são recusados. Cada
// ícone sai centralizado num quadro lado × lado, na ordem de leitura da folha.
export function separarFolha(folha, lado, minPx = 40) {
  const W = folha.width, H = folha.height, p = folha.rgba, grupo = new Int32Array(W * H).fill(-1), caixas = [];
  for (let i = 0; i < W * H; i++) {
    if (p[i * 4 + 3] === 0 || grupo[i] >= 0) continue;
    const id = caixas.length, fila = [i], c = { id, x0: W, y0: H, x1: -1, y1: -1, n: 0 };
    grupo[i] = id;
    while (fila.length) {
      const j = fila.pop(), x = j % W, y = (j / W) | 0;
      c.n++; c.x0 = Math.min(c.x0, x); c.x1 = Math.max(c.x1, x); c.y0 = Math.min(c.y0, y); c.y1 = Math.max(c.y1, y);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy, k = ny * W + nx;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || grupo[k] >= 0 || p[k * 4 + 3] === 0) continue;
        grupo[k] = id; fila.push(k);
      }
    }
    caixas.push(c);
  }
  return caixas.filter(c => c.n >= minPx && c.x1 - c.x0 < lado && c.y1 - c.y0 < lado)
    .sort((a, b) => (Math.floor(a.y0 / lado) - Math.floor(b.y0 / lado)) || (a.x0 - b.x0))
    .map(c => {
      const w = c.x1 - c.x0 + 1, h = c.y1 - c.y0 + 1, ox = Math.floor((lado - w) / 2), oy = Math.floor((lado - h) / 2), out = new Uint8Array(lado * lado * 4);
      for (let y = c.y0; y <= c.y1; y++) for (let x = c.x0; x <= c.x1; x++) {
        const i = y * W + x;
        if (grupo[i] === c.id) out.set(p.subarray(i * 4, i * 4 + 4), ((y - c.y0 + oy) * lado + x - c.x0 + ox) * 4);
      }
      return { width: lado, height: lado, rgba: out };
    });
}
