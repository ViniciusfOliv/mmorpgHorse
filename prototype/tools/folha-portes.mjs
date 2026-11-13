// prototype/tools/folha-portes.mjs — folhas de conferência dos moldes dos portes (spec 2026-11-13-cavalos-portes §5),
// para o Vinicius aprovar como artefato do claude.ai. Cada folha é um HTML autocontido (imagens em data:, sem rede).
//
// Uso:  node prototype/tools/folha-portes.mjs --fase mestres|final [--pasta <dir>]
//   escreve <pasta>/folha-<fase>.html; a pasta padrão é a de espera, prototype/assets/pixellab/novos/ (o build não a lê).
//   mestres  os 3 corpos-mestre (lisa) lado a lado: retrato, parado e galope animado, em 1× e 4×, desenhados direto
//            dos PNGs com uma cor fixa por papel (3 chaves não formam o conjunto 'portes' do sprites.js), com o
//            resultado de cada critério (pernas, galope estável e portes distintos entre os 3).
//   final    as 9 versões de elemento com o galope animado, recoloridas pelo Sprites.drawHorse com a paleta de 3 cavalos
//            do catálogo de cada elemento (Comum, Mágico e Mítico), com marcas, jóquei e raridade. Embute data.js, sim.js,
//            breed.js, marcas.js e sprites.js e a tabela __MOLDES lida da pasta (lerMoldes). O conjunto 'portes' só existe
//            com os 12 moldes; com menos, a folha diz o que falta e desenha o que tem direto, como a dos mestres.
// Os critérios são recalculados dos arquivos (portes-criterios.mjs); do criterios.json do lote vêm as seeds, o número
// de tentativas, o que reprovou na forma, a guia de outro mestre (--guia-mestre) e as escolhas manuais (--escolher).
// Item reprovado sai marcado com o critério que falhou; o critério que uma escolha manual aceitou sai como "aceito"
// (não reprova o cartão), com a linha "escolha manual — aceito na folha: <motivo>".
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { encodePng } from './png.mjs';
import { lerMoldes, jsonJs } from './arte-embutida.mjs';
import { criterioPernas, criterioGalope, criterioMesmoCorpo, criterioPortes, LIMITES } from './portes-criterios.mjs';
import { PORTES, ELEMENTOS, DIR_NOVOS, lerMolde, lerCriterios } from './pixellab-portes.mjs';

const PROTOTYPE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

// cor fixa de cada papel (índice 0–9) na folha dos mestres e nos desenhos diretos: pelagem castanha, crina clara,
// casco claro, jóquei vermelho (as do Sprites.drawHorse sem paleta, para o corpo se ler sem recolorir)
export const CORES_PAPEIS = [null, '#1a1405', '#a0704a', '#6b4529', '#eadcb4', '#b9a77a', '#f2ead8', '#d8353b', '#e8b48a', '#5a3a22'];
const NOMES_PAPEIS = ['', 'contorno', 'pelagem', 'sombra da pelagem', 'crina e cauda', 'sombra da crina', 'detalhe e cascos', 'seda do jóquei', 'pele', 'sela'];
const NOME_PORTE = { esguio: 'Esguio', padrao: 'Padrão', robusto: 'Robusto' };
const ELEMENTO = { chamas: 'fogo', ondas: 'agua', folhas: 'grama' };
const NOME_ESTILO = { chamas: 'Fogo (chamas)', ondas: 'Água (ondas)', folhas: 'Grama (folhas)', lisa: 'sem elemento (lisa)' };

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = v => (v == null ? '—' : typeof v === 'number' ? String(Math.round(v * 1000) / 1000).replace('.', ',') : String(v));

// ---------------------------------------------------------------- imagens (data:, ampliadas sem suavizar)
function rgbaDe(idx, w, h) {
  const out = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const c = CORES_PAPEIS[idx[i]];
    if (!c) continue;
    out.set([parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16), 255], i * 4);
  }
  return out;
}
// quadros lado a lado, ampliados k vezes (vizinho mais próximo)
function faixa(quadros, w, h, k) {
  const W = w * quadros.length * k, H = h * k, out = new Uint8Array(W * H * 4);
  quadros.forEach((idx, q) => {
    const rgba = rgbaDe(idx, w, h);
    for (let y = 0; y < H; y++) for (let x = 0; x < w * k; x++) {
      const s = ((y / k | 0) * w + (x / k | 0)) * 4, d = (y * W + q * w * k + x) * 4;
      out[d] = rgba[s]; out[d + 1] = rgba[s + 1]; out[d + 2] = rgba[s + 2]; out[d + 3] = rgba[s + 3];
    }
  });
  return 'data:image/png;base64,' + encodePng({ width: W, height: H, rgba: out }).toString('base64');
}

