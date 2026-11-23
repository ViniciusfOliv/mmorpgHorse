// prototype/tools/folha-interface.mjs — folha da interface (dist/interface.html): todos os componentes da interface
// (spec do acabamento, seção 4) nos seus estados, montados com o CSS real do jogo, mais as peças de pixel ampliadas x4.
// Função pura: HTML estático, sem JS do jogo e sem rede. O markup copia as classes que o game.js gera, então a folha
// acompanha sozinha qualquer mudança de CSS. Foco e "apertado" vêm das classes .foco-demo e .apertado-demo, que o
// game.css acrescenta às mesmas regras de :focus-visible e :active. Cores forçadas (forced-colors) não são simuladas:
// o ui-test cobre esse modo com forcedColors: 'active'.

import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'

// nomes, preços, descrições e o calendário da diária vêm do catálogo do jogo (GameData.ITEMS, DAILY, BAG_MAX); os dos
// ginásios, de GameData.GYM, GYM_ORDER e GYMS
const req = createRequire(import.meta.url)
const G = req('../src/data.js')
// a vantagem de elemento e o Poder dos cavalos do time de exemplo saem das regras (Ginasio.vantagem, Ginasio.cavalo, RaceSim.powerRating)
const GN = req('../src/ginasio.js'), RS = req('../src/sim.js')

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// uma cena de demonstração: rótulo + conteúdo (nas duas larguras: 360 px e larga)
const estados = (itens) => itens.map(([rot, html]) => `<div class="estado"><span class="estado-rot">${esc(rot)}</span>${html}</div>`).join('');
const secao = (num, titulo, nota, corpo) =>
  `<section class="comp" data-componente="${num}" aria-labelledby="c-${num.replace('.', '-')}">` +
  `<h2 class="comp-tit" id="c-${num.replace('.', '-')}">${esc(num)} ${esc(titulo)}</h2><p class="comp-nota">${esc(nota)}</p>` +
  // duas colunas no desktop: 360 px (celular) e larga; no celular, só a de 360 px (a larga fica escondida, é cópia)
  `<div class="estado-par"><div class="col col--estreita">${corpo}</div><div class="col col--larga" aria-hidden="true">${corpo}</div></div></section>`;

const btn = (cls, txt, extra = '') => `<button type="button" class="btn ${cls}"${extra ? ' ' + extra : ''}>${esc(txt)}</button>`;
const retrato = (w, h, nivel = 20, pontos = 3) => `<span class="retrato-moldura"><span class="retrato" style="display:block;width:${w}px;height:${h}px;background:var(--painel-3)"></span>` +
  `<span class="selo-nivel">Nv ${nivel}</span>${pontos ? `<span class="pontos-livres--selo">+${pontos}</span>` : ''}</span>`;
// o botão de ajuda como o ajudaBtn do game.js: sem texto, a peça de pixel vem do ::before
const ajuda = (extra = '', aberto = false) => `<button type="button" class="ajuda${extra}" aria-expanded="${aberto}" aria-label="O que é o Poder?" title="O Poder resume o cavalo."></button>`;
const moeda = n => `<span class="ouro"><span aria-hidden="true">🪙</span><span>${n}</span><span class="sr">Ouro</span></span>`;

// a seta da linha do Estábulo: mesmas linhas de pixel (SETA_ROWS) e mesmo caminho que o pixelSvg do game.js gera
const SETA_ROWS = ['..#.....', '..##....', '...##...', '....##..', '...##...', '..##....', '..#.....', '........'];
const setaSvg = (cls = 'montaria-linha-seta') => {
  let d = '';
  SETA_ROWS.forEach((r, y) => { for (let x = 0; x < r.length;) { if (r[x] === '#') { const x0 = x; while (x < r.length && r[x] === '#') x++; d += `M${x0} ${y}h${x - x0}v1h-${x - x0}z`; } else x++; } });
  return `<svg class="${cls}" viewBox="0 0 8 8" aria-hidden="true" shape-rendering="crispEdges"><path d="${d}"/></svg>`;
};

