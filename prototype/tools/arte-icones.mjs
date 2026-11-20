// prototype/tools/arte-icones.mjs — ícones de interface em 16 × 16 (plano da direção de arte, etapa 4; guia §7: os
// ícones de hoje são 32 × 32 mostrados menores, o que o guia proíbe). Dois caminhos no PixelLab, comparados no piloto:
//   resize  o ícone atual de 32 × 32 (já aprovado) redesenhado em 16 × 16 pelo /resize (redimensionamento de pixel art,
//           não uma redução simples), com a paleta mestra forçada;
//   pixen   gerado de novo em 16 × 16 pelo /create-image-pixen, com a descrição do ícone.
// Os finais vão para a paleta mestra (Resurrect 64), com alfa binário.
//
// Uso:  NODE_USE_ENV_PROXY=1 node prototype/tools/arte-icones.mjs --lote piloto [--metodo resize|pixen|ambos] [--gerar] [--teto-pl N]
//   Sem --gerar é SEMPRE dry-run: lista as chamadas e a estimativa, sem rede. Pedido já gravado em raw/ é reaproveitado.
//   Só usa a cota do plano: aborta se uma resposta cobrar em US$.
// Saída: crus em prototype/assets/arte/raw/icones16/, candidatos em prototype/assets/arte/icones16/candidatos/.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { RAIZ, estado, chamar, saldo, fmt, imagem } from './pixellab-comum.mjs';
import { decodePng, encodePng } from './png.mjs';
import { RESURRECT64, quantizar, imagemPaleta, conferir } from './arte-paleta.mjs';
import { ICONES_NOVOS } from './icones-catalogo.mjs';

const DIR = path.join(RAIZ, 'prototype', 'assets', 'arte');
const DIR_RAW = path.join(DIR, 'raw', 'icones16'), DIR_CAND = path.join(DIR, 'icones16', 'candidatos');
const DIR_ATUAIS = path.join(RAIZ, 'prototype', 'assets', 'icons');
const ARQ_GASTO = path.join(DIR, 'raw', 'gasto.json');
// descrições dos 16 ícones do lote `icones` (pixellab-moldes.mjs, ICONES), para os que não estão no catálogo novo
const ANTIGOS = {
  'aba-estabulo': 'horse head icon', 'aba-correr': 'checkered racing flag icon',
  'aba-expedicao': 'round navigation compass, top view, crisp red and white needle pointing straight up, gold rim',
  'aba-haras': 'two hearts icon', 'aba-loja': 'shopping cart icon', 'moeda-ouro': 'gold coin icon',
  'el-fogo': 'flame icon', 'el-agua': 'water drop icon', 'el-grama': 'green leaf icon',
};
const PILOTO = ['moeda-ouro', 'el-fogo', 'aba-estabulo', 'aba-expedicao', 'st-vel', 'sk-arranque', 'ui-dado', 'liga-ouro'];
const ESTILO = 'pixel art game ui icon, 16x16, centered, simple bold shapes, readable at small size, dark outline';

function descricao(id) {
  const n = ICONES_NOVOS.find(i => i.id === id);
  const d = n ? n.desc : ANTIGOS[id];
  if (!d) throw new Error('ícone sem descrição: ' + id);
  return d;
}
function args() {
  const a = { lote: 'piloto', metodo: 'ambos', gerar: false, tetoPl: null };
  const v = process.argv.slice(2);
  for (let i = 0; i < v.length; i++) {
    if (v[i] === '--lote') a.lote = v[++i];
    else if (v[i] === '--metodo') a.metodo = v[++i];
    else if (v[i] === '--gerar') a.gerar = true;
    else if (v[i] === '--teto-pl') a.tetoPl = Number(v[++i]);
    else throw new Error('opção desconhecida: ' + v[i]);
  }
  if (a.lote !== 'piloto') throw new Error('lote desconhecido: ' + a.lote + ' (o lote completo entra depois do piloto)');
  return a;
}
const lerJson = (f, p) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : p);
const semB64 = o => JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'string' && v.length > 300 ? `<${v.length} chars>` : v)));
const assinatura = p => crypto.createHash('sha1').update(JSON.stringify(p)).digest('hex').slice(0, 12);

