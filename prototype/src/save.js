/*
 * MMORPG Horse — o saneamento e a migração do save (sanitize) e o save novo (newState). Saiu do game.js no T16 sem
 * mudar nada (docs/auditoria/plano-fase-1.md, grupo F). Vai para o servidor com os outros módulos.
 * prototype/tools/save-referencia.json guarda 1.424 saves saneados pelo jogo de antes (todas as versões, lixo e campos
 * estragados, no jogo normal e no modo DEV): o --check confere o jogo de agora e este módulo no Node contra eles.
 *
 * Sem relógio, sem armazenamento e sem sorteio aleatório: o que o saneamento precisa de fora chega pelo ctx.
 *   ctx.dev          modo DEV (vagas sem limite, skills de outro elemento, modelos dev-N, o deslocamento da gaveta)
 *   ctx.seedNova(i)  a seed de um save novo (o jogo sorteia com o crypto; fora da simulação)
 *   ctx.hojeDia(st)  o dia do jogo (Itens.diaLocal, mais o deslocamento DEV do st)
 *   ctx.agoraMin(st) o "agora" do AFK em minutos (idem)
 *
 * Save.sanear(s, ctx) -> { state, descarte }   state: o save saneado (null: não vira save) · descarte: { cavalos, pecas }
 *   que não se leram e ficaram de fora (o aviso do T5). Como no game.js de antes, um s que não é objeto devolve o
 *   descarte do saneamento anterior (o jogo só o lê quando há state).
 * Save.novo(inicialId, ctx) -> o save novo com o inicial escolhido.
 * A leitura e a gravação no armazenamento, a cópia :pre-v<N>, o aviso de descarte e a tela de save mais novo ficam
 * no game.js.
 */