// ---- itens, loja e recompensa diária: o markup do itemLinhaHtml, lojaProdutoHtml, lojaMochilaHtml e diariaCartaoHtml do game.js ----
const fmt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
// o botão indisponível como o indisponivel(motivo) do game.js: aria-disabled, com o motivo em data-motivo e no title
const indisp = motivo => motivo ? ` aria-disabled="true" data-motivo="${esc(motivo)}" title="${esc(motivo)}"` : '';
const itemQtdTxt = (id, n) => `${fmt(n)} ${n === 1 ? G.ITEMS[id].name : G.ITEMS[id].plural}`;
// a linha de um item (itemLinhaHtml): ícone, nome, quantidade (×3 ou "tem 3"), para que serve e o extra (preço e botão)
function itemLinha(id, { qtd = null, forma = 'x', texto = null, apagada = false, classe = '', extra = '', aviso = '' } = {}) {
  const it = G.ITEMS[id], tem = forma === 'tem';
  const q = qtd == null ? '' : `<span class="item-qtd"><span aria-hidden="true">${tem ? 'tem ' : '×'}${fmt(qtd)}</span>` +
    `<span class="sr">${esc((tem ? 'Você tem ' : '') + itemQtdTxt(id, qtd))}</span></span>`;
  return `<article class="item-linha${classe ? ' ' + classe : ''}${apagada ? ' item-linha--vazia' : ''}" data-item="${esc(id)}">` +
    `<span class="item-icone item-icone--${esc(id)}" aria-hidden="true"></span><h2 class="item-nome">${esc(it.name)}</h2>${q}` +
    `<p class="item-desc">${esc(texto != null ? texto : it.desc)}</p>${extra}${aviso ? `<p class="aviso item-aviso">${esc(aviso)}</p>` : ''}</article>`;
}
// um produto da loja (lojaProdutoHtml): o rótulo do botão e o motivo, como o LOJA_ROTULO e o lojaMotivo do game.js
function produto(id, { tem, limite, rotulo = 'Comprar', motivo = '', aviso = '' }) {
  const it = G.ITEMS[id];
  const botao = `<button type="button" class="btn btn--ouro btn--pequeno" data-acao="item-comprar" data-id="${esc(id)}"${indisp(motivo)}>${esc(rotulo)}<span class="sr"> ${esc(it.name)}</span></button>`;
  return `<section class="caixa item-lista" aria-label="Itens à venda">` + itemLinha(id, { qtd: tem, forma: 'tem', classe: 'item-linha--produto', aviso,
    extra: `<div class="item-compra"><span class="item-preco">${moeda(fmt(it.price))}<span class="item-limite">${esc(limite)}</span></span>${botao}</div>` }) + '</section>';
}
// uma linha da mochila (lojaMochilaHtml): com o item, o Usar; com 0, apagada e com a frase de onde o item vem
function mochila(id, n, aviso = '') {
  const usar = n > 0 ? `<div class="item-compra item-compra--usar"><button type="button" class="btn btn--pequeno" data-acao="item-usar" data-id="${esc(id)}">Usar<span class="sr"> ${esc(G.ITEMS[id].name)}</span></button></div>` : '';
  return `<section class="caixa item-lista" aria-label="Mochila">` + itemLinha(id, { qtd: n, classe: 'item-linha--mochila', apagada: n === 0, texto: n === 0 ? G.ITEMS[id].origem : null, extra: usar, aviso }) + '</section>';
}
// o prêmio em texto (premioTxt): "200 de Ouro, 1 Rédea nova e 1 Estrela de treino"
function premioTxt(prox, ciclos) {
  const d = G.DAILY.dias[prox], partes = d.ouro ? [fmt(d.ouro) + ' de Ouro'] : [];
  if (d.item) partes.push(itemQtdTxt(d.item, 1));
  if (prox === G.DAILY.dias.length - 1 && (ciclos + 1) % G.DAILY.estrelaACada === 0) partes.push(itemQtdTxt('estrela', 1));
  return partes.length > 1 ? partes.slice(0, -1).join(', ') + ' e ' + partes[partes.length - 1] : partes.join('');
}
// o cartão da recompensa diária (diariaCartaoHtml): grande com prêmio para resgatar (prox: o dia do calendário, 0 a 6), com o
// motivo do resgate travado e os 7 dias abertos (diariaDiasHtml) quando pedidos; ou a linha de depois do resgate
function diaria({ prox, ciclos = 0, motivo = '', ver = false }) {
  const n = G.DAILY.dias.length, dia = prox + 1, premio = premioTxt(prox, ciclos);
  const dias = !ver ? '' : '<ol class="diaria-dias" id="diaria-dias">' + G.DAILY.dias.map((x, i) => {
    const feito = i < prox, atual = i === prox;
    return `<li class="diaria-dia${feito ? ' diaria-dia--feito' : ''}"${atual ? ' aria-current="date"' : ''}><span class="diaria-dia-n">Dia ${i + 1}</span>` +
      `<span class="diaria-dia-premio">${esc(premioTxt(i, ciclos))}</span>${feito || atual ? `<span class="diaria-dia-marca">${feito ? 'Resgatado' : 'Hoje'}</span>` : ''}</li>`;
  }).join('') + '</ol>';
  return '<section class="caixa diaria diaria--grande" aria-label="Recompensa do dia">' +
    `<h2 class="titulo">Recompensa do dia<span class="sr">${esc(', dia ' + dia + ' de ' + n + ': ' + premio)}</span></h2>` +
    `<p class="diaria-premio" aria-hidden="true"><span class="diaria-num">${dia} / ${n}</span> ${esc(premio)}</p>` +
    (motivo ? `<p class="nota diaria-motivo">${esc(motivo)}</p>` : '') +
    `<div class="diaria-acoes"><button type="button" class="btn btn--texto diaria-ver" data-acao="diaria-ver" aria-expanded="${ver}" aria-controls="diaria-dias">Ver os 7 dias</button>` +
    `<button type="button" class="btn btn--ouro btn--pequeno" data-acao="diaria-resgatar"${indisp(motivo)}>Resgatar<span class="sr"> ${esc(premio)}</span></button></div>` +
    dias + '</section>';
}
const diariaLinha = (prox, ciclos = 0) => '<section class="caixa diaria diaria--linha" aria-label="Recompensa do dia"><p class="diaria-linha" tabindex="-1">' +
  esc('Recompensa: amanhã ' + premioTxt(prox, ciclos)) + '</p></section>';

