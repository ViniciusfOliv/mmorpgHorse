// prototype/tools/pixellab-portes.mjs — o lote `portes` do pixellab-moldes.mjs (spec 2026-11-13-cavalos-portes §4–§5):
// os 12 moldes novos, 3 portes (esguio, padrao, robusto) × 4 estilos (lisa = o corpo-mestre, sem elemento; chamas,
// ondas e folhas = as versões de Fogo, Água e Grama, que partem do mestre).
//
// Uso (pelo pixellab-moldes.mjs): --lote portes --fase mestres|piloto|versoes [--only <porte>[-<estilo>]] [--teto 90]
//   [--repetir <chave>/<etapa>[,…]] [--sem-guia <porte>-<estilo>]… [--guia-galope-mestre <porte>-<estilo>]…
//   [--refazer <porte>-<estilo>:<etapa>[,<etapa>…]]… [--nova-refacao] [--guia-mestre <porte>-lisa=<porte>-lisa]…
//   [--reprocessar [--manter-escolhas]] [--gerar]; ou [--escolher <porte>-<estilo>:<etapa>=<seed>]… --motivo "<texto>" (sem custo). Sem
//   --gerar é dry-run (nenhuma chamada, nenhum arquivo).
//   --sem-guia (piloto e versoes; repetível): aquela versão sai sem init_image, pela receita do primeiro lote, nas seeds
//            sem guia (3701+), e passa nos mesmos critérios — a decisão da folha quando a crina mudou pouco partindo do
//            mestre (spec §5.2). Não mexe no registro do piloto; na fase versoes vale também para o chamas.
//   --guia-galope-mestre (piloto e versoes; repetível): a pose de corrida daquela versão sai com init_image = o 1º
//            quadro cru do galope do mestre (init_image_strength FORCA_GUIA_GALOPE = 300, a força da guia de corrida do
//            primeiro lote) e o galope é animado a partir dela — o galope do mestre guiando o de uma versão que falhou
//            (spec §4). Retrato e parado seguem como estavam (reaproveitados de raw/).
//   --refazer (as 3 fases; repetível): refaz aquelas etapas do item (retrato, parado, corrida, galope; refazer a corrida
//            refaz o galope, que parte dela) numa refação, com seeds novas (ver Seeds) e as mesmas regras de sempre (3
//            seeds, parada na 1ª aprovada, teto somado, registro). A tentativa anterior da etapa vai para o `historico`
//            do item e a escolha só olha as novas; as outras etapas seguem como estavam (reaproveitadas de raw/). O
//            número da refação de cada etapa fica no criterios.json (`refacoes`): sem --refazer, a etapa continua nas
//            seeds dela (retomar, --reprocessar). Item que ficou pela metade (alguma etapa sem terminar as seeds: teto,
//            erro fatal) não abre refação nova com o --refazer: a que ficou pela metade é retomada. Só para item que já
//            tem registro, com a mesma receita; não anda com --reprocessar.
//   --nova-refacao (com --refazer): confirma abrir a refação N+1 de uma etapa cuja refação N já terminou. Sem ela, o
//            mesmo --refazer repetido depois de terminado (um comando rodado de novo por engano) não gasta: o --gerar
//            para com erro de uso antes de qualquer chamada e o dry-run avisa em destaque, sem prever nada para o item.
//            O galope que vem junto com a 1ª refação da corrida não pede a confirmação (ele parte da corrida nova).
//   --guia-mestre <guiado>=<guia> (fase mestres; repetível; ex.: robusto-lisa=padrao-lisa; decisão do Vinicius na folha
//            v2, 2026-11-13: o PixelLab enche o quadro com o cavalo, então o texto sozinho não muda a proporção): anda com
//            o --refazer do guiado. Cada imagem parada refeita dele (retrato, parado, corrida) sai com init_image = o cru
//            ESCOLHIDO do mestre-guia no mesmo estado (a seed do molde do guia em novos/, o arquivo pelo criterios.json),
//            o texto do porte guiado (a última versão, TEXTOS_PORTE) e um reforço curto de proporção logo depois dele
//            (REFORCO_PROPORCAO). O RETRATO decide a força: nele, a força do init_image muda a cada tentativa, além da
//            seed (FORCAS_GUIA_MESTRE): 90 na seed base, 60 na base + 100 e 35 na base + 200 (a 4ª do --repetir, base +
//            50, usa a última, 35) — em 2026-11-09 a força 150 já copiou a guia quase igual, então a 1ª ainda segura o
//            desenho do guia e as outras deixam o texto mudar mais o corpo; os "portes distintos" contra o padrão entram
//            no aceite dele (como sempre). O PARADO e a CORRIDA, que não têm critério de proporção (parariam sempre na
//            força 90, a mais parecida com o guia), usam a força do retrato aceito — ou do melhor, se os 3 reprovarem —
//            em todas as tentativas, só variando a seed (base, + 100, + 200): os estados saem com o mesmo corpo. Ela é
//            decidida quando o retrato da rodada termina e gravada (guiaMestre.<etapa>.forcas e forcaDoRetrato); o
//            dry-run, com o retrato ainda por gerar, mostra "a do retrato aceito". Parado ou corrida guiados sem refazer
//            o retrato pedem que o retrato escolhido tenha saído guiado (erro de uso). Continua até 3 chamadas por etapa
//            (pior caso 12 por mestre). Cada etapa para na 1ª que passa nos critérios. O galope parte da corrida aceita,
//            como sempre. A guia de cada etapa fica no criterios.json (`guiaMestre.<etapa>`: guia, seed, arquivo, refação,
//            forças e reforço) e vale enquanto a etapa estiver naquela refação (retomar, --reprocessar). O guia precisa
//            ter molde em novos/ e os crus das etapas refeitas, e não pode ser refeito na mesma rodada (erro de uso). Um
//            --refazer novo de uma etapa que saiu guiada, sem --guia-mestre, sai sem guia: o dry-run e o log avisam em
//            destaque.
//   --escolher <porte>-<estilo>:<etapa>=<seed> (as 3 fases; repetível; --motivo "<texto>" obrigatório): escolha manual
//            de uma tentativa já paga daquela etapa — da refação atual ou de qualquer uma do `historico` —, sem rede e
//            sem custo (só os crus de raw/). A tentativa é reavaliada pelos critérios de hoje e os que ela reprova ficam
//            aceitos na folha (`aceito: true` no critério; no item, `aceitos` em vez de `falhas`, então ele não sai
//            reprovado por eles). A escolha fica gravada (etapas.<etapa>.escolha = { manual: true, seed, data, motivo,
//            refacao, origem, arquivo, aceitos }) e vale nas rodadas seguintes, até um --refazer daquela etapa; o molde
//            em novos/ é regravado com ela, e o `historico` ganha uma linha com a escolha de antes. Escolher a corrida
//            não muda o galope: se o escolhido partiu de outra corrida, o script avisa e o galope fica escolhido também
//            (nada é animado de novo). Seed que não está nas tentativas da etapa (ou sem imagem em raw/) é erro de uso.
//            Não anda com --gerar, --reprocessar, --refazer, --nova-refacao, --repetir, --guia-mestre nem --only.
//   --manter-escolhas (só com --reprocessar): a escolha de cada etapa fica a que está no criterios.json (aprovada ou
//            não), enquanto ela tiver imagem em raw/: a rodada reavalia os critérios e regrava os finais com as mesmas
//            tentativas. Serve para reprocessar depois de mudar a classificação das cores (tarefa 6a, 2026-11-13) sem
//            trocar o desenho que o Vinicius já viu na folha porque outra seed passou a passar. A etapa em que a melhor
//            tentativa de hoje seria outra grava `mantida` ({ seria, seriaOk }) e sai no Resumo; um --reprocessar sem a
//            opção faz a troca (a regra de sempre: a escolha anterior só fica se continuar aprovada ou empatar).
// Código de saída (pixellab-moldes): 1 só quando a rodada não terminou (teto, erro fatal da API, arquivo ilegível) ou
//   deixou item incompleto; item completo que reprova num critério sai 0 (ele vai para a folha, marcado no Resumo). Erro
//   de uso sai 2.
//   Item refeito com outra receita (outra `variante`) guarda a entrada anterior em `historico` no criterios.json.
// Fases (cada item é um molde, com 4 etapas: retrato, parado, corrida e galope):
//   mestres  lisa dos 3 portes, na ordem padrao, esguio, robusto (o padrão é a régua das proporções dos outros dois);
//   piloto   chamas dos 3 portes, com init_image = a imagem crua do mestre no mesmo estado (init_image_strength
//            FORCA_GUIA): mostra se o init_image segura o corpo do mestre;
//   versoes  ondas e folhas dos 3 portes. Porte cujo piloto reprovou no "mesmo corpo" nas 3 seeds sai sem init_image
//            (a receita do primeiro lote), e o chamas dele é refeito junto; o script avisa.
// Receita (§5): retrato, parado e pose de corrida pelo create-image-pixflux (cores de papel pedidas por texto, COR e
// JOQUEI_CORES, e classificadas no script); o galope pelo animate-with-text-v3 a partir da pose de corrida aceita
// (frame_count 8 + o 1º quadro = 9). Ordem dentro da fase: primeiro as imagens paradas de todos os itens (retrato,
// parado, corrida) e depois os galopes.
// Seeds (faixa nova, sem cruzar os moldes de 1101–2001 nem os ícones de 2101–2458): base do item =
//   mestres  3101 + p                  (p = 0 esguio, 1 padrao, 2 robusto: 3101, 3102, 3103)
//   guiadas  3401 + 3 × e + p          (e = 0 chamas, 1 ondas, 2 folhas: 3401…3409; piloto e versões com init_image)
//   sem guia 3701 + 3 × e + p          (3701…3709: versões de um porte cujo piloto reprovou no mesmo corpo)
//   Cada etapa tenta até 3 seeds, base, base + 100 e base + 200, e para na 1ª que passa nos critérios automáticos;
//   --repetir <chave>/<etapa> dá uma 4ª, base + 50. As 4 etapas do item usam as mesmas seeds (endpoints e textos
//   diferentes). Todas caem em 3101–3959.
//   Refação r de uma etapa (--refazer): as mesmas contas + 1000 × r (PASSO_REFACAO). A 1ª: mestres 4101–4103 (+100,
//   +200: até 4303; +50 do --repetir: 4151…), guiadas 4401–4409 (até 4609) e sem guia 4701–4709 (até 4909), tudo em
//   4101–4959; a 2ª em 5101–5959, e assim por diante. Nenhuma refação cruza outra nem os blocos de antes, e o nome do
//   cru leva a seed: um cru antigo nunca é sobrescrito.
// Critérios automáticos (portes-criterios.mjs) de cada tentativa:
//   retrato e parado: forma (o validar() do primeiro lote) + 4 pernas + (versões) mesmo corpo contra o mestre +
//                     (retrato do esguio e do robusto) a proporção contra o retrato do padrão;
//   corrida:          forma + pelo menos 2 pernas (ela vira o quadro 0 do galope, que precisa de 2 em todo quadro);
//   galope:           forma nos quadros + pelo menos 2 pernas em todo quadro + galope estável contra a pose de corrida,
//                     com exatamente 9 quadros (galope com outro número reprova e só fica como "melhor", marcado).
//   Item ainda reprovado depois das 3 seeds fica com a melhor tentativa (menos critérios reprovados; reprovar na forma
//   pesa mais; no empate, a que chegou mais perto dos limites, pela soma das faltas normalizadas — faltaDoLimite —, e
//   depois a 1ª) e sai marcado no criterios.json e na folha; quem decide é o Vinicius.
//   Escolha que continua valendo não muda: quando o critério muda (ex.: a regra do galope de 2026-11-13) e a etapa é
//   reavaliada de raw/, a escolhida da rodada anterior (na mesma refação, numa etapa que terminou as seeds) fica se
//   continuar aprovada, ou, todas reprovadas, se empatar com a melhor no número de reprovações. Trocar a pose de corrida obrigaria a animar outro galope, e trocar o mestre, a
//   refazer as versões. Depois de uma aprovada o script só segue até a escolha anterior pelo que já está em raw/, sem
//   pagar nada.
// Crus: um cru em raw/ é reaproveitado quando o pedido é o mesmo, também com um texto de porte anterior (TEXTOS_PORTE).
//   Um cru que existe com outro pedido nunca é refeito por cima: o --gerar para (o dry-run mostra onde); seeds novas
//   saem com --refazer. Um registro só de erro (sem imagem) pode ser refeito.
// Teto: somado entre rodadas em novos/gasto.json ({ geracoes, chamadas, rodadas: [...] }, gravado a cada chamada
//   paga); a chamada que passaria do teto (padrão 90) não sai. Um gasto.json que existe mas não se lê (JSON quebrado,
//   "geracoes" que não é número finito ≥ 0) para o --gerar antes de qualquer chamada e nunca é sobrescrito; o dry-run
//   avisa em destaque.
// Saídas: os finais em prototype/assets/pixellab/novos/ (molde-<porte>-<estilo>.json e -<estado>.png, no formato que o
//   build lê, mas numa pasta que ele NÃO lê); os crus em raw/ (portes-<chave>-<etapa>[-<marca da guia>]-s<seed>: a
//   marca é g<força>m<seed do mestre> na versão guiada pelo mestre, gm<força>c<corrida>s<galope> na corrida guiada pelo
//   galope do mestre e g<força><porte do guia><seed do guia> no mestre guiado por outro, ex. g60padrao3102);
//   o relatório dos critérios em novos/criterios.json (toda tentativa: seed, prompt, init_image, custo e critérios).
//   O docs/memoria/assets.md fica para depois da aprovação nas folhas (folha-portes.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { decodePng } from './png.mjs';
import { ancoras, deCinza } from './moldes-lib.mjs';
import {
  DIR_MOLDES, DIR_MOLDES_RAW, RAIZ, HOJE, PIXFLUX, ANIMA, LADO, COR, JOQUEI, POSES, CRINAS, ACAO_CORRIDA,
  imagem, pedidoGalope, fmt, bufDe, lerCru, gravarCru, gravarErro, pngsCrus, apagarQuadrosCrus, geracoesDe, recuperavel,
  ErroApi, FaltaCru, TetoAtingido, criarOrcamento, pago, quadrosDoJob, classificarGrupo, quadrosDoMolde, gravarMolde,
} from './pixellab-comum.mjs';
import { LIMITES, pernas, criterioPernas, criterioMesmoCorpo, criterioPortes, criterioGalope } from './portes-criterios.mjs';

