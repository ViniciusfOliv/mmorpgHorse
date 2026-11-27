# T5 — Cópia do save antes de gravar por cima e aviso de descarte (spec curta)

> **Status: implementada em 2026-11-27 ("Pode implementar").** Ticket T5 do `docs/auditoria/plano-fase-1.md`, problema
> PER-1 do `docs/auditoria/problemas.md`.

## 1. Como era

- Save de versão antiga (abaixo de `SAVE_VERSION`, hoje 10) era migrado e gravado por cima na hora, sem cópia.
- O `sanitize` tirava em silêncio cavalo ou peça que não se lê (elemento ou raridade inválidos, uid repetido, peça
  fora do catálogo de `GD.GEAR`); na gravação seguinte eles sumiam de vez.
- Só o save ilegível (JSON quebrado) já tinha cópia (`:corrompido`) e aviso.

## 2. Regra nova (`game.js`, `start`)

- **Cópia:** antes de gravar por cima um save **migrado** ou um de que o `sanitize` **tirou** algo, o texto original do
  disco vai para `SAVE_KEY + ':pre-v<N>'` (N = versão do save lido; ex.: `galope-elemental:v1:pre-v9`). Uma cópia por
  versão, a mais recente. O jogo nunca lê essa chave: ela existe para recuperar à mão.
- **Aviso:** se o `sanitize` tirou algo, o Estábulo avisa uma vez: *"1 cavalo e 1 peça do seu save não puderam ser lidos
  e ficaram de fora. Uma cópia do save original foi guardada."* (com concordância de número e gênero). A gravação logo
  em seguida tira o que não se leu, então recarregar não avisa de novo.
- **Sem espaço para a cópia:** a migração e o saneamento seguem como antes e o aviso termina em *"Não foi possível guardar
  uma cópia do save original."*

## 3. O que não muda

Formato do save e `SAVE_VERSION`; o save que se lê inteiro não ganha cópia nem aviso; o modo DEV usa as chaves dele
(`galope-elemental:dev:pre-v<N>`); nenhuma regra de jogo.

## 4. Como provar

Bloco `copia-save` do `ui-test.mjs`: save v4 migra e deixa `:pre-v4` igual ao original, sem aviso de descarte; save da
versão atual normal não cria cópia; save atual com um cavalo e uma peça inválidos avisa, guarda `:pre-v10`, grava sem
eles e não avisa ao recarregar; sem espaço, o aviso diz que a cópia não foi guardada. Conferido também que o bloco
falha com a cópia desligada.