// ---- ginásios da Expedição: o markup do ginasioCartaoHtml, trilhaEtapaHtml, mountRowHtml (com as opções do time) e
// renderEntreDuelos do game.js; nomes, números e textos do catálogo (GameData.GYMS, GYM) montados como o game.js monta ----
// o ícone da insígnia como o iconeHtml do game.js (o mesmo PNG que o build embute em window.__ICONES)
const insigniaSrc = (id) => 'data:image/png;base64,' + readFileSync(new URL(`../assets/arte/icones/${G.GYMS[id].insignia.icone}.png`, import.meta.url)).toString('base64');
const insigniaIcone = (id) => `<img class="icone icone--${esc(G.GYMS[id].insignia.icone)} icone--32" src="${insigniaSrc(id)}" alt="" width="32" height="32">`;
const elNome = (el) => G.ELEMENTS[el].name;
const elHtml = (el) => `<span class="el el--${esc(el)}">${esc(elNome(el))}</span>`;
const ginCavalosTxt = (n) => n === 1 ? '1 cavalo' : n + ' cavalos';
// o cartão do ginásio na aba (ginasioCartaoHtml): etapas = quantas vencidas; rev: 'hoje' | 'amanha' | null
function ginasioCartao(id, etapas, rev = null) {
  const g = G.GYMS[id], ins = etapas === g.etapas.length;
  return `<li><button type="button" class="ginasio-cartao ginasio-cartao--${esc(g.element)}" data-acao="ginasio-abrir" data-id="${esc(id)}">` +
    `<span class="ginasio-cartao-nome">${esc(g.name)}</span>` +
    `<span class="ginasio-cartao-meta">${elHtml(g.element)}<span class="ginasio-progresso">${etapas} de ${g.etapas.length} vencidos</span></span>` +
    (ins ? `<span class="ginasio-cartao-meta ginasio-insignia">${insigniaIcone(id)}<span>${esc(g.insignia.name)}</span></span>` : '') +
    (rev === 'hoje' ? '<span class="ginasio-cartao-meta"><span class="ginasio-revanche">Revanche hoje</span></span>'
      : rev === 'amanha' ? '<span class="ginasio-cartao-meta"><span class="ginasio-revanche-amanha">Revanche amanhã</span></span>' : '') +
    setaSvg('montaria-linha-seta ginasio-cartao-seta') + '</button></li>';
}
const ginasios = (cartoes) => `<section class="caixa" aria-label="Ginásios"><ul class="ginasios">${cartoes}</ul></section>`;
// uma etapa da trilha (trilhaEtapaHtml): estado 'vencida' | 'proxima' | 'fechada' | 'revanche' | 'feita'
function etapa(id, i, estado) {
  const g = G.GYMS[id], e = g.etapas[i], rev = estado === 'revanche' || estado === 'feita', MOTIVO = 'Vença a etapa anterior';
  const lv = e.cavalos.map((c) => c.level), nivel = 'Nível ' + Math.min(...lv) + (Math.max(...lv) > Math.min(...lv) ? ' a ' + Math.max(...lv) : '');
  const entrada = rev ? G.GYM.revanche.entrada : e.entrada, p0 = G.GYM.revanche.ciclo[0];
  const premioHoje = p0.ouro ? fmt(p0.ouro) + ' de Ouro' : itemQtdTxt(p0.item, 1);
  const corpo = `<span class="etapa-rotulo">${e.lider ? 'Líder' : 'Soldado ' + (i + 1)}</span><span class="etapa-nome">${esc(e.nome)}</span>` +
    `<span class="etapa-meta">${esc(ginCavalosTxt(e.cavalos.length) + ' · ' + nivel + ' · Entrada: ' + fmt(entrada) + ' de Ouro')}</span>` +
    `<span class="etapa-estado etapa-estado--${estado}">${{ vencida: 'Vencida', proxima: 'Próxima', fechada: 'Fechada', revanche: 'Revanche hoje', feita: 'Feita hoje' }[estado]}</span>` +
    (estado === 'fechada' ? `<span class="etapa-motivo">${MOTIVO}</span>` : '') +
    (estado === 'revanche' ? `<span class="etapa-motivo">${esc('Prêmio de hoje: ' + premioHoje)}</span>` : '') +
    (estado === 'feita' ? '<span class="etapa-motivo">Revanche de hoje feita. Volte amanhã.</span>' : '') +
    (e.lider && rev ? `<span class="etapa-insignia">${insigniaIcone(id)}</span>` : '');
  const caixa = estado === 'vencida' || estado === 'feita' ? `<div class="etapa-btn">${corpo}</div>`
    : `<button type="button" class="etapa-btn" data-acao="ginasio-etapa" data-id="${i}"${estado === 'proxima' || estado === 'revanche' ? ' aria-current="step"' : indisp(MOTIVO)}>${corpo}</button>`;
  // oponente já vencido no ginásio (as vencidas e o líder com a insígnia): o botão do treino AFK, como o jogo desenha
  const treinar = estado === 'vencida' || estado === 'revanche' || estado === 'feita'
    ? `<div class="etapa-treinar"><button type="button" class="btn btn--pequeno" data-acao="afk-treinar" data-id="${esc(id + ':' + i)}">Treinar (AFK)<span class="sr"> contra ${esc(e.nome)}</span></button></div>` : '';
  return `<li class="etapa etapa--${estado}${e.lider ? ' etapa--lider' : ''}" data-etapa="${i}" data-estado="${estado}">${caixa}${treinar}</li>`;
}
const trilha = (itens) => `<section class="caixa" aria-label="Trilha"><ol class="trilha">${itens}</ol></section>`;
// uma linha do time no preparo (mountRowHtml com { acao: 'ginasio-time', fim, motivo, pressed, meta, lado }), contra um ginásio
// do elemento contra: pos (1, 2, 3 ou 0 = fora do time), motivo (a linha apagada), nota (a frase escrita embaixo da linha)
// (ativa: a montaria ativa, com a plaquinha "Ativa"; a posição "1º" passa pelo ordFix, como todo ordinal do jogo)
function linhaTime({ uid, base, nivel, contra, ativa = false, pos = 0, motivo = '', nota = '' }) {
  const h = GN.cavalo({ base, level: nivel, grau: 2 }), nome = h.name, el = h.element, poder = RS.powerRating(h);
  const n = uid.replace(/^m/, ''), v = GN.vantagem(el, contra), ganha = v === 1;
  const vt = v === 1 ? 'Vantagem' : v === -1 ? 'Desvantagem' : '';
  const fim = (vt ? vt + ' contra ' + elNome(contra) + '. ' : '') + (pos ? pos + 'º do time. Toque para tirar.' : motivo || 'Toque para pôr no time.');
  return `<li><button type="button" class="montaria-linha${ativa ? ' montaria--ativa' : ''}" data-acao="ginasio-time" data-id="${esc(uid)}" aria-label="${esc(nome + ' #' + n + ', nível ' + nivel + (ativa ? ', ativa' : '') + '. ' + fim)}"${indisp(motivo)} aria-pressed="${pos > 0}">` +
    `<span class="montaria-linha-retrato" aria-hidden="true">${retrato(96, 72, nivel, 0)}</span>` +
    `<span class="montaria-linha-nome">${esc(nome)}<small>#${esc(n)}</small></span>` +
    `<span class="montaria-linha-meta"><span class="raridade raridade--comum">Comum</span><span class="estrelas" role="img" aria-label="2 de 3 estrelas">★★☆</span>${ativa ? '<span class="badge-ativa">Ativa</span>' : ''}</span>` +
    `<span class="montaria-linha-meta">${elHtml(el)}<span class="montaria-linha-poder">Poder <b>${poder}</b></span>` +
      (vt ? `<span class="gin-vant gin-vant--${ganha ? 'mais' : 'menos'}">${vt}</span>` : '') + '</span>' +
    ordFix(`<span class="gin-pos" aria-hidden="true">${pos ? pos + 'º' : ''}</span>`) + '</button>' +
    (nota ? `<p class="nota">${esc(nota)}</p>` : '') + '</li>';
}
const time = (linhas) => `<section class="caixa" aria-label="Seu time"><ul class="montarias item-escolha gin-time">${linhas}</ul></section>`;
// o cartão entre dois duelos (renderEntreDuelos), com os textos do ginCartaoTxt
function cartaoDuelo(id, k, { titulo, saiu, folego, vant }) {
  return '<section class="tela tela--entreduelos" aria-label="Entre os duelos">' +
    `<header class="tela-cabeca placa"><span class="rotulo">${esc(G.GYMS[id].name + ' · Duelo ' + k)}</span><h1 class="titulo titulo--tela" tabindex="-1">${esc(titulo)}</h1></header>` +
    `<div class="caixa gin-cartao"><p class="gin-cartao-saiu">${esc(saiu)}</p><p class="gin-cartao-folego">${esc(folego)}</p><p class="gin-cartao-vant">${esc(vant)}</p></div>` +
    '<div class="acoes acoes--linha"><button type="button" class="btn btn--ouro" data-acao="ginasio-proximo">Próximo duelo</button>' +
    '<button type="button" class="btn" data-acao="ginasio-pular-tudo">Pular tudo</button></div></section>';
}

