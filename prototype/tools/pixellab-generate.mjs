// Gera os 3 cavalos iniciais pela API da PixelLab (v2) e uma animação de galope de cada.
// Uso:  PIXELLAB_API_KEY=... node prototype/tools/pixellab-generate.mjs [--only brasa] [--no-anim]
// Saída: prototype/assets/pixellab/<id>.png, <id>-gallop-NN.png e <id>-*.json (respostas cruas).
// Custo: cada chamada informa "usage" (USD). O script mostra o saldo antes e depois.
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const API = 'https://api.pixellab.ai/v2'
const KEY = process.env.PIXELLAB_API_KEY
if (!KEY) { console.error('PIXELLAB_API_KEY não definido.'); process.exit(1) }
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'pixellab')
const args = process.argv.slice(2)
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null
const noAnim = args.includes('--no-anim')

const STYLE = 'side view, facing right, pixel art game sprite, clean dark outline, full body, racing pose'
const HORSES = [
  { id: 'brasa', seed: 101, description: `chestnut racing horse with a small jockey in red silks, mane and tail made of flickering orange and yellow flames, ember accents, ${STYLE}` },
  { id: 'mare', seed: 202, description: `grey-blue racing horse with a small jockey in blue silks, flowing aqua mane and tail shaped like water waves, droplet highlights, ${STYLE}` },
  { id: 'ipe', seed: 303, description: `dark bay racing horse with a small jockey in green silks, leafy green mane and tail with small leaves and pink ipe flowers, ${STYLE}` },
]

async function call(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json; try { json = JSON.parse(text) } catch { json = { raw: text } }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 400)}`)
  return json
}

// Coleta recursivamente todos os objetos {base64: "..."} de uma resposta.
function collectImages(node, acc = []) {
  if (!node || typeof node !== 'object') return acc
  if (typeof node.base64 === 'string' && node.base64.length > 100) acc.push(node.base64)
  for (const v of Object.values(node)) collectImages(v, acc)
  return acc
}

async function pollJob(id) {
  for (let i = 0; i < 120; i++) {
    const job = await call('GET', `/background-jobs/${id}`)
    if (job.status === 'completed') return job
    if (job.status === 'failed') throw new Error(`job ${id} falhou: ${JSON.stringify(job.last_response).slice(0, 300)}`)
    await new Promise(r => setTimeout(r, 3000))
  }
  throw new Error(`job ${id}: tempo esgotado`)
}

const savePng = (name, b64) => writeFile(join(OUT, name), Buffer.from(b64.replace(/^data:image\/\w+;base64,/, ''), 'base64'))

await mkdir(OUT, { recursive: true })
console.log('Saldo antes:', JSON.stringify(await call('GET', '/balance')))
let spent = 0

for (const h of HORSES.filter(h => !only || h.id === only)) {
  console.log(`\n[${h.id}] gerando sprite base...`)
  const img = await call('POST', '/create-image-pixflux', {
    description: h.description,
    image_size: { width: 64, height: 64 },
    view: 'side', direction: 'east',
    outline: 'single color black outline', shading: 'medium shading', detail: 'medium detail',
    no_background: true, seed: h.seed,
  })
  spent += img.usage?.usd ?? 0
  await writeFile(join(OUT, `${h.id}-image.json`), JSON.stringify({ ...img, image: { ...img.image, base64: '<omitido>' } }, null, 2))
  await savePng(`${h.id}.png`, img.image.base64)
  console.log(`[${h.id}] salvo ${h.id}.png (usd ${img.usage?.usd ?? '?'})`)

  if (noAnim) continue
  console.log(`[${h.id}] animando galope...`)
  const anim = await call('POST', '/animate-with-text-v3', {
    first_frame: { type: 'base64', base64: img.image.base64 },
    action: 'galloping at full racing speed, legs extending and gathering, mane and tail flowing back',
    frame_count: 8, seed: h.seed, no_background: true,
  })
  spent += anim.usage?.usd ?? 0
  const job = anim.background_job_id ? await pollJob(anim.background_job_id) : anim
  spent += job.usage?.usd ?? 0
  const frames = collectImages(job.last_response ?? job)
  await writeFile(join(OUT, `${h.id}-gallop.json`), JSON.stringify(job, (k, v) => (k === 'base64' ? '<omitido>' : v), 2))
  for (let i = 0; i < frames.length; i++) await savePng(`${h.id}-gallop-${String(i).padStart(2, '0')}.png`, frames[i])
  console.log(`[${h.id}] ${frames.length} quadros de galope salvos`)
}

console.log(`\nGasto informado: US$ ${spent.toFixed(3)}`)
console.log('Saldo depois:', JSON.stringify(await call('GET', '/balance')))