// ---------------------------------------------------------------- critérios de um molde
// critério aceito por uma escolha manual (--escolher) conta como ok no cartão
const okDe = lista => lista.every(c => c.ok || c.aceito);
function criteriosDoMolde(m, mestre) {
  const out = [...criterioPernas(m), ...criterioGalope(m)];
  if (mestre) out.push(...criterioMesmoCorpo(m, mestre));
  return out;
}
// os nomes dos critérios que as escolhas manuais do item aceitaram na folha (etapas.<etapa>.escolha.aceitos)
function aceitosDe(reg) {
  const out = [];
  for (const x of Object.values((reg && reg.etapas) || {})) if (x.escolha && x.escolha.manual) out.push(...(x.escolha.aceitos || []));
  return out;
}
const marcarAceitos = (lista, aceitos) => lista.map(c => (!c.ok && aceitos.includes(c.criterio) ? Object.assign({}, c, { aceito: true }) : c));
function itemDe(novos, chave, porte, estilo, crit, mestre) {
  const molde = lerMolde(novos, chave), reg = crit.itens[chave] || null, aceitos = aceitosDe(reg);
  return { chave, porte, estilo, molde, registro: reg, aceitos, criterios: molde ? marcarAceitos(criteriosDoMolde(molde, mestre), aceitos) : [] };
}

/** Dados da folha dos mestres: os 3 lisa (molde ou null), os critérios de cada um e os portes distintos. */
export function dadosMestres(novos = DIR_NOVOS) {
  const crit = lerCriterios(novos);
  const itens = PORTES.map(p => itemDe(novos, `${p}-lisa`, p, 'lisa', crit, null));
  const ms = Object.fromEntries(itens.filter(i => i.molde).map(i => [i.porte, i.molde]));
  // os portes distintos do retrato aceitos por uma escolha manual do retrato daquele porte
  const portes = ms.padrao ? criterioPortes(ms).map(c => {
    const it = itens.find(i => new RegExp(`do ${i.porte} `).test(c.criterio));
    return it ? marcarAceitos([c], it.aceitos)[0] : c;
  }) : [];
  return { itens, portes, semPadrao: !ms.padrao };
}

// Os 3 cavalos do catálogo de cada elemento que dão a paleta das linhas da folha final: o de cada raridade da folha
// (Comum, Mágico, Mítico); sem um daquela raridade, o de raridade mais alta que sobrar (a Grama não tem Mítico).
export function cavalosDaFolha(G = require('../src/data.js')) {
  const todos = G.STARTERS.concat(G.WILD_HORSES), out = {};
  for (const [estilo, el] of Object.entries(ELEMENTO)) {
    const doEl = todos.filter(m => m.element === el), usados = new Set();
    out[estilo] = ['comum', 'magico', 'mitico'].map((r, i) => {
      let m = doEl.find(x => x.rarity === r && !usados.has(x.id));
      if (!m) m = doEl.filter(x => !usados.has(x.id)).sort((a, b) => G.RARITIES[b.rarity].order - G.RARITIES[a.rarity].order)[0];
      usados.add(m.id);
      return {
        id: m.id, nome: m.name, raridade: r, raridadeDoCavalo: m.rarity, palette: m.palette, marcas: m.marcas,
        joquei: { padrao: ['listras', 'xadrez', 'estrelas'][i], capacete: G.JOQUEI.capacetes[[1, 2, 4][i]] }, seda: i,
      };
    });
  }
  return out;
}

/** Dados da folha final: as 9 versões (molde ou null, critérios contra o mestre), os mestres e o que falta dos 12. */
export function dadosFinal(novos = DIR_NOVOS) {
  const crit = lerCriterios(novos), itens = [], mestres = {};
  for (const p of PORTES) mestres[p] = lerMolde(novos, `${p}-lisa`);
  for (const estilo of ELEMENTOS) for (const p of PORTES) itens.push(itemDe(novos, `${p}-${estilo}`, p, estilo, crit, mestres[p]));
  const faltam = [];
  for (const p of PORTES) for (const e of ['lisa', ...ELEMENTOS]) if (!(e === 'lisa' ? mestres[p] : itens.find(i => i.chave === `${p}-${e}`).molde)) faltam.push(`${p}-${e}`);
  return { itens, mestres, faltam, cavalos: cavalosDaFolha() };
}

