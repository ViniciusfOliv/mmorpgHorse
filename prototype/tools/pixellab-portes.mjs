// prototype/tools/pixellab-portes.mjs — o lote `portes` do pixellab-moldes.mjs (spec 2026-11-13-cavalos-portes §4–§5):
// os 12 moldes novos, 3 portes (esguio, padrao, robusto) × 4 estilos (lisa = o corpo-mestre, sem elemento; chamas,
// ondas e folhas = as versões de Fogo, Água e Grama, que partem do mestre).
//
// Uso (pelo pixellab-moldes.mjs): --lote portes --fase mestres|piloto|versoes [--only <porte>[-<estilo>]] [--teto 90]
//   [--repetir <chave>/<etapa>[,…]] [--sem-guia <porte>-<estilo>]… [--guia-galope-mestre <porte>-<estilo>]…
//   [--refazer <porte>-<estilo>:<etapa>[,<etapa>…]]… [--reprocessar] [--gerar]. Sem --gerar é dry-run (nenhuma
//   chamada, nenhum arquivo).
//   --sem-guia (piloto e versoes; repetível): aquela versão sai sem init_image, pela receita do primeiro lote, nas seeds
//            sem guia (3701+), e passa nos mesmos critérios — a decisão da folha quando a crina mudou pouco partindo do
//            mestre (spec §5.2). Não mexe no registro do piloto; na fase versoes vale também para o chamas.
//   --guia-galope-mestre (piloto e versoes; repetível): a pose de corrida daquela versão sai com init_image = o 1º
//            quadro cru do galope do mestre (init_image_strength FORCA_GUIA_GALOPE = 300, a força da guia de corrida do
//            primeiro lote) e o galope é animado a partir dela — o galope do mestre guiando o de uma versão que falhou
//            (spec §4). Retrato e parado seguem como estavam (reaproveitados de raw/).
//   --refazer (as 3 fases; repetível): refaz aquelas etapas do item (retrato, parado, corrida, galope; refazer a corrida
//            refaz o galope, que parte dela) numa refação, com seeds novas (ver Seeds) e as mesmas regras de sempre (3
//            seeds, parada na 1ª aprovada, teto somado, registro). A tentativa anterior da etapa vai para o `historico`
//            do item e a escolha só olha as novas; as outras etapas seguem como estavam (reaproveitadas de raw/). O
//            número da refação de cada etapa fica no criterios.json (`refacoes`): sem --refazer, a etapa continua nas
//            seeds dela (retomar, --reprocessar). Item que ficou pela metade (alguma etapa sem terminar as seeds: teto,
//            erro fatal) não abre refação nova com o --refazer: a que ficou pela metade é retomada. Só para item que já
//            tem registro, com a mesma receita; não anda com --reprocessar.
//   Item refeito com outra receita (outra `variante`) guarda a entrada anterior em `historico` no criterios.json.
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
//   Refação r de uma etapa (--refazer): as mesmas contas + 1000 × r (PASSO_REFACAO). A 1ª: mestres 4101–4103 (+100,
//   +200: até 4303; +50 do --repetir: 4151…), guiadas 4401–4409 (até 4609) e sem guia 4701–4709 (até 4909), tudo em
//   4101–4959; a 2ª em 5101–5959, e assim por diante. Nenhuma refação cruza outra nem os blocos de antes, e o nome do
//   cru leva a seed: um cru antigo nunca é sobrescrito.
// Critérios automáticos (portes-criterios.mjs) de cada tentativa:
//   retrato e parado: forma (o validar() do primeiro lote) + 4 pernas + (versões) mesmo corpo contra o mestre +
//                     (retrato do esguio e do robusto) a proporção contra o retrato do padrão;
//   corrida:          forma + pelo menos 2 pernas (ela vira o quadro 0 do galope, que precisa de 2 em todo quadro);
//   galope:           forma nos quadros + pelo menos 2 pernas em todo quadro + galope estável contra a pose de corrida,
//                     com exatamente 9 quadros (galope com outro número reprova e só fica como "melhor", marcado).
//   Item ainda reprovado depois das 3 seeds fica com a melhor tentativa (menos critérios reprovados; reprovar na forma
//   pesa mais) e sai marcado no criterios.json e na folha; quem decide é o Vinicius.
//   Escolha que continua valendo não muda: quando o critério muda (ex.: a regra do galope de 2026-11-13) e a etapa é
//   reavaliada de raw/, a escolhida da rodada anterior (na mesma refação) fica se continuar aprovada, ou, todas
//   reprovadas, se empatar com a melhor. Trocar a pose de corrida obrigaria a animar outro galope, e trocar o mestre, a
//   refazer as versões. Depois de uma aprovada o script só segue até a escolha anterior pelo que já está em raw/, sem
//   pagar nada.
// Crus: um cru em raw/ é reaproveitado quando o pedido é o mesmo, também com um texto de porte anterior (TEXTOS_PORTE).
//   Um cru que existe com outro pedido nunca é refeito por cima: o --gerar para (o dry-run mostra onde); seeds novas
//   saem com --refazer. Um registro só de erro (sem imagem) pode ser refeito.
// Teto: somado entre rodadas em novos/gasto.json ({ geracoes, chamadas, rodadas: [...] }, gravado a cada chamada
//   paga); a chamada que passaria do teto (padrão 90) não sai. Um gasto.json que existe mas não se lê (JSON quebrado,
//   "geracoes" que não é número finito ≥ 0) para o --gerar antes de qualquer chamada e nunca é sobrescrito; o dry-run
//   avisa em destaque.
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
export const TENTATIVAS = 3, PASSO_SEED = 100, SEED_EXTRA = 50, PASSO_REFACAO = 1000;
const BLOCO = { mestre: 3101, guiada: 3401, semGuia: 3701 };
// init_image_strength das versões guiadas (1–999; mais alto = mais perto da guia). Em 2026-11-09 a força 150 já
// copiou o penacho da guia de chamas; aqui a crina TEM de mudar e o corpo ficar: o piloto confere o corpo.
export const FORCA_GUIA = 100;
// init_image_strength da corrida guiada pelo 1º quadro do galope do mestre (--guia-galope-mestre): a mesma 300 da guia
// de corrida do primeiro lote (o 1º quadro do galope de chamas guiou ondas, folhas e lisa em 2026-11-09).
export const FORCA_GUIA_GALOPE = 300;

