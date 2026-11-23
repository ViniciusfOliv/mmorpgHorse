// prototype/tools/pixellab-treinadores.mjs — a arte dos oponentes dos ginásios (a tela de desafio antes de cada duelo,
// a "Cena 2" que o Vinicius escolheu em 2026-11-18): uma figura de corpo inteiro, 64×64, sem fundo, em pé, virada
// para a esquerda (para o cavalo do jogador). O cavalo do oponente NÃO sai daqui: é o cavalo de verdade do ginásio,
// desenhado pelos moldes do jogo.
//
// Uso:  NODE_USE_ENV_PROXY=1 node prototype/tools/pixellab-treinadores.mjs [--lote piloto|lideres|soldados|resto] [--teto N] [--gerar]
//   Sem --gerar é SEMPRE dry-run: lista as chamadas (endpoint, item, seed, prompt) e o total, sem rede.
//   --teto N  máximo de gerações no lote (padrão: o lote inteiro, 1 por variação). Para ANTES de uma chamada que passaria do teto.
//   Com --gerar, confere o saldo do plano (o teto tem de caber nele: nada sai dos créditos em US$) e aborta se uma
//   resposta cobrar em US$ (o pago() do pixellab-comum.mjs).
//   Imagem já gerada com o mesmo pedido (raw/treinadores/<id>-s<seed>.json) é reaproveitada sem rede e sem custo.
//
// Lotes: `piloto` = só a Capitã Labareda (líder da Fornalha), 4 variações (2 de três-quartos, 2 de frente) para o
// Vinicius escolher (ele escolheu a 3ª, de frente, seed 4103). `resto` (confirmado por ele em 2026-11-18: "2 - sim") =
// os outros dois líderes (4 variações cada, de frente) e os 12 soldados (2 variações cada, de frente): 32 gerações.
// `lideres` e `soldados` são as duas metades do `resto`.
//
// Saída: os crus em prototype/assets/pixellab/raw/treinadores/ (pedido e resposta em .json, a imagem em .png) e as
// candidatas em prototype/assets/pixellab/treinadores/<id>-s<seed>.png; cada lote gerado entra no
// docs/memoria/assets.md (o piloto, uma linha da Labareda; os outros, uma linha por lote). A candidata que vai para o
// jogo é a de treinadores/escolhas.json ({ id: seed }), que o build embute (tools/arte-embutida.mjs, lerTreinadores).
// O id é o nome do oponente em GameData.GYMS sem acento, em minúsculas e com hífen (o game.js acha a arte assim).
import fs from 'node:fs';
import path from 'node:path';
import {
  RAIZ, DIR_MOLDES, DIR_MOLDES_RAW, PIXFLUX, HOJE, fmt, estado, executarReal, criarOrcamento, pago, saldo, gravarCru,
  lerCru, bufDe, TetoAtingido, ErroApi,
} from './pixellab-comum.mjs';
import { decodePng } from './png.mjs';

const DIR_RAW = path.join(DIR_MOLDES_RAW, 'treinadores');
const DIR_FINAL = path.join(DIR_MOLDES, 'treinadores');
const ARQ_ASSETS = path.join(RAIZ, 'docs', 'memoria', 'assets.md');
const LADO = 64;
const ESTILO = 'full body pixel art game character, standing, whole figure visible from head to boots, clean silhouette';

