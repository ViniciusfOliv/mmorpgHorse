# Decisões

Formato: **decisão** — motivo. A mais nova fica no topo. O detalhe de cada frente está na spec dela
(`docs/superpowers/specs/`) e o design no `docs/GDD.md`; aqui fica o *quando* e o *porquê*.

## 2026-11-10 — pente fino
- **Pacote de balanceamento com medição pareada** (velocidade, curva, subida, 10 skills, gatilho de estamina baixa em 30%, skill de clima ×1,08) — o ganho de uma skill ia de 0,05 a 16,2 p.p. de vitória; ficou entre 4,8 e 11,9.
- **Pesos do Poder refeitos** (Velocidade e Força pesam mais; conjunto de 3 peças vale 3 pontos) — o Poder errava até 10,5 p.p. por montaria; agora no máximo 3,8.
- **Metas novas no `balance.js`** (S1 por skill, A1 por status, P1 e P2 do Poder, Em1 de emoção) — vigiam o que antes ninguém media.
- **Entrada da sala aberta fica reservada e sala aberta nunca é trocada antes de correr** — dava para re-sortear a sala gastando o Ouro, ou trocando um treino por sala valendo.
- **Gasto só vale se a gravação der certo** — com o armazenamento cheio, recarregar desfazia a corrida já vista.
- **`jogo.html` de produção sem modo DEV, sem gancho de teste e sem o CSS deles; o build falha se sobrar** — `?dev=1` ligava Ouro infinito no jogo do jogador.
- **Pedra Negra do pódio sorteada por lugar; prêmios com porcentagens inteiras** (4 corredores a 100: 252 + 108) — os lugares saíam amarrados e o ponto flutuante errava 1 de Ouro.
- **Resultado da corrida leva `simVersion` e `tuningHash`** — um servidor poderá auditar corridas antigas depois de um rebalanceamento.
- **Desenho da corrida com hachura, serras e texto guardados prontos, escala de trabalho menor em tela densa e laço parado fora da corrida** — as subidas triplicavam o custo do quadro; o desenho ficou idêntico pixel a pixel.
- **Nada de minificador feito à mão no build** — tirar comentário por expressão regular quebra código em silêncio; fica para o empacotador da tecnologia final.
- **Seed secreta, validação das entradas e seeds por domínio ficam para o servidor** (`docs/cronograma.md`) — no cliente o save é editável de qualquer jeito.
- **Peça Rara e Lendária do mesmo conjunto seguem com o mesmo nome** — é decisão do GDD §7, não erro.
- **149 arquivos sem uso apagados e documentos encurtados; o checklist de lançamento virou `docs/cronograma.md`** — pedido do Vinicius ("não deixe informações demais"). O `comparativo.html` fica enquanto houver arte de molde pendente.
- **Ainda não é hora de publicar no Play** — faltam tecnologia final, empacotamento, documentos legais, conta e teste fechado.

## 2026-11-09 — corrida viva, modo DEV e wiki
- **Wiki gerado do código** (`docs/wiki.md`, `prototype/dist/wiki.html`) — uma chave nova sem tradução quebra o build, para o wiki nunca mentir.
- **Build de teste `jogo-dev.html` liga o modo DEV sozinho** — o artefato do claude.ai não repassa `?dev=1`.
- **Modo DEV com save separado (`galope-elemental:dev`)** — testar sem tocar no save real; Ouro infinito só em memória.
- **Única mudança do DEV na simulação: `config.dev.skillsAlways`** — o determinismo da corrida real não muda.
- **Skills visíveis na pista** (balão preso à raia, contorno na cor do elemento) — dá para ver quem ativou sem ler o rodapé.
- **Dado da Sorte na pista** (um dado por cavalo, o maior brilha, "↻" em quem desempatou) — a faixa ordena por desempate e depois pelo número.
- **Natureza só visual** (vento pela seed, folhas, respingos, calor e poeira por piso) — o vento não entra na regra.
- **Opção "Animações" no Perfil** — respeita o sistema sem deixar a chuva parada.
- **Curvas vizinhas viram uma só no desenho** (a simulação continua por bloco) — duas coladas pareciam um ziguezague falso.
- **Efeitos em segundos reais por um fator `escala`** — em x1 a simulação anda ~4× o tempo real.
- **Galope de corrida de ondas, folhas e lisa guiado pelo quadro de chamas** — crina própria por estilo não passou nos critérios e ficou pendente.
- **O ui-test serve `prototype/dist/` por http local** — em `file://` o localStorage às vezes sumia e o `check.sh` oscilava.