// ---------------------------------------------------------------- textos (spec §4: tabela de aparência, exagerada)
// Cada porte guarda as versões do seu texto; a última sai nos pedidos novos. As anteriores ficam para reconhecer os crus
// que já estão em raw/ (mesmo pedido ⇒ reaproveitado, nunca refeito por cima) e para o assets.md saber qual texto gerou
// qual cru: cada tentativa no criterios.json grava a `versaoTexto` do pedido dela.
export const TEXTOS_PORTE = {
  esguio: [{ versao: 1, texto: 'tall slender lean horse inspired by the Mangalarga breed, very long thin legs, long slim neck held high, small refined head, tail set and carried high, narrow light body, clearly taller and thinner than an average horse' }],
  padrao: [{ versao: 1, texto: 'balanced medium build horse inspired by the Campolina breed, average proportions, slightly convex head profile, medium length neck and legs, well proportioned body' }],
  robusto: [
    // v1 gerou os mestres de 2026-11-13 (seeds 3103, 3203, 3303): na folha, altura/comprimento 1,023 × a do padrão (alvo
    // ≤ 0,92) e espessura/comprimento 0,965 × (alvo ≥ 1,15) — não se distinguia do padrão
    { versao: 1, texto: 'short stocky robust horse inspired by the Crioulo breed, low and wide, deep thick chest, short thick muscular neck, short strong sturdy legs, full thick mane, compact heavy body, clearly shorter and wider than an average horse' },
    // v2 (decisão do Vinicius na folha dos mestres, 2026-11-13): exagera o cavalo de tração em barril, com as pernas mais
    // curtas que a altura do corpo
    { versao: 2, texto: 'very short stocky heavy draft-type horse inspired by the Crioulo breed, massive barrel-shaped body that is very wide and very deep, very short thick sturdy legs that are shorter than the depth of the body, short very thick muscular neck, broad wide chest, low heavy stance close to the ground, large heavy head, full thick mane, clearly much lower, wider and heavier than an average horse' },
  ],
};
const ultimaVersao = porte => TEXTOS_PORTE[porte][TEXTOS_PORTE[porte].length - 1].versao;
const textoPorte = (porte, versao) => (TEXTOS_PORTE[porte].find(v => v.versao === versao) || {}).texto;
// o texto atual (a última versão) de cada porte
export const TEXTO_PORTE = Object.fromEntries(PORTES.map(p => [p, textoPorte(p, ultimaVersao(p))]));
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
// versao = a do texto do porte (TEXTOS_PORTE); sem ela, a última.
export function pedidoPorte(item, etapa, seed, guiaBuf, forca = FORCA_GUIA, versao = ultimaVersao(item.porte)) {
  const crina = CRINAS[item.estilo], pose = POSES_PORTES[etapa], porte = textoPorte(item.porte, versao);
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
  if (guiaBuf) { corpo.init_image = imagem(guiaBuf); corpo.init_image_strength = forca; }
  return corpo;
}

