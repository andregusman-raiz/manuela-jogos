# SPEC — Onda Tabuleiros: Ludo, Cobras e Escadas, Lig-4, Mancala, Rota

> **v1.1** (2026-08-01) — após juiz adversarial Codex (12 blockers, todos com
> reprodução; decisões fechadas abaixo; registro no fim do arquivo).
> Pesquisa: `docs/plans/PESQUISA-jogos-tabuleiro.md`. Prompt:
> `docs/plans/PROMPT-EXECUCAO-jogos-tabuleiro.md`. Protocolo das ondas 1-3:
> engine TS pura + SVG próprio, zero deps, mecânica reimplementada do zero.

## 0. Infra da onda

- `lib/armazenamento.ts`: `VERSAO_BD = 5`; `LOJAS_JOGOS` += `ludo`, `cobras`,
  `lig4`, `mancala`, `rota` (criar as 5 lojas ANTECIPADAMENTE é seguro e entra
  no PR A; upgrade aditivo).
- `lib/jogos.ts`: **cada card entra SÓ no PR do próprio jogo** (blocker J11:
  card navegável sem rota = 404). Tabela fixa (nenhum `bg-manu-nuvem`):

| PR | rota | nome | emoji | cor |
|---|---|---|---|---|
| A | `/ludo` | Ludo da Manu | 🎲 | `bg-manu-rosa/60` |
| B | `/cobras` | Cobras e Escadas | 🐍 | `bg-manu-grama/70` |
| C | `/lig4` | Lig-4 | 🔵 | `bg-manu-ceu` |
| D | `/mancala` | Mancala | 🫘 | `bg-manu-sol/60` |
| E | `/rota` | Roda Romana | ⭕ | `bg-manu-rosa/30` |

- **Orçamento do hub** (melhoria J-M1, fixado para evitar tentativa-e-erro):
  retrato 390×844 com 19 cards = 5 linhas → card `min-h-26` (104px) + Manu
  `max-h-[20dvh]`; desktop 1440×900 = 4 linhas → `sm:min-h-36`. Ajuste fino
  guiado pelo fold-gate, mas dentro deste orçamento.
- **Fold-gate endurecido** (blocker J12, entra no PR A): `hub.spec.ts` passa a
  verificar, além da dobra, NÃO-SOBREPOSIÇÃO par a par dos cards (mesmo
  invariante do `deitado.spec`) e área > 0 de cada card.
- `public/sw.js`: bump `VERSAO` + rota na `CASCA` em cada PR.
- Padrões por jogo: header da casa, `h-[100dvh] overflow-hidden`, retrato E
  deitado, `_toque.ts` nos E2E, sons `lib/som.ts`, confete na vitória.
- **Semente determinística** (blocker J4): jogos com dado (`/ludo`, `/cobras`)
  leem `?semente=<int>` da URL no mount (fallback `Date.now()`), expõem
  `data-semente` no `main` e usam o LCG da casa (`x → x*16807 % 2147483647`).
  O E2E navega com semente fixa, re-executa o MESMO LCG + motor no teste e
  compara o tabuleiro rolagem a rolagem — dados 100% reproduzíveis sem mock.

## 1. Ludo da Manu (`/ludo`) — PR A

### 1.1 Modelo do tabuleiro (engine)

- Volta: **52 casas globais** (0..51). `SAIDA[c] = 13*c`, cores 0..3.
- `progresso` por peão: `-1` base | `0..50` volta (global `(SAIDA[c]+progresso)%52`;
  o peão usa 51 das 52 casas — a global `SAIDA[c]+51` é DELIBERADAMENTE pulada) |
  `51..55` coluna final (SEM posição global — `posicaoGlobal()` retorna `null`) |
  `56` chegou. 56 passos totais.
- **Fronteira volta/coluna protegida por oráculo** (blocker J3): unit test
  hard-coda, para as 4 cores, o mapa `progresso → global` em 49/50 (global) e
  51/55/56 (`null`), e verifica que peão em 51+ NUNCA captura nem é capturado.
- Casas seguras: as 4 `SAIDA` + as 4 estrelas `(13*c+8)%52`.
- **Captura de pilha** (blocker J2): pousar em casa não-segura com peões
  adversários devolve **TODOS os adversários daquela casa** à base. Unit test
  com pilha de 2. Peões próprios empilham livremente.
- Bloqueio (nível 2): casa da volta com **≥2** peões da MESMA cor → adversário
  não pode POUSAR ali (pode passar). Não vale na coluna final.
- Chegada exata: jogada legal exige `progresso + dado ≤ 56`.

### 1.2 Máquina de turno (blocker J1 — ordem FECHADA)

`rolar(estado, d6)` executa nesta ordem:

1. Nível 2 e `d6=6` e `seisSeguidos=2` → descarta o movimento, `seisSeguidos=0`,
   **passa a vez** (situacao `"rolar"` do próximo). Nunca expõe `"mover"`.
2. Calcula `jogadasLegais` com `d6`.
3. Sem jogada legal → **passa a vez SEMPRE** (mesmo com 6; o 6 não segura a vez
   sem movimento). UI mostra o dado por 800ms antes de passar. `seisSeguidos=0`.
4. Com jogadas → `situacao="mover"` (`seisSeguidos++` se `d6=6`, senão `=0`).

`mover(estado, indicePeao)`: aplica movimento/captura; se `dado=6` → MESMO
jogador volta a `"rolar"`; senão próximo jogador. Vitória (todos os peões em
56) → `situacao="fim"` imediato. Auto-move da UI (600ms) só dispara em
`situacao="mover"` com exatamente 1 legal — o motor não conhece timers.

### 1.3 Regras por nível

| Regra | Nível 1 | Nível 2 |
|---|---|---|
| Peões | 2 (um começa no `SAIDA`, progresso 0) | 4 (todos na base) |
| Sair da base | só com 6 | só com 6 |
| Três 6 | sem penalidade (passo 1 não se aplica) | perde a vez |
| Bloqueio | não há | ≥2 peões |

Nível 2 libera ao vencer no nível 1 (`salvarProgresso("ludo", 2)`).

### 1.4 Engine — contrato (sem rng no motor)

```ts
criarPartida(jogadores: 2|3|4, nivel: 1|2): EstadoLudo   // SEM seed: motor 100% determinístico
rolar(estado: EstadoLudo, d6: 1|2|3|4|5|6): EstadoLudo   // dado SEMPRE injetado
jogadasLegais(estado): number[]
mover(estado, indicePeao: number): EstadoLudo             // no-op fora de "mover"
posicaoGlobal(peao): number | null
```

A UI guarda o LCG (semente da URL, §0) e chama `rolar(estado, 1 + rng() % 6)`.

### 1.5 UI

- Cruz SVG quadrada; cores de jogador rosa/céu/sol/grama; anel de vez nas
  bordas (padrão Damas); jogadas legais com `data-legal="true"`; peões ≥44px
  no retrato; toque no peão move.
- Dado: botão "🎲" na borda da vez, animação 400ms, som `passo`; captura =
  `erro`; chegada de peão = `acerto`; vitória = `vitoria` + confete.
- Entrada: seleção de jogadores "2/3/4" (gesto, padrão Genius).
- Hooks: `data-vez`, `data-dado`, `data-situacao`, `data-semente`, por peão
  `data-peao="<cor>-<i>"`, `data-progresso`, `data-area="base|volta|coluna|chegada"`.

### 1.6 Testes

- Unit: sair só com 6; captura simples E de pilha (2 adversários → ambos à
  base); casa segura não captura; fronteira 49/50/51/55/56 com oráculo
  hard-coded (4 cores); chegada exata (55+2 ilegal); 6 repete; sem-legal passa
  MESMO com 6 (peões em 55 e 56 + dado 6 → passa — reprodução do J1); três-6
  nível 2 passa sem expor "mover" / nível 1 não pune; bloqueio ≥2 impede pouso
  e não impede passagem; pilha própria não bloqueia no nível 1; fuzz seeded:
  500 partidas 2P terminam em ≤ 600 rolagens (teto do teste) com nº de peões
  por cor constante.
- E2E: com `?semente=fixa`, o teste re-executa LCG+motor e compara `data-*`
  rolagem a rolagem até a vitória (partida 2P nível 1 completa, semente
  escolhida offline para conter ≥1 captura); confete; persistência (recarrega,
  nível 2 disponível). 3 formatos; dedo 80px.

## 2. Cobras e Escadas (`/cobras`) — PR B

### 2.1 Regras

- Trilha 1..100 boustrophedon: casa 1 EMBAIXO-ESQUERDA, linha 1 vai 1→10
  (esq→dir), linha 2 vem 11→20 com o **11 na DIREITA** (20 na esquerda), e
  assim alternando até o 100 no TOPO-ESQUERDA.
- Peões começam fora (casa 0). Dado injetado (`jogar(estado, d6)`), semente §0.
- Atalhos fixos (grafo sem encadeamento — conferido pelo juiz):
  - Escadas: 4→25, 13→46, 33→49, 42→63, 50→69, 62→81, 74→92.
  - Cobras: 27→5, 40→3, 43→18, 54→31, 66→45, 76→58, 89→53, 99→41.
- Chegada exata no 100; excesso QUICA (`98+5 → 97`); atalho aplica após o
  quique (`95+6 → 99 → cobra → 41`).
