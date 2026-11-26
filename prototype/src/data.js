/*
 * MMORPG Horse — dados do protótipo (descartável).
 *
 * Tudo que é texto de jogo está em português do Brasil.
 * Identificadores de código: inglês para estrutura (id, name, potential...),
 * ids de conteúdo em português sem acento ('mare', 'ipe', 'raizes-firmes').
 *
 * UMD: no browser vira window.GameData; no Node, module.exports.
 */
(function (root) {
  'use strict';

  // ---------------------------------------------------------------------------
  // Elementos
  // Três tipos (v3). Sem bônus fixo de status: o que distingue o tipo é o clima e a skill de tipo.
  //   weather: clima "dono" do elemento (WEATHERS[w].element aponta de volta).
  // ---------------------------------------------------------------------------
  var ELEMENTS = {
    fogo: {
      id: 'fogo', name: 'Fogo', color: '#e8541e', icon: 'fire',
      weather: 'sol',
      desc: 'Explosivo na largada: a Labareda acelera o primeiro terço. Brilha no sol; sofre com chuva.'
    },
    agua: {
      id: 'agua', name: 'Água', color: '#2f8fd8', icon: 'water',
      weather: 'chuva',
      desc: 'Forte no fim: a Maré Alta empurra o último terço. Cresce na chuva; sofre na névoa.'
    },
    grama: {
      id: 'grama', name: 'Grama', color: '#4caf3a', icon: 'leaf',
      weather: 'nevoa',
      desc: 'Firme como raiz: as Raízes Firmes seguram o terço do meio. Domina a névoa; murcha no sol.'
    }
  };

  // ---------------------------------------------------------------------------
  // Raridades
  //   ptsMult: fator da raridade nos pontos por nível (RaceSim.freePoints).
  //   skillSlots: nº máximo de habilidades; bornSkills: nº MÍNIMO ao nascer (o potro completa
  //   com skills compatíveis até esse número, limitado às vagas);
  //   baseLo: início da faixa de 16 pontos (RaceSim.TUNING.gBand) onde nasce cada status, conforme a
  //   genética: base = baseLo + 16 × g / 31 (nada cresce sozinho com o nível; o resto são pontos comprados).
  // ---------------------------------------------------------------------------
  var RARITIES = {
    comum:    { id: 'comum',    name: 'Comum',    color: '#9e9e9e', ptsMult: 1.00, skillSlots: 1, bornSkills: 1, order: 0, baseLo: 40 },
    magico:   { id: 'magico',   name: 'Mágico',   color: '#4caf50', ptsMult: 1.05, skillSlots: 2, bornSkills: 1, order: 1, baseLo: 44 },
    raro:     { id: 'raro',     name: 'Raro',     color: '#2196f3', ptsMult: 1.10, skillSlots: 3, bornSkills: 2, order: 2, baseLo: 49 },
    lendario: { id: 'lendario', name: 'Lendário', color: '#ff9800', ptsMult: 1.15, skillSlots: 4, bornSkills: 2, order: 3, baseLo: 54 },
    mitico:   { id: 'mitico',   name: 'Mítico',   color: '#9c27b0', ptsMult: 1.20, skillSlots: 5, bornSkills: 3, order: 4, baseLo: 60 }
  };

  // ---------------------------------------------------------------------------
  // Explicações curtas ("ⓘ" ao lado dos rótulos; o wiki usa os mesmos textos). Uma frase de até ~140
  // caracteres, sem número que não venha do código. Os 7 primeiros são os da spec do bloco 1b §11.
  // ---------------------------------------------------------------------------
  var HELP = {
    vel: 'Velocidade máxima nas retas. É o status que mais pesa numa reta longa.',
    acel: 'Quão rápido chega à velocidade máxima na largada e depois de perder ritmo.',
    man: 'Rendimento nas curvas: quem tem mais perde menos velocidade nelas.',
    forca: 'Rendimento nas subidas, nos pisos pesados e para passar pelo pelotão.',
    est: 'Fôlego para manter o ritmo até o fim; também deixa correr mais forte no meio e no sprint.',
    garra: 'Força média da arrancada final, que acontece sempre; com mais Garra ela começa mais cedo e empurra mais.',
    sorte: 'Vem do nascimento e não recebe pontos. Chance de jogar o Dado da Sorte duas vezes.',
    genetica: 'Nota S, A, B ou C: o quanto o status já nasce alto. Vem do nascimento e não muda.',
    estrelas: 'Grau do cavalo, de 1 a 3 estrelas: mais estrelas, mais pontos para distribuir a cada nível.',
    raridade: 'Quanto mais rara, mais pontos por nível, mais vagas de skill e status que já nascem mais altos.',
    skillTipo: 'Uma por elemento, sempre ativa num terço da pista: os dois status do tipo valem mais naquele trecho.',
    poder: 'Nota da força geral do cavalo, calculada dos status, das skills, do nível e da raridade. Define a liga e os rivais da sala.',
    liga: 'Faixa do Poder, para comparar cavalos. Os rivais da sala vêm do seu Poder, não da liga.',
    clima: 'Cada elemento rende mais no seu clima e menos no clima ruim. O Dado da Sorte pode virar o clima na corrida.',
    piso: 'Piso mais pesado tira velocidade e gasta mais fôlego; a Força ajuda a perder menos.',
    dado: 'Duas vezes por corrida, quem tira o maior dado puxa o clima para o seu elemento. Sorte alta rola dois dados.',
    custo: 'O custo de cada ponto sobe a cada 10 pontos comprados no mesmo status. Os pontos que sobram ficam guardados para depois.',
    redea: 'Devolve todos os pontos para você distribuir de novo. A primeira de cada cavalo é grátis; depois gasta 1 Rédea nova.',
    rank: 'Skill de vaga ativa sempre. O rank (I a V) dá +15% de efeito por passo e, no V, um marco. Sobe com Ouro e Pergaminhos de técnica, sem falhar e sem volta.'
  };

  var STAT_KEYS = ['vel', 'acel', 'man', 'forca', 'est', 'garra', 'sorte'];

  var STATS = {
    vel:   { id: 'vel',   name: 'Velocidade', short: 'VEL', desc: HELP.vel },
    acel:  { id: 'acel',  name: 'Aceleração', short: 'ACE', desc: HELP.acel },
    man:   { id: 'man',   name: 'Manobra',    short: 'MAN', desc: HELP.man },
    forca: { id: 'forca', name: 'Força',      short: 'FOR', desc: HELP.forca },
    est:   { id: 'est',   name: 'Estamina',   short: 'EST', desc: HELP.est },
    garra: { id: 'garra', name: 'Garra',      short: 'GAR', desc: HELP.garra },
    sorte: { id: 'sorte', name: 'Sorte',      short: 'SOR', desc: HELP.sorte }
  };

  // slow: perda de velocidade (aliviada por Força); drain: gasto extra de estamina.
  var SURFACES = {
    grama: { id: 'grama', name: 'Grama', color: '#5fa34a', slow: 0.00, drain: 1.00, desc: 'Pista leve.' },
    terra: { id: 'terra', name: 'Terra', color: '#9a6b3f', slow: 0.03, drain: 1.05, desc: 'Pista média: Força ajuda.' },
    areia: { id: 'areia', name: 'Areia', color: '#e2c27a', slow: 0.06, drain: 1.12, desc: 'Pista pesada: Força ajuda muito.' }
  };

  // Cada clima tem um elemento dono (bônus) e um penalizado.
  var WEATHERS = {
    sol:     { id: 'sol',     name: 'Sol',     icon: 'sun',   element: 'fogo',  penalizes: 'grama', desc: 'Favorece Fogo; Grama murcha.' },
    chuva:   { id: 'chuva',   name: 'Chuva',   icon: 'rain',  element: 'agua',  penalizes: 'fogo',  desc: 'Favorece Água; Fogo apaga.' },
    nevoa:   { id: 'nevoa',   name: 'Névoa',   icon: 'fog',   element: 'grama', penalizes: 'agua',  desc: 'Favorece Grama; Água perde o rumo.' },
    nublado: { id: 'nublado', name: 'Nublado', icon: 'cloud', element: null,    penalizes: null,    desc: 'Condição neutra: ninguém é favorecido.' }
  };

  var BLOCK_TYPES = {
    reta:   { id: 'reta',   name: 'Reta',   color: '#f6f2ea' },
    curva:  { id: 'curva',  name: 'Curva',  color: '#7ab8ff' },
    subida: { id: 'subida', name: 'Subida', color: '#f2c230' }
  };

  // ---------------------------------------------------------------------------
  // Skill de tipo (v3): uma por elemento, em vaga própria, sempre ativa e sem sorteio no terço
  // `zone` da distância ([início, fim] em fração de D). Os valores valem com força P = 1 e são
  // multiplicados por P = RaceSim.typePower (varia com nível e raridade, por tipo):
  //   statMul: no terço, os dois status do tipo (Fogo Vel/Ace, Água Est/Gar, Grama For/Man) valem × (1 + x·P);
  //   (chaves antigas ainda aceitas pela corrida: accelMult, speedMult, drainCut, forcaAdd, manAdd, staminaRestore).
  //   short: nome de até 12 letras para o balão da corrida.
  // ---------------------------------------------------------------------------
  var TYPE_SKILLS = {
    fogo: {
      id: 'labareda', name: 'Labareda', short: 'LABAREDA', zone: [0, 1 / 3],
      effect: { statMul: 0.19 },
      desc: 'No primeiro terço da pista, a largada pega fogo: Velocidade e Aceleração valem +19% com intensidade ×1 (varia com nível e raridade).'
    },
    grama: {
      id: 'raizes-firmes', name: 'Raízes Firmes', short: 'RAÍZES FIRM.', zone: [1 / 3, 2 / 3],
      effect: { statMul: 0.15 },
      desc: 'No terço do meio, finca os cascos: Força e Manobra valem +15% com intensidade ×1 (varia com nível e raridade).'
    },
    agua: {
      id: 'mare-alta', name: 'Maré Alta', short: 'MARÉ ALTA', zone: [2 / 3, 1],
      effect: { statMul: 0.33 },
      desc: 'No último terço, a maré sobe: Estamina e Garra valem +33% com intensidade ×1 (cresce com a raridade).'
    }
  };

  // ---------------------------------------------------------------------------
  // Habilidades
  //   trigger: 'start' | 'straight' (reta de 150 m ou mais, fora a da largada) | 'curve' | 'curveExit'
  //            | 'hill' | 'lowStamina' (<=30%) | 'final' (onde começa a arrancada do cavalo, garraFrom) | 'dice' (uma tentativa,
  //            antes do 1º Dado) | 'weather:<sol|chuva|nevoa>'
  //   resumo: o que a skill faz em poucas palavras, sem números (a tela mostra o nome, o rank e o resumo; o texto completo
  //            com os números do rank abre por toque, mouse ou foco; ajustes 1, 2026-11-23)
  //   effect (chaves usadas):
  //     accelMult / speedMult: multiplicadores; drainMult: gasto de estamina;
  //     distanceM / durationS: duração do efeito em metros ou segundos;
  //     curveBonus / hillBonus / hillDrainMult: bônus nos blocos de curva/subida;
  //     blockScoped: vale uma vez por bloco (curva/subida), não uma vez por corrida;
  //     staminaRestore: recupera fração do tanque (instantâneo);
  //     garraBoostBonus: soma à força da arrancada de Garra (que acontece sempre);
  //     extraDice: dados extras no Dado da Sorte (cada um de 1 até SKILL_RANKS.diceTeto do rank);
  //     weatherBonus: soma ao bônus do clima do próprio elemento (×1,03 → ×(1,03 + bônus)).
  //   Os valores de effect são os do RANK 1; RaceSim.skillEffect(id, rank) dá os do rank (escala SKILL_RANKS.step
  //   só na parte de bônus; duração e distância não crescem).
  //   rank5: o marco do rank 5, somado ao efeito já escalado. durationS, lowStaminaAt (gatilho do Segundo Ar),
  //     minStraightM (reta mínima do Sprint) e extraDice substituem; multiplicadores se multiplicam; staminaRestore
  //     soma; exitRestore: recupera ao sair da subida; weatherLingerS: o reforço do clima dura mais N s depois
  //     de o clima mudar; untilFinish: o efeito vale até a chegada.
  //   short (opcional): nome de até 12 letras para o balão da corrida (só apresentação, não é regra).
  //   element: 'geral' (qualquer tipo aprende) ou o tipo que aprende.
  // ---------------------------------------------------------------------------
  // Ranks das skills de vaga (por cavalo, em horse.skillRanks): 1 a max. O fator do rank r é 1 + step × (r − 1).
  // custo[r]: Ouro e Pergaminhos de técnica (e, do IV para o V, Selos do campeão) para subir de r para r + 1 (sem sorteio). diceTeto[r − 1]: até quanto
  // rola o dado extra do Dado Viciado.
  var SKILL_RANKS = {
    max: 5, step: 0.15,
    custo: { 1: { ouro: 150, perg: 1 }, 2: { ouro: 400, perg: 2 }, 3: { ouro: 900, perg: 4 }, 4: { ouro: 2000, perg: 7, selo: 1 } },
    diceTeto: [60, 70, 80, 90, 100]
  };
  var SKILLS = {
    // --- Gerais (qualquer tipo) ---
    'arranque': {
      id: 'arranque', name: 'Arranque', element: 'geral', trigger: 'start',
      resumo: 'Aceleração na largada',
      desc: 'Largada explosiva: +10,8% de aceleração nos primeiros 100 m.',
      effect: { accelMult: 1.108, distanceM: 100 },
      rank5: { speedMult: 1.03 }
    },
    'sprint': {
      id: 'sprint', name: 'Sprint', element: 'geral', trigger: 'straight',
      resumo: 'Velocidade nas retas longas',
      desc: 'Numa reta de 150 m ou mais (fora a da largada): +4% de velocidade por 150 m.',
      effect: { speedMult: 1.04, distanceM: 150 },
      rank5: { minStraightM: 100 }
    },
    'drift': {
      id: 'drift', name: 'Drift', element: 'geral', trigger: 'curve',
      resumo: 'Rende mais nas curvas',
      desc: 'Em cada curva: +1,3% de rendimento na curva.',
      effect: { curveBonus: 0.013, blockScoped: true },
      rank5: { drainMult: 0.85 }
    },
    'saida-rapida': {
      id: 'saida-rapida', name: 'Saída Rápida', element: 'geral', trigger: 'curveExit',
      resumo: 'Dispara ao sair da curva',
      desc: 'Ao sair da curva: +32% de aceleração e +4,5% de velocidade por 6s.',
      effect: { accelMult: 1.32, speedMult: 1.045, durationS: 6 },
      rank5: { durationS: 7 }
    },
    'folego-de-montanha': {
      id: 'folego-de-montanha', name: 'Fôlego de Montanha', short: 'FÔLEGO MONT.', element: 'geral', trigger: 'hill',
      resumo: 'Poupa fôlego nas subidas',
      desc: 'Em cada subida: gasta 70% menos estamina extra da subida.',
      effect: { hillDrainMult: 0.3, blockScoped: true },
      rank5: { exitRestore: 0.03 }
    },
    'segundo-ar': {
      id: 'segundo-ar', name: 'Segundo Ar', element: 'geral', trigger: 'lowStamina',
      resumo: 'Recupera o fôlego ao cansar',
      desc: 'Quando a estamina cai a 30%, recupera 10% e ganha +3% de velocidade por 8s.',
      effect: { staminaRestore: 0.1, speedMult: 1.03, durationS: 8 },
      rank5: { lowStaminaAt: 0.35 }
    },
    'arrancada-final': {
      id: 'arrancada-final', name: 'Arrancada Final', short: 'ARR. FINAL', element: 'geral', trigger: 'final',
      resumo: 'Garra mais forte no fim',
      desc: 'Na reta final: +2,8% de força na arrancada de Garra.',
      effect: { garraBoostBonus: 0.028 },
      rank5: { speedMult: 1.01, untilFinish: true }
    },
    'dado-viciado': {
      id: 'dado-viciado', name: 'Dado Viciado', element: 'geral', trigger: 'dice',
      resumo: 'Dado extra no Dado da Sorte',
      desc: 'Antes do 1º Dado da Sorte: rola 1 dado extra, de 1 a 60, em todos os Dados da corrida.',
      effect: { extraDice: 1 },
      rank5: { extraDice: 2 }
    },
    // --- Fogo ---
    'sol-a-pino': {
      id: 'sol-a-pino', name: 'Sol a Pino', element: 'fogo', trigger: 'weather:sol',
      resumo: 'Fogo mais forte com sol',
      desc: 'Com sol: o bônus do clima para o Fogo sobe de +3% para +7%.',
      effect: { weatherBonus: 0.04 },
      rank5: { weatherLingerS: 15 }
    },
    'chama-final': {
      id: 'chama-final', name: 'Chama Final', element: 'fogo', trigger: 'final',
      resumo: 'Velocidade na reta final',
      desc: 'Na reta final: +4% de velocidade por 9,5s.',
      effect: { speedMult: 1.04, durationS: 9.5 },
      rank5: { durationS: 11 }
    },
    // --- Água ---
    'pe-na-chuva': {
      id: 'pe-na-chuva', name: 'Pé na Chuva', element: 'agua', trigger: 'weather:chuva',
      resumo: 'Água mais forte com chuva',
      desc: 'Com chuva: o bônus do clima para a Água sobe de +3% para +7%.',
      effect: { weatherBonus: 0.04 },
      rank5: { weatherLingerS: 15 }
    },
    'canto-da-iara': {
      id: 'canto-da-iara', name: 'Canto da Iara', short: 'CANTO IARA', element: 'agua', trigger: 'final',
      resumo: 'Velocidade e fôlego no fim',
      desc: 'Na reta final: +4% de velocidade e 20% menos gasto de estamina por 9s.',
      effect: { speedMult: 1.04, drainMult: 0.8, durationS: 9 },
      rank5: { staminaRestore: 0.05 }
    },
    'nascente': {
      id: 'nascente', name: 'Nascente', element: 'agua', trigger: 'straight',
      resumo: 'Recupera fôlego nas retas',
      desc: 'Numa reta de 150 m ou mais (fora a da largada): recupera 4,5% de estamina.',
      effect: { staminaRestore: 0.045 },
      rank5: { speedMult: 1.03, durationS: 4 }
    },
    // --- Grama ---
    'nevoa-amiga': {
      id: 'nevoa-amiga', name: 'Névoa Amiga', element: 'grama', trigger: 'weather:nevoa',
      resumo: 'Grama mais forte com névoa',
      desc: 'Com névoa: o bônus do clima para a Grama sobe de +3% para +7%.',
      effect: { weatherBonus: 0.04 },
      rank5: { weatherLingerS: 15 }
    },
    'casco-firme': {
      id: 'casco-firme', name: 'Casco Firme', element: 'grama', trigger: 'hill',
      resumo: 'Rende mais nas subidas',
      desc: 'Em cada subida: +1,2% de rendimento na subida.',
      effect: { hillBonus: 0.012, blockScoped: true },
      rank5: { hillDrainMult: 0.7 }
    }
  };

  // ---------------------------------------------------------------------------
  // Montarias (espécie 'cavalo')
  //   potential = genética, 0–31 por status: define onde o status nasce na faixa da raridade
  //   (RaceSim.naturalStat). Não há status base guardado.
  //   alloc (no save, não no catálogo) = pontos comprados por status (custo por faixa; RaceSim.validAlloc).
  //   sex: 'm' | 'f'.
  //   extra (opcional): marcas { cara, patas, corpo }, title, bio, habitat, lore, grau (1–3 estrelas: multiplicam os pontos livres),
  //   breedLeftMax (cruzas restantes ao nascer; padrão BREED_LEFT[sex]).
  // ---------------------------------------------------------------------------
  function mount(id, name, element, rarity, sex, level, potential, skills, palette, extra) {
    var h = {
      id: id, name: name, especie: 'cavalo', element: element, rarity: rarity, sex: sex,
      level: level, xp: 0, potential: potential, skills: skills, palette: palette
    };
    if (extra) for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) h[k] = extra[k];
    return h;
  }

  // Marcas na pelagem (spec 2026-11-12-cavalos-marcas §2). Genes herdáveis (breed.js); não entram em status, Poder nem corrida.
  var MARCAS = {
    cara: ['nenhuma', 'estrela', 'listra', 'frente'],
    patas: [0, 1, 2, 3, 4],
    corpo: ['liso', 'malhado', 'pintado', 'ruao'],
    mutacao: 0.10,
    branco: '#f1e9d4'
  };

  // Porte do cavalo (spec 2026-11-13-cavalos-portes §3). Gene herdável (breed.js); só desenho, não entra em status, Poder nem corrida.
  var PORTES = {
    valores: ['esguio', 'padrao', 'robusto'],
    nomes: { esguio: 'Esguio', padrao: 'Padrão', robusto: 'Robusto' },
    mutacao: 0.10,
    padrao: 'padrao'
  };

  // Jóquei do jogador (spec §4): padrão da seda e cor do capacete.
  var JOQUEI = {
    padroes: ['liso', 'listras', 'faixa', 'xadrez', 'estrelas', 'losangos'],
    capacetes: ['#f2c230', '#ff6b5e', '#62b8ff', '#86d86a', '#c77dff', '#ff9f43', '#f1e9d4', '#2a2a2a'],
    padrao: 'liso',
    capacete: '#f2c230',
    // nome de cada cor de capacete (hex → nome), para o aria-label da interface e para o wiki
    nomes: { '#f2c230': 'Dourado', '#ff6b5e': 'Vermelho', '#62b8ff': 'Azul', '#86d86a': 'Verde', '#c77dff': 'Roxo', '#ff9f43': 'Laranja', '#f1e9d4': 'Creme', '#2a2a2a': 'Preto' }
  };

  var STARTERS = [
    mount('brasa', 'Brasa', 'fogo', 'comum', 'm', 1,
      { vel: 24, acel: 24, man: 14, forca: 12, est: 12, garra: 14, sorte: 12 },
      [],
      { coat: '#c4471d', coatShade: '#7f2a0e', mane: '#ffb02e', accent: '#ffe066' },
      { title: 'A fagulha veloz', bio: 'Potro alazão de crina dourada. Larga como um rojão.', marcas: { cara: 'estrela', patas: 1, corpo: 'liso' }, porte: 'padrao', grau: 2 }),
    mount('mare', 'Maré', 'agua', 'comum', 'f', 1,
      { vel: 14, acel: 12, man: 12, forca: 14, est: 24, garra: 24, sorte: 12 },
      [],
      { coat: '#9ba7b4', coatShade: '#646f7e', mane: '#5fd8ee', accent: '#e6f4fb' },
      { title: 'O fôlego do oceano', bio: 'Égua tordilha de crina cor do mar. Quanto mais longa a pista, mais perigosa.', marcas: { cara: 'listra', patas: 0, corpo: 'ruao' }, porte: 'padrao', grau: 2 }),
    mount('ipe', 'Ipê', 'grama', 'comum', 'm', 1,
      { vel: 16, acel: 12, man: 24, forca: 24, est: 14, garra: 12, sorte: 10 },
      [],
      { coat: '#7a4a2a', coatShade: '#4c2b18', mane: '#f5c518', accent: '#f2e6c8' },
      { title: 'A raiz que não verga', bio: 'Castanho robusto de crina amarela como ipê florido. Não teme subida.', marcas: { cara: 'frente', patas: 2, corpo: 'liso' }, porte: 'padrao', grau: 2 })
  ];

  var WILD_HORSES = [
    mount('w-faisca', 'Faísca', 'fogo', 'comum', 'f', 3,
      { vel: 14, acel: 16, man: 15, forca: 10, est: 8, garra: 12, sorte: 10 },
      ['arranque'],
      { coat: '#d9772b', coatShade: '#9a4d16', mane: '#f7d08a', accent: '#ff8a3d' },
      { habitat: 'Cerrado seco', marcas: { cara: 'estrela', patas: 2, corpo: 'pintado' }, porte: 'esguio', grau: 2 }),
    mount('w-lambari', 'Lambari', 'agua', 'comum', 'm', 2,
      { vel: 9, acel: 11, man: 10, forca: 12, est: 17, garra: 13, sorte: 10 },
      [],
      { coat: '#7fa6c4', coatShade: '#4f7594', mane: '#e8f4fb', accent: '#5ec2d9' },
      { habitat: 'Beira de rio', marcas: { cara: 'nenhuma', patas: 0, corpo: 'malhado' }, porte: 'esguio', grau: 1 }),
    mount('w-capim', 'Capim', 'grama', 'comum', 'f', 4,
      { vel: 10, acel: 10, man: 10, forca: 18, est: 13, garra: 12, sorte: 10 },
      ['segundo-ar'],
      { coat: '#9a8a4a', coatShade: '#6a5e2e', mane: '#5b7d2a', accent: '#b9d46a' },
      { habitat: 'Campos gerais', marcas: { cara: 'listra', patas: 4, corpo: 'liso' }, porte: 'esguio', grau: 2 }),
    mount('w-ticao', 'Tição', 'fogo', 'magico', 'm', 8,
      { vel: 17, acel: 19, man: 18, forca: 12, est: 10, garra: 15, sorte: 12 },
      ['chama-final'],
      { coat: '#3a2a26', coatShade: '#1e1513', mane: '#ff5a1f', accent: '#ffb347' },
      { habitat: 'Carvoaria abandonada', marcas: { cara: 'frente', patas: 1, corpo: 'liso' }, porte: 'robusto', grau: 2 }),
    mount('w-garoa', 'Garoa', 'agua', 'magico', 'f', 10,
      { vel: 13, acel: 12, man: 13, forca: 14, est: 20, garra: 15, sorte: 12 },
      ['pe-na-chuva', 'segundo-ar'],
      { coat: '#a9b8c6', coatShade: '#73879a', mane: '#f2f6fa', accent: '#6fb7e8' },
      { habitat: 'Serra enevoada', marcas: { cara: 'estrela', patas: 0, corpo: 'ruao' }, porte: 'padrao', grau: 2 }),
    mount('w-mandacaru', 'Mandacaru', 'grama', 'magico', 'm', 7,
      { vel: 12, acel: 13, man: 13, forca: 21, est: 16, garra: 13, sorte: 12 },
      ['casco-firme'],
      { coat: '#b48a5a', coatShade: '#7d5c38', mane: '#3f6b2a', accent: '#e85d9a' },
      { habitat: 'Caatinga', marcas: { cara: 'nenhuma', patas: 3, corpo: 'pintado' }, porte: 'robusto', grau: 2 }),
    mount('w-ventania', 'Ventania', 'grama', 'raro', 'f', 15,
      { vel: 21, acel: 18, man: 20, forca: 13, est: 15, garra: 17, sorte: 14 },
      ['sprint', 'arrancada-final'],
      { coat: '#e9e4da', coatShade: '#b6aea0', mane: '#7a7a7a', accent: '#9ad0ff' },
      { habitat: 'Pampa gaúcho', marcas: { cara: 'listra', patas: 2, corpo: 'malhado' }, porte: 'esguio', grau: 3 }),
    mount('w-pororoca', 'Pororoca', 'agua', 'raro', 'm', 18,
      { vel: 15, acel: 14, man: 15, forca: 17, est: 24, garra: 16, sorte: 14 },
      ['nascente', 'pe-na-chuva'],
      { coat: '#2e5f73', coatShade: '#1a3b49', mane: '#9ee7e0', accent: '#2fd6c5' },
      { habitat: 'Foz do Amazonas', marcas: { cara: 'estrela', patas: 4, corpo: 'liso' }, porte: 'robusto', grau: 2 }),
    mount('w-fogareu', 'Fogaréu', 'fogo', 'lendario', 'f', 22,
      { vel: 24, acel: 26, man: 25, forca: 16, est: 15, garra: 20, sorte: 16 },
      ['sol-a-pino', 'chama-final', 'arranque'],
      { coat: '#b3201a', coatShade: '#6e110d', mane: '#ffd23f', accent: '#ff7b00' },
      { habitat: 'Chapada em chamas', marcas: { cara: 'frente', patas: 0, corpo: 'pintado' }, porte: 'robusto', grau: 3 }),
    mount('w-jequitiba', 'Jequitibá', 'grama', 'lendario', 'm', 25,
      { vel: 17, acel: 16, man: 17, forca: 27, est: 21, garra: 19, sorte: 16 },
      ['casco-firme', 'folego-de-montanha', 'segundo-ar'],
      { coat: '#5a4127', coatShade: '#36261a', mane: '#2f7d32', accent: '#8bc34a' },
      { habitat: 'Mata Atlântica', marcas: { cara: 'listra', patas: 1, corpo: 'ruao' }, porte: 'robusto', grau: 3 }),
    mount('w-boitata', 'Boitatá', 'fogo', 'mitico', 'f', 30,
      { vel: 28, acel: 29, man: 29, forca: 21, est: 20, garra: 26, sorte: 18 },
      ['sol-a-pino', 'chama-final', 'drift'],
      { coat: '#2a1a3a', coatShade: '#140b1e', mane: '#3cf0ff', accent: '#ff4fd8' },
      { habitat: 'Só aparece em noites de queimada', lore: 'A cobra de fogo do folclore, em forma de cavalo.', marcas: { cara: 'estrela', patas: 2, corpo: 'malhado' }, porte: 'esguio', grau: 3 }),
    mount('w-iara', 'Iara', 'agua', 'mitico', 'm', 28,
      { vel: 22, acel: 21, man: 22, forca: 20, est: 30, garra: 25, sorte: 18 },
      ['canto-da-iara', 'pe-na-chuva', 'nascente'],
      { coat: '#1f6f78', coatShade: '#0f3f45', mane: '#b8fff1', accent: '#ffd36e' },
      { habitat: 'Rios encantados', lore: 'A mãe-d\'água que encanta quem a ouve.', marcas: { cara: 'nenhuma', patas: 4, corpo: 'ruao' }, porte: 'esguio', grau: 3 })
  ];

  var BOT_NAMES = [
    'ZéDaBaia', 'Rapadura_Turbo', 'Galopeira99', 'Uai_Sô', 'Bah_Tchê', 'Oxente_Racing',
    'Cuscuz_Nitro', 'PaçocaPower', 'Fubá_Galáctico', 'JabuticabaRun', 'Tropeiro_BR',
    'Peão_do_Asfalto', 'Vaqueira_Veloz', 'BrigadeiroGT', 'Mineirinho_Trem', 'Forrozeiro',
    'CaipiraTurbo', 'DonaFlorzinha', 'Xique_Xique', 'Coxinha_Crocante', 'Boi_Bumbá',
    'Tapioca_Ninja'
  ];

  // Ligas por Rating de Poder (RaceSim.powerRating). min inclusivo.
  // Seis faixas iguais entre dois cavalos de referência: Fogo, genética 16 em todos os status, ★★,
  // sem skills de vaga, com alloc = RaceSim.botAlloc(cavalo).
  //   lo = Poder do Comum de nível 1 = 624;  hi = Poder do Lendário de nível 50 = 1154.
  //   Bronze começa em 0; a liga k (1 a 5) em lo + k·(hi − lo)/6, arredondado para a dezena:
  //   712,3 → 710 · 800,7 → 800 · 889,0 → 890 · 977,3 → 980 · 1065,7 → 1070.
  // O sim-test refaz a conta: mudou peso do Poder, status ou build dos bots, recalcule aqui.
  var LEAGUES = [
    { id: 'bronze',   name: 'Bronze',   min: 0,    color: '#b0703c' },
    { id: 'prata',    name: 'Prata',    min: 710,  color: '#b8c2cc' },
    { id: 'ouro',     name: 'Ouro',     min: 800,  color: '#f2c230' },
    { id: 'platina',  name: 'Platina',  min: 890,  color: '#5fd3c8' },
    { id: 'diamante', name: 'Diamante', min: 980,  color: '#7ab8ff' },
    { id: 'lenda',    name: 'Lenda',    min: 1070, color: '#ff7a3d' }
  ];

  var FOAL_NAMES = [
    'Tufão',
    'Canela',
    'Baio',
    'Pitanga',
    'Jaguar',
    'Serena',
    'Relâmpago',
    'Mimosa',
    'Trovão',
    'Lua',
    'Corisco',
    'Pérola',
    'Faísca II',
    'Aroeira',
    'Bugre',
    'Catira',
    'Dourado',
    'Estrela',
    'Furacão',
    'Guará',
    'Jurema',
    'Malhado',
    'Nuvem',
    'Onça',
    'Pampa',
    'Quimera',
    'Rio',
    'Saci',
    'Tempestade',
    'Umbu',
    'Vaqueiro',
    'Xodó'
  ];

  // Cruzas restantes ao nascer, por sexo.
  var BREED_LEFT = { m: 2, f: 1 };

  var ECONOMY = {
    currency: { id: 'ouro', name: 'Ouro', icon: 'coin' },
    entryTiers: [50, 100, 250],
    houseFee: 0.10,
    payoutSplit: [0.6, 0.25, 0.15],
    // Divisão conforme o tamanho do campo: todo lugar premiado recebe pelo menos a entrada.
    //   4–5 corredores: 1º/2º (70/30) · 6–7: 1º/2º/3º (50/30/20) · 8: 60/25/15.
    payoutSplitFor: function (numRacers) {
      if (numRacers <= 5) return [0.7, 0.3];
      if (numRacers <= 7) return [0.5, 0.3, 0.2];
      return [0.6, 0.25, 0.15];
    },
    startingGold: 500,
    minRacers: 4,
    maxRacers: 8,
    // Faixa dos rivais da sala pelo número da sala (D9, spec 2026-11-25-d9-salas-justas; regra em sala.js faixaDaSala):
    // lo/hi = o alvo do rival em fração do Poder do jogador; teto = o rival nunca passa do alvo × teto (perde pontos,
    // depois genética; o catálogo não tem rival mais fraco que o inicial nível 1). Estreia nas salas 1..ate; da ate+1 até
    // rampaAte tudo vai em linha reta até a normal (o teto até 1,2, que já não corta ninguém).
    sala: {
      estreia: { ate: 10, nMin: 4, nMax: 5, lo: 0.93, hi: 1.005, teto: 1.005 },
      rampaAte: 20,
      normal: { nMin: 4, nMax: 8, lo: 0.935, hi: 1.045 }
    },
    // Preparação (D2, spec 2026-11-26-d2-preparacao): segundos entre abrir a sala e a largada automática, para trocar
    // de cavalo (só para um com Poder até o da sala)
    preparacaoS: 12,
    maxLevel: 50,
    // XP por colocação (1º..8º).
    xpPerPlace: [100, 70, 50, 35, 25, 20, 15, 10],
    // XP necessário para subir do level `level` para `level + 1`.
    xpToLevel: function (level) { return 50 + 25 * level; },
    // Cruzamento e estábulo.
    breeding: {
      rentalBase: { comum: 100, magico: 250, raro: 600, lendario: 1500 },
      grauMult: [1, 1.25, 1.5],
      ownRegistration: 50, exchange: 50,
      stableSlotPrice: 300, stableSlotsStart: 3, stableSlotsMax: 8,
      levelSaturation: 30, mareWeight: 0.6
    },
    // Equipamento: preço por raridade, venda, pedras de reforço, +N e bônus de conjunto.
    gear: {
      price: { comum: 100, magico: 250, raro: 600, lendario: 1500 },
      sellRate: 0.25, stonePrice: 40, stoneBundle: 5,
      // o principal e o passo da melhoria, calibrados para o PVE pela meta E4 (eram 2 · 2 · 3 · 4 e 0,5 quando a peça
      // valia no PVP): com 5 Raras +5 o líder da Lendária soma 2,25 por status (o status é inteiro: +2)
      main: { comum: 0.75, magico: 1, raro: 1.25, lendario: 1.75 },
      // Linhas de farm (só PVE; spec AFK §5.7): quantas por raridade e a faixa de cada tipo, em pontos percentuais
      // inteiros (sorteio uniforme, passos de 1). Tipos sem repetir na mesma peça.
      linhas: { comum: 0, magico: 1, raro: 2, lendario: 3 },
      faixas: {
        material: { magico: [3, 6], raro: [6, 10], lendario: [10, 15] },
        xp: { magico: [3, 6], raro: [6, 10], lendario: [10, 15] },
        raro: { magico: [2, 5], raro: [5, 8], lendario: [8, 12] },
        trofeu: { magico: [6, 12], raro: [12, 20], lendario: [20, 30] },
        ouro: { magico: [2, 4], raro: [4, 6], lendario: [6, 10] }
      },
      // Reforja (spec AFK §5.9): Ouro = arredonda para 10 (reforjaBase × reforjaFator^rerolls da peça), mais 1 Pergaminho
      // de reforja; com 1 Selo do campeão a linha mantém o tipo e o valor sai da metade de cima da faixa.
      reforjaBase: 100, reforjaFator: 1.5,
      plusStep: 0.2,   // cada +N soma plusStep ao status principal (uma peça +10 soma +2)
      plusMax: 10,
      // Chance e custo (em pedras) de cada passo +0→+1 … +9→+10; falha derruba a partir de enhanceDropFrom.
      enhanceChance: [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.35, 0.3, 0.25],
      enhanceCost: [1, 1, 1, 1, 1, 1, 2, 2, 2, 2],
      enhanceDropFrom: 6,
      // conjunto (só PVE): 3 peças, os bônus de farm das linhas × (1 + farm); 4, o bônus do clima do conjunto sobe para `clima` (×1,07);
      // 5, sem penalidade de clima
      setBonus: { pieces: [3, 4, 5], farm: 0.10, clima: 1.07 },
      podiumStone: [0.6, 0.4, 0.25],
      startGear: ['sela-comum', 'ferraduras-comum']
    }
  };

  // ---------------------------------------------------------------------------------------------
  // Itens de uso (um cavalo por uso, sem volta). Regras em itens.js; números de partida aqui, num só
  // lugar, para ajustar depois de jogar (spec 2026-11-16 §4, §6, §7 e §11).
  //   price: Ouro na loja (null = não se vende); perDay: compras por dia; everyDays: 1 compra a cada N dias;
  //   cap (Torrão): torrões por cavalo; chance (Manual): chance de aprender.
  //   plural: o nome no plural (a quantidade lida como "3 Torrões de açúcar");
  //   desc: para que serve; origem: de onde vem (a mochila mostra com quantidade 0). Sem números de
  //   regra no texto: quem mostra o limite ou a chance lê os campos acima.
  // ---------------------------------------------------------------------------------------------
  var ITEMS = {
    torrao: {
      id: 'torrao', name: 'Torrão de açúcar', plural: 'Torrões de açúcar', price: 120, perDay: 2, cap: 10,
      desc: 'O cavalo ganha 1 ponto a mais para distribuir, para sempre.',
      origem: 'Compre na loja, ganhe no 2º dia da recompensa diária ou nos ginásios.'
    },
    estrela: {
      id: 'estrela', name: 'Estrela de treino', plural: 'Estrelas de treino', price: 2000, everyDays: 7,
      desc: 'O cavalo sobe 1 estrela; os pontos a mais aparecem para distribuir.',
      origem: null   // montada abaixo, com os números de everyDays e de DAILY.estrelaACada
    },
    redea: {
      id: 'redea', name: 'Rédea nova', plural: 'Rédeas novas', price: null,
      desc: 'Redistribui os pontos do cavalo (a primeira redistribuição de cada cavalo é grátis).',
      origem: 'Vem no 7º dia da recompensa diária e na 1ª vitória sobre cada líder de ginásio; não está à venda.'
    },
    cupom: {
      id: 'cupom', name: 'Cupom de troca de skill', plural: 'Cupons de troca de skill', price: 250, perDay: 1,
      desc: 'Uma skill das vagas sai e entra outra, sorteada entre as que o cavalo pode aprender.',
      origem: 'Compre na loja, ganhe no 6º dia da recompensa diária ou nos ginásios.'
    },
    manual: {
      id: 'manual', name: 'Manual de doma', plural: 'Manuais de doma', price: 200, perDay: 1, chance: 0.35,
      desc: 'O cavalo tenta aprender uma skill na hora; o manual é gasto mesmo se ele não aprender.',
      origem: 'Compre na loja, ganhe no 4º dia da recompensa diária ou nos ginásios.'
    },
    // Pergaminho de técnica: só se ganha jogando (nunca na loja: sem price; nunca por Gemas; nunca em treino).
    //   cap: o teto na mochila; podio: chance de cair no 1º, 2º e 3º lugar de uma corrida valendo (Itens.pergaminhoPodio,
    //   pela seed da sala). Não se usa pela mochila: é gasto, com Ouro, ao subir o rank de uma skill (SKILL_RANKS.custo).
    pergaminho: {
      id: 'pergaminho', name: 'Pergaminho de técnica', plural: 'Pergaminhos de técnica', cap: 99, podio: [0.5, 0.3, 0.15],
      desc: 'Sobe o rank de uma skill do cavalo, junto com Ouro, na aba Skills.',
      origem: 'Cai no pódio das corridas valendo e vem nos ginásios; não está à venda.'
    }
  };
  // A ordem dos produtos na loja: fixa, a da spec §6 (não segue o preço); só itens com price. A mochila mostra todos
  // na ordem das chaves de ITEMS.
  var SHOP_ORDER = ['torrao', 'manual', 'cupom', 'estrela'];
  // Teto da mochila por item (Torrão, Estrela, Cupom, Manual); a Rédea nova tem o teto dela no save (999).
  var BAG_MAX = 99;
  // Recompensa diária: calendário de 7 dias, sem sorteio. O 7º dia de cada estrelaACada-ésimo calendário
  // completo também dá 1 Estrela de treino.
  var DAILY = {
    dias: [{ ouro: 60 }, { item: 'torrao' }, { ouro: 100 }, { item: 'manual' }, { ouro: 150 }, { item: 'cupom' }, { ouro: 200, item: 'redea' }],
    estrelaACada: 4
  };
  ITEMS.estrela.origem = 'Compre na loja (1 a cada ' + ITEMS.estrela.everyDays + ' dias) ou ganhe no 7º dia de cada ' +
    DAILY.estrelaACada + 'º calendário completo da recompensa diária.';

  // ---------------------------------------------------------------------------------------------
  // Ginásios da Expedição (spec 2026-11-17-ginasios §4 a §9). Regras em ginasio.js; os números, num só lugar,
  // calibrados pelas metas G1 a G9 do tools/balance.js (Tarefa 2) e para ajustar depois de jogar.
  //   vantagem: quanto os seis status de corrida sobem para o cavalo cujo elemento vence o do adversário;
  //   fadiga.faixas: a distância na chegada (m) separa as vitórias em faixas meio abertas (metros < ate; a última,
  //     ate null, pega o resto); perde: fôlego perdido por quem vence, somado a cada vitória seguida até o teto;
  //   xp: por duelo corrido; revanche: a entrada e o rodízio fixo do prêmio (contado por ginásio);
  //   insignias: o bônus da conta de cada uma (ouro: prêmios de corrida; xp: XP somado; skill: chance de skill por nível).
  // ---------------------------------------------------------------------------------------------
  var GYM = {
    // calibrado na Tarefa 2 (metas G1 a G9 do balance.js): o status inteiro arredonda, então nos status de 50 a 62
    // de hoje os 4% somam cerca de 2 pontos (a vantagem anda em degraus de 1 ponto de status)
    vantagem: 0.04,
    fadiga: {
      // entre cavalos iguais as chegadas se dividem entre "colado" e "longe"; 4 e 12 m deixam cada faixa com 15% ou mais
      // (2026-11-19: eram 1 e 8 m; com a Garra saindo sempre, com força variável, as chegadas ficaram mais espalhadas)
      faixas: [
        { id: 'apertada', name: 'Apertada', ate: 4, perde: 0.25 },
        { id: 'normal', name: 'Normal', ate: 12, perde: 0.15 },
        { id: 'folgada', name: 'Folgada', ate: null, perde: 0.05 }
      ],
      teto: 0.5
    },
    xp: { vence: 50, perde: 15 },
    revanche: { entrada: 50, ciclo: [{ ouro: 100 }, { item: 'torrao' }, { ouro: 100 }, { item: 'manual' }, { ouro: 100 }, { item: 'cupom' }] },
    insignias: { fogo: { tipo: 'ouro', valor: 0.03 }, agua: { tipo: 'xp', valor: 0.03 }, grama: { tipo: 'skill', valor: 0.03 } }
  };
  // A sequência (D4, spec 2026-11-26-d4-ginasios-sequencia): cada ginásio só abre com a insígnia do anterior (regra em
  // ginasio.js, aberto). É também a ordem do Perfil, da gaveta DEV, do wiki e das fases do treino AFK.
  var GYM_ORDER = ['grama', 'agua', 'fogo'];
  // Pista da casa (1.200 m, uma por ginásio): blocos dados como [tipo, metros], em sequência a partir de 0.
  function pistaGym(surface, partes) {
    var at = 0, blocks = partes.map(function (p) { var b = { type: p[0], from: at, to: at + p[1] }; at += p[1]; return b; });
    return { distance: at, surface: surface, blocks: blocks };
  }
  // As cinco etapas: o que é igual nos três ginásios (id, líder, rank das skills e os itens da 1ª vitória; spec §4).
  // premio.pergaminhos: Pergaminhos de técnica a mais na 1ª vitória (a revanche não dá: o rodízio não muda).
  // rank: o rank de todas as skills de vaga dos cavalos da etapa (fixo, sem sorteio; a revanche usa o do líder).
  var GYM_ETAPAS = [
    { id: 'soldado-1', lider: false, rank: 1, itens: [] },
    { id: 'soldado-2', lider: false, rank: 1, itens: ['torrao'], pergaminhos: 1 },
    { id: 'soldado-3', lider: false, rank: 1, itens: [] },
    { id: 'soldado-4', lider: false, rank: 2, itens: ['manual'], pergaminhos: 1 },
    { id: 'lider', lider: true, rank: 2, itens: ['redea', 'cupom'], pergaminhos: 3 }
  ];
  // E o que muda por ginásio (D4): cada um mais forte que o anterior na sequência. level/entrada/ouro: por etapa;
  // raridade: a dos oponentes (a genética continua a do inicial do elemento, com os pontos e as vagas da raridade);
  // graus: as estrelas de cada cavalo, por etapa (o tamanho de cada lista é o tamanho do time).
  var GYM_NUMEROS = {
    grama: { raridade: 'comum', level: [2, 4, 6, 8, 10], entrada: [10, 15, 20, 25, 50], ouro: [50, 75, 100, 125, 250],
      graus: [[2], [2], [2, 2], [2, 2], [2, 2, 2]] },
    agua: { raridade: 'magico', level: [14, 17, 20, 23, 26], entrada: [25, 35, 45, 55, 110], ouro: [100, 140, 180, 220, 450],
      graus: [[2], [2, 2], [2, 2], [2, 2, 2], [2, 2, 2]] },
    fogo: { raridade: 'magico', level: [30, 33, 36, 39, 42], entrada: [40, 55, 70, 85, 170], ouro: [160, 220, 280, 340, 700],
      graus: [[2, 2], [2, 2], [2, 2, 2], [2, 2, 2], [2, 2, 2]] }
  };
  function gym(id, name, lider, fraco, pista, base, soldados, insignia) {
    var n = GYM_NUMEROS[id];
    return {
      id: id, element: id, name: name, lider: lider, fraco: fraco, pista: pista, raridade: n.raridade,
      etapas: GYM_ETAPAS.map(function (e, i) {
        return {
          id: e.id, nome: e.lider ? lider : soldados[i], lider: e.lider,
          cavalos: n.graus[i].map(function (gr) { return { base: base, raridade: n.raridade, level: n.level[i], grau: gr, rank: e.rank }; }),
          entrada: n.entrada[i], premio: { ouro: n.ouro[i], itens: e.itens.slice(), pergaminhos: e.pergaminhos || 0 }
        };
      }),
      insignia: { icone: 'ins-' + id, name: insignia }
    };
  }
  var GYMS = {   // na ordem da sequência (GYM_ORDER)
    // Capoeira: grama, uma subida de 800 m e a curva da chegada
    grama: gym('grama', 'Ginásio da Grama', 'Dona Capineira', 'fogo',
      pistaGym('grama', [['subida', 800], ['reta', 50], ['curva', 350]]), 'ipe',
      ['Recruta Broto', 'Cabo Carrapicho', 'Sargento Juazeiro', 'Tenente Aroeira'],
      'Insígnia da Grama'),
    // Remanso: areia, com uma reta no meio e a subida mais longa no fim
    agua: gym('agua', 'Ginásio da Água', 'Mestre Aguaceiro', 'grama',
      pistaGym('areia', [['curva', 100], ['subida', 250], ['reta', 250], ['curva', 200], ['subida', 400]]), 'mare',
      ['Recruta Orvalho', 'Cabo Goteira', 'Sargento Correnteza', 'Tenente Cacimba'],
      'Insígnia da Água'),
    // Fornalha: terra, uma subida longa até a curva e outra subida na chegada
    fogo: gym('fogo', 'Ginásio do Fogo', 'Capitã Labareda', 'agua',
      pistaGym('terra', [['subida', 650], ['curva', 350], ['subida', 200]]), 'brasa',
      ['Recruta Fagulha', 'Cabo Tocha', 'Sargento Candeeiro', 'Tenente Coivara'],
      'Insígnia do Fogo')
  };

  // ---------------------------------------------------------------------------------------------
  // Corrida AFK (spec 2026-11-23-afk-drops §5). Regras em afk.js; os números de partida aqui, juntos, para ajustar
  // pelas metas E1 a E6 do tools/balance.js e depois de jogar.
  //   difs: as três dificuldades de cada fase (fase = etapa de ginásio), na ordem em que liberam. nivel: somado ao nível
  //     da etapa (até nivelMax); rank: o das skills de vaga do oponente (null = o da etapa); mult: multiplicador de
  //     prêmio; pecas: as cinco peças do oponente (bloco B; null = sem peças).
  //   liberaApos: vitórias AFK numa dificuldade para liberar a seguinte, na mesma fase.
  //   vagaPreco: Ouro de cada vaga (a 1ª é grátis); o tamanho da lista é o máximo de vagas.
  //   offlineMin: limite do offline (min); offlineTetoMin: o teto com a Aveia dourada e o bestiário; amostra: duelos
  //     simulados para medir a chance de vitória de uma configuração.
  // ---------------------------------------------------------------------------------------------
  var AFK = {
    difs: [
      { id: 'normal', name: 'Normal', nivel: 0, rank: null, mult: 1, pecas: null },
      // nivelMax 45 desde a D4 (2026-11-26): com a Fornalha nos níveis 30–42, +12 passava do nível máximo do jogo (50)
      { id: 'dificil', name: 'Difícil', nivel: 12, nivelMax: 45, rank: 3, mult: 2, pecas: { rar: 'magico', plus: 3 } },
      { id: 'lendaria', name: 'Lendária', nivel: 25, nivelMax: 45, rank: 5, mult: 4, pecas: { rar: 'raro', plus: 5, doConjunto: true } }
    ],
    liberaApos: 50,
    vagaPreco: [0, 1000, 3000, 8000, 20000],
    // amostra: 2.400 (a spec partia de 400; com 400 só 25 de 30 configurações ficavam a menos de 3 p.p. da referência, e
    // a meta E3 pede 95%; com 1.600 a E3 passava no limite, 43 de 45; 2.400 duelos levam ~1,5 s num computador, em fatias)
    offlineMin: 480, offlineTetoMin: 720, amostra: 2400,
    // Ganho por corrida (§5.3): xp = round(xpBase × (1 + xpPorEtapa × etapa) × mult); ouro = ouro[etapa] × mult
    // (etapa 0–4: Soldado 1 ao líder). Na derrota: a fração do XP e do material comum (para baixo), sem raros nem Ouro.
    // ouro: a tabela da spec (2 · 3 · 4 · 5 · 8) × 0,15, calibrada pela meta E1 (o Ouro do AFK por hora abaixo de 25% do
    // PVP mesmo com o máximo de +Ouro das peças); a fração vira Ouro inteiro pela seed (parte inteira e mais 1 com a
    // chance da fração).
    xpBase: 40, xpPorEtapa: 0.15, ouro: [0.3, 0.45, 0.6, 0.75, 1.2],
    derrota: { xp: 0.30, material: 0.25 },
    // Drops por vitória (§5.4). material: quantidade sorteada de min a max, × mult, metade de cada tipo do ginásio.
    // incomum, pedra, comida e reforja: chance na Normal, × mult (incomum com teto). peca: chance por dificuldade
    // (solta = Comum ou Mágica sem conjunto, magica = fração das soltas que sai Mágica; raro e lendario = do conjunto
    // do ginásio). trofeu: chance por dificuldade. comida.pesos: a divisão do que cai.
    drops: {
      material: { min: 1, max: 3 },
      incomum: { chance: 0.15, teto: 0.60 },
      pedra: { chance: 0.06 },
      comida: { chance: 0.08, pesos: { feno: 60, cenoura: 25, maca: 12, 'aveia-dourada': 3 } },
      peca: { normal: { solta: 0.02, magica: 0.3 }, dificil: { raro: 0.01 }, lendaria: { raro: 0.02, lendario: 0.002 } },
      reforja: { chance: 0.015 },
      trofeu: { normal: 0.005, dificil: 0.01, lendaria: 0.02 }
    },
    // Bestiário (§5.8): bônus da conta, só no AFK. marcos: vitórias AFK por oponente; raro e xp: `por` a cada oponente com
    // `vitorias` vitórias; trofeu: `por` a cada troféu obtido; pagina: minutos de limite offline por página completa.
    bestiario: {
      marcos: [10, 100, 1000],
      raro: { por: 0.01, teto: 0.15, vitorias: 100 },
      xp: { por: 0.02, teto: 0.30, vitorias: 1000 },
      trofeu: { por: 0.02, teto: 0.30 },
      pagina: { min: 60, tetoMin: 180 }
    },
    // O que só cai em cada ginásio: os dois materiais comuns, o incomum e o conjunto das peças Raras e Lendárias.
    materiais: {
      fogo: { comuns: ['carvao', 'ferro-bruto'], incomum: 'brasa-viva', conjunto: 'sol' },
      agua: { comuns: ['junco', 'concha'], incomum: 'perola-de-rio', conjunto: 'chuva' },
      grama: { comuns: ['fibra', 'resina'], incomum: 'seiva-antiga', conjunto: 'nevoa' }
    },
    // O objeto de cada oponente (o troféu 'trofeu-<ginásio>-<etapa>' leva o nome dele), na ordem das etapas.
    trofeus: {
      fogo: ['Pederneira', 'Archote', 'Lanterna', 'Braseiro', 'Elmo'],
      agua: ['Cantil', 'Balde', 'Remo', 'Moringa', 'Capa'],
      grama: ['Regador', 'Escova', 'Cajado', 'Facão', 'Foice']
    }
  };
  // Itens do AFK (spec §5.4): entram em ITEMS com `grupo` (material, incomum, comida, reforja, trofeu), sem preço (não
  // se vendem) e com o teto próprio (cap). gymId: o ginásio em que caem. Comidas: xp (dado a um cavalo) ou aveiaMin
  // (minutos a mais no limite do próximo offline).
  (function () {
    function add(id, grupo, name, plural, cap, desc, origem, extra) {
      var it = { id: id, name: name, plural: plural, price: null, cap: cap, grupo: grupo, desc: desc, origem: origem };
      Object.keys(extra || {}).forEach(function (k) { it[k] = extra[k]; });
      ITEMS[id] = it;
    }
    var LUGAR = { fogo: 'do Fogo', agua: 'da Água', grama: 'da Grama' };
    var NOMES = {
      carvao: ['Carvão', 'Carvões'], 'ferro-bruto': ['Ferro bruto', 'Ferros brutos'], junco: ['Junco', 'Juncos'], concha: ['Concha', 'Conchas'],
      fibra: ['Fibra', 'Fibras'], resina: ['Resina', 'Resinas'],
      'brasa-viva': ['Brasa viva', 'Brasas vivas'], 'perola-de-rio': ['Pérola de rio', 'Pérolas de rio'], 'seiva-antiga': ['Seiva antiga', 'Seivas antigas']
    };
    GYM_ORDER.forEach(function (g) {
      AFK.materiais[g].comuns.forEach(function (id) {
        add(id, 'material', NOMES[id][0], NOMES[id][1], 999, 'Material de forja ' + LUGAR[g] + '.', 'Cai em toda vitória no treino AFK ' + LUGAR[g] + '.', { gymId: g });
      });
    });
    GYM_ORDER.forEach(function (g) {
      var id = AFK.materiais[g].incomum;
      add(id, 'incomum', NOMES[id][0], NOMES[id][1], 999, 'Material incomum ' + LUGAR[g] + ', para forjar peças melhores.', 'Cai às vezes nas vitórias do treino AFK ' + LUGAR[g] + '.', { gymId: g });
    });
    var COMIDA = 'Cai às vezes nas vitórias do treino AFK.';
    add('feno', 'comida', 'Feno', 'Fenos', 999, 'Dá 200 de XP a um cavalo.', COMIDA, { xp: 200 });
    add('cenoura', 'comida', 'Cenoura', 'Cenouras', 999, 'Dá 500 de XP a um cavalo.', COMIDA, { xp: 500 });
    add('maca', 'comida', 'Maçã', 'Maçãs', 999, 'Dá 1.200 de XP a um cavalo.', COMIDA, { xp: 1200 });
    add('aveia-dourada', 'comida', 'Aveia dourada', 'Aveias douradas', 999, 'O próximo período fora rende 1 hora a mais no treino AFK.', COMIDA, { aveiaMin: 60 });
    // Selo do campeão (spec AFK §5.9): só no 1º lugar de corrida valendo, chance `podio` pela seed da sala. Gasta-se na
    // subida do rank IV → V, na reforja garantida e na forja da Lendária. Nunca cai no AFK nem se vende.
    add('selo', 'selo', 'Selo do campeão', 'Selos do campeão', 99,
      'Prova de vitória no PVP. Entra na forja das peças Lendárias de conjunto.', 'Cai às vezes para o 1º lugar das corridas valendo; não está à venda.', { podio: 0.10 });
    add('pergaminho-reforja', 'reforja', 'Pergaminho de reforja', 'Pergaminhos de reforja', 99,
      'Sorteia de novo uma linha de uma peça de equipamento, junto com Ouro.', 'Cai às vezes nas vitórias do treino AFK ou sai da forja.');
    GYM_ORDER.forEach(function (g) {
      GYMS[g].etapas.forEach(function (et, e) {
        var obj = AFK.trofeus[g][e], de = /^(Capitã|Dona) /.test(et.nome) ? ' da ' : ' do ';
        add('trofeu-' + g + '-' + e, 'trofeu', obj + de + et.nome, obj + de + et.nome, 99,
          'Troféu de ' + et.nome + '. Conta no bestiário e entra na forja das peças de conjunto ' + LUGAR[g] + '.',
          'Cai raramente ao vencer ' + et.nome + ' no treino AFK.', { gymId: g, etapa: e });
      });
    });
  })();

  // Forja (spec AFK §5.6): receitas fixas, sem chance. mat = soma dos dois materiais comuns do ginásio escolhido;
  // inc = o incomum dele; trofeu = troféus de qualquer oponente dele; selo = Selos do campeão; ouro = Ouro livre.
  // Rara e Lendária saem do conjunto do ginásio. qualquerGinasio: a receita não depende de qual ginásio se escolhe.
  var FORJA = {
    comum: { mat: 10, inc: 0, trofeu: 0, ouro: 100 },
    magico: { mat: 25, inc: 3, trofeu: 0, ouro: 300 },
    raro: { mat: 60, inc: 10, trofeu: 1, ouro: 800 },
    lendario: { mat: 120, inc: 20, trofeu: 3, selo: 2, ouro: 3000 },
    pedra: { mat: 8, inc: 0, trofeu: 0, ouro: 30 },
    reforja: { mat: 15, inc: 1, trofeu: 0, ouro: 150, qualquerGinasio: true }
  };

  // ---------------------------------------------------------------------------------------------
  // Equipamento (só vale no PVE: treino AFK; nunca no PVP nem no Poder): 5 slots por montaria. Cada peça dá um status
  // principal de corrida, pelo slot (GEAR_SLOT_INFO) e pela raridade (ECONOMY.gear.main), e linhas de farm sorteadas
  // (ECONOMY.gear.linhas e faixas; cada peça do save guarda as suas).
  //   id: '<slot>-<raridade>' (solta: Comum/Mágico) ou '<slot>-<conjunto>-<raridade>' (Raro/Lendário).
  //   Conjuntos (sol/chuva/nevoa) dão bônus por nº de peças equipadas; Lendário não vai à loja.
  // ---------------------------------------------------------------------------------------------
  var GEAR_SLOTS = ['ferraduras', 'sela', 'estribos', 'testeira', 'armadura'];

  var GEAR_SLOT_INFO = {
    ferraduras: { name: 'Ferraduras', main: 'vel' },
    sela: { name: 'Sela', main: 'est' },
    estribos: { name: 'Estribos', main: 'man' },
    testeira: { name: 'Testeira', main: 'acel' },
    armadura: { name: 'Armadura', main: 'forca' }
  };

  var GEAR_SETS = {
    sol: { id: 'sol', name: 'Sol', weather: 'sol', suffix: 'do Sol' },
    chuva: { id: 'chuva', name: 'Chuva', weather: 'chuva', suffix: 'da Chuva' },
    nevoa: { id: 'nevoa', name: 'Névoa', weather: 'nevoa', suffix: 'da Névoa' }
  };

  // Nomes das peças soltas por slot: [Comum, Mágico].
  var GEAR_LOOSE_NAMES = {
    ferraduras: ['Ferradura Leve', 'Ferradura com Cravos'],
    sela: ['Sela de Couro Cru', 'Sela Acolchoada'],
    estribos: ['Estribos de Corda', 'Esporas de Prata'],
    testeira: ['Antolhos', 'Testeira de Couro'],
    armadura: ['Manta de Lã', 'Capa Impermeável']
  };

  var GEAR = {};
  (function () {
    function add(slot, rarity, set, name) {
      var id = slot + (set ? '-' + set : '') + '-' + rarity;
      GEAR[id] = {
        id: id, name: name, slot: slot, rarity: rarity, set: set,
        main: ECONOMY.gear.main[rarity],
        price: ECONOMY.gear.price[rarity], shop: rarity !== 'lendario'
      };
    }
    GEAR_SLOTS.forEach(function (slot) {
      add(slot, 'comum', null, GEAR_LOOSE_NAMES[slot][0]);
      add(slot, 'magico', null, GEAR_LOOSE_NAMES[slot][1]);
      Object.keys(GEAR_SETS).forEach(function (setId) {
        var nome = GEAR_SLOT_INFO[slot].name + ' ' + GEAR_SETS[setId].suffix;
        add(slot, 'raro', setId, nome);
        add(slot, 'lendario', setId, nome);
      });
    });
  })();

  // Os itens de uso (Torrão, Estrela, Rédea, Cupom, Manual, Pergaminho de técnica), na ordem do catálogo: os de ITEMS
  // sem `grupo`. Os do AFK (com grupo) têm as suas telas e os seus tetos.
  var ITENS_USO = Object.keys(ITEMS).filter(function (id) { return !ITEMS[id].grupo; });

  var GameData = {
    version: '0.2-prototipo',
    STAT_KEYS: STAT_KEYS,
    STATS: STATS,
    HELP: HELP,
    ELEMENTS: ELEMENTS,
    RARITIES: RARITIES,
    TYPE_SKILLS: TYPE_SKILLS,
    SURFACES: SURFACES,
    WEATHERS: WEATHERS,
    BLOCK_TYPES: BLOCK_TYPES,
    SKILLS: SKILLS,
    SKILL_RANKS: SKILL_RANKS,
    GEAR_SLOTS: GEAR_SLOTS,
    GEAR_SLOT_INFO: GEAR_SLOT_INFO,
    GEAR_SETS: GEAR_SETS,
    GEAR: GEAR,
    MARCAS: MARCAS,
    PORTES: PORTES,
    JOQUEI: JOQUEI,
    STARTERS: STARTERS,
    WILD_HORSES: WILD_HORSES,
    BOT_NAMES: BOT_NAMES,
    LEAGUES: LEAGUES,
    ECONOMY: ECONOMY,
    ITEMS: ITEMS,
    ITENS_USO: ITENS_USO,
    SHOP_ORDER: SHOP_ORDER,
    BAG_MAX: BAG_MAX,
    DAILY: DAILY,
    GYM: GYM,
    GYM_ORDER: GYM_ORDER,
    GYMS: GYMS,
    FORJA: FORJA,
    AFK: AFK,
    FOAL_NAMES: FOAL_NAMES,
    BREED_LEFT: BREED_LEFT
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = GameData;
  else root.GameData = GameData;
})(typeof self !== 'undefined' ? self : this);