// ---------------------------------------------------------------- itens e seeds
function novoItem(fase, porte, estilo, guia, guiaGalope = false) {
  const p = PORTES.indexOf(porte), e = ELEMENTOS.indexOf(estilo), mestre = estilo === 'lisa';
  guia = !mestre && guia; guiaGalope = !mestre && guiaGalope;
  return {
    chave: `${porte}-${estilo}`, fase, porte, estilo, mestre, guia, guiaGalope,
    seedBase: mestre ? BLOCO.mestre + p : (guia ? BLOCO.guiada : BLOCO.semGuia) + 3 * e + p,
    chaveMestre: mestre ? null : `${porte}-lisa`,
    // a receita do item; mudou de uma rodada para outra ⇒ a entrada anterior vai para o `historico` do criterios.json
    variante: mestre ? 'mestre' : (guia ? 'init_image do mestre' : 'sem init_image') + (guiaGalope ? ' + corrida guiada pelo galope do mestre' : ''),
  };
}
// piloto = criterios.json.piloto ({ <porte>: { mesmoCorpo } }), para saber quais versões saem sem init_image;
// semGuia / guiaGalope = as chaves de --sem-guia / --guia-galope-mestre (na fase versoes, --sem-guia num chamas o inclui)
export function itensDaFase(fase, { only = null, piloto = {}, semGuia = [], guiaGalope = [] } = {}) {
  let pares;
  if (fase === 'mestres') pares = ['padrao', 'esguio', 'robusto'].map(p => [p, 'lisa']);
  else if (fase === 'piloto') pares = PORTES.map(p => [p, 'chamas']);
  else {
    pares = PORTES.flatMap(p => {
      const pilotoRuim = !!(piloto[p] && piloto[p].mesmoCorpo === false);
      return ELEMENTOS.filter(e => e !== 'chamas' || pilotoRuim || semGuia.includes(`${p}-${e}`)).map(e => [p, e]);
    });
  }
  const itens = pares.map(([p, e]) => {
    const pilotoRuim = fase === 'versoes' && !!(piloto[p] && piloto[p].mesmoCorpo === false);
    return novoItem(fase, p, e, !pilotoRuim && !semGuia.includes(`${p}-${e}`), guiaGalope.includes(`${p}-${e}`));
  });
  return only ? itens.filter(it => it.porte === only || it.chave === only) : itens;
}
// as seeds de uma etapa na refação dela (item.refacoes[etapa]: 0 = as de sempre; r ≥ 1 = a r-ésima do --refazer)
export function seedsDoItem(item, etapa, repetir = []) {
  const base = item.seedBase + PASSO_REFACAO * ((item.refacoes && item.refacoes[etapa]) || 0);
  const s = Array.from({ length: TENTATIVAS }, (_, k) => base + PASSO_SEED * k);
  if (repetir.includes(`${item.chave}/${etapa}`)) s.push(base + SEED_EXTRA);
  return s;
}
// --refazer <porte>-<estilo>:<etapa>[,<etapa>…] (repetível) ⇒ { pedidos: { <chave>: [etapas] }, erro }. Refazer a
// corrida refaz também o galope (ele parte dela). Só confere a forma; o item é conferido contra a fase em
// validarArgsPortes.
export function lerRefazer(lista = []) {
  const pedidos = {};
  for (const r of lista) {
    const [chave, etapas, resto] = String(r).split(':');
    const es = String(etapas || '').split(',').filter(Boolean);
    if (!chave || resto != null || !es.length || es.some(e => !ETAPAS.includes(e))) {
      return { pedidos: {}, erro: `--refazer ${r}: use <porte>-<estilo>:<etapa>[,<etapa>…], com as etapas ${ETAPAS.join(', ')} (ex.: padrao-lisa:corrida)` };
    }
    const s = new Set([...(pedidos[chave] || []), ...es]);
    if (s.has('corrida')) s.add('galope');
    pedidos[chave] = ETAPAS.filter(e => s.has(e));
  }
  return { pedidos, erro: null };
}
// Confere --only, --repetir, --sem-guia, --guia-galope-mestre e --refazer contra os itens da fase; devolve o erro ou null.
export function validarArgsPortes({ fase, only, repetir = [], semGuia = [], guiaGalope = [], refazer = [], reprocessar = false }, novos = DIR_NOVOS) {
  if (!FASES.includes(fase)) return `--lote portes: --fase ${fase == null ? '(faltou)' : fase}: use mestres, piloto ou versoes`;
  for (const [op, lista] of [['--sem-guia', semGuia], ['--guia-galope-mestre', guiaGalope]]) {
    if (!lista.length) continue;
    if (fase === 'mestres') return `${op}: só nas fases piloto e versoes (o mestre não tem guia)`;
    for (const ch of lista) {
      const [p, e, resto] = String(ch).split('-');
      if (!PORTES.includes(p) || !ELEMENTOS.includes(e) || resto != null) return `${op} ${ch}: use <porte>-<estilo> de uma versão (ex.: padrao-ondas)`;
      if (fase === 'piloto' && e !== 'chamas') return `${op} ${ch}: a fase piloto só tem as versões de chamas`;
    }
  }
  const crit = lerCriterios(novos), todos = itensDaFase(fase, { piloto: crit.piloto || {}, semGuia, guiaGalope });
  for (const ch of guiaGalope) {
    if (!todos.some(it => it.chave === ch)) return `--guia-galope-mestre ${ch}: não está na fase "${fase}" (itens: ${todos.map(it => it.chave).join(', ')})`;
  }
  if (only && !todos.some(it => it.porte === only || it.chave === only)) {
    return `--only ${only}: não existe na fase "${fase}" (itens: ${todos.map(it => it.chave).join(', ')}; ou um porte: ${PORTES.join(', ')})`;
  }
  if (repetir.length > 2) return '--repetir: no máximo 2 itens';
  for (const r of repetir) {
    const [chave, etapa] = r.split('/');
    if (!todos.some(it => it.chave === chave) || !ETAPAS.includes(etapa)) return `--repetir ${r}: item desconhecido na fase "${fase}" (ex.: ${todos[0].chave}/retrato, ${todos[0].chave}/galope)`;
  }
  if (refazer.length) {
    if (reprocessar) return '--refazer não anda com --reprocessar (o --refazer pede seeds novas; o --reprocessar só lê raw/)';
    const { pedidos, erro } = lerRefazer(refazer);
    if (erro) return erro;
    for (const chave of Object.keys(pedidos)) {
      const it = todos.find(i => i.chave === chave), ant = crit.itens[chave];
      if (!it) return `--refazer ${chave}: não está na fase "${fase}" (itens: ${todos.map(i => i.chave).join(', ')})`;
      if (only && it.porte !== only && it.chave !== only) return `--refazer ${chave}: fora do --only ${only}`;
      if (!ant) return `--refazer ${chave}: o item ainda não tem registro no criterios.json (nada a refazer: rode a fase sem --refazer)`;
      if (ant.variante !== it.variante) return `--refazer ${chave}: a receita mudou ("${ant.variante}" → "${it.variante}") e a nova já sai nas seeds dela, sem --refazer`;
    }
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
// gasto.json que existe mas não se lê: o gasto acumulado do lote é desconhecido. Nunca vale como zero (o teto ficaria
// livre) e nunca é sobrescrito (a 1ª chamada paga apagaria o registro): o --gerar para, o dry-run avisa.
export class GastoIlegivel extends ErroApi {
  constructor(arq, motivo) {
    super(`${rel(arq)} ilegível (${motivo}): o gasto acumulado do lote é desconhecido. Conserte o arquivo à mão (ele não é sobrescrito) antes de gerar.`, { fatal: true });
  }
}
export function lerGasto(novos = DIR_NOVOS) {
  const arq = path.join(novos, 'gasto.json');
  if (!fs.existsSync(arq)) return { geracoes: 0, chamadas: 0, rodadas: [] };
  let g;
  try { g = JSON.parse(fs.readFileSync(arq, 'utf8')); } catch (e) { throw new GastoIlegivel(arq, `não é JSON: ${e.message}`); }
  const finito = v => typeof v === 'number' && Number.isFinite(v) && v >= 0;
  if (!g || typeof g !== 'object' || Array.isArray(g)) throw new GastoIlegivel(arq, 'não é um objeto');
  if (!finito(g.geracoes)) throw new GastoIlegivel(arq, `"geracoes" = ${JSON.stringify(g.geracoes)}, não um número finito ≥ 0`);
  if (g.chamadas != null && !finito(g.chamadas)) throw new GastoIlegivel(arq, `"chamadas" = ${JSON.stringify(g.chamadas)}, não um número finito ≥ 0`);
  if (g.rodadas != null && !Array.isArray(g.rodadas)) throw new GastoIlegivel(arq, '"rodadas" não é uma lista');
  return Object.assign({ chamadas: 0, rodadas: [] }, g);
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
// nomes em raw/: a etapa guiada leva a marca da guia (outra guia ⇒ outro arquivo): `g<força>m<seed do mestre>` pelo
// mestre no mesmo estado, `gm<força>c<corrida>s<galope>` pelo 1º quadro do galope do mestre. O galope leva a marca da
// pose de corrida de onde saiu.
const marcaGuia = (tipo, guia) => (tipo === 'galope' ? `gm${FORCA_GUIA_GALOPE}${guia ? guia.seed : 'x'}` : `g${FORCA_GUIA}m${guia ? guia.seed : 'x'}`);
const prefixoEtapa = (item, etapa, marca) => `portes-${item.chave}-${etapa}${marca ? '-' + marca : ''}`;
const prefixoGalope = (item, tc) => `portes-${item.chave}-galope-c${tc.seed}${tc.marca || ''}`;
// as imagens cruas aceitas do mestre (as seeds do JSON dele), para o init_image das versões guiadas; galope0 = o 1º
// quadro cru do galope dele (para --guia-galope-mestre), ou null se faltar
function crusDoMestre(raw, J, chave) {
  const out = {};
  for (const [etapa, k] of [['retrato', 'retrato'], ['parado', 'parado'], ['corrida', 'montado']]) {
    const seed = J.seeds && J.seeds[k], base = `portes-${chave}-${etapa}-s${seed}`, f = path.join(raw, base + '.png');
    if (seed == null || !fs.existsSync(f)) return null;
    out[etapa] = { seed, buf: fs.readFileSync(f), arquivo: `raw/${base}.png` };
  }
  const cs = J.seeds.montado, gs = J.seeds.galope, g0 = `portes-${chave}-galope-c${cs}-s${gs}-0.png`;
  out.galope0 = gs != null && fs.existsSync(path.join(raw, g0)) ? { seed: `c${cs}s${gs}`, buf: fs.readFileSync(path.join(raw, g0)), arquivo: `raw/${g0}` } : null;
  return out;
}

// ---------------------------------------------------------------- tentativas
const PLANEJADO = Symbol('planejado');
const falhasDe = t => (t.criterios || []).filter(c => !c.ok);
// a tentativa passou no "mesmo corpo" (todos os critérios dele ok), qualquer que seja o resto (forma, pernas…)
const passouMesmoCorpo = t => { const mc = (t.criterios || []).filter(c => /^mesmo corpo/.test(c.criterio)); return mc.length > 0 && mc.every(c => c.ok); };
// melhor tentativa: a 1ª aprovada; senão a com menos critérios reprovados (reprovar na forma pesa 100); empate: a 1ª.
// pref = o cru (nome-base em raw/) da escolhida da rodada anterior: fica se continuar aprovada, ou, sem aprovada, se
// empatar com a melhor (a escolha que continua valendo não muda)
function escolher(tentativas, pref = null) {
  const comImagem = tentativas.filter(t => t.planejada || t._buf || t._bufs), ehPref = t => pref != null && t._base === pref;
  const oks = comImagem.filter(t => t.ok || t.planejada);
  if (oks.length) return oks.find(ehPref) || oks[0];
  const nota = t => falhasDe(t).reduce((n, c) => n + (/^forma/.test(c.criterio) ? 100 : 1), 0);
  return comImagem.reduce((m, t) => (!m || nota(t) < nota(m) || (nota(t) === nota(m) && ehPref(t) && !ehPref(m)) ? t : m), null);
}
// nome-base do cru de uma tentativa gravada: raw/<base>.png (parada) ou raw/<base>-0..8.png / -N.png (galope)
const baseDoArquivo = a => (typeof a === 'string' ? a.replace(/^raw\//, '').replace(/(-\d+\.\.\d+|-N)?\.png$/, '') : null);
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
  const { fase, only = null, teto = TETO_PADRAO, repetir = [], semGuia = [], guiaGalope = [], refazer = [], modo = 'plano', executar = null } = op;
  const raw = (op.dirs && op.dirs.raw) || DIR_MOLDES_RAW, novos = (op.dirs && op.dirs.novos) || DIR_NOVOS;
  const plano = modo === 'plano', reproc = modo === 'reprocessar';
  const log = plano ? () => {} : (op.log || console.log);
  if (!FASES.includes(fase)) throw new ErroApi(`fase desconhecida: ${fase}`, { fatal: true });
  if (modo === 'gerar' && typeof executar !== 'function') throw new Error('rodarPortes: modo gerar sem executar');
  const { pedidos, erro: erroRefazer } = lerRefazer(refazer);
  if (erroRefazer) throw new ErroApi(erroRefazer, { fatal: true });
  if (reproc && refazer.length) throw new ErroApi('--refazer não anda com --reprocessar', { fatal: true });
  const crit = lerCriterios(novos), avisos = [];
  // gasto.json ilegível: o --gerar para aqui, antes de qualquer chamada; o plano e o --reprocessar (que não pagam nem
  // gravam o gasto) seguem com o aviso
  let gasto, gastoIlegivel = null;
  try { gasto = lerGasto(novos); } catch (e) {
    if (!(e instanceof GastoIlegivel) || modo === 'gerar') throw e;
    gastoIlegivel = e.message; gasto = { geracoes: 0, chamadas: 0, rodadas: [], ilegivel: true };
    avisos.push(e.message + (plano ? ' A previsão abaixo conta como se nada tivesse sido gasto; o --gerar recusa rodar assim.' : ''));
  }
  const itens = itensDaFase(fase, { only, piloto: crit.piloto, semGuia, guiaGalope });
  const res = { itens: itens.map(i => i.chave), chamadas: [], reaproveitadas: [], avisos, falhas: 0, parada: null, gastoAntes: gasto.geracoes, gastoIlegivel, gasto: 0, previstas: 0 };
  // as entradas de antes desta rodada (o histórico de um item refeito com outra receita é guardado, não sobrescrito)
  const anteriores = {};
  for (const it of itens) if (crit.itens[it.chave]) anteriores[it.chave] = crit.itens[it.chave];
  // refação de cada etapa (0 = as seeds de sempre; r = a r-ésima do --refazer): a gravada no criterios.json (com a
  // mesma receita), + 1 nas etapas pedidas no --refazer. Item que ficou pela metade (alguma etapa sem terminar as
  // seeds: teto, erro fatal) não abre refação nova: a dele é retomada — rodar o mesmo --refazer de novo não joga fora
  // o que já saiu.
  for (const it of itens) {
    const ant = anteriores[it.chave], mesma = !!ant && ant.variante === it.variante, pede = pedidos[it.chave] || [];
    const metade = mesma && ETAPAS.some(e => !(ant.etapas && ant.etapas[e] && ant.etapas[e].terminada));
    it.refacoes = Object.fromEntries(ETAPAS.map(e => [e, (mesma && ant.refacoes && ant.refacoes[e]) || 0]));
    it.refazendo = mesma && !metade ? pede.slice() : [];
    for (const e of it.refazendo) it.refacoes[e]++;
    if (!pede.length) continue;
    if (!mesma) avisos.push(`--refazer ${it.chave}: ignorado (${ant ? `a receita mudou de "${ant.variante}" para "${it.variante}"` : 'o item ainda não tem registro'}; ele sai nas seeds de sempre).`);
    else if (metade) avisos.push(`--refazer ${it.chave}: o item ficou pela metade (teto ou erro) e é retomado nas mesmas seeds, sem refação nova; rode o --refazer de novo depois, se ainda quiser refazer.`);
    else {
      const desc = it.refazendo.map(e => `${e} (refação ${it.refacoes[e]}: seeds ${seedsDoItem(it, e, repetir).join(', ')}${e === 'galope' && it.refazendo.includes('corrida') ? '; parte da corrida nova' : ''})`);
      avisos.push(`--refazer ${it.chave}: ${desc.join(', ')}; a tentativa anterior vai para o histórico e a escolha só olha as novas.`);
    }
  }

  // teto somado entre rodadas: o orçamento começa no gasto de novos/gasto.json e grava a cada chamada paga
  const rodada = { data: new Date().toISOString(), fase, modo, only, ...(refazer.length ? { refazer } : {}), teto, geracoes: 0, chamadas: 0 };
  const orc = criarOrcamento(teto, {
    gasto: gasto.geracoes, log,
    aoRegistrar: (ep, g) => {
      if (gasto.ilegivel) throw new ErroApi('gasto.json ilegível: nada é gravado por cima dele', { fatal: true });
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
      const querGalope = itens.filter(i => i.porte === p && i.guiaGalope).map(i => i.chave);
      if (querGalope.length && !(crus && crus.galope0)) {
        if (!plano) throw new ErroApi(`--guia-galope-mestre ${querGalope.join(', ')}: falta o 1º quadro cru do galope do mestre ${chave} em raw/`, { fatal: true });
        res.avisos.push(`o galope do mestre ${chave} ainda não está em raw/: a corrida de ${querGalope.join(', ')} entra guiada por ele quando existir.`);
      }
    }
  }
  for (const it of itens) {
    if (semGuia.includes(it.chave)) res.avisos.push(`--sem-guia ${it.chave}: sai sem init_image (receita do primeiro lote, seed base ${it.seedBase}); o registro do piloto não muda.`);
    if (it.guiaGalope) res.avisos.push(`--guia-galope-mestre ${it.chave}: a pose de corrida sai com init_image = o 1º quadro do galope do mestre ${it.chaveMestre} (força ${FORCA_GUIA_GALOPE}), e o galope parte dela.`);
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
  for (const a of res.avisos) log(`AVISO: ${a}`); // no plano, quem imprime é o dryRunPortes
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
      etapas[e] = { escolhida: x.escolhida ? x.escolhida.seed : null, ok: !!(x.escolhida && x.escolhida.ok), terminada: x.terminada, refacao: item.refacoes[e], tentativas: x.tentativas };
      if (!x.terminada) falhas.push(`${e}: interrompida antes de terminar as seeds`);
      else if (!x.escolhida) falhas.push(`${e}: nenhuma tentativa com imagem`);
      else if (!x.escolhida.ok) {
        falhas.push(...falhasDe(x.escolhida).map(c => (c.criterio.startsWith(e + ':') ? '' : `${e}: `) + resumoCrit(c)), ...(x.escolhida.motivo ? [`${e}: ${x.escolhida.motivo}`] : []));
      }
    }
    if (st.incompleto) falhas.push(st.incompleto);
    const completo = ETAPAS.every(e => st.etapas[e] && st.etapas[e].terminada && st.etapas[e].escolhida);
    // a entrada anterior com outra receita vai para o histórico (com as tentativas dela); a da mesma receita é refeita
    // desta rodada (as tentativas reaproveitadas de raw/ voltam todas), e o histórico dela continua. Etapas refeitas
    // (--refazer): o registro anterior delas (escolhida, tentativas, refação) vai para o histórico, acrescentado.
    const ant = anteriores[item.chave], semHist = ({ historico, ...resto }) => resto;
    const refeito = ant && item.refazendo.length ? [{
      refazer: item.refazendo, data: rodada.data, variante: ant.variante, falhas: ant.falhas || [],
      refacoes: Object.fromEntries(item.refazendo.map(e => [e, (ant.refacoes && ant.refacoes[e]) || 0])),
      etapas: Object.fromEntries(item.refazendo.filter(e => ant.etapas && ant.etapas[e]).map(e => [e, ant.etapas[e]])),
    }] : [];
    const historico = ant ? [...(ant.historico || []), ...(ant.variante !== item.variante ? [semHist(ant)] : []), ...refeito] : [];
    const g0 = item.guiaGalope && mestres[item.porte] && mestres[item.porte].crus && mestres[item.porte].crus.galope0;
    return {
      fase: item.fase, porte: item.porte, estilo: item.estilo, mestre: item.chaveMestre, variante: item.variante,
      guia: item.guia ? { init_image_strength: FORCA_GUIA } : null,
      guiaGalope: item.guiaGalope ? { init_image_strength: FORCA_GUIA_GALOPE, quadro: g0 ? g0.arquivo : null } : null,
      seedBase: item.seedBase, refacoes: item.refacoes, completo, final: st.final, ok: completo && !falhas.length, falhas, etapas, historico,
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
  // o cru (nome-base em raw/) da escolhida da rodada anterior nesta etapa, com a mesma receita e a mesma refação, ou null
  const preferida = (item, etapa) => {
    const ant = anteriores[item.chave], x = ant && ant.variante === item.variante && ant.etapas && ant.etapas[etapa];
    if (!x || x.escolhida == null || (x.refacao || 0) !== item.refacoes[etapa]) return null;
    const t = (x.tentativas || []).find(y => y.seed === x.escolhida);
    return t ? baseDoArquivo(t.arquivo) : null;
  };
  // o pedido de uma seed parada: com o texto atual do porte; se o cru dessa seed em raw/ saiu de um texto anterior
  // (TEXTOS_PORTE), vale aquele — o cru é reaproveitado, nunca refeito por cima (o nome dele não leva o texto)
  const pedidoDaSeed = (item, etapa, seed, base, guiaBuf, forca) => {
    const vs = TEXTOS_PORTE[item.porte];
    for (let k = vs.length - 1; k >= 0; k--) {
      const corpo = pedidoPorte(item, etapa, seed, guiaBuf, forca, vs[k].versao), reg = lerCru(raw, base, corpo);
      if (reg) return { corpo, reg, versao: vs[k].versao };
    }
    return { corpo: pedidoPorte(item, etapa, seed, guiaBuf, forca), reg: null, versao: ultimaVersao(item.porte) };
  };
  // um cru que já existe em raw/ com outro pedido nunca é refeito por cima: o --gerar para antes de pagar (o dry-run
  // mostra onde). Só um registro de erro, sem imagem, pode ser refeito. O --reprocessar não paga (fica o FaltaCru).
  const protegerCru = (base, varios, rotulo, seed) => {
    const arq = path.join(raw, base + '.json');
    if (reproc || !fs.existsSync(arq)) return;
    const reg = lerJson(arq);
    if (reg && reg.erro && !pngsCrus(raw, base, varios)) return;
    throw new ErroApi(`raw/${base}: já existe um cru de ${rotulo} seed ${seed} com outro pedido, e ele não é refeito por cima (para seeds novas: --refazer)`, { fatal: true });
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
    const mestre = item.mestre ? null : mestres[item.porte], crus = mestre && mestre.crus;
    // a guia desta etapa: o 1º quadro do galope do mestre (corrida com --guia-galope-mestre), o mestre no mesmo estado
    // (versão guiada) ou nenhuma
    const tipo = etapa === 'corrida' && item.guiaGalope ? 'galope' : item.guia ? 'estado' : null;
    const guia = tipo === 'galope' ? (crus && crus.galope0) || null : tipo === 'estado' ? (crus && crus[etapa]) || null : null;
    const g = tipo && { tipo, guia, forca: tipo === 'galope' ? FORCA_GUIA_GALOPE : FORCA_GUIA, marca: marcaGuia(tipo, guia),
      descricao: guia ? guia.arquivo : tipo === 'galope' ? `o 1º quadro do galope do mestre ${item.chaveMestre} (ainda não gerado)` : `o mestre ${item.chaveMestre}/${etapa} (ainda não gerado)` };
    const tentativas = [], pref = preferida(item, etapa);
    st.etapas[etapa] = { tentativas, escolhida: null, terminada: false };
    try {
      await tentarParada(item, etapa, rotulo, mestre, g, tentativas, pref);
      st.etapas[etapa].terminada = true;
    } finally {
      // também quando o teto interrompe no meio: fica a melhor tentativa que já tem imagem
      const esc = st.etapas[etapa].escolhida = escolher(tentativas, pref);
      if (esc && !esc.ok && !esc.planejada && st.etapas[etapa].terminada) log(`    ${rotulo}: reprovada nas ${tentativas.length} seeds; fica a melhor, a seed ${esc.seed}`);
      if (item.mestre && item.porte === 'padrao' && etapa === 'retrato' && esc && esc._quadro) {
        refPadrao = { w: LADO, h: LADO, retrato: esc._quadro.idx, ancoras: { retrato: esc._quadro.ancora } };
      }
    }
  }
  // pref = o cru da escolha anterior (preferida): depois de uma aprovada, o laço só segue até ela, e só pelo que já
  // está em raw/ (sem pagar); a escolha fica com ela se continuar aprovada
  async function tentarParada(item, etapa, rotulo, mestre, g, tentativas, pref) {
    const seeds = seedsDoItem(item, etapa, repetir), bases = seeds.map(s => `${prefixoEtapa(item, etapa, g && g.marca)}-s${s}`);
    const ate = bases.indexOf(pref);
    for (let k = 0; k < seeds.length; k++) {
      const seed = seeds[k], base = bases[k];
      const { corpo, reg, versao } = pedidoDaSeed(item, etapa, seed, base, g && g.guia && g.guia.buf, g ? g.forca : FORCA_GUIA);
      const crus = reg && !reg.erro && !reg.rejeitada ? pngsCrus(raw, base, false) : null;
      if (!crus && tentativas.some(x => x.ok)) break;
      const t = { seed, endpoint: PIXFLUX, prompt: corpo.description, versaoTexto: versao, arquivo: `raw/${base}.png`, geracoes: 0, marca: g ? g.marca : '', _base: base };
      if (g) { t.init_image = g.descricao; t.init_image_strength = g.forca; }
      tentativas.push(t);
      log(`  ${rotulo} seed ${seed}${g ? ` (init_image ${t.init_image}, força ${g.forca})` : ''}`);
      if (reg && (reg.erro || reg.rejeitada)) { pular(t, reg); continue; }
      let buf;
      if (crus) { reaproveitar(t, reg, rotulo); buf = crus[0]; }
      else {
        if (!reg) protegerCru(base, false, rotulo, seed);
        const it = { rotulo, seed, geracoes: 0 };
        let resp;
        try {
          resp = await pagar(PIXFLUX, it, corpo, corpo.description + (g ? ` [init_image = ${t.init_image}; init_image_strength ${g.forca}]` : ''));
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
      if (t.ok && k >= ate) break;
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
    const tentativas = [], pref = preferida(item, 'galope');
    st.etapas.galope = { tentativas, escolhida: null, terminada: false };
    if (!tc) { st.incompleto = 'galope: sem pose de corrida'; return; }
    try {
      await tentarGalope(item, rotulo, tc, tentativas, pref);
      st.etapas.galope.terminada = true;
    } finally {
      const esc = st.etapas.galope.escolhida = escolher(tentativas, pref);
      if (esc && !esc.ok && !esc.planejada && st.etapas.galope.terminada) log(`    ${rotulo}: reprovado nas ${tentativas.length} seeds; fica o melhor galope, a seed ${esc.seed}`);
    }
  }
  async function tentarGalope(item, rotulo, tc, tentativas, pref) {
    const seeds = seedsDoItem(item, 'galope', repetir), bases = seeds.map(s => `${prefixoGalope(item, tc)}-s${s}`);
    const ate = bases.indexOf(pref);
    for (let k = 0; k < seeds.length; k++) {
      const seed = seeds[k], base = bases[k];
      const t = { seed, endpoint: ANIMA, prompt: ACAO_PORTES, first_frame: `${item.chave}/corrida seed ${tc.seed}`, geracoes: 0, _base: base };
      const texto = `${ACAO_PORTES} [first_frame = ${t.first_frame}; frame_count 8; drift_threshold 0]`;
      if (tc.planejada) { tentativas.push(t); await pagar(ANIMA, { rotulo, seed, geracoes: 0 }, null, texto); t.planejada = true; break; }
      const corpo = pedidoGalope(tc._buf, seed, ACAO_PORTES), reg = lerCru(raw, base, corpo);
      let bufs = reg && !reg.erro && !reg.rejeitada ? pngsCrus(raw, base, true) : null;
      if (!bufs && tentativas.some(x => x.ok)) break;
      tentativas.push(t);
      t.arquivo = `raw/${base}-N.png`;
      log(`  ${rotulo} seed ${seed} (corrida ${tc.seed}; job assíncrono; pode levar minutos)`);
      if (reg && (reg.erro || reg.rejeitada)) { pular(t, reg); continue; }
      if (bufs) reaproveitar(t, reg, rotulo);
      else {
        if (!reg) protegerCru(base, true, rotulo, seed);
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
      if (!bufs.length) { t.ok = false; t.motivo = 'veio sem quadros'; log(`    REPROVADA seed ${seed}: ${t.motivo}`); continue; }
      t.arquivo = `raw/${base}-0..${bufs.length - 1}.png`;
      // outro número que não 9 reprova no critério "galope: 9 quadros" (e ainda pode ficar como o melhor, marcado)
      if (bufs.length !== LIMITES.quadros) log(`    AVISO ${rotulo}: vieram ${bufs.length} quadros (o molde precisa de ${LIMITES.quadros})`);
      avaliarGalope(item, bufs, t, tc);
      relatar(rotulo, t);
      if (t.ok && k >= ate) break;
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
      log(`\n== ${item.chave} (${item.fase}; seed base ${item.seedBase}${item.guia ? `; init_image do mestre ${item.chaveMestre}, força ${FORCA_GUIA}` : item.mestre ? '' : '; sem init_image'}${item.guiaGalope ? `; corrida guiada pelo galope do mestre, força ${FORCA_GUIA_GALOPE}` : ''}) ==`);
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
      // spec §5: o piloto reprova só se NENHUMA das seeds passar no "mesmo corpo" — em cada estado (retrato e parado),
      // basta uma tentativa com todos os critérios de mesmo corpo ok, mesmo que ela reprove em outro (a forma, por
      // exemplo) e a escolhida seja outra. Estado interrompido sem nenhuma aprovada ainda não decide.
      for (const item of itens) {
        if (!item.guia) continue; // --sem-guia: não é o piloto guiado; o registro do piloto fica como está
        const st = estados[item.chave];
        const veredito = e => {
          const x = st.etapas[e];
          if (!x) return null;
          const passou = x.tentativas.find(passouMesmoCorpo);
          if (passou) return { ok: true, seed: passou.seed };
          if (!x.terminada) return null;
          return { ok: false, falhas: x.tentativas.filter(t => t.criterios).map(t => `seed ${t.seed}: ${t.criterios.filter(c => /^mesmo corpo/.test(c.criterio) && !c.ok).map(resumoCrit).join('; ')}`) };
        };
        const vr = veredito('retrato'), vp = veredito('parado');
        if (!vr || !vp) continue;
        crit.piloto[item.porte] = { chave: item.chave, mesmoCorpo: vr.ok && vp.ok, retrato: vr, parado: vp, atualizado: new Date().toISOString() };
      }
    }
    if (rodada.chamadas) rodada.parada = res.parada;
    if (rodada.chamadas && !gasto.ilegivel) gravarJson(path.join(novos, 'gasto.json'), gasto);
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
export async function dryRunPortes({ fase, only = null, teto = TETO_PADRAO, repetir = [], semGuia = [], guiaGalope = [], refazer = [], dirs } = {}, log = console.log) {
  const r = await rodarPortes({ fase, only, teto, repetir, semGuia, guiaGalope, refazer, modo: 'plano', dirs });
  const sobra = r.gastoIlegivel ? '?' : fmt(teto - r.gastoAntes), gastas = r.gastoIlegivel ? 'DESCONHECIDO (gasto.json ilegível)' : fmt(r.gastoAntes);
  if (r.gastoIlegivel) {
    log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    log(`!!! AVISO: ${r.gastoIlegivel}`);
    log('!!! O --gerar recusa rodar até o arquivo ser consertado; a previsão abaixo conta como se nada tivesse sido gasto.');
    log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
  }
  log(`DRY-RUN (sem --gerar): nenhuma chamada à API. Lote "portes", fase "${fase}"${only ? ` (--only ${only})` : ''}; teto ${teto} gerações no lote todo, somadas entre rodadas em novos/gasto.json: já gastas ${gastas}, sobram ${sobra}.`);
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
  if (cortadas.length) log(`AVISO: o teto de ${teto} gerações (já gastas ${gastas}) cortou ${cortadas.length} chamada(s), a partir de ${cortadas[0].rotulo}.`);
  if (r.parada) log(`\nO --gerar PARARIA aqui (a lista acima vai só até este ponto): ${r.parada}`);
  const reap = r.reaproveitadas.map(({ rotulo, t }) => `${rotulo} (seed ${t.seed}${t.ok ? '' : ', reprovada'})`);
  log(`\nReaproveitados de raw/ (0 geração): ${reap.length ? reap.join(', ') : 'nenhum'}.`);
  log(`\nTotal previsto: ${n} gerações em ${n} chamadas novas (+ ${r.reaproveitadas.length} reaproveitadas de raw/); no pior caso (${TENTATIVAS} seeds por etapa), ${TENTATIVAS * n}; teto ${teto} no lote (sobram ${sobra}).`);
  return r;
}