// ---------------------------------------------------------------- HTML
const ESTILO_BASE = `
:root { --bg: #f4efe2; --cartao: #fffaf0; --texto: #1d2a22; --suave: #56665b; --borda: #cdbf9f; --ok: #2e7d32; --nao: #b3261e; --aceito: #8a5a00; --palco: #8fae96; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { --bg: #16211b; --cartao: #1e2c24; --texto: #eee7d6; --suave: #a9b7ad; --borda: #34483c; --ok: #7bd389; --nao: #ff8a80; --aceito: #f2c46d; }
}
:root[data-theme="dark"] { --bg: #16211b; --cartao: #1e2c24; --texto: #eee7d6; --suave: #a9b7ad; --borda: #34483c; --ok: #7bd389; --nao: #ff8a80; --aceito: #f2c46d; }
* { box-sizing: border-box; }
body { margin: 0; padding: 16px; background: var(--bg); color: var(--texto); font: 14px/1.45 system-ui, sans-serif; }
h1 { font-size: 20px; margin: 0 0 6px; }
h2 { font-size: 16px; margin: 0 0 8px; }
h3 { font-size: 13px; margin: 10px 0 4px; color: var(--suave); font-weight: 600; }
p { margin: 0 0 10px; max-width: 72ch; }
small, .suave { color: var(--suave); }
.grade { display: grid; grid-template-columns: repeat(auto-fit, minmax(288px, 1fr)); gap: 12px; align-items: start; }
.cartao { background: var(--cartao); border: 1px solid var(--borda); border-radius: 8px; padding: 12px; min-width: 0; }
.cartao.reprovado { border-color: var(--nao); box-shadow: inset 0 0 0 1px var(--nao); }
.palco { background: var(--palco); border-radius: 4px; padding: 4px; display: inline-block; }
.palco img, .palco canvas, .anim { display: block; image-rendering: pixelated; }
.linha { display: flex; flex-wrap: wrap; gap: 8px; align-items: flex-end; }
figure { margin: 0; }
figcaption { font-size: 11px; color: var(--suave); margin-top: 2px; }
.anim { background-repeat: no-repeat; animation-iteration-count: infinite; animation-duration: .5s; }
ul.crit { list-style: none; padding: 0; margin: 8px 0 0; font-size: 12px; }
ul.crit li { padding: 2px 0; border-top: 1px solid var(--borda); }
.ok { color: var(--ok); font-weight: 600; }
.nao { color: var(--nao); font-weight: 600; }
.aceito { color: var(--aceito); font-weight: 600; }
.selo { display: inline-block; font-size: 11px; font-weight: 700; padding: 1px 6px; border-radius: 9px; border: 1px solid currentColor; margin-left: 6px; vertical-align: middle; }
.falta { padding: 40px 8px; text-align: center; color: var(--nao); font-weight: 700; border: 1px dashed var(--borda); border-radius: 6px; }
.legenda { display: flex; flex-wrap: wrap; gap: 6px 12px; font-size: 12px; margin: 8px 0 14px; }
.legenda span::before { content: ""; display: inline-block; width: 10px; height: 10px; margin-right: 4px; border: 1px solid var(--borda); background: var(--c); vertical-align: -1px; }
`;
// O galope animado desliza a faixa de N quadros em steps(N): cada figura diz no style quanto desliza (desliza<px>), e
// aqui sai um @keyframes por distância usada — um galope de 8 quadros não mostra um 9º quadro vazio.
function quadrosChave(corpo) {
  const ds = [...new Set([...corpo.matchAll(/animation-name:desliza(\d+)/g)].map(m => Number(m[1])))].sort((a, b) => a - b);
  return ds.map(d => `@keyframes desliza${d} { to { background-position: -${d}px 0; } }`).join('\n');
}
function pagina(titulo, corpo, { extraCss = '', scripts = '' } = {}) {
  extraCss = quadrosChave(corpo) + '\n' + extraCss;
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)}</title>
<style>${ESTILO_BASE}${extraCss}</style>
</head>
<body>
${corpo}
${scripts}
</body>
</html>
`;
}
function listaCriterios(lista) {
  if (!lista.length) return '';
  const marca = c => (c.ok ? ['ok', 'ok'] : c.aceito ? ['aceito', 'aceito na folha'] : ['nao', 'NÃO']);
  return `<ul class="crit">${lista.map(c => `<li><span class="${marca(c)[0]}">${marca(c)[1]}</span> ${esc(c.criterio)}: ${esc(num(c.valor))} <small>(${esc(c.limite)})</small></li>`).join('')}</ul>`;
}
const legenda = () => `<div class="legenda">${CORES_PAPEIS.map((c, i) => (c ? `<span style="--c:${c}">${esc(NOMES_PAPEIS[i])}</span>` : '')).join('')}</div>`;
// a guia de outro mestre (--guia-mestre) que vale para a etapa: a gravada na mesma refação dela
const guiaMestreDe = (reg, e) => { const gm = reg.guiaMestre && reg.guiaMestre[e], x = reg.etapas && reg.etapas[e]; return gm && x && (gm.refacao || 0) === (x.refacao || 0) ? gm : null; };
function registroTxt(reg) {
  if (!reg) return '<p class="suave">Sem registro no criterios.json (molde fora do lote).</p>';
  const seeds = ['retrato', 'parado', 'corrida', 'galope'].map(e => {
    const x = reg.etapas && reg.etapas[e];
    if (!x) return `${e} —`;
    // refacao = a refação do --refazer (0 ou ausente: as seeds de sempre); escolha manual: a tentativa pode vir de outra
    // refação (a do histórico); guia de outro mestre: a força da tentativa escolhida
    const esc0 = x.escolha && x.escolha.manual ? x.escolha : null, gm = guiaMestreDe(reg, e);
    const t = (x.tentativas || []).find(y => y.seed === x.escolhida && (!esc0 || !esc0.arquivo || y.arquivo === esc0.arquivo));
    return `${e} ${x.escolhida}${esc0 ? ` (escolha manual, da ${esc0.origem})` : x.refacao ? `, refeita (refação ${x.refacao})` : ''}${x.tentativas.length > 1 ? ` (${x.tentativas.length} tentativas)` : ''}`
      + (gm && !esc0 ? `, guiada por ${gm.mestre}${t && t.init_image_strength ? ` com força ${t.init_image_strength}` : ''}` : '');
  });
  const forma = (reg.falhas || []).filter(f => /forma|imagem|interrompida|faltaria|quadros/.test(f));
  const guias = ['retrato', 'parado', 'corrida'].map(e => [e, guiaMestreDe(reg, e)]).filter(([, gm]) => gm);
  const guiaTxt = guias.length ? `<p class="suave">Guia de outro mestre: ${guias.map(([e, gm]) => `${e} com init_image = ${esc(gm.arquivo || '?')}`).join('; ')} · forças ${esc(guias[0][1].forcas.join(', '))} nas 3 tentativas · reforço "${esc(guias[0][1].reforco)}"</p>` : '';
  const escolhas = ['retrato', 'parado', 'corrida', 'galope'].map(e => [e, reg.etapas && reg.etapas[e] && reg.etapas[e].escolha]).filter(([, x]) => x && x.manual);
  const escolhaTxt = escolhas.map(([e, x]) => `<p class="aceito">${esc(e)} ${esc(x.seed)}: escolha manual — aceito na folha: ${esc(x.motivo)}${x.aceitos && x.aceitos.length ? ` <small>(${esc(x.aceitos.join('; '))})</small>` : ''}${x.automatico ? ` <small>(${esc(x.automatico)})</small>` : ''}</p>`).join('');
  return `<p class="suave">Seeds: ${esc(seeds.join(' · '))}${reg.guia ? ` · init_image do mestre, força ${esc(reg.guia.init_image_strength)}` : ''}</p>`
    + guiaTxt + escolhaTxt + (forma.length ? `<p class="nao">${forma.map(esc).join('<br>')}</p>` : '');
}
// o molde desenhado direto: retrato, parado e galope animado em 1× e 4×, e os quadros do galope parados em 2×
function desenhoDireto(m, chave) {
  const est = (nome, idx) => `<figure><div class="linha"><div class="palco"><img src="${faixa([idx], m.w, m.h, 1)}" width="${m.w}" height="${m.h}" alt="${esc(chave)} ${nome} em 1×"></div>`
    + `<div class="palco"><img src="${faixa([idx], m.w, m.h, 4)}" width="${4 * m.w}" height="${4 * m.h}" alt="${esc(chave)} ${nome} em 4×"></div></div><figcaption>${nome} · 1× e 4×</figcaption></figure>`;
  const n = m.galope.length, g1 = faixa(m.galope, m.w, m.h, 1), g4 = faixa(m.galope, m.w, m.h, 4);
  const anim = (k, url) => `<div class="anim g${k}" style="width:${k * m.w}px;height:${k * m.h}px;background-image:url(${url});animation-name:desliza${k * m.w * n};animation-timing-function:steps(${n})" role="img" aria-label="${esc(chave)} galope animado em ${k}×"></div>`;
  const galope = `<figure><div class="linha"><div class="palco">${anim(1, g1)}</div><div class="palco">${anim(4, g4)}</div></div>`
    + `<figcaption>galope animado (${n} quadros${n !== LIMITES.quadros ? `; o molde precisa de ${LIMITES.quadros}` : ''}) · 1× e 4×</figcaption></figure>`;
  const quadros = `<figure><div class="linha">${m.galope.map((q, i) => `<div class="palco"><img src="${faixa([q], m.w, m.h, 2)}" width="${2 * m.w}" height="${2 * m.h}" alt="${esc(chave)} galope quadro ${i}"></div>`).join('')}</div><figcaption>os ${m.galope.length} quadros do galope · 2×</figcaption></figure>`;
  return est('retrato', m.retrato) + est('parado', m.parado) + galope + quadros;
}
function cartaoDireto(item, titulo, extraCrit = []) {
  const crits = [...item.criterios, ...extraCrit], reprovado = item.molde && (!okDe(crits) || (item.registro && item.registro.ok === false));
  const aceito = crits.some(c => c.aceito);
  const selo = !item.molde ? '<span class="selo nao">falta</span>' : reprovado ? '<span class="selo nao">reprovado</span>' : aceito ? '<span class="selo aceito">aceito na folha</span>' : '<span class="selo ok">passou</span>';
  const corpo = item.molde ? desenhoDireto(item.molde, item.chave) + listaCriterios(crits) + registroTxt(item.registro)
    : `<div class="falta">falta: molde-${esc(item.chave)} em novos/</div>`;
  return `<article class="cartao${reprovado ? ' reprovado' : ''}" id="${esc(item.chave)}"><h2>${esc(titulo)} <small>${esc(item.chave)}</small>${selo}</h2>${corpo}</article>`;
}

/** HTML da folha dos mestres (determinístico: só depende dos dados). */
export function htmlFolhaMestres(d) {
  const doPorte = p => d.portes.filter(c => new RegExp(`do ${p} `).test(c.criterio));
  const cartoes = d.itens.map(i => cartaoDireto(i, `${NOME_PORTE[i.porte]} · mestre`, doPorte(i.porte))).join('\n');
  const resumo = d.semPadrao ? '<p class="nao">Portes distintos: sem o mestre do padrão, que é a régua das proporções.</p>'
    : `<h2>Portes distintos <small>(retratos dos mestres, contra o padrão)</small></h2>${listaCriterios(d.portes)}`;
  const corpo = `<h1>Mestres dos portes</h1>