// Os treinadores (a ordem das variações define as seeds: seed = base + índice).
const TREINADORES = {
  'capita-labareda': {
    nome: 'Capitã Labareda', ginasio: 'fogo', seed: 4101,
    desc: 'fire gym leader, a confident young woman captain with brown hair in a short ponytail, red captain hat with a '
      + 'small orange flame plume, red military coat with orange trim, gold buttons and gold epaulettes, white riding '
      + 'trousers, tall black riding boots, holding a short riding crop, warm fire colors',
    variacoes: ['south-west', 'south-west', 'south', 'south'],
  },
};
// Os outros 14 (2026-11-18): o mesmo estilo, de frente; cada ginásio com o seu tema e as patentes na roupa
// (recruta sem divisa, cabo com 1, sargento com 3, tenente de oficial).
const FRENTE4 = ['south', 'south', 'south', 'south'], FRENTE2 = ['south', 'south'];
const CALOR = 'warm fire colors', AGUA = 'cool water colors', MATO = 'fresh grass colors';
const soldado = (nome, ginasio, seed, desc) => ({ nome, ginasio, seed, desc, variacoes: FRENTE2 });
Object.assign(TREINADORES, {
  'mestre-aguaceiro': {
    nome: 'Mestre Aguaceiro', ginasio: 'agua', seed: 4201, variacoes: FRENTE4,
    desc: 'water gym leader, an old riverboat master with a long white beard and bushy eyebrows, navy blue captain hat '
      + 'with a silver wave emblem, long dark blue coat with silver buttons and silver epaulettes, a teal scarf, holding a '
      + `wooden walking staff, dark trousers, black boots, ${AGUA}`,
  },
  'dona-capineira': {
    nome: 'Dona Capineira', ginasio: 'grama', seed: 4301, variacoes: FRENTE4,
    desc: 'grass gym leader, a strong older woman with grey hair in a bun, wide straw hat with green leaves, green and '
      + 'brown leather jacket of a Brazilian backlands cowboy, a long green skirt, brown boots, holding a wooden walking '
      + `cane, ${MATO}`,
  },
  'recruta-fagulha': soldado('Recruta Fagulha', 'fogo', 4111, 'fire gym recruit, a cheerful teenage girl with short orange '
    + `hair, simple red military cap, plain red tunic with small orange sparks embroidered, brown trousers, brown boots, ${CALOR}`),
  'cabo-tocha': soldado('Cabo Tocha', 'fogo', 4121, 'fire gym corporal, a young man with short black hair, red forage cap, '
    + `red military jacket with one gold chevron on the sleeve, holding an unlit wooden torch, dark trousers, black boots, ${CALOR}`),
  'sargento-candeeiro': soldado('Sargento Candeeiro', 'fogo', 4131, 'fire gym sergeant, a stout middle-aged man with a '
    + 'thick brown mustache, red peaked cap, red military coat with three gold chevrons, holding an old brass oil lantern, '
    + `dark trousers, black boots, ${CALOR}`),
  'tenente-coivara': soldado('Tenente Coivara', 'fogo', 4141, 'fire gym lieutenant, a tall woman with dark braided hair, red '
    + 'officer cap, dark red military coat with gold buttons and a gold sash, brown leather gloves, white trousers, tall '
    + `black boots, ${CALOR}`),
  'recruta-orvalho': soldado('Recruta Orvalho', 'agua', 4211, 'water gym recruit, a shy young boy with light blue hair, white '
    + `sailor cap, white and light blue sailor uniform with a blue neckerchief, blue shorts, brown shoes, ${AGUA}`),
  'cabo-goteira': soldado('Cabo Goteira', 'agua', 4221, 'water gym corporal, a young woman with a short black bob haircut, '
    + 'blue sailor cap, navy blue sailor jumper with one white chevron, holding a small metal bucket, white trousers, black '
    + `boots, ${AGUA}`),
  'sargento-correnteza': soldado('Sargento Correnteza', 'agua', 4231, 'water gym sergeant, a broad-shouldered man with a '
    + 'short grey beard, navy blue cap, blue naval coat with three white chevrons, a coiled rope over one shoulder, dark '
    + `trousers, black boots, ${AGUA}`),
  'tenente-cacimba': soldado('Tenente Cacimba', 'agua', 4241, 'water gym lieutenant, a calm woman with long dark blue hair, '
    + 'white officer cap with a blue band, teal naval officer coat with silver buttons, holding a brass spyglass, white '
    + `trousers, tall black boots, ${AGUA}`),
  'recruta-broto': soldado('Recruta Broto', 'grama', 4311, 'grass gym recruit, a small energetic kid with messy green hair, '
    + `green bandana, light green shirt with a small sprout pin, brown shorts, brown sandals, ${MATO}`),
  'cabo-carrapicho': soldado('Cabo Carrapicho', 'grama', 4321, 'grass gym corporal, a wiry young man with spiky brown hair, '
    + 'olive green cap, green ranger shirt with one yellow chevron, brown trousers with burrs stuck on them, brown boots, '
    + MATO),
  'sargento-juazeiro': soldado('Sargento Juazeiro', 'grama', 4331, 'grass gym sergeant, a sturdy man with a dark beard, '
    + 'brown leather hat of a Brazilian backlands cowboy, leather vest over a green shirt with three yellow chevrons, brown '
    + `leather trousers, brown boots, ${MATO}`),
  'tenente-aroeira': soldado('Tenente Aroeira', 'grama', 4341, 'grass gym lieutenant, a confident woman with curly dark hair, '
    + 'green officer cap with a red berry emblem, dark green ranger coat with brass buttons, brown leather belt, beige '
    + `trousers, tall brown boots, ${MATO}`),
});
const LIDERES = ['mestre-aguaceiro', 'dona-capineira'];
const SOLDADOS = ['recruta-fagulha', 'cabo-tocha', 'sargento-candeeiro', 'tenente-coivara', 'recruta-orvalho', 'cabo-goteira',
  'sargento-correnteza', 'tenente-cacimba', 'recruta-broto', 'cabo-carrapicho', 'sargento-juazeiro', 'tenente-aroeira'];
