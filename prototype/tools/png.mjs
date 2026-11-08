// prototype/tools/png.mjs — codec PNG mínimo, sem dependências (só node:zlib).
// decodePng(buf) → { width, height, rgba }   |   encodePng({ width, height, rgba }) → Buffer
// encodeGray({ width, height, data }) → Buffer (tons de cinza 8 bits)
import zlib from 'node:zlib';

const ASSINATURA = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

let TABELA_CRC = null;
function crc32(buf) {
  if (typeof zlib.crc32 === 'function') return zlib.crc32(buf) >>> 0; // Node 22+
  if (!TABELA_CRC) {
    TABELA_CRC = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      TABELA_CRC[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = TABELA_CRC[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function bloco(tipo, dados) {
  const t = Buffer.from(tipo, 'latin1');
  const len = Buffer.alloc(4); len.writeUInt32BE(dados.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, dados])));
  return Buffer.concat([len, t, dados, crc]);
}

// Canais por tipo de cor (bit depth 8).
const CANAIS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

export function decodePng(buf) {
  if (!Buffer.isBuffer(buf)) buf = Buffer.from(buf);
  if (buf.length < 8 || !buf.subarray(0, 8).equals(ASSINATURA)) throw new Error('decodePng: não é um arquivo PNG (assinatura inválida)');
  let pos = 8, ihdr = null, plte = null, trns = null;
  const idats = [];
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const tipo = buf.toString('latin1', pos + 4, pos + 8);
    const dados = buf.subarray(pos + 8, pos + 8 + len);
    if (dados.length < len) throw new Error('decodePng: PNG truncado no bloco ' + tipo);
    pos += 12 + len;
    if (tipo === 'IHDR') ihdr = dados;
    else if (tipo === 'PLTE') plte = dados;
    else if (tipo === 'tRNS') trns = dados;
    else if (tipo === 'IDAT') idats.push(dados);
    else if (tipo === 'IEND') break;
  }
  if (!ihdr) throw new Error('decodePng: PNG sem bloco IHDR');
  const width = ihdr.readUInt32BE(0), height = ihdr.readUInt32BE(4);
  const prof = ihdr[8], tipoCor = ihdr[9], entrelaca = ihdr[12];
  if (entrelaca !== 0) throw new Error('decodePng: PNG entrelaçado (Adam7) não suportado');
  if (!(tipoCor in CANAIS)) throw new Error('decodePng: tipo de cor ' + tipoCor + ' não suportado');
  if (prof !== 8) throw new Error('decodePng: profundidade de ' + prof + ' bits não suportada (só 8)');
  if (tipoCor === 3 && !plte) throw new Error('decodePng: PNG indexado sem bloco PLTE');
  if (!idats.length) throw new Error('decodePng: PNG sem bloco IDAT');

  const bpp = CANAIS[tipoCor];
  const stride = width * bpp;
  const bruto = zlib.inflateSync(Buffer.concat(idats));
  if (bruto.length < (stride + 1) * height) throw new Error('decodePng: dados de imagem incompletos');
  const px = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filtro = bruto[y * (stride + 1)];
    const ent = y * (stride + 1) + 1, saida = y * stride, acima = saida - stride;
    for (let i = 0; i < stride; i++) {
      const x = bruto[ent + i];
      const a = i >= bpp ? px[saida + i - bpp] : 0;
      const b = y > 0 ? px[acima + i] : 0;
      const c = y > 0 && i >= bpp ? px[acima + i - bpp] : 0;
      let v;
      switch (filtro) {
        case 0: v = x; break;
        case 1: v = x + a; break;
        case 2: v = x + b; break;
        case 3: v = x + ((a + b) >> 1); break;
        case 4: {
          const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default: throw new Error('decodePng: filtro ' + filtro + ' inválido na linha ' + y);
      }
      px[saida + i] = v & 255;
    }
  }

  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    if (tipoCor === 6) { rgba[o] = px[i * 4]; rgba[o + 1] = px[i * 4 + 1]; rgba[o + 2] = px[i * 4 + 2]; rgba[o + 3] = px[i * 4 + 3]; }
    else if (tipoCor === 2) { rgba[o] = px[i * 3]; rgba[o + 1] = px[i * 3 + 1]; rgba[o + 2] = px[i * 3 + 2]; rgba[o + 3] = 255; }
    else if (tipoCor === 0) { rgba[o] = rgba[o + 1] = rgba[o + 2] = px[i]; rgba[o + 3] = 255; }
    else if (tipoCor === 4) { rgba[o] = rgba[o + 1] = rgba[o + 2] = px[i * 2]; rgba[o + 3] = px[i * 2 + 1]; }
    else { // 3: paleta
      const k = px[i];
      if (k * 3 + 2 >= plte.length) throw new Error('decodePng: índice de paleta ' + k + ' fora do PLTE');
      rgba[o] = plte[k * 3]; rgba[o + 1] = plte[k * 3 + 1]; rgba[o + 2] = plte[k * 3 + 2];
      rgba[o + 3] = trns && k < trns.length ? trns[k] : 255;
    }
  }
  return { width, height, rgba };
}

function montar(width, height, tipoCor, canais, bytes) {
  const stride = width * canais;
  const linhas = Buffer.alloc((stride + 1) * height); // filtro 0 em cada linha
  for (let y = 0; y < height; y++) {
    linhas[y * (stride + 1)] = 0;
    Buffer.from(bytes.buffer, bytes.byteOffset + y * stride, stride).copy(linhas, y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = tipoCor; // 8 bits, sem entrelaçamento
  return Buffer.concat([ASSINATURA, bloco('IHDR', ihdr), bloco('IDAT', zlib.deflateSync(linhas)), bloco('IEND', Buffer.alloc(0))]);
}

export function encodePng({ width, height, rgba }) {
  if (rgba.length !== width * height * 4) throw new Error('encodePng: tamanho de rgba não confere com width×height×4');
  return montar(width, height, 6, 4, rgba);
}

export function encodeGray({ width, height, data }) {
  if (data.length !== width * height) throw new Error('encodeGray: tamanho de data não confere com width×height');
  return montar(width, height, 0, 1, data);
}
