// prototype/tools/mapa-amostra-build.mjs — monta prototype/arte/mapa-amostra.html, a amostra do mapa dos ginásios
// (frente 2 das melhorias visuais, entrega 1, 2026-11-24): o molde prototype/arte/mapa.html com o motor
// prototype/arte/mapa.js e, em data: URI, o que ele usa — os mapas das trilhas (256×384), os corpos dos 15 oponentes, os
// ícones (elementos, insígnias, estrela), os moldes dos cavalos e os módulos de desenho do jogo (data.js, marcas.js,
// sprites.js, só leitura), a Nunito da interface e as capturas de hoje (final-24 e final-25) para o "hoje × proposta".
// Não lê nem escreve nada em prototype/dist/; de prototype/src/ só lê. Não gasta crédito.
// Uso: node prototype/tools/mapa-amostra-build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ } from './pixellab-comum.mjs';
import { lerMoldes, lerIcones, lerTreinadores, lerTelas, jsonJs } from './arte-embutida.mjs';

const PROTO = path.join(RAIZ, 'prototype');
const uri = (f, tipo = 'image/png') => `data:${tipo};base64,${fs.readFileSync(f).toString('base64')}`;

const icones = await lerIcones(PROTO);
const ICONES = {};
for (const k of ['el-fogo', 'el-agua', 'el-grama', 'ins-fogo', 'ins-agua', 'ins-grama', 'ui-estrela', 'ui-estrela-vazia']) ICONES[k] = icones[k];
const telas = await lerTelas(PROTO);
// os mapas das trilhas sem o pontilhado da interface (o lerTelas só mexe nas cenas): o PNG final, 256×384
const MAPAS = {};
for (const g of ['fogo', 'agua', 'grama']) MAPAS[g] = uri(path.join(PROTO, 'assets', 'arte', 'telas', 'finais', `mapa-${g}.png`));
const avisos = [];
const dados = {
  mapas: MAPAS,
  treinadores: Object.fromEntries(Object.entries(await lerTreinadores(PROTO)).map(([k, v]) => [k, v.corpo])),
  icones: ICONES,
  piloto: (() => {
    const D = path.join(PROTO, 'assets', 'arte', 'mapa-mundo');
    const usados = { 'terreno-s9902': 'terreno/terreno-s9902', 'terreno-s9901': 'terreno/terreno-s9901', 'ginasio-fogo': 'ginasios/ginasio-fogo-s9921',
      'ginasio-agua': 'ginasios/ginasio-agua-s9932', 'ginasio-grama': 'ginasios/ginasio-grama-s9953-00', 'montado': 'montado' };
    const todos = [];
    for (const l of ['terreno', 'base', 'ginasios', 'pecas']) if (fs.existsSync(path.join(D, l))) for (const f of fs.readdirSync(path.join(D, l)).filter(f => f.endsWith('.png')).sort()) todos.push({ nome: f.replace('.png', ''), uri: uri(path.join(D, l, f)) });
    return { usados: Object.fromEntries(Object.entries(usados).map(([k, v]) => [k, uri(path.join(D, v + '.png'))])),
      escolhidos: ['terreno-s9901', 'ginasio-fogo-s9921', 'ginasio-agua-s9932', 'ginasio-grama-s9953-00'], todos };
  })(),
  desafio: (() => {
    const P = path.join(PROTO, 'assets', 'arte', 'desafio', 'piloto');
    return { arena: uri(path.join(PROTO, 'assets', 'arte', 'ginasios', 'finais', 'fogo.png')), arena0: uri(path.join(PROTO, 'assets', 'arte', 'ginasios', 'fogo', 'arena-0.png')),
      costas: Array.from({ length: 16 }, (_, i) => uri(path.join(P, `brasa-costas-estilo-${String(i).padStart(2, '0')}.png`))),
      oito: Array.from({ length: 8 }, (_, i) => uri(path.join(P, `brasa-8dir-64-${String(i).padStart(2, '0')}.png`))),
      oito96: Array.from({ length: 8 }, (_, i) => uri(path.join(P, `brasa-8dir-96-${String(i).padStart(2, '0')}.png`))),
      hoje: uri(path.join(PROTO, 'screens', 'final-26b-cena-desafio.png')) };
  })(),
  hoje: {
    mundo: uri(path.join(PROTO, 'screens', 'final-24-expedicao-ginasios.png')),
    trilha: uri(path.join(PROTO, 'screens', 'final-25-trilha.png'))
  }
};
void telas;

let html = fs.readFileSync(path.join(PROTO, 'arte', 'mapa.html'), 'utf8');
const troca = (marca, valor) => { if (!html.includes(marca)) throw new Error('falta ' + marca); html = html.split(marca).join(valor); };
const js = (f) => fs.readFileSync(path.join(PROTO, f), 'utf8').replace(/<\/script/gi, '<\\/script');
troca('/*__N600__*/', uri(path.join(PROTO, 'assets', 'fontes', 'nunito-latin-600-normal.woff2'), 'font/woff2'));
troca('/*__N800__*/', uri(path.join(PROTO, 'assets', 'fontes', 'nunito-latin-800-normal.woff2'), 'font/woff2'));
troca('/*__MOLDES__*/', jsonJs(await lerMoldes(PROTO, avisos)));
troca('/*__GLIFOS__*/', jsonJs(JSON.parse(fs.readFileSync(path.join(PROTO, 'assets', 'fontes', 'galmuri-glifos.json'), 'utf8'))));
troca('/*__DADOS__*/', jsonJs(dados));
troca('/*__JOGO__*/', ['src/data.js', 'src/marcas.js', 'src/sprites.js'].map(js).join('\n'));
troca('/*__JS__*/', js('arte/mapa.js'));
if (avisos.length) console.warn(avisos.join('\n'));
const saida = path.join(PROTO, 'arte', 'mapa-amostra.html');
fs.writeFileSync(saida, html);
console.log(`${path.relative(RAIZ, saida)}: ${(html.length / 1024).toFixed(0)} KB`);
