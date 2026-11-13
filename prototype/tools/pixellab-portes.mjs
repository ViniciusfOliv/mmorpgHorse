// prototype/tools/pixellab-portes.mjs — o lote `portes` do pixellab-moldes.mjs (spec 2026-11-13-cavalos-portes §4–§5):
// os 12 moldes novos, 3 portes (esguio, padrao, robusto) × 4 estilos (lisa = o corpo-mestre, sem elemento; chamas,
// ondas e folhas = as versões de Fogo, Água e Grama, que partem do mestre).
//
// Uso (pelo pixellab-moldes.mjs): --lote portes --fase mestres|piloto|versoes [--only <porte>[-<estilo>]] [--teto 90]
//   [--repetir <chave>/<etapa>[,…]] [--reprocessar] [--gerar]. Sem --gerar é dry-run (nenhuma chamada, nenhum arquivo).
// Fases (cada item é um molde, com 4 etapas: retrato, parado, corrida e galope):
//   mestres  lisa dos 3 portes, na ordem padrao, esguio, robusto (o padrão é a régua das proporções dos outros dois);
//   piloto   chamas dos 3 portes, com init_image = a imagem crua do mestre no mesmo estado (init_image_strength
//            FORCA_GUIA): mostra se o init_image segura o corpo do mestre;
//   versoes  ondas e folhas dos 3 portes. Porte cujo piloto reprovou no "mesmo corpo" nas 3 seeds sai sem init_image
//            (a receita do primeiro lote), e o chamas dele é refeito junto; o script avisa.
// Receita (§5): retrato, parado e pose de corrida pelo create-image-pixflux (cores de papel pedidas por texto, COR e
// JOQUEI_CORES, e classificadas no script); o galope pelo animate-with-text-v3 a partir da pose de corrida aceita
// (frame_count 8 + o 1º quadro = 9). Ordem dentro da fase: primeiro as imagens paradas de todos os itens (retrato,
// parado, corrida) e depois os galopes.
// Seeds (faixa nova, sem cruzar os moldes de 1101–2001 nem os ícones de 2101–2458): base do item =
//   mestres  3101 + p                  (p = 0 esguio, 1 padrao, 2 robusto: 3101, 3102, 3103)
//   guiadas  3401 + 3 × e + p          (e = 0 chamas, 1 ondas, 2 folhas: 3401…3409; piloto e versões com init_image)
//   sem guia 3701 + 3 × e + p          (3701…3709: versões de um porte cujo piloto reprovou no mesmo corpo)
//   Cada etapa tenta até 3 seeds, base, base + 100 e base + 200, e para na 1ª que passa nos critérios automáticos;
//   --repetir <chave>/<etapa> dá uma 4ª, base + 50. As 4 etapas do item usam as mesmas seeds (endpoints e textos
//   diferentes). Todas caem em 3101–3959.
// Critérios automáticos (portes-criterios.mjs) de cada tentativa:
//   retrato e parado: forma (o validar() do primeiro lote) + 4 pernas + (versões) mesmo corpo contra o mestre +
//                     (retrato do esguio e do robusto) a proporção contra o retrato do padrão;
//   corrida:          forma + pelo menos 3 pernas (ela vira o quadro 0 do galope, que precisa de 3 em todo quadro);
//   galope:           forma nos 9 quadros + pernas do galope + galope estável contra a pose de corrida.
//   Item ainda reprovado depois das 3 seeds fica com a melhor tentativa (menos critérios reprovados; reprovar na forma
//   pesa mais) e sai marcado no criterios.json e na folha; quem decide é o Vinicius.
// Teto: somado entre rodadas em novos/gasto.json ({ geracoes, chamadas, rodadas: [...] }, gravado a cada chamada
//   paga); a chamada que passaria do teto (padrão 90) não sai.
// Saídas: os finais em prototype/assets/pixellab/novos/ (molde-<porte>-<estilo>.json e -<estado>.png, no formato que o
//   build lê, mas numa pasta que ele NÃO lê); os crus em raw/ (portes-<chave>-<etapa>[-g<força>m<seed do mestre>]-s<seed>);
//   o relatório dos critérios em novos/criterios.json (toda tentativa: seed, prompt, init_image, custo e critérios).
//   O docs/memoria/assets.md fica para depois da aprovação nas folhas (folha-portes.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { decodePng } from './png.mjs';
import { ancoras, deCinza } from './moldes-lib.mjs';
import {
  DIR_MOLDES, DIR_MOLDES_RAW, RAIZ, HOJE, PIXFLUX, ANIMA, LADO, COR, JOQUEI, POSES, CRINAS, ACAO_CORRIDA,
  imagem, pedidoGalope, fmt, bufDe, lerCru, gravarCru, gravarErro, pngsCrus, apagarQuadrosCrus, geracoesDe, recuperavel,
  ErroApi, FaltaCru, TetoAtingido, criarOrcamento, pago, quadrosDoJob, classificarGrupo, quadrosDoMolde, gravarMolde,
} from './pixellab-comum.mjs';
import { LIMITES, pernas, criterioPernas, criterioMesmoCorpo, criterioPortes, criterioGalope } from './portes-criterios.mjs';

