# Auditoria técnica — Fase 0 (2026-11-25)

> **O que é:** retrato do projeto feito **só por leitura**, a pedido do Vinicius, antes de qualquer mudança da Fase 1
> do `docs/roadmap.md`. Nada de código, regra, balanceamento ou save foi alterado. Base: `main` em `36502f32`
> (2026-11-24), lida no ramo `docs/auditoria-fase-0`.
>
> **Não substitui** `CLAUDE.md`, `docs/GDD.md` nem `docs/memoria/`: aponta onde eles e o código concordam ou divergem.
> Achados que virarem decisão vão para `docs/memoria/decisoes.md`; bugs confirmados, para `docs/memoria/bugs.md`.

## Arquivos

| Arquivo | Conteúdo |
|---|---|
| `README.md` | este índice, o resumo e a linha de base dos testes |
| `arquitetura.md` | mapa de pastas, build e entrada, telas/estado/render, persistência, testes, desempenho |
| `sistemas.md` | cada sistema do jogo com o estado de implementação, a regra real e a evidência |
| `divergencias.md` | GDD × código, regras × roadmap, documentação desatualizada, ramos fora da `main` |
| `problemas.md` | lista única de problemas e riscos (sem duplicatas), com prioridade e recomendação |
| `plano-fase-1.md` | proposta da Fase 1 em tickets pequenos, ordenados por dependência — **aguarda aprovação** |
| `recuperacao-ramos.md` | Etapa 1 (D6): o que os ramos `youthful-maxwell`, `nifty-newton` e `salas-economia` têm fora da `main`, conflitos e perguntas — **aguarda revisão** |
| `decisoes-produto.md` | Etapa 2: decisões D1–D9 (e D10–D15 menores) com alternativas, prós e contras, recomendação e impactos — **aprovação uma a uma** |
| `tickets-t1-t2.md` | Etapa 3: diagnóstico da quebra de linha e dos moldes; tickets T1 e T2 com ramo, arquivos, aceite, regressão e reversão — **aguarda aprovação** |

## Legenda de evidência

**[C]** confirmado no código · **[G]** documentado no GDD/CLAUDE.md · **[M]** documentado na memória ou numa spec ·
**[I]** inferência · **[NV]** não verificado. Linhas citadas como `arquivo:linha` valem para `36502f32`.

Estados de sistema: **Funcional** (implementado e funcionando) · **Parcial** · **Documentado, não implementado** ·
**Apenas planejado** · **Não encontrado**.

## Resumo executivo

O projeto **não é um protótipo vazio**: são 713 commits, ~25 mil linhas em `prototype/src/`, ~28 mil linhas de testes,
um simulador de balanceamento com 132 metas no modo rápido (380 no completo) e documentação de design extensa. As
regras de jogo moram em módulos puros e determinísticos (sem DOM, sem `Math.random`, sem relógio), o save tem versão,
migração, detecção de corrupção e gravação atômica por ação, e as regras invioláveis do `CLAUDE.md` §8 estão, em
quase tudo, cobertas por código **e** por teste.

Os pontos que mais pesam, em ordem:

1. **A verificação não roda inteira nesta máquina (Windows).** O `check.sh` para na etapa 5 (2 falhas de ambiente nos
   moldes), o build gera `dist/` diferente do commitado (quebra de linha CRLF) e o Playwright não está instalado
   (wiki e interface não rodam). Sem isso, nenhuma entrega da Fase 1 cumpre a "definição de pronto". → `problemas.md` INF-1 a INF-3.
2. **A regra das Gemas está escrita de dois jeitos.** O `CLAUDE.md` §1 diz "Gemas: cosméticos e passe"; o GDD §8.2
   lista Rédea, Cupom com skill escolhida, Manual garantido, acelerador e "redefinir cruzas" por Gemas — itens que
   mexem no Poder do PVP de aposta, ou seja, um caminho **indireto** de Gema para Ouro. Nada disso existe no código
   ainda; é preciso decidir antes do bloco 6. → ECO-1.
3. **A hipótese central do protótipo não pode ser testada como está.** O `CLAUDE.md` §2 pergunta se a "estratégia
   pré-corrida" é divertida, mas a sala dá dicas ("muitas curvas: Manobra…") num momento em que trocar a montaria
   está bloqueado, e a Preparação (GDD §8.1) não existe. → COR-1.
4. **Save sem rede de segurança na migração.** A migração grava por cima sem cópia, e o saneamento descarta cavalo
   ou peça inválidos em silêncio. → PER-1.
5. **Regra de jogo dentro do `game.js`.** Liquidação do PVP, pareamento, XP, ginásio, AFK e saneamento estão na
   interface; levar "os módulos de regra" ao servidor não leva isso junto. → ARQ-1.
6. **Trabalho pedido que não chegou à `main`:** a sequência dos ginásios ("vença o anterior") e a regra "cavalo
   superior vence", no ramo `claude/nifty-newton-e8u133`. → `divergencias.md` §4.

"Galope Animado" é o `<title>` de `prototype/arte/animacao.html` / `animacao-amostra.html`: uma amostra de
**animação ambiente** (cenas e idle), sem galope, fora do build do jogo mas reaproveitando `src/ambiente.js`.
Detalhes em `sistemas.md` §6.

## Linha de base dos testes (2026-11-25, Windows 11, Node 24.20.0)

Antes de rodar, o `scripts/check.sh` foi lido: grava só em pasta temporária (`mktemp`), não toca nas capturas
oficiais, os testes de moldes bloqueiam a rede e não chamam a API paga; o único efeito no repositório é o build
regenerar `prototype/dist/` e `docs/wiki.md` (desfeito depois com `git restore`, árvore limpa).

| Etapa | Resultado | Observação |
|---|---|---|
| 1. Build | ok | mas **mudou 9 arquivos versionados** de `dist/` e `docs/wiki.md` (ver INF-2) |
| 2. Simulação e AFK | ok | |
| 3. Efeitos e mapa | ok | |
| 4. dist em dia | **aviso** | consequência da etapa 1 |
| 5. Moldes e arte | **FALHA: 237 testes, 2 falhas** | o `check.sh` para aqui (≈45 s) |
| 6. Wiki (rodada à parte) | **não roda** | `Cannot find module 'playwright'` |
| 7. Balanceamento rápido (à parte) | **ok: 132 metas passaram** (35 s) | |
| 8. Interface (à parte) | **não roda** | `Cannot find module 'playwright'` |

As 2 falhas da etapa 5:
- *"CLI: --escolher e --guia-mestre sem rede…"* — a mensagem sai com `prototype\assets\pixellab\novos/` e o teste
  espera `/`: separador de caminho do Windows. [C]
- *"o registro do lote refaz os 12 moldes do jogo byte a byte"* — os 12 `molde-*.json` refeitos saem diferentes dos
  commitados. Causa **não verificada**; a hipótese mais provável é também de ambiente (caminho ou quebra de linha
  dentro do JSON), já que o histórico registra o `check.sh` completo passando em 2026-11-24 no contêiner. [I]

Nenhuma falha foi corrigida nesta etapa. Registro completo do log: fora do repositório (pasta temporária da sessão).
