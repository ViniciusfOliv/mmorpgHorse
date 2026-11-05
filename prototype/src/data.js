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
  //   statBonus: somado em RaceSim.computeStats.
  //   affinity: regras usadas por RaceSim.elementAffinity (sign +1 favorece, -1 atrapalha;
  //     weight opcional multiplica o passo padrão, default 1).
  //     kind: 'weather' | 'surface' | 'distance' | 'hills'
  // ---------------------------------------------------------------------------
  var ELEMENTS = {
    fogo: {
      id: 'fogo', name: 'Fogo', color: '#e8541e', icon: 'fire',
      statBonus: { stat: 'acel', amount: 8 },
      desc: 'Explosivo na largada. Brilha no sol e em pista curta; sofre com chuva.',
      affinity: [
        { kind: 'weather', value: 'sol', sign: 1, weight: 0.75, text: 'Sol favorece Fogo' },
        { kind: 'distance', value: 1000, sign: 1, weight: 0.5, text: 'Pista curta favorece Fogo' },
        { kind: 'weather', value: 'chuva', sign: -1, text: 'Chuva apaga o Fogo' }
      ]
    },
    agua: {
      id: 'agua', name: 'Água', color: '#2f8fd8', icon: 'water',
      statBonus: { stat: 'est', amount: 8 },
      desc: 'Fôlego de sobra. Cresce na chuva e em pista longa; afunda na areia.',
      affinity: [
        { kind: 'weather', value: 'chuva', sign: 1, weight: 1.5, text: 'Chuva favorece Água' },
        { kind: 'distance', value: 2400, sign: 1, text: 'Pista longa favorece Água' },
        { kind: 'surface', value: 'areia', sign: -1, text: 'Areia atola a Água' }
      ]
    },
    grama: {
      id: 'grama', name: 'Grama', color: '#4caf3a', icon: 'leaf',
      statBonus: { stat: 'forca', amount: 8 },
      desc: 'Firme como raiz. Domina terra e subidas; murcha no sol forte.',
      affinity: [
        { kind: 'surface', value: 'terra', sign: 1, weight: 1.25, text: 'Terra favorece Grama' },
        { kind: 'hills', value: true, sign: 1, weight: 1.25, text: 'Subidas favorecem Grama' },
        { kind: 'weather', value: 'sol', sign: -1, text: 'Sol forte murcha a Grama' }
      ]
    },
    neutro: {
      id: 'neutro', name: 'Neutro', color: '#9e9a8e', icon: 'circle',
      statBonus: null,
      desc: 'Sem bônus nem penalidade. Rende igual em qualquer pista.',
      affinity: []
    }
  };

  // ---------------------------------------------------------------------------
  // Raridades
  //   statCap: teto de cada status por level (antes de elemento e item).
  //   skillSlots: nº máximo de habilidades.
  //   growth: multiplicador do crescimento por level.
  // ---------------------------------------------------------------------------
  var RARITIES = {
    comum:    { id: 'comum',    name: 'Comum',    color: '#9e9e9e', statCap: 65,  skillSlots: 1, growth: 0.80, order: 0 },
    incomum:  { id: 'incomum',  name: 'Incomum',  color: '#4caf50', statCap: 75,  skillSlots: 2, growth: 0.90, order: 1 },
    raro:     { id: 'raro',     name: 'Raro',     color: '#2196f3', statCap: 85,  skillSlots: 2, growth: 1.00, order: 2 },
    epico:    { id: 'epico',    name: 'Épico',    color: '#9c27b0', statCap: 95,  skillSlots: 3, growth: 1.10, order: 3 },
    lendario: { id: 'lendario', name: 'Lendário', color: '#ff9800', statCap: 100, skillSlots: 3, growth: 1.20, order: 4 }
  };

  var STATS = {
    vel:   { id: 'vel',   name: 'Velocidade', short: 'VEL', desc: 'Velocidade máxima.' },
    acel:  { id: 'acel',  name: 'Aceleração', short: 'ACE', desc: 'Rapidez até a velocidade máxima (largada e retomadas).' },
    est:   { id: 'est',   name: 'Estamina',   short: 'EST', desc: 'Quanto tempo mantém o ritmo.' },
    forca: { id: 'forca', name: 'Força',      short: 'FOR', desc: 'Subidas, terreno pesado e disputa no pelotão.' },
    garra: { id: 'garra', name: 'Garra',      short: 'GAR', desc: 'Chance e força da arrancada final (últimos 20%).' }
  };

  var TACTICS = {
    ponteiro: {
      id: 'ponteiro', name: 'Ponteiro',
      desc: 'Dispara na frente e tenta segurar até o fim. Forte em pista curta; pode cansar em pista longa.'
    },
    perseguidor: {
      id: 'perseguidor', name: 'Perseguidor',
      desc: 'Corre colado no pelotão da frente, ritmo constante, aproveita o vácuo. Seguro em qualquer pista.'
    },
    arrancador: {
      id: 'arrancador', name: 'Arrancador',
      desc: 'Guarda energia lá atrás e explode nos últimos 25%. Forte em pista longa; arriscado em pista curta.'
    }
  };

  // slow: perda de velocidade (aliviada por Força); drain: gasto extra de estamina.
  var SURFACES = {
    grama: { id: 'grama', name: 'Grama', color: '#5fa34a', slow: 0.00, drain: 1.00, desc: 'Pista leve.' },
    terra: { id: 'terra', name: 'Terra', color: '#9a6b3f', slow: 0.03, drain: 1.05, desc: 'Pista média: Força ajuda.' },
    areia: { id: 'areia', name: 'Areia', color: '#e2c27a', slow: 0.06, drain: 1.12, desc: 'Pista pesada: Força ajuda muito.' }
  };

  var WEATHERS = {
    sol:     { id: 'sol',     name: 'Sol',     icon: 'sun',   desc: 'Calor: gasta um pouco mais de estamina.' },
    chuva:   { id: 'chuva',   name: 'Chuva',   icon: 'rain',  desc: 'Pista escorregadia: todos um pouco mais lentos.' },
    nublado: { id: 'nublado', name: 'Nublado', icon: 'cloud', desc: 'Condição neutra.' }
  };

  // Chave numérica = metros (conditions.distance).
  var DISTANCES = {
    1000: { id: 'curta', meters: 1000, name: 'Curta',  label: 'Curta (1000 m)' },
    1600: { id: 'media', meters: 1600, name: 'Média',  label: 'Média (1600 m)' },
    2400: { id: 'longa', meters: 2400, name: 'Longa',  label: 'Longa (2400 m)' }
  };

  // ---------------------------------------------------------------------------
  // Habilidades
  //   trigger: 'start' | 'final' (>=80% da pista) | 'midrace' (>=50%) | 'lowStamina' (<=25%)
  //            | 'hill' (entra na 1ª subida) | 'behind' (>=60% e na metade de trás)
  //            | 'weather:<sol|chuva|nublado>' | 'surface:<grama|terra|areia>'
  //   Cada habilidade dispara no máximo 1 vez por corrida.
  //   effect: speedMult/accelMult/staminaDrainMult valem por durationS; staminaRestore é instantâneo.
  //   exclusive: id do cavalo inicial dono (só ele pode ter).
  // ---------------------------------------------------------------------------
  var SKILLS = {
    // --- Fogo ---
    'labareda': {
      id: 'labareda', name: 'Labareda', element: 'fogo', exclusive: 'brasa', trigger: 'start',
      desc: 'Largada em chamas: +15% de aceleração e +1% de velocidade por 5s.',
      effect: { accelMult: 1.15, speedMult: 1.01, durationS: 5 }
    },
    'chama-final': {
      id: 'chama-final', name: 'Chama Final', element: 'fogo', trigger: 'final',
      desc: 'Na reta final, +5% de velocidade por 5s.',
      effect: { speedMult: 1.05, durationS: 5 }
    },
    'sol-a-pino': {
      id: 'sol-a-pino', name: 'Sol a Pino', element: 'fogo', trigger: 'weather:sol',
      desc: 'Com sol: +10% de aceleração e +2% de velocidade nos primeiros 30s.',
      effect: { accelMult: 1.1, speedMult: 1.02, durationS: 30 }
    },
    // --- Água ---
    'mare-alta': {
      id: 'mare-alta', name: 'Maré Alta', element: 'agua', exclusive: 'mare', trigger: 'lowStamina',
      desc: 'Quando a estamina cai a 25%, a maré sobe: recupera 20% de estamina e ganha +3% de velocidade por 8s.',
      effect: { staminaRestore: 0.20, speedMult: 1.03, durationS: 8 }
    },
    'correnteza': {
      id: 'correnteza', name: 'Correnteza', element: 'agua', trigger: 'weather:chuva',
      desc: 'Com chuva: gasta 15% menos estamina por 40s.',
      effect: { staminaDrainMult: 0.85, durationS: 40 }
    },
    'nascente': {
      id: 'nascente', name: 'Nascente', element: 'agua', trigger: 'midrace',
      desc: 'Na metade da corrida, recupera 12% de estamina.',
      effect: { staminaRestore: 0.12 }
    },
    'canto-da-iara': {
      id: 'canto-da-iara', name: 'Canto da Iara', element: 'agua', trigger: 'final',
      desc: 'Na reta final, +6% de velocidade por 5s e gasta 30% menos estamina.',
      effect: { speedMult: 1.06, staminaDrainMult: 0.7, durationS: 5 }
    },
    // --- Grama ---
    'raizes-firmes': {
      id: 'raizes-firmes', name: 'Raízes Firmes', element: 'grama', exclusive: 'ipe', trigger: 'midrace',
      desc: 'Na metade da corrida, finca os cascos: recupera 5% de estamina e +2% de velocidade por 8s.',
      effect: { staminaRestore: 0.05, speedMult: 1.02, durationS: 8 }
    },
    'casco-de-cabra': {
      id: 'casco-de-cabra', name: 'Casco de Cabra', element: 'grama', trigger: 'hill',
      desc: 'Na primeira subida: +8% de velocidade e 30% menos gasto de estamina por 8s.',
      effect: { speedMult: 1.08, staminaDrainMult: 0.7, durationS: 8 }
    },
    'trilha-de-terra': {
      id: 'trilha-de-terra', name: 'Trilha de Terra', element: 'grama', trigger: 'surface:terra',
      desc: 'Em pista de terra: +2% de velocidade nos primeiros 30s.',
      effect: { speedMult: 1.02, durationS: 30 }
    },
    // --- Genéricas (qualquer elemento) ---
    'largada-rapida': {
      id: 'largada-rapida', name: 'Largada Rápida', element: 'neutro', trigger: 'start',
      desc: '+30% de aceleração por 4s na largada.',
      effect: { accelMult: 1.3, durationS: 4 }
    },
    'segundo-folego': {
      id: 'segundo-folego', name: 'Segundo Fôlego', element: 'neutro', trigger: 'lowStamina',
      desc: 'Quando a estamina cai a 25%, recupera 18%.',
      effect: { staminaRestore: 0.18 }
    },
    'sprint-final': {
      id: 'sprint-final', name: 'Sprint Final', element: 'neutro', trigger: 'final',
      desc: 'Na reta final, +4% de velocidade por 5s.',
      effect: { speedMult: 1.04, durationS: 5 }
    },
    'raca': {
      id: 'raca', name: 'Raça', element: 'neutro', trigger: 'behind',
      desc: 'Se estiver na metade de trás depois de 60% da pista: +4% de velocidade por 6s.',
      effect: { speedMult: 1.04, durationS: 6 }
    }
  };

  // ---------------------------------------------------------------------------
  // Itens (1 por corrida). mods somam nos status; special é tratado pelo RaceSim.
  //   special.ignoreWeatherPenalty: anula a penalidade de clima do elemento.
  //   special.garraChanceBonus: soma na chance de Garra (0..1).
  //   special.staminaPoolMult: multiplica o tanque de estamina.
  // ---------------------------------------------------------------------------
  var ITEMS = {
    'ferradura-leve': {
      id: 'ferradura-leve', name: 'Ferradura Leve', rarity: 'comum', price: 120,
      desc: 'Casco leve, passada solta. Perde firmeza no pesado.',
      mods: { vel: 5, forca: -4 }
    },
    'ferradura-cravos': {
      id: 'ferradura-cravos', name: 'Ferradura com Cravos', rarity: 'comum', price: 120,
      desc: 'Agarra na areia e nas subidas, mas pesa na reta.',
      mods: { forca: 10, vel: -3 }
    },
    'sela-couro': {
      id: 'sela-couro', name: 'Sela de Couro Cru', rarity: 'comum', price: 100,
      desc: 'Confortável e sem segredo.',
      mods: { est: 5 }
    },
    'manta-la': {
      id: 'manta-la', name: 'Manta de Lã', rarity: 'incomum', price: 220,
      desc: 'Poupa o fôlego, mas deixa a largada preguiçosa.',
      mods: { est: 9, acel: -4 }
    },
    'antolhos': {
      id: 'antolhos', name: 'Antolhos', rarity: 'incomum', price: 220,
      desc: 'Foco total na reta final; demora a pegar embalo.',
      mods: { garra: 10, acel: -3 }
    },
    'rapadura-engenho': {
      id: 'rapadura-engenho', name: 'Rapadura de Engenho', rarity: 'incomum', price: 180,
      desc: 'Energia pura: tanque de estamina +4%, mas fica pesado (−2 Vel).',
      mods: { vel: -2 },
      special: { staminaPoolMult: 1.04 }
    },
    'esporas-prata': {
      id: 'esporas-prata', name: 'Esporas de Prata', rarity: 'raro', price: 400,
      desc: 'Arranque brutal, fôlego curto.',
      mods: { acel: 10, est: -6 }
    },
    'capa-impermeavel': {
      id: 'capa-impermeavel', name: 'Capa Impermeável', rarity: 'raro', price: 380,
      desc: 'Anula a penalidade de clima do elemento (ex.: Fogo na chuva).',
      mods: { est: 2 },
      special: { ignoreWeatherPenalty: true }
    },
    'figa-sorte': {
      id: 'figa-sorte', name: 'Figa da Sorte', rarity: 'epico', price: 700,
      desc: 'Garra +5 e +15% de chance de a Garra disparar.',
      mods: { garra: 5 },
      special: { garraChanceBonus: 0.15 }
    },
    'penas-gaviao': {
      id: 'penas-gaviao', name: 'Penas de Gavião-Real', rarity: 'lendario', price: 1500,
      desc: 'Voa baixo na reta (+10 Vel, +4 Gar), mas cansa antes (−6 Est).',
      mods: { vel: 10, garra: 4, est: -6 }
    }
  };

  // ---------------------------------------------------------------------------
  // Cavalos
  //   base = status no level 1 (antes de crescimento, elemento e item).
  //   potential 0–31 por status (oculto no jogo).
  // ---------------------------------------------------------------------------
  function horse(id, name, element, rarity, level, base, potential, skills, palette, extra) {
    var h = {
      id: id, name: name, element: element, rarity: rarity, level: level, xp: 0,
      base: base, potential: potential, skills: skills, palette: palette
    };
    if (extra) for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) h[k] = extra[k];
    return h;
  }

  var STARTERS = [
    horse('brasa', 'Brasa', 'fogo', 'raro', 1,
      { vel: 64, acel: 62, est: 60, forca: 52, garra: 62 },
      { vel: 22, acel: 24, est: 12, forca: 14, garra: 18 },
      ['labareda'],
      { coat: '#c4471d', coatShade: '#7f2a0e', mane: '#ffb02e', accent: '#ffe066' },
      { title: 'A fagulha veloz', bio: 'Potro alazão de crina dourada. Larga como um rojão.' }),
    horse('mare', 'Maré', 'agua', 'raro', 1,
      { vel: 62, acel: 54, est: 70, forca: 56, garra: 58 },
      { vel: 16, acel: 12, est: 24, forca: 18, garra: 20 },
      ['mare-alta'],
      { coat: '#3f78b0', coatShade: '#244a72', mane: '#d6f1ff', accent: '#3fd0e0' },
      { title: 'O fôlego do oceano', bio: 'Égua tordilha-azulada. Quanto mais longa a pista, mais perigosa.' }),
    horse('ipe', 'Ipê', 'grama', 'raro', 1,
      { vel: 62, acel: 56, est: 60, forca: 68, garra: 54 },
      { vel: 16, acel: 14, est: 18, forca: 24, garra: 18 },
      ['raizes-firmes'],
      { coat: '#6f8f3a', coatShade: '#465e22', mane: '#f5c518', accent: '#a3d977' },
      { title: 'A raiz que não verga', bio: 'Cavalo robusto de crina amarela como ipê florido. Não teme subida.' })
  ];

  var WILD_HORSES = [
    // Comum
    horse('w-pangare', 'Pangaré', 'neutro', 'comum', 1,
      { vel: 44, acel: 42, est: 46, forca: 48, garra: 40 },
      { vel: 10, acel: 12, est: 14, forca: 15, garra: 9 },
      [],
      { coat: '#8d6e52', coatShade: '#5c4532', mane: '#3b2a1e', accent: '#c9b28f' },
      { habitat: 'Pasto da fazenda' }),
    horse('w-faisca', 'Faísca', 'fogo', 'comum', 3,
      { vel: 48, acel: 50, est: 38, forca: 42, garra: 46 },
      { vel: 14, acel: 16, est: 8, forca: 10, garra: 12 },
      ['largada-rapida'],
      { coat: '#d9772b', coatShade: '#9a4d16', mane: '#f7d08a', accent: '#ff8a3d' },
      { habitat: 'Cerrado seco' }),
    horse('w-lambari', 'Lambari', 'agua', 'comum', 2,
      { vel: 42, acel: 44, est: 52, forca: 42, garra: 44 },
      { vel: 9, acel: 11, est: 17, forca: 12, garra: 13 },
      [],
      { coat: '#7fa6c4', coatShade: '#4f7594', mane: '#e8f4fb', accent: '#5ec2d9' },
      { habitat: 'Beira de rio' }),
    horse('w-capim', 'Capim', 'grama', 'comum', 4,
      { vel: 42, acel: 42, est: 46, forca: 52, garra: 42 },
      { vel: 10, acel: 10, est: 13, forca: 18, garra: 12 },
      ['segundo-folego'],
      { coat: '#9a8a4a', coatShade: '#6a5e2e', mane: '#5b7d2a', accent: '#b9d46a' },
      { habitat: 'Campos gerais' }),
    // Incomum
    horse('w-ticao', 'Tição', 'fogo', 'incomum', 8,
      { vel: 54, acel: 56, est: 42, forca: 46, garra: 52 },
      { vel: 17, acel: 19, est: 10, forca: 12, garra: 15 },
      ['chama-final'],
      { coat: '#3a2a26', coatShade: '#1e1513', mane: '#ff5a1f', accent: '#ffb347' },
      { habitat: 'Carvoaria abandonada' }),
    horse('w-garoa', 'Garoa', 'agua', 'incomum', 10,
      { vel: 48, acel: 46, est: 58, forca: 48, garra: 50 },
      { vel: 13, acel: 12, est: 20, forca: 14, garra: 15 },
      ['correnteza', 'segundo-folego'],
      { coat: '#a9b8c6', coatShade: '#73879a', mane: '#f2f6fa', accent: '#6fb7e8' },
      { habitat: 'Serra enevoada' }),
    horse('w-mandacaru', 'Mandacaru', 'grama', 'incomum', 7,
      { vel: 46, acel: 48, est: 52, forca: 58, garra: 46 },
      { vel: 12, acel: 13, est: 16, forca: 21, garra: 13 },
      ['casco-de-cabra'],
      { coat: '#b48a5a', coatShade: '#7d5c38', mane: '#3f6b2a', accent: '#e85d9a' },
      { habitat: 'Caatinga' }),
    // Raro
    horse('w-ventania', 'Ventania', 'neutro', 'raro', 15,
      { vel: 62, acel: 58, est: 56, forca: 52, garra: 57 },
      { vel: 21, acel: 18, est: 15, forca: 13, garra: 17 },
      ['sprint-final', 'raca'],
      { coat: '#e9e4da', coatShade: '#b6aea0', mane: '#7a7a7a', accent: '#9ad0ff' },
      { habitat: 'Pampa gaúcho' }),
    horse('w-pororoca', 'Pororoca', 'agua', 'raro', 18,
      { vel: 55, acel: 53, est: 64, forca: 57, garra: 56 },
      { vel: 15, acel: 14, est: 24, forca: 17, garra: 16 },
      ['nascente', 'correnteza'],
      { coat: '#2e5f73', coatShade: '#1a3b49', mane: '#9ee7e0', accent: '#2fd6c5' },
      { habitat: 'Foz do Amazonas' }),
    // Épico
    horse('w-fogareu', 'Fogaréu', 'fogo', 'epico', 22,
      { vel: 66, acel: 68, est: 52, forca: 54, garra: 60 },
      { vel: 24, acel: 26, est: 15, forca: 16, garra: 20 },
      ['sol-a-pino', 'chama-final', 'largada-rapida'],
      { coat: '#b3201a', coatShade: '#6e110d', mane: '#ffd23f', accent: '#ff7b00' },
      { habitat: 'Chapada em chamas' }),
    horse('w-jequitiba', 'Jequitibá', 'grama', 'epico', 25,
      { vel: 56, acel: 54, est: 62, forca: 70, garra: 58 },
      { vel: 17, acel: 16, est: 21, forca: 27, garra: 19 },
      ['casco-de-cabra', 'trilha-de-terra', 'segundo-folego'],
      { coat: '#5a4127', coatShade: '#36261a', mane: '#2f7d32', accent: '#8bc34a' },
      { habitat: 'Mata Atlântica' }),
    // Lendário
    horse('w-boitata', 'Boitatá', 'fogo', 'lendario', 30,
      { vel: 70, acel: 72, est: 56, forca: 58, garra: 64 },
      { vel: 28, acel: 29, est: 20, forca: 21, garra: 26 },
      ['sol-a-pino', 'chama-final', 'raca'],
      { coat: '#2a1a3a', coatShade: '#140b1e', mane: '#3cf0ff', accent: '#ff4fd8' },
      { habitat: 'Só aparece em noites de queimada', lore: 'A cobra de fogo do folclore, em forma de cavalo.' }),
    horse('w-iara', 'Iara', 'agua', 'lendario', 28,
      { vel: 64, acel: 60, est: 72, forca: 58, garra: 66 },
      { vel: 22, acel: 21, est: 30, forca: 20, garra: 25 },
      ['canto-da-iara', 'correnteza', 'nascente'],
      { coat: '#1f6f78', coatShade: '#0f3f45', mane: '#b8fff1', accent: '#ffd36e' },
      { habitat: 'Rios encantados', lore: 'A mãe-d\'água que encanta quem a ouve.' })
  ];

  var BOT_NAMES = [
    'ZéDaBaia', 'Rapadura_Turbo', 'Galopeira99', 'Uai_Sô', 'Bah_Tchê', 'Oxente_Racing',
    'Cuscuz_Nitro', 'PaçocaPower', 'Fubá_Galáctico', 'JabuticabaRun', 'Tropeiro_BR',
    'Peão_do_Asfalto', 'Vaqueira_Veloz', 'BrigadeiroGT', 'Mineirinho_Trem', 'Forrozeiro',
    'CaipiraTurbo', 'DonaFlorzinha', 'Xique_Xique', 'Coxinha_Crocante', 'Boi_Bumbá',
    'Tapioca_Ninja'
  ];

  // Ligas por Rating de Poder (RaceSim.powerRating). min inclusivo.
  var LEAGUES = [
    { id: 'bronze',   name: 'Bronze',   min: 0,    color: '#b0703c' },
    { id: 'prata',    name: 'Prata',    min: 550,  color: '#b8c2cc' },
    { id: 'ouro',     name: 'Ouro',     min: 700,  color: '#f2c230' },
    { id: 'platina',  name: 'Platina',  min: 800,  color: '#5fd3c8' },
    { id: 'diamante', name: 'Diamante', min: 900,  color: '#7ab8ff' },
    { id: 'lenda',    name: 'Lenda',    min: 1000, color: '#ff7a3d' }
  ];

  var ECONOMY = {
    currency: { id: 'ouro', name: 'Ouro', icon: 'coin' },
    entryTiers: [50, 100, 250],
    houseFee: 0.10,
    payoutSplit: [0.6, 0.25, 0.15],
    startingGold: 500,
    minRacers: 4,
    maxRacers: 8,
    maxLevel: 50,
    // XP por colocação (1º..8º).
    xpPerPlace: [100, 70, 50, 35, 25, 20, 15, 10],
    // XP necessário para subir do level `level` para `level + 1`.
    xpToLevel: function (level) { return 50 + 25 * level; }
  };

  // Hipódromos de exemplo (fictícios). hills: [[inícioM, fimM], ...]
  var TRACK_EXAMPLES = [
    { id: 'praia-dourada', name: 'Hipódromo Praia Dourada', distance: 1000, surface: 'areia', weather: 'sol', hills: [],
      desc: 'Reta curta à beira-mar, areia fofa e sol de rachar.' },
    { id: 'serra-verde', name: 'Circuito Serra Verde', distance: 1600, surface: 'grama', weather: 'nublado', hills: [[450, 650], [1050, 1220]],
      desc: 'Duas subidas na serra, gramado bem cuidado.' },
    { id: 'raia-sertao', name: 'Raia do Sertão', distance: 2400, surface: 'terra', weather: 'sol', hills: [[900, 1120]],
      desc: 'Terra batida, calor e uma ladeira no meio do caminho.' },
    { id: 'hipodromo-garoa', name: 'Hipódromo da Garoa', distance: 2400, surface: 'grama', weather: 'chuva', hills: [],
      desc: 'Pista longa e plana sob chuva fina. Paraíso da Água.' },
    { id: 'pampa-vento', name: 'Pista do Pampa', distance: 1600, surface: 'terra', weather: 'chuva', hills: [],
      desc: 'Planície gaúcha, terra molhada.' }
  ];

  var GameData = {
    version: '0.1-prototipo',
    STAT_KEYS: ['vel', 'acel', 'est', 'forca', 'garra'],
    STATS: STATS,
    ELEMENTS: ELEMENTS,
    RARITIES: RARITIES,
    TACTICS: TACTICS,
    SURFACES: SURFACES,
    WEATHERS: WEATHERS,
    DISTANCES: DISTANCES,
    SKILLS: SKILLS,
    ITEMS: ITEMS,
    STARTERS: STARTERS,
    WILD_HORSES: WILD_HORSES,
    BOT_NAMES: BOT_NAMES,
    LEAGUES: LEAGUES,
    ECONOMY: ECONOMY,
    TRACK_EXAMPLES: TRACK_EXAMPLES
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = GameData;
  else root.GameData = GameData;
})(typeof self !== 'undefined' ? self : this);