export const PORTES = ['esguio', 'padrao', 'robusto'];
export const ELEMENTOS = ['chamas', 'ondas', 'folhas'];
export const FASES = ['mestres', 'piloto', 'versoes'];
export const ETAPAS = ['retrato', 'parado', 'corrida', 'galope'];
export const DIR_NOVOS = path.join(DIR_MOLDES, 'novos');
export const TETO_PADRAO = 90;
export const TENTATIVAS = 3, PASSO_SEED = 100, SEED_EXTRA = 50;
const BLOCO = { mestre: 3101, guiada: 3401, semGuia: 3701 };
// init_image_strength das versões guiadas (1–999; mais alto = mais perto da guia). Em 2026-11-09 a força 150 já
// copiou o penacho da guia de chamas; aqui a crina TEM de mudar e o corpo ficar: o piloto confere o corpo.
export const FORCA_GUIA = 100;

// ---------------------------------------------------------------- textos (spec §4: tabela de aparência, exagerada)
export const TEXTO_PORTE = {
  esguio: 'tall slender lean horse inspired by the Mangalarga breed, very long thin legs, long slim neck held high, small refined head, tail set and carried high, narrow light body, clearly taller and thinner than an average horse',
  padrao: 'balanced medium build horse inspired by the Campolina breed, average proportions, slightly convex head profile, medium length neck and legs, well proportioned body',
  robusto: 'short stocky robust horse inspired by the Crioulo breed, low and wide, deep thick chest, short thick muscular neck, short strong sturdy legs, full thick mane, compact heavy body, clearly shorter and wider than an average horse',
};
// o critério das pernas (Marcas.zonas) só acha perna que aparece separada: pedir as 4 à mostra nas poses paradas
const PERNAS_SEPARADAS = 'all four legs clearly visible and separated, the far legs offset from the near legs with a gap between every leg, no overlapping legs';
export const POSES_PORTES = {
  retrato: `standing still horse, ${PERNAS_SEPARADAS}, no rider, no saddle`,
  parado: `horse standing still, ${PERNAS_SEPARADAS}, ${JOQUEI}`,
  corrida: POSES.corrida,
};
// reforço do mestre com jóquei (o da lisa no lote de 2026-11-08: sem ele, crina marrom e jóquei borrado)
const REFORCO_MESTRE = 'bright green (#00ff00) long straight mane and tail clearly visible, jockey in yellow silks and yellow helmet';
export const ACAO_PORTES = `${ACAO_CORRIDA}, the same horse with the same body proportions in every frame`;

// Pedido do create-image-pixflux de uma etapa parada. Mestre: porte + pose + crina lisa + COR. Versão: a crina do
// elemento no começo e repetida como "clearly visible and distinct" (o reforço da rodada de crinas de 2026-11-09).
export function pedidoPorte(item, etapa, seed, guiaBuf) {
  const crina = CRINAS[item.estilo], pose = POSES_PORTES[etapa], porte = TEXTO_PORTE[item.porte];
  const reforco = item.mestre && etapa !== 'retrato' ? `, ${REFORCO_MESTRE}` : '';
  const corpo = {
    description: item.mestre
      ? `side view, facing right, ${porte}, ${pose}, ${crina}${reforco}, ${COR}`
      : `side view, facing right, ${crina}, ${porte}, ${pose}, ${crina} clearly visible and distinct, ${COR}`,
    image_size: { width: LADO, height: LADO },
    view: 'side', direction: 'east',
    outline: 'single color black outline', shading: 'basic shading', detail: 'medium detail',
    no_background: true, seed,
  };
  if (guiaBuf) { corpo.init_image = imagem(guiaBuf); corpo.init_image_strength = FORCA_GUIA; }
  return corpo;
}

// ---------------------------------------------------------------- itens e seeds
function novoItem(fase, porte, estilo, guia) {
  const p = PORTES.indexOf(porte), e = ELEMENTOS.indexOf(estilo), mestre = estilo === 'lisa';
  return {
    chave: `${porte}-${estilo}`, fase, porte, estilo, mestre, guia: !mestre && guia,
    seedBase: mestre ? BLOCO.mestre + p : (guia ? BLOCO.guiada : BLOCO.semGuia) + 3 * e + p,
    chaveMestre: mestre ? null : `${porte}-lisa`,
  };
}
// piloto = criterios.json.piloto ({ <porte>: { mesmoCorpo } }), para saber quais versões saem sem init_image
export function itensDaFase(fase, { only = null, piloto = {} } = {}) {
  let itens;
  if (fase === 'mestres') itens = ['padrao', 'esguio', 'robusto'].map(p => novoItem(fase, p, 'lisa', false));
  else if (fase === 'piloto') itens = PORTES.map(p => novoItem(fase, p, 'chamas', true));
  else {
    itens = PORTES.flatMap(p => {
      const semGuia = !!(piloto[p] && piloto[p].mesmoCorpo === false);
      return (semGuia ? ELEMENTOS : ELEMENTOS.slice(1)).map(e => novoItem(fase, p, e, !semGuia));
    });
  }
  return only ? itens.filter(it => it.porte === only || it.chave === only) : itens;
}
export function seedsDoItem(item, etapa, repetir = []) {
  const s = Array.from({ length: TENTATIVAS }, (_, k) => item.seedBase + PASSO_SEED * k);
  if (repetir.includes(`${item.chave}/${etapa}`)) s.push(item.seedBase + SEED_EXTRA);
  return s;
}
// Confere --only e --repetir contra os itens da fase; devolve a mensagem de erro ou null.
export function validarArgsPortes({ fase, only, repetir = [] }, novos = DIR_NOVOS) {
  if (!FASES.includes(fase)) return `--lote portes: --fase ${fase == null ? '(faltou)' : fase}: use mestres, piloto ou versoes`;
  const todos = itensDaFase(fase, { piloto: lerCriterios(novos).piloto || {} });
  if (only && !todos.some(it => it.porte === only || it.chave === only)) {
    return `--only ${only}: não existe na fase "${fase}" (itens: ${todos.map(it => it.chave).join(', ')}; ou um porte: ${PORTES.join(', ')})`;
  }
  if (repetir.length > 2) return '--repetir: no máximo 2 itens';
  for (const r of repetir) {
    const [chave, etapa] = r.split('/');
    if (!todos.some(it => it.chave === chave) || !ETAPAS.includes(etapa)) return `--repetir ${r}: item desconhecido na fase "${fase}" (ex.: ${todos[0].chave}/retrato, ${todos[0].chave}/galope)`;
  }
  return null;
}

