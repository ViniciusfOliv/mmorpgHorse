// prototype/tools/arte-desafio-render.mjs — renderiza o cavalo 3D do Meshy (raw/desafio-bakeoff/meshy-brasa.glb) nas
// vistas da cena de desafio, já no tamanho final em pixels de arte (nada de reduzir imagem grande): o three.js roda no
// Chromium de teste (Playwright), com câmera ortográfica, luz única de cima e da esquerda e sem suavização; depois a
// imagem passa pela quantização na Resurrect 64, alfa binário e contorno de 1 px na cor mais escura (guia §5).
// Saída: prototype/assets/arte/desafio/bakeoff/meshy-<vista>.png e uma folha com as 8 direções (meshy-8dir.png).
// O three.js vem do jsDelivr só nesta ferramenta (o jogo não muda e o protótipo continua sem dependências).
// Uso: node prototype/tools/arte-desafio-render.mjs [altura em px de arte, padrão 54] [--glb <nome>, padrão brasa]
//   --glb ipe lê raw/desafio-bakeoff/meshy-ipe.glb e grava meshy-ipe-dir0..7.png e meshy-ipe-8dir.png
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { RAIZ } from './pixellab-comum.mjs';
import { decodePng, encodePng } from './png.mjs';
import { RESURRECT64, quantizar } from './arte-paleta.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const RAW = path.join(RAIZ, 'prototype', 'assets', 'arte', 'raw', 'desafio-bakeoff'), OUT = path.join(RAIZ, 'prototype', 'assets', 'arte', 'desafio', 'bakeoff');
const ALT = Number(process.argv[2]) || 54, LADO = 72;
const iG = process.argv.indexOf('--glb'), NOME = iG > 0 ? process.argv[iG + 1] : 'brasa', PRE = NOME === 'brasa' ? 'meshy' : 'meshy-' + NOME;
const glb = fs.readFileSync(path.join(RAW, `meshy-${NOME}.glb`)).toString('base64');
const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:transparent">
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script>
<script type="module">
import * as THREE from 'three'; import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
window.render = async (b64, lado, alt, angulos, elev) => {
  const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
  const gltf = await new Promise((ok, err) => new GLTFLoader().parse(bin, '', ok, err));
  const obj = gltf.scene, box = new THREE.Box3().setFromObject(obj), tam = box.getSize(new THREE.Vector3()), cen = box.getCenter(new THREE.Vector3());
  obj.position.sub(cen);
  const cena = new THREE.Scene(); cena.add(obj);
  cena.add(new THREE.AmbientLight(0xffffff, 1.15));
  const sol = new THREE.DirectionalLight(0xffffff, 1.9); cena.add(sol);
  const r = new THREE.WebGLRenderer({ antialias: false, alpha: true, preserveDrawingBuffer: true }); r.setPixelRatio(1); r.setSize(lado, lado);
  r.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(r.domElement);
  const meia = tam.y / 2 * (lado / alt) * 1.0;
  const cam = new THREE.OrthographicCamera(-meia, meia, meia, -meia, 0.01, 100);
  const saidas = [];
  for (const a of angulos) {
    const dist = 10, el = elev * Math.PI / 180;
    cam.position.set(Math.sin(a) * Math.cos(el) * dist, Math.sin(el) * dist, Math.cos(a) * Math.cos(el) * dist); cam.lookAt(0, 0, 0);
    // a luz vem de cima e da esquerda DA CÂMERA (guia §4), em qualquer vista
    const dir = new THREE.Vector3(-1, 1.2, 0.6).applyQuaternion(cam.quaternion); sol.position.copy(dir.multiplyScalar(10));
    r.render(cena, cam); saidas.push(r.domElement.toDataURL('image/png'));
  }
  return saidas;
};
window.pronto = true;
</script>`;
const b = await chromium.launch();
const p = await b.newPage();
p.on('pageerror', e => console.log('ERR', e.message));
await p.setContent(html); await p.waitForFunction(() => window.pronto, null, { timeout: 60000 });
const ang = Array.from({ length: 8 }, (_, i) => i * Math.PI / 4);
const imgs = await p.evaluate(([g, l, a, an]) => window.render(g, l, a, an, 14), [glb, LADO, ALT, ang]);
await b.close();
// pós-processo: alfa binário, Resurrect 64, contorno de 1 px 2e222f por fora (guia §5)
function pos(buf) {
  const im = decodePng(buf);
  for (let i = 0; i < im.width * im.height; i++) im.rgba[i * 4 + 3] = im.rgba[i * 4 + 3] >= 128 ? 255 : 0;
  const q = quantizar(im, RESURRECT64), o = { width: q.width, height: q.height, rgba: Uint8Array.from(q.rgba) };
  const op = (x, y) => x >= 0 && y >= 0 && x < q.width && y < q.height && q.rgba[(y * q.width + x) * 4 + 3] > 0;
  for (let y = 0; y < q.height; y++) for (let x = 0; x < q.width; x++) if (!op(x, y) && (op(x - 1, y) || op(x + 1, y) || op(x, y - 1) || op(x, y + 1))) {
    const d = (y * q.width + x) * 4; o.rgba[d] = 0x2e; o.rgba[d + 1] = 0x22; o.rgba[d + 2] = 0x2f; o.rgba[d + 3] = 255;
  }
  return o;
}
const finais = imgs.map(u => pos(Buffer.from(u.split(',')[1], 'base64')));
finais.forEach((f, i) => fs.writeFileSync(path.join(OUT, `${PRE}-dir${i}.png`), encodePng(f)));
const folha = { width: LADO * 8, height: LADO, rgba: new Uint8Array(LADO * 8 * LADO * 4) };
finais.forEach((f, i) => { for (let y = 0; y < LADO; y++) for (let x = 0; x < LADO; x++) for (let c = 0; c < 4; c++) folha.rgba[(y * folha.width + i * LADO + x) * 4 + c] = f.rgba[(y * LADO + x) * 4 + c]; });
fs.writeFileSync(path.join(OUT, `${PRE}-8dir.png`), encodePng(folha));
console.log(`${PRE}: 8 vistas de ${LADO}×${LADO} (cavalo com ~${ALT} px de altura) em prototype/assets/arte/desafio/bakeoff/`);