- 2-4 jogadores; única ação = tocar o dado; peão anda casa a casa (120ms,
  som `passo`); vitória salva `salvarProgresso("cobras", 1)`.

### 2.2 Engine

```ts
aplicarDado(pos, d6): { destino; caminho: number[]; atalho: "cobra"|"escada"|null }
criarPartida(jogadores: 2|3|4): EstadoCobras
jogar(estado, d6): EstadoCobras
```

Invariantes (unit): atalhos sem encadeamento (asserção sobre o próprio mapa);
origens/destinos em 2..99; posição sempre em [0,100].

### 2.3 UI e testes

- Tabuleiro 10×10 SVG, número grande por casa, `data-casa="<n>"` em cada
  célula, `data-pos` por peão; cobras/escadas SVG suaves.
- Unit: tabela-oráculo com as 15 entradas RE-DECLARADAS literalmente; quiques
  (98+5→97; 99+1→100; 95+6→41); fuzz 1000 jogadas em [0,100].
- **E2E de geometria** (blocker J5): via `data-casa`, asserta bbox: casa 1
  embaixo-esquerda; `y(1) == y(10)`; `y(11) < y(1)`; `x(11) ≈ x(10)` (coluna
  direita); `x(20) ≈ x(1)`; `x(21) ≈ x(1)` (linha 3 volta esq→dir); 100 no topo.
- E2E de partida: `?semente=fixa`, teste re-executa motor e compara `data-pos`
  jogada a jogada até vitória (semente escolhida para passar por ≥1 cobra e
  ≥1 escada); animação casa-a-casa observada; confete. 3 formatos.

## 3. Lig-4 (`/lig4`) — PR C

### 3.1 Regras e modos

- 7×6; peça cai na menor linha livre; vitória 4 em linha H/V/diagonais;
  empate = 42 peças. Modos: "Com alguém" e "Com a Manu" (gesto de entrada;
  humano começa; IA "pensa" 600ms). Vencer vs Manu nível 1 libera nível 2
  (distração 30% → 10%; `salvarProgresso("lig4", 2)`).

### 3.2 IA (blocker J6 — prioridade FECHADA)

```ts
iaJogar(estado, rng, distracao): number
```

1. **Vitória própria em 1** existe → joga (distração NUNCA pula esta regra).
2. Senão, ameaça(s) do humano em 1 → joga o bloqueio; se houver 2+ ameaças
   (imbloqueável), bloqueia a de melhor avaliação minimax (desempate: coluna
   mais central, depois mais à esquerda) — regra determinística, sem sorteio.
3. Senão, sorteio de distração: com prob. `distracao` → coluna aleatória LEGAL
   (rng injetado); senão minimax profundidade 2 (avaliação: janelas de 4 —
   3 próprias abertas +50, 2 +5, centro +3/peça; derrota em resposta −∞).
   Se TODA jogada perde, joga a melhor minimax mesmo assim (mesmo desempate).
4. Nunca coluna cheia (garantido por construção — só itera legais).

### 3.3 Testes

- Unit: vitórias nas 4 direções (posições hard-coded); empate; **tática com
  `distracao=1` e rng apontando para coluna ruim** (blocker J6: IA ainda vence
  em 1 e ainda bloqueia ameaça única); ameaça dupla → bloqueia uma (posição do
  juiz: H col3, IA, H col4, IA, H col5 → ameaças em 2 e 6); fuzz 500 estados:
  resposta sempre legal.
- E2E: 2P vitória diagonal com oráculo de posições; vs Manu: legalidade
  (alternância, colunas ≤6 peças, resposta <2s) — comportamento fino da IA
  fica nos unit. 3 formatos.

## 4. Mancala/Kalah (`/mancala`) — PR D

### 4.1 Regras (Kalah 6×4)

- Semeadura anti-horária incluindo o próprio kalah, pulando o adversário.
- Última no próprio kalah → joga de novo. Última em cova própria VAZIA com
  oposta ≥1 → captura ambas para o kalah.
- **Fim domina jogada extra** (blocker J8): ao FIM da semeadura, se um lado
  está com as 6 covas vazias → varredura e fim IMEDIATO, mesmo que a última
  semente tenha caído no kalah do semeador. Maior kalah vence; 24×24 empata.
- Modos: 2P e "vs Manu" greedy determinística (ganho imediato no kalah;
  desempate: jogada extra > cova mais à direita). Vitória salva nível 1.

### 4.2 Testes