export const PORTES = ['esguio', 'padrao', 'robusto'];
export const ELEMENTOS = ['chamas', 'ondas', 'folhas'];
export const FASES = ['mestres', 'piloto', 'versoes'];
export const ETAPAS = ['retrato', 'parado', 'corrida', 'galope'];
export const DIR_NOVOS = path.join(DIR_MOLDES, 'novos');
export const TETO_PADRAO = 90;
export const TENTATIVAS = 3, PASSO_SEED = 100, SEED_EXTRA = 50, PASSO_REFACAO = 1000;
const BLOCO = { mestre: 3101, guiada: 3401, semGuia: 3701 };
// init_image_strength das versões guiadas (1–999; mais alto = mais perto da guia). Em 2026-11-09 a força 150 já
// copiou o penacho da guia de chamas; aqui a crina TEM de mudar e o corpo ficar: o piloto confere o corpo.
export const FORCA_GUIA = 100;
// init_image_strength da corrida guiada pelo 1º quadro do galope do mestre (--guia-galope-mestre): a mesma 300 da guia
// de corrida do primeiro lote (o 1º quadro do galope de chamas guiou ondas, folhas e lisa em 2026-11-09).
export const FORCA_GUIA_GALOPE = 300;
// init_image_strength do mestre guiado por outro mestre (--guia-mestre), por tentativa: a 1ª seed (base) 90, a 2ª
// (+100) 60 e a 3ª (+200) 35; a 4ª do --repetir (+50) usa a última. Em 2026-11-09 a força 150 já copiou a guia quase
// igual: aqui o desenho do guia tem de ficar e a proporção tem de mudar, então a força desce a cada tentativa.
export const FORCAS_GUIA_MESTRE = Object.freeze([90, 60, 35]);
const forcaGuiaMestre = (forcas, k) => forcas[Math.min(k, forcas.length - 1)];

// ---------------------------------------------------------------- textos (spec §4: tabela de aparência, exagerada)
// Cada porte guarda as versões do seu texto; a última sai nos pedidos novos. As anteriores ficam para reconhecer os crus
// que já estão em raw/ (mesmo pedido ⇒ reaproveitado, nunca refeito por cima) e para o assets.md saber qual texto gerou
// qual cru: cada tentativa no criterios.json grava a `versaoTexto` do pedido dela.
export const TEXTOS_PORTE = {
  esguio: [{ versao: 1, texto: 'tall slender lean horse inspired by the Mangalarga breed, very long thin legs, long slim neck held high, small refined head, tail set and carried high, narrow light body, clearly taller and thinner than an average horse' }],
  padrao: [{ versao: 1, texto: 'balanced medium build horse inspired by the Campolina breed, average proportions, slightly convex head profile, medium length neck and legs, well proportioned body' }],
  robusto: [
    // v1 gerou os mestres de 2026-11-13 (seeds 3103, 3203, 3303): na folha, altura/comprimento 1,023 × a do padrão (alvo
    // ≤ 0,92) e espessura/comprimento 0,965 × (alvo ≥ 1,15) — não se distinguia do padrão
    { versao: 1, texto: 'short stocky robust horse inspired by the Crioulo breed, low and wide, deep thick chest, short thick muscular neck, short strong sturdy legs, full thick mane, compact heavy body, clearly shorter and wider than an average horse' },
    // v2 (decisão do Vinicius na folha dos mestres, 2026-11-13): exagera o cavalo de tração em barril, com as pernas mais
    // curtas que a altura do corpo
    { versao: 2, texto: 'very short stocky heavy draft-type horse inspired by the Crioulo breed, massive barrel-shaped body that is very wide and very deep, very short thick sturdy legs that are shorter than the depth of the body, short very thick muscular neck, broad wide chest, low heavy stance close to the ground, large heavy head, full thick mane, clearly much lower, wider and heavier than an average horse' },
  ],
};
const ultimaVersao = porte => TEXTOS_PORTE[porte][TEXTOS_PORTE[porte].length - 1].versao;
const textoPorte = (porte, versao) => (TEXTOS_PORTE[porte].find(v => v.versao === versao) || {}).texto;
// o texto atual (a última versão) de cada porte
export const TEXTO_PORTE = Object.fromEntries(PORTES.map(p => [p, textoPorte(p, ultimaVersao(p))]));
// o critério das pernas (Marcas.zonas) só acha perna que aparece separada: pedir as 4 à mostra nas poses paradas
const PERNAS_SEPARADAS = 'all four legs clearly visible and separated, the far legs offset from the near legs with a gap between every leg, no overlapping legs';
export const POSES_PORTES = {
  retrato: `standing still horse, ${PERNAS_SEPARADAS}, no rider, no saddle`,
  parado: `horse standing still, ${PERNAS_SEPARADAS}, ${JOQUEI}`,
  corrida: POSES.corrida,
};
// reforço do mestre com jóquei (o da lisa no lote de 2026-11-08: sem ele, crina marrom e jóquei borrado)
const REFORCO_MESTRE = 'bright green (#00ff00) long straight mane and tail clearly visible, jockey in yellow silks and yellow helmet';
export const ACAO_PORTES = `${ACAO_CORRIDA}, the same horse with the same body proportions in every frame`;
// reforço de proporção do mestre guiado por outro (--guia-mestre), logo depois do texto do porte: o init_image traz o
// desenho do guia, e o texto diz o que muda nele (decisão do Vinicius na folha v2, 2026-11-13; só esguio e robusto
// têm porte diferente do padrão para pedir)
export const REFORCO_PROPORCAO = Object.freeze({
  robusto: 'same horse redrawn shorter and stockier: much shorter legs, deeper barrel body, thicker neck',
  esguio: 'same horse redrawn taller and slimmer: much longer thinner legs, narrower lighter body, longer slimmer neck',
});

// Pedido do create-image-pixflux de uma etapa parada. Mestre: porte + pose + crina lisa + COR. Versão: a crina do
// elemento no começo e repetida como "clearly visible and distinct" (o reforço da rodada de crinas de 2026-11-09).
// versao = a do texto do porte (TEXTOS_PORTE); sem ela, a última. proporcao = o reforço do mestre guiado por outro
// (--guia-mestre), logo depois do texto do porte; sem ele, o pedido de sempre.
export function pedidoPorte(item, etapa, seed, guiaBuf, forca = FORCA_GUIA, versao = ultimaVersao(item.porte), proporcao = null) {
  const crina = CRINAS[item.estilo], pose = POSES_PORTES[etapa], porte = textoPorte(item.porte, versao) + (proporcao ? `, ${proporcao}` : '');
  const reforco = item.mestre && etapa !== 'retrato' ? `, ${REFORCO_MESTRE}` : '';
  const corpo = {
    description: item.mestre
      ? `side view, facing right, ${porte}, ${pose}, ${crina}${reforco}, ${COR}`
      : `side view, facing right, ${crina}, ${porte}, ${pose}, ${crina} clearly visible and distinct, ${COR}`,
    image_size: { width: LADO, height: LADO },
    view: 'side', direction: 'east',
    outline: 'single color black outline', shading: 'basic shading', detail: 'medium detail',
    no_background: true, seed,
  };
  if (guiaBuf) { corpo.init_image = imagem(guiaBuf); corpo.init_image_strength = forca; }
  return corpo;
}