// ---------------------------------------------------------------- arquivos de novos/
const rel = f => path.relative(RAIZ, f);
function lerJson(arq) { try { return JSON.parse(fs.readFileSync(arq, 'utf8')); } catch { return null; } }
function gravarJson(arq, v) {
  fs.mkdirSync(path.dirname(arq), { recursive: true });
  // as chaves com "_" (imagens e quadros em memória) não vão para o arquivo
  fs.writeFileSync(arq, JSON.stringify(v, (k, x) => (k.startsWith('_') ? undefined : x), 2) + '\n');
}
export function lerGasto(novos = DIR_NOVOS) {
  const g = lerJson(path.join(novos, 'gasto.json'));
  return g && typeof g.geracoes === 'number' ? Object.assign({ chamadas: 0, rodadas: [] }, g) : { geracoes: 0, chamadas: 0, rodadas: [] };
}
export function lerCriterios(novos = DIR_NOVOS) {
  const c = lerJson(path.join(novos, 'criterios.json'));
  return c && c.itens ? Object.assign({ piloto: {}, portes: null }, c) : { lote: 'portes', itens: {}, piloto: {}, portes: null };
}
// Molde gravado (molde-<chave>.json + PNGs em cinza = papel × 25) no formato dos critérios, ou null se faltar algo.
export function lerMolde(dir, chave) {
  const J = lerJson(path.join(dir, `molde-${chave}.json`));
  if (!J || !(J.frames > 0) || !J.ancoras) return null;
  const idx = n => {
    const f = path.join(dir, `molde-${chave}-${n}.png`);
    if (!fs.existsSync(f)) return null;
    const d = decodePng(fs.readFileSync(f));
    return deCinza(Uint8Array.from({ length: d.width * d.height }, (_, i) => d.rgba[i * 4]));
  };
  const retrato = idx('retrato'), parado = idx('parado'), galope = Array.from({ length: J.frames }, (_, i) => idx('galope-' + i));
  if (!retrato || !parado || galope.some(g => !g)) return null;
  return { w: J.w, h: J.h, retrato, parado, galope, ancoras: J.ancoras, larguraUtil: J.larguraUtil, json: J };
}
// nomes em raw/: a versão guiada leva a força e a seed do mestre naquele estado (outra guia ⇒ outro arquivo)
const prefixoEtapa = (item, etapa, guia) => `portes-${item.chave}-${etapa}${item.guia ? `-g${FORCA_GUIA}m${guia ? guia.seed : 'x'}` : ''}`;
const prefixoGalope = (item, tc) => `portes-${item.chave}-galope-c${tc.seed}${item.guia ? `g${FORCA_GUIA}m${tc.mestreSeed}` : ''}`;
// as imagens cruas aceitas do mestre (as seeds do JSON dele), para o init_image das versões guiadas
function crusDoMestre(raw, J, chave) {
  const out = {};
  for (const [etapa, k] of [['retrato', 'retrato'], ['parado', 'parado'], ['corrida', 'montado']]) {
    const seed = J.seeds && J.seeds[k], base = `portes-${chave}-${etapa}-s${seed}`, f = path.join(raw, base + '.png');
    if (seed == null || !fs.existsSync(f)) return null;
    out[etapa] = { seed, buf: fs.readFileSync(f), arquivo: `raw/${base}.png` };
  }
  return out;
}

