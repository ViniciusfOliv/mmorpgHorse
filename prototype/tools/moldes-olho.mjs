// prototype/tools/moldes-olho.mjs — node prototype/tools/moldes-olho.mjs [--check]
// Âncora "olho" do retrato e do parado nos JSONs dos 12 moldes (prototype/assets/pixellab/molde-<porte>-<estilo>.json;
// animação ambiente, etapa 2: o idle pisca). Calcula com a mesma busca do gerador (moldes-lib.mjs, olhoMolde, que o
// pixellab-comum.mjs grava nos moldes novos) a partir dos PNGs que já estão lá, e regrava só a linha da âncora (o resto
// do JSON fica igual). Idempotente. --check: só confere, e sai com erro se algum JSON estiver sem o olho ou com outro.
// Sem rede e sem créditos.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng } from './png.mjs';
import { olhoMolde, PAPEIS } from './moldes-lib.mjs';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'pixellab');
const CHECK = process.argv.includes('--check');
const chaves = fs.readdirSync(DIR).filter((f) => /^molde-(esguio|padrao|robusto)-\w+\.json$/.test(f)).map((f) => f.slice(6, -5)).sort();
let mudou = 0, ruins = 0;
for (const chave of chaves) {
  const fj = path.join(DIR, `molde-${chave}.json`);
  let txt = fs.readFileSync(fj, 'utf8');
  const J = JSON.parse(txt);
  for (const est of ['retrato', 'parado']) {
    const png = decodePng(fs.readFileSync(path.join(DIR, `molde-${chave}-${est}.png`)));
    const idx = new Uint8Array(png.width * png.height);
    for (let i = 0; i < idx.length; i++) idx[i] = png.rgba[i * 4 + 3] < 128 ? 0 : Math.round(png.rgba[i * 4] / 25);
    const a = J.ancoras[est], olho = olhoMolde(idx, png.width, png.height, a.nose, chave + ':' + est);
    if (!olho.length) { ruins++; console.log(`  FALHA ${chave} ${est}: a busca não achou o olho (acrescente em OLHO_MANUAL, moldes-lib.mjs)`); continue; }
    if (JSON.stringify(a.olho) === JSON.stringify(olho)) continue;
    if (CHECK) { ruins++; console.log(`  FALHA ${chave} ${est}: olho ${JSON.stringify(a.olho)} (esperado ${JSON.stringify(olho)}): rode sem --check`); continue; }
    const linhaVelha = `    "${est}": ${JSON.stringify(a)}`;
    if (!txt.includes(linhaVelha)) throw new Error(`${chave} ${est}: a linha da âncora não está no formato do gerador`);
    txt = txt.replace(linhaVelha, `    "${est}": ${JSON.stringify({ ...a, olho })}`);
    mudou++;
  }
  if (!CHECK) fs.writeFileSync(fj, txt);
}
void PAPEIS;
console.log(`${chaves.length} moldes; ${CHECK ? 'conferidos' : mudou + ' âncoras do olho gravadas'}; ${ruins} falhas`);
process.exit(ruins ? 1 : 0);
