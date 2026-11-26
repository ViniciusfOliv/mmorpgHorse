# Divergências

Nada aqui foi corrigido. Cada item traz uma proposta, que só vale depois da decisão do Vinicius.

## 1. GDD × código

| # | GDD diz | Código faz | Evidência | Proposta |
|---|---|---|---|---|
| G1 | Clima: dono com "status ×1,03", penalizado ×0,97 (§4); a sala mostra "+3%" | **Soma** `(m−1)·weatherAdd` a n: +1,5 ponto fixo. Só é ×1,03 no status 50; no 100, ≈ ×1,015 | `sim.js:905–909`, `game.js:6190–6192` | Decidir qual vale; depois alinhar GDD, texto da sala e fórmula (mudar a fórmula é mudança de balanceamento) |
| G2 | Pilar: "escolher a montaria **e o equipamento** para o mapa e o clima" (§2) | Equipamento fora do PVP; a ativa não troca com a sala aberta; a Preparação (§8.1) não existe. O §3 do próprio GDD diz "sem tática pré-corrida" | `game.js:82,2843` | Atualizar o pilar e decidir a §8.1 (COR-1) |
| G3 | Pote "dividido 1º/2º/3º" (§2) | Com 4–5 corredores pagam só 2 lugares (70/30) | `data.js:470–481` | Atualizar o texto |
| G4 | "Ligas por Poder + MMR" (§2) | Ligas só como rótulo; rivais por alvo de Poder; sem MMR | `data.js:423`, `game.js:6070` | Esperado sem servidor; marcar como "online" no GDD |
| G5 | Plataformas "web + Play Store" (§1) | `CLAUDE.md` e `decisoes.md:560` incluem a Steam (2026-11-19) | — | Atualizar o §1 |
| G6 | Loja com peças e aba Equipamento "escondidas" (§5, l.136) | `GEAR_ON = true`: telas de peças ligadas com o selo "só AFK" (o §7 já diz isso) | `game.js:82` | Atualizar a l.136 |
| G7 | "Vitrine dos cavalos selvagens" na Expedição (§5) | Só o bloco desativado "em breve" | `game.js:3096–3102`; também `tools/wiki.mjs:358` | Atualizar o texto (GDD e wiki) |
| G8 | Fontes Press Start 2P e Jersey 10 (§5) | Build embute Nunito e Galmuri; a troca está na memória | `build.mjs:84`, `ESTADO.md:254` | Atualizar o §5 |
| G9 | "Os módulos de regra vão para o servidor" (§5 e `CLAUDE.md` §1) | Liquidação, pareamento, XP, ginásio, AFK e saneamento estão no `game.js` | `arquitetura.md` §4 | Ver ARQ-1 |
| G10 | 12 moldes "3 portes × 4 crinas" (§6) | A crina `lisa` só vale para o elemento Neutro, extinto, e como reserva; continua obrigatória na carga | `sprites.js:925–946` | Confirmar se a `lisa` ainda serve (referência de escala?) antes de qualquer mudança [I] |

Batem com o código, conferidos: status, faixas de base, pontos, custo por faixa, estrelas, Poder, chances de cruzamento,
aluguel, Corcel, marcas, portes, ginásios (nomes, etapas, entradas, prêmios, revanche, insígnias), AFK (vagas, fases,
limites offline), equipamento só no AFK, itens e loja por Ouro.

## 2. Regras do projeto em conflito entre si

| # | Conflito | Evidência | Proposta |
|---|---|---|---|
| R1 | **Para que servem as Gemas.** O `CLAUDE.md` §1 e `decisoes.md:1319` dizem "cosméticos e passe"; o GDD §2 e `decisoes.md:1254` dizem "tempo, espaço, conveniência e aparência"; o GDD §8.2 lista **Rédea, Cupom com skill escolhida, Manual garantido, acelerador de cruza, vaga extra, redefinir cruzas** por Gemas. Rédea, Cupom e Manual mudam o cavalo que corre o PVP de aposta, e "redefinir cruzas" dá mais sorteios de potro | GDD l.18, 279, 286–294; `CLAUDE.md` §1 e §8 | Decidir antes do bloco 6 e gravar uma versão só no `CLAUDE.md` §8. Sugestão: um teste de invariante "nada comprável por Gema muda o Poder nem a entrada do `simulate`" |
| R2 | "Bônus de insígnia nunca entra na simulação" (`CLAUDE.md` §8) só vale no sentido estrito: a da Capoeira aumenta a chance de aprender skill, e skill entra no Poder e na corrida; a da Fornalha cria Ouro sobre prêmios, o que o GDD l.485 já marca para rever no online | `game.js:1193`, GDD §8.6 | Decidir se a regra é "não entra no `simulate`" (cumprida) ou "não dá vantagem no PVP" (não cumprida) |
| R3 | "Ouro não se transfere entre contas" (`cronograma.md:69`) × mercado em Ouro (GDD §8.4): vender uma peça ou um cavalo a outro jogador transfere Ouro | — | Resolver na spec do mercado (bloco 7) |

## 3. Roadmap externo × realidade do projeto

O roadmap original foi escrito sem acesso ao repositório. Pontos que não batem (a versão adaptada está em
`docs/roadmap.md`):

