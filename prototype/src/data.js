/*
 * MMORPG Horse — dados do protótipo (descartável).
 *
 * Tudo que é texto de jogo está em português do Brasil.
 * Identificadores de código: inglês para estrutura (id, name, base...),
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
      desc: 'Explosivo na largada. Brilha no sol; sofre com chuva.'
    },
    agua: {
      id: 'agua', name: 'Água', color: '#2f8fd8', icon: 'water',
      weather: 'chuva',
      desc: 'Fôlego de sobra. Cresce na chuva; sofre na névoa.'
    },
    grama: {
      id: 'grama', name: 'Grama', color: '#4caf3a', icon: 'leaf',
      weather: 'nevoa',
      desc: 'Firme como raiz. Domina a névoa e as subidas; murcha no sol.'
    }
  };

  // ---------------------------------------------------------------------------
  // Raridades
  //   statCap: teto de cada status (natural + pontos livres; o equipamento soma depois do teto).
  //   skillSlots: nº máximo de habilidades; bornSkills: nº MÍNIMO ao nascer (o potro completa
  //   com skills compatíveis até esse número, limitado às vagas);
  //   skillChance: chance base de ativar cada skill quando o gatilho acontece.
  //   baseLo: início da faixa de 16 pontos (RaceSim.TUNING.gBand) onde nasce cada status, conforme a
  //   genética: status no nível 1 = baseLo + 16 × g / 31.
  // ---------------------------------------------------------------------------
  var RARITIES = {
    comum:    { id: 'comum',    name: 'Comum',    color: '#9e9e9e', statCap: 80,  skillSlots: 1, bornSkills: 1, skillChance: 0.35, order: 0, baseLo: 40 },
    magico:   { id: 'magico',   name: 'Mágico',   color: '#4caf50', statCap: 85,  skillSlots: 2, bornSkills: 1, skillChance: 0.45, order: 1, baseLo: 45 },
    raro:     { id: 'raro',     name: 'Raro',     color: '#2196f3', statCap: 90,  skillSlots: 3, bornSkills: 2, skillChance: 0.55, order: 2, baseLo: 50 },
    lendario: { id: 'lendario', name: 'Lendário', color: '#ff9800', statCap: 95,  skillSlots: 4, bornSkills: 2, skillChance: 0.65, order: 3, baseLo: 55 },
    mitico:   { id: 'mitico',   name: 'Mítico',   color: '#9c27b0', statCap: 100, skillSlots: 5, bornSkills: 3, skillChance: 0.75, order: 4, baseLo: 60 }
  };

  var STAT_KEYS = ['vel', 'acel', 'man', 'forca', 'est', 'garra', 'sorte'];

  var STATS = {
    vel:   { id: 'vel',   name: 'Velocidade', short: 'VEL', desc: 'Velocidade máxima.' },
    acel:  { id: 'acel',  name: 'Aceleração', short: 'ACE', desc: 'Rapidez até a velocidade máxima (largada e retomadas).' },
    man:   { id: 'man',   name: 'Manobra',    short: 'MAN', desc: 'Agilidade nas curvas e na saída delas.' },
    forca: { id: 'forca', name: 'Força',      short: 'FOR', desc: 'Subidas, terreno pesado e disputa no pelotão.' },
    est:   { id: 'est',   name: 'Estamina',   short: 'EST', desc: 'Quanto tempo mantém o ritmo.' },
    garra: { id: 'garra', name: 'Garra',      short: 'GAR', desc: 'Chance e força da arrancada final (últimos 20%).' },
    sorte: { id: 'sorte', name: 'Sorte',      short: 'SOR', desc: 'Chance de rolar um 2º dado no Dado da Sorte e bônus para ativar skills.' }
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
  // multiplicados por P = RaceSim.typePower (cresce com nível e raridade):
  //   accelMult / speedMult: somam x·P ao multiplicador; drainCut: corta x·P do gasto de estamina;
  //   forcaAdd / manAdd: somam x·P a n(Força) / n(Manobra) (curva, subida, piso, pelotão);
  //   staminaRestore: recupera x·P do tanque uma vez, ao entrar no terço.
  //   short: nome de até 12 letras para o balão da corrida.
  // ---------------------------------------------------------------------------
  var TYPE_SKILLS = {
    fogo: {
      id: 'labareda', name: 'Labareda', short: 'LABAREDA', zone: [0, 1 / 3],
      effect: { accelMult: 0.23 },
      desc: 'No primeiro terço da pista, a largada pega fogo: +23% de aceleração (cresce com nível e raridade).'
    },
    grama: {
      id: 'raizes-firmes', name: 'Raízes Firmes', short: 'RAÍZES FIRM.', zone: [1 / 3, 2 / 3],
      effect: { forcaAdd: 0.07, manAdd: 0.07, drainCut: 0.012 },
      desc: 'No terço do meio, finca os cascos: +7 de Força e de Manobra e gasta 1,2% menos estamina (cresce com nível e raridade).'
    },
    agua: {
      id: 'mare-alta', name: 'Maré Alta', short: 'MARÉ ALTA', zone: [2 / 3, 1],
      effect: { speedMult: 0.018, staminaRestore: 0.012 },
      desc: 'No último terço, a maré sobe: recupera 1,2% de estamina ao entrar e corre +1,8% mais rápido (cresce com nível e raridade).'
    }
  };

  // ---------------------------------------------------------------------------
  // Habilidades
  //   trigger: 'start' | 'straight' (reta de 150 m ou mais, fora a da largada) | 'curve' | 'curveExit'
  //            | 'hill' | 'lowStamina' (<=30%) | 'final' (últimos 20%) | 'dice' (uma tentativa,
  //            antes do 1º Dado) | 'weather:<sol|chuva|nevoa>'
  //   effect (chaves usadas):
  //     accelMult / speedMult: multiplicadores; drainMult: gasto de estamina;
  //     distanceM / durationS: duração do efeito em metros ou segundos;
  //     curveBonus / hillBonus / hillDrainMult: bônus nos blocos de curva/subida;
  //     blockScoped: vale uma vez por bloco (curva/subida), não uma vez por corrida;
  //     staminaRestore: recupera fração do tanque (instantâneo);
  //     garraChanceBonus / garraBoostBonus: reforça a arrancada de Garra;
  //     extraDice: dados extras; weatherDouble: o bônus do clima vira T.weatherMultDouble (×1,08 no lugar de ×1,03).
  //   short (opcional): nome de até 12 letras para o balão da corrida (só apresentação, não é regra).
  //   element: 'geral' (qualquer tipo aprende) ou o tipo que aprende.
  // ---------------------------------------------------------------------------
  var SKILLS = {
    // --- Gerais (qualquer tipo) ---
    'arranque': {
      id: 'arranque', name: 'Arranque', element: 'geral', trigger: 'start',
      desc: 'Largada explosiva: +20% de aceleração nos primeiros 100 m.',
      effect: { accelMult: 1.2, distanceM: 100 }
    },
    'sprint': {
      id: 'sprint', name: 'Sprint', element: 'geral', trigger: 'straight',
      desc: 'Numa reta de 150 m ou mais (fora a da largada): +6% de velocidade por 150 m.',
      effect: { speedMult: 1.06, drainMult: 1.0, distanceM: 150 }
    },
    'drift': {
      id: 'drift', name: 'Drift', element: 'geral', trigger: 'curve',
      desc: 'Em cada curva: +3% de rendimento na curva.',
      effect: { curveBonus: 0.03, blockScoped: true }
    },
    'saida-rapida': {
      id: 'saida-rapida', name: 'Saída Rápida', element: 'geral', trigger: 'curveExit',
      desc: 'Ao sair da curva: +40% de aceleração e +6% de velocidade por 6s.',
      effect: { accelMult: 1.4, speedMult: 1.06, durationS: 6 }
    },
    'folego-de-montanha': {
      id: 'folego-de-montanha', name: 'Fôlego de Montanha', short: 'FÔLEGO MONT.', element: 'geral', trigger: 'hill',
      desc: 'Em cada subida: gasta 80% menos estamina extra da subida.',
      effect: { hillDrainMult: 0.2, blockScoped: true }
    },
    'segundo-ar': {
      id: 'segundo-ar', name: 'Segundo Ar', element: 'geral', trigger: 'lowStamina',
      desc: 'Quando a estamina cai a 30%, recupera 15% e ganha +5% de velocidade por 8s.',
      effect: { staminaRestore: 0.15, speedMult: 1.05, durationS: 8 }
    },
    'arrancada-final': {
      id: 'arrancada-final', name: 'Arrancada Final', short: 'ARR. FINAL', element: 'geral', trigger: 'final',
      desc: 'Na reta final: +15% de chance de Garra e +3% de força na arrancada.',
      effect: { garraChanceBonus: 0.15, garraBoostBonus: 0.03 }
    },
    'dado-viciado': {
      id: 'dado-viciado', name: 'Dado Viciado', element: 'geral', trigger: 'dice',
      desc: 'Uma tentativa por corrida, antes do 1º Dado da Sorte: se ativar, rola 1 dado extra em todos os Dados da corrida.',
      effect: { extraDice: 1 }
    },
    // --- Fogo ---
    'sol-a-pino': {
      id: 'sol-a-pino', name: 'Sol a Pino', element: 'fogo', trigger: 'weather:sol',
      desc: 'Com sol: o bônus do clima para o Fogo sobe de +3% para +8%.',
      effect: { weatherDouble: true }
    },
    'chama-final': {
      id: 'chama-final', name: 'Chama Final', element: 'fogo', trigger: 'final',
      desc: 'Na reta final, +5% de velocidade por 8s.',
      effect: { speedMult: 1.05, durationS: 8 }
    },
    // --- Água ---
    'pe-na-chuva': {
      id: 'pe-na-chuva', name: 'Pé na Chuva', element: 'agua', trigger: 'weather:chuva',
      desc: 'Com chuva: o bônus do clima para a Água sobe de +3% para +8%.',
      effect: { weatherDouble: true }
    },
    'canto-da-iara': {
      id: 'canto-da-iara', name: 'Canto da Iara', short: 'CANTO IARA', element: 'agua', trigger: 'final',
      desc: 'Na reta final, +6% de velocidade por 7s e gasta 30% menos estamina.',
      effect: { speedMult: 1.06, drainMult: 0.7, durationS: 7 }
    },
    'nascente': {
      id: 'nascente', name: 'Nascente', element: 'agua', trigger: 'straight',
      desc: 'Numa reta de 150 m ou mais (fora a da largada), recupera 12% de estamina.',
      effect: { staminaRestore: 0.12 }
    },
    // --- Grama ---
    'nevoa-amiga': {
      id: 'nevoa-amiga', name: 'Névoa Amiga', element: 'grama', trigger: 'weather:nevoa',
      desc: 'Com névoa: o bônus do clima para a Grama sobe de +3% para +8%.',
      effect: { weatherDouble: true }
    },
    'casco-firme': {
      id: 'casco-firme', name: 'Casco Firme', element: 'grama', trigger: 'hill',
      desc: 'Em cada subida: +2% de rendimento na subida.',
      effect: { hillBonus: 0.02, blockScoped: true }
    }
  };

  // ---------------------------------------------------------------------------
  // Montarias (espécie 'cavalo')
  //   potential = genética, 0–31 por status: define onde o status nasce na faixa da raridade e
  //   acelera o crescimento (RaceSim.computeStats). Não há status base guardado.
  //   alloc (no save, não no catálogo) = pontos livres distribuídos por status.
  //   sex: 'm' | 'f'.
  //   extra (opcional): title, bio, habitat, lore, grau (1–3 estrelas: multiplicam os pontos livres),
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

  var STARTERS = [
    mount('brasa', 'Brasa', 'fogo', 'comum', 'm', 1,
      { vel: 24, acel: 24, man: 14, forca: 12, est: 12, garra: 14, sorte: 12 },
      [],
      { coat: '#c4471d', coatShade: '#7f2a0e', mane: '#ffb02e', accent: '#ffe066' },
      { title: 'A fagulha veloz', bio: 'Potro alazão de crina dourada. Larga como um rojão.', grau: 2 }),
    mount('mare', 'Maré', 'agua', 'comum', 'f', 1,
      { vel: 14, acel: 12, man: 12, forca: 14, est: 24, garra: 24, sorte: 12 },
      [],
      { coat: '#9ba7b4', coatShade: '#646f7e', mane: '#5fd8ee', accent: '#e6f4fb' },
      { title: 'O fôlego do oceano', bio: 'Égua tordilha de crina cor do mar. Quanto mais longa a pista, mais perigosa.', grau: 2 }),
    mount('ipe', 'Ipê', 'grama', 'comum', 'm', 1,
      { vel: 16, acel: 12, man: 24, forca: 24, est: 14, garra: 12, sorte: 10 },
      [],
      { coat: '#7a4a2a', coatShade: '#4c2b18', mane: '#f5c518', accent: '#f2e6c8' },
      { title: 'A raiz que não verga', bio: 'Castanho robusto de crina amarela como ipê florido. Não teme subida.', grau: 2 })
  ];

  var WILD_HORSES = [
    mount('w-faisca', 'Faísca', 'fogo', 'comum', 'f', 3,
      { vel: 14, acel: 16, man: 15, forca: 10, est: 8, garra: 12, sorte: 10 },
      ['arranque'],
      { coat: '#d9772b', coatShade: '#9a4d16', mane: '#f7d08a', accent: '#ff8a3d' },
      { habitat: 'Cerrado seco', grau: 2 }),
    mount('w-lambari', 'Lambari', 'agua', 'comum', 'm', 2,
      { vel: 9, acel: 11, man: 10, forca: 12, est: 17, garra: 13, sorte: 10 },
      [],
      { coat: '#7fa6c4', coatShade: '#4f7594', mane: '#e8f4fb', accent: '#5ec2d9' },
      { habitat: 'Beira de rio', grau: 1 }),
    mount('w-capim', 'Capim', 'grama', 'comum', 'f', 4,
      { vel: 10, acel: 10, man: 10, forca: 18, est: 13, garra: 12, sorte: 10 },
      ['segundo-ar'],
      { coat: '#9a8a4a', coatShade: '#6a5e2e', mane: '#5b7d2a', accent: '#b9d46a' },
      { habitat: 'Campos gerais', grau: 2 }),
    mount('w-ticao', 'Tição', 'fogo', 'magico', 'm', 8,
      { vel: 17, acel: 19, man: 18, forca: 12, est: 10, garra: 15, sorte: 12 },
      ['chama-final'],
      { coat: '#3a2a26', coatShade: '#1e1513', mane: '#ff5a1f', accent: '#ffb347' },
      { habitat: 'Carvoaria abandonada', grau: 2 }),
    mount('w-garoa', 'Garoa', 'agua', 'magico', 'f', 10,
      { vel: 13, acel: 12, man: 13, forca: 14, est: 20, garra: 15, sorte: 12 },
      ['pe-na-chuva', 'segundo-ar'],
      { coat: '#a9b8c6', coatShade: '#73879a', mane: '#f2f6fa', accent: '#6fb7e8' },
      { habitat: 'Serra enevoada', grau: 2 }),
    mount('w-mandacaru', 'Mandacaru', 'grama', 'magico', 'm', 7,
      { vel: 12, acel: 13, man: 13, forca: 21, est: 16, garra: 13, sorte: 12 },
      ['casco-firme'],
      { coat: '#b48a5a', coatShade: '#7d5c38', mane: '#3f6b2a', accent: '#e85d9a' },
      { habitat: 'Caatinga', grau: 2 }),
    mount('w-ventania', 'Ventania', 'grama', 'raro', 'f', 15,
      { vel: 21, acel: 18, man: 20, forca: 13, est: 15, garra: 17, sorte: 14 },
      ['sprint', 'arrancada-final'],
      { coat: '#e9e4da', coatShade: '#b6aea0', mane: '#7a7a7a', accent: '#9ad0ff' },
      { habitat: 'Pampa gaúcho', grau: 3 }),
    mount('w-pororoca', 'Pororoca', 'agua', 'raro', 'm', 18,
      { vel: 15, acel: 14, man: 15, forca: 17, est: 24, garra: 16, sorte: 14 },
      ['nascente', 'pe-na-chuva'],
      { coat: '#2e5f73', coatShade: '#1a3b49', mane: '#9ee7e0', accent: '#2fd6c5' },
      { habitat: 'Foz do Amazonas', grau: 2 }),
    mount('w-fogareu', 'Fogaréu', 'fogo', 'lendario', 'f', 22,
      { vel: 24, acel: 26, man: 25, forca: 16, est: 15, garra: 20, sorte: 16 },
      ['sol-a-pino', 'chama-final', 'arranque'],
      { coat: '#b3201a', coatShade: '#6e110d', mane: '#ffd23f', accent: '#ff7b00' },
      { habitat: 'Chapada em chamas', grau: 3 }),
    mount('w-jequitiba', 'Jequitibá', 'grama', 'lendario', 'm', 25,
      { vel: 17, acel: 16, man: 17, forca: 27, est: 21, garra: 19, sorte: 16 },
      ['casco-firme', 'folego-de-montanha', 'segundo-ar'],
      { coat: '#5a4127', coatShade: '#36261a', mane: '#2f7d32', accent: '#8bc34a' },
      { habitat: 'Mata Atlântica', grau: 3 }),
    mount('w-boitata', 'Boitatá', 'fogo', 'mitico', 'f', 30,
      { vel: 28, acel: 29, man: 29, forca: 21, est: 20, garra: 26, sorte: 18 },
      ['sol-a-pino', 'chama-final', 'drift'],
      { coat: '#2a1a3a', coatShade: '#140b1e', mane: '#3cf0ff', accent: '#ff4fd8' },
      { habitat: 'Só aparece em noites de queimada', lore: 'A cobra de fogo do folclore, em forma de cavalo.', grau: 3 }),
    mount('w-iara', 'Iara', 'agua', 'mitico', 'm', 28,
      { vel: 22, acel: 21, man: 22, forca: 20, est: 30, garra: 25, sorte: 18 },
      ['canto-da-iara', 'pe-na-chuva', 'nascente'],
      { coat: '#1f6f78', coatShade: '#0f3f45', mane: '#b8fff1', accent: '#ffd36e' },
      { habitat: 'Rios encantados', lore: 'A mãe-d\'água que encanta quem a ouve.', grau: 3 })
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
  // sem peças e sem skills de vaga, com alloc = RaceSim.botAlloc(cavalo).
  //   lo = Poder do Comum de nível 1 = 711;  hi = Poder do Lendário de nível 50 = 1316.
  //   Bronze começa em 0; a liga k (1 a 5) em lo + k·(hi − lo)/6, arredondado para a dezena:
  //   811,8 → 810 · 912,7 → 910 · 1013,5 → 1010 · 1114,3 → 1110 · 1215,2 → 1220.
  // O sim-test refaz a conta: mudou peso do Poder, status ou build dos bots, recalcule aqui.
  var LEAGUES = [
    { id: 'bronze',   name: 'Bronze',   min: 0,    color: '#b0703c' },
    { id: 'prata',    name: 'Prata',    min: 810,  color: '#b8c2cc' },
    { id: 'ouro',     name: 'Ouro',     min: 910,  color: '#f2c230' },
    { id: 'platina',  name: 'Platina',  min: 1010, color: '#5fd3c8' },
    { id: 'diamante', name: 'Diamante', min: 1110, color: '#7ab8ff' },
    { id: 'lenda',    name: 'Lenda',    min: 1220, color: '#ff7a3d' }
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
      main: { comum: 2, magico: 2, raro: 3, lendario: 4 },
      sub: { comum: 0, magico: 1, raro: 2, lendario: 3 },
      plusStep: 0.5,   // cada +N soma plusStep ao status principal (uma peça +10 soma +5)
      plusMax: 10,
      // Chance e custo (em pedras) de cada passo +0→+1 … +9→+10; falha derruba a partir de enhanceDropFrom.
      enhanceChance: [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.35, 0.3, 0.25],
      enhanceCost: [1, 1, 1, 1, 1, 1, 2, 2, 2, 2],
      enhanceDropFrom: 6,
      setBonus: { pieces: [3, 4, 5], skillChance: 0.05, sorte: 5, ratingPts: [3, 15, 20] },
      podiumStone: [0.6, 0.4, 0.25],
      startGear: ['sela-comum', 'ferraduras-comum']
    }
  };

  // ---------------------------------------------------------------------------------------------
  // Equipamento: 5 slots por montaria. Cada peça dá um status principal e um secundário, definidos
  // pelo slot (GEAR_SLOT_INFO) e pela raridade (ECONOMY.gear.main/sub).
  //   id: '<slot>-<raridade>' (solta: Comum/Mágico) ou '<slot>-<conjunto>-<raridade>' (Raro/Lendário).
  //   Conjuntos (sol/chuva/nevoa) dão bônus por nº de peças equipadas; Lendário não vai à loja.
  // ---------------------------------------------------------------------------------------------
  var GEAR_SLOTS = ['ferraduras', 'sela', 'estribos', 'testeira', 'armadura'];

  var GEAR_SLOT_INFO = {
    ferraduras: { name: 'Ferraduras', main: 'vel', sub: 'acel' },
    sela: { name: 'Sela', main: 'est', sub: 'garra' },
    estribos: { name: 'Estribos', main: 'man', sub: 'sorte' },
    testeira: { name: 'Testeira', main: 'acel', sub: 'garra' },
    armadura: { name: 'Armadura', main: 'forca', sub: 'est' }
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
        main: ECONOMY.gear.main[rarity], sub: ECONOMY.gear.sub[rarity],
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

  var GameData = {
    version: '0.2-prototipo',
    STAT_KEYS: STAT_KEYS,
    STATS: STATS,
    ELEMENTS: ELEMENTS,
    RARITIES: RARITIES,
    TYPE_SKILLS: TYPE_SKILLS,
    SURFACES: SURFACES,
    WEATHERS: WEATHERS,
    BLOCK_TYPES: BLOCK_TYPES,
    SKILLS: SKILLS,
    GEAR_SLOTS: GEAR_SLOTS,
    GEAR_SLOT_INFO: GEAR_SLOT_INFO,
    GEAR_SETS: GEAR_SETS,
    GEAR: GEAR,
    STARTERS: STARTERS,
    WILD_HORSES: WILD_HORSES,
    BOT_NAMES: BOT_NAMES,
    LEAGUES: LEAGUES,
    ECONOMY: ECONOMY,
    FOAL_NAMES: FOAL_NAMES,
    BREED_LEFT: BREED_LEFT
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = GameData;
  else root.GameData = GameData;
})(typeof self !== 'undefined' ? self : this);
