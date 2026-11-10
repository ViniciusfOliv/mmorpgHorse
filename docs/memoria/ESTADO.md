# Estado do projeto

_Atualizado em 2026-11-10._

**Fase:** Protótipo, a caminho do MVP. **Ainda não é hora de publicar no Play**; o caminho, as
durações e o checklist estão em `docs/cronograma.md`. **Tecnologia decidida (2026-11-10):** o
protótipo vira o jogo, a mesma base web empacotada para Android, com os módulos de regra no servidor.

## Onde estamos
- **Branches:** a `main` tem tudo até o pente fino (2026-11-10). Em aberto: `claude/cavalos-v3`
  (redesenho dos cavalos e da economia: desenho aprovado e registrado no `docs/GDD.md` §8; a spec do
  bloco 1 está em preparação, sem código ainda) e `claude/empacotamento` (em pausa, só com as decisões
  iniciais; volta como bloco 3).
- **Onde jogar** (artefatos privados do claude.ai; republicar depois de cada build):
  - jogo de produção, sem modo DEV: https://claude.ai/artifact/MKTKQUYmzBNun92abFzygn (`prototype/dist/jogo.html`)
  - build de teste com modo DEV: https://claude.ai/artifact/LiMr2cM7FRgFZqJ6dFHPhU (`prototype/dist/jogo-dev.html`)
  - wiki: https://claude.ai/artifact/Bp47f9qE3tSswu1A9zdF2y (`prototype/dist/wiki.html`)
  - no computador: `prototype/dist/preview.html` (com `?dev=1` para o modo DEV).
- **Modo DEV:** save separado (`galope-elemental:dev`), gaveta "DEV" com Moedas, Cavalo, Itens,
  Próxima corrida (pista, clima, vento, skills sempre) e Perfil. Nunca toca no save real.
- **Verificação:** `./scripts/check.sh` em 8 etapas termina em `VERIFICAÇÃO COMPLETA: OK` (76 testes
  de simulação, 66 de efeitos, 46 de moldes, 290 conferências do wiki, 66 metas de balanço no modo
  rápido e 82 no completo, e o teste de interface).

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

## Pente fino de 2026-11-10
Seis auditorias (regras, interface e save, desenho, balanceamento, arquivos, normas do Play), correções
e uma revisão final por frente. Resumo; os motivos estão em `docs/memoria/decisoes.md`:
- **Regras e segurança:** as seis regras invioláveis estavam cumpridas, menos uma brecha no re-sorteio
  da sala, fechada (entrada reservada, sala aberta nunca trocada). Gasto só vale se a gravação der
  certo; save corrompido vira cópia de segurança; `jogo.html` sai sem modo DEV.
- **Balanceamento:** pacote medido (skills entre 4,8 e 11,9 p.p. de ganho; o Poder erra no máximo
  3,8 p.p. por montaria) e cinco metas novas. Medições em `docs/exemplos.md`.
- **Desempenho:** o desenho das subidas era o gargalo. No pior caso com CPU 4× mais lenta, os quadros
  perdidos caíram de 33% para 5% em 1280 px e de 52% para 1% em celular de tela densa.
- **Limpeza:** 404 → 255 arquivos; documentos encurtados (este tinha 163 linhas).
- **Normas:** veredito e checklist em `docs/cronograma.md`.

## O que falta
- **Decidido em 2026-11-10:** o teste fechado do Play sai com o jogo offline; o lançamento público
  espera o PVP assíncrono.
- **Redesenho aprovado em 2026-11-10** (`docs/GDD.md` §8 e `docs/memoria/decisoes.md`): status com
  genética visível, pontos livres e estrelas; skill de tipo sempre ativa; pistas sem extremos e
  preparação com relógio; itens de treino; duas lojas; circuito ocioso e aluguel. Falta construir,
  em sete blocos.
- **Decisões do Vinicius ainda abertas:** o empacotador (a pergunta sobre o Capacitor ficou sem
  resposta) e, de `docs/exemplos.md` §5, o papel da Sorte, o conjunto de 3 peças, o "Cansou", a Garra
  e a zebra (o Neutro foi resolvido: sai do jogo por enquanto).
- **Arte:** crina própria de cada estilo no galope (6 a 10 gerações); retrato, largada e pódio sem
  respiração nem piscar.
- **Pendências menores:** `docs/memoria/bugs.md`.
- **GDD §9+:** expedições, tecnologia do servidor, anti-trapaça, PVP assíncrono e ranqueada.

## Próximos passos
1. O Vinicius apaga as branches antigas no GitHub (lista abaixo).
2. **Bloco 1, status e tipo:** fechar a spec com os números da calibração por simulação, o Vinicius
   revisa, depois plano e execução por subagentes. Em seguida o bloco 2 (pista e preparação).
3. **Bloco 3, empacotamento:** retomar pela pergunta do Capacitor; o teste fechado começa aqui.
4. Abrir a conta de desenvolvedor do Play e começar a juntar os 12 testadores (é o que mais atrasa).
5. Blocos 4 a 6 chegam como atualizações durante o teste fechado; o bloco 7 (online) vem depois.

## Branches para apagar no GitHub
Todas já integradas na `main`: `claude/equipamentos`, `claude/cruzamento`, `claude/nucleo-corrida-v2`,
`claude/analise-regras-arquivo-3j3zv1`, `claude/kind-thompson-gsqj7r`, `claude/menu-abas`,
`claude/visuais`, `claude/corrida-viva` e `claude/pente-fino`. A `claude/nifty-newton-e8u133` é a
branch desta sessão e acompanha a `main`. A sessão não consegue apagar branch remota (o proxy bloqueia).