// ---------------------------------------------------------------- tentativas
const PLANEJADO = Symbol('planejado');
const falhasDe = t => (t.criterios || []).filter(c => !c.ok);
// melhor tentativa: a 1ª aprovada; senão a com menos critérios reprovados (reprovar na forma pesa 100); empate: a 1ª
function escolher(tentativas) {
  const comImagem = tentativas.filter(t => t.planejada || t._buf || t._bufs);
  const ok = comImagem.find(t => t.ok || t.planejada);
  if (ok) return ok;
  const nota = t => falhasDe(t).reduce((n, c) => n + (/^forma/.test(c.criterio) ? 100 : 1), 0);
  return comImagem.reduce((m, t) => (!m || nota(t) < nota(m) ? t : m), null);
}
function criterioForma(etapa, ruins) {
  return { criterio: `forma (${etapa})`, ok: !ruins.length, valor: ruins.length, limite: 'paleta, papéis obrigatórios e silhueta fechada (validar)', ...(ruins.length ? { motivo: ruins.join('; ') } : {}) };
}
const resumoCrit = c => `${c.criterio} = ${c.valor == null ? '—' : typeof c.valor === 'number' ? fmt(c.valor) : c.valor} (${c.limite})`;

/**
 * Roda uma fase do lote. modo: 'plano' (dry-run: nada é pago nem gravado; as chamadas novas vão para
 * resultado.chamadas), 'reprocessar' (só raw/: refaz novos/ e o criterios.json; o que faltar em raw/ deixa o item
 * incompleto) ou 'gerar' (executar(ep, corpo) faz a chamada de verdade; o pixellab-moldes passa o executarReal).
 * dirs = { raw, novos } (os testes usam uma pasta temporária). Devolve { itens, chamadas, reaproveitadas, avisos,
 * falhas, parada, gastoAntes, gasto, previstas }.
 */
