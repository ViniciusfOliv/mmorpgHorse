# T6 — Aviso sem armazenamento (spec curta)

> **Status: implementada em 2026-11-27 ("Pode implementar").** Ticket T6 do `docs/auditoria/plano-fase-1.md`, problema
> PER-2 do `docs/auditoria/problemas.md`.

## 1. Como era

Na carga, o `game.js` testa o `localStorage` (`STORAGE_OK`). Sem ele (navegação anônima de alguns navegadores, dados do
site bloqueados, iframe sem acesso), o `persist()` devolve "gravou" sem gravar nada: o jogo roda só em memória e perde
tudo ao fechar, sem avisar.

## 2. Regra nova (`game.js`, `avisoArmazenamentoHtml`)

- Com `STORAGE_OK` falso, um aviso de perda fica à vista: *"Este navegador não está guardando o seu progresso (navegação
  anônima ou dados do site bloqueados). Ao fechar a página, tudo se perde."*
- **Onde:** no topo do conteúdo de toda tela com casca (cabeçalho e abas: Estábulo, Correr, Perfil...) e na escolha do
  1º cavalo. Não aparece nas telas cheias (corrida, desafio, resultado), para não cobrir a animação.
- Sem botão de fechar: o risco dura enquanto a página estiver aberta.
- **Visual:** o `.aviso.aviso--perda` que o jogo já usa; nas telas com casca, a largura da `.tela` (520 px) e o mesmo
  espaço abaixo (`game.css`, `.aviso-armazenamento`). Não é faixa fixa como a do modo DEV.

## 3. O que não muda

O save, o `persist()`, as regras de jogo e tudo com armazenamento normal (sem aviso).

## 4. Como provar

Bloco `sem-armazenamento` do `ui-test.mjs`: com o acesso ao `localStorage` lançando, o aviso aparece à vista na escolha
do 1º cavalo, no Estábulo e no Perfil, e não na corrida; sem rolagem horizontal. Com armazenamento, não aparece.
Conferido também que o bloco falha com o aviso desligado e com o aviso sempre ligado.
