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
console.log(`\n${n} camadas de arte conferidas`);

// Catraca do alfa parcial (guia de integração docs/arte/integracao.md, Regra 2a): cada fonte de alfa parcial no código de
// desenho — rgba/hsla com alfa entre 0 e 1 (literal ou montado), globalAlpha diferente de 0 e 1 (restaurar o anterior não
// conta), #rrggbbaa, ctx.filter, gradiente, suavização ligada — conta. O teto por arquivo só pode DIMINUIR: ao migrar
// uma fonte para cor opaca, baixe o número aqui (o teste falha até baixar, para a folga não ser reaproveitada). A única
// exceção permanente é o relâmpago (guia §3: o clarão da tela, fx.js).
// Ponto de partida (2026-11-24, depois de sair a sombra translúcida dos cavalos): o guia contou 23, 24 e 5 com outro
// critério (lá as restaurações do globalAlpha contavam; aqui, os tokens de cor da interface em game.js contam).
const CATRACA_ALFA = { 'fx.js': 20, 'sprites.js': 12, 'game.js': 6 };
const FONTES_ALFA = [
  /\b(rgba|hsla)\(\s*[^)]*?,\s*0?\.\d+\s*\)/g,
  /['"](rgba|hsla)\(['"]\s*\+/g,
  /globalAlpha\s*[*+-]?=(?!=)\s*(?!\s|(0|1|prev|a0)\s*[;,)])/g,
  /['"]#[0-9a-fA-F]{8}['"]/g,
  /\.filter\s*=/g,
  /create(Linear|Radial|Conic)Gradient/g,
  /imageSmoothingEnabled\s*=\s*true/g
];
export function contaAlfaParcial(texto) {
  let k = 0;
  for (const l of texto.split('\n')) {
    if (/^\s*(\/\/|\*)/.test(l)) continue;
    for (const re of FONTES_ALFA) { re.lastIndex = 0; k += (l.match(re) || []).length; }
  }
  return k;
}
const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
for (const [f, teto] of Object.entries(CATRACA_ALFA)) {
  const k = contaAlfaParcial(fs.readFileSync(path.join(SRC, f), 'utf8'));
  if (k > teto) { falhas++; console.log(`  FALHA alfa parcial em ${f}: ${k} fontes (teto ${teto}); use cor opaca da rampa (Luz.degrau)`); }
  else if (k < teto) { falhas++; console.log(`  FALHA catraca do alfa: ${f} caiu para ${k} fontes; baixe o teto de ${teto} para ${k} em arte-check.mjs`); }
  else console.log(`  ok  alfa parcial em ${f}: ${k} fontes (catraca)`);
}

// Leitura por valor (guia de integração, Regra 14): para cada piso de corrida (na arte da região) e clima, a menor
// diferença de claridade L* entre o corpo das pelagens dos elementos (na LUT de figura) e o chão das raias (na LUT do
// clima, com o degrau que a tabela da cena escolheu). Na escada sol → nublado → chuva o chão nunca clareia. Cada degrau
// escolhido é o melhor dos permitidos e, quando um permitido alcança Luz.LEITURA_MIN, pelo menos isso.
{
  const { createRequire } = await import('node:module');
  const req = createRequire(import.meta.url), SP = req('../src/sprites.js'), LZ = req('../src/luz.js');
  const pel = Object.values(SP.PALETTES).map((p) => SP.naMestra(p.coat.toLowerCase()));
  const linhas = [];
  for (const piso of ['grama', 'terra', 'areia']) {
    const base = SP.naMestra({ grama: '#239063', terra: '#cd683d', areia: '#fbb954' }[piso]);
    const minC = (p, cl) => { const ch = LZ.lutCondicao(cl)[LZ.degrau(base, p)]; return { m: Math.min(...pel.map((c) => Math.abs(LZ.claridade(LZ.lutFigura(cl)[c] || c) - LZ.claridade(ch)))), l: LZ.claridade(ch) }; };
    let teto = Infinity; const partes = [];
    for (const cl of ['sol', 'nublado', 'chuva', 'nevoa']) {
      if (cl === 'nevoa') teto = Infinity;
      const passo = SP.passoLeitura(piso, cl), tem = minC(passo, cl);
      const perm = [-1, 0, 1].map((p) => minC(p, cl)).filter((o) => o.l <= teto + 1e-9), melhor = Math.max(...perm.map((o) => o.m));
      if (tem.l > teto + 1e-9) { falhas++; console.log(`  FALHA leitura ${piso}/${cl}: o chão clareou em relação ao clima anterior`); }
      if (tem.m < melhor - 0.51) { falhas++; console.log(`  FALHA leitura ${piso}/${cl}: degrau ${passo} dá ${tem.m.toFixed(1)} de L*, outro permitido dá ${melhor.toFixed(1)}`); }
      else if (melhor >= LZ.LEITURA_MIN && tem.m < LZ.LEITURA_MIN) { falhas++; console.log(`  FALHA leitura ${piso}/${cl}: ${tem.m.toFixed(1)} de L* (mínimo ${LZ.LEITURA_MIN})`); }
      partes.push(`${cl} ${passo >= 0 ? '+' : ''}${passo} ${tem.m.toFixed(1)}`);
      teto = tem.l;
    }
    linhas.push(`${piso}: ${partes.join(', ')}`);
  }
  console.log(`  ok  leitura por valor (degrau do piso e menor diferença de L*): ${linhas.join(' · ')}`);
}
console.log(`${falhas} falhas`);
process.exit(falhas ? 1 : 0);
