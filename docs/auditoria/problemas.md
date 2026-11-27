# Problemas e riscos

Lista única, sem duplicatas, juntando os achados de todas as frentes. **Prioridade:** crítica (bloqueia trabalho
seguro) · alta · média · baixa. "Decisão" marca o que é escolha de design do Vinicius e não tem correção técnica.
Nada foi corrigido.

## Infraestrutura e testes

| Id | Problema | Evidência | Consequência | Prioridade | Recomendação |
|---|---|---|---|---|---|
| INF-1 | `check.sh` falha no Windows: 2 testes de moldes | `moldes-test.mjs`; a mensagem usa `\` e o teste espera `/`; os 12 JSON refeitos saem diferentes (causa [NV]) | A verificação para na etapa 5; nenhuma entrega local pode cumprir "rode o check antes de terminar" | **Crítica** | Investigar a 2ª falha (`systematic-debugging`); tornar os testes independentes do separador |
| INF-2 | Build não é reprodutível no Windows | `core.autocrlf=true` e sem `.gitattributes`: o texto da licença OFL entra com `\r\n` em `dist/*.html` | Rodar o build e commitar no Windows muda 9 arquivos gerados sem mudança de regra; o aviso da etapa 4 vira ruído | **Crítica** | `.gitattributes` com `eol=lf` para `src`, `assets` de texto e `dist`, ou normalizar no `build.mjs` |
| INF-3 | Playwright implícito, sem `package.json` | `ui-test.mjs:30`; aqui: `Cannot find module 'playwright'` | wiki-test e ui-test (83 blocos, incluindo travas do PVP e saves) não rodam localmente | **Alta** | Decidir como fixar a versão (um `package.json` só de dev ou instruções); **é dependência nova: pede aprovação** |
| INF-4 | Sem CI | não há `.github/` | Tudo depende de rodar ~12 min à mão | Média | GitHub Actions rodando `check.sh` em Linux (depois de INF-1 a INF-3) |
| INF-5 | Metas críticas fora do `check.sh` | M6, M9, P1, S1, A1 e G1–G7 só no `balance.js` completo (`bugs.md:24`) | Regressão de balanceamento passa no check | Média | Manter a regra do `CLAUDE.md` (rodar o completo ao mexer em número) e pôr o completo no CI |
| INF-6 | Determinismo só testado no mesmo motor JS | `balance.js` §9 | Cliente e servidor podem divergir no futuro | Média | Arquivo de hashes de referência conferido em Node e em navegador |

## Persistência e integridade

| Id | Problema | Evidência | Consequência | Prioridade | Recomendação |
|---|---|---|---|---|---|
| PER-1 | Migração grava por cima **sem cópia**; `sanitize` **descarta em silêncio** cavalo ou peça inválidos | `game.js:8800`; `game.js:1068–1071` (peça cujo id saiu de `GD.GEAR`) | Um erro de migração ou de catálogo apaga progresso sem volta | **Alta** | Cópia `:pre-v<N>` antes de migrar e aviso quando o saneamento descartar algo |
| PER-2 | Sem armazenamento, o jogo roda em memória **sem avisar** | `game.js:541–558` (`persist()` devolve true) | Perde tudo ao fechar (navegação privada, bloqueio de cookies) | Média | Faixa de aviso |
| PER-3 | Sem exportar/importar save | — | Limpar o navegador apaga tudo; o teste fechado fica frágil | Média | Exportar/importar em texto no Perfil. **Feito (T7, 2026-11-27).** Novo risco aceito offline (decisão A): restaurar um código antigo volta no tempo (recupera a entrada de uma corrida perdida); no online, a importação sai ou vira migração única |
| PER-4 | O snapshot do `hot` vence o disco sem comparar `rev` | `game.js:8789–8790` | Raro: a primeira ação depois de recarregar pode ser descartada | Baixa | Comparar `rev` no `start` |
| PER-5 | Relógio adiantado rende (diária, loja, revanche, um período do AFK por adiantamento) | `game.js:1245,1256,4040–4067`; aceito no GDD §8.2a | Aceito offline; **inaceitável** com Ouro compartilhado | Alta no online | Hora do servidor (Fase 5) |
| PER-6 | Seed base no save local | `game.js:211,6039`; `cronograma.md:91–98` | Resultado previsível pelo console antes de pagar | Alta no online | Seed no servidor ou compromisso e revelação |
| PER-7 | `jogo-teste.html` mantém `?dev=1` e Ouro infinito | `dist/jogo-teste.html` | Testador com a query tem a gaveta DEV (save separado) | Baixa | Decidir se o build dos testadores deve tirar o DEV |

## Arquitetura e desempenho

| Id | Problema | Evidência | Consequência | Prioridade | Recomendação |
|---|---|---|---|---|---|
| ARQ-1 | Regra aplicada na interface | `settle` l.6301, `buildLobby` l.6037, `applyXp` l.1198, `desafia` l.3329, `afkAcerto` l.4037, `sanitize` l.864–1210 | O plano "levar os módulos de regra ao servidor" não leva liquidação, pareamento nem saneamento; essas partes só se testam pelo navegador | Alta (antes do servidor) | Extrair, **sem mudar comportamento**, um módulo puro de domínio, um sistema por vez, com teste de equivalência |
| ARQ-2 | `game.js` com 8.895 linhas | — | Manutenção e conflitos de merge | Média | Consequência de ARQ-1; não reorganizar sem plano (`CLAUDE.md` §9) |
| ARQ-3 | `prototype/index.html` desatualizado | faltam 4 scripts e a arte; `game.js:7065` usa `window.Luz` | Quem abrir por ele vê o jogo quebrado [I] | Baixa | Gerar pelo build ou remover |
| ARQ-4 | `TRAINING_GOLD` fora do `data.js` | `game.js:84` | Número de economia escondido do wiki e do balanço | Baixa | Mover para `GameData` junto com ARQ-1 |
| DES-1 | `jogo.html` com 2,59 MB de base64; repositório de 204 MiB | `ls`, `git count-objects`; o `jogo.html` está em 283 commits | Tempo de abertura no celular **não medido**; clonar fica caro | Alta (medir) | Medir a primeira tela num aparelho médio antes de decidir; avaliar `dist/` fora do git ou LFS (**decisão**: hoje o dist versionado é regra) |
| DES-2 | `innerHTML` da tela inteira a cada toque | `game.js:8702` | Escala mal com inventário grande [I] | Baixa | Só se medir lentidão |

## Corrida e balanceamento

| Id | Problema | Evidência | Consequência | Prioridade | Recomendação |
|---|---|---|---|---|---|
| COR-1 | Dicas de estratégia sem ação possível | `strategyTips` (`game.js:6172`) aparece na sala aberta; trocar a ativa está travado (`motivoAtivar`, l.2843; pontos l.5255) | A pergunta central do protótipo ("estratégia pré-corrida é divertida?") não pode ser testada | **Alta — decisão** | Decidir a Preparação (GDD §8.1) ou outra forma de escolha antes da sala; até lá, rever o texto das dicas |
| COR-2 | Efeito do clima descrito como "+3%", mas é aditivo | G1 em `divergencias.md` | Expectativa errada do jogador | Média — decisão | Escolher a regra; alinhar o texto |
| COR-3 | Sorte e Dado Viciado quase sem efeito (0,7 p.p. e 0,2–1,5 p.p.), mas o Dado Viciado ocupa vaga e soma Poder | `exemplos.md`; `sim.js:511` | Skill "armadilha"; Poder superestima esse cavalo | Média — decisão | Decidir o papel da Sorte |
| COR-4 | Build equilibrada do bot domina no nível 50 (60–65%) | `exemplos.md` §2 e §6 (em aberto) | Distribuir melhor não bate o bot da liga | Média — decisão | Já é desenho declarado no GDD §8.5; confirmar se continua |
| COR-5 | O balão descobre a skill pelo texto do evento | `fx.js:430–436`; o evento `skill` não traz `skillId` (`sim.js:1109`) | Mudar o texto quebra o balão | Baixa | Incluir `skillId` no evento (muda `simVersion`? conferir; não muda resultado) |
| COR-6 | VENTO no HUD com o mesmo peso do CLIMA, sem efeito | `drawHud` | Jogador pode achar que o vento conta [I] | Baixa | Marcar o vento como cenário ou rebaixar visualmente |

## Cavalos e animação

| Id | Problema | Evidência | Consequência | Prioridade | Recomendação |
|---|---|---|---|---|---|
| CAV-1 | Ficha mostra o nome **gravado no nascimento** dos pais, sem `#uid` | `paiHtml` (`game.js:5452–5455`); nomes de potro repetem | Depois de renomear, ou com nomes iguais, a linhagem fica ambígua | Média | Mostrar o nome atual e o `#n` quando o pai estiver no estábulo |
| CAV-2 | `born: 0` para iniciais, catálogo **e** o primeiro potro | `game.js:702`; `breedCounter` começa em 0 | O campo não diz a origem | Baixa | Campo de origem explícito (mexe no save: **pede aprovação**) |
| CAV-3 | Entradas de seed de sistemas diferentes podem coincidir | skill por nível `hash2(seedBase, seedTag·100+nível)` × potro `0xB0B0+n` (ex.: 45232 = 0xB0B0) | Sequências correlacionadas; não explorável hoje [I] | Baixa | Separar os domínios antes do servidor (já pedido em `cronograma.md:97`) |
| CAV-4 | Sem caminho real para Mítico | despertar não implementado; Míticos só selvagens, escondidos | Raridade máxima só pelo DEV [I] | Baixa — decisão | Faz parte das Expedições/captura |
| CAV-5 | Defeitos de moldes aceitos (pele do jóquei, pendências 2a, cor fora da paleta) | `moldes-test.mjs:571–670`, `bugs.md` | Inconsistência visual em parte dos cavalos | Média | Próximo lote pago (**gasta créditos: pede aprovação**) |
| CAV-6 | Sem trote; galope de 9 quadros de intensidade moderada | `ambiente.js:601`; `sistemas/galope.md` | Limita o checklist do galope do roadmap | Baixa — decisão | Avaliar quando houver orçamento de arte |
| CAV-7 | Lógica de idle e de galope duplicada fora do jogo | `ambiente.js:604–622` × `sprites.js:1567+`; `corrida-amostra.html` com galope a 21 q/s | Amostras divergem do jogo | Baixa | Marcar as amostras como históricas ou gerá-las do `src/` |

## Economia

| Id | Problema | Evidência | Consequência | Prioridade | Recomendação |
|---|---|---|---|---|---|
| ECO-1 | Regra das Gemas contraditória; o GDD §8.2 vende poder por Gemas | R1 em `divergencias.md` | Caminho indireto Gema → poder no PVP → Ouro; risco de classificação | **Alta — decisão** | Decidir antes do bloco 6; teste de invariante |
| ECO-2 | Insígnias com efeito indireto no PVP e Ouro criado | R2 em `divergencias.md` | Ambíguo hoje; problema no online | Média — decisão | Definir o sentido da regra |
| ECO-3 | Treino paga 10–30 de Ouro sem entrada, sem limite | `game.js:84,6318` | Torneira limitada só pelo tempo | Baixa | Medir contra a meta E1 |
| ECO-4 | Sequência dos ginásios pedida e perdida | `divergencias.md` §4 | Progressão diferente da que o Vinicius pediu | Média — decisão | Decidir se volta; se sim, refazer sobre a `main` |

## Documentação

| Id | Problema | Evidência | Prioridade | Recomendação |
|---|---|---|---|---|
| DOC-1 | GDD desatualizado (G3, G5–G8) | `divergencias.md` §1 | Média | Um ticket só de texto |
| DOC-2 | Memória e comentários desatualizados | `divergencias.md` §5 | Baixa | Um ticket só de texto |
| DOC-3 | Aprovações de 24/11 só no ramo `youthful-maxwell` | `divergencias.md` §4 | Média | Levar à `main` (decisão de integração) |
