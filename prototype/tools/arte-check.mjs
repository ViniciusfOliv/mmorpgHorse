// prototype/tools/arte-check.mjs — node prototype/tools/arte-check.mjs
// Conferência automática do guia de arte (docs/arte/guia.md §10) nos finais das regiões (prototype/assets/arte/
// <regiao>/<camada>.png, listados em prototype/assets/arte/regioes.json): cores só da paleta da região, alfa binário,
// sem pixel falso (imagem ampliada) e, nas camadas que repetem, emenda invisível. Sem rede. Roda no scripts/check.sh.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng } from './png.mjs';
import { REGIOES, conferir } from './arte-paleta.mjs';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'arte');
const EMENDA_MAX = 1.0;    // a junta da repetição não pode destoar mais que as juntas internas mais diferentes (p95)
const manifesto = JSON.parse(fs.readFileSync(path.join(DIR, 'regioes.json'), 'utf8'));
let n = 0, falhas = 0;
for (const [r, reg] of Object.entries(manifesto)) {
  if (r.startsWith('_')) continue;
  if (!REGIOES[r]) { falhas++; console.log(`  FALHA ${r}: região sem paleta em arte-paleta.mjs`); continue; }
  for (const [camada, e] of Object.entries(reg.camadas)) {
    n++;
    const f = path.join(DIR, r, camada + '.png');
    if (!fs.existsSync(f)) { falhas++; console.log(`  FALHA ${r}/${camada}: falta o final (rode arte-regioes.mjs --finalizar ${r})`); continue; }
    const img = decodePng(fs.readFileSync(f)), c = conferir(img, REGIOES[r]), erros = [];
    if (c.fora) erros.push(`${c.fora} pixels fora da paleta`);
    if (c.alfa) erros.push(`${c.alfa} pixels com alfa parcial`);
    if (c.falso) erros.push('parece ampliada (pixel falso)');
    if (e.emenda && c.emenda > EMENDA_MAX) erros.push(`emenda visível (${c.emenda.toFixed(2)})`);
    if (e.emenda && img.width !== 384) erros.push(`largura ${img.width} (camada que repete tem 384)`);
    if (erros.length) { falhas++; console.log(`  FALHA ${r}/${camada}: ${erros.join('; ')}`); }
    else console.log(`  ok  ${r}/${camada} ${img.width}×${img.height}${e.emenda ? `, emenda ${c.emenda.toFixed(2)}` : ''}`);
  }
}
console.log(`\n${n} camadas de arte conferidas, ${falhas} falhas`);
process.exit(falhas ? 1 : 0);
