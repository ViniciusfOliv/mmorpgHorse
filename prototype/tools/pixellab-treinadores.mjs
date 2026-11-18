// prototype/tools/pixellab-treinadores.mjs — a arte dos oponentes dos ginásios (a tela de desafio antes de cada duelo,
// a "Cena 2" que o Vinicius escolheu em 2026-11-18): uma figura de corpo inteiro, 64×64, sem fundo, em pé, virada
// para a esquerda (para o cavalo do jogador). O cavalo do oponente NÃO sai daqui: é o cavalo de verdade do ginásio,
// desenhado pelos moldes do jogo.
//
// Uso:  NODE_USE_ENV_PROXY=1 node prototype/tools/pixellab-treinadores.mjs [--lote piloto] [--teto 4] [--gerar]
//   Sem --gerar é SEMPRE dry-run: lista as chamadas (endpoint, item, seed, prompt) e o total, sem rede.
//   --teto N  máximo de gerações no lote (padrão 4). Para ANTES de uma chamada que passaria do teto.
//   Com --gerar, confere o saldo do plano (o teto tem de caber nele: nada sai dos créditos em US$) e aborta se uma
//   resposta cobrar em US$ (o pago() do pixellab-comum.mjs).
//   Imagem já gerada com o mesmo pedido (raw/treinadores/<id>-s<seed>.json) é reaproveitada sem rede e sem custo.
//
// Lotes: `piloto` = só a Capitã Labareda (líder da Fornalha), 4 variações (2 de três-quartos, 2 de frente) para o
// Vinicius escolher. Os outros dois líderes e os 12 soldados entram como lotes novos depois de ele aprovar o piloto
// e confirmar o gasto (CLAUDE.md: geração paga só com confirmação explícita).
//
// Saída: os crus em prototype/assets/pixellab/raw/treinadores/ (pedido e resposta em .json, a imagem em .png) e as
// candidatas em prototype/assets/pixellab/treinadores/<id>-s<seed>.png; cada lote gerado entra no
// docs/memoria/assets.md (uma linha por treinador).
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
const LOTES = { piloto: ['capita-labareda'] };

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
  const a = { lote: 'piloto', teto: 4, gerar: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--lote') a.lote = argv[++i];
    else if (k === '--teto') a.teto = Number(argv[++i]);
    else if (k === '--gerar') a.gerar = true;
    else sair(`argumento desconhecido: ${k}`);
  }
  if (!LOTES[a.lote]) sair(`--lote ${a.lote}: não existe (lotes: ${Object.keys(LOTES).join(', ')})`);
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

async function main() {
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
  for (const id of Object.keys(feitos)) registrarAsset(TREINADORES[id], id, feitos[id], orc.gasto);
  await saldo('depois');
  console.log(`Gerações gastas neste lote: ${fmt(orc.gasto)} de teto ${a.teto}, em ${orc.chamadas} chamadas pagas.`);
}

main().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
