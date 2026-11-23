// prototype/tools/rd-comum.mjs — chamadas à API da Retro Diffusion (https://api.retrodiffusion.ai), usadas pelos
// scripts de arte (arte-amostra.mjs, arte-regioes.mjs). A chave vem do proxy da sessão (cabeçalho X-RD-Token); fora
// da nuvem, da variável RD_API_KEY. Nunca no código nem na conversa.
//   rdGerar(pedido)        POST /v2/inferences e espera a tarefa; devolve o result ({ base64_images, balance_cost, ... })
//   rdCusto(pedido)        o mesmo pedido com check_cost (grátis): { balance_cost }
//   rdFerramenta(id, ped)  ferramentas de edição (/v1/edit/tools/<id>), com estimativa grátis em rdFerramentaCusto
//   rdSaldo()              GET /v2/inferences/credits
// Só chamam a rede com estado.redeLiberada (o --gerar dos scripts), como o pixellab-comum.mjs.
import crypto from 'node:crypto';
import { estado } from './pixellab-comum.mjs';

const RD = 'https://api.retrodiffusion.ai';
const TOKEN = process.env.RD_API_KEY || 'proxy-injected';
const dormir = ms => new Promise(r => setTimeout(r, ms));

export async function rd(metodo, caminho, corpo, idem) {
  if (!estado.redeLiberada) throw new Error('chamada de rede sem --gerar (bug do script)');
  const headers = { 'X-RD-Token': TOKEN, 'Content-Type': 'application/json' };
  if (idem) headers['Idempotency-Key'] = idem;
  const res = await fetch(RD + caminho, { method: metodo, headers, body: corpo ? JSON.stringify(corpo) : undefined });
  const texto = await res.text();
  if (!res.ok) throw new Error(`RD ${metodo} ${caminho} → HTTP ${res.status}: ${texto.slice(0, 500)}`);
  return JSON.parse(texto);
}

export async function rdGerar(pedido) {
  const r = await rd('POST', '/v2/inferences', pedido, crypto.randomUUID());
  const fim = Date.now() + 10 * 60 * 1000;
  while (Date.now() < fim) {
    await dormir(3000);
    const t = await rd('GET', `/v2/inferences/tasks/${r.task_id}`);
    if (t.status === 'pending' || t.status === 'running') continue;
    if (t.status !== 'succeeded') throw new Error(`RD tarefa ${r.task_id} ${t.status}: ${JSON.stringify(t.error)}`);
    return t.result;
  }
  throw new Error(`RD tarefa ${r.task_id}: tempo esgotado`);
}

export async function rdCusto(pedido) { return rd('POST', '/v2/inferences', { ...pedido, check_cost: true }); }
export async function rdFerramentaCusto(id, pedido) { return rd('POST', `/v1/edit/tools/${id}/estimate`, pedido); }

// Ferramenta de edição; a imagem vem em base64_images ou só em output_urls (o README avisa)
export async function rdFerramenta(id, pedido) {
  const r = await rd('POST', `/v1/edit/tools/${id}`, pedido);
  let b = r.base64_images && r.base64_images[0] ? Buffer.from(r.base64_images[0], 'base64') : null;
  if (!b) b = Buffer.from(await (await fetch(r.output_urls[0])).arrayBuffer());
  return { resposta: r, png: b };
}

export async function rdSaldo() { return (await rd('GET', '/v2/inferences/credits')).balance; }
