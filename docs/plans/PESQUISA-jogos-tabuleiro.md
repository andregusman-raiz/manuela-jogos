# Pesquisa — Jogos de Tabuleiro open-source (incluindo Ludo)

> Investigação 2026-08-01, a pedido do dono ("jogos de tabuleiro opensources incluindo ludo").
> Mesmo protocolo das ondas 1-3: mecânica reimplementada como engine TS pura + SVG próprio
> (zero deps de runtime); repos AGPL/GPL = **referência de regras/UX apenas** (regras de jogo
> não têm copyright); MIT/Apache = leitura de perto permitida; arte sempre redesenhada.

## 1. Ludo (pedido explícito do dono)

### Regras canônicas (Wikipedia)

- 4 peões por jogador; sai da base **só com 6** (e 6 dá jogada extra).
- Captura: cair em casa ocupada por adversário devolve o peão dele à base.
- Casas seguras: coluna final da própria cor (adversário não entra); variantes marcam casas-estrela.
- **Três 6 seguidos**: perde a vez (variante comum).
- Chegada **exata** na casa final; peões da mesma cor formam bloqueio (variante).
- "Ludo" é nome genérico (latim, "eu jogo") — domínio público. **"Ludo King" é marca**: não usar.
- Parente do Pachisi indiano / Parcheesi americano.

### Simplificações infantis mapeadas (para 6-10)

1. Começar com 1 peão já fora da base (menos frustração inicial).
2. 2 peões por jogador em vez de 4 (partida ~10min em vez de 30+).
3. Sem penalidade de três 6.
4. Auto-mover quando só existe 1 jogada legal (menos decisões vazias).
5. Nível 2 pode reintroduzir 4 peões + bloqueio.

### Repos de referência (licenças VERIFICADAS)

| Repo | Licença | Stack | O que aproveitar |
|---|---|---|---|
| [avirati/ludo](https://github.com/avirati/ludo) | **MIT** ✅ | React+Redux+TS, 12★ | Modelagem do tabuleiro: 4 bases + 4 walkways de 18 células (NORMAL/STAR/SPAWN/HOMEPATH), peão completa em **56 passos** — melhor referência de dados/geometria |
| [priyanshurav/libreludo](https://github.com/priyanshurav/libreludo) | AGPL-3.0 ⚠ regras/UX apenas | TS+Vite, 12★, ativo 07/2026 | Multiplayer local + bots sem anúncio — o parente de UX mais próximo do nosso caso |
| [mort3za/ludo](https://github.com/mort3za/ludo) | GPL-3.0 ⚠ regras apenas | Vue+TS | Offline-first (mesmo espírito PWA) |

## 2. Demais tabuleiros clássicos

**Fonte-mestra**: [FreeBoardGames.org](https://github.com/freeboardgames/FreeBoardGames.org)
(AGPL-3.0 ⚠ referência apenas; React + boardgame.io; 297★) implementa a família inteira:
`checkers, fourinarow, mancala, memorymatch, ninemensmorris, seabattle, tictactoe(+plus),
hangman, soupofletters, bingo, rota, war, reversi, bashni…` — catálogo comprovado de
tabuleiro mobile-first em React. [boardgame.io](https://github.com/boardgameio/boardgame.io)
(**MIT** ✅, 12.4k★) é a referência de arquitetura turn-based: moves puros sobre estado
imutável, phases/turns explícitos, bots plugáveis — padrões que a casa já segue nas engines.

| Jogo | Referência | Pedagogia 6-10 | Engine própria | Touch | 1P precisa de IA? |
|---|---|---|---|---|---|
| **Cobras e Escadas** | regras DP, engine trivial | ⭐⭐⭐ contagem até 100, tabela numérica | **Baixa** (dado + mapa de atalhos) | Perfeito | Não (2-4P local; "bot" = dado automático) |
| **Lig-4** | FreeBoardGames `fourinarow`; [Dane64/ConnectFour](https://github.com/Dane64/ConnectFour) (minimax) | ⭐⭐⭐ padrões, planejamento | **Baixa** (grade 7×6 + varredura de 4) | Perfeito (toque na coluna) | Minimax raso (prof. 2) + erro proposital = "Manu jogando" |
| **Mancala/Kalah** | FreeBoardGames `mancala`; bawo.zone (TS) | ⭐⭐⭐ contagem, semeadura, antecipação | Média-baixa | Bom (toque na cova) | Greedy (maior captura) já diverte |
| **Trilha (moinho)** | FreeBoardGames `ninemensmorris`; [nimaps](https://github.com/nimaps/nine-men-morris) (minimax, sem licença ⚠) | ⭐⭐ estratégia (mais 8-10 anos) | Média (3 fases: pôr/mover/voar) | Bom | Minimax raso |
| **Rota** (moinho romano) | FreeBoardGames `rota` | ⭐⭐⭐ trilha simplificada p/ 6-7 (3 peças, sem remoção) | **Baixa** | Bom | Aleatório+bloqueio |
| Batalha Naval | FreeBoardGames `seabattle` | ⭐⭐ coordenadas (letra×número) | Média | Bom | **Problema**: mão secreta no mesmo aparelho exige tela "passa o celular" |
| Dominó | vários, fracos | ⭐⭐ contagem de pintas | Média | Regular | Mesmo problema de mão secreta |

## 3. Recomendação — Onda de Tabuleiros (3 PRs)

1. **PR A — Ludo da Manu** (pedido do dono): 2-4 jogadores locais no mesmo aparelho
   (padrão Damas: anel de vez na borda), dado automático animado, nível 1 = 2 peões +
   1 já fora + sem regra dos três 6; nível 2 = 4 peões + bloqueio. Sem IA na v1
   (mesma decisão da Damas). Tabuleiro SVG próprio nas cores da casa.
2. **PR B — Cobras e Escadas**: tabuleiro 1-100 (reforça Caça-Números!), 2-4P local,
   serpentes/escadas SVG; engine trivial e testável por oráculo (tabela de atalhos).
3. **PR C — Lig-4**: primeiro jogo da casa **contra o aparelho** — minimax profundidade 2
   com 20% de jogada aleatória ("Manu distraída"), além de 2P local.

**Reserva**: Mancala (excelente pedagogia, entra se a onda render), Rota (se a Trilha
parecer pesada). **Adiados**: Batalha Naval e Dominó (mão secreta no mesmo aparelho =
fricção de UX que merece SPEC própria), Trilha completa (9-10 anos).

**Redundâncias evitadas**: `hangman`/`memorymatch`/`soupofletters` do FreeBoardGames já
são Forca/Memória da casa; `checkers` já é a Damas.

## 4. Riscos e cuidados

- **Nome**: usar "Ludo" (genérico) — nunca "Ludo King" (marca). Cores/tabuleiro próprios.
- **Nenhuma dependência nova**: boardgame.io fica como leitura, não como lib.
- Engines AGPL/GPL: nunca abrir o código lado a lado durante a escrita da engine —
  ler regras/UX, fechar, implementar do zero (protocolo das ondas anteriores).
- Ludo com 4 jogadores no celular retrato: tabuleiro em cruz é quadrado — cabe; a UI
  de vez segue o padrão do anel da Damas (girado para cada lado do aparelho).