- Unit: pulo do kalah adversário; **pulo DUPLO** (blocker J7): estado
  construído `A=[0,0,0,0,27,3], KA=9, B=[0,0,2,2,0,0], KB=5`, semear A5 →
  KB PERMANECE 5, última semente em A6, layout final hard-coded; jogada
  extra; captura e NÃO-captura (oposta vazia); **fim vs extra combinados**
  (estado do juiz: `A=[0,0,0,0,0,1], KA=20, B=[1,1,1,1,1,1], KB=21`, semear
  A6 → KA=21, varre B → KB=27, B vence — sem vez extra); soma 48 constante;
  500 partidas seeded terminam em ≤200 jogadas (teto do teste — evidência
  amostral, não prova); greedy escolhe captura óbvia.
- E2E: sequência fixa 2P com ≥1 captura e ≥1 extra, placar final por oráculo
  hard-coded; vs Manu 3 lances legais; confete. Atenção especial ao RETRATO
  (2 arcos de covas). 3 formatos.

## 5. Roda Romana (`/rota`) — PR E

### 5.1 Regras

- 8 posições no anel (0..7) + centro (8); anel adjacente `i±1 mod 8`; centro
  adjacente a todas. 3 peças por jogador; colocação alternada (A começa) em
  casa vazia; depois movimento para vazia adjacente. Sem capturas.
- Vitória: 3 próprias em arco consecutivo do anel (8 arcos) ou diâmetro
  `(i, 8, i+4)`, i 0..3 — 12 linhas. Vale já na colocação (vitória simultânea
  dos dois é INALCANÇÁVEL — colocar peça própria não completa linha alheia;
  invariante assertada no BFS).
- **Sem regra de skip** (melhoria J-M4: enumeração do juiz mostrou que jogador
  sem movimento não ocorre no espaço alcançável — regra removida; `mover` em
  estado sem legais é no-op e o BFS prova que não acontece).
- **Empate por repetição** (blocker J10): a MESMA configuração completa
  (ocupação + vez) pela 3ª vez na partida → `situacao="empate"` ("Empatou!"),
  sem confete, botão de nova partida. Engine guarda contagem de configurações.
- Modos: 2P e "vs Manu": vence em 1 se pode; senão bloqueia vitória iminente;
  senão aleatória legal (rng injetado). Sem níveis; vitória salva nível 1.

### 5.2 Testes — verificação exaustiva (blocker J9)

- BFS do espaço alcançável com chave **(ocupação, vez)** — fase é derivável da
  contagem de peças. Contagem-oráculo: registrar o total encontrado e
  hard-codá-lo no teste (referência do juiz: 5.230 estados com vez; 3.990
  ocupações; validar na implementação e fixar). Asserções no espaço todo:
  (a) nunca ambos sem movimento; (b) `vencedor()` bate com as 12 linhas
  re-declaradas literalmente no teste; (c) nunca vitória dupla.
- Unit: ciclo do juiz (`A:4→8, B:5→6, A:8→4, B:6→5` ×3) termina em empate por
  repetição; IA bloqueia vitória iminente (posição forçada, determinística).
- E2E: vitória por arco na colocação; vitória por diâmetro na fase de
  movimento; empate por repetição alcançado com sequência fixa; vs Manu
  bloqueio forçado. 3 formatos.

## 6. Aceite da onda

1. Gates verdes na main após cada merge.
2. Hub 19 cards: fold-gate ENDURECIDO (dobra + não-sobreposição) e deitado.
3. Produção verificada JOGANDO cada jogo (2 formatos; screenshots em
   `artefatos/screenshots/manuela-jogos/onda-tabuleiro/`).
4. `pwa.spec`: 5 rotas no precache; offline exercitado no Lig-4.
5. `docs/CREDITOS.md` + relatório final em `docs/reports/`.

## 7. Escopo negativo

Batalha Naval, Dominó, Trilha completa, IA para Ludo/Cobras, multiplayer
online, placar global, deps de runtime. Não tocar nos 14 jogos existentes além
de hub/manifest/sw/armazenamento.

---

## Registro do julgamento (v1.0 → v1.1)

Juiz Codex (read-only, 1 rodada, 2026-08-01): **REVISE** com 12 blockers +
5 melhorias — TODOS acatados: J1 máquina de turno fechada (§1.2); J2 captura
de pilha = todos + bloqueio ≥2 (§1.1); J3 oráculo da fronteira 50/51 (§1.1/1.6);
J4 semente por URL + re-execução do LCG no E2E (§0); J5 E2E de geometria
boustrophedon (§2.3); J6 prioridade da IA fechada + testes com distração
máxima (§3.2/3.3); J7 teste de pulo duplo com estado construído (§4.2); J8 fim
domina extra (§4.1); J9 BFS com chave ocupação+vez e contagem-oráculo (§5.2);
J10 empate por repetição (§5.1); J11 cards por PR (§0); J12 fold-gate
endurecido (§0). Melhorias: orçamento do hub fixado; skip da Rota removido;
claim de terminação rebaixado a teto amostral.