const LOTES = { piloto: ['capita-labareda'], lideres: LIDERES, soldados: SOLDADOS, resto: LIDERES.concat(SOLDADOS) };

function pedido(t, direcao, seed) {
  return {
    description: `${ESTILO}, ${t.desc}`,
    image_size: { width: LADO, height: LADO },
    view: 'side', direction: direcao,
    outline: 'single color black outline', shading: 'basic shading', detail: 'medium detail',
    no_background: true, seed,
  };
}

function sair(msg) { console.error(msg); process.exit(2); }
function args(argv) {
  const a = { lote: 'piloto', teto: null, gerar: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--lote') a.lote = argv[++i];
    else if (k === '--teto') a.teto = Number(argv[++i]);
    else if (k === '--gerar') a.gerar = true;
    else sair(`argumento desconhecido: ${k}`);
  }
  if (!LOTES[a.lote]) sair(`--lote ${a.lote}: não existe (lotes: ${Object.keys(LOTES).join(', ')})`);
  if (a.teto == null) a.teto = LOTES[a.lote].reduce((n, id) => n + TREINADORES[id].variacoes.length, 0);   // padrão: o lote inteiro
  if (!Number.isFinite(a.teto) || a.teto <= 0) sair('--teto precisa ser um número maior que zero');
  return a;
}

function plano(lote) {
  const itens = [];
  for (const id of LOTES[lote]) {
    const t = TREINADORES[id];
    t.variacoes.forEach((dir, i) => {
      const seed = t.seed + i, corpo = pedido(t, dir, seed), base = `${id}-s${seed}`;
      const reg = lerCru(DIR_RAW, base, corpo);
      const cru = !!(reg && !reg.erro && fs.existsSync(path.join(DIR_RAW, base + '.png')));
      itens.push({ id, t, dir, seed, corpo, base, cru, rotulo: `${id}/${dir}` });
    });
  }
  return itens;
}

function registrarAsset(t, id, itens, geracoes) {
  const arquivos = `\`prototype/assets/pixellab/treinadores/${id}-s{${itens.map(x => x.seed).join(',')}}.png\` (crus em \`raw/treinadores/\`)`;
  const linha = `| ${HOJE} | ${arquivos} | PixelLab API v2 ${PIXFLUX} | ${t.nome} (piloto da tela de desafio do ginásio): `
    + `64×64, sem fundo, "${ESTILO}, ${t.desc}"; direção ${[...new Set(itens.map(x => x.dir))].join(' / ')}; `
    + `contorno preto, sombreado básico; seeds ${itens.map(x => x.seed).join(', ')} | ${fmt(geracoes)} `
    + `${geracoes === 1 ? 'geração' : 'gerações'} da cota | Não (candidatas; o Vinicius escolhe) |`;
  const linhas = fs.readFileSync(ARQ_ASSETS, 'utf8').split('\n');
  const igual = linhas.findIndex(l => l.startsWith('|') && (l.split('|')[2] || '').trim() === arquivos);
  if (igual >= 0) linhas[igual] = linha;
  else linhas.splice(linhas.reduce((u, l, i) => (l.startsWith('|') ? i : u), -1) + 1, 0, linha);
  fs.writeFileSync(ARQ_ASSETS, linhas.join('\n'));
}