const RARIDADES = [['comum', 'Comum'], ['magico', 'Mágico'], ['raro', 'Raro'], ['lendario', 'Lendário'], ['mitico', 'Mítico']];
const LIGAS = [['bronze', 'Bronze'], ['prata', 'Prata'], ['ouro', 'Ouro'], ['platina', 'Platina'], ['diamante', 'Diamante'], ['lenda', 'Lenda']];

function secoes() {
  const s = [];
  // 4.1 Painel
  s.push(secao('4.1', 'Painel', 'Classe .caixa.',
    estados([['normal', '<div class="caixa"><h2 class="titulo">Estábulo</h2><p>Texto do painel com <b>valor</b>.</p></div>']])));
  // 4.2 Painel em destaque
  s.push(secao('4.2', 'Painel em destaque', 'Linha da montaria ativa no Estábulo (.montaria-linha.montaria--ativa) e opção escolhida (.opcao[aria-pressed="true"]).',
    estados([
      // a linha do Estábulo, com o markup do mountRowHtml do game.js (selo "Ativa" na borda de cima, retrato pequeno, seta)
      ['montaria ativa', '<button type="button" class="montaria-linha montaria--ativa" aria-label="Brasa #1, nível 20, ativa. Abrir ficha.">' +
        '<span class="montaria-linha-retrato" aria-hidden="true">' + retrato(96, 72) + '</span>' +
        '<span class="montaria-linha-nome">Brasa<small>#1</small></span>' +
        '<span class="montaria-linha-meta"><span class="raridade">Comum</span><span class="estrelas" role="img" aria-label="2 de 3 estrelas">★★☆</span><span class="badge-ativa">Ativa</span></span>' +
        '<span class="montaria-linha-meta"><span class="el el--fogo">Fogo</span><span class="montaria-linha-poder">Poder <b>412</b></span></span>' +
        setaSvg() + '</button>'],
      ['opção escolhida', btn('opcao opcao--centro', 'Escolhida', 'aria-pressed="true"')]
    ])));
  // 4.3 Placa de madeira
  s.push(secao('4.3', 'Placa de madeira', 'Classes .placa e .titulo--tela.',
    estados([
      ['placa', '<div class="placa"><span class="rotulo">Placa de madeira</span> <span class="nota">com nota</span></div>'],
      ['título de tela', '<h1 class="titulo titulo--tela">Estábulo 10/10 vagas</h1>']
    ])));
  // 4.4 Botão
  s.push(secao('4.4', 'Botão', 'Classe .btn em todos os estados.',
    estados([
      ['normal', btn('', 'Correr')],
      ['foco', btn('foco-demo', 'Correr')],
      ['apertado', btn('apertado-demo', 'Correr')],
      ['desabilitado', btn('', 'Correr', 'disabled')]
    ])));
  // 4.5 Botão ouro
  s.push(secao('4.5', 'Botão ouro', 'Classe .btn--ouro.',
    estados([
      ['normal', btn('btn--ouro', 'Entrar na corrida')],
      ['foco', btn('btn--ouro foco-demo', 'Entrar na corrida')],
      ['apertado', btn('btn--ouro apertado-demo', 'Entrar na corrida')],
      ['desabilitado', btn('btn--ouro', 'Entrar na corrida', 'disabled')]
    ])));
  // 4.6 Pequeno, texto, perigo
  s.push(secao('4.6', 'Botões pequeno, de texto e de perigo', 'Classes .btn--pequeno, .btn--texto e .btn--perigo.',
    estados([
      ['pequeno', btn('btn--pequeno', 'Renomear')],
      ['pequeno ouro', btn('btn--pequeno btn--ouro', 'Salvar')],
      ['de texto', btn('btn--texto', 'Cancelar')],
      ['perigo', btn('btn--perigo', 'Recomeçar')],
      ['perigo desabilitado', btn('btn--perigo', 'Recomeçar', 'disabled')]
    ])));
  // 4.7 Opção selecionável
  s.push(secao('4.7', 'Opção selecionável', 'Classe .opcao (aria-pressed).',
    estados([
      ['normal', '<div class="opcoes opcoes--3">' + btn('opcao opcao--centro', 'Sistema', 'aria-pressed="false"') + btn('opcao opcao--centro', 'Reduzido', 'aria-pressed="false"') + btn('opcao opcao--centro', 'Cheio', 'aria-pressed="false"') + '</div>'],
      ['escolhida', btn('opcao opcao--centro', 'Reduzido', 'aria-pressed="true"')],
      ['escolhida apertada', btn('opcao opcao--centro apertado-demo', 'Reduzido', 'aria-pressed="true"')],
      ['foco', btn('opcao opcao--centro foco-demo', 'Reduzido', 'aria-pressed="false"')],
      ['apertado', btn('opcao opcao--centro apertado-demo', 'Reduzido', 'aria-pressed="false"')],
      ['desabilitada', btn('opcao opcao--centro', 'Reduzido', 'aria-pressed="false" disabled')]
    ])));
  // 4.8 Abas
  const aba = (rot, ativa, foco = '') => `<button type="button" class="app-aba${ativa ? ' app-aba--ativa' : ''}${foco}"${ativa ? ' aria-current="page"' : ''}><span class="app-aba-icone" aria-hidden="true">🐎</span><span class="app-aba-rotulo">${esc(rot)}</span></button>`;
  s.push(secao('4.8', 'Abas', 'Sub-abas (.abas, .abas--loja) e a barra de abas (.app-abas, no desktop vira coluna à esquerda).',
    estados([
      ['sub-abas', '<div class="abas" role="group" aria-label="Exemplo">' + btn('opcao opcao--centro', 'Cruzar', 'aria-pressed="true"') + btn('opcao opcao--centro', 'Troca', 'aria-pressed="false"') + '</div>'],
      ['sub-abas da Loja', '<div class="abas abas--loja" role="group" aria-label="Loja">' + ['Sela', 'Testeira', 'Peitoral'].map((t, i) => btn('opcao opcao--centro', t, `aria-pressed="${i === 0}"`)).join('') + '</div>'],
      ['barra de abas', '<div class="moldura-fixa"><nav class="app-abas" aria-label="Seções de exemplo">' + aba('Correr', true) + aba('Estábulo', false, ' foco-demo') + aba('Haras', false) + aba('Loja', false) + aba('Perfil', false) + '</nav></div>']
    ])));
  // 4.9 Barras
  s.push(secao('4.9', 'Barras', 'Classes .barra, .barra--seg e .barra--xp.',
    estados([
      ['barra', '<div class="barra" role="img" aria-label="60%"><i style="width:60%"></i></div>'],
      ['segmentada', '<div class="barra barra--seg" role="img" aria-label="Segmentos"><i class="on"></i><i class="on"></i><i class="on"></i><i class="extra"></i><i class="menos"></i><i></i><i></i><i></i></div>'],
      ['experiência', '<div class="barra barra--xp" role="img" aria-label="Experiência 45%"><i style="width:45%"></i></div>']
    ])));
  // 4.10 Selos e chips
  s.push(secao('4.10', 'Selos e chips', 'Classes .chip, .raridade, .liga, .selo-nivel, .pontos-livres--selo, .badge-ativa, .tag-voce e .set-badge.',
    estados([
      ['chips', '<div class="chips"><span class="chip"><span class="rotulo">Distância</span><b>1200 m</b></span><span class="chip">Conjunto Trovão</span></div>'],
      ['raridades', '<div class="linha-meta">' + RARIDADES.map(([id, nome]) => `<span class="raridade raridade--${id}">${nome}</span>`).join('') + '</div>'],
      ['ligas', '<div class="linha-meta">' + LIGAS.map(([id, nome]) => `<span class="liga liga--${id}">Liga ${nome}</span>`).join('') + '</div>'],
      ['selos', '<div class="linha-meta"><span class="badge-ativa">Ativa</span><span class="badge-ativa">Equipada</span><span class="tag-voce">VOCÊ</span><span class="set-badge">Trovão ×2</span></div>'],
      ['selo de nível e pontos', retrato(96, 72)]
    ])));
  // 4.11 Saldo
  s.push(secao('4.11', 'Saldo do topo', 'Classe .saldo.',
    estados([['saldo', `<span class="saldo" aria-label="Saldo">${moeda('1.200')}</span>`]])));
  // 4.12 Retrato
  s.push(secao('4.12', 'Moldura do retrato', 'Classe .retrato dentro de .retrato-moldura (aqui sem o desenho do cavalo).',
    estados([['retrato', retrato(96, 72)]])));
  // 4.13 Botão ⓘ
  s.push(secao('4.13', 'Botão de ajuda', 'Classe .ajuda (alvo de 44×44 px; a peça de 14×14 px no ::before, em ouro quando aberto ou com o mouse).',
    estados([
      ['normal', '<div class="alvo-ajuda">' + ajuda() + '</div>'],
      ['aberto', '<div class="alvo-ajuda">' + ajuda('', true) + '</div>'],
      ['foco', '<div class="alvo-ajuda">' + ajuda(' foco-demo') + '</div>']
    ])));
  // 4.14 Avisos
  s.push(secao('4.14', 'Avisos', 'Classes .aviso e .aviso--perda.',
    estados([
      ['aviso', '<p class="aviso">Sua sala do Páreo continua aberta com entrada de 100 de Ouro.</p>'],
      ['aviso de perda', '<p class="aviso aviso--perda">Seu Ouro não cobre a menor entrada. Faça um treino gratuito.</p>']
    ])));
  // 4.15 Foco
  s.push(secao('4.15', 'Foco', 'Anel de 3 px em --foco (:focus-visible), igual em todos os componentes.',
    estados([
      ['botão', btn('foco-demo', 'Com foco')],
      ['opção', btn('opcao opcao--centro foco-demo', 'Com foco', 'aria-pressed="false"')],
      ['aba', '<div class="moldura-fixa moldura-fixa--solta">' + aba('Estábulo', false, ' foco-demo') + '</div>'],
      ['ajuda', '<div class="alvo-ajuda">' + ajuda(' foco-demo') + '</div>']
    ])));
  // 4.16 Faixa de ordem da corrida (Visuais 2, 3c §4 e §6)
  s.push(secao('4.16', 'Faixa de ordem da corrida', 'Classes .ordem, .ordem-item (o do jogador com .ordem-item--voce) e .ordem-vizinhos, embaixo da pista. No Dado da Sorte, o número de cada corredor em .ordem-dado e o do vencedor com .ordem-item--maior. Em tela baixa (.tela--baixa, altura < 700 px), uma linha só: sem os vizinhos, e o número do Dado no lugar da posição.',
    estados([
      ['normal (8 corredores)', ordemHtml({ vizinhos: [['À frente:', 6, '+3 m'], ['Atrás:', 5, '−4 m']] })],
      ['Dado da Sorte (números e o vencedor marcado)', ordemHtml({ dado: true, vizinhos: [['À frente:', 6, 'colado'], ['Atrás:', 5, '−11 m']] })],
      ['tela baixa', '<div class="tela--baixa">' + ordemHtml({ baixa: true, vizinhos: [['À frente:', 6, '+3 m'], ['Atrás:', 5, '−4 m']] }) + '</div>'],
      ['tela baixa com o Dado', '<div class="tela--baixa">' + ordemHtml({ baixa: true, dado: true, vizinhos: [['À frente:', 6, '+3 m'], ['Atrás:', 5, '−4 m']] }) + '</div>']
    ])));
  // 4.17 Abas do resultado (Visuais 2, 3c §8)
  const subabas = (aberta) => '<div class="subabas" role="group" aria-label="Detalhes da corrida">' +
    [['chegada', 'Chegada'], ['momentos', 'Momentos']].map(([id, rot]) => `<button type="button" class="btn opcao opcao--centro" data-acao="resultado-aba" data-id="${id}" aria-pressed="${aberta === id}">${rot}</button>`).join('') + '</div>';
  s.push(secao('4.17', 'Abas do resultado', 'Sub-abas .subabas (as mesmas da ficha da montaria), com aria-pressed na aba aberta; o resultado abre em "Chegada".',
    estados([
      ['Chegada aberta', subabas('chegada')],
      ['Momentos aberta', subabas('momentos')]
    ])));
  // 4.18 Produto da loja (spec de itens §6): o botão de compra em cada estado, com o motivo do indisponível
  const I = G.ITEMS;
  s.push(secao('4.18', 'Produto da loja', 'Loja, parte Comprar: .item-linha.item-linha--produto (ícone, nome, quantos tem, para que serve, preço, o limite do dia em .item-limite e o botão). Sem poder comprar, o botão fica apagado (aria-disabled) com o motivo; o aviso da compra fica na linha do produto.',
    estados([
      ['Comprar', produto('torrao', { tem: 3, limite: `Restam ${I.torrao.perDay} de ${I.torrao.perDay} hoje` })],
      ['Comprar, com o aviso da compra', produto('torrao', { tem: 4, limite: `Restam ${I.torrao.perDay - 1} de ${I.torrao.perDay} hoje`, aviso: `Comprou 1 ${I.torrao.name}. Agora você tem 4 na mochila.` })],
      ['Limite de hoje', produto('manual', { tem: 1, limite: `Restam 0 de ${I.manual.perDay} hoje`, rotulo: 'Limite de hoje', motivo: `Você já comprou ${I.manual.perDay} hoje, o limite do dia. Amanhã tem de novo.` })],
      ['Limite de hoje (Estrela)', produto('estrela', { tem: 0, limite: 'de novo em 3 dias', rotulo: 'Limite de hoje', motivo: `${I.estrela.name} volta à venda em 3 dias.` })],
      ['Sem Ouro', produto('estrela', { tem: 0, limite: 'disponível', rotulo: 'Sem Ouro', motivo: `Faltam ${fmt(I.estrela.price - 1200)} de Ouro para comprar ${I.estrela.name}.` })],
      ['Reservado', produto('cupom', { tem: 0, limite: `Restam ${I.cupom.perDay} de ${I.cupom.perDay} hoje`, rotulo: 'Reservado', motivo: '100 de Ouro reservados para a entrada do páreo aberto: sobram 150 para gastar.' })],
      ['Mochila cheia', produto('torrao', { tem: G.BAG_MAX, limite: `Restam ${I.torrao.perDay} de ${I.torrao.perDay} hoje`, rotulo: 'Mochila cheia', motivo: `A mochila já tem ${itemQtdTxt('torrao', G.BAG_MAX)}, o máximo.` })],
      ['Rédea nova (não se vende)', '<section class="caixa item-lista" aria-label="Itens à venda">' + itemLinha('redea', { qtd: 0, forma: 'tem', classe: 'item-linha--fora', texto: I.redea.origem }) + '</section>']
    ])));
  // 4.19 Linha da mochila (spec de itens §5)
  s.push(secao('4.19', 'Linha da mochila', 'Loja, parte Mochila: .item-linha.item-linha--mochila. Com o item, a quantidade e o Usar; com 0, a linha apagada (.item-linha--vazia) diz de onde o item vem.',
    estados([
      ['com o item', mochila('torrao', 3)],
      ['com o item, depois de um uso', mochila('torrao', 2, 'Brasa ganhou 1 ponto para distribuir. Torrões usados: 1 de ' + I.torrao.cap + '.')],
      ['sem o item', mochila('cupom', 0)]
    ])));
  // 4.20 Cartão da recompensa diária (spec de itens §7, §8; Rulings 16 e 17)
  const ultimo = G.DAILY.dias.length - 1;
  s.push(secao('4.20', 'Cartão da recompensa diária', 'Topo do Estábulo: .diaria.diaria--grande com prêmio para resgatar (o "N / 7" abre a linha do prêmio, só em texto), "Ver os 7 dias" e Resgatar; com a mochila cheia daquele item, o Resgatar apagado com o motivo; depois do resgate, .diaria.diaria--linha com o prêmio de amanhã.',
    estados([
      ['grande', diaria({ prox: 3 })],
      ['grande, 7º dia com a Estrela', diaria({ prox: ultimo, ciclos: G.DAILY.estrelaACada - 1 })],
      ['grande, com os 7 dias abertos', diaria({ prox: 3, ver: true })],
      ['grande, resgate travado', diaria({ prox: 1, motivo: `A mochila já tem ${itemQtdTxt('torrao', G.BAG_MAX)}, o máximo. O resgate espera até sobrar espaço.` })],
      ['de uma linha (já resgatado)', diariaLinha(1)]
    ])));
  // 4.21 a 4.24 Ginásios da Expedição (spec dos ginásios §10): o cartão da aba, a trilha, a linha do time e o cartão entre duelos
  const [F, A, C] = G.GYM_ORDER   // Fornalha, Remanso, Capoeira
  const nEt = G.GYMS[F].etapas.length, lider = nEt - 1
  s.push(secao('4.21', 'Cartão de ginásio', 'Aba Expedição: .ginasio-cartao (um botão que abre a trilha) com o nome, o elemento, "N de 5 vencidos", a insígnia conquistada (.ginasio-insignia) e "Revanche hoje" (.ginasio-revanche, quando a revanche do líder está livre) ou "Revanche amanhã" (.ginasio-revanche-amanha, sem destaque).',
    estados([
      ['nenhuma etapa vencida', ginasios(ginasioCartao(C, 0))],
      ['no meio da trilha', ginasios(ginasioCartao(F, 2))],
      ['com a insígnia e a revanche livre', ginasios(ginasioCartao(A, nEt, 'hoje'))],
      ['com a insígnia, revanche de hoje feita', ginasios(ginasioCartao(A, nEt, 'amanha'))]
    ])));
  const et = (id, est) => est.map((e, i) => etapa(id, i, e)).join('')
  s.push(secao('4.22', 'Trilha', 'Subtela do ginásio: .trilha (o DOM vai da 1ª etapa ao líder; o CSS põe o líder no topo). Cada .etapa: vencida (só texto, filete verde), próxima (o único botão tocável, aria-current="step"), fechada (apagada, aria-disabled, com "Vença a etapa anterior" escrito); com a insígnia, o líder vira a revanche (botão, com o prêmio de hoje) ou "feita" (só texto).',
    estados([
      ['no meio da trilha (2 vencidas)', trilha(et(F, ['vencida', 'vencida', 'proxima', 'fechada', 'fechada']))],
      ['líder com a revanche livre', trilha(etapa(A, lider, 'revanche'))],
      ['líder com a revanche de hoje feita', trilha(etapa(A, lider, 'feita'))]
    ])));
  const cheio = 'O time já tem 2 cavalos. Toque num deles para tirar.', sala = 'Está na sala aberta. Corra essa corrida primeiro.'
  s.push(secao('4.23', 'Linha do time', 'Preparo do desafio, "Seu time": a linha do Estábulo (.montaria-linha) dentro de .gin-time, com aria-pressed. A escolhida mostra a posição (.gin-pos, no lugar da seta) e o fundo com o filete dourado; a vantagem ou a desvantagem contra o elemento do ginásio é uma plaquinha escrita (.gin-vant); a apagada (aria-disabled) tem o motivo escrito embaixo.',
    estados([
      ['1º do time, com vantagem', time(linhaTime({ uid: 'm2', base: 'mare', nivel: 13, contra: F, pos: 1 }))],
      ['2º do time, sem vantagem (a ativa)', time(linhaTime({ uid: 'm1', base: 'brasa', nivel: 12, contra: F, ativa: true, pos: 2 }))],
      ['fora do time, com desvantagem', time(linhaTime({ uid: 'm3', base: 'ipe', nivel: 12, contra: F }))],
      ['apagada: o time está cheio', time(linhaTime({ uid: 'm3', base: 'ipe', nivel: 12, contra: F, motivo: cheio, nota: cheio }))],
      ['apagada: a ativa, na sala aberta', time(linhaTime({ uid: 'm1', base: 'brasa', nivel: 12, contra: F, ativa: true, motivo: sala, nota: sala }))]
    ])));
  const sg = G.GYMS[F].etapas[2], dono = (n) => n + ' (' + sg.nome + ')', brasa = G.STARTERS.find((h) => h.id === sg.cavalos[0].base).name
  const fx = G.GYM.fadiga.faixas
  s.push(secao('4.24', 'Cartão entre duelos', 'Tela cheia entre dois duelos (.tela--entreduelos): a placa com o ginásio e o número do duelo (nunca o total), o resultado no título, quem saiu e quem entra, a faixa do cansaço com o fôlego de quem ficou e a vantagem do próximo duelo (.gin-cartao); "Próximo duelo" e "Pular tudo". Em tela baixa, o texto à esquerda e os botões à direita.',
    estados([
      ['depois de uma vitória', cartaoDuelo(F, 1, { titulo: 'Maré venceu por menos de 1 m', saiu: `${dono(brasa)} saiu. Entra ${dono(brasa)}, Nível ${sg.cavalos[1].level}.`,
        folego: `Vitória ${fx[0].name.toLowerCase()} (menos de 1 m): Maré larga com ${Math.round((1 - fx[0].perde) * 100)}% do fôlego`, vant: `Vantagem: Maré (${elNome('agua')} vence ${elNome('fogo')})` })],
      ['depois de uma derrota', cartaoDuelo(F, 2, { titulo: 'Maré perdeu por 5 m', saiu: 'Maré saiu. Entra Brasa.',
        folego: `Vitória ${fx[1].name.toLowerCase()} (5 m): ${dono(brasa)} larga com ${Math.round((1 - fx[1].perde) * 100)}% do fôlego`, vant: 'Sem vantagem de elemento' })]
    ])));
  return s.join('\n');
}