| Roadmap supunha | Realidade |
|---|---|
| A Wiki é uma fonte independente; comparar Wiki × código | `docs/wiki.md` é **gerado do código** pelo build; a comparação útil é **GDD × código** |
| Criar `decisoes-tecnicas.md`, `problemas-conhecidos.md`, `regras-de-gameplay.md` | Já existem `docs/memoria/decisoes.md`, `bugs.md` e o `CLAUDE.md` §8 (regras invioláveis); os números ficam no wiki gerado |
| Criar um simulador automatizado de corridas (Fase 3) | **Já existe**: `prototype/tools/balance.js`, com 380 metas |
| Captura "não implementada" | Correto, mas o Manual de doma e o bestiário existem com outro papel (`sistemas.md` §5) |
| Visão "MMORPG" com mercado global estilo Albion | GDD: foco em **PVP com aposta de Ouro**; mercado só em Ouro, **modelo Black Desert** (faixa de preço, anônimo, sem troca direta), escolhido para limitar lavagem de Ouro e o risco de "jogo de azar" |
| Equipamento como variável da corrida e do balanceamento | Equipamento **só vale no AFK** (`CLAUDE.md` §8) |
| Pistas como "Prado das Palmeiras" | É só um dos 8 nomes; a pista do PVP é sorteada pela seed |
| Supabase como opção de infraestrutura | Não citado no projeto; qualquer escolha precisa manter "o servidor simula, o cliente só anima" e a seed escondida (`cronograma.md:91–98`) |
| Tutorial, áudio, cuidados/vínculo | Tutorial e som já estão no MVP do cronograma; cuidados/vínculo não aparecem em nenhum documento |

## 4. Ramos remotos fora da `main`

> **Atualizado em `recuperacao-ramos.md`:** depois desta leitura, o `youthful-maxwell` recebeu mais 3 commits
> (25/11) e apareceu o ramo `claude/salas-economia`. Os números abaixo são os da auditoria.

Dos 23 ramos `origin/claude/*`, **21 estão integrados** (zero commits fora da `main`, `git cherry` sem "+",
diff vazio). Só dois têm conteúdo próprio [C]:

**`claude/youthful-maxwell-zh7h58`** (24/11, 8 commits à frente, nenhum atrás): só **41 linhas de
`docs/memoria/decisoes.md`**, com quatro entradas de 24/11 que registram aprovações do Vinicius ("Aprovados",
"Prossiga"): etapas 4 e 5 da animação e blocos A e B do mapa; correção das subidas e 119 FPS no S24 FE; Meshy no
bake-off; arena 0 e regras de uso de Meshy, Canva, Gemini e PixelLab; ilha B. Integração por avanço direto seria trivial.

**`claude/nifty-newton-e8u133`** (18–19/11, 22 commits fora da `main`, 286 atrás). Ficou de fora porque o push foi
barrado sem um "sim" explícito. Traz:
1. **Balanço "cavalo superior vence"** (spec `2026-11-18-balanco-superioridade-design.md`): Garra v2 com piso, skills
   niveladas, clima de 3% para 2%, meta SUP e uma regra nova para o `CLAUDE.md` §8. A `main` seguiu outro caminho em 19/11
   (Garra variável, ranks, `RaceSim` 4.1.0), mas **a regra de desenho e a meta SUP não existem na `main`**.
2. **Ginásios em sequência** Capoeira → Remanso → Fornalha, com a trava "vença o anterior" (`anterior()`/`aberto()`) e
   níveis 2–10, 11–20, 21–30. **Pedido explícito do Vinicius** ("só consegue lutar com um, vencendo o anterior") que não
   está na `main`, nem no GDD, nem no ESTADO.
3. Mapa da Expedição em PixelLab (126 gerações) — **superado** pelo mapa-múndi atual.
4. Trocas de tela mais rápidas e a medição `fluidez.mjs` — talvez já não se apliquem.
5. Notas não confirmadas: "arte final sempre pelo PixelLab, 150 gerações por rodada sem perguntar" (hoje há Meshy e
   outras ferramentas) e uma conversa de desenho em aberto (o que o jogador faz, ranks, limite diário).

O ramo não pode ser integrado inteiro (conflitos grandes em `sim.js`, `data.js`, `game.js`, `ui-test.mjs`); o que valer
precisa ser refeito sobre a `main`.

## 5. Documentação desatualizada (sem impacto no jogo)

- `docs/memoria/bugs.md:25` diz que "o Poder ainda pontua Sorte"; hoje `ratingW.sorte = 0` (`sim.js:259`). O Dado
  Viciado é que ainda soma Poder.
- `docs/memoria/sistemas/galope.md` cita a cadência `13×(v/17)`; o código usa `GALOPE_QPS = 14` com a cadência "meio".
- `docs/exemplos.md` mostra P2 como 52,1% (§2) e 51,1% (§3), e o total de metas como 300, 344 e 380.
- O comentário de `prototype/tools/arte-animacao-build.mjs` diz que não lê `prototype/src/`, mas embute `ambiente.js`.
- O comentário do `TUNING` em `sim.js:239` cita "×1,08 com skill de clima"; o efetivo é 1,03 + 0,04·s(rank).
- `decisoes.md` guarda duas versões da regra das Gemas (R1), sob datas fora de ordem.