// os lotes depois do piloto: uma linha por lote (o texto de cada oponente fica neste script)
function registrarLote(lote, feitos, geracoes) {
  const ids = Object.keys(feitos), n = ids.reduce((k, id) => k + feitos[id].length, 0);
  const arquivos = `\`prototype/assets/pixellab/treinadores/<id>-s<seed>.png\` do lote \`${lote}\` (${n} candidatas de ${ids.length} oponentes; crus em \`raw/treinadores/\`)`;
  const linha = `| ${HOJE} | ${arquivos} | PixelLab API v2 ${PIXFLUX} | ${ids.map(id => TREINADORES[id].nome).join(', ')} (tela de desafio do ginásio): `
    + `64×64, sem fundo, de frente, "${ESTILO}, <o texto de cada um>" (em \`prototype/tools/pixellab-treinadores.mjs\`); contorno preto, `
    + `sombreado básico; seeds ${ids.map(id => `${id} ${feitos[id].map(x => x.seed).join('/')}`).join(' · ')} | ${fmt(geracoes)} `
    + `${geracoes === 1 ? 'geração' : 'gerações'} da cota | Não (candidatas; a de cada oponente que vai para o jogo fica em \`treinadores/escolhas.json\`) |`;
  const linhas = fs.readFileSync(ARQ_ASSETS, 'utf8').split('\n');
  const igual = linhas.findIndex(l => l.startsWith('|') && (l.split('|')[2] || '').trim() === arquivos);
  if (igual >= 0) linhas[igual] = linha;
  else linhas.splice(linhas.reduce((u, l, i) => (l.startsWith('|') ? i : u), -1) + 1, 0, linha);
  fs.writeFileSync(ARQ_ASSETS, linhas.join('\n'));
}

async function main() {
  // substituído pela arte da etapa 5 da direção de arte (tools/arte-treinadores.mjs, corpo 32×48 e busto 64×64); a pasta
  // assets/pixellab/treinadores/ deste script saiu na etapa 8 (fica no histórico do git)
  console.error('pixellab-treinadores.mjs foi substituído por prototype/tools/arte-treinadores.mjs (etapa 5 da direção de arte).');
  process.exit(1);
  const a = args(process.argv.slice(2));
  const itens = plano(a.lote);
  const novos = itens.filter(x => !x.cru);
  if (!a.gerar) {
    console.log(`DRY-RUN (sem --gerar): nenhuma chamada à API. Lote "${a.lote}"; teto ${a.teto} gerações.`);
    itens.forEach((x, i) => console.log(`${String(i + 1).padStart(3)}. ${x.cru ? 'REAPROVEITA raw/' : 'POST ' + PIXFLUX}  ${x.rotulo.padEnd(28)} seed ${x.seed}  ${x.cru ? '0' : '~1'} geração`));
    console.log(`\nPrompt: ${itens[0] && itens[0].corpo.description}`);
    console.log(`Total previsto: ${novos.length} gerações em ${novos.length} chamadas novas (+ ${itens.length - novos.length} reaproveitadas; teto ${a.teto}).`);
    if (novos.length > a.teto) console.log(`AVISO: passa do teto; o lote para antes da ${a.teto + 1}ª chamada.`);
    return;
  }
  estado.redeLiberada = true;
  const s0 = await saldo('antes');
  const disponivel = s0.subscription && s0.subscription.generations;
  if (novos.length && !(disponivel >= Math.min(a.teto, novos.length))) {
    throw new ErroApi(`saldo do plano (${disponivel}) menor que o necessário: o resto sairia dos créditos em US$; abortado`, { fatal: true });
  }
  const orc = criarOrcamento(a.teto);
  fs.mkdirSync(DIR_FINAL, { recursive: true });
  const feitos = {};
  for (const x of itens) {
    let png;
    if (x.cru) {
      png = fs.readFileSync(path.join(DIR_RAW, x.base + '.png'));
      console.log(`  ${x.rotulo} seed ${x.seed}: reaproveitada de raw/`);
    } else {
      const item = { rotulo: `${x.rotulo} seed ${x.seed}`, geracoes: 0 };
      let r;
      try {
        r = await pago(orc, PIXFLUX, item, () => executarReal(PIXFLUX, x.corpo));
      } catch (e) {
        if (e instanceof TetoAtingido) { console.log(`  ${e.message}`); break; }
        throw e;
      }
      png = bufDe(r.image, item.rotulo);
      gravarCru(DIR_RAW, x.base, PIXFLUX, x.corpo, r, [[x.base + '.png', png]]);
    }
    const d = decodePng(png);
    if (d.width !== LADO || d.height !== LADO) throw new ErroApi(`${x.rotulo}: ${d.width}×${d.height}, esperado ${LADO}×${LADO}`, { fatal: true });
    fs.writeFileSync(path.join(DIR_FINAL, x.base + '.png'), png);
    (feitos[x.id] = feitos[x.id] || []).push(x);
  }
  if (a.lote === 'piloto') for (const id of Object.keys(feitos)) registrarAsset(TREINADORES[id], id, feitos[id], orc.gasto);
  else if (Object.keys(feitos).length) registrarLote(a.lote, feitos, orc.gasto);
  await saldo('depois');
  console.log(`Gerações gastas neste lote: ${fmt(orc.gasto)} de teto ${a.teto}, em ${orc.chamadas} chamadas pagas.`);
}

main().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