// faixa de ordem com o markup que o atualizaOrdem e o marcaDado do game.js escrevem: <li> com a posição, o selo da raia
// (laneChip com raia--mini), a linha do número do Dado e o nome no .sr; o ordinal pelo ordFix; os vizinhos como no
// vizinhoHtml. Sala cheia: 8 corredores, o jogador (raia 2) em 2º; no Dado, o maior é o da raia 7 (o 1º)
const ORDEM_NOMES = ['Mandacaru', 'Brasa', 'Lambari', 'Ipê', 'Faísca', 'Pequi', 'Trovão', 'Jatobá'];
const ORDEM_JOGADOR = 1, ORDEM = [6, 1, 5, 3, 4, 0, 2, 7], ORDEM_DADO = [38, 73, 65, 30, 12, 51, 86, 44], ORDEM_VENCEDOR = 6;
const ordFix = html => html.replace(/>([^<]*)</g, (m, t) => '>' + t.replace(/º/g, '<sup class="ord" aria-hidden="true">o</sup><span class="sr">º</span>') + '<');
const laneChip = j => `<span class="raia ${j === ORDEM_JOGADOR ? 'seda-voce' : 'seda-' + j} raia--mini" aria-label="Raia ${j + 1}">${j + 1}</span>`;
function ordemHtml({ dado = false, baixa = false, vizinhos }) {
  const itens = ORDEM.map((j, k) => {
    const voce = j === ORDEM_JOGADOR, num = dado ? String(ORDEM_DADO[j]) : '';
    // em tela baixa o número do Dado toma o lugar da posição (o marcaDado troca o .ordem-pos) e a linha do número fica vazia
    const pos = baixa && dado ? esc(num) : ordFix(`>${k + 1}º<`).slice(1, -1);
    return `<li class="ordem-item${voce ? ' ordem-item--voce' : ''}${dado && j === ORDEM_VENCEDOR ? ' ordem-item--maior' : ''}" data-raia="${j}">` +
      `<span class="ordem-pos">${pos}</span>${laneChip(j)}<span class="ordem-dado">${baixa ? '' : num}</span>` +
      `<span class="sr">${esc(ORDEM_NOMES[j] + (voce ? ' (você)' : ''))}</span></li>`;
  }).join('');
  const viz = vizinhos.map(([rot, j, m]) => `<span class="viz"><span class="viz-rot">${esc(rot + ' ')}</span><b class="viz-nome">${esc(ORDEM_NOMES[j])}</b><span class="viz-m">${esc(' ' + m)}</span></span>`)
    .join('<span class="viz-sep"> · </span>');
  return `<section class="ordem" aria-label="Classificação"><ol class="ordem-lista">${itens}</ol><p class="ordem-vizinhos">${viz}</p></section>`;
}