function chamadas(a) {
  const pal = imagem(encodePng(imagemPaleta(RESURRECT64))), out = [];
  PILOTO.forEach((id, i) => {
    const desc = descricao(id), seed = 9101 + i;
    if (a.metodo !== 'pixen') {
      const atual = fs.readFileSync(path.join(DIR_ATUAIS, id + '.png'));
      out.push({ id, metodo: 'resize', endpoint: '/resize', base: `${id}-resize-s${seed}`, pedido: {
        description: `${desc}, ${ESTILO}`, reference_image: imagem(atual), reference_image_size: { width: 32, height: 32 },
        target_size: { width: 16, height: 16 }, no_background: true, color_image: pal, seed } });
    }
    if (a.metodo !== 'resize') {
      out.push({ id, metodo: 'pixen', endpoint: '/create-image-pixen', base: `${id}-pixen-s${seed}`, pedido: {
        description: `${desc}, ${ESTILO}`, image_size: { width: 16, height: 16 }, no_background: true,
        outline: 'single color black outline', seed } });
    }
  });
  return out;
}

async function main() {
  const a = args(), lista = chamadas(a), tetoPl = a.tetoPl ?? lista.length;
  console.log(`Ícones 16×16, lote ${a.lote}, método ${a.metodo}: ${lista.length} chamadas, ~${lista.length} gerações do PixelLab (custo do /resize a confirmar na resposta). Teto: ${tetoPl}`);
  for (const c of lista) console.log(`  ${c.base}  ${c.endpoint}`);
  if (!a.gerar) { console.log('\nDry-run: nada foi gerado. Use --gerar para gastar.'); return; }
  estado.redeLiberada = true;
  fs.mkdirSync(DIR_RAW, { recursive: true }); fs.mkdirSync(DIR_CAND, { recursive: true });
  const gasto = lerJson(ARQ_GASTO, { pl: 0, usd: 0, chamadas: [] });
  let pl = 0;
  const maior = {};
  await saldo('do PixelLab antes');
  for (const c of lista) {
    const arqJson = path.join(DIR_RAW, c.base + '.json'), assin = assinatura(c.pedido), salvo = lerJson(arqJson, null);
    let buf;
    if (salvo && salvo.assinatura === assin) { buf = fs.readFileSync(path.join(DIR_RAW, c.base + '.png')); console.log(`  ${c.base}: reaproveitado`); }
    else {
      const est = maior[c.endpoint] || 1;   // o maior custo já visto no endpoint (o /resize não publica o preço)
      if (pl + est > tetoPl) { console.log(`  ${c.base}: PAROU (teto de ${tetoPl} gerações; esta custaria ~${est})`); break; }
      const r = await chamar('POST', c.endpoint, c.pedido);
      if (r.usage && r.usage.type === 'usd' && r.usage.usd > 0) throw new Error('cobrança inesperada em US$ no PixelLab');
      const g = (r.usage && r.usage.generations) ?? 1;
      maior[c.endpoint] = Math.max(maior[c.endpoint] || 0, g);
      pl += g; gasto.pl += g; gasto.chamadas.push({ base: `icones16/${c.base}`, geracoes: g, data: new Date().toISOString() });
      buf = Buffer.from(r.image.base64, 'base64');
      fs.writeFileSync(path.join(DIR_RAW, c.base + '.png'), buf);
      fs.writeFileSync(arqJson, JSON.stringify({ assinatura: assin, endpoint: c.endpoint, pedido: semB64(c.pedido), resposta: semB64(r) }, null, 2));
      fs.writeFileSync(ARQ_GASTO, JSON.stringify(gasto, null, 2));
      console.log(`  ${c.base}: ${fmt(g)} geração(ões) [total ${fmt(pl)}/${tetoPl}]`);
    }
    const img = quantizar(decodePng(buf), RESURRECT64), k = conferir(img, RESURRECT64);
    fs.writeFileSync(path.join(DIR_CAND, c.base + '.png'), encodePng(img));
    console.log(`    ${img.width}×${img.height}, fora ${k.fora}, alfa ${k.alfa}, falso ${k.falso ? 'SIM' : 'não'}`);
  }
  await saldo('do PixelLab depois');
  console.log(`Gasto: ${fmt(pl)} gerações do PixelLab`);
}
main().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
