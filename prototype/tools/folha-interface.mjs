// prototype/tools/folha-interface.mjs — folha da interface (dist/interface.html): todos os componentes da interface
// (spec do acabamento, seção 4) nos seus estados, montados com o CSS real do jogo, mais as peças de pixel ampliadas x4.
// Função pura: HTML estático, sem JS do jogo e sem rede. O markup copia as classes que o game.js gera, então a folha
// acompanha sozinha qualquer mudança de CSS. Foco e "apertado" vêm das classes .foco-demo e .apertado-demo, que o
// game.css acrescenta às mesmas regras de :focus-visible e :active. Cores forçadas (forced-colors) não são simuladas:
// o ui-test cobre esse modo com forcedColors: 'active'.

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// uma cena de demonstração: rótulo + conteúdo (nas duas larguras: 360 px e larga)
const estados = (itens) => itens.map(([rot, html]) => `<div class="estado"><span class="estado-rot">${esc(rot)}</span>${html}</div>`).join('');
const secao = (num, titulo, nota, corpo) =>
  `<section class="comp" data-componente="${num}" aria-labelledby="c-${num.replace('.', '-')}">` +
  `<h2 class="comp-tit" id="c-${num.replace('.', '-')}">${esc(num)} ${esc(titulo)}</h2><p class="comp-nota">${esc(nota)}</p>` +
  // duas colunas no desktop: 360 px (celular) e larga; no celular, só a de 360 px (a larga fica escondida, é cópia)
  `<div class="estado-par"><div class="col col--estreita">${corpo}</div><div class="col col--larga" aria-hidden="true">${corpo}</div></div></section>`;

const btn = (cls, txt, extra = '') => `<button type="button" class="btn ${cls}"${extra ? ' ' + extra : ''}>${esc(txt)}</button>`;
const retrato = (w, h) => `<span class="retrato-moldura"><span class="retrato" style="display:block;width:${w}px;height:${h}px;background:var(--painel-3)"></span>` +
  `<span class="selo-nivel">Nv 20</span><span class="pontos-livres--selo">+3</span></span>`;
// o botão de ajuda como o ajudaBtn do game.js: sem texto, a peça de pixel vem do ::before
const ajuda = (extra = '', aberto = false) => `<button type="button" class="ajuda${extra}" aria-expanded="${aberto}" aria-label="O que é o Poder?" title="O Poder resume o cavalo."></button>`;
const moeda = n => `<span class="ouro"><span aria-hidden="true">🪙</span><span>${n}</span><span class="sr">Ouro</span></span>`;

// a seta da linha do Estábulo: mesmas linhas de pixel (SETA_ROWS) e mesmo caminho que o pixelSvg do game.js gera
const SETA_ROWS = ['..#.....', '..##....', '...##...', '....##..', '...##...', '..##....', '..#.....', '........'];
const setaSvg = () => {
  let d = '';
  SETA_ROWS.forEach((r, y) => { for (let x = 0; x < r.length;) { if (r[x] === '#') { const x0 = x; while (x < r.length && r[x] === '#') x++; d += `M${x0} ${y}h${x - x0}v1h-${x - x0}z`; } else x++; } });
  return `<svg class="montaria-linha-seta" viewBox="0 0 8 8" aria-hidden="true" shape-rendering="crispEdges"><path d="${d}"/></svg>`;
};

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
.folha h1.folha-tit { font-family: var(--fonte-display); font-size: 16px; line-height: 1.5; margin: 0 0 8px; }
.folha-intro { margin: 0 0 16px; color: var(--texto-2); font-size: var(--t-s); }
.comp { margin: 0 0 32px; }
.comp-tit { font-family: var(--fonte-display); font-size: 16px; line-height: 1.5; margin: 0 0 4px; }
.comp-nota { margin: 0 0 12px; color: var(--texto-2); font-size: var(--t-s); }
.estado { display: grid; gap: 6px; margin: 0 0 16px; min-width: 0; }
.estado-rot { color: var(--texto-3); font-size: var(--t-xs); text-transform: uppercase; letter-spacing: 0.08em; }
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
.peca figcaption { font-size: var(--t-s); word-break: break-word; }
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
