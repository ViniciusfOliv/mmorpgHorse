// prototype/tools/pixellab-moldes.mjs — gera no PixelLab (API v2) os moldes de cavalo e os ícones.
//
// Uso:  NODE_USE_ENV_PROXY=1 node prototype/tools/pixellab-moldes.mjs --lote moldes|icones|icones2|tudo [--only <id>] [--teto 60] [--gerar]
//       NODE_USE_ENV_PROXY=1 node prototype/tools/pixellab-moldes.mjs --lote portes --fase mestres|piloto|versoes [--only <porte>[-<estilo>]] [--teto 90] [--gerar]
//         [--sem-guia <porte>-<estilo>]… [--guia-galope-mestre <porte>-<estilo>]… [--refazer <porte>-<estilo>:<etapa>[,…]]…
//         [--nova-refacao] [--guia-mestre <porte>-lisa=<porte>-lisa]… [--reprocessar [--manter-escolhas]]
//         (ver o topo do pixellab-portes.mjs; no portes, sai 0 com item só reprovado num critério)
//       node prototype/tools/pixellab-moldes.mjs --lote portes --fase … --escolher <porte>-<estilo>:<etapa>=<seed>… --motivo "<texto>"
//         (escolha manual de uma tentativa já paga: sem rede e sem custo, só raw/; regrava novos/)
//   (icones2 = os 58 ícones novos de icones-catalogo.mjs; tudo = moldes + os 16 + os 58; portes = os 12 moldes dos
//   portes da spec 2026-11-13-cavalos-portes, no pixellab-portes.mjs: fases, seeds 3101–3959, critérios, teto somado
//   entre rodadas em novos/gasto.json e saída na pasta de espera assets/pixellab/novos/, que o build não lê)
//   Sem --gerar é SEMPRE dry-run: lista as chamadas planejadas (endpoint, item, seed, prompt) e o total
//   de gerações, sem tocar na rede (nem /balance).
//   --gerar   gasta a cota do PixelLab — só com confirmação do dono do projeto (CLAUDE.md §7).
//   --teto N  máximo de gerações no lote todo (padrão 60; no portes, 90 somados entre rodadas). Soma o
//             usage.generations real de cada resposta e para ANTES de uma chamada que passaria do teto; o que já
//             foi gerado fica gravado.
//   --only id um estilo (chamas|ondas|folhas|lisa) ou um ícone (aba-estabulo, el-fogo, …).
//   --repetir item[,item]  dá UMA tentativa a mais (seed + 30) a cada item citado (ex.: lisa/parado,
//             icone/aba-loja): a repetição manual de item ruim (no máximo 2 itens por lote, plano Step 3).
//   --reprocessar  refaz os finais só a partir de raw/, sem rede (nem /balance): falha se faltar imagem crua.
//                  Não mexe em docs/memoria/assets.md (nada novo foi gerado).
//   --testar-crinas [--forca N]  rodada de crinas (2026-11-09): para os estilos com `testesCrina`, gera cada
//                  variante (corrida com a crina reforçada no texto + galope) com UMA tentativa por etapa, só
//                  anima se a corrida passar na pré-checagem e grava só em raw/ (nem finais, nem assets.md).
//                  --forca N roda só a variante dessa força. A escolhida vira o `corrida` do estilo e os finais
//                  saem num --gerar normal, que a reaproveita de raw/ sem custo.
// O código que os lotes dividem (textos de papel, registros crus, API e teto, pré-checagem e gravação dos finais)
// fica em pixellab-comum.mjs.
// Credencial: o proxy de rede injeta a chave (nunca no código nem em arquivo). O fetch do Node não lê
// HTTPS_PROXY sozinho: na sessão na nuvem, rode com NODE_USE_ENV_PROXY=1 (Node ≥ 22.21), senão a API
// responde 401 (a chamada sai sem passar pelo proxy e sem a chave).
//
// Moldes (por estilo): retrato, parado e montado em /create-image-pixflux com as cores de papel pedidas
// por TEXTO, galope em /animate-with-text-v3 a partir do montado. Cada quadro é classificado por família de
// cor (moldes-lib: classificarFamilias); claro × sombra da pelagem e da crina usam um limiar de Otsu por
// geração — retrato, parado e os quadros do galope juntos (para o galope não piscar); juntar as três
// gerações não serve, porque cada uma vem com um brilho diferente. Antes dos limiares, as correções de grupo
// (moldes-lib: corrigirGrupo, 2026-11-13): a sombra roxa da pelagem que caía na faixa magenta da seda volta à
// pelagem, e no cru de cores naturais (grupo sem nenhum pixel da família crina) a crina escura é achada pela forma e
// a seda que caiu na pelagem volta ao jóquei; os crus dos 4 moldes de hoje não passam por nenhuma delas. Depois limpa
// os papéis do jóquei, sombreia por procedimento o par desequilibrado, fecha o contorno só no montado e no galope (o animate
// devolve sem borda; no retrato e no parado a regra de silhueta do validar continua valendo) e valida.
// Quadro inválido refaz o item com seed + 10 (até 2 repetições por item, contando no teto).
// A paleta forçada (color_image com as cores de papel + /reduce-colors) foi testada em 2026-11-08 e
// descartada: o modelo pintava cada par num tom só (pelagem toda #800000, crina toda #008000) e punha
// cores do jóquei na crina; com cores livres + classificação o resultado ficou melhor (relatório da Task 2).
// Galope de corrida (spec 2026-11-09 §4): o galope de ondas, folhas e lisa saiu em meio-galope (corpo alto,
// patas recolhidas). Nesses estilos (campo `corrida` em ESTILOS) o montado vira a pose `corrida`: pixflux com
// init_image = 1º quadro cru do galope de chamas (o padrão), força `corrida.forca`, texto de corrida + crina
// + COR; o galope usa ACAO_CORRIDA. A pré-checagem aplica o aceite (moldes-lib: passada; altura do contorno)
// antes de gastar a etapa seguinte: corrida reprovada ⇒ nova seed da corrida (sem animar); galope reprovado
// ⇒ nova seed só do galope. Referência = galope final de chamas (molde-chamas-galope-*.png).
// Uma imagem crua já gravada em raw/ com o MESMO pedido (prompt, parâmetros, seed e imagens de entrada)
// é reaproveitada sem nova chamada; uma tentativa que deu erro de API fica registrada (JSON com "erro") e
// a seed é pulada ao retomar o lote. Uma imagem válida mas ruim na conferência visual é marcada à mão com
// "rejeitada": "<motivo>" no JSON cru, e a seed também é pulada.
// Saídas:
//   prototype/assets/pixellab/molde-<estilo>-{retrato,parado,galope-N}.png  (cinza = papel × 25)
//   prototype/assets/pixellab/molde-<estilo>.json        (âncoras, larguraUtil, limiares por geração, seeds)
//   prototype/assets/pixellab/raw/  (PNGs crus e respostas JSON sem os base64)
// Ícones: dois lotes (16 de `icones` + 58 de `icones2`), cada um com /create-image-pixflux 32×32 com a paleta da interface em color_image (pedido do plano) →
// prototype/assets/icons/<nome>.png (RGBA) e icons/raw/. Cada arquivo final que MUDOU ganha (ou troca) sua
// linha em docs/memoria/assets.md; o que só foi refeito igual a partir de raw/ não mexe no registro.
import fs from 'node:fs';
import path from 'node:path';
import { decodePng, encodePng } from './png.mjs';
import { ICONES_NOVOS } from './icones-catalogo.mjs';
import { ancoras, deCinza, passada } from './moldes-lib.mjs';
import {
  RAIZ, DIR_MOLDES, DIR_MOLDES_RAW, HOJE, PIXFLUX, ANIMA, LADO, COR, POSES, CRINAS, ACAO_GALOPE, ACAO_CORRIDA,
  imagem, pedidoGalope, fmt, bufDe, lerCru, gravarCru, gravarErro, pngsCrus, apagarQuadrosCrus, geracoesDe,
  TetoAtingido, ErroApi, recuperavel, estado, executarReal, quadrosDoJob, criarOrcamento, pago, saldo,
  decodificar64, preChecar, gravarFinal, quadrosDoMolde, gravarMolde,
} from './pixellab-comum.mjs';
import { TETO_PADRAO as TETO_PORTES, dryRunPortes, rodarPortes, validarArgsPortes, lerGasto, codigoSaidaPortes } from './pixellab-portes.mjs';