export async function rodarPortes(op) {
  const { fase, only = null, teto = TETO_PADRAO, repetir = [], modo = 'plano', executar = null } = op;
  const raw = (op.dirs && op.dirs.raw) || DIR_MOLDES_RAW, novos = (op.dirs && op.dirs.novos) || DIR_NOVOS;
  const plano = modo === 'plano', reproc = modo === 'reprocessar';
  const log = plano ? () => {} : (op.log || console.log);
  if (!FASES.includes(fase)) throw new ErroApi(`fase desconhecida: ${fase}`, { fatal: true });
  if (modo === 'gerar' && typeof executar !== 'function') throw new Error('rodarPortes: modo gerar sem executar');
  const crit = lerCriterios(novos), gasto = lerGasto(novos);
  const itens = itensDaFase(fase, { only, piloto: crit.piloto });
  const res = { itens: itens.map(i => i.chave), chamadas: [], reaproveitadas: [], avisos: [], falhas: 0, parada: null, gastoAntes: gasto.geracoes, gasto: 0, previstas: 0 };

  // teto somado entre rodadas: o orçamento começa no gasto de novos/gasto.json e grava a cada chamada paga
  const rodada = { data: new Date().toISOString(), fase, modo, only, teto, geracoes: 0, chamadas: 0 };
  const orc = criarOrcamento(teto, {
    gasto: gasto.geracoes, log,
    aoRegistrar: (ep, g) => {
      gasto.geracoes += g; gasto.chamadas += 1; rodada.geracoes += g; rodada.chamadas += 1;
      if (!gasto.rodadas.includes(rodada)) gasto.rodadas.push(rodada);
      gravarJson(path.join(novos, 'gasto.json'), gasto);
    },
  });
  const pagar = async (ep, it, corpo, texto) => {
    if (plano) {
      res.chamadas.push({ endpoint: ep, rotulo: it.rotulo, seed: it.seed, texto, alemDoTeto: gasto.geracoes + res.previstas + 1 > teto + 1e-9 });
      res.previstas++;
      return PLANEJADO;
    }
    if (reproc) throw new FaltaCru(`${it.rotulo} seed ${it.seed}`);
    return pago(orc, ep, it, () => executar(ep, corpo));
  };

  // mestres de cada porte (piloto e versões): o molde em novos/ e as imagens cruas aceitas dele
  const mestres = {};
  if (fase !== 'mestres') {
    for (const p of new Set(itens.map(i => i.porte))) {
      const chave = `${p}-lisa`, molde = lerMolde(novos, chave), crus = molde && crusDoMestre(raw, molde.json, chave);
      if (!molde || !crus) {
        if (!plano) throw new ErroApi(`falta o mestre ${chave} em ${rel(novos)}/ (com as imagens cruas em raw/): rode --fase mestres antes`, { fatal: true });
        res.avisos.push(`o mestre ${chave} ainda não está em novos/: a previsão usa a 1ª seed de cada etapa e o init_image entra quando ele existir.`);
      }
      mestres[p] = { molde, crus };
    }
  }
  if (fase === 'versoes') {
    for (const p of new Set(itens.map(i => i.porte))) {
      const pil = crit.piloto[p];
      if (!pil) {
        if (!plano) throw new ErroApi(`falta o resultado do piloto de ${p} no criterios.json: rode --fase piloto antes`, { fatal: true });
        res.avisos.push(`sem o resultado do piloto de ${p}: a previsão supõe o piloto aprovado (versões com init_image).`);
      } else if (pil.mesmoCorpo === false) {
        res.avisos.push(`o piloto de ${p} reprovou no "mesmo corpo" nas 3 seeds: as versões de ${p} saem sem init_image (receita do primeiro lote, seeds ${BLOCO.semGuia}+), e ${p}-chamas é refeito.`);
      }
    }
  }
  // régua das proporções: o retrato do padrão (o desta rodada, se o padrão está nela; senão o de novos/)
  let refPadrao = null;
  const regua = () => refPadrao || (refPadrao = (() => { const m = lerMolde(novos, 'padrao-lisa'); return m && { w: m.w, h: m.h, retrato: m.retrato, ancoras: { retrato: m.ancoras.retrato } }; })());

  const estados = {};
  for (const it of itens) estados[it.chave] = { etapas: {}, incompleto: null, final: false };

  const salvar = () => {
    if (plano) return;
    for (const it of itens) if (Object.keys(estados[it.chave].etapas).length) crit.itens[it.chave] = entrada(it);
    crit.lote = 'portes'; crit.limites = LIMITES; crit.atualizado = new Date().toISOString();
    gravarJson(path.join(novos, 'criterios.json'), crit);
  };
  function entrada(item) {
    const st = estados[item.chave], etapas = {}, falhas = [];
    for (const e of ETAPAS) {
      const x = st.etapas[e];
      if (!x) continue;
      etapas[e] = { escolhida: x.escolhida ? x.escolhida.seed : null, ok: !!(x.escolhida && x.escolhida.ok), terminada: x.terminada, tentativas: x.tentativas };
      if (!x.terminada) falhas.push(`${e}: interrompida antes de terminar as seeds`);
      else if (!x.escolhida) falhas.push(`${e}: nenhuma tentativa com imagem`);
      else if (!x.escolhida.ok) {
        falhas.push(...falhasDe(x.escolhida).map(c => (c.criterio.startsWith(e + ':') ? '' : `${e}: `) + resumoCrit(c)), ...(x.escolhida.motivo ? [`${e}: ${x.escolhida.motivo}`] : []));
      }
    }
    if (st.incompleto) falhas.push(st.incompleto);
    const completo = ETAPAS.every(e => st.etapas[e] && st.etapas[e].terminada && st.etapas[e].escolhida);
    return {
      fase: item.fase, porte: item.porte, estilo: item.estilo, mestre: item.chaveMestre,
      guia: item.guia ? { init_image_strength: FORCA_GUIA } : null, seedBase: item.seedBase,
      completo, final: st.final, ok: completo && !falhas.length, falhas, etapas,
    };
  }

  const pular = (t, reg) => {
    t.ok = false;
    if (reg.rejeitada) t.geracoes = geracoesDe(reg.resposta, reg.resposta && reg.resposta.job) ?? 1;
    t.motivo = reg.erro ? `erro registrado em rodada anterior: ${reg.erro}` : `rejeitada na conferência visual: ${reg.rejeitada}`;
    log(`    pulada seed ${t.seed}: ${t.motivo}`);
  };
  const reaproveitar = (t, reg, rotulo) => {
    t.reaproveitada = true; t.geracoes = geracoesDe(reg.resposta, reg.resposta && reg.resposta.job) ?? 1; t.data = reg.data;
    res.reaproveitadas.push({ rotulo, t });
    log(`    reaproveitada a imagem crua da seed ${t.seed} (mesmo pedido; ${fmt(t.geracoes)} geração gasta antes)`);
  };
  const relatar = (rotulo, t) => {
    if (t.planejada) return;
    log(t.ok ? `    aprovada seed ${t.seed}` : `    REPROVADA seed ${t.seed}: ${[...falhasDe(t).map(resumoCrit), ...(t.motivo && !t.criterios ? [t.motivo] : [])].join('; ')}`);
  };

  // ------------------------------------------------ etapa parada (retrato, parado, corrida)
  function avaliarParada(item, etapa, buf, t, mestre) {
    const g = classificarGrupo([buf], etapa !== 'retrato', `${item.chave}/${etapa}`, etapa === 'corrida');
    const q = g.quadros[0], a = ancoras(q.idx, LADO, LADO);
    const m = { w: LADO, h: LADO, [etapa]: q.idx, ancoras: { [etapa]: a }, larguraUtil: a.bbox.w };
    const crits = [criterioForma(etapa, g.ruins)];
    if (etapa === 'corrida') {
      const n = pernas(q.idx, LADO, LADO, a);
      crits.push({ criterio: 'pernas na pose de corrida (o quadro 0 do galope)', ok: n >= LIMITES.galopeMin, valor: n, limite: `≥ ${LIMITES.galopeMin}` });
    } else {
      crits.push(...criterioPernas(m));
      if (mestre && mestre.molde) crits.push(...criterioMesmoCorpo(m, mestre.molde));
      if (item.mestre && etapa === 'retrato' && item.porte !== 'padrao') {
        const ref = regua();
        if (ref) crits.push(...criterioPortes({ padrao: ref, [item.porte]: m }));
        else log('    (sem o retrato do padrão: a proporção do porte fica para o fim da fase)');
      }
    }
    t.criterios = crits; t.ok = crits.every(c => c.ok); t._buf = buf; t._quadro = { idx: q.idx, ancora: a };
  }
  async function etapaParada(item, etapa) {
    const st = estados[item.chave], rotulo = `${item.chave}/${etapa}`;
    const mestre = item.mestre ? null : mestres[item.porte];
    const guia = item.guia && mestre && mestre.crus ? mestre.crus[etapa] : null;
    const tentativas = [];
    st.etapas[etapa] = { tentativas, escolhida: null, terminada: false };
    try {
      await tentarParada(item, etapa, rotulo, mestre, guia, tentativas);
      st.etapas[etapa].terminada = true;
    } finally {
      // também quando o teto interrompe no meio: fica a melhor tentativa que já tem imagem
      const esc = st.etapas[etapa].escolhida = escolher(tentativas);
      if (esc && guia) esc.mestreSeed = guia.seed;
      if (esc && !esc.ok && !esc.planejada && st.etapas[etapa].terminada) log(`    ${rotulo}: reprovada nas ${tentativas.length} seeds; fica a melhor, a seed ${esc.seed}`);
      if (item.mestre && item.porte === 'padrao' && etapa === 'retrato' && esc && esc._quadro) {
        refPadrao = { w: LADO, h: LADO, retrato: esc._quadro.idx, ancoras: { retrato: esc._quadro.ancora } };
      }
    }
  }
  async function tentarParada(item, etapa, rotulo, mestre, guia, tentativas) {
    for (const seed of seedsDoItem(item, etapa, repetir)) {
      const corpo = pedidoPorte(item, etapa, seed, guia && guia.buf), base = `${prefixoEtapa(item, etapa, guia)}-s${seed}`;
      const t = { seed, endpoint: PIXFLUX, prompt: corpo.description, arquivo: `raw/${base}.png`, geracoes: 0 };
      if (item.guia) { t.init_image = guia ? guia.arquivo : `o mestre ${item.chaveMestre}/${etapa} (ainda não gerado)`; t.init_image_strength = FORCA_GUIA; }
      tentativas.push(t);
      log(`  ${rotulo} seed ${seed}${item.guia ? ` (init_image ${t.init_image}, força ${FORCA_GUIA})` : ''}`);
      const reg = lerCru(raw, base, corpo);
      if (reg && (reg.erro || reg.rejeitada)) { pular(t, reg); continue; }
      const crus = reg && pngsCrus(raw, base, false);
      let buf;
      if (crus) { reaproveitar(t, reg, rotulo); buf = crus[0]; }
      else {
        const it = { rotulo, seed, geracoes: 0 };
        let resp;
        try {
          resp = await pagar(PIXFLUX, it, corpo, corpo.description + (item.guia ? ` [init_image = ${t.init_image}; init_image_strength ${FORCA_GUIA}]` : ''));
        } catch (e) {
          if (!recuperavel(e)) throw e;
          gravarErro(raw, base, PIXFLUX, corpo, e); t.ok = false; t.motivo = e.message; t.geracoes = it.geracoes;
          log(`    REPROVADA seed ${seed}: ${e.message}`);
          continue;
        }
        if (resp === PLANEJADO) { t.planejada = true; break; }
        buf = bufDe(resp.image, rotulo);
        gravarCru(raw, base, PIXFLUX, corpo, resp, [[base + '.png', buf]]);
        t.geracoes = it.geracoes; t.data = new Date().toISOString();
      }
      avaliarParada(item, etapa, buf, t, mestre);
      relatar(rotulo, t);
      if (t.ok) break;
    }
  }

  // ------------------------------------------------ galope (a partir da pose de corrida escolhida)
  function avaliarGalope(item, bufs, t, tc) {
    const g = classificarGrupo(bufs, true, `${item.chave}/galope`, true);
    const anc = { corrida: tc._quadro.ancora }, galope = g.quadros.map(q => q.idx);
    galope.forEach((q, i) => { anc['galope-' + i] = ancoras(q, LADO, LADO); });
    const m = { w: LADO, h: LADO, galope, ancoras: anc, corrida: tc._quadro.idx };
    const crits = [criterioForma('galope', g.ruins), ...criterioPernas(m), ...criterioGalope(m)];
    t.criterios = crits; t.ok = crits.every(c => c.ok); t._bufs = bufs; t.quadros = bufs.length;
  }
  async function etapaGalope(item) {
    const st = estados[item.chave], rotulo = `${item.chave}/galope`, tc = st.etapas.corrida && st.etapas.corrida.escolhida;
    const tentativas = [];
    st.etapas.galope = { tentativas, escolhida: null, terminada: false };
    if (!tc) { st.incompleto = 'galope: sem pose de corrida'; return; }
    try {
      await tentarGalope(item, rotulo, tc, tentativas);
      st.etapas.galope.terminada = true;
    } finally {
      const esc = st.etapas.galope.escolhida = escolher(tentativas);
      if (esc && !esc.ok && !esc.planejada && st.etapas.galope.terminada) log(`    ${rotulo}: reprovado nas ${tentativas.length} seeds; fica o melhor galope, a seed ${esc.seed}`);
    }
  }
  async function tentarGalope(item, rotulo, tc, tentativas) {
    for (const seed of seedsDoItem(item, 'galope', repetir)) {
      const t = { seed, endpoint: ANIMA, prompt: ACAO_PORTES, first_frame: `${item.chave}/corrida seed ${tc.seed}`, geracoes: 0 };
      tentativas.push(t);
      const texto = `${ACAO_PORTES} [first_frame = ${t.first_frame}; frame_count 8; drift_threshold 0]`;
      if (tc.planejada) { await pagar(ANIMA, { rotulo, seed, geracoes: 0 }, null, texto); t.planejada = true; break; }
      const corpo = pedidoGalope(tc._buf, seed, ACAO_PORTES), base = `${prefixoGalope(item, tc)}-s${seed}`;
      t.arquivo = `raw/${base}-0..8.png`;
      log(`  ${rotulo} seed ${seed} (corrida ${tc.seed}; job assíncrono; pode levar minutos)`);
      const reg = lerCru(raw, base, corpo);
      if (reg && (reg.erro || reg.rejeitada)) { pular(t, reg); continue; }
      let bufs = reg && pngsCrus(raw, base, true);
      if (bufs) reaproveitar(t, reg, rotulo);
      else {
        const it = { rotulo, seed, geracoes: 0 };
        let r;
        try {
          r = await pagar(ANIMA, it, corpo, texto);
        } catch (e) {
          if (!recuperavel(e)) throw e;
          gravarErro(raw, base, ANIMA, corpo, e); t.ok = false; t.motivo = e.message; t.geracoes = it.geracoes;
          log(`    REPROVADA seed ${seed}: ${e.message}`);
          continue;
        }
        if (r === PLANEJADO) { t.planejada = true; break; }
        bufs = quadrosDoJob(r.job).map((img, i) => bufDe(img, `${rotulo} quadro ${i}`));
        apagarQuadrosCrus(raw, base);
        gravarCru(raw, base, ANIMA, corpo, r, bufs.map((b, i) => [`${base}-${i}.png`, b]));
        t.geracoes = it.geracoes; t.data = new Date().toISOString();
      }
      if (bufs.length !== 9 && bufs.length !== 8) {
        t.ok = false; t.motivo = `veio com ${bufs.length} quadros (esperado 9, ou 8)`; log(`    REPROVADA seed ${seed}: ${t.motivo}`);
        continue;
      }
      if (bufs.length === 8) log(`    AVISO ${rotulo}: vieram 8 quadros (não 9); usando 8`);
      avaliarGalope(item, bufs, t, tc);
      relatar(rotulo, t);
      if (t.ok) break;
    }
  }

  // ------------------------------------------------ finais em novos/ (só com as 4 etapas com imagem)
  function gravarFinais(item) {
    const st = estados[item.chave], esc = {};
    for (const e of ETAPAS) esc[e] = st.etapas[e] && st.etapas[e].escolhida;
    if (plano || ETAPAS.some(e => !esc[e] || esc[e].planejada || !st.etapas[e].terminada)) return;
    const fm = quadrosDoMolde(esc.retrato._buf, esc.parado._buf, esc.galope._bufs);
    const gerado = ETAPAS.map(e => esc[e].data || '').reduce((a, b) => (b > a ? b : a), '').slice(0, 10) || HOJE;
    gravarMolde(novos, item.chave, fm, { seeds: { retrato: esc.retrato.seed, parado: esc.parado.seed, montado: esc.corrida.seed, galope: esc.galope.seed }, gerado });
    st.final = true;
    log(`  gravado ${rel(path.join(novos, `molde-${item.chave}.json`))} (+ ${fm.nomes.length} PNGs)`);
  }

  const passo = async (item, f) => {
    const st = estados[item.chave];
    if (st.incompleto) return;
    try { await f(); } catch (e) {
      if (!(e instanceof FaltaCru)) throw e;
      st.incompleto = e.message; log(`  INCOMPLETO ${item.chave}: ${e.message}`);
    }
    salvar();
  };
  try {
    for (const item of itens) {
      log(`\n== ${item.chave} (${item.fase}; seed base ${item.seedBase}${item.guia ? `; init_image do mestre ${item.chaveMestre}, força ${FORCA_GUIA}` : item.mestre ? '' : '; sem init_image'}) ==`);
      for (const etapa of ['retrato', 'parado', 'corrida']) await passo(item, () => etapaParada(item, etapa));
    }
    for (const item of itens) {
      log(`\n== ${item.chave}: galope ==`);
      await passo(item, () => etapaGalope(item));
      gravarFinais(item);
    }
  } catch (e) {
    if (!(e instanceof TetoAtingido) && !(e instanceof ErroApi && e.fatal)) throw e;
    res.parada = e instanceof TetoAtingido ? `TETO: ${e.message}` : `ERRO FATAL: ${e.message}`;
    log('\n' + res.parada);
  }

  // fim da fase: as proporções dos 3 mestres e o resultado de cada piloto
  if (!plano) {
    if (fase === 'mestres') {
      const ms = Object.fromEntries(PORTES.map(p => [p, lerMolde(novos, `${p}-lisa`)]));
      const faltam = PORTES.filter(p => !ms[p]).map(p => `${p}-lisa`);
      crit.portes = faltam.length ? { faltam, criterios: [] } : { faltam: [], criterios: criterioPortes(ms) };
    }
    if (fase === 'piloto') {
      for (const item of itens) {
        const st = estados[item.chave], fim = e => st.etapas[e] && st.etapas[e].terminada && st.etapas[e].escolhida;
        const er = fim('retrato'), ep = fim('parado');
        if (!er || !ep || !er.criterios || !ep.criterios) continue;
        const mc = [...er.criterios, ...ep.criterios].filter(c => /^mesmo corpo/.test(c.criterio));
        crit.piloto[item.porte] = { chave: item.chave, mesmoCorpo: mc.every(c => c.ok), falhas: mc.filter(c => !c.ok).map(resumoCrit), atualizado: new Date().toISOString() };
      }
    }
    if (rodada.chamadas) rodada.parada = res.parada;
    if (rodada.chamadas) gravarJson(path.join(novos, 'gasto.json'), gasto);
    salvar();
    log('\n== Resumo ==');
    for (const item of itens) {
      const e = crit.itens[item.chave];
      if (!e) { log(`  ${item.chave.padEnd(16)} não começou`); continue; }
      if (!e.ok) res.falhas++;
      log(`  ${item.chave.padEnd(16)} ${e.ok ? 'OK' : e.completo ? 'REPROVADO' : 'INCOMPLETO'}  seeds ${ETAPAS.map(x => `${x} ${e.etapas[x] ? e.etapas[x].escolhida : '—'}`).join(', ')}${e.final ? '' : '  (sem final em novos/)'}`);
      for (const f of e.falhas) log(`      ${f}`);
    }
    if (fase === 'mestres' && crit.portes) {
      log(crit.portes.faltam.length ? `  Portes distintos: faltam ${crit.portes.faltam.join(', ')}` : `  Portes distintos: ${crit.portes.criterios.map(c => `${c.ok ? 'ok' : 'NÃO'} ${resumoCrit(c)}`).join('; ')}`);
    }
    if (fase === 'piloto') for (const p of PORTES) if (crit.piloto[p]) log(`  Piloto ${p}: mesmo corpo ${crit.piloto[p].mesmoCorpo ? 'ok (versões com init_image)' : 'REPROVADO (versões sem init_image)'}`);
    res.gasto = rodada.geracoes;
    log(`  Gerações desta rodada: ${fmt(rodada.geracoes)} em ${rodada.chamadas} chamadas pagas; no lote: ${fmt(gasto.geracoes)} de teto ${teto}${res.parada ? '; rodada interrompida' : ''}`);
  }
  return res;
}

