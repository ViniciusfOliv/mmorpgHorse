# Estado do projeto

_Atualizado em 2026-11-11._

**Fase:** Protótipo, a caminho do MVP. **Ainda não é hora de publicar no Play**; o caminho, as
durações e o checklist estão em `docs/cronograma.md`. **Tecnologia decidida (2026-11-10):** o
protótipo vira o jogo, a mesma base web empacotada para Android, com os módulos de regra no servidor.

## Onde estamos
- **Branches:** a `main` tem tudo até o pente fino (2026-11-10). Em aberto: `claude/cavalos-v3`
  (bloco 1 do redesenho implementado, a integrar na `main` depois da revisão) e `claude/empacotamento`
  (em pausa, só com as decisões iniciais; volta como bloco 3).
- **Onde jogar** (artefatos privados do claude.ai; republicar depois de cada build):
  - jogo de produção, sem modo DEV: https://claude.ai/artifact/MKTKQUYmzBNun92abFzygn (`prototype/dist/jogo.html`)
  - build de teste com modo DEV: https://claude.ai/artifact/LiMr2cM7FRgFZqJ6dFHPhU (`prototype/dist/jogo-dev.html`)
  - wiki: https://claude.ai/artifact/Bp47f9qE3tSswu1A9zdF2y (`prototype/dist/wiki.html`)
  - no computador: `prototype/dist/preview.html` (com `?dev=1` para o modo DEV).
- **Modo DEV:** save separado (`galope-elemental:dev`), gaveta "DEV" com Moedas, Cavalo, Itens,
  Próxima corrida (pista, clima, vento, skills sempre) e Perfil. Nunca toca no save real.
- **Verificação:** `./scripts/check.sh` em 8 etapas termina em `VERIFICAÇÃO COMPLETA: OK` (106 testes
  de simulação, 75 de efeitos, 46 de moldes, 301 conferências do wiki, 77 metas de balanço no modo
  rápido e 126 no completo, e o teste de interface).

## Pronto (o detalhe de cada frente está na spec, em `docs/superpowers/specs/`)
| Frente | Entrega | Spec |
|---|---|---|
| Núcleo da corrida v2 | 7 atributos, 5 raridades, mapa em blocos, clima, Dado da Sorte, skills | `2026-11-06-nucleo-corrida-v2-design.md` |
| Estábulo, Haras e cruzamento | várias montarias, grau, potro pela seed, aluguel e Troca | `2026-11-06-cruzamento-design.md` |
| Equipamentos | 5 slots, 40 peças, melhoria +10, conjuntos, Loja, Pedra Negra | `2026-11-06-equipamentos-design.md` |
| Menu de abas | 5 abas, tela da Montaria com sub-abas, Perfil | `2026-11-08-menu-abas-design.md` |
| Visuais | moldes PixelLab recoloridos, 16 ícones, logotipo e capa | `2026-11-08-visuais-design.md` |
| Corrida viva e modo DEV | galope, dado por cavalo, skills visíveis, natureza, curvas, DEV | `2026-11-09-corrida-viva-design.md` |
| Wiki | `docs/wiki.md` e `prototype/dist/wiki.html` gerados do código | — |
| Cavalos v3, bloco 1 | genética visível, pontos livres e estrelas, skill de tipo por terço, pistas sem extremos, iniciais Comuns, save v5 | `2026-11-10-cavalos-v3-status-e-tipo-design.md` |

## Pente fino de 2026-11-10
Seis auditorias (regras, interface e save, desenho, balanceamento, arquivos, normas do Play), com as
correções; os motivos estão em `decisoes.md` e o veredito das normas em `docs/cronograma.md`.

## Bloco 1 dos cavalos v3 (2026-11-11)
Plano em `docs/superpowers/plans/2026-11-11-cavalos-v3-bloco-1.md`, oito tarefas; regras em `docs/GDD.md`
§3, §4, §6 e §7, números no wiki, medições em `docs/exemplos.md`, decisões em `decisoes.md`.
- **Regra:** status = genética (0–31, nota C a S) + crescimento por nível + pontos livres (até 34% num
  status), estrelas multiplicando os pontos; sai o bônus fixo do tipo e o Neutro; skill de tipo sempre
  ativa num terço; pistas de 1.400 a 2.000 m com curva e subida; equipamento com valores menores;
  Poder, bots e ligas recalculados.
- **Telas:** build na aba Status (rascunho, Confirmar, Desfazer), vaga do tipo na aba Skills, selo de
  nível e barra de XP, escolha do inicial, animação da skill de tipo e terços no minimapa.
- **Save v5** com migração do v4 (pontos devolvidos para distribuir, Neutro convertido).
- **Balanço:** as 126 metas do `balance.js` completo passam.

## O que falta
- **Decidido em 2026-11-10:** o teste fechado do Play sai com o jogo offline; o lançamento público
  espera o PVP assíncrono.
- **Blocos 2 a 7 do redesenho** (`docs/GDD.md` §8), cada um com spec própria: preparação com relógio,
  empacotamento (espera a resposta sobre o Capacitor), itens de treino e gastos de Ouro, tempo e
  estábulo ativo, loja de Gemas, online.
- **Até o bloco 4** não existe item que redistribui pontos nem que sobe estrela: ponto confirmado é
  definitivo.
- **O Vinicius ainda não jogou o modelo novo:** os números saíram de simulação.
- **Balanço:** a Sorte continua quase sem valor na corrida; a Grama no Lendário nível 50 fica no piso
  da M9. M6, M9, P1, S1 e A1 só são vigiadas pelo `balance.js` completo.
- **Decisões do Vinicius ainda abertas:** o empacotador (a pergunta sobre o Capacitor ficou sem
  resposta) e, de `docs/exemplos.md` §5, o papel da Sorte, o conjunto de 3 peças, o "Cansou", a Garra
  e a zebra.
- **Arte:** crina própria de cada estilo no galope (6 a 10 gerações); retrato, largada e pódio sem
  respiração nem piscar.
- **Pendências menores:** `docs/memoria/bugs.md`.
- **GDD §9+:** expedições, tecnologia do servidor, anti-trapaça, PVP assíncrono e ranqueada.

## Próximos passos
1. O Vinicius joga o bloco 1 (republicar os artefatos de jogo, DEV e wiki) e decide os seis pontos da
   calibração (`decisoes.md`, 2026-11-11); depois a `claude/cavalos-v3` entra na `main`.
2. O Vinicius apaga as branches antigas no GitHub (lista abaixo).
3. **Bloco 2, preparação com relógio:** spec, revisão do Vinicius, plano e execução.
4. **Bloco 3, empacotamento:** retomar pela pergunta do Capacitor; o teste fechado começa aqui.
5. Abrir a conta de desenvolvedor do Play e começar a juntar os 12 testadores (é o que mais atrasa).
6. Blocos 4 a 6 chegam como atualizações durante o teste fechado; o bloco 7 (online) vem depois.

## Branches para apagar no GitHub
Todas já integradas na `main`: `claude/equipamentos`, `claude/cruzamento`, `claude/nucleo-corrida-v2`,
`claude/analise-regras-arquivo-3j3zv1`, `claude/kind-thompson-gsqj7r`, `claude/menu-abas`,
`claude/visuais`, `claude/corrida-viva` e `claude/pente-fino`. A `claude/nifty-newton-e8u133` é a
branch desta sessão e acompanha a `main`. A sessão não consegue apagar branch remota (o proxy bloqueia).
