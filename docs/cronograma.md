# Cronograma do projeto e checklist de lançamento

_Atualizado em 2026-11-10 (pente fino). Regras de loja e leis mudam: confira cada item na fonte
oficial antes de publicar. Itens marcados "(conferir)" vieram de busca, não do texto oficial._

## Onde estamos
Fase **2, Protótipo**. **Ainda não é hora de publicar no Google Play.** O jogo roda offline contra
bots, com save no navegador. A tecnologia está escolhida (2026-11-10): o protótipo vira o jogo, a
mesma base web empacotada para Android, com os módulos de regra indo para o servidor. Para publicar
faltam: fechar o escopo da 1ª versão, empacotar, documentos legais, conta de desenvolvedor e o teste
fechado obrigatório.

## Fases
| # | Fase | O que sai dela | Situação |
|---|---|---|---|
| 1 | Ideia | conceito e pilares no `docs/GDD.md` | feita |
| 2 | Protótipo | resposta a "a corrida automática com aposta é divertida?" | **aqui** |
| 3 | MVP | jogo completo do começo ao fim, escopo travado, tecnologia escolhida | — |
| 4 | Produção | conteúdo, som, servidor, contas | — |
| 5 | Teste | teste fechado no Play, beta na web | — |
| 6 | Lançamento | página da loja, build com tag `vX.Y.Z` | — |
| 7 | Pós-lançamento | correções, temporadas, ouvir jogadores | — |

## Caminho até o Play (estimativa para uma pessoa; semanas corridas)
| Etapa | O que fazer | Duração | Depende de |
|---|---|---|---|
| 0. Fechar o protótipo | 5 a 10 pessoas jogam; decidir o empacotador e a ordem das frentes (branches integradas, tecnologia e escopo da 1ª versão decididos em 2026-11-10) | 1–2 | decisões do Vinicius |
| 1. MVP | blocos 1 e 2 do redesenho (`docs/GDD.md` §8: status e tipo; pista e preparação), tutorial e som | 4–8 | etapa 0 |
| 2. Empacotar e documentar | pacote Android (TWA ou Capacitor), alvo de API vigente, AAB, ícone e capturas, política de privacidade, questionário de classificação, Segurança dos dados | 2–3 | pode correr junto com a 1 |
| 3. Teste fechado | 12 testadores inscritos por 14 dias seguidos, depois pedido de acesso à produção | 3 | conta criada e etapa 2 |
| 4. Online | servidor que simula a corrida, contas, PVP assíncrono, ranqueada por temporada | 8–12 | etapa 1 |
| 5. Loja e social | compra de Gemas, mercado entre jogadores em Ouro, chat com moderação | 4–6 | etapa 4 |

**Decidido em 2026-11-10:** o teste fechado sai com o jogo offline (contra bots, sem contas nem
compras), em cerca de **5–7 semanas**, e o lançamento público espera o PVP assíncrono (etapa 4). As
etapas 1 a 3 valem para o teste fechado; a 4 corre em paralelo com ele. Durante o teste entram, como
atualizações, os blocos 4 a 6 do redesenho (itens de treino e gastos de Ouro; cruza com relógio,
circuito ocioso e aluguel; loja de Gemas sem compra real). A conta de
desenvolvedor e o recrutamento dos 12 testadores podem começar já: são o que mais atrasa.

## Checklist de publicação

### Conta e processo
- [ ] Conta de desenvolvedor do Play (US$ 25, documento oficial; conta pessoal nova exige o teste
      fechado abaixo). Verificação de desenvolvedor Android, obrigatória no Brasil desde 30/09/2026 (conferir).
- [ ] Teste fechado: 12 testadores inscritos por 14 dias seguidos, para cada app novo. Recrutar com folga.
- [ ] Ficha da loja: ícone 512 px, imagem de destaque 1024×500 (`docs/capa.png` já tem esse tamanho), capturas.

### Técnico
- [ ] Pacote AAB com assinatura do Play; alvo Android 16 / API 36 (exigido desde 31/08/2026, conferir).
- [ ] Empacotamento: TWA (exige PWA instalável, HTTPS e vínculo de domínio) ou Capacitor (arquivos
      dentro do pacote, offline de verdade). Sem código nativo próprio, a regra de páginas de 16 KB não pesa.