// ---------------------------------------------------------------- itens e seeds
function novoItem(fase, porte, estilo, guia, guiaGalope = false) {
  const p = PORTES.indexOf(porte), e = ELEMENTOS.indexOf(estilo), mestre = estilo === 'lisa';
  guia = !mestre && guia; guiaGalope = !mestre && guiaGalope;
  return {
    chave: `${porte}-${estilo}`, fase, porte, estilo, mestre, guia, guiaGalope,
    seedBase: mestre ? BLOCO.mestre + p : (guia ? BLOCO.guiada : BLOCO.semGuia) + 3 * e + p,
    chaveMestre: mestre ? null : `${porte}-lisa`,
    // a receita do item; mudou de uma rodada para outra ⇒ a entrada anterior vai para o `historico` do criterios.json
    variante: mestre ? 'mestre' : (guia ? 'init_image do mestre' : 'sem init_image') + (guiaGalope ? ' + corrida guiada pelo galope do mestre' : ''),
  };
}
// piloto = criterios.json.piloto ({ <porte>: { mesmoCorpo } }), para saber quais versões saem sem init_image;
// semGuia / guiaGalope = as chaves de --sem-guia / --guia-galope-mestre (na fase versoes, --sem-guia num chamas o inclui)
export function itensDaFase(fase, { only = null, piloto = {}, semGuia = [], guiaGalope = [] } = {}) {
  let pares;
  if (fase === 'mestres') pares = ['padrao', 'esguio', 'robusto'].map(p => [p, 'lisa']);
  else if (fase === 'piloto') pares = PORTES.map(p => [p, 'chamas']);
  else {
    pares = PORTES.flatMap(p => {
      const pilotoRuim = !!(piloto[p] && piloto[p].mesmoCorpo === false);
      return ELEMENTOS.filter(e => e !== 'chamas' || pilotoRuim || semGuia.includes(`${p}-${e}`)).map(e => [p, e]);
    });
  }
  const itens = pares.map(([p, e]) => {
    const pilotoRuim = fase === 'versoes' && !!(piloto[p] && piloto[p].mesmoCorpo === false);
    return novoItem(fase, p, e, !pilotoRuim && !semGuia.includes(`${p}-${e}`), guiaGalope.includes(`${p}-${e}`));
  });
  return only ? itens.filter(it => it.porte === only || it.chave === only) : itens;
}
// as seeds de uma etapa na refação dela (item.refacoes[etapa]: 0 = as de sempre; r ≥ 1 = a r-ésima do --refazer)
export function seedsDoItem(item, etapa, repetir = []) {
  const base = item.seedBase + PASSO_REFACAO * ((item.refacoes && item.refacoes[etapa]) || 0);
  const s = Array.from({ length: TENTATIVAS }, (_, k) => base + PASSO_SEED * k);
  if (repetir.includes(`${item.chave}/${etapa}`)) s.push(base + SEED_EXTRA);
  return s;
}
// item que ficou pela metade: alguma etapa sem terminar as seeds (teto, erro fatal) ou que nem começou
const pelaMetade = ant => ETAPAS.some(e => !(ant.etapas && ant.etapas[e] && ant.etapas[e].terminada));
// as etapas pedidas cuja última refação já terminou (abrir a próxima pede --nova-refacao), com o número dela; o galope
// que vem junto com a 1ª refação da corrida não conta (ele parte da corrida nova)
function refacoesTerminadas(ant, etapas) {
  const r = e => (ant.refacoes && ant.refacoes[e]) || 0;
  return etapas.filter(e => r(e) > 0 && !(e === 'galope' && etapas.includes('corrida') && r('corrida') === 0)).map(e => ({ etapa: e, refacao: r(e) }));
}
const lista = xs => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}` : xs[0]);
const msgRefacaoTerminada = (chave, ts) => `--refazer ${chave}: ${lista(ts.map(t => `a refação ${t.refacao} de ${t.etapa}`))} já ${ts.length > 1 ? 'terminaram' : 'terminou'}`
  + ` (um --refazer repetido). Para abrir a próxima (${ts.map(t => `${t.etapa} ${t.refacao + 1}`).join(', ')}), que gasta de novo até ${TENTATIVAS} gerações por etapa, repita com --nova-refacao, com a confirmação do Vinicius.`;
// --refazer <porte>-<estilo>:<etapa>[,<etapa>…] (repetível) ⇒ { pedidos: { <chave>: [etapas] }, erro }. Refazer a
// corrida refaz também o galope (ele parte dela). Só confere a forma; o item é conferido contra a fase em
// validarArgsPortes.
export function lerRefazer(lista = []) {
  const pedidos = {};
  for (const r of lista) {
    const [chave, etapas, resto] = String(r).split(':');
    const es = String(etapas || '').split(',').filter(Boolean);
    if (!chave || resto != null || !es.length || es.some(e => !ETAPAS.includes(e))) {
      return { pedidos: {}, erro: `--refazer ${r}: use <porte>-<estilo>:<etapa>[,<etapa>…], com as etapas ${ETAPAS.join(', ')} (ex.: padrao-lisa:corrida)` };
    }
    const s = new Set([...(pedidos[chave] || []), ...es]);
    if (s.has('corrida')) s.add('galope');
    pedidos[chave] = ETAPAS.filter(e => s.has(e));
  }
  return { pedidos, erro: null };
}
// --escolher <porte>-<estilo>:<etapa>=<seed> (repetível) ⇒ { escolhas: [{ chave, etapa, seed }], erro }. Só confere a
// forma; o item, a seed e o cru são conferidos em validarArgsPortes (e de novo no rodarPortes).
export function lerEscolhas(lista = []) {
  const escolhas = [];
  for (const x of lista) {
    const m = /^([a-z]+-[a-z]+):([a-z]+)=(\d+)$/.exec(String(x));
    if (!m || !ETAPAS.includes(m[2])) return { escolhas: [], erro: `--escolher ${x}: use <porte>-<estilo>:<etapa>=<seed>, com as etapas ${ETAPAS.join(', ')} (ex.: esguio-lisa:parado=3101)` };
    if (escolhas.some(e => e.chave === m[1] && e.etapa === m[2])) return { escolhas: [], erro: `--escolher ${m[1]}:${m[2]}: repetido (uma seed por etapa)` };
    escolhas.push({ chave: m[1], etapa: m[2], seed: Number(m[3]) });
  }
  return { escolhas, erro: null };
}
// --guia-mestre <porte>-lisa=<porte>-lisa (repetível) ⇒ { guias: { <guiado>: <guia> }, erro }. Só o esguio e o robusto
// são guiados (têm REFORCO_PROPORCAO); o guia é outro mestre.
export function lerGuiasMestre(lista = []) {
  const guias = {}, uso = x => `--guia-mestre ${x}: use <porte>-lisa=<porte>-lisa, o guiado = o guia (ex.: robusto-lisa=padrao-lisa)`;
  for (const x of lista) {
    const [a, b, resto] = String(x).split('='), pa = /^([a-z]+)-lisa$/.exec(a || ''), pb = /^([a-z]+)-lisa$/.exec(b || '');
    if (resto != null || !pa || !pb || !PORTES.includes(pa[1]) || !PORTES.includes(pb[1])) return { guias: {}, erro: uso(x) };
    if (pa[1] === pb[1]) return { guias: {}, erro: `--guia-mestre ${x}: o mestre não guia a si mesmo` };
    if (!REFORCO_PROPORCAO[pa[1]]) return { guias: {}, erro: `--guia-mestre ${x}: o ${pa[1]} não tem reforço de proporção (só ${Object.keys(REFORCO_PROPORCAO).join(' e ')} são guiados por outro mestre)` };
    if (guias[a] && guias[a] !== b) return { guias: {}, erro: `--guia-mestre ${a}: dois guias (${guias[a]} e ${b})` };
    guias[a] = b;
  }
  return { guias, erro: null };
}
const ETAPAS_PARADAS = ['retrato', 'parado', 'corrida'];
// Confere --only, --repetir, --sem-guia, --guia-galope-mestre, --refazer, --guia-mestre e --escolher contra os itens da
// fase (e o --escolher e o --guia-mestre também contra o criterios.json e os crus de raw/); devolve o erro ou null.
// gerar: o --gerar (refação já terminada sem --nova-refacao é erro de uso; no dry-run, aviso)
export function validarArgsPortes({ fase, only, repetir = [], semGuia = [], guiaGalope = [], refazer = [], novaRefacao = false, guiaMestre = [], escolher = [], motivo = null, reprocessar = false, gerar = false, manterEscolhas = false }, novos = DIR_NOVOS, raw = DIR_MOLDES_RAW) {
  if (!FASES.includes(fase)) return `--lote portes: --fase ${fase == null ? '(faltou)' : fase}: use mestres, piloto ou versoes`;
  if (manterEscolhas && !reprocessar) return '--manter-escolhas só anda com --reprocessar (ele regrava os finais de raw/ com as escolhas que já estão no criterios.json)';
  if (motivo != null && !escolher.length) return '--motivo só vale com --escolher';
  if (escolher.length) {
    if (gerar || reprocessar) return '--escolher não anda com --gerar nem com --reprocessar (a escolha não gasta nada: só lê raw/ e regrava novos/)';
    if (refazer.length || novaRefacao || repetir.length || guiaMestre.length || only) return '--escolher não anda com --refazer, --nova-refacao, --repetir, --guia-mestre nem --only';
    if (motivo == null || !String(motivo).trim()) return '--escolher pede --motivo "<texto>" (por que a tentativa foi aceita na folha; fica gravado no criterios.json)';
  }
  for (const [op, lista] of [['--sem-guia', semGuia], ['--guia-galope-mestre', guiaGalope]]) {
    if (!lista.length) continue;
    if (fase === 'mestres') return `${op}: só nas fases piloto e versoes (o mestre não tem guia)`;
    for (const ch of lista) {
      const [p, e, resto] = String(ch).split('-');
      if (!PORTES.includes(p) || !ELEMENTOS.includes(e) || resto != null) return `${op} ${ch}: use <porte>-<estilo> de uma versão (ex.: padrao-ondas)`;
      if (fase === 'piloto' && e !== 'chamas') return `${op} ${ch}: a fase piloto só tem as versões de chamas`;
    }
  }
  const crit = lerCriterios(novos), todos = itensDaFase(fase, { piloto: crit.piloto || {}, semGuia, guiaGalope });
  for (const ch of guiaGalope) {
    if (!todos.some(it => it.chave === ch)) return `--guia-galope-mestre ${ch}: não está na fase "${fase}" (itens: ${todos.map(it => it.chave).join(', ')})`;
  }
  if (only && !todos.some(it => it.porte === only || it.chave === only)) {
    return `--only ${only}: não existe na fase "${fase}" (itens: ${todos.map(it => it.chave).join(', ')}; ou um porte: ${PORTES.join(', ')})`;
  }
  if (repetir.length > 2) return '--repetir: no máximo 2 itens';
  for (const r of repetir) {
    const [chave, etapa] = r.split('/');
    if (!todos.some(it => it.chave === chave) || !ETAPAS.includes(etapa)) return `--repetir ${r}: item desconhecido na fase "${fase}" (ex.: ${todos[0].chave}/retrato, ${todos[0].chave}/galope)`;
  }
  if (novaRefacao && !refazer.length) return '--nova-refacao só vale com --refazer';
  if (refazer.length) {
    if (reprocessar) return '--refazer não anda com --reprocessar (o --refazer pede seeds novas; o --reprocessar só lê raw/)';
    const { pedidos, erro } = lerRefazer(refazer);
    if (erro) return erro;
    for (const chave of Object.keys(pedidos)) {
      const it = todos.find(i => i.chave === chave), ant = crit.itens[chave];
      if (!it) return `--refazer ${chave}: não está na fase "${fase}" (itens: ${todos.map(i => i.chave).join(', ')})`;
      if (only && it.porte !== only && it.chave !== only) return `--refazer ${chave}: fora do --only ${only}`;
      if (!ant) return `--refazer ${chave}: o item ainda não tem registro no criterios.json (nada a refazer: rode a fase sem --refazer)`;
      if (ant.variante !== it.variante) return `--refazer ${chave}: a receita mudou ("${ant.variante}" → "${it.variante}") e a nova já sai nas seeds dela, sem --refazer`;
      const ts = refacoesTerminadas(ant, pedidos[chave]);
      if (gerar && !novaRefacao && !pelaMetade(ant) && ts.length) return msgRefacaoTerminada(chave, ts);
    }
  }
  if (guiaMestre.length) {
    if (fase !== 'mestres') return '--guia-mestre: só na fase mestres (as versões já saem guiadas pelo mestre do porte)';
    const { guias, erro } = lerGuiasMestre(guiaMestre);
    if (erro) return erro;
    const { pedidos } = lerRefazer(refazer);
    for (const [a, b] of Object.entries(guias)) {
      const es = (pedidos[a] || []).filter(e => ETAPAS_PARADAS.includes(e));
      if (!es.length) return `--guia-mestre ${a}=${b}: anda com o --refazer de ${a} com retrato, parado ou corrida (ex.: --refazer ${a}:retrato,parado,corrida,galope)`;
      if (pedidos[b]) return `--guia-mestre ${a}=${b}: o guia ${b} não pode ser refeito na mesma rodada`;
      const J = lerJson(path.join(novos, `molde-${b}.json`));
      if (!J || !J.seeds) return `--guia-mestre ${a}=${b}: o guia ainda não tem molde em ${rel(novos)}/`;
      for (const e of es) if (!cruEscolhido(raw, J, crit.itens[b], b, e)) return `--guia-mestre ${a}=${b}: falta o cru escolhido de ${b}/${e} em ${rel(raw)}/ (seed ${J.seeds[e === 'corrida' ? 'montado' : e]})`;
      // o retrato decide a força do parado e da corrida: sem refazê-lo junto, o escolhido tem de ter saído guiado
      if (!es.includes('retrato')) {
        const x = crit.itens[a] && crit.itens[a].etapas && crit.itens[a].etapas.retrato;
        const t = x && (x.tentativas || []).find(y => y.seed === x.escolhida && (!x.escolha || !x.escolha.arquivo || y.arquivo === x.escolha.arquivo));
        if (!t || !t.guiaMestre) return `--guia-mestre ${a}=${b}: a força do parado e da corrida sai do retrato aceito, e o retrato escolhido de ${a} não saiu guiado por outro mestre: refaça o retrato junto (--refazer ${a}:retrato,${es.join(',')})`;
      }
    }
  }
  if (escolher.length) {
    const { escolhas, erro } = lerEscolhas(escolher);
    if (erro) return erro;
    for (const x of escolhas) {
      const it = todos.find(i => i.chave === x.chave), ant = crit.itens[x.chave];
      if (!it) return `--escolher ${x.chave}: não está na fase "${fase}" (itens: ${todos.map(i => i.chave).join(', ')})`;
      if (!ant) return `--escolher ${x.chave}: o item ainda não tem registro no criterios.json (nada a escolher)`;
      if (ant.variante !== it.variante) return `--escolher ${x.chave}: a receita no criterios.json é "${ant.variante}", não "${it.variante}" (repita as opções da receita, --sem-guia ou --guia-galope-mestre)`;
      const a = acharTentativa(raw, ant, x.etapa, x.seed);
      if (a.erro) return `--escolher ${x.chave}:${x.etapa}=${x.seed}: ${a.erro}`;
    }
  }
  return null;
}

// ---------------------------------------------------------------- arquivos de novos/
const rel = f => path.relative(RAIZ, f);
function lerJson(arq) { try { return JSON.parse(fs.readFileSync(arq, 'utf8')); } catch { return null; } }
function gravarJson(arq, v) {
  fs.mkdirSync(path.dirname(arq), { recursive: true });
  // as chaves com "_" (imagens e quadros em memória) não vão para o arquivo
  fs.writeFileSync(arq, JSON.stringify(v, (k, x) => (k.startsWith('_') ? undefined : x), 2) + '\n');
}
// gasto.json que existe mas não se lê: o gasto acumulado do lote é desconhecido. Nunca vale como zero (o teto ficaria
// livre) e nunca é sobrescrito (a 1ª chamada paga apagaria o registro): o --gerar para, o dry-run avisa.
export class GastoIlegivel extends ErroApi {
  constructor(arq, motivo) {
    super(`${rel(arq)} ilegível (${motivo}): o gasto acumulado do lote é desconhecido. Conserte o arquivo à mão (ele não é sobrescrito) antes de gerar.`, { fatal: true });
  }
}
export function lerGasto(novos = DIR_NOVOS) {
  const arq = path.join(novos, 'gasto.json');
  if (!fs.existsSync(arq)) return { geracoes: 0, chamadas: 0, rodadas: [] };
  let g;
  try { g = JSON.parse(fs.readFileSync(arq, 'utf8')); } catch (e) { throw new GastoIlegivel(arq, `não é JSON: ${e.message}`); }
  const finito = v => typeof v === 'number' && Number.isFinite(v) && v >= 0;
  if (!g || typeof g !== 'object' || Array.isArray(g)) throw new GastoIlegivel(arq, 'não é um objeto');
  if (!finito(g.geracoes)) throw new GastoIlegivel(arq, `"geracoes" = ${JSON.stringify(g.geracoes)}, não um número finito ≥ 0`);
  if (g.chamadas != null && !finito(g.chamadas)) throw new GastoIlegivel(arq, `"chamadas" = ${JSON.stringify(g.chamadas)}, não um número finito ≥ 0`);
  if (g.rodadas != null && !Array.isArray(g.rodadas)) throw new GastoIlegivel(arq, '"rodadas" não é uma lista');
  return Object.assign({ chamadas: 0, rodadas: [] }, g);
}
export function lerCriterios(novos = DIR_NOVOS) {
  const c = lerJson(path.join(novos, 'criterios.json'));
  return c && c.itens ? Object.assign({ piloto: {}, portes: null }, c) : { lote: 'portes', itens: {}, piloto: {}, portes: null };
}
// Molde gravado (molde-<chave>.json + PNGs em cinza = papel × 25) no formato dos critérios, ou null se faltar algo.
export function lerMolde(dir, chave) {
  const J = lerJson(path.join(dir, `molde-${chave}.json`));
  if (!J || !(J.frames > 0) || !J.ancoras) return null;
  const idx = n => {
    const f = path.join(dir, `molde-${chave}-${n}.png`);
    if (!fs.existsSync(f)) return null;
    const d = decodePng(fs.readFileSync(f));
    return deCinza(Uint8Array.from({ length: d.width * d.height }, (_, i) => d.rgba[i * 4]));
  };
  const retrato = idx('retrato'), parado = idx('parado'), galope = Array.from({ length: J.frames }, (_, i) => idx('galope-' + i));
  if (!retrato || !parado || galope.some(g => !g)) return null;
  return { w: J.w, h: J.h, retrato, parado, galope, ancoras: J.ancoras, larguraUtil: J.larguraUtil, json: J };
}
// nomes em raw/: a etapa guiada leva a marca da guia (outra guia ⇒ outro arquivo): `g<força>m<seed do mestre>` pelo
// mestre no mesmo estado, `gm<força>c<corrida>s<galope>` pelo 1º quadro do galope do mestre. O galope leva a marca da
// pose de corrida de onde saiu.
const marcaGuia = (tipo, guia) => (tipo === 'galope' ? `gm${FORCA_GUIA_GALOPE}${guia ? guia.seed : 'x'}` : `g${FORCA_GUIA}m${guia ? guia.seed : 'x'}`);
// mestre guiado por outro (--guia-mestre): g<força><porte do guia><seed do cru do guia>, ex. g60padrao3102
const marcaGuiaMestre = (gm, forca) => `g${forca}${gm.mestre.replace(/-lisa$/, '')}${gm.seed}`;
const prefixoEtapa = (item, etapa, marca) => `portes-${item.chave}-${etapa}${marca ? '-' + marca : ''}`;
const prefixoGalope = (item, tc) => `portes-${item.chave}-galope-c${tc.seed}${tc.marca || ''}`;
// As tentativas de uma etapa no registro de um item (criterios.json): as da refação atual e as do `historico`, da mais
// nova para a mais velha, cada uma com a refação e a origem dela. A cópia que uma escolha manual trouxe de outra refação
// (importada) só vale no lugar de origem.
function tentativasDoRegistro(reg, etapa) {
  const out = [], x = reg && reg.etapas && reg.etapas[etapa];
  if (x) for (const t of x.tentativas || []) if (!t.importada) out.push({ t, refacao: x.refacao || 0, origem: `refação ${x.refacao || 0}, a atual` });
  for (const h of [...((reg && reg.historico) || [])].reverse()) {
    const y = h.etapas && h.etapas[etapa];
    if (!y) continue;
    const r = y.refacao != null ? y.refacao : (h.refacoes && h.refacoes[etapa]) || 0;
    const origem = h.refazer ? `refação ${r}, no histórico` : `receita "${h.variante}", no histórico`;
    for (const t of y.tentativas || []) if (!t.importada) out.push({ t, refacao: r, origem });
  }
  return out;
}
// A tentativa `seed` (e `arquivo`, quando dado) de uma etapa no registro, com imagem em raw/: { t, refacao, origem,
// base } ou { erro } (seed que não está nas tentativas, sem imagem, cru com erro da API ou rejeitado à mão)
export function acharTentativa(raw, reg, etapa, seed, arquivo = null) {
  const todas = tentativasDoRegistro(reg, etapa), mesmas = todas.filter(x => x.t.seed === seed && (!arquivo || x.t.arquivo === arquivo));
  if (!mesmas.length) {
    const seeds = [...new Set(todas.map(x => x.t.seed))];
    return { erro: `a seed ${seed} não está nas tentativas de ${etapa} (${seeds.length ? `seeds tentadas: ${seeds.join(', ')}` : 'nenhuma tentativa'})` };
  }
  const motivos = [];
  for (const x of mesmas) {
    const base = baseDoArquivo(x.t.arquivo), cru = base && lerJson(path.join(raw, base + '.json'));
    if (!base || (cru && cru.erro) || !pngsCrus(raw, base, etapa === 'galope')) { motivos.push(`${x.t.arquivo || 'sem arquivo'} sem imagem em raw/${cru && cru.erro ? ` (erro da API: ${cru.erro.slice(0, 80)})` : ''}`); continue; }
    if (cru && cru.rejeitada) { motivos.push(`${x.t.arquivo} rejeitada na conferência visual (${cru.rejeitada})`); continue; }
    return { ...x, base };
  }
  return { erro: `a tentativa seed ${seed} de ${etapa} não serve: ${motivos.join('; ')}` };
}
// O cru escolhido de um mestre numa etapa (retrato, parado, corrida; galope = o 1º quadro): a seed do molde dele em
// novos/ (J.seeds) e o arquivo pela tentativa no criterios.json — o nome pode levar a marca de uma guia (mestre guiado
// por outro) ou vir do histórico (escolha manual) —; sem registro, o nome de sempre. { seed, buf, arquivo } ou null.
function cruEscolhido(raw, J, reg, chave, etapa) {
  const sd = (J && J.seeds) || {}, seed = sd[etapa === 'corrida' ? 'montado' : etapa], galope = etapa === 'galope';
  if (seed == null || (galope && sd.montado == null)) return null;
  const daCorrida = t => t.first_frame === `${chave}/corrida seed ${sd.montado}`;
  const cands = tentativasDoRegistro(reg, etapa).map(x => x.t).filter(t => t.seed === seed && t.arquivo);
  if (galope) cands.sort((a, b) => daCorrida(b) - daCorrida(a)); // o galope da corrida do molde primeiro
  const bases = [...cands.map(t => baseDoArquivo(t.arquivo)), galope ? `portes-${chave}-galope-c${sd.montado}-s${seed}` : `portes-${chave}-${etapa}-s${seed}`];
  for (const base of bases) {
    const nome = base + (galope ? '-0' : '') + '.png', f = path.join(raw, nome);
    if (fs.existsSync(f)) return { seed: galope ? `c${sd.montado}s${seed}` : seed, buf: fs.readFileSync(f), arquivo: `raw/${nome}` };
  }
  return null;
}
// as imagens cruas aceitas do mestre (as seeds do JSON dele), para o init_image das versões guiadas; galope0 = o 1º
// quadro cru do galope dele (para --guia-galope-mestre), ou null se faltar
function crusDoMestre(raw, J, chave, reg) {
  const out = {};
  for (const etapa of ETAPAS_PARADAS) {
    const c = cruEscolhido(raw, J, reg, chave, etapa);
    if (!c) return null;
    out[etapa] = c;
  }
  out.galope0 = cruEscolhido(raw, J, reg, chave, 'galope');
  return out;
}

// ---------------------------------------------------------------- tentativas
const PLANEJADO = Symbol('planejado');
// --escolher sem uma imagem crua em raw/ (a escolha nunca paga): o item fica incompleto, como no --reprocessar
class FaltaCruEscolha extends FaltaCru {
  constructor(rotulo) { super(rotulo); this.message = `--escolher: faltaria gerar ${rotulo} (sem imagem crua em raw/; a escolha não paga nada)`; }
}
const falhasDe = t => (t.criterios || []).filter(c => !c.ok);
// a tentativa passou no "mesmo corpo" (todos os critérios dele ok), qualquer que seja o resto (forma, pernas…)
const passouMesmoCorpo = t => { const mc = (t.criterios || []).filter(c => /^mesmo corpo/.test(c.criterio)); return mc.length > 0 && mc.every(c => c.ok); };
// Quanto um critério reprovado ficou longe do limite, normalizado pelo limite (0 = no limite; ok = 0). O limite vem do
// texto do critério: ≥ 1,15 e ≤ 0,92 (portes), = 4 (pernas), ≥ 2, = 9, varia ≤ 3 px, ±6 px, |Δ| ≤ 2 px (mesmo corpo, valor
// com sinal). Sem número no limite (forma), conta o valor (os quadros ruins); sem valor medido, conta como muito longe.
export function faltaDoLimite(c) {
  if (c.ok) return 0;
  if (typeof c.valor !== 'number' || !Number.isFinite(c.valor)) return 1e6;
  const m = /(\|Δ\|\s*)?([≤≥=±])\s*(-?\d+(?:[.,]\d+)?)/.exec(String(c.limite));
  if (!m) return Math.abs(c.valor);
  const lim = Number(m[3].replace(',', '.')), v = m[1] || m[2] === '±' ? Math.abs(c.valor) : c.valor, escala = Math.abs(lim) || 1;
  if (m[2] === '≥') return Math.max(0, lim - v) / escala;
  if (m[2] === '=') return Math.abs(v - lim) / escala;
  return Math.max(0, v - lim) / escala; // ≤ e ±
}
// Melhor tentativa: a 1ª aprovada; senão a com menos critérios reprovados (reprovar na forma pesa 100). Empate no número:
//   1. a escolha anterior (pref: o cru, nome-base em raw/, da escolhida de uma rodada anterior que terminou a etapa na
//      mesma refação) — a escolha que continua valendo não muda numa reavaliação: trocar a corrida obrigaria a animar
//      outro galope, e trocar o mestre, a refazer as versões;
//   2. a que chegou mais perto dos limites (a menor soma de faltaDoLimite dos critérios reprovados): com as 3 reprovando
//      os mesmos portes, fica a que mais se aproximou, e não a 1ª (a força 90, a mais parecida com o guia);
//   3. a ordem das tentativas (a 1ª).
function melhorTentativa(tentativas, pref = null) {
  const comImagem = tentativas.filter(t => t.planejada || t._buf || t._bufs), ehPref = t => pref != null && t._base === pref;
  const oks = comImagem.filter(t => t.ok || t.planejada);
  if (oks.length) return oks.find(ehPref) || oks[0];
  const nota = t => falhasDe(t).reduce((n, c) => n + (/^forma/.test(c.criterio) ? 100 : 1), 0);
  const falta = t => falhasDe(t).reduce((s, c) => s + faltaDoLimite(c), 0);
  const melhor = (t, m) => (nota(t) !== nota(m) ? nota(t) < nota(m) : ehPref(t) !== ehPref(m) ? ehPref(t) : falta(t) < falta(m) - 1e-9);
  return comImagem.reduce((m, t) => (!m || melhor(t, m) ? t : m), null);
}
// nome-base do cru de uma tentativa gravada: raw/<base>.png (parada) ou raw/<base>-0..8.png / -N.png (galope)
const baseDoArquivo = a => (typeof a === 'string' ? a.replace(/^raw\//, '').replace(/(-\d+\.\.\d+|-N)?\.png$/, '') : null);
function criterioForma(etapa, ruins) {
  return { criterio: `forma (${etapa})`, ok: !ruins.length, valor: ruins.length, limite: 'paleta, papéis obrigatórios e silhueta fechada (validar)', ...(ruins.length ? { motivo: ruins.join('; ') } : {}) };
}
const resumoCrit = c => `${c.criterio} = ${c.valor == null ? '—' : typeof c.valor === 'number' ? fmt(c.valor) : c.valor} (${c.limite})`;

/**
 * Roda uma fase do lote. modo: 'plano' (dry-run: nada é pago nem gravado; as chamadas novas vão para
 * resultado.chamadas), 'reprocessar' (só raw/: refaz novos/ e o criterios.json; o que faltar em raw/ deixa o item
 * incompleto) ou 'gerar' (executar(ep, corpo) faz a chamada de verdade; o pixellab-moldes passa o executarReal).
 * dirs = { raw, novos } (os testes usam uma pasta temporária). Devolve { itens, chamadas, reaproveitadas, avisos,
 * falhas, parada, gastoAntes, gasto, previstas }.
 */
export async function rodarPortes(op) {
  const { fase, only = null, teto = TETO_PADRAO, repetir = [], semGuia = [], guiaGalope = [], refazer = [], novaRefacao = false, guiaMestre = [], escolher = [], motivo = null, modo = 'plano', executar = null, manterEscolhas = false } = op;
  const raw = (op.dirs && op.dirs.raw) || DIR_MOLDES_RAW, novos = (op.dirs && op.dirs.novos) || DIR_NOVOS;
  // modo 'escolher' (--escolher): como o --reprocessar, nada é pago (o que faltar em raw/ deixa o item incompleto), e
  // só os itens escolhidos entram; o criterios.json só é gravado no fim (ver salvar)
  const plano = modo === 'plano', reproc = modo === 'reprocessar', escolha = modo === 'escolher', semPagar = reproc || escolha;
  const log = plano ? () => {} : (op.log || console.log);
  if (!FASES.includes(fase)) throw new ErroApi(`fase desconhecida: ${fase}`, { fatal: true });
  if (modo === 'gerar' && typeof executar !== 'function') throw new Error('rodarPortes: modo gerar sem executar');
  const { pedidos, erro: erroRefazer } = lerRefazer(refazer);
  if (erroRefazer) throw new ErroApi(erroRefazer, { fatal: true });
  if (reproc && refazer.length) throw new ErroApi('--refazer não anda com --reprocessar', { fatal: true });
  if (manterEscolhas && !reproc) throw new ErroApi('--manter-escolhas só anda com --reprocessar', { fatal: true });
  const { guias, erro: erroGuias } = lerGuiasMestre(guiaMestre);
  if (erroGuias) throw new ErroApi(erroGuias, { fatal: true });
  if (guiaMestre.length && fase !== 'mestres') throw new ErroApi('--guia-mestre: só na fase mestres', { fatal: true });
  const { escolhas, erro: erroEscolhas } = lerEscolhas(escolher);
  if (erroEscolhas) throw new ErroApi(erroEscolhas, { fatal: true });
  if (escolha !== !!escolhas.length) throw new ErroApi(escolha ? 'modo escolher sem --escolher' : '--escolher só no modo escolher (sem rede e sem custo)', { fatal: true });
  if (escolha && (refazer.length || guiaMestre.length || repetir.length || only)) throw new ErroApi('--escolher não anda com --refazer, --guia-mestre, --repetir nem --only', { fatal: true });
  if (escolha && (motivo == null || !String(motivo).trim())) throw new ErroApi('--escolher pede --motivo "<texto>"', { fatal: true });
  const crit = lerCriterios(novos), avisos = [];
  // gasto.json ilegível: o --gerar para aqui, antes de qualquer chamada; o plano e o --reprocessar (que não pagam nem
  // gravam o gasto) seguem com o aviso
  let gasto, gastoIlegivel = null;
  try { gasto = lerGasto(novos); } catch (e) {
    if (!(e instanceof GastoIlegivel) || modo === 'gerar') throw e;
    gastoIlegivel = e.message; gasto = { geracoes: 0, chamadas: 0, rodadas: [], ilegivel: true };
    avisos.push(e.message + (plano ? ' A previsão abaixo conta como se nada tivesse sido gasto; o --gerar recusa rodar assim.' : ''));
  }
  const todosDaFase = itensDaFase(fase, { only, piloto: crit.piloto, semGuia, guiaGalope });
  const itens = escolha ? todosDaFase.filter(it => escolhas.some(x => x.chave === it.chave)) : todosDaFase;
  for (const x of escolhas) {
    const it = itens.find(i => i.chave === x.chave), ant = crit.itens[x.chave];
    const erro = !it ? `não está na fase "${fase}"` : !ant ? 'o item ainda não tem registro no criterios.json'
      : ant.variante !== it.variante ? `a receita no criterios.json é "${ant.variante}", não "${it.variante}"` : acharTentativa(raw, ant, x.etapa, x.seed).erro;
    if (erro) throw new ErroApi(`--escolher ${x.chave}:${x.etapa}=${x.seed}: ${erro}`, { fatal: true });
  }
  const res = { itens: itens.map(i => i.chave), chamadas: [], reaproveitadas: [], manuais: [], mantidas: [], trocas: [], naoGravados: [], guiaPerdida: [], avisos, falhas: 0, incompletos: 0, parada: null, gastoAntes: gasto.geracoes, gastoIlegivel, refacaoTerminada: [], gasto: 0, previstas: 0 };
  // as entradas de antes desta rodada (o histórico de um item refeito com outra receita é guardado, não sobrescrito)
  const anteriores = {};
  for (const it of itens) if (crit.itens[it.chave]) anteriores[it.chave] = crit.itens[it.chave];
  // refação de cada etapa (0 = as seeds de sempre; r = a r-ésima do --refazer): a gravada no criterios.json (com a
  // mesma receita), + 1 nas etapas pedidas no --refazer. Item que ficou pela metade (alguma etapa sem terminar as
  // seeds: teto, erro fatal) não abre refação nova: a dele é retomada — rodar o mesmo --refazer de novo não joga fora
  // o que já saiu.
  for (const it of itens) {
    const ant = anteriores[it.chave], mesma = !!ant && ant.variante === it.variante, pede = pedidos[it.chave] || [];
    const metade = mesma && pelaMetade(ant);
    it.refacoes = Object.fromEntries(ETAPAS.map(e => [e, (mesma && ant.refacoes && ant.refacoes[e]) || 0]));
    it.refazendo = mesma && !metade ? pede.slice() : [];
    // a refação pedida já terminou (o mesmo --refazer de novo): sem --nova-refacao nada é refeito — o --gerar para
    // aqui, antes de qualquer chamada; o dry-run avisa em destaque e segue o item nas seeds de agora (reaproveitadas)
    const ts = it.refazendo.length && !novaRefacao ? refacoesTerminadas(ant, it.refazendo) : [];
    if (ts.length) {
      const msg = msgRefacaoTerminada(it.chave, ts);
      if (modo === 'gerar') throw new ErroApi(msg, { fatal: true });
      res.refacaoTerminada.push(msg); it.refazendo = [];
      continue;
    }
    for (const e of it.refazendo) it.refacoes[e]++;
    if (!pede.length) continue;
    if (!mesma) avisos.push(`--refazer ${it.chave}: ignorado (${ant ? `a receita mudou de "${ant.variante}" para "${it.variante}"` : 'o item ainda não tem registro'}; ele sai nas seeds de sempre).`);
    else if (metade) avisos.push(`--refazer ${it.chave}: o item ficou pela metade (teto ou erro) e é retomado nas mesmas seeds, sem refação nova; rode o --refazer de novo depois, se ainda quiser refazer.`);
    else {
      const desc = it.refazendo.map(e => `${e} (refação ${it.refacoes[e]}: seeds ${seedsDoItem(it, e, repetir).join(', ')}${e === 'galope' && it.refazendo.includes('corrida') ? '; parte da corrida nova' : ''})`);
      avisos.push(`--refazer ${it.chave}: ${desc.join(', ')}; a tentativa anterior vai para o histórico e a escolha só olha as novas.`);
    }
  }
  const agora = new Date().toISOString(); // a data desta rodada (gasto.json, histórico e escolhas manuais)
  // guia de outro mestre (--guia-mestre) em cada etapa parada: a nova, nas etapas refeitas agora; a gravada, na etapa
  // que continua na refação em que ela foi pedida (retomar, --reprocessar, as rodadas dos outros itens). Escolhas
  // manuais: a gravada vale até um --refazer daquela etapa; a do --escolher desta rodada passa por cima dela.
  // forcas: no retrato, uma por tentativa (FORCAS_GUIA_MESTRE); no parado e na corrida, null até o retrato da rodada
  // terminar — aí vira [a força do retrato aceito] (forcaDoRetrato), a mesma em todas as tentativas (etapaParada)
  const novaGuia = (it, b, e) => {
    const J = lerJson(path.join(novos, `molde-${b}.json`)), c = cruEscolhido(raw, J, crit.itens[b], b, e);
    const gm = { mestre: b, seed: c ? c.seed : null, arquivo: c ? c.arquivo : null, refacao: it.refacoes[e],
      forcas: e === 'retrato' ? [...FORCAS_GUIA_MESTRE] : null, ...(e === 'retrato' ? {} : { forcaDoRetrato: null }), reforco: REFORCO_PROPORCAO[it.porte] };
    return c ? Object.assign(gm, { _buf: c.buf }) : gm;
  };
  // a tentativa escolhida do retrato no registro de antes (para dizer a força que o parado e a corrida vão usar)
  const retratoGravado = ant => {
    const x = ant && ant.etapas && ant.etapas.retrato;
    return x ? (x.tentativas || []).find(t => t.seed === x.escolhida && (!x.escolha || !x.escolha.arquivo || t.arquivo === x.escolha.arquivo)) || null : null;
  };
  for (const it of itens) {
    const ant = anteriores[it.chave], mesma = !!ant && ant.variante === it.variante, b = guias[it.chave];
    it.guiasMestre = {}; it.manuais = {}; it.mantidas = {};
    // escolha mantida por um --reprocessar --manter-escolhas: vale em toda rodada seguinte (reprocessar, gerar, escolher
    // outra etapa), na mesma receita e refação, até um --escolher ou um --refazer daquela etapa
    if (mesma) {
      for (const e of ETAPAS) {
        const x = ant.etapas && ant.etapas[e];
        if (x && x.mantida && !it.refazendo.includes(e) && (x.refacao || 0) === it.refacoes[e]) it.mantidas[e] = x.mantida;
      }
    }
    for (const e of ETAPAS_PARADAS) {
      const gAnt = mesma && ant.guiaMestre && ant.guiaMestre[e];
      // a refação de antes desta etapa saiu guiada por outro mestre e esta sai sem guia: aviso em destaque (dry-run e log)
      if (!b && gAnt && it.refazendo.includes(e) && (gAnt.refacao || 0) === ((ant.refacoes && ant.refacoes[e]) || 0)) {
        res.guiaPerdida.push(`--refazer ${it.chave}:${e}: a refação ${gAnt.refacao || 0} de ${e} saiu guiada por ${gAnt.mestre} (--guia-mestre), e a refação ${it.refacoes[e]} sai SEM guia, só pelo texto. Para manter a guia, repita com --guia-mestre ${it.chave}=${gAnt.mestre}.`);
      }
      if (b && it.refazendo.includes(e)) it.guiasMestre[e] = novaGuia(it, b, e);
      else if (gAnt && !it.refazendo.includes(e) && (gAnt.refacao || 0) === it.refacoes[e]) {
        const f = gAnt.arquivo && path.join(raw, gAnt.arquivo.replace(/^raw\//, ''));
        it.guiasMestre[e] = Object.assign({}, gAnt, f && fs.existsSync(f) ? { _buf: fs.readFileSync(f) } : {});
      }
      const gm = it.guiasMestre[e];
      if (gm && !gm._buf) {
        const msg = `a guia de ${it.chave}/${e} (${gm.mestre}${gm.arquivo ? `, ${gm.arquivo}` : ''}) não está em raw/`;
        if (!plano) throw new ErroApi(`--guia-mestre: ${msg}`, { fatal: true });
        avisos.push(`--guia-mestre: ${msg}; a previsão segue sem o init_image.`);
      }
    }
    if (b) {
      const es = ETAPAS_PARADAS.filter(e => it.guiasMestre[e] && it.refazendo.includes(e));
      if (!es.length) avisos.push(`--guia-mestre ${it.chave}=${b}: ignorado (nenhuma imagem parada de ${it.chave} é refeita nesta rodada).`);
      else {
        const gm = it.guiasMestre[es[0]], outras = es.filter(e => e !== 'retrato'), partes = [];
        if (es.includes('retrato')) {
          partes.push(`retrato: forças ${seedsDoItem(it, 'retrato', repetir).map((s, k) => `${forcaGuiaMestre(gm.forcas, k)} (seed ${s})`).join(', ')}, parando na 1ª que passa nos critérios`);
        }
        if (outras.length) {
          const tr = !es.includes('retrato') && retratoGravado(ant);
          partes.push(`${lista(outras)}: a força do retrato aceito (ou do melhor, se os 3 reprovarem)${tr ? ` — a do retrato escolhido, seed ${tr.seed}, força ${tr.init_image_strength}` : ''}, a mesma em todas as seeds (${seedsDoItem(it, outras[0], repetir).join(', ')}), parando na 1ª que passa`);
        }
        avisos.push(`--guia-mestre ${it.chave}=${b}: ${es.map(e => `${e} com init_image = ${it.guiasMestre[e].arquivo || '(falta)'}`).join(', ')}; texto do ${it.porte} (versão ${ultimaVersao(it.porte)}) + "${gm.reforco}"; `
          + `${partes.join('; ')}; o galope parte da corrida aceita.`);
      }
    }
    if (mesma) {
      for (const e of ETAPAS) {
        const esc = ant.etapas && ant.etapas[e] && ant.etapas[e].escolha;
        if (esc && esc.manual && !it.refazendo.includes(e)) it.manuais[e] = { seed: esc.seed, arquivo: esc.arquivo, data: esc.data, motivo: esc.motivo, ...(esc.automatico ? { automatico: esc.automatico } : {}) };
      }
    }
    const novas = escolhas.filter(x => x.chave === it.chave);
    for (const x of novas) it.manuais[x.etapa] = { seed: x.seed, data: agora, motivo: String(motivo).trim(), nova: true };
    // escolher a corrida não muda o galope: se o escolhido partiu de outra corrida, ele fica escolhido também (senão a
    // rodada animaria um galope novo a partir da corrida escolhida)
    const nc = novas.find(x => x.etapa === 'corrida'), ge = ant && ant.etapas && ant.etapas.galope;
    if (nc && !novas.some(x => x.etapa === 'galope') && ge && ge.escolhida != null) {
      const tc = acharTentativa(raw, ant, 'corrida', nc.seed), pg = it.manuais.galope;
      const tg = pg ? acharTentativa(raw, ant, 'galope', pg.seed, pg.arquivo) : acharTentativa(raw, ant, 'galope', ge.escolhida);
      if (!tc.erro && !tg.erro && !tg.base.startsWith(prefixoGalope(it, tc.t) + '-s')) {
        if (!pg) it.manuais.galope = { seed: tg.t.seed, arquivo: tg.t.arquivo, data: agora, motivo: String(motivo).trim(), nova: true, automatico: `a corrida foi escolhida à mão (seed ${nc.seed}); o galope continua o escolhido` };
        avisos.push(`--escolher ${it.chave}:corrida=${nc.seed}: o galope escolhido (seed ${tg.t.seed}, ${tg.t.arquivo}) partiu de outra corrida (${tg.t.first_frame || '?'}); ele continua o escolhido e não é refeito (o molde grava montado = ${nc.seed}). Para trocar o galope: --escolher ${it.chave}:galope=<seed> ou --refazer ${it.chave}:galope.`);
      }
    }
  }

  // teto somado entre rodadas: o orçamento começa no gasto de novos/gasto.json e grava a cada chamada paga
  const rodada = { data: agora, fase, modo, only, ...(refazer.length ? { refazer } : {}), ...(guiaMestre.length ? { guiaMestre } : {}), teto, geracoes: 0, chamadas: 0 };
  const orc = criarOrcamento(teto, {
    gasto: gasto.geracoes, log,
    aoRegistrar: (ep, g) => {
      if (gasto.ilegivel) throw new ErroApi('gasto.json ilegível: nada é gravado por cima dele', { fatal: true });
      gasto.geracoes += g; gasto.chamadas += 1; rodada.geracoes += g; rodada.chamadas += 1;
      if (!gasto.rodadas.includes(rodada)) gasto.rodadas.push(rodada);
      gravarJson(path.join(novos, 'gasto.json'), gasto);
    },
  });
  const pagar = async (ep, it, corpo, texto) => {
    if (plano) {
      res.chamadas.push({ endpoint: ep, rotulo: it.rotulo, seed: it.seed, texto, alemDoTeto: gasto.geracoes + res.previstas + 1 > teto + 1e-9 });
      res.previstas++;
      return PLANEJADO;
    }
    if (semPagar) throw escolha ? new FaltaCruEscolha(`${it.rotulo} seed ${it.seed}`) : new FaltaCru(`${it.rotulo} seed ${it.seed}`);
    return pago(orc, ep, it, () => executar(ep, corpo));
  };

  // mestres de cada porte (piloto e versões): o molde em novos/ e as imagens cruas aceitas dele
  const mestres = {};
  if (fase !== 'mestres') {
    for (const p of new Set(itens.map(i => i.porte))) {
      const chave = `${p}-lisa`, molde = lerMolde(novos, chave), crus = molde && crusDoMestre(raw, molde.json, chave, crit.itens[chave]);
      if (!molde || !crus) {
        if (!plano) throw new ErroApi(`falta o mestre ${chave} em ${rel(novos)}/ (com as imagens cruas em raw/): rode --fase mestres antes`, { fatal: true });
        res.avisos.push(`o mestre ${chave} ainda não está em novos/: a previsão usa a 1ª seed de cada etapa e o init_image entra quando ele existir.`);
      }
      mestres[p] = { molde, crus };
      const querGalope = itens.filter(i => i.porte === p && i.guiaGalope).map(i => i.chave);
      if (querGalope.length && !(crus && crus.galope0)) {
        if (!plano) throw new ErroApi(`--guia-galope-mestre ${querGalope.join(', ')}: falta o 1º quadro cru do galope do mestre ${chave} em raw/`, { fatal: true });
        res.avisos.push(`o galope do mestre ${chave} ainda não está em raw/: a corrida de ${querGalope.join(', ')} entra guiada por ele quando existir.`);
      }
    }
  }
  for (const it of itens) {
    if (semGuia.includes(it.chave)) res.avisos.push(`--sem-guia ${it.chave}: sai sem init_image (receita do primeiro lote, seed base ${it.seedBase}); o registro do piloto não muda.`);
    if (it.guiaGalope) res.avisos.push(`--guia-galope-mestre ${it.chave}: a pose de corrida sai com init_image = o 1º quadro do galope do mestre ${it.chaveMestre} (força ${FORCA_GUIA_GALOPE}), e o galope parte dela.`);
  }
  if (fase === 'versoes') {
    for (const p of new Set(itens.map(i => i.porte))) {
      const pil = crit.piloto[p];
      if (!pil) {
        if (!plano) throw new ErroApi(`falta o resultado do piloto de ${p} no criterios.json: rode --fase piloto antes`, { fatal: true });
        res.avisos.push(`sem o resultado do piloto de ${p}: a previsão supõe o piloto aprovado (versões com init_image).`);
      } else if (pil.mesmoCorpo === false) {
        res.avisos.push(`o piloto de ${p} reprovou no "mesmo corpo" nas 3 seeds: as versões de ${p} saem sem init_image (receita do primeiro lote, seeds ${BLOCO.semGuia}+), e ${p}-chamas é refeito.`);
      }
    }
  }
  for (const a of res.avisos) log(`AVISO: ${a}`); // no plano, quem imprime é o dryRunPortes
  for (const a of res.guiaPerdida) log(`${'!'.repeat(112)}\n!!! AVISO: ${a}\n${'!'.repeat(112)}`);
  // régua das proporções: o retrato do padrão (o desta rodada, se o padrão está nela; senão o de novos/)
  let refPadrao = null;
  const regua = () => refPadrao || (refPadrao = (() => { const m = lerMolde(novos, 'padrao-lisa'); return m && { w: m.w, h: m.h, retrato: m.retrato, ancoras: { retrato: m.ancoras.retrato } }; })());

  const estados = {};
  for (const it of itens) estados[it.chave] = { etapas: {}, incompleto: null, final: false };

  // No modo escolher, o criterios.json só é gravado no fim (fim = true), e o item que terminaria incompleto tendo estado
  // completo antes (um cru que sumiu de raw/) fica como estava: a escolha não troca um registro inteiro por um pela metade.
  const salvar = (fim = false) => {
    if (plano || (escolha && !fim)) return;
    for (const it of itens) {
      if (!Object.keys(estados[it.chave].etapas).length) continue;
      const e = entrada(it), ant = anteriores[it.chave];
      if (escolha && !e.completo && ant && ant.completo) { if (!res.naoGravados.includes(it.chave)) res.naoGravados.push(it.chave); continue; }
      crit.itens[it.chave] = e;
    }
    crit.lote = 'portes'; crit.limites = LIMITES; crit.atualizado = new Date().toISOString();
    gravarJson(path.join(novos, 'criterios.json'), crit);
  };
  function entrada(item) {
    const st = estados[item.chave], etapas = {}, falhas = [], aceitos = [];
    for (const e of ETAPAS) {
      const x = st.etapas[e];
      if (!x) continue;
      etapas[e] = { escolhida: x.escolhida ? x.escolhida.seed : null, ok: !!(x.escolhida && x.escolhida.ok), terminada: x.terminada, refacao: item.refacoes[e], tentativas: x.tentativas, ...(x.escolha ? { escolha: x.escolha } : {}), ...(x.mantida ? { mantida: x.mantida } : {}) };
      if (!x.terminada) falhas.push(`${e}: interrompida antes de terminar as seeds`);
      else if (!x.escolhida) falhas.push(`${e}: nenhuma tentativa com imagem`);
      else if (!x.escolhida.ok) {
        // escolha manual: o que a escolhida reprova foi aceito na folha (aceitos), não reprova o item
        (x.escolha ? aceitos : falhas).push(...falhasDe(x.escolhida).map(c => (c.criterio.startsWith(e + ':') ? '' : `${e}: `) + resumoCrit(c)), ...(x.escolhida.motivo ? [`${e}: ${x.escolhida.motivo}`] : []));
      }
    }
    if (st.incompleto) falhas.push(st.incompleto);
    const completo = ETAPAS.every(e => st.etapas[e] && st.etapas[e].terminada && st.etapas[e].escolhida);
    // a entrada anterior com outra receita vai para o histórico (com as tentativas dela); a da mesma receita é refeita
    // desta rodada (as tentativas reaproveitadas de raw/ voltam todas), e o histórico dela continua. Etapas refeitas
    // (--refazer): o registro anterior delas (escolhida, tentativas, refação) vai para o histórico, acrescentado.
    const ant = anteriores[item.chave], semHist = ({ historico, ...resto }) => resto;
    const guiasAnt = ant && ant.guiaMestre && Object.fromEntries(item.refazendo.filter(e => ant.guiaMestre[e]).map(e => [e, ant.guiaMestre[e]]));
    const refeito = ant && item.refazendo.length ? [{
      refazer: item.refazendo, data: rodada.data, variante: ant.variante, falhas: ant.falhas || [], ...(ant.aceitos ? { aceitos: ant.aceitos } : {}),
      refacoes: Object.fromEntries(item.refazendo.map(e => [e, (ant.refacoes && ant.refacoes[e]) || 0])),
      etapas: Object.fromEntries(item.refazendo.filter(e => ant.etapas && ant.etapas[e]).map(e => [e, ant.etapas[e]])),
      ...(guiasAnt && Object.keys(guiasAnt).length ? { guiaMestre: guiasAnt } : {}),
    }] : [];
    // escolha manual nova (--escolher): o que a etapa tinha antes (a escolhida, a refação e a escolha manual anterior)
    const novas = ETAPAS.filter(e => item.manuais[e] && item.manuais[e].nova && st.etapas[e] && st.etapas[e].escolha);
    const escolhido = ant && novas.length ? [{
      escolher: novas, data: rodada.data, motivo: item.manuais[novas[0]].motivo,
      antes: Object.fromEntries(novas.filter(e => ant.etapas && ant.etapas[e]).map(e => [e, { escolhida: ant.etapas[e].escolhida, ok: ant.etapas[e].ok, refacao: ant.etapas[e].refacao || 0, ...(ant.etapas[e].escolha ? { escolha: ant.etapas[e].escolha } : {}) }])),
    }] : [];
    const historico = ant ? [...(ant.historico || []), ...(ant.variante !== item.variante ? [semHist(ant)] : []), ...refeito, ...escolhido] : [];
    const g0 = item.guiaGalope && mestres[item.porte] && mestres[item.porte].crus && mestres[item.porte].crus.galope0;
    return {
      fase: item.fase, porte: item.porte, estilo: item.estilo, mestre: item.chaveMestre, variante: item.variante,
      guia: item.guia ? { init_image_strength: FORCA_GUIA } : null,
      guiaGalope: item.guiaGalope ? { init_image_strength: FORCA_GUIA_GALOPE, quadro: g0 ? g0.arquivo : null } : null,
      ...(Object.keys(item.guiasMestre).length ? { guiaMestre: item.guiasMestre } : {}),
      seedBase: item.seedBase, refacoes: item.refacoes, completo, final: st.final, ok: completo && !falhas.length, falhas, ...(aceitos.length ? { aceitos } : {}), etapas, historico,
    };
  }

  const pular = (t, reg, item, etapa) => {
    t.ok = false;
    if (reg.rejeitada) t.geracoes = geracoesDe(reg.resposta, reg.resposta && reg.resposta.job) ?? 1;
    // --manter-escolhas (ou etapa com escolha mantida): o erro de API de uma rodada anterior guarda o custo que foi
    // contado nela (o cru de erro não o registra; sem a opção, a tentativa pulada sai com 0, como sempre)
    else if (manterEtapa(item, etapa)) {
      const a = tentativasDoRegistro(anteriores[item.chave], etapa).find(x => x.t.seed === t.seed && baseDoArquivo(x.t.arquivo) === t._base && x.t.motivo);
      if (a && a.t.geracoes) t.geracoes = a.t.geracoes;
    }
    t.motivo = reg.erro ? `erro registrado em rodada anterior: ${reg.erro}` : `rejeitada na conferência visual: ${reg.rejeitada}`;
    log(`    pulada seed ${t.seed}: ${t.motivo}`);
  };
  const reaproveitar = (t, reg, rotulo) => {
    t.reaproveitada = true; t.geracoes = geracoesDe(reg.resposta, reg.resposta && reg.resposta.job) ?? 1; t.data = reg.data;
    res.reaproveitadas.push({ rotulo, t });
    log(`    reaproveitada a imagem crua da seed ${t.seed} (mesmo pedido; ${fmt(t.geracoes)} geração gasta antes)`);
  };
  const relatar = (rotulo, t) => {
    if (t.planejada) return;
    log(t.ok ? `    aprovada seed ${t.seed}` : `    REPROVADA seed ${t.seed}: ${[...falhasDe(t).map(resumoCrit), ...(t.motivo && !t.criterios ? [t.motivo] : [])].join('; ')}`);
  };
  // o cru (nome-base em raw/) da escolhida da rodada anterior nesta etapa, com a mesma receita e a mesma refação, ou null.
  // Só a de uma etapa que terminou as seeds: a melhor de uma etapa interrompida (teto, erro) ainda não é uma decisão, e a
  // retomada escolhe de novo entre todas
  const preferida = (item, etapa) => {
    const ant = anteriores[item.chave], x = ant && ant.variante === item.variante && ant.etapas && ant.etapas[etapa];
    if (!x || x.escolhida == null || !x.terminada || (x.refacao || 0) !== item.refacoes[etapa]) return null;
    const t = (x.tentativas || []).find(y => y.seed === x.escolhida);
    return t ? baseDoArquivo(t.arquivo) : null;
  };
  // o pedido de uma seed parada: com o texto atual do porte; se o cru dessa seed em raw/ saiu de um texto anterior
  // (TEXTOS_PORTE), vale aquele — o cru é reaproveitado, nunca refeito por cima (o nome dele não leva o texto)
  const pedidoDaSeed = (item, etapa, seed, base, guiaBuf, forca, proporcao = null) => {
    const vs = TEXTOS_PORTE[item.porte];
    for (let k = vs.length - 1; k >= 0; k--) {
      const corpo = pedidoPorte(item, etapa, seed, guiaBuf, forca, vs[k].versao, proporcao), reg = lerCru(raw, base, corpo);
      if (reg) return { corpo, reg, versao: vs[k].versao };
    }
    return { corpo: pedidoPorte(item, etapa, seed, guiaBuf, forca, ultimaVersao(item.porte), proporcao), reg: null, versao: ultimaVersao(item.porte) };
  };
  // um cru que já existe em raw/ com outro pedido nunca é refeito por cima: o --gerar para antes de pagar (o dry-run
  // mostra onde). Só um registro de erro, sem imagem, pode ser refeito. O --reprocessar não paga (fica o FaltaCru).
  const protegerCru = (base, varios, rotulo, seed) => {
    const arq = path.join(raw, base + '.json');
    if (semPagar || !fs.existsSync(arq)) return;
    const reg = lerJson(arq);
    if (reg && reg.erro && !pngsCrus(raw, base, varios)) return;
    throw new ErroApi(`raw/${base}: já existe um cru de ${rotulo} seed ${seed} com outro pedido, e ele não é refeito por cima (para seeds novas: --refazer)`, { fatal: true });
  };

  // ------------------------------------------------ etapa parada (retrato, parado, corrida)
  function avaliarParada(item, etapa, buf, t, mestre) {
    const g = classificarGrupo([buf], etapa !== 'retrato', `${item.chave}/${etapa}`, etapa === 'corrida');
    const q = g.quadros[0], a = ancoras(q.idx, LADO, LADO);
    const m = { w: LADO, h: LADO, [etapa]: q.idx, ancoras: { [etapa]: a }, larguraUtil: a.bbox.w };
    const crits = [criterioForma(etapa, g.ruins)];
    if (etapa === 'corrida') {
      const n = pernas(q.idx, LADO, LADO, a);
      crits.push({ criterio: 'pernas na pose de corrida (o quadro 0 do galope)', ok: n >= LIMITES.galopeMin, valor: n, limite: `≥ ${LIMITES.galopeMin}` });
    } else {
      crits.push(...criterioPernas(m));
      if (mestre && mestre.molde) crits.push(...criterioMesmoCorpo(m, mestre.molde));
      if (item.mestre && etapa === 'retrato' && item.porte !== 'padrao') {
        const ref = regua();
        if (ref) crits.push(...criterioPortes({ padrao: ref, [item.porte]: m }));
        else log('    (sem o retrato do padrão: a proporção do porte fica para o fim da fase)');
      }
    }
    t.criterios = crits; t.ok = crits.every(c => c.ok); t._buf = buf; t._quadro = { idx: q.idx, ancora: a };
  }
  async function etapaParada(item, etapa) {
    if (item.manuais[etapa]) return etapaManual(item, etapa, item.manuais[etapa]);
    const st = estados[item.chave], rotulo = `${item.chave}/${etapa}`;
    const mestre = item.mestre ? null : mestres[item.porte], crus = mestre && mestre.crus;
    // a guia desta etapa: outro mestre no mesmo estado (mestre com --guia-mestre; a força muda a cada tentativa), o 1º
    // quadro do galope do mestre (corrida com --guia-galope-mestre), o mestre no mesmo estado (versão guiada) ou nenhuma.
    // g.forca(k) e g.marca(k) = a força e a marca do cru da k-ésima tentativa.
    const gm = item.guiasMestre[etapa];
    let g = null;
    if (gm) {
      // parado e corrida: a força do retrato aceito (ou do melhor, com os 3 reprovados) desta rodada, a mesma em todas as
      // tentativas (só a seed muda) — o retrato, que tem o critério dos portes, decide quanto o guia pesa, e os outros
      // estados saem com o mesmo corpo. Decidida uma vez e gravada (forcas, forcaDoRetrato): a retomada refaz os mesmos
      // pedidos. No dry-run, com o retrato ainda por gerar, a força só se sabe depois dele.
      let textoForca = null;
      if (etapa !== 'retrato' && !gm.forcas) {
        const r = st.etapas.retrato && st.etapas.retrato.escolhida;
        if (r && r.planejada) textoForca = 'a do retrato aceito (o retrato ainda não saiu)';
        else if (r && r.guiaMestre && r.init_image_strength != null) { gm.forcas = [r.init_image_strength]; gm.forcaDoRetrato = { seed: r.seed, forca: r.init_image_strength }; }
        else {
          const msg = `${rotulo}: a força da guia sai do retrato aceito, e ${r ? `o retrato escolhido (seed ${r.seed}) não saiu guiado` : 'o retrato não tem tentativa com imagem'}; ${item.chave} fica incompleto (refaça o retrato com --guia-mestre)`;
          st.etapas[etapa] = { tentativas: [], escolhida: null, terminada: false };
          st.incompleto = msg; res.avisos.push(msg); log(`  INCOMPLETO ${item.chave}: ${msg}`);
          return;
        }
      }
      const forcas = gm.forcas || [FORCAS_GUIA_MESTRE[0]];
      g = { tipo: 'mestre', guia: gm._buf ? { seed: gm.seed, buf: gm._buf, arquivo: gm.arquivo } : null, proporcao: gm.reforco, mestre: gm.mestre, textoForca,
        forca: k => forcaGuiaMestre(forcas, k), marca: k => marcaGuiaMestre(gm, forcaGuiaMestre(forcas, k)),
        descricao: gm.arquivo ? `${gm.arquivo}` : `o mestre ${gm.mestre}/${etapa} (cru não encontrado)` };
    } else {
      const tipo = etapa === 'corrida' && item.guiaGalope ? 'galope' : item.guia ? 'estado' : null;
      const guia = tipo === 'galope' ? (crus && crus.galope0) || null : tipo === 'estado' ? (crus && crus[etapa]) || null : null;
      const forca = tipo === 'galope' ? FORCA_GUIA_GALOPE : FORCA_GUIA, marca = tipo && marcaGuia(tipo, guia);
      g = tipo && { tipo, guia, forca: () => forca, marca: () => marca,
        descricao: guia ? guia.arquivo : tipo === 'galope' ? `o 1º quadro do galope do mestre ${item.chaveMestre} (ainda não gerado)` : `o mestre ${item.chaveMestre}/${etapa} (ainda não gerado)` };
    }
    const tentativas = [], pref = preferida(item, etapa);
    st.etapas[etapa] = { tentativas, escolhida: null, terminada: false };
    try {
      await tentarParada(item, etapa, rotulo, mestre, g, tentativas, pref);
      st.etapas[etapa].terminada = true;
    } finally {
      // também quando o teto interrompe no meio: fica a melhor tentativa que já tem imagem
      const esc = st.etapas[etapa].escolhida = escolherTentativa(item, etapa, st.etapas[etapa], tentativas, pref);
      if (st.etapas[etapa].terminada) avisarTroca(item, etapa, esc);
      if (esc && !esc.ok && !esc.planejada && st.etapas[etapa].terminada) log(`    ${rotulo}: reprovada nas ${tentativas.length} seeds; fica a melhor, a seed ${esc.seed}`);
      if (item.mestre && item.porte === 'padrao' && etapa === 'retrato' && esc && esc._quadro) {
        refPadrao = { w: LADO, h: LADO, retrato: esc._quadro.idx, ancoras: { retrato: esc._quadro.ancora } };
      }
    }
  }
  // A escolha da etapa: a melhor tentativa (melhorTentativa). Com --manter-escolhas (só no --reprocessar), a escolha
  // anterior (pref) fica, aprovada ou não, enquanto tiver imagem em raw/: a rodada reavalia os critérios e regrava os
  // finais com as MESMAS tentativas — a folha já revista não troca de desenho porque uma classificação nova fez outra
  // seed passar (tarefa 6a). Quando a melhor seria outra, a etapa grava `mantida` ({ seria, seriaOk, data }) e o Resumo
  // avisa. A marca é durável: nas rodadas seguintes, com ou sem a opção (--reprocessar, --gerar da fase, --escolher de
  // outra etapa), a etapa marcada continua com a escolha dela (item.mantidas), até um --escolher ou um --refazer dela.
  const manterEtapa = (item, etapa) => manterEscolhas || !!item.mantidas[etapa];
  function escolherTentativa(item, etapa, x, tentativas, pref) {
    const melhor = melhorTentativa(tentativas, pref), duravel = item.mantidas[etapa];
    const ant = manterEtapa(item, etapa) && pref != null ? tentativas.find(t => t._base === pref && (t._buf || t._bufs)) : null;
    if (!ant || (ant === melhor && !duravel)) return melhor;
    x.mantida = { seria: melhor ? melhor.seed : null, seriaOk: !!(melhor && melhor.ok), data: (duravel && duravel.data) || rodada.data };
    if (ant !== melhor) {
      const rotulo = `${item.chave}/${etapa}`;
      res.mantidas.push({ rotulo, seed: ant.seed, ok: !!ant.ok, seria: x.mantida.seria, seriaOk: x.mantida.seriaOk });
      log(`    ${rotulo}: escolha mantida (${duravel ? `marcada em ${String(x.mantida.data).slice(0, 10)}` : '--manter-escolhas'}), a seed ${ant.seed}${ant.ok ? '' : ' (reprovada)'}; pelos critérios de hoje seria a seed ${x.mantida.seria}${x.mantida.seriaOk ? ' (aprovada)' : ''}`);
    }
    return ant;
  }
  // A escolha de uma etapa que mudou sem ser pedida (sem --escolher nem --refazer dela): um critério ou a classificação
  // mudou e outra seed passou a ser a melhor, a receita do item mudou, ou o cru da escolha anterior sumiu. A troca muda o
  // desenho já visto na folha: AVISO em destaque no log e no Resumo (res.trocas; o dry-run também mostra).
  function avisarTroca(item, etapa, esc) {
    const ant = anteriores[item.chave], x = ant && ant.etapas && ant.etapas[etapa];
    if (!x || x.escolhida == null || !esc || esc.planejada || item.refazendo.includes(etapa)) return;
    const pin = item.manuais[etapa];
    if (pin && pin.nova) return; // --escolher desta etapa nesta rodada (ou o galope que fica junto com a corrida escolhida)
    const tAnt = (x.tentativas || []).find(t => t.seed === x.escolhida && (!x.escolha || !x.escolha.arquivo || t.arquivo === x.escolha.arquivo));
    const mesmaBase = !tAnt || !tAnt.arquivo || !esc.arquivo || baseDoArquivo(tAnt.arquivo) === baseDoArquivo(esc.arquivo);
    if (esc.seed === x.escolhida && mesmaBase) return;
    const porque = ant.variante !== item.variante ? `a receita mudou ("${ant.variante}" → "${item.variante}")`
      : 'os critérios de hoje escolhem outra tentativa (ou a escolhida de antes não está mais em raw/)';
    const msg = `${item.chave}/${etapa}: a escolha mudou da seed ${x.escolhida} para a ${esc.seed} sem --escolher nem --refazer — ${porque}. O desenho visto na folha muda; para voltar: --escolher ${item.chave}:${etapa}=${x.escolhida}.`;
    res.trocas.push(msg);
    log(`${'!'.repeat(112)}\n!!! AVISO: ${msg}\n${'!'.repeat(112)}`);
  }
  // --manter-escolhas: o laço reavalia todas as tentativas que já estão em raw/, as de erro incluídas (não para na 1ª
  // aprovada: as tentativas pagas continuam no registro), e para no 1º cru que falta depois da escolha anterior (nada a
  // pagar no --reprocessar)
  const passouDaEscolha = (manter, k, ate) => manter && ate >= 0 && k > ate;
  // pref = o cru da escolha anterior (preferida): depois de uma aprovada, o laço só segue até ela, e só pelo que já
  // está em raw/ (sem pagar); a escolha fica com ela se continuar aprovada
  async function tentarParada(item, etapa, rotulo, mestre, g, tentativas, pref) {
    const seeds = seedsDoItem(item, etapa, repetir), bases = seeds.map((s, k) => `${prefixoEtapa(item, etapa, g && g.marca(k))}-s${s}`);
    const ate = bases.indexOf(pref);
    for (let k = 0; k < seeds.length; k++) {
      const seed = seeds[k], base = bases[k], forca = g ? g.forca(k) : FORCA_GUIA;
      const { corpo, reg, versao } = pedidoDaSeed(item, etapa, seed, base, g && g.guia && g.guia.buf, forca, g && g.proporcao);
      const crus = reg && !reg.erro && !reg.rejeitada ? pngsCrus(raw, base, false) : null;
      if (!crus && !(manterEtapa(item, etapa) && reg) && (tentativas.some(x => x.ok) || passouDaEscolha(manterEtapa(item, etapa), k, ate))) break;
      const t = { seed, endpoint: PIXFLUX, prompt: corpo.description, versaoTexto: versao, arquivo: `raw/${base}.png`, geracoes: 0, marca: g ? g.marca(k) : '', _base: base };
      if (g) { t.init_image = g.descricao; t.init_image_strength = forca; }
      if (g && g.tipo === 'mestre') t.guiaMestre = g.mestre;
      tentativas.push(t);
      const forcaTxt = g && g.textoForca ? `= ${g.textoForca}` : forca;
      log(`  ${rotulo} seed ${seed}${g ? ` (init_image ${t.init_image}, força ${forcaTxt}${g.tipo === 'mestre' && etapa !== 'retrato' && !g.textoForca ? ', a do retrato aceito' : ''})` : ''}`);
      if (reg && (reg.erro || reg.rejeitada)) { pular(t, reg, item, etapa); continue; }
      let buf;
      if (crus) { reaproveitar(t, reg, rotulo); buf = crus[0]; }
      else {
        if (!reg) protegerCru(base, false, rotulo, seed);
        const it = { rotulo, seed, geracoes: 0 };
        let resp;
        try {
          resp = await pagar(PIXFLUX, it, corpo, corpo.description + (g ? ` [init_image = ${t.init_image}; init_image_strength ${forcaTxt}]` : ''));
        } catch (e) {
          if (!recuperavel(e)) throw e;
          gravarErro(raw, base, PIXFLUX, corpo, e); t.ok = false; t.motivo = e.message; t.geracoes = it.geracoes;
          log(`    REPROVADA seed ${seed}: ${e.message}`);
          continue;
        }
        if (resp === PLANEJADO) { t.planejada = true; break; }
        buf = bufDe(resp.image, rotulo);
        gravarCru(raw, base, PIXFLUX, corpo, resp, [[base + '.png', buf]]);
        t.geracoes = it.geracoes; t.data = new Date().toISOString();
      }
      avaliarParada(item, etapa, buf, t, mestre);
      relatar(rotulo, t);
      if (t.ok && k >= ate && !manterEtapa(item, etapa)) break;
    }
  }

  // ------------------------------------------------ galope (a partir da pose de corrida escolhida)
  // tc = a pose de corrida de onde o galope saiu (com _quadro); sem ela (galope escolhido à mão de uma corrida que não
  // está mais em raw/), o "nose.x contra a pose de corrida" mede contra o quadro 0 do galope, que é o first_frame
  function avaliarGalope(item, bufs, t, tc) {
    const g = classificarGrupo(bufs, true, `${item.chave}/galope`, true);
    const anc = tc ? { corrida: tc._quadro.ancora } : {}, galope = g.quadros.map(q => q.idx);
    galope.forEach((q, i) => { anc['galope-' + i] = ancoras(q, LADO, LADO); });
    const m = { w: LADO, h: LADO, galope, ancoras: anc, ...(tc ? { corrida: tc._quadro.idx } : {}) };
    const crits = [criterioForma('galope', g.ruins), ...criterioPernas(m), ...criterioGalope(m)];
    t.criterios = crits; t.ok = crits.every(c => c.ok); t._bufs = bufs; t.quadros = bufs.length;
  }

  // ------------------------------------------------ escolha manual (--escolher, ou a gravada no criterios.json)
  // A tentativa vem do registro do item (da refação atual ou do histórico) e a imagem de raw/, sem chamada nenhuma. Ela é
  // reavaliada pelos critérios de hoje, e os que reprova ficam aceitos na folha (aceito: true). As outras tentativas da
  // refação atual ficam como estavam no registro (sem marca de escolha); a escolhida, se veio de outra refação, entra no
  // fim da lista como importada, com a refação e a origem dela.
  const semMarcaManual = ({ manual, aceita, ...t }) => (t.criterios ? Object.assign(t, { criterios: t.criterios.map(({ aceito, ...c }) => c) }) : t);
  function tentativaManual(item, etapa, pin) {
    const a = acharTentativa(raw, anteriores[item.chave], etapa, pin.seed, pin.arquivo || null);
    if (a.erro) throw new ErroApi(`escolha manual de ${item.chave}/${etapa} (seed ${pin.seed}): ${a.erro}`, { fatal: true });
    const { criterios, ok, manual, aceita, importada, motivo, reaproveitada, refacao, origem, planejada, ...t } = a.t;
    return { t: Object.assign(t, { _base: a.base }), a };
  }
  function fecharManual(item, etapa, pin, t, a) {
    t.manual = true;
    for (const c of t.criterios) if (!c.ok) c.aceito = true;
    if (!t.ok) t.aceita = true;
    const x = anteriores[item.chave].etapas && anteriores[item.chave].etapas[etapa];
    const lista = ((x && x.tentativas) || []).filter(y => !y.importada).map(semMarcaManual);
    const i = lista.findIndex(y => y.seed === t.seed && y.arquivo === t.arquivo);
    if (i >= 0) lista[i] = t; else { t.importada = true; t.refacao = a.refacao; t.origem = a.origem; lista.push(t); }
    const escolha = { manual: true, seed: t.seed, data: pin.data, motivo: pin.motivo, refacao: a.refacao, origem: a.origem, arquivo: t.arquivo,
      aceitos: t.criterios.filter(c => !c.ok).map(c => c.criterio), ...(pin.automatico ? { automatico: pin.automatico } : {}) };
    estados[item.chave].etapas[etapa] = { tentativas: lista, escolhida: t, terminada: true, escolha };
    res.manuais.push({ rotulo: `${item.chave}/${etapa}`, t, origem: a.origem });
    log(t.ok ? '    passa nos critérios de hoje' : `    critérios aceitos na folha: ${falhasDe(t).map(resumoCrit).join('; ')}`);
  }
  // quadro e âncora de uma imagem parada (a pose de corrida de um galope escolhido à mão)
  const quadroParado = (buf, etapa, rotulo) => {
    const q = classificarGrupo([buf], etapa !== 'retrato', rotulo, etapa === 'corrida').quadros[0];
    return { idx: q.idx, ancora: ancoras(q.idx, LADO, LADO) };
  };
  // a pose de corrida de onde saiu o galope de nome-base `base`: a escolhida da rodada, se for ela; senão a do registro
  // (pelo nome do cru, que leva a seed e a marca da corrida), ou null
  function corridaDoGalope(item, base) {
    const daqui = tc => tc && base.startsWith(prefixoGalope(item, tc) + '-s');
    const esc = estados[item.chave].etapas.corrida && estados[item.chave].etapas.corrida.escolhida;
    if (daqui(esc) && esc._quadro) return esc;
    for (const { t } of tentativasDoRegistro(anteriores[item.chave], 'corrida')) {
      const b = baseDoArquivo(t.arquivo);
      if (!daqui(t) || !b || !fs.existsSync(path.join(raw, b + '.png'))) continue;
      return { seed: t.seed, marca: t.marca, _quadro: quadroParado(fs.readFileSync(path.join(raw, b + '.png')), 'corrida', `${item.chave}/corrida`) };
    }
    return null;
  }
  async function etapaManual(item, etapa, pin) {
    const rotulo = `${item.chave}/${etapa}`, { t, a } = tentativaManual(item, etapa, pin);
    log(`  ${rotulo}: escolha manual, seed ${t.seed} (${a.origem}; ${t.arquivo}${pin.automatico ? `; ${pin.automatico}` : ''})`);
    if (etapa === 'galope') {
      const tc = corridaDoGalope(item, a.base), esc = estados[item.chave].etapas.corrida && estados[item.chave].etapas.corrida.escolhida;
      if ((!esc || tc !== esc) && !(pin.nova && pin.automatico)) { // o galope mantido ao escolher a corrida já foi avisado
        const msg = `${rotulo}: o galope escolhido (seed ${t.seed}) partiu de ${t.first_frame || 'outra corrida'}, não da corrida escolhida (${esc ? `seed ${esc.seed}` : 'nenhuma'}); ele não é refeito, e o molde grava montado = ${esc ? esc.seed : '—'}.`;
        if (!res.avisos.includes(msg)) res.avisos.push(msg);
        log(`  AVISO: ${msg}`);
      }
      avaliarGalope(item, pngsCrus(raw, a.base, true), t, tc);
    } else {
      avaliarParada(item, etapa, fs.readFileSync(path.join(raw, a.base + '.png')), t, item.mestre ? null : mestres[item.porte]);
      if (item.mestre && item.porte === 'padrao' && etapa === 'retrato') refPadrao = { w: LADO, h: LADO, retrato: t._quadro.idx, ancoras: { retrato: t._quadro.ancora } };
    }
    fecharManual(item, etapa, pin, t, a);
  }

  async function etapaGalope(item) {
    if (item.manuais.galope) return etapaManual(item, 'galope', item.manuais.galope);
    const st = estados[item.chave], rotulo = `${item.chave}/galope`, tc = st.etapas.corrida && st.etapas.corrida.escolhida;
    const tentativas = [], pref = preferida(item, 'galope');
    st.etapas.galope = { tentativas, escolhida: null, terminada: false };
    if (!tc) { st.incompleto = 'galope: sem pose de corrida'; return; }
    try {
      await tentarGalope(item, rotulo, tc, tentativas, pref);
      st.etapas.galope.terminada = true;
    } finally {
      const esc = st.etapas.galope.escolhida = escolherTentativa(item, 'galope', st.etapas.galope, tentativas, pref);
      if (st.etapas.galope.terminada) avisarTroca(item, 'galope', esc);
      if (esc && !esc.ok && !esc.planejada && st.etapas.galope.terminada) log(`    ${rotulo}: reprovado nas ${tentativas.length} seeds; fica o melhor galope, a seed ${esc.seed}`);
    }
  }
  async function tentarGalope(item, rotulo, tc, tentativas, pref) {
    const seeds = seedsDoItem(item, 'galope', repetir), bases = seeds.map(s => `${prefixoGalope(item, tc)}-s${s}`);
    const ate = bases.indexOf(pref);
    for (let k = 0; k < seeds.length; k++) {
      const seed = seeds[k], base = bases[k];
      const t = { seed, endpoint: ANIMA, prompt: ACAO_PORTES, first_frame: `${item.chave}/corrida seed ${tc.seed}`, geracoes: 0, _base: base };
      const texto = `${ACAO_PORTES} [first_frame = ${t.first_frame}; frame_count 8; drift_threshold 0]`;
      if (tc.planejada) { tentativas.push(t); await pagar(ANIMA, { rotulo, seed, geracoes: 0 }, null, texto); t.planejada = true; break; }
      const corpo = pedidoGalope(tc._buf, seed, ACAO_PORTES), reg = lerCru(raw, base, corpo);
      let bufs = reg && !reg.erro && !reg.rejeitada ? pngsCrus(raw, base, true) : null;
      if (!bufs && !(manterEtapa(item, 'galope') && reg) && (tentativas.some(x => x.ok) || passouDaEscolha(manterEtapa(item, 'galope'), k, ate))) break;
      tentativas.push(t);
      t.arquivo = `raw/${base}-N.png`;
      log(`  ${rotulo} seed ${seed} (corrida ${tc.seed}; job assíncrono; pode levar minutos)`);
      if (reg && (reg.erro || reg.rejeitada)) { pular(t, reg, item, 'galope'); continue; }
      if (bufs) reaproveitar(t, reg, rotulo);
      else {
        if (!reg) protegerCru(base, true, rotulo, seed);
        const it = { rotulo, seed, geracoes: 0 };
        let r;
        try {
          r = await pagar(ANIMA, it, corpo, texto);
        } catch (e) {
          if (!recuperavel(e)) throw e;
          gravarErro(raw, base, ANIMA, corpo, e); t.ok = false; t.motivo = e.message; t.geracoes = it.geracoes;
          log(`    REPROVADA seed ${seed}: ${e.message}`);
          continue;
        }
        if (r === PLANEJADO) { t.planejada = true; break; }
        bufs = quadrosDoJob(r.job).map((img, i) => bufDe(img, `${rotulo} quadro ${i}`));
        apagarQuadrosCrus(raw, base);
        gravarCru(raw, base, ANIMA, corpo, r, bufs.map((b, i) => [`${base}-${i}.png`, b]));
        t.geracoes = it.geracoes; t.data = new Date().toISOString();
      }
      if (!bufs.length) { t.ok = false; t.motivo = 'veio sem quadros'; log(`    REPROVADA seed ${seed}: ${t.motivo}`); continue; }
      t.arquivo = `raw/${base}-0..${bufs.length - 1}.png`;
      // outro número que não 9 reprova no critério "galope: 9 quadros" (e ainda pode ficar como o melhor, marcado)
      if (bufs.length !== LIMITES.quadros) log(`    AVISO ${rotulo}: vieram ${bufs.length} quadros (o molde precisa de ${LIMITES.quadros})`);
      avaliarGalope(item, bufs, t, tc);
      relatar(rotulo, t);
      if (t.ok && k >= ate && !manterEtapa(item, 'galope')) break;
    }
  }

  // ------------------------------------------------ finais em novos/ (só com as 4 etapas com imagem)
  function gravarFinais(item) {
    const st = estados[item.chave], esc = {};
    for (const e of ETAPAS) esc[e] = st.etapas[e] && st.etapas[e].escolhida;
    if (plano || ETAPAS.some(e => !esc[e] || esc[e].planejada || !st.etapas[e].terminada)) return;
    const fm = quadrosDoMolde(esc.retrato._buf, esc.parado._buf, esc.galope._bufs);
    const gerado = ETAPAS.map(e => esc[e].data || '').reduce((a, b) => (b > a ? b : a), '').slice(0, 10) || HOJE;
    gravarMolde(novos, item.chave, fm, { seeds: { retrato: esc.retrato.seed, parado: esc.parado.seed, montado: esc.corrida.seed, galope: esc.galope.seed }, gerado });
    st.final = true;
    log(`  gravado ${rel(path.join(novos, `molde-${item.chave}.json`))} (+ ${fm.nomes.length} PNGs)`);
  }

  const passo = async (item, f) => {
    const st = estados[item.chave];
    if (st.incompleto) return;
    try { await f(); } catch (e) {
      if (!(e instanceof FaltaCru)) throw e;
      st.incompleto = e.message; log(`  INCOMPLETO ${item.chave}: ${e.message}`);
    }
    salvar();
  };
  try {
    for (const item of itens) {
      const gms = ETAPAS_PARADAS.filter(e => item.guiasMestre[e]);
      log(`\n== ${item.chave} (${item.fase}; seed base ${item.seedBase}${item.guia ? `; init_image do mestre ${item.chaveMestre}, força ${FORCA_GUIA}` : item.mestre ? '' : '; sem init_image'}${item.guiaGalope ? `; corrida guiada pelo galope do mestre, força ${FORCA_GUIA_GALOPE}` : ''}${gms.length ? `; ${gms.join(', ')} guiados por ${item.guiasMestre[gms[0]].mestre}, forças ${item.guiasMestre[gms[0]].forcas.join('/')}` : ''}) ==`);
      for (const etapa of ['retrato', 'parado', 'corrida']) await passo(item, () => etapaParada(item, etapa));
    }
    for (const item of itens) {
      log(`\n== ${item.chave}: galope ==`);
      await passo(item, () => etapaGalope(item));
      gravarFinais(item);
    }
  } catch (e) {
    if (!(e instanceof TetoAtingido) && !(e instanceof ErroApi && e.fatal)) throw e;
    res.parada = e instanceof TetoAtingido ? `TETO: ${e.message}` : `ERRO FATAL: ${e.message}`;
    log('\n' + res.parada);
  }

  // fim da fase: as proporções dos 3 mestres e o resultado de cada piloto
  if (!plano) {
    if (fase === 'mestres') {
      const ms = Object.fromEntries(PORTES.map(p => [p, lerMolde(novos, `${p}-lisa`)]));
      const faltam = PORTES.filter(p => !ms[p]).map(p => `${p}-lisa`);
      crit.portes = faltam.length ? { faltam, criterios: [] } : { faltam: [], criterios: criterioPortes(ms) };
    }
    if (fase === 'piloto') {
      // spec §5: o piloto reprova só se NENHUMA das seeds passar no "mesmo corpo" — em cada estado (retrato e parado),
      // basta uma tentativa com todos os critérios de mesmo corpo ok, mesmo que ela reprove em outro (a forma, por
      // exemplo) e a escolhida seja outra. Estado interrompido sem nenhuma aprovada ainda não decide.
      for (const item of itens) {
        if (!item.guia) continue; // --sem-guia: não é o piloto guiado; o registro do piloto fica como está
        const st = estados[item.chave];
        const veredito = e => {
          const x = st.etapas[e];
          if (!x) return null;
          const passou = x.tentativas.find(passouMesmoCorpo);
          if (passou) return { ok: true, seed: passou.seed };
          if (!x.terminada) return null;
          return { ok: false, falhas: x.tentativas.filter(t => t.criterios).map(t => `seed ${t.seed}: ${t.criterios.filter(c => /^mesmo corpo/.test(c.criterio) && !c.ok).map(resumoCrit).join('; ')}`) };
        };
        const vr = veredito('retrato'), vp = veredito('parado');
        if (!vr || !vp) continue;
        crit.piloto[item.porte] = { chave: item.chave, mesmoCorpo: vr.ok && vp.ok, retrato: vr, parado: vp, atualizado: new Date().toISOString() };
      }
    }
    if (rodada.chamadas) rodada.parada = res.parada;
    if (rodada.chamadas && !gasto.ilegivel) gravarJson(path.join(novos, 'gasto.json'), gasto);
    salvar(true);
    log('\n== Resumo ==');
    for (const ch of res.naoGravados) log(`  ${ch.padEnd(16)} NÃO GRAVADO: a escolha deixaria incompleto um item que estava completo (falta cru em raw/); o registro e o molde ficam como estavam`);
    for (const item of itens) {
      const e = crit.itens[item.chave];
      if (!e) { res.incompletos++; log(`  ${item.chave.padEnd(16)} não começou`); continue; }
      if (!e.ok) res.falhas++;
      if (!e.completo) res.incompletos++;
      log(`  ${item.chave.padEnd(16)} ${e.ok ? 'OK' : e.completo ? 'REPROVADO' : 'INCOMPLETO'}  seeds ${ETAPAS.map(x => `${x} ${e.etapas[x] ? e.etapas[x].escolhida : '—'}`).join(', ')}${e.final ? '' : '  (sem final em novos/)'}`);
      for (const f of e.falhas) log(`      ${f}`);
      for (const x of ETAPAS.filter(x => e.etapas[x] && e.etapas[x].escolha)) {
        const es = e.etapas[x].escolha;
        log(`      ${x}: escolha manual da seed ${es.seed} (${es.origem}; ${es.aceitos.length ? `aceitos na folha: ${es.aceitos.join(', ')}` : 'passa nos critérios'}); motivo: ${es.motivo}${es.automatico ? ` (${es.automatico})` : ''}`);
      }
      for (const f of e.aceitos || []) log(`      aceito: ${f}`);
      for (const x of ETAPAS.filter(x => e.etapas[x] && e.etapas[x].mantida)) {
        const m = e.etapas[x].mantida, outra = m.seria != null && m.seria !== e.etapas[x].escolhida;
        log(`      ${x}: escolha mantida (desde ${String(m.data || '').slice(0, 10) || '?'}; vale até um --escolher ou --refazer dela): seed ${e.etapas[x].escolhida}${outra ? `; pelos critérios de hoje seria a seed ${m.seria}${m.seriaOk ? ' (aprovada)' : ''}` : ''}`);
      }
    }
    for (const m of res.trocas) log(`  ${'!'.repeat(110)}\n  !!! AVISO: ${m}\n  ${'!'.repeat(110)}`);
    if (fase === 'mestres' && crit.portes) {
      log(crit.portes.faltam.length ? `  Portes distintos: faltam ${crit.portes.faltam.join(', ')}` : `  Portes distintos: ${crit.portes.criterios.map(c => `${c.ok ? 'ok' : 'NÃO'} ${resumoCrit(c)}`).join('; ')}`);
    }
    if (fase === 'piloto') for (const p of PORTES) if (crit.piloto[p]) log(`  Piloto ${p}: mesmo corpo ${crit.piloto[p].mesmoCorpo ? 'ok (versões com init_image)' : 'REPROVADO (versões sem init_image)'}`);
    res.gasto = rodada.geracoes;
    log(`  Gerações desta rodada: ${fmt(rodada.geracoes)} em ${rodada.chamadas} chamadas pagas; no lote: ${fmt(gasto.geracoes)} de teto ${teto}${res.parada ? '; rodada interrompida' : ''}`);
  }
  return res;
}

// Código de saída de uma rodada (gerar ou reprocessar): 1 quando ela parou (teto, erro fatal) ou deixou item incompleto;
// 0 quando terminou, mesmo com item reprovado num critério (ele vai para a folha).
export const codigoSaidaPortes = r => (r.parada || r.incompletos ? 1 : 0);

// Dry-run: o mesmo caminho do lote, no modo 'plano' (nada pago, nada gravado), e a lista das chamadas novas.
export async function dryRunPortes({ fase, only = null, teto = TETO_PADRAO, repetir = [], semGuia = [], guiaGalope = [], refazer = [], novaRefacao = false, guiaMestre = [], dirs } = {}, log = console.log) {
  const r = await rodarPortes({ fase, only, teto, repetir, semGuia, guiaGalope, refazer, novaRefacao, guiaMestre, modo: 'plano', dirs });
  const sobra = r.gastoIlegivel ? '?' : fmt(teto - r.gastoAntes), gastas = r.gastoIlegivel ? 'DESCONHECIDO (gasto.json ilegível)' : fmt(r.gastoAntes);
  if (r.gastoIlegivel) {
    log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    log(`!!! AVISO: ${r.gastoIlegivel}`);
    log('!!! O --gerar recusa rodar até o arquivo ser consertado; a previsão abaixo conta como se nada tivesse sido gasto.');
    log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
  }
  for (const m of r.guiaPerdida) {
    log('!'.repeat(112));
    log(`!!! AVISO: ${m}`);
    log('!'.repeat(112));
  }
  // escolha que trocaria sozinha (sem --escolher nem --refazer): o --gerar mudaria o desenho já visto na folha
  for (const m of r.trocas) {
    log('!'.repeat(112));
    log(`!!! AVISO: ${m}`);
    log('!'.repeat(112));
  }
  for (const m of r.refacaoTerminada) {
    log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    log(`!!! AVISO: ${m}`);
    log('!!! Nada é previsto para essas etapas (seguem nas seeds de agora), e o --gerar recusa rodar assim.');
    log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
  }
  log(`DRY-RUN (sem --gerar): nenhuma chamada à API. Lote "portes", fase "${fase}"${only ? ` (--only ${only})` : ''}; teto ${teto} gerações no lote todo, somadas entre rodadas em novos/gasto.json: já gastas ${gastas}, sobram ${sobra}.`);
  log(`Itens: ${r.itens.length} (${r.itens.join(', ')}).`);
  log(`Cada etapa (retrato, parado, corrida e galope) tenta até ${TENTATIVAS} seeds (base, base + ${PASSO_SEED}, base + ${2 * PASSO_SEED}) e para na 1ª que`);
  log('passa nos critérios automáticos; as repetições não entram na previsão. Ordem: as imagens paradas de todos os itens,');
  log('depois os galopes (cada um a partir da pose de corrida aceita). Estimativa: 1 geração por chamada (custo observado);');
  log('o que já tem imagem crua em raw/ com o mesmo pedido (e passa nos critérios) é reaproveitado sem custo.');
  for (const a of r.avisos) log(`AVISO: ${a}`);
  log('');
  let n = 0;
  const cortadas = r.chamadas.filter(c => c.alemDoTeto);
  for (const c of r.chamadas) {
    if (c.alemDoTeto) continue;
    n++;
    log(`${String(n).padStart(3)}. POST ${c.endpoint.padEnd(22)} ${c.rotulo.padEnd(22)} seed ${c.seed}  ~1 geração`);
    log(`       ${c.texto}`);
  }
  if (cortadas.length) log(`AVISO: o teto de ${teto} gerações (já gastas ${gastas}) cortou ${cortadas.length} chamada(s), a partir de ${cortadas[0].rotulo}.`);
  if (r.parada) log(`\nO --gerar PARARIA aqui (a lista acima vai só até este ponto): ${r.parada}`);
  const reap = r.reaproveitadas.map(({ rotulo, t }) => `${rotulo} (seed ${t.seed}${t.ok ? '' : ', reprovada'})`);
  log(`\nReaproveitados de raw/ (0 geração): ${reap.length ? reap.join(', ') : 'nenhum'}.`);
  if (r.manuais.length) log(`\nEscolhas manuais (0 geração; valem até um --refazer da etapa): ${r.manuais.map(({ rotulo, t, origem }) => `${rotulo} (seed ${t.seed}, ${origem}${t.ok ? '' : `; aceito na folha: ${falhasDe(t).map(c => c.criterio).join(', ')}`})`).join(', ')}.`);
  log(`\nTotal previsto: ${n} gerações em ${n} chamadas novas (+ ${r.reaproveitadas.length} reaproveitadas de raw/); no pior caso (${TENTATIVAS} seeds por etapa), ${TENTATIVAS * n}; teto ${teto} no lote (sobram ${sobra}).`);
  return r;
}