<p>Os 3 corpos-mestre (lisa, sem elemento) de onde saem as versões de Fogo, Água e Grama. Confira o corpo: as 4 pernas
separadas no retrato e no parado, o esguio claramente mais alto e fino, o robusto claramente mais baixo e largo, e o
galope sem o corpo mudar. Os critérios são os automáticos da spec (limiares: pernas = ${LIMITES.pernas} no retrato e no parado;
galope ≥ ${LIMITES.galopeMin} pernas em todo quadro, porque de lado elas se cruzam; ${LIMITES.quadros} quadros; lombo ≤ ${LIMITES.lombo} px; focinho ±${LIMITES.nose} px; comprimento ≤ ${LIMITES.comprimento} px).
Cores fixas por papel, sem a paleta do jogo:</p>
${legenda()}
<section class="cartao" style="margin-bottom:12px">${resumo}</section>
<div class="grade">
${cartoes}
</div>`;
  return pagina('Mestres dos portes', corpo);
}

/** HTML da folha final. Com os 12 moldes, desenha pelo sprites.js (fontes = { 'data.js': texto, … }, moldes = a
 *  tabela __MOLDES); com menos, diz o que falta e desenha direto o que tem. */
export function htmlFolhaFinal(d, { fontes = null, moldes = null } = {}) {
  const completo = !d.faltam.length && fontes && moldes;
  const reprovados = d.itens.filter(i => i.molde && (!okDe(i.criterios) || (i.registro && i.registro.ok === false)));
  const aviso = d.faltam.length
    ? `<p class="nao">Faltam ${d.faltam.length} dos 12 moldes: ${d.faltam.map(esc).join(', ')}. Sem os 12, o jogo não liga o conjunto 'portes'; abaixo, o que existe, desenhado direto com as cores fixas por papel.</p>${legenda()}`
    : '';
  const marca = i => (i.molde && reprovados.includes(i) ? `<span class="selo nao">reprovado</span>` : i.molde ? '<span class="selo ok">passou</span>' : '<span class="selo nao">falta</span>');
  let secoes;
  if (completo) {
    secoes = ELEMENTOS.map(estilo => `<section><h2 style="margin-top:18px">${esc(NOME_ESTILO[estilo])}</h2><div class="grade">${PORTES.map(p => {
      const i = d.itens.find(x => x.chave === `${p}-${estilo}`), falhas = i.criterios.filter(c => !c.ok);
      return `<article class="cartao${reprovados.includes(i) ? ' reprovado' : ''}" id="${esc(i.chave)}"><h2>${esc(NOME_PORTE[p])} <small>${esc(i.chave)}</small>${marca(i)}</h2>`
        + `<div class="linha" data-chave="${esc(i.chave)}" data-porte="${esc(p)}" data-estilo="${esc(estilo)}"></div>`
        + (falhas.length ? listaCriterios(falhas) : '') + registroTxt(i.registro) + '</article>';
    }).join('')}</div></section>`).join('\n');
  } else {
    secoes = `<div class="grade">${d.itens.filter(i => i.molde).map(i => cartaoDireto(i, `${NOME_PORTE[i.porte]} · ${NOME_ESTILO[i.estilo]}`)).join('\n')}</div>`;
  }
  const corpo = `<h1>Folha final dos portes</h1>