// Dry-run: o mesmo caminho do lote, no modo 'plano' (nada pago, nada gravado), e a lista das chamadas novas.
export async function dryRunPortes({ fase, only = null, teto = TETO_PADRAO, repetir = [], dirs } = {}, log = console.log) {
  const r = await rodarPortes({ fase, only, teto, repetir, modo: 'plano', dirs });
  const sobra = teto - r.gastoAntes;
  log(`DRY-RUN (sem --gerar): nenhuma chamada à API. Lote "portes", fase "${fase}"${only ? ` (--only ${only})` : ''}; teto ${teto} gerações no lote todo, somadas entre rodadas em novos/gasto.json: já gastas ${fmt(r.gastoAntes)}, sobram ${fmt(sobra)}.`);
  log(`Itens: ${r.itens.length} (${r.itens.join(', ')}).`);
  log(`Cada etapa (retrato, parado, corrida e galope) tenta até ${TENTATIVAS} seeds (base, base + ${PASSO_SEED}, base + ${2 * PASSO_SEED}) e para na 1ª que`);
  log('passa nos critérios automáticos; as repetições não entram na previsão. Ordem: as imagens paradas de todos os itens,');
  log('depois os galopes (cada um a partir da pose de corrida aceita). Estimativa: 1 geração por chamada (custo observado);');
  log('o que já tem imagem crua em raw/ com o mesmo pedido (e passa nos critérios) é reaproveitado sem custo.');
  for (const a of r.avisos) log(`AVISO: ${a}`);
  log('');
  let n = 0;
  const cortadas = r.chamadas.filter(c => c.alemDoTeto);
  for (const c of r.chamadas) {
    if (c.alemDoTeto) continue;
    n++;
    log(`${String(n).padStart(3)}. POST ${c.endpoint.padEnd(22)} ${c.rotulo.padEnd(22)} seed ${c.seed}  ~1 geração`);
    log(`       ${c.texto}`);
  }
  if (cortadas.length) log(`AVISO: o teto de ${teto} gerações (já gastas ${fmt(r.gastoAntes)}) cortou ${cortadas.length} chamada(s), a partir de ${cortadas[0].rotulo}.`);
  const reap = r.reaproveitadas.map(({ rotulo, t }) => `${rotulo} (seed ${t.seed}${t.ok ? '' : ', reprovada'})`);
  log(`\nReaproveitados de raw/ (0 geração): ${reap.length ? reap.join(', ') : 'nenhum'}.`);
  log(`\nTotal previsto: ${n} gerações em ${n} chamadas novas (+ ${r.reaproveitadas.length} reaproveitadas de raw/); no pior caso (${TENTATIVAS} seeds por etapa), ${TENTATIVAS * n}; teto ${teto} no lote (sobram ${fmt(sobra)}).`);
  return r;
}
