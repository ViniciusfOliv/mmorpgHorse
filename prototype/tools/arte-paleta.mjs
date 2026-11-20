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

// Paletas de região (até 32 cores da mestra; guia §3). Cerrado à tarde: céu, chapadas ao longe, cerrado (verdes
// secos, ipê amarelo), terra vermelha da pista, escuros violeta para a sombra, pele e uma cor viva para a torcida.
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

// Conferência do guia §10: cores fora da paleta, alfa não binário e blocos 2×2 repetidos (pixel falso).
export function conferir(img, paleta) {
  const ok = new Set(paleta.map(h => h.toLowerCase()));
  let fora = 0, alfa = 0, opacos = 0;
  const hex = i => [0, 1, 2].map(c => img.rgba[i + c].toString(16).padStart(2, '0')).join('');
  for (let i = 0; i < img.rgba.length; i += 4) {
    const a = img.rgba[i + 3];
    if (a !== 0 && a !== 255) alfa++;
    if (a === 255) { opacos++; if (!ok.has(hex(i))) fora++; }
  }
  // grade 2×2: fração de blocos alinhados em que os 4 pixels são iguais (pixel art 1:1 fica bem abaixo de 0,9)
  let iguais = 0, blocos = 0;
  for (let y = 0; y + 1 < img.height; y += 2) for (let x = 0; x + 1 < img.width; x += 2) {
    const p = (yy, xx) => ((yy * img.width + xx) * 4);
    const a = p(y, x), b = p(y, x + 1), c = p(y + 1, x), d = p(y + 1, x + 1);
    if (img.rgba[a + 3] === 0) continue;
    blocos++;
    const eq = (u, v) => img.rgba[u] === img.rgba[v] && img.rgba[u + 1] === img.rgba[v + 1] && img.rgba[u + 2] === img.rgba[v + 2] && img.rgba[u + 3] === img.rgba[v + 3];
    if (eq(a, b) && eq(a, c) && eq(a, d)) iguais++;
  }
  return { fora, alfa, opacos, grade2x2: blocos ? iguais / blocos : 0 };
}