## 2026-11-08 — menu de abas e visuais
- **Menu de abas antes das expedições e dos visuais** (escolha do Vinicius) — a rolagem única não comportava as telas novas.
- **5 abas (Estábulo, Correr, Expedição, Haras, Loja) e Perfil no cabeçalho; Equipamento vira sub-aba da Montaria** — uma tela por assunto.
- **A corrida PVP continua automática; a batalha de expedição terá modo automático e manual** (escolha do Vinicius).
- **Cavalos com moldes do PixelLab recoloridos no jogo** — arte melhor sem gerar um sprite por cavalo.
- **Cores naturais e classificação local, sem paleta forçada** — com `color_image` o PixelLab pintava tudo num tom só.
- **Escala inteira única para todos os estilos** — pixels nítidos e cavalos do mesmo tamanho.
- **Ícones do PixelLab; logotipo e capa do Canva** — marca sem custo avulso.
- **Script de geração com dry-run por padrão e `--teto`** — cota só com confirmação.
- **Bônus de 4 peças do conjunto: ×1,10 → ×1,07** — a skill de clima volta a valer mais que o conjunto.
- **Branches já mescladas não podem ser apagadas pela sessão** (o proxy bloqueia) — fica para o Vinicius no GitHub.

## 2026-11-06 — núcleo v2, cruzamento e equipamentos
- **Redesign em 6 subprojetos** (núcleo → cavalos e cruzamento → equipamentos → expedições → montarias → economia) — a ordem segue as dependências.
- **7 atributos (entram Manobra e Sorte) e 5 raridades** — cada trecho do mapa tem um atributo dono; a raridade define teto, vagas e chance de skill.
- **Tática e "Disposição do dia" removidas** — corrida = status + terreno + RNG; a única sorte é o Dado da Sorte, visível.
- **Elementos agem só pelo clima** (Fogo > Grama > Água > Fogo) — uma regra em vez de três tabelas.
- **Mapa aleatório em blocos, sem pistas fixas** (ideia do Vinicius) — nenhum tipo de montaria fica sem pista.
- **Skills aprendidas por nível** (8% por nível até lotar as vagas) — dá valor ao nível e ao cruzamento.
- **Pacotes de montaria só com moeda ganha jogando; Gemas só para cosméticos e passe** — a Lei 15.211/2025 veda caixa de recompensa paga em jogo de acesso provável por menores, e pacote pago também furaria "Gemas nunca viram Ouro".
- **Grau (★ a ★★★) dentro da raridade** — variação de qualidade sem criar uma 6ª raridade.
- **Status do potro sorteados na faixa do grau, não herdados** (pedido do Vinicius); as chances saturam no nível 30 e a égua pesa 60%.
- **Mítico fora do cruzamento** (só por despertar, depois das expedições).
- **Haras com reprodutores de aluguel e Troca; estábulo com vagas limitadas** — seguram a inflação de cavalos.
- **5 slots de equipamento com status dono; conjuntos por clima com bônus de 3, 4 e 5 peças** — cria a escolha antes da corrida.
- **Melhoria +0 a +10 com queda a partir de +6** (o Vinicius pediu chances menores); sorteio só pela seed.
- **Loja com Ouro; Pedra Negra só no pódio de corrida valendo; Lendário fora da loja até as expedições.**
- **Trava parcial com páreo aberto** — dá para trocar de conjunto pela previsão do clima, não para abrir a sala fraco e equipar forte.
- **Save migrado a cada versão em vez de chave nova** — não perder o Ouro do jogador.
- **`game.js` não será dividido agora** — o que sobrevive para a tecnologia final são os módulos puros (`sim.js`, `breed.js`, `gear.js`, `data.js`).
- **Testes unitários no `check.sh` e snapshot dos 3 potros de exemplo** — qualquer chamada de RNG a mais derruba o teste.

## 2026-11-05 — regras de trabalho
- **Uma conversa principal e uma branch por frente** — a principal integra na `main` e escolhe modelo e esforço por tarefa.
- **Design em `docs/GDD.md`; `CLAUDE.md` enxuto; memória versionada em `docs/memoria/`** — sessões na nuvem rodam em contêiner descartável.
- **`prototype/dist/` versionado** — abre o jogo sem rodar o build.
- **Protótipo sem dependências** (Playwright já instalado para os testes) — nada para instalar.
- **Não reorganizar `prototype/` antes de escolher a tecnologia final.**
- **Prêmios nunca crescentes por colocação; sem Ouro para a entrada, a sala vira treino** — correções do primeiro pente fino.
- **Pilares do GDD §2 aprovados** — corrida automática por seed, duas moedas (Gemas nunca viram Ouro), PVP de 4 a 8 com pote, ligas por Poder.
- **Nome do projeto "MMORPG Horse"; título provisório do jogo "Galope Elemental".**
