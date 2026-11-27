# T7 — Exportar e importar o progresso (spec curta)

> **Status: implementada em 2026-11-27 ("Pode implementar"); decisão da seção 5: A (Vinicius, 2026-11-27).** Ticket T7 do `docs/auditoria/plano-fase-1.md`, problema
> PER-3 do `docs/auditoria/problemas.md`. Hoje o único lugar do progresso é o armazenamento do navegador: quem limpa o
> navegador, troca de aparelho ou de navegador perde tudo. Para o teste fechado, isso é frágil.

## 1. A ideia

Um **código de progresso** em texto: o jogo mostra, o jogador copia e guarda onde quiser (bloco de notas, mensagem para
si mesmo) e, para restaurar, cola o código de volta. Só texto, como pede o ticket: o jogo roda num artefato do
claude.ai, onde baixar arquivo e escolher arquivo podem estar bloqueados, e o texto funciona em qualquer lugar.

## 2. Exportar (Perfil → nova caixa "Cópia do progresso")

- O botão **"Mostrar código do progresso"** abre um campo de texto só de leitura com o código, e o botão **"Copiar"**.
  - O "Copiar" usa a área de transferência do aparelho. Se o navegador não deixar (o artefato pode bloquear), o texto do
    campo fica todo selecionado e a nota diz "Copie o texto selecionado".
  - Uma nota diz o que é: *"Guarde este código fora do jogo. Com ele, você restaura o progresso deste momento neste ou
    em outro aparelho."*
- O código é o save de agora, **como está gravado**, mais o formato abaixo. Nada do save muda por exportar.
- **Formato:** `GALOPE1.` + o save em base64 + `.` + uma soma de conferência de 8 dígitos hexadecimais.
  - O prefixo diz que é um código do jogo (e de que formato, para uma versão futura saber ler).
  - A soma só pega **código cortado ou com erro de cópia**. Ela não protege contra edição, e nem tenta: quem quiser editar
    o save offline já consegue pelo navegador (o ticket aceita esse risco offline).
  - Tamanho: um save novo dá uns 3 KB de código; um save grande, algumas dezenas de KB. O campo de texto aguenta.

## 3. Importar

**Onde:**
- No Perfil, na mesma caixa: **"Restaurar de um código"**.
- Na **escolha do 1º cavalo**, um botão **"Tenho um código de progresso"**. É a tela que aparece para quem limpou o
  navegador ou trocou de aparelho, justamente quem precisa restaurar.

**Como, passo a passo:**
1. Um campo para colar o código e o botão **"Conferir"**.
2. O jogo confere, nesta ordem, e recusa com uma frase clara, sem mexer em nada:
   - não é um código do jogo (sem o `GALOPE1.`): *"Isto não é um código de progresso do Galope Elemental."*
   - a soma não bate (cortado ou com erro): *"O código está incompleto ou com erro. Copie de novo, inteiro."*
   - save de uma versão mais nova do jogo (a mesma checagem da tela de bloqueio): *"Este código é de uma versão mais nova
     do jogo. Atualize a página e tente de novo."*
   - não vira save (o mesmo `sanitize` de sempre devolve nada): *"Não foi possível ler este código."*
3. Se passar, um **resumo do que vai entrar**: cavalos (quantos e o ativo, com nível), Ouro, corridas e vitórias,
   insígnias. Se o saneamento deixou algo de fora, o resumo diz quantos cavalos ou peças (o mesmo texto do aviso do T5).
4. **Confirmação**: *"Substituir o progresso deste aparelho por este? O progresso atual será guardado numa cópia."*, com
   "Sim, substituir" e "Cancelar". Na escolha do 1º cavalo (sem progresso), a frase é só *"Restaurar este progresso?"*.
5. Ao confirmar:
   - o save atual do aparelho (se houver) vai para a chave `galope-elemental:v1:antes-importar` (uma cópia, a mais
     recente), como a cópia `:pre-v<N>` do T5; o jogo nunca lê essa chave;
   - o save do código, já saneado e migrado (um código antigo passa pela mesma migração de sempre), é gravado com a
     revisão acima da do disco, para outra aba aberta adotar o novo, e não gravar o antigo por cima;
   - o jogo volta ao Estábulo com o aviso *"Progresso restaurado."* (mais o aviso da migração, se o código for de antes
     da v6, como ao abrir).

## 4. O que não muda

- O formato do save e a `SAVE_VERSION` (continua 10), o `sanitize` (o `save.js` do T16), as regras de jogo.
- O modo DEV continua com o save dele: o código exportado no DEV é do save de teste; importado no jogo normal, os campos
  só do DEV caem no saneamento, como já caem hoje.
- Nada é enviado para fora do aparelho: o código só sai se o jogador copiar.

## 5. Decisão (regra de jogo): **A**, escolhida pelo Vinicius em 2026-11-27

**Exportar e importar deixa "voltar no tempo" fácil:** exportar, correr valendo, perder e importar o código de antes
recupera o Ouro da entrada. Isso esbarra na regra "sala não pode ser re-sorteada de graça" (CLAUDE.md §8). Hoje dá para
fazer o mesmo editando o armazenamento pelo navegador, mas com o botão vira coisa de um toque.

- **A (recomendo para agora):** aceitar enquanto o jogo é offline. O código serve para o teste fechado e para não perder
  progresso. Quando o online chegar, o progresso passa a morar no servidor e a importação sai ou vira uma migração única
  da conta. Fica escrito no `decisoes.md` e nos riscos (PER-3).
- **B:** importar só na escolha do 1º cavalo, quando não há progresso no aparelho. Atrapalha o "voltar no tempo" (para
  voltar, teria de apagar o progresso antes), mas continua possível, e quem quiser só trocar de aparelho não perde nada.
- **C:** como A, mas um código com sala aberta (páreo pago e não corrido) entra com a sala como está: a mesma seed e a
  mesma entrada, sem re-sorteio. Isso já é o que o `sanitize` faz hoje, então vale para A e B de qualquer jeito.

## 6. Como provar

- **Node:** a codificação e a leitura do código (prefixo, base64 com acentos, soma) num módulo puro, com testes: ida e
  volta igual, código cortado, um caractere trocado, prefixo errado, lixo.
- **Interface (novo bloco `progresso-codigo` do `ui-test.mjs`):**
  - exporta no Perfil, abre um navegador limpo, importa pela escolha do 1º cavalo e confere que o save gravado é o mesmo
    que o `sanitize` daria;
  - importa por cima de um progresso no Perfil e confere a cópia `:antes-importar` e o aviso;
  - recusa as quatro formas de código ruim sem tocar no save;
  - "Cancelar" não muda nada;
  - outra aba aberta adota o progresso importado;
  - sem rolagem horizontal a 360 px; foco e leitor de tela nos campos e avisos.
- `check.sh` completo.

## 7. Arquivos

`prototype/src/save.js` (o código: `Save.codigo`, `Save.lerCodigo`), `prototype/src/game.js` (as telas e a gravação),
`prototype/src/game.css` (o campo de texto), `prototype/tools/ui-test.mjs`, os testes em Node, o wiki (o Perfil) e a
memória.