<p>As 9 versões de elemento (3 portes × Fogo, Água e Grama), cada uma com o galope animado e a paleta de 3 cavalos do
catálogo do elemento, com as marcas deles, um jóquei e a raridade Comum, Mágico e Mítico. O mesmo porte tem de ter o
mesmo corpo nos 3 elementos (o critério "mesmo corpo" compara cada versão com o mestre).${reprovados.length ? ` Reprovados nos critérios automáticos: ${reprovados.map(i => esc(i.chave)).join(', ')}.` : ''}</p>
${aviso}
<p id="aviso" class="nao"></p>
${secoes}`;
  if (!completo) return pagina('Folha final dos portes', corpo);
  const fonte = n => `<script>\n${fontes[n].replace(/<\/script/gi, '<\\/script')}\n</script>`;
  const scripts = `<script>window.__MOLDES = ${jsonJs(moldes)};\nwindow.__FOLHA = ${jsonJs({ cavalos: d.cavalos })};</script>
${['data.js', 'sim.js', 'breed.js', 'marcas.js', 'sprites.js'].map(fonte).join('\n')}
<script>
'use strict';
// Desenho pelo jogo: Sprites.drawHorse com o porte, a paleta, as marcas (semente = Breed.hashChave do id), o jóquei e a raridade.
(function () {
  var K = 3, ZOOM = 2, animados = [], ELEMENTO = { chamas: 'fogo', ondas: 'agua', folhas: 'grama' };
  var aviso = document.getElementById('aviso');
  function cel(pai, opts, legenda, anima) {
    var b = Sprites.horseBox(0, 0, opts), pad = 6 * K, padL = opts.rastro ? Math.ceil(b.w * 0.6) + pad : pad;
    var W = b.w + padL + pad, H = b.h + 2 * pad, c = document.createElement('canvas');
    c.width = W; c.height = H; c.style.width = (W * ZOOM) + 'px'; c.style.maxWidth = '100%';
    var g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    var x0 = padL - b.x, y0 = pad - b.y;
    var draw = function (t) {
      g.clearRect(0, 0, W, H);
      g.fillStyle = '#3b5246'; g.fillRect(0, pad + b.h, W, pad);
      var o = Object.assign({}, opts, { t: t });
      if (anima) o.frame = t * 12;
      Sprites.drawHorse(g, x0, y0, o);
    };
    animados.push(draw);
    var f = document.createElement('figure'), p = document.createElement('div'), fc = document.createElement('figcaption');
    p.className = 'palco'; p.appendChild(c); f.appendChild(p); fc.textContent = legenda; f.appendChild(fc); pai.appendChild(f);
  }
  function montar() {
    if (Sprites.moldesConjunto !== 'portes') { aviso.textContent = 'O conjunto de moldes não ligou (' + Sprites.moldesConjunto + '): veja o console.'; return; }
    var cav = window.__FOLHA.cavalos;
    document.querySelectorAll('[data-chave]').forEach(function (lin) {
      var estilo = lin.getAttribute('data-estilo'), porte = lin.getAttribute('data-porte');
      cav[estilo].forEach(function (m) {
        var base = { palette: m.palette, element: ELEMENTO[estilo], porte: porte, scale: K, silks: Sprites.SILKS[m.seda],
          marcas: m.marcas, semente: Breed.hashChave(m.id), joquei: m.joquei, raridade: m.raridade };
        var nomeR = GameData.RARITIES[m.raridade].name, rot = m.nome + (m.raridadeDoCavalo !== m.raridade ? ' (paleta; ' + GameData.RARITIES[m.raridadeDoCavalo].name + ')' : '');
        cel(lin, Object.assign({ rastro: true }, base), 'galope · ' + rot + ' · ' + nomeR, true);
        cel(lin, Object.assign({ idle: true }, base), 'parado · ' + rot, false);
      });
    });
    (function loop(now) { var t = now / 1000; for (var i = 0; i < animados.length; i++) animados[i](t); requestAnimationFrame(loop); })(0);
    window.__folhaPronta = true;
  }
  setTimeout(function () { if (!Sprites.moldsReady) aviso.textContent = 'Os moldes não carregaram (veja o console).'; }, 4000);
  Sprites.loadMolds(window.__MOLDES, montar);
})();
</script>`;
  return pagina('Folha final dos portes', corpo, { scripts });
}

// ---------------------------------------------------------------- linha de comando
async function principal(argv) {
  let fase = null, pasta = DIR_NOVOS;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--fase') fase = argv[++i];
    else if (argv[i] === '--pasta') pasta = path.resolve(argv[++i]);
    else { console.error('argumento desconhecido: ' + argv[i]); process.exit(2); }
  }
  if (!['mestres', 'final'].includes(fase)) { console.error('uso: node prototype/tools/folha-portes.mjs --fase mestres|final [--pasta <dir>]'); process.exit(2); }
  // a folha não cria a pasta de espera: ela nasce com o lote (pixellab-moldes.mjs --lote portes --gerar)
  if (!fs.existsSync(pasta)) { console.error(`a pasta ${path.relative(process.cwd(), pasta)} não existe: rode o lote portes antes`); process.exit(1); }
  let html;
  if (fase === 'mestres') {
    const d = dadosMestres(pasta);
    html = htmlFolhaMestres(d);
    console.log(`mestres: ${d.itens.filter(i => i.molde).length} de 3; portes distintos: ${d.semPadrao ? 'sem o padrão' : d.portes.map(c => (c.ok ? 'ok' : 'NÃO')).join(', ')}`);
  } else {
    const d = dadosFinal(pasta);
    let extra = {};
    if (!d.faltam.length) {
      const avisos = [], moldes = await lerMoldes(path.dirname(pasta), avisos, path.basename(pasta));
      if (avisos.length) console.log('avisos: ' + avisos.join('; '));
      const fontes = Object.fromEntries(['data.js', 'sim.js', 'breed.js', 'marcas.js', 'sprites.js'].map(n => [n, fs.readFileSync(path.join(PROTOTYPE, 'src', n), 'utf8')]));
      extra = { fontes, moldes };
    }
    html = htmlFolhaFinal(d, extra);
    console.log(`final: ${12 - d.faltam.length} de 12 moldes${d.faltam.length ? ` (faltam ${d.faltam.join(', ')})` : ''}`);
  }
  const saida = path.join(pasta, `folha-${fase}.html`);
  fs.writeFileSync(saida, html);
  console.log(`escrito ${path.relative(process.cwd(), saida)} (${Math.round(html.length / 1024)} KB)`);
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) await principal(process.argv.slice(2));
