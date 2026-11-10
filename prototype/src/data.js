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
  //   weather: clima "dono" do elemento (WEATHERS[w].element aponta de volta); null = nenhum.
  // ---------------------------------------------------------------------------
  var ELEMENTS = {
    fogo: {
      id: 'fogo', name: 'Fogo', color: '#e8541e', icon: 'fire',
      statBonus: { stat: 'acel', amount: 8 },
      weather: 'sol',
      desc: 'Explosivo na largada. Brilha no sol; sofre com chuva.'
    },
    agua: {
      id: 'agua', name: 'Água', color: '#2f8fd8', icon: 'water',
      statBonus: { stat: 'est', amount: 8 },
      weather: 'chuva',
      desc: 'Fôlego de sobra. Cresce na chuva; sofre na névoa.'
    },
    grama: {
      id: 'grama', name: 'Grama', color: '#4caf3a', icon: 'leaf',
      statBonus: { stat: 'forca', amount: 8 },
      weather: 'nevoa',
      desc: 'Firme como raiz. Domina a névoa e as subidas; murcha no sol.'
    },
    neutro: {
      id: 'neutro', name: 'Neutro', color: '#9e9a8e', icon: 'circle',
      statBonus: null,
      weather: null,
      desc: 'Sem bônus nem penalidade. Rende igual em qualquer clima.'
    }
  };

  // ---------------------------------------------------------------------------
  // Raridades
  //   statCap: teto de cada status por level (antes de elemento e equipamento).
  //   growth: multiplicador do crescimento por level.
  //   skillSlots: nº máximo de habilidades; bornSkills: nº máximo ao nascer;
  //   skillChance: chance base de ativar cada skill quando o gatilho acontece.
  //   baseLo: início da faixa de 16 pontos onde nascem os status base de um potro.
  // ---------------------------------------------------------------------------
  var RARITIES = {
    comum:    { id: 'comum',    name: 'Comum',    color: '#9e9e9e', statCap: 60,  growth: 0.80, skillSlots: 1, bornSkills: 1, skillChance: 0.35, order: 0, baseLo: 36 },
    magico:   { id: 'magico',   name: 'Mágico',   color: '#4caf50', statCap: 70,  growth: 0.90, skillSlots: 2, bornSkills: 1, skillChance: 0.45, order: 1, baseLo: 44 },
    raro:     { id: 'raro',     name: 'Raro',     color: '#2196f3', statCap: 80,  growth: 1.00, skillSlots: 3, bornSkills: 2, skillChance: 0.55, order: 2, baseLo: 52 },
    lendario: { id: 'lendario', name: 'Lendário', color: '#ff9800', statCap: 90,  growth: 1.10, skillSlots: 4, bornSkills: 2, skillChance: 0.65, order: 3, baseLo: 60 },
    mitico:   { id: 'mitico',   name: 'Mítico',   color: '#9c27b0', statCap: 100, growth: 1.20, skillSlots: 5, bornSkills: 3, skillChance: 0.75, order: 4, baseLo: 68 }
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
  // Habilidades
  //   trigger: 'start' | 'straight' | 'curve' | 'curveExit' | 'hill' | 'lowStamina' (<=30%)
  //            | 'final' (últimos 20%) | 'dice' | 'weather:<sol|chuva|nevoa>'
  //   effect (chaves usadas):
  //     accelMult / speedMult: multiplicadores; drainMult: gasto de estamina;
  //     distanceM / durationS: duração do efeito em metros ou segundos;
  //     curveBonus / hillBonus / hillDrainMult: bônus nos blocos de curva/subida;
  //     blockScoped: vale uma vez por bloco (curva/subida), não uma vez por corrida;
  //     staminaRestore: recupera fração do tanque (instantâneo);
  //     garraChanceBonus / garraBoostBonus: reforça a arrancada de Garra;
  //     extraDice: dados extras; weatherDouble: dobra o bônus do clima.
  //   short (opcional): nome de até 12 letras para o balão da corrida (só apresentação, não é regra);
  //   exclusive: id da montaria inicial dona (só ela pode ter).
  // ---------------------------------------------------------------------------
  var SKILLS = {
    // --- Genéricas (neutro) ---
    'arranque': {
      id: 'arranque', name: 'Arranque', element: 'neutro', trigger: 'start',
      desc: 'Largada explosiva: +20% de aceleração nos primeiros 100 m.',
      effect: { accelMult: 1.2, distanceM: 100 }
    },
    'sprint': {
      id: 'sprint', name: 'Sprint', element: 'neutro', trigger: 'straight',
      desc: 'Numa reta: +6% de velocidade por 150 m.',
      effect: { speedMult: 1.06, drainMult: 1.0, distanceM: 150 }
    },
    'drift': {
      id: 'drift', name: 'Drift', element: 'neutro', trigger: 'curve',
      desc: 'Em cada curva: +3% de rendimento na curva.',
      effect: { curveBonus: 0.03, blockScoped: true }
    },
    'saida-rapida': {
      id: 'saida-rapida', name: 'Saída Rápida', element: 'neutro', trigger: 'curveExit',
      desc: 'Ao sair da curva: +40% de aceleração e +6% de velocidade por 6s.',
      effect: { accelMult: 1.4, speedMult: 1.06, durationS: 6 }
    },
    'folego-de-montanha': {
      id: 'folego-de-montanha', name: 'Fôlego de Montanha', short: 'FÔLEGO MONT.', element: 'neutro', trigger: 'hill',
      desc: 'Em cada subida: gasta 80% menos estamina extra da subida.',
      effect: { hillDrainMult: 0.2, blockScoped: true }
    },
    'segundo-ar': {
      id: 'segundo-ar', name: 'Segundo Ar', element: 'neutro', trigger: 'lowStamina',
      desc: 'Quando a estamina cai a 30%, recupera 15% e ganha +5% de velocidade por 8s.',
      effect: { staminaRestore: 0.15, speedMult: 1.05, durationS: 8 }
    },
    'arrancada-final': {
      id: 'arrancada-final', name: 'Arrancada Final', short: 'ARR. FINAL', element: 'neutro', trigger: 'final',
      desc: 'Na reta final: +15% de chance de Garra e +3% de força na arrancada.',
      effect: { garraChanceBonus: 0.15, garraBoostBonus: 0.03 }
    },
    'dado-viciado': {
      id: 'dado-viciado', name: 'Dado Viciado', element: 'neutro', trigger: 'dice',
      desc: 'Rola 1 dado extra nos eventos de Sorte.',
      effect: { extraDice: 1 }
    },
    // --- Fogo ---
    'sol-a-pino': {
      id: 'sol-a-pino', name: 'Sol a Pino', element: 'fogo', trigger: 'weather:sol',
      desc: 'Com sol: o bônus do clima para o Fogo é dobrado.',
      effect: { weatherDouble: true }
    },
    'labareda': {
      id: 'labareda', name: 'Labareda', element: 'fogo', exclusive: 'brasa', trigger: 'start',
      desc: 'Largada em chamas: +15% de aceleração e +1% de velocidade por 5s.',
      effect: { accelMult: 1.15, speedMult: 1.01, durationS: 5 }
    },
    'chama-final': {
      id: 'chama-final', name: 'Chama Final', element: 'fogo', trigger: 'final',
      desc: 'Na reta final, +5% de velocidade por 8s.',
      effect: { speedMult: 1.05, durationS: 8 }
    },
    // --- Água ---
    'pe-na-chuva': {
      id: 'pe-na-chuva', name: 'Pé na Chuva', element: 'agua', trigger: 'weather:chuva',
      desc: 'Com chuva: o bônus do clima para a Água é dobrado.',
      effect: { weatherDouble: true }
    },
    'mare-alta': {
      id: 'mare-alta', name: 'Maré Alta', element: 'agua', exclusive: 'mare', trigger: 'lowStamina',
      desc: 'Quando a estamina cai a 30%, a maré sobe: recupera 20% de estamina e ganha +5% de velocidade por 8s.',
      effect: { staminaRestore: 0.20, speedMult: 1.05, durationS: 8 }
    },
    'canto-da-iara': {
      id: 'canto-da-iara', name: 'Canto da Iara', short: 'CANTO IARA', element: 'agua', trigger: 'final',
      desc: 'Na reta final, +6% de velocidade por 7s e gasta 30% menos estamina.',
      effect: { speedMult: 1.06, drainMult: 0.7, durationS: 7 }
    },
    'nascente': {
      id: 'nascente', name: 'Nascente', element: 'agua', trigger: 'straight',
      desc: 'Numa reta, recupera 12% de estamina.',
      effect: { staminaRestore: 0.12 }
    },
    // --- Grama ---
    'nevoa-amiga': {
      id: 'nevoa-amiga', name: 'Névoa Amiga', element: 'grama', trigger: 'weather:nevoa',
      desc: 'Com névoa: o bônus do clima para a Grama é dobrado.',
      effect: { weatherDouble: true }
    },
    'casco-firme': {
      id: 'casco-firme', name: 'Casco Firme', element: 'grama', trigger: 'hill',
      desc: 'Em cada subida: +2% de rendimento na subida.',
      effect: { hillBonus: 0.02, blockScoped: true }
    },
    'raizes-firmes': {
      id: 'raizes-firmes', name: 'Raízes Firmes', short: 'RAÍZES FIRM.', element: 'grama', exclusive: 'ipe', trigger: 'straight',
      desc: 'Numa reta, finca os cascos: recupera 5% de estamina e +2% de velocidade por 8s.',
      effect: { staminaRestore: 0.05, speedMult: 1.02, durationS: 8 }
    }
  };

  // ---------------------------------------------------------------------------
  // Montarias (espécie 'cavalo')
  //   base = status no level 1 (antes de crescimento, elemento e equipamento).
  //   potential 0–31 por status (oculto no jogo).
  //   sex: 'm' | 'f'.
  //   extra (opcional): title, bio, habitat, lore, grau (1–3, qualidade do cruzamento),
  //   breedLeftMax (cruzas restantes ao nascer; padrão BREED_LEFT[sex]).
  // ---------------------------------------------------------------------------
  function mount(id, name, element, rarity, sex, level, base, potential, skills, palette, extra) {
    var h = {
      id: id, name: name, especie: 'cavalo', element: element, rarity: rarity, sex: sex,
      level: level, xp: 0, base: base, potential: potential, skills: skills, palette: palette
    };
    if (extra) for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) h[k] = extra[k];
    return h;
  }

  var STARTERS = [
    mount('brasa', 'Brasa', 'fogo', 'raro', 'm', 1,
      { vel: 64, acel: 62, man: 60, forca: 52, est: 58, garra: 62, sorte: 50 },
      { vel: 22, acel: 24, man: 18, forca: 14, est: 12, garra: 18, sorte: 14 },
      ['labareda'],
      { coat: '#c4471d', coatShade: '#7f2a0e', mane: '#ffb02e', accent: '#ffe066' },
      { title: 'A fagulha veloz', bio: 'Potro alazão de crina dourada. Larga como um rojão.', grau: 2 }),
    mount('mare', 'Maré', 'agua', 'raro', 'f', 1,
      { vel: 66, acel: 58, man: 54, forca: 56, est: 66, garra: 58, sorte: 46 },
      { vel: 16, acel: 12, man: 12, forca: 18, est: 24, garra: 20, sorte: 18 },
      ['mare-alta'],
      { coat: '#9ba7b4', coatShade: '#646f7e', mane: '#5fd8ee', accent: '#e6f4fb' },
      { title: 'O fôlego do oceano', bio: 'Égua tordilha de crina cor do mar. Quanto mais longa a pista, mais perigosa.', grau: 2 }),
    mount('ipe', 'Ipê', 'grama', 'raro', 'm', 1,
      { vel: 62, acel: 54, man: 50, forca: 64, est: 64, garra: 52, sorte: 54 },
      { vel: 16, acel: 14, man: 12, forca: 24, est: 18, garra: 18, sorte: 14 },
      ['raizes-firmes'],
      { coat: '#7a4a2a', coatShade: '#4c2b18', mane: '#f5c518', accent: '#f2e6c8' },
      { title: 'A raiz que não verga', bio: 'Castanho robusto de crina amarela como ipê florido. Não teme subida.', grau: 2 })
  ];

  var WILD_HORSES = [
    mount('w-pangare', 'Pangaré', 'neutro', 'comum', 'm', 1,
      { vel: 44, acel: 42, man: 39, forca: 48, est: 46, garra: 40, sorte: 40 },
      { vel: 10, acel: 12, man: 11, forca: 15, est: 14, garra: 9, sorte: 10 },
      [],
      { coat: '#8d6e52', coatShade: '#5c4532', mane: '#3b2a1e', accent: '#c9b28f' },
      { habitat: 'Pasto da fazenda', grau: 1 }),
    mount('w-faisca', 'Faísca', 'fogo', 'comum', 'f', 3,
      { vel: 48, acel: 50, man: 45, forca: 42, est: 38, garra: 46, sorte: 40 },
      { vel: 14, acel: 16, man: 15, forca: 10, est: 8, garra: 12, sorte: 10 },
      ['arranque'],
      { coat: '#d9772b', coatShade: '#9a4d16', mane: '#f7d08a', accent: '#ff8a3d' },
      { habitat: 'Cerrado seco', grau: 2 }),
    mount('w-lambari', 'Lambari', 'agua', 'comum', 'm', 2,
      { vel: 42, acel: 44, man: 39, forca: 42, est: 52, garra: 44, sorte: 40 },
      { vel: 9, acel: 11, man: 10, forca: 12, est: 17, garra: 13, sorte: 10 },
      [],
      { coat: '#7fa6c4', coatShade: '#4f7594', mane: '#e8f4fb', accent: '#5ec2d9' },
      { habitat: 'Beira de rio', grau: 1 }),
    mount('w-capim', 'Capim', 'grama', 'comum', 'f', 4,
      { vel: 42, acel: 42, man: 38, forca: 52, est: 46, garra: 42, sorte: 40 },
      { vel: 10, acel: 10, man: 10, forca: 18, est: 13, garra: 12, sorte: 10 },
      ['segundo-ar'],
      { coat: '#9a8a4a', coatShade: '#6a5e2e', mane: '#5b7d2a', accent: '#b9d46a' },
      { habitat: 'Campos gerais', grau: 2 }),
    mount('w-ticao', 'Tição', 'fogo', 'magico', 'm', 8,
      { vel: 54, acel: 56, man: 51, forca: 46, est: 42, garra: 52, sorte: 45 },
      { vel: 17, acel: 19, man: 18, forca: 12, est: 10, garra: 15, sorte: 12 },
      ['chama-final'],
      { coat: '#3a2a26', coatShade: '#1e1513', mane: '#ff5a1f', accent: '#ffb347' },
      { habitat: 'Carvoaria abandonada', grau: 2 }),
    mount('w-garoa', 'Garoa', 'agua', 'magico', 'f', 10,
      { vel: 48, acel: 46, man: 43, forca: 48, est: 58, garra: 50, sorte: 45 },
      { vel: 13, acel: 12, man: 13, forca: 14, est: 20, garra: 15, sorte: 12 },
      ['pe-na-chuva', 'segundo-ar'],
      { coat: '#a9b8c6', coatShade: '#73879a', mane: '#f2f6fa', accent: '#6fb7e8' },
      { habitat: 'Serra enevoada', grau: 2 }),
    mount('w-mandacaru', 'Mandacaru', 'grama', 'magico', 'm', 7,
      { vel: 46, acel: 48, man: 43, forca: 58, est: 52, garra: 46, sorte: 45 },
      { vel: 12, acel: 13, man: 13, forca: 21, est: 16, garra: 13, sorte: 12 },
      ['casco-firme'],
      { coat: '#b48a5a', coatShade: '#7d5c38', mane: '#3f6b2a', accent: '#e85d9a' },
      { habitat: 'Caatinga', grau: 2 }),
    mount('w-ventania', 'Ventania', 'neutro', 'raro', 'f', 15,
      { vel: 62, acel: 58, man: 56, forca: 52, est: 56, garra: 57, sorte: 50 },
      { vel: 21, acel: 18, man: 20, forca: 13, est: 15, garra: 17, sorte: 14 },
      ['sprint', 'arrancada-final'],
      { coat: '#e9e4da', coatShade: '#b6aea0', mane: '#7a7a7a', accent: '#9ad0ff' },
      { habitat: 'Pampa gaúcho', grau: 3 }),
    mount('w-pororoca', 'Pororoca', 'agua', 'raro', 'm', 18,
      { vel: 55, acel: 53, man: 50, forca: 57, est: 64, garra: 56, sorte: 50 },
      { vel: 15, acel: 14, man: 15, forca: 17, est: 24, garra: 16, sorte: 14 },
      ['nascente', 'pe-na-chuva'],
      { coat: '#2e5f73', coatShade: '#1a3b49', mane: '#9ee7e0', accent: '#2fd6c5' },
      { habitat: 'Foz do Amazonas', grau: 2 }),
    mount('w-fogareu', 'Fogaréu', 'fogo', 'lendario', 'f', 22,
      { vel: 66, acel: 68, man: 63, forca: 54, est: 52, garra: 60, sorte: 55 },
      { vel: 24, acel: 26, man: 25, forca: 16, est: 15, garra: 20, sorte: 16 },
      ['sol-a-pino', 'chama-final', 'arranque'],
      { coat: '#b3201a', coatShade: '#6e110d', mane: '#ffd23f', accent: '#ff7b00' },
      { habitat: 'Chapada em chamas', grau: 3 }),
    mount('w-jequitiba', 'Jequitibá', 'grama', 'lendario', 'm', 25,
      { vel: 56, acel: 54, man: 51, forca: 70, est: 62, garra: 58, sorte: 55 },
      { vel: 17, acel: 16, man: 17, forca: 27, est: 21, garra: 19, sorte: 16 },
      ['casco-firme', 'folego-de-montanha', 'segundo-ar'],
      { coat: '#5a4127', coatShade: '#36261a', mane: '#2f7d32', accent: '#8bc34a' },
      { habitat: 'Mata Atlântica', grau: 3 }),
    mount('w-boitata', 'Boitatá', 'fogo', 'mitico', 'f', 30,
      { vel: 70, acel: 72, man: 67, forca: 58, est: 56, garra: 64, sorte: 60 },
      { vel: 28, acel: 29, man: 29, forca: 21, est: 20, garra: 26, sorte: 18 },
      ['sol-a-pino', 'chama-final', 'drift'],
      { coat: '#2a1a3a', coatShade: '#140b1e', mane: '#3cf0ff', accent: '#ff4fd8' },
      { habitat: 'Só aparece em noites de queimada', lore: 'A cobra de fogo do folclore, em forma de cavalo.', grau: 3 }),
    mount('w-iara', 'Iara', 'agua', 'mitico', 'm', 28,
      { vel: 64, acel: 60, man: 58, forca: 58, est: 72, garra: 66, sorte: 60 },
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
  var LEAGUES = [
    { id: 'bronze',   name: 'Bronze',   min: 0,    color: '#b0703c' },
    { id: 'prata',    name: 'Prata',    min: 660,  color: '#b8c2cc' },
    { id: 'ouro',     name: 'Ouro',     min: 780,  color: '#f2c230' },
    { id: 'platina',  name: 'Platina',  min: 880,  color: '#5fd3c8' },
    { id: 'diamante', name: 'Diamante', min: 980,  color: '#7ab8ff' },
    { id: 'lenda',    name: 'Lenda',    min: 1100, color: '#ff7a3d' }
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
      main: { comum: 2, magico: 3, raro: 4, lendario: 6 },
      sub: { comum: 0, magico: 2, raro: 3, lendario: 4 },
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