const DIR_ICONES = path.join(RAIZ, 'prototype', 'assets', 'icons');
const DIR_ICONES_RAW = path.join(DIR_ICONES, 'raw');
const ARQ_ASSETS = path.join(RAIZ, 'docs', 'memoria', 'assets.md');

const MAX_REPETICOES = 2; // por item
let REPETIR_EXTRA = [];   // itens com uma tentativa a mais (--repetir)
const PASSO_SEED = 10;    // repetição: seed + 10

// ---------------------------------------------------------------- o que gerar (plano, Task 2)
// COR, JOQUEI_CORES, POSES e as crinas (CRINAS) ficam no pixellab-comum.mjs, que o lote portes também usa.
// montado (opcional): seed e reforço próprios do montado — rodada 1 de correção: o montado da lisa saía
// com crina e cauda marrom-escuras e o jóquei borrado (o reforço vale também para a corrida).
// corrida (opcional): o montado deste estilo é a pose `corrida` (seed base da corrida e do galope; forca =
// init_image_strength, 1–999; reforcarCrina = a crina do estilo também no início do texto e repetida como
// "clearly visible and distinct"). chamas não tem: o galope dele é o padrão e a guia da corrida.
// testesCrina: variantes da rodada de crinas (--testar-crinas, 2026-11-09), só as que rodaram. A força 150 saiu
// quase uma cópia da guia (pose e penacho de chamas); a 200 a guia pesa mais, então não foi tentada. ondas: a
// seed 1801 deu HTTP 502 (sem imagem, não cobrado) e a tentativa a 150 foi refeita na 1811.
const ESTILOS = [
  { id: 'chamas', seed: 1101, crina: CRINAS.chamas },
  { id: 'ondas', seed: 1201, crina: CRINAS.ondas, corrida: { seed: 1501, forca: 300 },
    testesCrina: [{ seed: 1801, forca: 150, reforcarCrina: true }, { seed: 1811, forca: 150, reforcarCrina: true }] },
  { id: 'folhas', seed: 1301, crina: CRINAS.folhas, corrida: { seed: 1601, forca: 300 },
    testesCrina: [{ seed: 1901, forca: 150, reforcarCrina: true }] },
  { id: 'lisa', seed: 1401, crina: CRINAS.lisa,
    montado: { seed: 1451, reforco: 'bright green (#00ff00) long straight mane and tail clearly visible, jockey in yellow silks and yellow helmet' },
    corrida: { seed: 1701, forca: 300 },
    testesCrina: [{ seed: 2001, forca: 150, reforcarCrina: true }] },
];
const poseMontada = estilo => (estilo.corrida ? 'corrida' : 'montado');
const posesDe = estilo => ['retrato', 'parado', poseMontada(estilo)];
function seedBaseDe(estilo, k) {
  if (estilo.corrida && (k === 'corrida' || k === 'galope')) return estilo.corrida.seed;
  return k === 'montado' && estilo.montado ? estilo.montado.seed : estilo.seed;
}
const acaoDe = estilo => (estilo.corrida ? ACAO_CORRIDA : ACAO_GALOPE);
// guia da corrida: o 1º quadro cru (RGBA) do galope de chamas (= o montado de chamas, seed 1111)
const GUIA_CORRIDA = 'chamas-galope-m1111-s1101-0.png';
// nomes em raw/: a força entra no nome para uma força nova não sobrescrever a imagem crua de outra
const prefixoPose = (estilo, pose) => (pose === 'corrida' ? `${estilo.id}-corrida-f${estilo.corrida.forca}` : `${estilo.id}-${pose}`);
const prefixoGalope = (estilo, seedMontado) => `${estilo.id}-galope-${estilo.corrida ? `c${seedMontado}f${estilo.corrida.forca}` : `m${seedMontado}`}`;

const SUFIXO_ICONE = 'pixel art game ui icon, centered, simple, readable at small size';
const PALETA_ICONES = ['#000000', '#f2c230', '#ffe27a', '#9c7210', '#f1e9d4', '#16271f', '#335446'];
// [nome, descrição, opções]; opções da rodada 1 de correção (bússola parecia timão, estribo parecia
// ferradura): seed + 20 e descrição nova; `cor` = cor extra da paleta quando a descrição pede uma que a
// paleta da interface não tem (agulha vermelha ⇒ --perda do jogo). Bússola de novo em 2026-11-09 (spec da
// corrida viva §4): a da seed 2123 tinha a agulha pouco nítida; descrição nova e seed nova.
const ICONES = [
  ['aba-estabulo', 'horse head icon'], ['aba-correr', 'checkered racing flag icon'],
  ['aba-expedicao', 'round navigation compass, top view, crisp red and white needle pointing straight up, gold rim', { seed: 2143, cor: '#ff6b5e' }],
  ['aba-haras', 'two hearts icon'], ['aba-loja', 'shopping cart icon'], ['slot-ferraduras', 'horseshoe icon'],
  ['slot-sela', 'horse saddle icon'],
  ['slot-estribos', 'single stirrup iron: D-shaped metal loop with a flat footplate at the bottom, hanging from a short leather strap', { seed: 2128 }],
  ['slot-testeira', 'horse head armor chamfron icon'],
  ['slot-armadura', 'horse barding armor icon'], ['moeda-ouro', 'gold coin icon'], ['pedra-negra', 'black polished stone gem icon'],
  ['el-fogo', 'flame icon (#ff8a4c)'], ['el-agua', 'water drop icon (#62b8ff)'], ['el-grama', 'green leaf icon (#7be07a)'],
  ['el-geral', 'grey circle rune icon (#cfc8b4)'],   // ex-el-neutro (2026-11-11: virou o ícone das skills gerais)
].map(([id, desc, op = {}], i) => ({ id, desc, seed: op.seed || 2101 + i, cor: op.cor || null }));

// ---------------------------------------------------------------- corpos das chamadas