(function (root) {
  'use strict';
  var node = typeof require === 'function' && typeof module !== 'undefined' && module.exports;
  var GD = node ? require('./data.js') : root.GameData;
  var RS = node ? require('./sim.js') : root.RaceSim;
  var BRD = node ? require('./breed.js') : root.Breed;
  var GR = node ? require('./gear.js') : root.Gear;
  var IT = node ? require('./itens.js') : root.Itens;
  var GN = node ? require('./ginasio.js') : root.Ginasio;
  var AF = node ? require('./afk.js') : root.Afk;

  var E = GD.ECONOMY;
  var GE = E.gear;
  var STAT_KEYS = GD.STAT_KEYS || ['vel', 'acel', 'man', 'forca', 'est', 'garra', 'sorte'];
  // a opção "Animações" do Perfil (state.settings.motion; o game.js usa a mesma lista)
  var MOTIONS = ['sistema', 'completas', 'reduzidas'];
  // modo DEV: o deslocamento do relógio da gaveta, guardado só no save de teste (o game.js usa os mesmos tetos)
  var DEV_MIN_MAX = 600000;   // "AFK: avançar o relógio": de 0 a 600.000 minutos
  var DEV_DIAS_MAX = 400;   // "Avançar/Voltar 1 dia": de −400 a 400 dias
  var descarte = { cavalos: 0, pecas: 0 };   // o que o último saneamento deixou de fora

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
  function allHorses() { return GD.STARTERS.concat(GD.WILD_HORSES); }
  function horseById(id) { return allHorses().filter(function (h) { return h.id === id; })[0] || null; }
  // modelo do painel DEV (dev-N): só vale no modo DEV
  function devTemplateId(dev, id) { return dev && /^dev-\d{1,9}$/.test(String(id)); }

  // Save v5: várias montarias (instâncias) e uma ativa; peças de equipamento como instâncias em
  // state.items ({ uid: 'i<n>', id, plus }) e equipadas por montaria em mount.equip (slot -> uid|null).
  // Montaria v5: genética em potential (0–31), estrelas em grau (1–3) e pontos livres distribuídos em
  // alloc (as 7 chaves; RaceSim.validAlloc); não há status base guardado (sai da genética).
  // Saves v1/v2 (um inicial com level/xp/skills na raiz) são migrados em sanitize(): o inicial vira
  // mounts[0] ('m1'); o inventário de itens antigos (v1–v3) vira peças pelo OLD_ITEM_MAP.
  // v4 -> v5 (também em sanitize, e gravado logo ao abrir): o status base é descartado; alloc zerado (os
  // pontos dos níveis já ganhos ficam para distribuir); Neutro vira Fogo/Água/Grama pela seed do save e pelo
  // número do uid (neutroParaTipo); as skills de tipo (Labareda, Maré Alta, Raízes Firmes) saem da lista;
  // modelo que saiu do catálogo (ex.: Pangaré) fica com templateId null e a própria paleta; a sala aberta
  // fica (mesma seed, entrada e treino) com o Poder recalculado.
  // Visual da parte 2a (spec 2026-11-12-cavalos-marcas), sem versão nova: mount.marcas = { cara, patas, corpo } e
  // state.joquei = { padrao, capacete }, opcionais no save; ausentes ou inválidos, o sanitize põe os calculados
  // (marcasDe) e o jóquei inicial (validJoquei). Só desenho: nada disso entra na corrida, no Poder nem na sala.
  // Parte 2b (spec 2026-11-13-cavalos-portes §3), também sem versão nova: mount.porte (GameData.PORTES.valores),
  // opcional; ausente ou inválido, o sanitize põe o da escada do Breed.porteDe (o do modelo do catálogo, senão
  // porteDoId do uid). Só desenho, como as marcas.
  // v5 -> v6 (bloco 1b, crescimento livre; spec 2026-11-12-crescimento-livre §10), também em sanitize e gravado logo ao
  // abrir: todos os cavalos ficam com alloc zerado (todos os pontos devolvidos, no custo por faixa novo) e
  // mount.respecFree = true (a primeira redistribuição de cada cavalo é grátis); state.redeas = 0 (Rédeas novas, que
  // pagam as redistribuições seguintes); peças, equipamento e Pedras ficam como estão; a sala aberta continua (mesma
  // seed, entrada e treino), com o retrato dos pontos zerado e o Poder pela R16. state.avisoV6 = true marca o aviso
  // da migração ainda não mostrado: o Estábulo o mostra uma vez na abertura (start) e grava false.
  // Campos novos da v6: respecFree só booleano (padrão true); redeas inteiro 0–999 (fora disso, 0); avisoV6 booleano.
  // v6 -> v7 (itens, loja e diária; spec 2026-11-16-itens-loja-diaria §10), em sanitize e gravado logo ao abrir: tudo novo
  // começa zerado, com a diária no dia 1 para resgatar; nada do save antigo muda. Campos novos da v7 (inteiro fora da
  // faixa, fração, texto, null ou objeto voltam ao padrão):
  //   state.mochila = { torrao, estrela, cupom, manual }: 0 a GameData.BAG_MAX (a Rédea nova fica em state.redeas);
  //   state.diaria = { prox: 0–6, ciclos: ≥ 0, ultimo: dia do último resgate | null };
  //   state.lojaItens = { dia: dia | null, comprados: { torrao, manual, cupom } (0 ao limite do dia), estrelaDia: dia | null };
  //   (dia ou limite corrompido num save v7 não libera nada: vale hojeDia() ou o limite; ver sanitize e Itens);
  //   state.itemCounter: usos sorteados (Cupom, Manual), inteiro ≥ 0; mount.torroes: 0 ao teto do Torrão;
  //   o deslocamento de dias da gaveta DEV: −400 a 400, só no save de teste (no jogo real o campo não existe; o nome
  //   fica nos blocos DEV, e o build.mjs falha se ele aparecer no jogo de produção).
  // v7 -> v8 (Ginásios da Expedição; spec 2026-11-17-ginasios §14), em sanitize e gravado logo ao abrir: os três ginásios
  // começam zerados (nenhuma etapa vencida) e o contador de desafios em 0; nada do save antigo muda (o que um save v7
  // tiver nesses campos não é lido). Campos novos da v8:
  //   state.ginasios = a forma de Ginasio.sanear: { fogo|agua|grama: { etapa: 0–5 (etapas vencidas; a insígnia é a etapa
  //     5, sem campo próprio), revDia: null | dia da última revanche, revVitorias: inteiro ≥ 0 } } — num save v8, lixo
  //     volta ao coerente pelo Ginasio.sanear (etapa fora de 0–5 vale 0; dia estragado vale hoje, "já tentou hoje", e é
  //     gravado consertado ao abrir, como a diária: ver start);
  //   state.gymCounter: desafios sorteados (a seed de cada duelo), inteiro ≥ 0 (lixo: 0).
  // Save de versão MAIOR que SAVE_VERSION (saveMaisNovo) nunca é adotado nem gravado por cima: tela de bloqueio.
  // Campo novo da v9 (skills com rank, 2026-11-19): cada montaria tem skillRanks = { id: 1..5 }, uma chave por skill de
  //   vaga. Save de antes da v9 (sem o campo): toda skill fica no rank 1, sem aviso. Em qualquer versão o campo passa
  //   pelo Itens.sanearRanks: rank ausente ou inválido (0, 7, "3", NaN) vale 1 e rank de skill que o cavalo não tem some.
  //   A mochila ganha o Pergaminho de técnica (ausente: 0).
  // v9 -> v10 (corrida AFK, 2026-11-23; spec afk-drops §6), em sanitize e gravado logo ao abrir: nada do save antigo muda.
  //   state.afk = a forma de Afk.sanear: { vagas: [{ uid, faseId, inicioMin, contador, medida }] (1 a 5; a 1ª já vem
  //     liberada, vazia), bau, vitorias: { faseId: n }, bestiario, aveiaMin, xpCounter }. Vaga com cavalo que não existe,
  //     fase ou dificuldade não liberada fica vazia (o contador da vaga fica); números fora da faixa voltam ao padrão.
  //   A mochila ganha os itens do AFK (GameData.ITEMS com `grupo`), cada um de 0 ao teto dele (cap).
  //   Cada peça ganha linhas: [{ tipo, valor }] e rerolls (inteiro ≥ 0). Peça de antes (sem linhas) ou com linhas
  //     inválidas recebe as linhas pela seed do save e pelo uid (Gear.linhasDaPeca: sempre as mesmas) e rerolls 0.
  var SAVE_VERSION = 10;
  var REDEAS_MAX = 999;
  var MOCHILA_IDS = GD.ITENS_USO.filter(function (id) { return id !== 'redea'; });   // torrao, estrela, cupom, manual, pergaminho
  // os itens do AFK (materiais, incomuns, comidas, Pergaminho de reforja, troféus): na mochila, cada um com o teto dele
  var AFK_IDS = Object.keys(GD.ITEMS).filter(function (id) { return !!GD.ITEMS[id].grupo; });
  var REROLLS_MAX = 1e6;
  // os itens à venda, na ordem fixa da loja (GameData.SHOP_ORDER, spec de itens §6: Torrão, Manual, Cupom, Estrela)
  var LOJA_ITENS = GD.SHOP_ORDER.filter(function (id) { return hasOwn(GD.ITEMS, id) && GD.ITEMS[id].price != null; });
  // os que têm limite por dia (perDay), tirados do catálogo (o itens.js lê os mesmos campos): torrao, manual, cupom
  var LOJA_LIMITADOS = LOJA_ITENS.filter(function (id) { return !!GD.ITEMS[id].perDay; });
  var DIA_MAX = IT.DIA_MAX;   // dia guardado no save: inteiro de 0 a este (diaLocal(9999, 11, 31))
  var BR = E.breeding;
  var MAX_LEVEL = E.maxLevel || 50;

  function instanceFromTemplate(tpl, uid) {
    return {
      uid: uid,
      templateId: tpl.id,
      name: tpl.name,
      especie: tpl.especie || 'cavalo',
      element: tpl.element,
      rarity: tpl.rarity,
      grau: tpl.grau || 2,
      sex: tpl.sex,
      level: 1,
      xp: 0,
      skills: tpl.skills.slice(),
      skillRanks: IT.sanearRanks(tpl.skills, tpl.skillRanks),   // modelo do catálogo: tudo no rank 1
      potential: clone(tpl.potential),
      alloc: zeroAlloc(),
      respecFree: true,   // a primeira redistribuição dos pontos é grátis (bloco 1b §9)
      torroes: 0,         // Torrões de açúcar usados (o potro nasce com 0)
      palette: tpl.palette ? clone(tpl.palette) : null,
      marcas: marcasDe(tpl.marcas, null, uid),
      porte: BRD.porteDe(tpl.porte, null, uid),   // o do modelo (todo modelo, do catálogo ou do painel DEV, tem um)
      breedLeft: tpl.breedLeftMax || GD.BREED_LEFT[tpl.sex],
      parents: null,
      born: 0,
      equip: GR.emptyEquip()
    };
  }

  // Marcas na pelagem (spec 2026-11-12-cavalos-marcas §2; só desenho, fora do Poder e da corrida): a regra é uma só,
  // Breed.marcasDe(marcas, templateId, chave) — as do cavalo, se válidas; senão as do modelo do catálogo; senão as
  // calculadas da chave (o uid). Sempre uma cópia com os três genes.
  function marcasDe(marcas, templateId, chave) { return BRD.marcasDe(marcas, templateId, chave); }
  // Jóquei do jogador (spec §4): padrão da seda e cor do capacete, só das listas de GameData.JOQUEI (a cor aceita
  // maiúsculas e fica como na lista); qualquer outra coisa (save de antes da 2a, lixo) volta ao jóquei inicial.
  function joqueiInicial() { return { padrao: GD.JOQUEI.padrao, capacete: GD.JOQUEI.capacete }; }
  function validJoquei(j) {
    if (!j || typeof j !== 'object') return joqueiInicial();
    var cap = typeof j.capacete === 'string' ? j.capacete.toLowerCase() : null;
    if (GD.JOQUEI.padroes.indexOf(j.padrao) < 0 || GD.JOQUEI.capacetes.indexOf(cap) < 0) return joqueiInicial();
    return { padrao: j.padrao, capacete: cap };
  }

  function zeroAlloc() {
    var a = {};
    STAT_KEYS.forEach(function (k) { a[k] = 0; });
    return a;
  }

  // cria uma peça +0 no save st (uid 'i' + nextItemUid) e devolve a instância
  // linhas: as que já vieram sorteadas (peça que caiu no AFK ou saiu da forja); sem elas, pela seed do save e pelo uid
  // origem: 'afk' (caiu no treino) ou 'forja'; ausente = comprada na loja ou de antes (só essa tem preço de venda)
  function addItem(st, id, linhas, origem) {
    var it = { uid: 'i' + st.nextItemUid, id: id, plus: 0, rerolls: 0 };
    if (origem) it.origem = origem;
    it.linhas = GR.linhasDaPeca({ uid: it.uid, id: id, linhas: linhas }, st.seedBase);
    st.items.push(it);
    st.nextItemUid += 1;
    return it;
  }

  function novo(starterId, ctx) {
    var idx = Math.max(0, GD.STARTERS.map(function (h) { return h.id; }).indexOf(starterId));
    var st = {
      v: SAVE_VERSION,
      rev: 0,
      gold: E.startingGold,
      tier: E.entryTiers[0],
      seedBase: ctx.seedNova(idx),
      raceCounter: 0,
      pending: null,
      races: 0, wins: 0, podiums: 0, goldWon: 0,
      mounts: [instanceFromTemplate(GD.STARTERS[idx], 'm1')],
      activeId: 'm1',
      nextUid: 2,
      stableSlots: BR.stableSlotsStart,
      breedCounter: 0,
      items: [],
      nextItemUid: 1,
      pedras: 0,
      enhanceCounter: 0,
      forjaCounter: 0,
      redeas: 0,          // Rédeas novas (bloco 1b §9): vêm no 7º dia da recompensa diária (e da gaveta DEV)
      avisoV6: false,     // aviso da migração v5 -> v6 ainda por mostrar (só em save migrado)
      mochila: mochilaVazia(),
      diaria: { prox: 0, ciclos: 0, ultimo: null },   // save novo: o dia 1 para resgatar
      lojaItens: lojaItensVazia(),
      itemCounter: 0,
      ginasios: GN.sanear(null, 0),   // os três ginásios sem nenhuma etapa vencida (revDia null: nunca tentou a revanche)
      gymCounter: 0,
      afk: null,          // posto logo abaixo (Afk.sanear: a 1ª vaga liberada e vazia, baú e bestiário vazios)
      settings: { motion: 'sistema' },
      joquei: joqueiInicial()
    };
    /*@dev:inicio*/
    if (ctx.dev) { st.devDias = 0; st.devMin = 0; }   // deslocamento de dias (e de minutos do AFK) da gaveta DEV: só no save de teste
    /*@dev:fim*/
    // equipamento inicial (+0) já equipado no inicial
    GE.startGear.forEach(function (id) {
      if (!hasOwn(GD.GEAR, id)) return;
      var it = addItem(st, id);
      st.mounts[0].equip[GD.GEAR[id].slot] = it.uid;
    });
    st.afk = AF.sanear(null, { uids: ['m1'], progresso: st.ginasios, agoraMin: ctx.agoraMin(st) });
    return st;
  }

  function mochilaVazia() {
    var mo = {};
    MOCHILA_IDS.forEach(function (id) { mo[id] = 0; });
    AFK_IDS.forEach(function (id) { mo[id] = 0; });
    return mo;
  }
  function lojaItensVazia() {
    var c = {};
    LOJA_LIMITADOS.forEach(function (id) { c[id] = 0; });
    return { dia: null, comprados: c, estrelaDia: null };
  }

  // Itens do save v1–v3 -> peça do catálogo novo (spec §11). null: sem peça (rapadura vira 3 Pedras Negras).
  var OLD_ITEM_MAP = {
    'ferradura-leve': 'ferraduras-comum',
    'ferradura-cravos': 'ferraduras-magico',
    'sela-couro': 'sela-comum',
    'manta-la': 'armadura-comum',
    'antolhos': 'testeira-comum',
    'esporas-prata': 'estribos-magico',
    'capa-impermeavel': 'armadura-magico',
    'figa-sorte': 'estribos-magico',
    'penas-gaviao': 'testeira-magico',
    'rapadura-engenho': null
  };
  var OLD_RAPADURA_PEDRAS = 3;

  function num(v, d, lo, hi) { v = Number(v); return isFinite(v) ? clamp(Math.floor(v), lo, hi) : d; }
  // inteiro de lo a hi, como está; qualquer outra coisa (fora da faixa, fração, texto, null, objeto) vale d
  function inteiroOu(v, d, lo, hi) { return typeof v === 'number' && v === Math.floor(v) && v >= lo && v <= hi ? v : d; }
  function objetoOu(o) { return o && typeof o === 'object' && !Array.isArray(o) ? o : null; }
  function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  // Status das 7 chaves, todos finitos; senão null (a montaria é descartada).
  function statBlock(o, lo, hi) {
    if (!o || typeof o !== 'object') return null;
    var out = {};
    for (var i = 0; i < STAT_KEYS.length; i++) {
      var v = Number(o[STAT_KEYS[i]]);
      if (o[STAT_KEYS[i]] == null || !isFinite(v)) return null;
      out[STAT_KEYS[i]] = clamp(Math.round(v), lo, hi);
    }
    return out;
  }
  var PALETTE_KEYS = ['coat', 'coatShade', 'mane', 'accent'];
  function validPalette(p) {
    if (!p || typeof p !== 'object') return null;
    var out = {};
    for (var i = 0; i < PALETTE_KEYS.length; i++) {
      var c = p[PALETTE_KEYS[i]];
      if (typeof c !== 'string' || !/^#[0-9a-f]{6}$/i.test(c)) return null;
      out[PALETTE_KEYS[i]] = c;
    }
    return out;
  }
  function validParent(p) {
    if (!p || typeof p !== 'object') return null;
    var uid = p.uid == null ? null : (typeof p.uid === 'string' ? p.uid.slice(0, 16) : undefined);
    var name = p.name == null ? null : (typeof p.name === 'string' ? p.name.slice(0, 16) : undefined);
    if (uid === undefined || name === undefined) return null;
    return { uid: uid, name: name };
  }
  function validParents(p) {
    if (!p || typeof p !== 'object') return null;
    var f = validParent(p.f), m = validParent(p.m);
    return f && m ? { f: f, m: m } : null;
  }

  // Cavalo Neutro (o tipo saiu na v3) vira Fogo, Água ou Grama: sorteio fixo pela seed do save e pelo
  // número do uid, sem RNG de jogo. Vale para save de qualquer versão; o convertido não é mais Neutro.
  var NEUTRO_PARA = ['fogo', 'agua', 'grama'];
  function neutroParaTipo(seedBase, uid) {
    return NEUTRO_PARA[(RS.hash2(seedBase >>> 0, Number(uid.slice(1))) >>> 0) % NEUTRO_PARA.length];
  }

  // Uma montaria do save v3+: tipos e faixas; campo essencial ausente ou genética inválida -> null.
  // seedBase: a seed do save (converte o Neutro); v6: o save já é v6 (antes dele, os pontos vêm zerados, todos
  // devolvidos, e a redistribuição grátis volta); v7: já é v7 (antes dele, sem torrões). Modelo fora do catálogo:
  // a montaria fica, sem modelo.
  function sanitizeMount(m, seedBase, v6, v7, dev) {
    if (!m || typeof m !== 'object') return null;
    if (typeof m.uid !== 'string' || !/^m\d{1,9}$/.test(m.uid)) return null;
    var element = m.element === 'neutro' ? neutroParaTipo(seedBase, m.uid) : m.element;
    if (typeof element !== 'string' || !hasOwn(GD.ELEMENTS, element)) return null;
    if (typeof m.rarity !== 'string' || !hasOwn(GD.RARITIES, m.rarity)) return null;
    if (m.sex !== 'm' && m.sex !== 'f') return null;
    // modelo que não existe mais (ou id inválido): fica sem modelo, como um potro (aparência pela paleta)
    var templateId = null;
    if (typeof m.templateId === 'string' && (horseById(m.templateId) || devTemplateId(dev, m.templateId))) templateId = m.templateId;
    var grau = num(m.grau, 2, 1, 3);
    var potential = statBlock(m.potential, 0, 31);
    if (!potential) return null;
    var name = typeof m.name === 'string' ? String(m.name).replace(/\s+/g, ' ').trim().slice(0, 16) : '';
    if (name.length < 2) name = 'Montaria';
    var out = {
      uid: m.uid,
      templateId: templateId,
      name: name,
      especie: 'cavalo',
      element: element,
      rarity: m.rarity,
      grau: grau,
      sex: m.sex,
      level: num(m.level, 1, 1, MAX_LEVEL),
      xp: num(m.xp, 0, 0, 1e7),
      skills: [],
      skillRanks: {},             // preenchido abaixo, depois das skills (a ordem das chaves é a do instanceFromTemplate)
      potential: potential,
      alloc: null,
      // só booleano; ausente ou lixo (e todo save de antes da v6): true
      respecFree: v6 && typeof m.respecFree === 'boolean' ? m.respecFree : true,
      torroes: v7 ? inteiroOu(m.torroes, 0, 0, GD.ITEMS.torrao.cap) : 0,   // antes do alloc: os torrões entram nos pontos
      palette: validPalette(m.palette),
      marcas: marcasDe(m.marcas, templateId, m.uid),   // sem versão nova: ausentes ou inválidas, as calculadas
      porte: BRD.porteDe(m.porte, templateId, m.uid),  // idem: ausente ou inválido, o do modelo ou o do uid
      breedLeft: num(m.breedLeft, GD.BREED_LEFT[m.sex], 0, 4),
      parents: validParents(m.parents),
      born: num(m.born, 0, 0, 1e9),
      // ('gestacao', gravado por saves antigos e nunca lido, fica de fora)
      equip: GR.emptyEquip()      // preenchido em sanitize(), que conhece as peças válidas
    };
    out.alloc = RS.validAlloc(out, v6 ? m.alloc : null);   // save antigo: zerado; inválido: cortado pelo teto e pelo custo
    out.skills = validSkills(m.skills, out, dev);
    out.skillRanks = IT.sanearRanks(out.skills, m.skillRanks);   // v9; save antigo (sem o campo): tudo no rank 1
    return out;
  }

  function sanitize(s, ctx) {
    if (!s || typeof s !== 'object') return null;
    descarte = { cavalos: 0, pecas: 0 };
    var mounts, activeId, nextUid, stableSlots, breedCounter;
    // saves de antes da D1 ficam com as vagas que tinham: até 8 (o máximo antigo) e, sem o campo (v1/v2), as 3 de início de então
    var start = BR.stableSlotsStart, max = BR.stableSlotsLegado, inicioAntigo = 3;
    var v3 = Number(s.v) >= 3, v4 = Number(s.v) >= 4, v6 = Number(s.v) >= 6, v7 = Number(s.v) >= 7, v8 = Number(s.v) >= 8, v10 = Number(s.v) >= 10;
    var seedBase = num(s.seedBase, null, 0, 4294967295);
    if (seedBase == null) seedBase = ctx.seedNova(0);
    var rawEquip = {};   // uid da montaria -> equip cru do save (validado depois das peças)
    if (!v3 && !Array.isArray(s.mounts)) {
      // v1/v2: um inicial com level/xp/skills na raiz (v1 tinha tática e não tinha skills: ignorados)
      var starter = GD.STARTERS.filter(function (h) { return h.id === s.starterId; })[0];
      if (!starter) return null;
      var m1 = instanceFromTemplate(starter, 'm1');
      m1.level = num(s.level, 1, 1, MAX_LEVEL);
      m1.xp = num(s.xp, 0, 0, 1e7);
      m1.skills = validSkills(s.skills, m1, ctx.dev);
      m1.skillRanks = IT.sanearRanks(m1.skills, null);
      mounts = [m1]; activeId = 'm1'; nextUid = 2; stableSlots = inicioAntigo; breedCounter = 0;
    } else {
      // v3+: mounts que não é array vira [] (recria o inicial e mantém o Ouro)
      mounts = [];
      var seen = {}, maxUid = 0;
      (Array.isArray(s.mounts) ? s.mounts : []).forEach(function (raw) {
        var m = sanitizeMount(raw, seedBase, v6, v7, ctx.dev);
        if (!m || seen[m.uid]) { if (raw && typeof raw === 'object') descarte.cavalos += 1; return; }
        seen[m.uid] = true;
        mounts.push(m);
        if (raw.equip && typeof raw.equip === 'object') rawEquip[m.uid] = raw.equip;
        if (/^m\d{1,9}$/.test(m.uid)) maxUid = Math.max(maxUid, Number(m.uid.slice(1)));
      });
      if (!mounts.length) { mounts.push(instanceFromTemplate(GD.STARTERS[0], 'm1')); maxUid = 1; }
      activeId = mounts.some(function (m) { return m.uid === s.activeId; }) ? s.activeId : mounts[0].uid;
      nextUid = Math.max(num(s.nextUid, 0, 0, 1e9), maxUid + 1);
      // perfil DEV: o painel cria cavalos sem limite de vagas (o estábulo cresce junto)
      stableSlots = clamp(num(s.stableSlots, inicioAntigo, 0, 1e9), Math.max(start, mounts.length), ctx.dev ? Math.max(max, mounts.length) : max);
      breedCounter = num(s.breedCounter, 0, 0, 1e9);
    }
    var base = novo(GD.STARTERS[0].id, ctx);
    base.rev = num(s.rev, 0, 0, 1e12);
    base.gold = num(s.gold, E.startingGold, 0, 1e9);
    base.tier = E.entryTiers.indexOf(s.tier) >= 0 ? s.tier : E.entryTiers[0];
    base.seedBase = seedBase;
    base.raceCounter = num(s.raceCounter, 0, 0, 1e9);
    var p = s.pending;
    if (p && typeof p === 'object' && isFinite(p.counter) && p.counter >= 1 && p.counter <= base.raceCounter) {
      var fee = num(p.fee, 0, 0, 1e6);
      if (p.training ? fee === 0 : E.entryTiers.indexOf(fee) >= 0) {
        base.pending = { counter: num(p.counter, 1, 1, 1e9), training: !!p.training, fee: fee, pr: num(p.pr, 600, 1, 1e5) };
        base.pending.gear = validGearSnapshot(p.gear);   // null: save de antes do retrato, ou retrato inválido
        // retrato dos pontos: saneado abaixo, quando a montaria ativa já está pronta (null: sala de antes dele)
        base.pending.alloc = p.alloc && typeof p.alloc === 'object' && !Array.isArray(p.alloc) ? p.alloc : null;
        // preparação (D2): prazo da largada (ms do relógio), o cavalo com que a sala abriu, o rank dos bots e os donos.
        // Ausentes (sala de antes da D2): nascem na próxima vez que a sala aparece (prepCompleta), com os 12 s cheios
        if (typeof p.prazo === 'number' && isFinite(p.prazo) && p.prazo > 0) base.pending.prazo = p.prazo;
        if (typeof p.uid === 'string') base.pending.uid = p.uid;
        if (typeof p.rank === 'number') base.pending.rank = num(p.rank, 1, 1, GD.SKILL_RANKS.max);
        if (Array.isArray(p.donos)) base.pending.donos = p.donos.filter(function (x) { return typeof x === 'string'; }).slice(0, 200);
      }
    }
    base.races = num(s.races, 0, 0, 1e9);
    base.wins = num(s.wins, 0, 0, 1e9);
    base.podiums = num(s.podiums, 0, 0, 1e9);
    base.goldWon = num(s.goldWon, 0, 0, 1e12);
    base.mounts = mounts;
    base.activeId = activeId;
    base.nextUid = nextUid;
    base.stableSlots = stableSlots;
    base.breedCounter = breedCounter;
    sanitizeGear(s, v4, base, rawEquip);   // peças, equipado e Pedras: guardados como estão (o equipamento está suspenso)
    // Rédeas novas: inteiro de 0 a 999; qualquer outra coisa (negativo, fração, texto, acima de 999) volta a 0.
    // Save de antes da v6: 0. Aviso da migração: pendente em todo save de antes da v6; na v6, só se gravado true.
    var rd = s.redeas;
    base.redeas = v6 && typeof rd === 'number' && rd === Math.floor(rd) && rd >= 0 && rd <= REDEAS_MAX ? rd : 0;
    base.avisoV6 = v6 ? s.avisoV6 === true : true;
    // Itens, loja e diária (v7): save de antes da v7 fica com o padrão do newState (tudo zerado, o dia 1 para resgatar)
    /*@dev:inicio*/
    if (ctx.dev) { base.devDias = inteiroOu(s.devDias, 0, -DEV_DIAS_MAX, DEV_DIAS_MAX); base.devMin = inteiroOu(s.devMin, 0, 0, DEV_MIN_MAX); }
    /*@dev:fim*/
    // Num save v7, dado de dia ou de limite corrompido não libera nada (Rulings 7 e 8): dia (ultimo, dia, estrelaDia)
    // que não é null nem inteiro de 0 a DIA_MAX vale hoje; compra do dia corrompida vale o limite; diária ou loja que
    // não é objeto é tudo isso junto. null continua sendo "nunca". Mochila, torrões e itemCounter corrompidos: 0.
    if (v7) {
      var hoje = ctx.hojeDia(base);
      var diaOu = function (x) { return x === null ? null : inteiroOu(x, hoje, 0, DIA_MAX); };
      var mch = objetoOu(s.mochila) || {}, di = objetoOu(s.diaria), lj = objetoOu(s.lojaItens), cp = lj && objetoOu(lj.comprados) || {};
      MOCHILA_IDS.forEach(function (id) { base.mochila[id] = inteiroOu(mch[id], 0, 0, GD.BAG_MAX); });
      if (v10) AFK_IDS.forEach(function (id) { base.mochila[id] = inteiroOu(mch[id], 0, 0, GD.ITEMS[id].cap); });
      base.diaria = {
        prox: inteiroOu(di && di.prox, 0, 0, GD.DAILY.dias.length - 1),
        ciclos: inteiroOu(di && di.ciclos, 0, 0, 1e9),
        ultimo: di ? diaOu(di.ultimo) : hoje
      };
      LOJA_LIMITADOS.forEach(function (id) { base.lojaItens.comprados[id] = inteiroOu(cp[id], GD.ITEMS[id].perDay, 0, GD.ITEMS[id].perDay); });
      base.lojaItens.dia = lj ? diaOu(lj.dia) : hoje;
      base.lojaItens.estrelaDia = lj ? diaOu(lj.estrelaDia) : hoje;
      base.itemCounter = inteiroOu(s.itemCounter, 0, 0, 1e9);
    }
    // Ginásios (v8): save de antes da v8 fica com o padrão do newState (tudo zerado). Num save v8, o Ginasio.sanear (dia
    // estragado vale hoje) e o contador inteiro ≥ 0 (lixo: 0)
    if (v8) {
      base.ginasios = GN.sanear(s.ginasios, ctx.hojeDia(base));
      base.gymCounter = inteiroOu(s.gymCounter, 0, 0, 1e9);
    }
    // Corrida AFK (v10): save de antes fica com o AFK vazio e a 1ª vaga liberada. Num save v10, o Afk.sanear (vaga de
    // cavalo que não existe ou de fase não liberada fica vazia; o resto, na faixa)
    base.afk = AF.sanear(v10 ? s.afk : null, { uids: base.mounts.map(function (m) { return m.uid; }), progresso: base.ginasios, agoraMin: ctx.agoraMin(base) });
    // Poder da sala (R16) = o maior entre o Poder do retrato dos pontos de quando a sala abriu (pending.alloc, tirado
    // em openLobby) e o Poder com que a ativa corre agora. Nem mais (liberaria pontos acima do que a sala viu) nem
    // menos (os rivais sairiam mais fracos). O equipamento não entra (spec 1b §8): o retrato dele (pending.gear) fica
    // guardado, sem efeito. O pr é sempre recalculado: um pr adulterado (para cima ou para baixo) volta ao do retrato, e
    // o de um save de antes da v6 (modelo de status antigo, com ou sem o retrato do equipamento) passa ao modelo novo
    // uma vez (o save migrado é gravado logo ao abrir). Antes da v6 os pontos foram todos devolvidos, então o retrato
    // vai a zero junto. Sem retrato (sala de antes dele, ou lixo que não é objeto) vale o alloc atual, uma vez: o
    // retrato passa a existir e vai na próxima gravação. Retrato com lixo é cortado (validAlloc) e só pode subir o
    // Poder da sala (rivais mais fortes: só atrapalha quem adulterou). Pelas travas da tela o Poder da ativa nunca
    // passa do da sala, então o max só corrige um retrato adulterado para baixo.
    if (base.pending) {
      var act = null, orig = null;
      base.mounts.forEach(function (m) { if (m.uid === base.activeId) act = m; if (m.uid === base.pending.uid) orig = m; });
      // o retrato dos pontos é do cavalo com que a sala abriu (D2: a ativa pode ter sido trocada na preparação)
      if (!orig) { delete base.pending.uid; orig = act; }
      base.pending.alloc = RS.validAlloc(orig, v6 ? (base.pending.alloc || orig.alloc) : null);
      var retrato = clone(orig);
      retrato.alloc = base.pending.alloc;
      base.pending.pr = Math.max(RS.powerRating(retrato), RS.powerRating(act));
    }
    // preferências (sem mudar a versão do save): save antigo sem settings, ou com valor inválido, segue o sistema
    var mo = s.settings && typeof s.settings === 'object' ? s.settings.motion : null;
    base.settings = { motion: MOTIONS.indexOf(mo) >= 0 ? mo : 'sistema' };
    base.joquei = validJoquei(s.joquei);   // idem: sem jóquei (save de antes da 2a) ou inválido, o inicial
    return base;
  }

  // retrato salvo: peças do catálogo no slot certo, +N válido, um por slot; qualquer coisa fora disso -> null
  function validGearSnapshot(arr) {
    if (!Array.isArray(arr) || arr.length > GR.SLOTS.length) return null;
    var out = [], seen = {};
    for (var i = 0; i < arr.length; i++) {
      var p = arr[i];
      if (!p || typeof p !== 'object' || GR.SLOTS.indexOf(p.slot) < 0 || seen[p.slot]) return null;
      if (typeof p.id !== 'string' || !hasOwn(GD.GEAR, p.id) || GD.GEAR[p.id].slot !== p.slot) return null;
      if (!(typeof p.plus === 'number' && p.plus === Math.floor(p.plus) && p.plus >= 0 && p.plus <= GE.plusMax)) return null;
      seen[p.slot] = true;
      out.push({ slot: p.slot, id: p.id, plus: p.plus });
    }
    return out;
  }

  // Peças, pedras e equipamento (sobrescreve o equipamento inicial de newState). v4: lê s.items;
  // v1–v3: migra s.inventory/s.equipped. Peça inválida (uid, id, plus ou uid repetido) some em silêncio;
  // equip só aponta para peça existente, do slot certo, e cada peça fica em uma montaria só
  // (vence a primeira na ordem de mounts). Nunca mexe no Ouro.
  function sanitizeGear(s, v4, base, rawEquip) {
    var items = [], byUid = {}, maxItemUid = 0, pedras = num(s.pedras, 0, 0, 1e6);
    var legacyEquip = null;   // peça migrada do antigo 'equipped' (vai para a montaria ativa)
    if (v4) {
      (Array.isArray(s.items) ? s.items : []).forEach(function (it) {
        if (!it || typeof it !== 'object') return;
        var p = it.plus;
        if (typeof it.uid !== 'string' || !/^i\d{1,9}$/.test(it.uid) || hasOwn(byUid, it.uid) ||
          typeof it.id !== 'string' || !hasOwn(GD.GEAR, it.id) ||
          !(typeof p === 'number' && p === Math.floor(p) && p >= 0 && p <= GE.plusMax)) { descarte.pecas += 1; return; }
        var out = { uid: it.uid, id: it.id, plus: p, rerolls: inteiroOu(it.rerolls, 0, 0, REROLLS_MAX) };
        if (it.origem === 'afk' || it.origem === 'forja') out.origem = it.origem;   // veio do treino ou da forja: sem preço de venda
        out.linhas = GR.linhasDaPeca(it, base.seedBase);   // v10; peça de antes (ou com lixo): pela seed do save e pelo uid
        items.push(out);
        byUid[out.uid] = out;
        maxItemUid = Math.max(maxItemUid, Number(out.uid.slice(1)));
      });
    } else {
      pedras = 0;
      var n = 0;
      (Array.isArray(s.inventory) ? s.inventory : []).forEach(function (oldId) {
        if (typeof oldId !== 'string') return;
        if (!hasOwn(OLD_ITEM_MAP, oldId)) { descarte.pecas += 1; return; }
        var newId = OLD_ITEM_MAP[oldId];
        if (newId === null) { pedras += OLD_RAPADURA_PEDRAS; return; }
        if (!hasOwn(GD.GEAR, newId)) { descarte.pecas += 1; return; }
        n += 1;
        var out = { uid: 'i' + n, id: newId, plus: 0, rerolls: 0 };
        out.linhas = GR.linhasDaPeca(out, base.seedBase);
        items.push(out);
        byUid[out.uid] = out;
        if (oldId === s.equipped && !legacyEquip) legacyEquip = out;
      });
      maxItemUid = n;
      pedras = Math.min(pedras, 1e6);
    }
    var taken = {};
    base.mounts.forEach(function (m) {
      var raw = v4 && hasOwn(rawEquip, m.uid) ? rawEquip[m.uid] : null;
      var eq = GR.emptyEquip();
      GR.SLOTS.forEach(function (slot) {
        var uid = raw ? raw[slot] : null;
        if (typeof uid !== 'string' || !hasOwn(byUid, uid) || taken[uid]) return;
        if (GD.GEAR[byUid[uid].id].slot !== slot) return;
        eq[slot] = uid;
        taken[uid] = true;
      });
      m.equip = eq;
    });
    if (legacyEquip) {
      var act = null;
      base.mounts.forEach(function (m) { if (m.uid === base.activeId) act = m; });
      if (act) act.equip[GD.GEAR[legacyEquip.id].slot] = legacyEquip.uid;
    }
    base.items = items;
    base.nextItemUid = v4 ? Math.max(num(s.nextItemUid, 0, 0, 1e9), maxItemUid + 1) : maxItemUid + 1;
    base.pedras = pedras;
    base.enhanceCounter = v4 ? num(s.enhanceCounter, 0, 0, 1e9) : 0;
    base.forjaCounter = v4 ? num(s.forjaCounter, 0, 0, 1e9) : 0;   // peças forjadas (a seed das linhas; nunca volta)
  }

  // Skills salvas de uma montaria: só ids que ela pode ter (mesmas regras do RaceSim.learnSkill:
  // elemento dela ou geral), sem repetir, até o nº de vagas da raridade.
  // Ausente/vazio/inválido -> as skills de nascença do template (potro sem template: nenhuma).
  // As skills de tipo de saves antigos (Labareda, Maré Alta, Raízes Firmes) não são de vaga e saem da lista;
  // uma lista que só tinha elas fica vazia (não volta para as de nascença).
  // Perfil DEV: qualquer skill do catálogo (o painel dá de outro elemento), ainda até as vagas.
  var TYPE_SKILL_IDS = Object.keys(GD.TYPE_SKILLS).map(function (e) { return GD.TYPE_SKILLS[e].id; });
  function validSkills(list, mount, dev) {
    var st = mount.templateId ? horseById(mount.templateId) : null;
    var slots = (GD.RARITIES[mount.rarity] || GD.RARITIES.comum).skillSlots;
    var out = [];
    if (Array.isArray(list)) {
      list.forEach(function (id) {
        var sk = typeof id === 'string' && hasOwn(GD.SKILLS, id) ? GD.SKILLS[id] : null;
        if (!sk || out.indexOf(id) >= 0 || out.length >= slots) return;
        if (!dev && sk.element !== 'geral' && sk.element !== mount.element) return;
        out.push(id);
      });
    }
    var tinhaTipo = Array.isArray(list) && list.some(function (id) { return TYPE_SKILL_IDS.indexOf(id) >= 0; });
    return out.length || tinhaTipo ? out : (st ? st.skills.slice() : []);
  }

  // ---------------------------------------------------------------------------------------------------------
  // O código do progresso (T7, spec 2026-11-27-t7-exportar-importar): o save em texto para guardar fora do jogo.
  // CODIGO_PREFIXO + o save (JSON em UTF-8) em base64 + '.' + a soma de conferência (FNV-1a de 32 bits do base64, em 8
  // dígitos hexadecimais). A soma só pega código cortado ou com erro de cópia: não protege contra edição (offline, quem
  // quiser editar o save já consegue pelo navegador). Sem btoa nem Buffer: o mesmo código no navegador e no Node.
  // ---------------------------------------------------------------------------------------------------------
  var CODIGO_PREFIXO = 'GALOPE1.';
  var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  function paraUtf8(str) {
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
        var d = str.charCodeAt(i + 1);
        if (d >= 0xdc00 && d <= 0xdfff) { c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00); i++; }
      }
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
  }
  // bytes em UTF-8 -> texto; null se a sequência não é UTF-8 válido
  function deUtf8(b) {
    var s = '', i = 0;
    while (i < b.length) {
      var c = b[i], n = c < 0x80 ? 0 : c < 0xc0 ? -1 : c < 0xe0 ? 1 : c < 0xf0 ? 2 : c < 0xf8 ? 3 : -1;
      if (n < 0 || i + n >= b.length) return null;
      var cp = n === 0 ? c : n === 1 ? c & 31 : n === 2 ? c & 15 : c & 7;
      for (var k = 1; k <= n; k++) { if ((b[i + k] & 0xc0) !== 0x80) return null; cp = (cp << 6) | (b[i + k] & 63); }
      if (cp > 0x10ffff) return null;
      if (cp >= 0x10000) { cp -= 0x10000; s += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 1023)); }
      else s += String.fromCharCode(cp);
      i += n + 1;
    }
    return s;
  }
  function paraBase64(b) {
    var s = '';
    for (var i = 0; i < b.length; i += 3) {
      var x = (b[i] << 16) | ((b[i + 1] || 0) << 8) | (b[i + 2] || 0);
      s += B64[(x >> 18) & 63] + B64[(x >> 12) & 63] + (i + 1 < b.length ? B64[(x >> 6) & 63] : '=') + (i + 2 < b.length ? B64[x & 63] : '=');
    }
    return s;
  }
  // base64 -> bytes; null se não é base64 bem formado
  function deBase64(s) {
    if (!s.length || s.length % 4) return null;
    var out = [];
    for (var i = 0; i < s.length; i += 4) {
      var q = [0, 1, 2, 3].map(function (k) { return s[i + k] === '=' ? -2 : B64.indexOf(s[i + k]); });
      if (q[0] < 0 || q[1] < 0 || q[2] === -1 || q[3] === -1 || (q[2] === -2 && q[3] !== -2) || ((q[2] === -2 || q[3] === -2) && i + 4 < s.length)) return null;
      var x = (q[0] << 18) | (q[1] << 12) | (Math.max(q[2], 0) << 6) | Math.max(q[3], 0);
      out.push((x >> 16) & 255);
      if (q[2] >= 0) out.push((x >> 8) & 255);
      if (q[3] >= 0) out.push(x & 255);
    }
    return out;
  }
  function somaCodigo(s) {
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8);
  }
  // o save -> o código do progresso
  function codigo(state) {
    var b = paraBase64(paraUtf8(JSON.stringify(state)));
    return CODIGO_PREFIXO + b + '.' + somaCodigo(b);
  }
  // o texto colado -> { save } (o objeto lido, ainda SEM sanear nem conferir a versão: quem chama faz as duas coisas) ou
  // { erro: 'formato' (não é um código do jogo) | 'soma' (cortado ou com erro de cópia) | 'ilegivel' (a soma bate, mas o
  // conteúdo não é um JSON) }. Espaços e quebras de linha no meio (o mensageiro que quebra o texto) não contam.
  function lerCodigo(txt) {
    var t = String(txt == null ? '' : txt).replace(/\s+/g, '');
    if (t.indexOf(CODIGO_PREFIXO) !== 0) return { erro: 'formato' };
    var resto = t.slice(CODIGO_PREFIXO.length), p = resto.lastIndexOf('.');
    if (p < 0) return { erro: 'soma' };
    var b = resto.slice(0, p);
    if (!/^[0-9a-f]{8}$/i.test(resto.slice(p + 1)) || somaCodigo(b) !== resto.slice(p + 1).toLowerCase()) return { erro: 'soma' };
    var bytes = deBase64(b), json = bytes && deUtf8(bytes);
    if (json == null) return { erro: 'ilegivel' };
    try { return { save: JSON.parse(json) }; } catch (e) { return { erro: 'ilegivel' }; }
  }

  function sanear(s, ctx) {
    var st = sanitize(s, ctx);
    return { state: st, descarte: descarte };
  }

  var Save = {
    SAVE_VERSION: SAVE_VERSION, REDEAS_MAX: REDEAS_MAX, DEV_DIAS_MAX: DEV_DIAS_MAX, DEV_MIN_MAX: DEV_MIN_MAX, MOTIONS: MOTIONS,
    MOCHILA_IDS: MOCHILA_IDS, AFK_IDS: AFK_IDS, LOJA_ITENS: LOJA_ITENS, LOJA_LIMITADOS: LOJA_LIMITADOS,
    sanear: sanear, novo: novo, codigo: codigo, lerCodigo: lerCodigo, CODIGO_PREFIXO: CODIGO_PREFIXO,
    instanceFromTemplate: instanceFromTemplate, addItem: addItem, zeroAlloc: zeroAlloc, marcasDe: marcasDe,
    joqueiInicial: joqueiInicial, validJoquei: validJoquei, validSkills: validSkills, mochilaVazia: mochilaVazia,
    lojaItensVazia: lojaItensVazia
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Save;
  else root.Save = Save;
})(typeof self !== 'undefined' ? self : this);