function pecas(lista) {
  const figs = lista.map(p =>
    `<figure class="peca" data-peca="${esc(p.nome)}"><div class="peca-caixa"><img src="${esc(p.dataUrl)}" alt="" width="${p.width * 4}" height="${p.height * 4}"></div>` +
    `<figcaption>${esc(p.nome)} <small>${p.width}×${p.height} pixels de arte, ampliada ×4</small></figcaption></figure>`).join('');
  return `<section class="comp" data-pecas aria-labelledby="c-pecas"><h2 class="comp-tit" id="c-pecas">Peças de pixel</h2>` +
    `<p class="comp-nota">As peças embutidas pelo build, ampliadas ×4 com image-rendering: pixelated.</p><div class="pecas">${figs}</div></section>`;
}

// layout próprio da folha: só colunas, legendas e a ampliação das peças; os componentes usam o CSS do jogo
const ESTILO_FOLHA = `
.folha { max-width: 1200px; margin: 0 auto; padding: 16px; box-sizing: border-box; }
.folha h1.folha-tit { font-family: var(--fonte-display); font-size: var(--t-m); line-height: var(--lh-m); margin: 0 0 8px; }
.folha-intro { margin: 0 0 16px; color: var(--texto-2); font-family: var(--fonte-9); font-size: var(--t-s); }
.comp { margin: 0 0 32px; }
.comp-tit { font-family: var(--fonte-display); font-size: var(--t-m); line-height: var(--lh-m); margin: 0 0 4px; }
.comp-nota { margin: 0 0 12px; color: var(--texto-2); font-family: var(--fonte-9); font-size: var(--t-s); }
.estado { display: grid; gap: 6px; margin: 0 0 16px; min-width: 0; }
.estado-rot { color: var(--texto-3); font-family: var(--fonte-9); font-size: var(--t-xs); text-transform: uppercase; letter-spacing: var(--px); }
/* saldo e retrato no tamanho do conteúdo, como no jogo (a grade esticaria); o retrato com folga para a moldura */
.estado > .saldo, .estado > .retrato-moldura { justify-self: start; }
.estado > .retrato-moldura { margin: 6px; }
.estado-par { display: block; }
.col { min-width: 0; }
.col--larga { display: none; }
/* a barra de abas fixa dentro de uma moldura: 56px da barra + 4px do friso e do contorno, que ficam por cima dela */
.moldura-fixa { position: relative; transform: translateZ(0); height: 60px; overflow: hidden; }
.moldura-fixa--solta { height: 56px; width: 120px; }
.moldura-fixa--solta .app-aba { position: absolute; inset: 0; width: 100%; }
.alvo-ajuda { display: flex; align-items: center; width: 44px; height: 44px; }
.alvo-ajuda .ajuda { margin: 0; }
.pecas { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
.peca { margin: 0; padding: 8px; background: var(--painel-2); min-width: 0; }
.peca-caixa { display: flex; align-items: center; justify-content: center; min-height: 48px; margin-bottom: 6px; background: var(--noite-2); padding: 8px; overflow: hidden; }
.peca-caixa img { image-rendering: pixelated; max-width: none; }
.peca figcaption { font-family: var(--fonte-9); font-size: var(--t-s); word-break: break-word; }
.peca small { display: block; color: var(--texto-3); }
@media (min-width: 900px) {
  .estado-par { display: grid; grid-template-columns: 360px 1fr; gap: 24px; align-items: start; }
  .col--larga { display: block; }
  .moldura-fixa { height: 360px; }
  .moldura-fixa--solta { height: 56px; }
}
`;

export function htmlFolhaInterface({ estilo, pecas: lista }) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Interface do Galope Elemental</title>
<style>
${estilo}
${ESTILO_FOLHA}
</style>
<script>
// a mesma grade de pixel do jogo (game.js, aplicaGrade): --px = s / densidade, com s = floor(largura da coluna / 240)
(function () {
  function grade() {
    var d = Math.max(1, window.devicePixelRatio || 1), s = Math.max(1, Math.min(Math.floor(Math.min(window.innerWidth || 390, 520) * d / 240), Math.floor((window.innerHeight || 844) * d / 300)));
    document.documentElement.style.setProperty('--px', (s / d) + 'px');
  }
  grade(); window.addEventListener('resize', grade);
})();
</script>
</head>
<body>
<main class="folha">
<h1 class="folha-tit">Interface do Galope Elemental</h1>
<p class="folha-intro">Todos os componentes da interface, montados com o CSS do jogo. Foco e botão apertado são demonstrações fixas.</p>
${secoes()}
${pecas(lista)}
</main>
</body>
</html>
`;
}