let guiaBuf = null;
function guiaCorrida() {
  if (!guiaBuf) {
    const f = path.join(DIR_MOLDES_RAW, GUIA_CORRIDA);
    if (!fs.existsSync(f)) throw new ErroApi(`falta a guia da corrida ${path.relative(RAIZ, f)}`, { fatal: true });
    guiaBuf = fs.readFileSync(f);
  }
  return guiaBuf;
}
function pedidoPose(estilo, pose, seed) {
  const reforco = (pose === 'montado' || pose === 'corrida') && estilo.montado ? `, ${estilo.montado.reforco}` : '';
  const forte = pose === 'corrida' && estilo.corrida.reforcarCrina;
  const corpo = {
    description: forte
      ? `side view, facing right, ${estilo.crina}, ${POSES[pose]}, ${estilo.crina} clearly visible and distinct${reforco}, ${COR}`
      : `side view, facing right, ${POSES[pose]}, ${estilo.crina}${reforco}, ${COR}`,
    image_size: { width: LADO, height: LADO },
    view: 'side', direction: 'east',
    outline: 'single color black outline', shading: 'basic shading', detail: 'medium detail',
    no_background: true, seed,
  };
  if (pose === 'corrida') { corpo.init_image = imagem(guiaCorrida()); corpo.init_image_strength = estilo.corrida.forca; }
  return corpo;
}
function coresIcone(icone) {
  const m = /\(#([0-9a-f]{6})\)/i.exec(icone.desc); // cor do tema, quando a descrição traz uma
  const tema = icone.cor || (m && '#' + m[1].toLowerCase());
  return tema ? PALETA_ICONES.concat(tema) : PALETA_ICONES;
}
function paletaIconePng(icone) {
  const cores = coresIcone(icone), rgba = new Uint8Array(cores.length * 4);
  cores.forEach((h, i) => rgba.set([parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255], i * 4));
  return encodePng({ width: cores.length, height: 1, rgba });
}
function pedidoIcone(icone, seed) {
  return {
    description: `${icone.desc}, ${SUFIXO_ICONE}`,
    image_size: { width: 32, height: 32 },
    no_background: true, outline: 'single color black outline', shading: 'basic shading',
    color_image: imagem(paletaIconePng(icone)), seed,
  };
}

// ---------------------------------------------------------------- argumentos
function sair(msg) { console.error(msg); process.exit(2); }

function lerArgs(argv) {
  const a = { lote: null, fase: null, only: null, teto: null, gerar: false, reprocessar: false, manterEscolhas: false, repetir: [], semGuia: [], guiaGalope: [], refazer: [], novaRefacao: false, guiaMestre: [], escolher: [], motivo: null, testarCrinas: false, forca: null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--gerar') a.gerar = true;
    else if (k === '--reprocessar') a.reprocessar = true;
    else if (k === '--manter-escolhas') a.manterEscolhas = true;
    else if (k === '--lote') a.lote = argv[++i];
    else if (k === '--only') a.only = argv[++i];
    else if (k === '--fase') a.fase = argv[++i];
    else if (k === '--sem-guia') a.semGuia.push(...String(argv[++i] || '').split(',').filter(Boolean));
    else if (k === '--guia-galope-mestre') a.guiaGalope.push(...String(argv[++i] || '').split(',').filter(Boolean));
    else if (k === '--refazer') a.refazer.push(String(argv[++i] || ''));
    else if (k === '--nova-refacao') a.novaRefacao = true;
    else if (k === '--guia-mestre') a.guiaMestre.push(String(argv[++i] || ''));
    else if (k === '--escolher') a.escolher.push(String(argv[++i] || ''));
    else if (k === '--motivo') a.motivo = argv[++i] == null ? '' : String(argv[i]);
    else if (k === '--teto') a.teto = Number(argv[++i]);
    else if (k === '--repetir') a.repetir = String(argv[++i] || '').split(',').filter(Boolean);
    else if (k === '--testar-crinas') a.testarCrinas = true;
    else if (k === '--forca') a.forca = Number(argv[++i]);
    else sair('argumento desconhecido: ' + k);
  }
  if (!['moldes', 'icones', 'icones2', 'tudo', 'portes'].includes(a.lote)) {
    sair('uso: node prototype/tools/pixellab-moldes.mjs --lote moldes|icones|icones2|tudo [--only <id>] [--teto 60] [--gerar]\n'
      + '     node prototype/tools/pixellab-moldes.mjs --lote portes --fase mestres|piloto|versoes [--only <porte>[-<estilo>]] [--teto 90] [--gerar]\n'
      + '       [--sem-guia <porte>-<estilo>]… [--guia-galope-mestre <porte>-<estilo>]… [--refazer <porte>-<estilo>:<etapa>[,<etapa>…]]… [--nova-refacao]\n'
      + '       [--guia-mestre <porte>-lisa=<porte>-lisa]… [--reprocessar [--manter-escolhas]]\n'
      + '     node prototype/tools/pixellab-moldes.mjs --lote portes --fase mestres|piloto|versoes --escolher <porte>-<estilo>:<etapa>=<seed>… --motivo "<texto>"');
  }
  if (a.teto == null) a.teto = a.lote === 'portes' ? TETO_PORTES : 60;
  if (!Number.isFinite(a.teto) || a.teto <= 0) sair('--teto precisa ser um número maior que zero');
  if (a.gerar && a.reprocessar) sair('--gerar e --reprocessar não andam juntos');
  if (a.lote === 'portes') {
    if (a.testarCrinas || a.forca != null) sair('--testar-crinas e --forca não valem no lote portes');
    a.semGuia = [...new Set(a.semGuia)]; a.guiaGalope = [...new Set(a.guiaGalope)];
    const erro = validarArgsPortes(a);
    if (erro) sair(erro);
    return a;
  }
  if (a.fase != null || a.semGuia.length || a.guiaGalope.length || a.refazer.length || a.novaRefacao || a.guiaMestre.length || a.escolher.length || a.motivo != null) {
    sair('--fase, --sem-guia, --guia-galope-mestre, --refazer, --nova-refacao, --guia-mestre, --escolher e --motivo só valem com --lote portes');
  }
  if (a.manterEscolhas) sair('--manter-escolhas só vale com --lote portes (o lote moldes não guarda escolhas para manter)');
  if (a.testarCrinas && (a.reprocessar || ['icones', 'icones2'].includes(a.lote) || a.repetir.length)) sair('--testar-crinas: só com --lote moldes|tudo, sem --reprocessar nem --repetir');
  if (a.forca != null && !a.testarCrinas) sair('--forca só vale com --testar-crinas');
  a.estilos = ['icones', 'icones2'].includes(a.lote) ? [] : ESTILOS.filter(e => !a.only || e.id === a.only);
  a.icones = a.lote === 'moldes' ? [] : ({ icones: ICONES, icones2: ICONES_NOVOS, tudo: [...ICONES, ...ICONES_NOVOS] })[a.lote].filter(ic => !a.only || ic.id === a.only);
  if (a.only && !a.estilos.length && !a.icones.length) sair(`--only ${a.only}: não existe no lote "${a.lote}"`);
  if (a.repetir.length > 2) sair('--repetir: no máximo 2 itens');
  const itens = [...ESTILOS.flatMap(e => [...posesDe(e), 'galope'].map(k => `${e.id}/${k}`)), ...ICONES.concat(ICONES_NOVOS).map(ic => `icone/${ic.id}`)];
  for (const r of a.repetir) if (!itens.includes(r)) sair(`--repetir ${r}: item desconhecido (ex.: lisa/parado, ondas/corrida, icone/aba-loja)`);
  REPETIR_EXTRA = a.repetir;
  if (a.testarCrinas) {
    a.icones = [];
    a.estilos = a.estilos.filter(e => e.testesCrina);
    if (!a.estilos.length) sair('--testar-crinas: nenhum estilo selecionado tem testesCrina');
  }
  return a;
}

// ---------------------------------------------------------------- registro em docs/memoria/assets.md
function registrarAsset(arquivos, endpoint, prompt, seedTexto, geracoes, emUso) {
  // --reprocessar não gera nada novo (só refaz os finais de raw/): o registro existente fica como está — senão
  // a linha voltaria para a data de hoje e para o "Em uso" fixo da geração
  if (estado.reprocessar) return;
  const linha = `| ${HOJE} | ${arquivos} | PixelLab API v2 ${endpoint} | ${prompt}; ${seedTexto} | ${fmt(geracoes)} ${geracoes === 1 ? 'geração' : 'gerações'} da cota | ${emUso} |`;
  const linhas = fs.readFileSync(ARQ_ASSETS, 'utf8').split('\n');
  // mesmo(s) arquivo(s) já registrado(s) (lote repetido ou retomado): substitui a linha
  const igual = linhas.findIndex(l => l.startsWith('|') && (l.split('|')[2] || '').trim() === arquivos);
  if (igual >= 0) { linhas[igual] = linha; fs.writeFileSync(ARQ_ASSETS, linhas.join('\n')); return; }
  // entra na tabela existente, antes da linha fixa "| — |" (sprites por código); senão no fim da tabela
  let pos = linhas.findIndex(l => l.startsWith('| — |'));
  if (pos < 0) pos = linhas.reduce((u, l, i) => (l.startsWith('|') ? i : u), -1) + 1;
  linhas.splice(pos, 0, linha);
  fs.writeFileSync(ARQ_ASSETS, linhas.join('\n'));
}

// ---------------------------------------------------------------- dry-run
// 1ª seed que o lote real usaria, sem rede: pula as com erro registrado ou rejeitadas à mão e, quando a imagem
// crua já existe, também as que a pré-checagem (validar + aceite) reprova — como o lote real faria.
// Devolve "cru" (e as imagens) se a seed escolhida já tiver a imagem em raw/.
function seedPlanejada(dir, prefixo, seedBase, pedidoDe, rotulo, { varios = false, checar = null, tentativas = null } = {}) {
  for (let k = 0; k < (tentativas ?? MAX_REPETICOES + 1 + (REPETIR_EXTRA.includes(rotulo) ? 1 : 0)); k++) {
    const seed = seedBase + PASSO_SEED * k, corpo = pedidoDe(seed), base = `${prefixo}-s${seed}`, reg = lerCru(dir, base, corpo);
    if (reg && (reg.erro || reg.rejeitada)) continue;
    const bufs = reg && pngsCrus(dir, base, varios);
    if (bufs && checar && !checar(bufs).ok) continue;
    return { seed, corpo, cru: !!bufs, bufs };
  }
  return { seed: seedBase, corpo: pedidoDe(seedBase), cru: false, bufs: null };
}
function planoEstilo(e) {
  const plano = posesDe(e).map(p => {
    const s = seedPlanejada(DIR_MOLDES_RAW, prefixoPose(e, p), seedBaseDe(e, p), seed => pedidoPose(e, p, seed), `${e.id}/${p}`,
      { checar: bufs => checarPose(e, p, bufs[0], `${e.id}/${p}`) });
    const guia = p === 'corrida' ? ` [init_image = raw/${GUIA_CORRIDA}; init_image_strength ${e.corrida.forca}]` : '';
    return { item: `${e.id}/${p}`, endpoint: PIXFLUX, seed: s.seed, texto: s.corpo.description + guia, cru: s.cru, bufs: s.bufs };
  });
  const montado = plano[plano.length - 1], rotulo = `${e.id}/galope`, sufixo = `[first_frame = ${montado.item} seed ${montado.seed}; frame_count 8; drift_threshold 0]`;
  if (!montado.cru) {
    plano.push({ item: rotulo, endpoint: ANIMA, seed: seedBaseDe(e, 'galope'), texto: `${acaoDe(e)} ${sufixo}`, cru: false });
  } else { // montado já em raw/: o galope dele pode estar em raw/ também
    const s = seedPlanejada(DIR_MOLDES_RAW, prefixoGalope(e, montado.seed), seedBaseDe(e, 'galope'), seed => pedidoGalope(montado.bufs[0], seed, acaoDe(e)), rotulo,
      { varios: true, checar: bufs => checarGalope(e, bufs, rotulo) });
    plano.push({ item: rotulo, endpoint: ANIMA, seed: s.seed, texto: `${acaoDe(e)} ${sufixo}`, cru: s.cru });
  }
  return plano;
}
// rodada de crinas: uma tentativa por etapa e por variante; o galope só existe se a corrida passar
function planoTesteCrina(e, forca) {
  const plano = [];
  for (const v of e.testesCrina.filter(x => forca == null || x.forca === forca)) {
    const ev = { ...e, corrida: v }, rot = `${e.id}/corrida-f${v.forca}`;
    const c = seedPlanejada(DIR_MOLDES_RAW, prefixoPose(ev, 'corrida'), v.seed, seed => pedidoPose(ev, 'corrida', seed), rot,
      { tentativas: 1, checar: bufs => checarPose(ev, 'corrida', bufs[0], rot) });
    const cruOk = c.cru || !!(lerCru(DIR_MOLDES_RAW, `${prefixoPose(ev, 'corrida')}-s${v.seed}`, c.corpo));
    plano.push({ item: rot, endpoint: PIXFLUX, seed: v.seed, texto: `${c.corpo.description} [init_image = raw/${GUIA_CORRIDA}; init_image_strength ${v.forca}]`, cru: c.cru || cruOk });
    if (cruOk && !c.cru) continue; // já gerada e reprovada (ou com erro): sem galope
    const rg = `${e.id}/galope-f${v.forca}`, sufixo = `[first_frame = ${rot} seed ${v.seed}; só se a corrida passar na pré-checagem]`;
    if (!c.cru) { plano.push({ item: rg, endpoint: ANIMA, seed: v.seed, texto: `${ACAO_CORRIDA} ${sufixo}`, cru: false }); continue; }
    const g = seedPlanejada(DIR_MOLDES_RAW, prefixoGalope(ev, v.seed), v.seed, seed => pedidoGalope(c.bufs[0], seed, ACAO_CORRIDA), rg,
      { varios: true, tentativas: 1 });
    plano.push({ item: rg, endpoint: ANIMA, seed: v.seed, texto: `${ACAO_CORRIDA} ${sufixo}`, cru: g.cru || !!lerCru(DIR_MOLDES_RAW, `${prefixoGalope(ev, v.seed)}-s${v.seed}`, g.corpo) });
  }
  return plano;
}
function planoIcone(ic) {
  const s = seedPlanejada(DIR_ICONES_RAW, ic.id, ic.seed, seed => pedidoIcone(ic, seed), `icone/${ic.id}`);
  return { item: `icone/${ic.id}`, endpoint: PIXFLUX, seed: s.seed, texto: `${s.corpo.description} [32×32; paleta ${coresIcone(ic).join(' ')}]`, cru: s.cru };
}

function dryRun(a) {
  const plano = a.testarCrinas ? a.estilos.flatMap(e => planoTesteCrina(e, a.forca))
    : [...a.estilos.flatMap(planoEstilo), ...a.icones.map(planoIcone)];
  console.log(`DRY-RUN (sem --gerar): nenhuma chamada à API. Lote "${a.lote}"${a.only ? ` (--only ${a.only})` : ''}${a.testarCrinas ? `; rodada de crinas${a.forca != null ? ` (força ${a.forca})` : ''}` : ''}; teto ${a.teto} gerações.`);
  console.log('Estimativa: 1 geração por chamada (custo observado). Só os itens NOVOS aparecem em detalhe; os que já');
  console.log('têm imagem crua em raw/ com o mesmo pedido (e passam na pré-checagem) são reaproveitados sem custo.');
  console.log(a.testarCrinas ? 'Rodada de crinas: uma tentativa por etapa; o galope só é pedido se a corrida passar (a previsão conta o máximo).\n'
    : 'Repetições (até 2 por item) não entram na previsão.\n');
  let total = 0, n = 0;
  const crus = [];
  for (const [i, c] of plano.entries()) {
    if (c.cru) { crus.push(`${c.item} (seed ${c.seed})`); continue; }
    if (total + 1 > a.teto) {
      console.log(`AVISO: o teto de ${a.teto} gerações cortou os itens novos a partir de ${c.item} (${plano.slice(i).filter(x => !x.cru).length} sem previsão).`);
      break;
    }
    total++; n++;
    console.log(`${String(n).padStart(3)}. POST ${c.endpoint.padEnd(22)} ${c.item.padEnd(24)} seed ${c.seed}  ~1 geração`);
    console.log(`       ${c.texto}`);
  }
  console.log(`\nReaproveitados de raw/ (0 geração): ${crus.length ? crus.join(', ') : 'nenhum'}.`);
  console.log(`\nTotal previsto: ${total} gerações em ${n} chamadas novas (+ ${crus.length} reaproveitadas de raw/; teto ${a.teto}).`);
}

// ---------------------------------------------------------------- teto (orçamento do lote; API e pago() no pixellab-comum.mjs)
const orc = criarOrcamento(60);

// ---------------------------------------------------------------- itens e repetições
const ITENS = [];
function novoItem(rotulo, seedBase, tentativas = null) {
  // geracoes: gastas neste lote; anteriores: de imagens cruas reaproveitadas (gastas antes)
  const extra = REPETIR_EXTRA.includes(rotulo) ? 1 : 0;
  const it = { rotulo, seedBase, seeds: [], geracoes: 0, anteriores: 0, reaproveitadas: [], rejeicoes: [], extra, tentativas: tentativas ?? MAX_REPETICOES + 1 + extra };
  ITENS.push(it);
  return it;
}
// próxima seed do item (base, base + 10, base + 20 [, base + 30 com --repetir]) ou null quando acabaram
function proximaSeed(it) {
  if (it.seeds.length >= it.tentativas) return null;
  const s = it.seedBase + PASSO_SEED * it.seeds.length;
  it.seeds.push(s);
  return s;
}
function rejeitar(it, seed, motivo) {
  it.rejeicoes.push(`seed ${seed}: ${motivo}`);
  console.log(`    REJEITADO ${it.rotulo} seed ${seed}: ${motivo}`);
}
function reaproveitar(it, seed, reg) {
  const g = geracoesDe(reg.resposta, reg.resposta && reg.resposta.job) ?? 1;
  it.anteriores += g; it.reaproveitadas.push(seed);
  console.log(`    ${it.rotulo}: reaproveitada a imagem crua da seed ${seed} (mesmo pedido; ${fmt(g)} geração gasta antes)`);
}
// seed com erro de API (não cobrada) ou rejeitada na conferência visual (cobrada: entra no custo da linha)
function pular(it, seed, reg) {
  if (reg.rejeitada) it.anteriores += geracoesDe(reg.resposta, reg.resposta && reg.resposta.job) ?? 1;
  rejeitar(it, seed, reg.erro ? `erro registrado em lote anterior: ${reg.erro}` : `rejeitada na conferência visual: ${reg.rejeitada}`);
}
const ultimaSeed = it => it.seeds[it.seeds.length - 1];
const custoTotal = it => it.geracoes + it.anteriores;
function seedTxt(it) {
  const rej = it.seeds.slice(0, -1), s = ultimaSeed(it);
  return `seed ${s}${it.reaproveitadas.includes(s) ? ' (imagem crua de rodada anterior, reaproveitada)' : ''}`
    + (rej.length ? ` (repetição; rejeitada${rej.length > 1 ? 's' : ''}: ${rej.join(', ')})` : '');
}

// ---------------------------------------------------------------- aceite do galope de corrida (spec 2026-11-09 §4)
// Referência: o galope final de chamas. Galope: maior passada ≥ 80 % da maior de chamas; altura do contorno
// de cada quadro ≤ 110 % da altura média de chamas; e o focinho não deriva mais de 6 px (o mesmo que o
// moldes-test confere). Corrida (montado, 1 quadro): altura ≤ 110 % da média e passada ≥ 80 % da passada do
// quadro-guia (o 1º de chamas) — a guia, que é corrida por definição, tem de passar no próprio filtro.
const ACEITE = { passada: 0.8, altura: 1.1, derivaFocinho: 6 };
let REF_CORRIDA = null;
function referenciaCorrida() {
  if (REF_CORRIDA) return REF_CORRIDA;
  const arq = path.join(DIR_MOLDES, 'molde-chamas.json');
  if (!fs.existsSync(arq)) throw new ErroApi('aceite da corrida: falta o molde de chamas (a referência)', { fatal: true });
  const J = JSON.parse(fs.readFileSync(arq, 'utf8'));
  const qs = Array.from({ length: J.frames }, (_, i) => {
    const d = decodePng(fs.readFileSync(path.join(DIR_MOLDES, `molde-chamas-galope-${i}.png`)));
    return deCinza(Uint8Array.from({ length: LADO * LADO }, (_, k) => d.rgba[k * 4]));
  });
  const ps = qs.map(q => passada(q, LADO, LADO)), hs = qs.map(q => ancoras(q, LADO, LADO).bbox.h);
  REF_CORRIDA = { passadaMax: Math.max(...ps), passadaGuia: ps[0], alturaMedia: hs.reduce((s, v) => s + v, 0) / hs.length };
  return REF_CORRIDA;
}
const medidas = qs => ({ passadas: qs.map(q => passada(q.idx, LADO, LADO)), alturas: qs.map(q => ancoras(q.idx, LADO, LADO).bbox.h) });
function aceiteCorrida(q) {
  const r = referenciaCorrida(), { passadas: [p], alturas: [h] } = medidas([q]);
  const minP = ACEITE.passada * r.passadaGuia, maxH = ACEITE.altura * r.alturaMedia;
  const txt = `passada ${p} (mín. ${fmt(minP)}), altura ${h} (máx. ${fmt(maxH)})`;
  if (h > maxH) return { ok: false, motivo: `aceite da corrida: corpo alto — ${txt}` };
  if (p < minP) return { ok: false, motivo: `aceite da corrida: patas recolhidas — ${txt}` };
  return { ok: true, txt };
}
function aceiteGalope(qs) {
  const r = referenciaCorrida(), m = medidas(qs);
  const minP = ACEITE.passada * r.passadaMax, maxH = ACEITE.altura * r.alturaMedia;
  const nx = qs.map(q => ancoras(q.idx, LADO, LADO).nose[0]), deriva = Math.max(...nx.map(x => Math.abs(x - nx[0])));
  const txt = `passadas ${m.passadas.join(' ')} (maior ${Math.max(...m.passadas)}, mín. ${fmt(minP)}); alturas ${m.alturas.join(' ')} (máx. ${fmt(maxH)}); focinho deriva ${deriva} px (máx. ${ACEITE.derivaFocinho})`;
  const altos = m.alturas.map((h, i) => (h > maxH ? `galope-${i}` : null)).filter(Boolean);
  if (Math.max(...m.passadas) < minP) return { ok: false, motivo: `aceite do galope: passada curta — ${txt}` };
  if (altos.length) return { ok: false, motivo: `aceite do galope: corpo alto em ${altos.join(', ')} — ${txt}` };
  if (deriva > ACEITE.derivaFocinho) return { ok: false, motivo: `aceite do galope: focinho deriva — ${txt}` };
  return { ok: true, txt };
}
// pré-checagem completa de um item (validar + aceite da corrida, quando o estilo tem corrida)
function checarPose(estilo, pose, buf, rotulo) {
  const v = preChecar([buf], pose !== 'retrato', rotulo, pose === 'montado' || pose === 'corrida');
  return v.ok && pose === 'corrida' ? aceiteCorrida(v.quadros[0]) : v;
}
function checarGalope(estilo, bufs, rotulo) {
  if (bufs.length !== 9 && bufs.length !== 8) return { ok: false, motivo: `veio com ${bufs.length} quadros (esperado 9, ou 8)` };
  const v = preChecar(bufs, true, rotulo, true);
  return v.ok && estilo.corrida ? aceiteGalope(v.quadros) : v;
}

// ---------------------------------------------------------------- moldes
async function gerarPose(estilo, pose, it) {
  for (let seed; (seed = proximaSeed(it)) != null;) {
    console.log(`  ${it.rotulo} seed ${seed}${pose === 'corrida' ? ` (init_image raw/${GUIA_CORRIDA}, força ${estilo.corrida.forca})` : ''}`);
    const corpo = pedidoPose(estilo, pose, seed), base = `${prefixoPose(estilo, pose)}-s${seed}`;
    const reg = lerCru(DIR_MOLDES_RAW, base, corpo), crus = reg && pngsCrus(DIR_MOLDES_RAW, base, false);
    if (reg && (reg.erro || reg.rejeitada)) { pular(it, seed, reg); continue; }
    let buf;
    if (crus) {
      reaproveitar(it, seed, reg); buf = crus[0]; it.data = reg.data;
    } else {
      let resp;
      try {
        resp = await pago(orc, PIXFLUX, it, () => executarReal(PIXFLUX, corpo));
      } catch (e) {
        if (recuperavel(e)) { gravarErro(DIR_MOLDES_RAW, base, PIXFLUX, corpo, e); rejeitar(it, seed, e.message); continue; }
        throw e;
      }
      buf = bufDe(resp.image, it.rotulo);
      gravarCru(DIR_MOLDES_RAW, base, PIXFLUX, corpo, resp, [[base + '.png', buf]]);
      it.data = new Date().toISOString();
    }
    const v = checarPose(estilo, pose, buf, it.rotulo);
    if (v.ok) { if (v.txt) { it.aceite = v.txt; console.log(`    aceite ok: ${v.txt}`); } return buf; }
    rejeitar(it, seed, v.motivo);
  }
  return null;
}

async function gerarGalope(estilo, it, montado, seedMontado) {
  for (let seed; (seed = proximaSeed(it)) != null;) {
    console.log(`  ${it.rotulo} seed ${seed} (montado ${seedMontado}; job assíncrono; pode levar minutos)`);
    const corpo = pedidoGalope(montado, seed, acaoDe(estilo)), base = `${prefixoGalope(estilo, seedMontado)}-s${seed}`;
    const reg = lerCru(DIR_MOLDES_RAW, base, corpo);
    if (reg && (reg.erro || reg.rejeitada)) { pular(it, seed, reg); continue; }
    let bufs = reg && pngsCrus(DIR_MOLDES_RAW, base, true);
    if (bufs) {
      reaproveitar(it, seed, reg); it.data = reg.data;
    } else {
      let r;
      try {
        r = await pago(orc, ANIMA, it, () => executarReal(ANIMA, corpo));
      } catch (e) {
        if (recuperavel(e)) { gravarErro(DIR_MOLDES_RAW, base, ANIMA, corpo, e); rejeitar(it, seed, e.message); continue; }
        throw e;
      }
      bufs = quadrosDoJob(r.job).map((img, i) => bufDe(img, `${it.rotulo} quadro ${i}`));
      // pedido refeito com o mesmo nome: apaga os quadros antigos para não misturar 8 com 9
      apagarQuadrosCrus(DIR_MOLDES_RAW, base);
      gravarCru(DIR_MOLDES_RAW, base, ANIMA, corpo, r, bufs.map((b, i) => [`${base}-${i}.png`, b]));
      it.data = new Date().toISOString();
    }
    if (bufs.length !== 9 && bufs.length !== 8) {
      throw new ErroApi(`${it.rotulo}: veio com ${bufs.length} quadros (esperado 9, ou 8)`, { fatal: true });
    }
    if (bufs.length === 8) console.log(`    AVISO ${it.rotulo}: vieram 8 quadros (não 9); usando 8`);
    const v = checarGalope(estilo, bufs, it.rotulo);
    if (v.ok) { if (v.txt) { it.aceite = v.txt; console.log(`    aceite ok: ${v.txt}`); } return bufs; }
    rejeitar(it, seed, v.motivo);
  }
  return null;
}

async function gerarEstilo(estilo) {
  const poseM = poseMontada(estilo);
  console.log(`\n== Molde ${estilo.id} (seed base ${estilo.seed}${estilo.corrida ? `; corrida e galope ${estilo.corrida.seed}` : ''}) ==`);
  const it = {};
  for (const k of [...posesDe(estilo), 'galope']) it[k] = novoItem(`${estilo.id}/${k}`, seedBaseDe(estilo, k));
  const falhou = motivo => { console.log(`  FALHOU ${estilo.id}: ${motivo} — nada gravado como final (crus em raw/)`); return { estilo: estilo.id, ok: false, motivo }; };

  const fontes = {};
  for (const pose of posesDe(estilo)) {
    fontes[pose] = await gerarPose(estilo, pose, it[pose]);
    if (!fontes[pose]) return falhou(`${pose} rejeitado em todas as tentativas`);
  }
  const galope = await gerarGalope(estilo, it.galope, fontes[poseM], ultimaSeed(it[poseM]));
  if (!galope) return falhou('galope rejeitado em todas as tentativas');

  // finais: limiares por geração (retrato, parado, galope) e contorno só no galope — o mesmo que a
  // pré-checagem de cada item já validou, então aqui um quadro inválido seria erro do script
  const fm = quadrosDoMolde(fontes.retrato, fontes.parado, galope);
  if (fm.invalidos.length) return falhou('inconsistência entre pré-checagem e finais: ' + fm.invalidos.map(([n, v]) => `${n}: ${v.motivo}`).join('; '));
  const { nomes, tons } = fm;

  // data da geração = a da imagem crua mais nova usada (refazer de raw/ não muda o JSON)
  const gerado = Object.values(it).map(x => x.data || '').reduce((a, b) => (b > a ? b : a), '').slice(0, 10) || HOJE;
  const { mudou, galopeMudou, json } = gravarMolde(DIR_MOLDES, estilo.id, fm, {
    seeds: { retrato: ultimaSeed(it.retrato), parado: ultimaSeed(it.parado), montado: ultimaSeed(it[poseM]), galope: ultimaSeed(it.galope) },
    extra: estilo.corrida ? { corrida: { guia: `raw/${GUIA_CORRIDA}`, init_image_strength: estilo.corrida.forca } } : {},
    gerado,
  });

  const pre = `prototype/assets/pixellab/molde-${estilo.id}`, crina = `crina "${estilo.crina}"`, uso = 'Sim';
  const proc = 'cores de papel pedidas por texto (pelo #ff0000, crina #00ff00 …; sem paleta forçada); papéis por família de cor + Otsu do estilo';
  const reforco = estilo.montado ? `, reforço "${estilo.montado.reforco}"` : '';
  if (mudou.retrato) registrarAsset(`\`${pre}-retrato.png\``, '`create-image-pixflux`',
    `retrato 64×64: cavalo parado sem jóquei nem sela, ${crina}, ${proc}`, seedTxt(it.retrato), custoTotal(it.retrato), uso);
  if (mudou.parado) registrarAsset(`\`${pre}-parado.png\``, '`create-image-pixflux`',
    `parado 64×64: cavalo parado com jóquei (seda e capacete #ffff00, pele #ffc0cb, sela e manta #808080), ${crina}, ${proc}`,
    seedTxt(it.parado), custoTotal(it.parado), uso);
  const montadoTxt = estilo.corrida
    ? `corrida (pose de corrida guiada pelo 1º quadro cru do galope de chamas, init_image raw/${GUIA_CORRIDA}, init_image_strength ${estilo.corrida.forca}; "${POSES.corrida}", ${crina}${reforco}; ${seedTxt(it[poseM])}; aceite ${it[poseM].aceite})`
    : `montado (meio da passada, com jóquei, ${crina}${reforco}; ${seedTxt(it[poseM])})`;
  if (galopeMudou) registrarAsset(`\`${pre}-galope-0..${galope.length - 1}.png\` e \`${pre}.json\``, '`create-image-pixflux` + `animate-with-text-v3`',
    `${montadoTxt} animado com "${acaoDe(estilo)}", frame_count 8 (${galope.length} quadros recebidos), drift_threshold 0`,
    `galope ${seedTxt(it.galope)}${it.galope.aceite ? `; aceite ${it.galope.aceite}` : ''}`, custoTotal(it[poseM]) + custoTotal(it.galope), uso);

  const t = (g, k) => `${k} ${tons[g][k].procedural ? 'procedural' : tons[g][k].limiar}`;
  console.log(`  OK ${estilo.id}: ${nomes.length} quadros (${galope.length} de galope), larguraUtil ${json.larguraUtil}, footY ${json.footY}; `
    + ['retrato', 'parado', 'galope'].map(g => `${g}: ${t(g, 'pelagem')}, ${t(g, 'crina')}`).join(' | ')
    + `; finais que mudaram: ${[mudou.retrato && 'retrato', mudou.parado && 'parado', galopeMudou && 'galope/json'].filter(Boolean).join(', ') || 'nenhum'}`);
  return { estilo: estilo.id, ok: true, frames: galope.length, aceite: it.galope.aceite };
}

// Rodada de crinas: cada variante com UMA tentativa de corrida e, se ela passar na pré-checagem (validar +
// aceite da pose), UMA de galope (validar + aceite). Grava só em raw/: a comparação da crina é visual, e a
// variante escolhida vira o `corrida` do estilo (os finais saem num --gerar normal, reaproveitando raw/).
async function testarCrinas(estilo, forca) {
  const res = [];
  for (const v of estilo.testesCrina.filter(x => forca == null || x.forca === forca)) {
    const ev = { ...estilo, corrida: v };
    console.log(`\n== Crina ${estilo.id}, força ${v.forca} (seed ${v.seed}; crina reforçada no texto) ==`);
    const itC = novoItem(`${estilo.id}/corrida-f${v.forca}`, v.seed, 1), itG = novoItem(`${estilo.id}/galope-f${v.forca}`, v.seed, 1);
    const montado = await gerarPose(ev, 'corrida', itC);
    const base = { estilo: estilo.id, forca: v.forca, seed: v.seed };
    if (!montado) { res.push({ ...base, ok: false, motivo: 'corrida reprovada (sem galope)' }); continue; }
    const galope = await gerarGalope(ev, itG, montado, v.seed);
    res.push(galope ? { ...base, ok: true, aceite: itG.aceite } : { ...base, ok: false, motivo: 'galope reprovado' });
  }
  for (const r of res) console.log(`  ${r.ok ? 'PASSOU' : 'REPROVOU'} ${r.estilo} força ${r.forca} seed ${r.seed}: ${r.ok ? r.aceite : r.motivo}`);
  return res;
}

// ---------------------------------------------------------------- ícones
async function gerarIcone(ic) {
  console.log(`\n== Ícone ${ic.id} ==`);
  const it = novoItem(`icone/${ic.id}`, ic.seed);
  for (let seed; (seed = proximaSeed(it)) != null;) {
    console.log(`  ${it.rotulo} seed ${seed}`);
    const corpo = pedidoIcone(ic, seed), base = `${ic.id}-s${seed}`;
    const reg = lerCru(DIR_ICONES_RAW, base, corpo), crus = reg && pngsCrus(DIR_ICONES_RAW, base, false);
    if (reg && (reg.erro || reg.rejeitada)) { pular(it, seed, reg); continue; }
    let buf;
    if (crus) {
      reaproveitar(it, seed, reg); buf = crus[0];
    } else {
      let resp;
      try {
        resp = await pago(orc, PIXFLUX, it, () => executarReal(PIXFLUX, corpo));
      } catch (e) {
        if (recuperavel(e)) { gravarErro(DIR_ICONES_RAW, base, PIXFLUX, corpo, e); rejeitar(it, seed, e.message); continue; }
        throw e;
      }
      buf = bufDe(resp.image, it.rotulo);
      gravarCru(DIR_ICONES_RAW, base, PIXFLUX, corpo, resp, [[base + '.png', buf]]);
    }
    const d = decodePng(buf);
    if (d.width !== 32 || d.height !== 32) throw new ErroApi(`${it.rotulo}: imagem ${d.width}×${d.height}, esperado 32×32`, { fatal: true });
    let opacos = 0;
    for (let i = 3; i < d.rgba.length; i += 4) if (d.rgba[i] >= 128) opacos++;
    if (!opacos) { rejeitar(it, seed, 'ícone vazio (nenhum pixel opaco)'); continue; }
    fs.mkdirSync(DIR_ICONES, { recursive: true });
    const mudou = gravarFinal(path.join(DIR_ICONES, `${ic.id}.png`), encodePng(d));
    if (mudou) registrarAsset(`\`prototype/assets/icons/${ic.id}.png\``, '`create-image-pixflux`',
      `ícone 32×32 "${ic.desc}, ${SUFIXO_ICONE}", contorno preto, color_image = ${coresIcone(ic).join(' ')}`,
      seedTxt(it), custoTotal(it), 'Sim');
    console.log(`  OK ${ic.id}: ${opacos} pixels opacos${mudou ? '' : ' (final igual ao que já estava)'}`);
    return { icone: ic.id, ok: true };
  }
  console.log(`  FALHOU ${ic.id}: rejeitado em todas as tentativas`);
  return { icone: ic.id, ok: false };
}

// ---------------------------------------------------------------- principal

async function gerar(a) {
  estado.reprocessar = a.reprocessar;
  estado.redeLiberada = !a.reprocessar;
  const REPROCESSAR = a.reprocessar;
  orc.teto = a.teto;
  fs.mkdirSync(DIR_MOLDES, { recursive: true });
  console.log(`${REPROCESSAR ? 'REPROCESSAMENTO a partir de raw/ (sem rede)' : 'GERAÇÃO REAL'} — lote "${a.lote}"${a.only ? ` (--only ${a.only})` : ''}; teto ${a.teto} gerações.`);
  const antes = REPROCESSAR ? null : await saldo('antes');
  const disponivel = antes && antes.subscription && antes.subscription.generations;
  if (!REPROCESSAR && !(disponivel >= a.teto)) {
    throw new ErroApi(`saldo do plano (${disponivel}) menor que o teto (${a.teto}): o resto sairia dos créditos em US$; abortado`, { fatal: true });
  }

  const resultados = [];
  let parada = null;
  try {
    if (a.testarCrinas) for (const e of a.estilos) for (const r of await testarCrinas(e, a.forca)) resultados.push({ ...r, teste: true });
    else {
      for (const e of a.estilos) resultados.push(await gerarEstilo(e));
      for (const ic of a.icones) resultados.push(await gerarIcone(ic));
    }
  } catch (e) {
    parada = e instanceof TetoAtingido ? `TETO: ${e.message}` : `ERRO FATAL: ${e instanceof ErroApi ? e.message : e.stack}`;
    console.log('\n' + parada);
  }

  console.log('\n== Resumo ==');
  for (const it of ITENS) {
    if (!it.seeds.length) continue;
    const reap = it.reaproveitadas.length ? `; reaproveitada(s) ${it.reaproveitadas.join(', ')} (${fmt(it.anteriores)} ger. anteriores)` : '';
    console.log(`  ${it.rotulo.padEnd(26)} ${fmt(it.geracoes)} ger.  seeds ${it.seeds.join(', ')}${reap}${it.rejeicoes.length ? `\n      rejeições: ${it.rejeicoes.join(' | ')}` : ''}`);
  }
  const moldes = resultados.filter(r => r.estilo && !r.teste);
  if (moldes.length) console.log('  Quadros de galope: ' + moldes.map(r => `${r.estilo} ${r.ok ? r.frames : 'falhou'}`).join(', '));
  if (moldes.some(r => r.aceite)) {
    const ref = referenciaCorrida();
    console.log(`  Aceite da corrida (chamas: maior passada ${ref.passadaMax}, passada da guia ${ref.passadaGuia}, altura média ${fmt(ref.alturaMedia)}):`);
    for (const r of moldes) if (r.aceite) console.log(`    ${r.estilo}: ${r.aceite}`);
  }
  const falhas = resultados.filter(r => !r.ok);
  console.log(`  Itens finais: ${resultados.length - falhas.length} ok, ${falhas.length} com falha${parada ? '; lote interrompido' : ''}`);
  console.log(`  Gerações gastas neste lote (soma do usage): ${fmt(orc.gasto)} de teto ${a.teto}, em ${orc.chamadas} chamadas pagas`);
  if (REPROCESSAR) return parada || falhas.length ? 1 : 0;
  try {
    const depois = await saldo('depois');
    const queda = antes.subscription.generations - depois.subscription.generations;
    console.log(`  Queda do saldo: ${fmt(queda)} gerações${Math.abs(queda - orc.gasto) > 1e-6 ? ` (ATENÇÃO: difere da soma do usage, ${fmt(orc.gasto)})` : ' (confere com a soma do usage)'}`);
  } catch (e) {
    console.log('  Saldo depois: indisponível (' + e.message + ')');
  }
  return parada || falhas.length ? 1 : 0;
}

// Lote portes (pixellab-portes.mjs): a mesma rede, o mesmo saldo e o mesmo pago() dos outros lotes; o teto é o do
// lote todo, somado entre rodadas em novos/gasto.json, e o saldo do plano tem de cobrir o que sobra dele.
async function gerarPortes(a) {
  estado.reprocessar = a.reprocessar;
  estado.redeLiberada = !a.reprocessar;
  // gasto.json ilegível: o --gerar para aqui, antes do saldo e de qualquer chamada (lerGasto lança); o --reprocessar não
  // paga nem grava o gasto, então segue com o aviso
  let gastoAntes = null;
  try { gastoAntes = lerGasto().geracoes; } catch (e) { if (!a.reprocessar) throw e; console.log('AVISO: ' + e.message); }
  const sobra = gastoAntes == null ? null : a.teto - gastoAntes;
  console.log(`${a.reprocessar ? 'REPROCESSAMENTO a partir de raw/ (sem rede)' : 'GERAÇÃO REAL'} — lote "portes", fase "${a.fase}"${a.only ? ` (--only ${a.only})` : ''}; teto ${a.teto} gerações no lote todo (já gastas ${gastoAntes == null ? '?' : fmt(gastoAntes)}, sobram ${sobra == null ? '?' : fmt(sobra)}).`);
  let antes = null;
  if (!a.reprocessar) {
    antes = await saldo('antes');
    const disponivel = antes.subscription && antes.subscription.generations;
    if (!(disponivel >= sobra)) {
      throw new ErroApi(`saldo do plano (${disponivel}) menor que o que sobra do teto (${fmt(sobra)}): o resto sairia dos créditos em US$; abortado`, { fatal: true });
    }
  }
  const r = await rodarPortes({ fase: a.fase, only: a.only, teto: a.teto, repetir: a.repetir, semGuia: a.semGuia, guiaGalope: a.guiaGalope, refazer: a.refazer, novaRefacao: a.novaRefacao, guiaMestre: a.guiaMestre, modo: a.reprocessar ? 'reprocessar' : 'gerar', executar: executarReal, manterEscolhas: a.manterEscolhas });
  if (!a.reprocessar) {
    try {
      const depois = await saldo('depois');
      const queda = antes.subscription.generations - depois.subscription.generations;
      console.log(`  Queda do saldo: ${fmt(queda)} gerações${Math.abs(queda - r.gasto) > 1e-6 ? ` (ATENÇÃO: difere da soma do usage, ${fmt(r.gasto)})` : ' (confere com a soma do usage)'}`);
    } catch (e) {
      console.log('  Saldo depois: indisponível (' + e.message + ')');
    }
  }
  // 1 só quando a rodada parou ou deixou item incompleto; reprovado num critério sai 0 (vai para a folha)
  const codigo = codigoSaidaPortes(r);
  console.log(codigo ? `\nSaída 1: ${r.parada ? 'a rodada parou' : `${r.incompletos} item(ns) incompleto(s)`}.`
    : `\nSaída 0: rodada completa${r.falhas ? `; ${r.falhas} item(ns) reprovado(s) num critério, para a folha (ver o Resumo)` : ''}.`);
  return codigo;
}

// --escolher (lote portes): escolha manual de tentativas já pagas — sem rede (nem /balance) e sem custo: só lê raw/ e
// regrava novos/ (o molde e o criterios.json). A rede continua desligada (estado.redeLiberada fica false).
async function escolherPortes(a) {
  console.log(`ESCOLHA MANUAL (sem rede e sem custo: só os crus de raw/) — lote "portes", fase "${a.fase}": ${a.escolher.join(', ')}; motivo: ${a.motivo}`);
  const r = await rodarPortes({ fase: a.fase, semGuia: a.semGuia, guiaGalope: a.guiaGalope, escolher: a.escolher, motivo: a.motivo, modo: 'escolher' });
  const codigo = r.naoGravados.length ? 1 : codigoSaidaPortes(r);
  console.log(codigo ? `\nSaída 1: ${r.parada ? 'a rodada parou' : r.naoGravados.length ? `${r.naoGravados.join(', ')} não gravado(s)` : `${r.incompletos} item(ns) incompleto(s)`}.`
    : `\nSaída 0: escolha gravada em novos/ (criterios.json e o molde)${r.falhas ? `; ${r.falhas} item(ns) ainda reprovado(s) em outro critério (ver o Resumo)` : ''}.`);
  return codigo;
}

const args = lerArgs(process.argv.slice(2));
if (args.lote === 'portes') {
  try {
    if (args.escolher.length) process.exitCode = await escolherPortes(args);
    else if (!args.gerar && !args.reprocessar) await dryRunPortes(args);
    else process.exitCode = await gerarPortes(args);
  } catch (e) {
    console.error('ERRO: ' + (e instanceof ErroApi ? e.message : e.stack));
    process.exitCode = 1;
  }
} else if (!args.gerar && !args.reprocessar) {
  dryRun(args);
} else {
  try {
    process.exitCode = await gerar(args);
  } catch (e) {
    console.error('ERRO: ' + (e instanceof ErroApi ? e.message : e.stack));
    process.exitCode = 1;
  }
}