- [ ] Build de aplicativo: fontes embutidas (hoje vêm do Google Fonts), viewport e idioma no HTML,
      botão "voltar" do Android, código minificado pela ferramenta da tecnologia escolhida.
- [ ] Testado em aparelho real fraco: a corrida deve segurar 30 quadros por segundo.
- [ ] `./scripts/check.sh` (ou a verificação da tecnologia final) passando; versão e tag criadas.

### Legal e política
- [ ] Política de privacidade publicada (obrigatória mesmo sem coletar dados) e formulário Segurança dos dados.
- [ ] Classificação etária (IARC) respondida com sinceridade: há aposta de moeda virtual
      ("jogo de azar simulado"). Esperar 12+ a 18+ conforme o país; público-alvo 13+ ou mais, fora do programa Famílias.
- [ ] LGPD: coleta mínima, canal de contato, nada de perfil publicitário de menores.
- [ ] Se houver contas: excluir a conta dentro do jogo e por um link na web.
- [ ] Declaração de IA: no Play, só para apps que geram conteúdo com IA (conferir); para a Steam,
      usar `docs/memoria/assets.md`.

### Específico deste jogo
- [ ] **Ouro sem valor real, por escrito e no código:** não se compra, não se saca, não se transfere
      entre contas, e nada pago com Gemas rende Ouro (nem pedra, peça ou cavalo que se venda por Ouro).
- [ ] **Caixas de recompensa pagas:** proibidas no Brasil em jogo de acesso provável por menores
      (Lei 15.211/2025, art. 20, em vigor desde 17/03/2026). Decisão já tomada: pacote de montaria só
      com moeda ganha jogando; Gemas só para cosméticos e passe. Confirmar com advogado antes de vender qualquer item aleatório.
- [ ] **Chances visíveis antes de pagar** em tudo que tem sorteio (cruzamento e melhoria de peça já mostram).
- [ ] **Aposta de espectador:** risco alto de classificação 18+ e de recusa; adiar ou cortar.
- [ ] Chat e hub social: denunciar, bloquear, filtro de palavras, opção de desligar para menores.

### Web
- [ ] Hospedagem com HTTPS; testado em Chrome, Firefox, Safari (iOS) e Android.

### Steam (se entrar no escopo)
- [ ] Página publicada cedo; declaração de IA do conteúdo que o jogador vê ou ouve; teste no Steam Deck.

## O que o servidor precisa ter (achados do pente fino)
O save local é editável e a seed fica nele: hoje dá para prever corrida, potro e melhoria pelo
console. Vale para o protótipo, não para PVP nem ranking. No servidor:
- a seed nunca vai ao cliente antes do resultado (ou usa compromisso e revelação);
- cavalo e equipamento são montados a partir de ids e níveis guardados no servidor, nunca do que o cliente manda;
- cada sorteio usa uma seed de domínio próprio (corrida, potro, melhoria, pedra do pódio);
- o resultado guarda a versão da simulação (`simVersion`, `tuningHash`) para auditar corridas antigas.

## Roteiro de evolução
O redesenho dos cavalos e da economia foi aprovado em 2026-11-10 e está no `docs/GDD.md` §8, com a
ordem dos sete blocos. Além dele, ficam como propostas para a fase online:
1. **PVP assíncrono.** Como a corrida é automática e sai da seed, o rival pode ser o "fantasma" do
   cavalo de outro jogador: sem sala de espera, sem tempo real, servidor simples.
2. **Ranqueada com Elo por temporada.** Elo em pares adaptado a 4–8 corredores, com todos no mesmo
   nível, para medir a escolha de cavalo e de build, não o tamanho da conta. Sem entrada em Ouro.
3. **Skills que olham os rivais** (vácuo, perseguidor, líder) e skills que atrapalham: só depois do
   teste fechado, com dados de jogadores.
4. **Balanceamento contínuo.** Metas automáticas no `balance.js`; depois, telemetria real e ajuste por temporada.
5. **Expedições** (já planejadas): mundos por bioma, batalha por turnos com modo automático e manual.
