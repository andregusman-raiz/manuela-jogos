# SPEC — Jogos Educativos Onda 3 (Frações, Estados, Tangram, Damas, Caça-Números)

> **Versão**: 1.0 — **PRÉ-JUÍZO** (aguardando juiz adversarial; NÃO executar antes).
> **Base**: fila de reserva de `docs/plans/PESQUISA-jogos-onda2.md`; herda toda a
> arquitetura e disciplina das ondas 1-2 (SPECs + relatórios em docs/).
> **Repo**: `andregusman-raiz/manuela-jogos`. Data: 2026-07-31.

---

## 1. Objetivo

5 jogos novos → hub com **14 jogos**. Lacunas cobertas: **frações** (8-10 anos),
**geografia do Brasil**, **raciocínio espacial** (Tangram), **estratégia a dois**
(Damas) e **múltiplos/fatores** (evolução do Foguete). Referências pedagógicas:
GCompris `fractions`/`geo-country`/`baby_tangram`/`checkers`/`gnumch-*` —
**reimplementação 100% própria, zero código AGPL/GPL, zero dependência nova**.

| PR | Jogo | Rota | Emoji | Cor (tokens existentes) |
|----|------|------|-------|-------------------------|
| A | Pizza das Frações | `/fracoes` | 🍕 | `bg-manu-rosa/60` |
| B | Estados do Brasil | `/estados` | 🗺️ | `bg-manu-grama/70` |
| C | Tangram da Manu | `/tangram` | 🔷 | `bg-manu-ceu-claro` |
| D | Damas | `/damas` | ⚪ | `bg-manu-nuvem` |
| E | Caça-Números | `/caca` | 🔢 | `bg-manu-sol` |

## 2. Infra transversal (decisões FECHADAS)

- **IndexedDB v3→v4**: `LOJAS_JOGOS` += `fracoes`, `estados`, `tangram`,
  `damas`, `caca` (migração aditiva; política de conexões das ondas 1-2
  INALTERADA). Teste de migração (contas.spec) passa a esperar v4/14 gavetas.
- **Hub com 10-14 cards (o gate é o `hub.spec`)**: no PR que adicionar o 10º
  jogo, celular vai a `grid-cols-4` (nome `text-xs`, emoji `text-3xl`) e `sm:`
  vai a **5 colunas** (14 cards = 3 linhas — a conta que fecha a dobra do
  desktop 900px). Ajuste fino de densidade é permitido DESDE QUE o hub.spec
  passe; a Manu do header pode encolher até `max-h-24dvh` se precisar.
- **SW v11→v15** (um bump por PR, rota no CASCA); `pwa.spec`: precache poll
  ganha as 5 rotas; offline INTERATIVO cobre `/contas` + a rota mais nova de
  cada PR (padrão das ondas).
- **Sons**: reusar o vocabulário existente (`acerto`, `erro`, `vitoria`,
  `passo`, `cor`). Nenhum efeito novo.
- **E2E**: padrão consolidado — `tocarNoElemento`, 3 formatos por contexto
  novo, confete `data-ativo`, persistência pós-reload, containment, oráculos
  independentes por teste, retry de `goto("/")` contra o reload do SW.
- **Piso de toque 72px** em alvos de jogo, com DUAS exceções documentadas
  nesta onda: hit-areas de estados pequenos (§3.2) e casas do tabuleiro de
  damas (§3.4) — ambas com piso próprio e teste dedicado.

## 3. Jogos

### 3.1 Pizza das Frações (`/fracoes`) — PR A

**Conceito**: pizza SVG dividida em fatias (técnica de região clicável do
livro de colorir). Três habilidades em três níveis.

**Regras (FECHADAS)**:
- **Nível 1 — LER**: pizza com D fatias (D ∈ 2..8), N pintadas (0 < N < D);
  4 opções "N/D". Distratores em ordem determinística: (N±1)/D, N/(D±1)
  válidos, fração invertida quando válida; únicos, sempre frações próprias.
- **Nível 2 — CONSTRUIR**: pedido "Pinte N/D" (grade N/D como no nível 1);
  tocar fatia alterna pintado/despintado; botão CONFERIR habilita sempre;
  certo → `acerto`; errado → shake + `erro`, pintura PERMANECE para ajustar.
- **Nível 3 — COMPARAR**: duas pizzas lado a lado (frações A e B, D ∈ 2..8);
  3 botões: "a primeira", "são iguais", "a segunda". Comparação no motor por
  PRODUTO CRUZADO (inteiros, nunca float). Equivalências entram de propósito
  (1/2 vs 2/4 → "são iguais").
- 8 acertos → fase completa. Fatias via `path` SVG com ângulos do motor
  (fatia k de D: arco de k·360/D a (k+1)·360/D, raio 90, centro 100,100).
- data-attrs: `data-fracao="3/8"` (nível 1/2 alvo), `data-pintadas`,
  `data-acertos`; cada fatia `data-fatia={k}` e `data-pintada`.
- **Anti-mutação "pizza mentirosa"**: o E2E conta os `path[data-pintada=
  "true"]` e confere com o numerador de `data-fracao` — motor certo com
  desenho errado falha.

**Motor puro** (`lib/fracoes/motor.ts`): `gerarRodada(nivel, rng)`,
`comparar(a, b): "a" | "igual" | "b"` (produto cruzado), `anguloDaFatia(k, d)`.

**Aceite**: unidade — 200 rodadas/nível (frações próprias, 4 opções únicas,
nível 3 com fixtures hard-coded: 1/2 vs 2/4 = igual, 2/3 vs 3/5 = a, 3/8 vs
1/2 = b); ângulos exatos (fatia 0 de 4 = 0°..90°). E2E — fluxo dos 3 níveis
(2 e 3 via progresso salvo), contagem de fatias pintadas, 3 formatos.

### 3.2 Estados do Brasil (`/estados`) — PR B

**Conceito**: mapa SVG do Brasil com os 27 estados clicáveis; a criança acha
o estado pedido.

**Decisão de asset (FECHADA, com gate)**: paths derivados UMA VEZ de um mapa
do Wikimedia Commons em domínio público ou CC-BY (candidato: "Brazil,
administrative divisions" blank map). **Critério de aceite do PR**: a licença
EXATA do arquivo-fonte verificada e registrada em `docs/CREDITOS.md` (com
atribuição se CC-BY); se o arquivo candidato não for DP/CC-BY, escolher outro
— NUNCA prosseguir com licença incerta. Paths simplificados (≤2KB por UF) em
`lib/estados/mapa.ts` (`Record<UF, string>`), com nome, capital e região.

**Regras (FECHADAS)**:
- Níveis: 1 = nome → tocar ("Toque no Ceará") · 2 = capital → tocar ("Onde
  fica Salvador?") · 3 = sigla → tocar ("Toque em: BA").
- Erro: shake no estado tocado + `erro`; no **2º erro da mesma pergunta** o
  estado certo pisca 2× (scaffold — aprender, não punir) e o toque nele conta
  acerto normal.
- 8 acertos → fase completa. Estados já perguntados não repetem na fase.
- **Alvos pequenos (exceção documentada)**: DF, SE, AL, RN, PB e ES ganham
  hit-area expandida invisível (`stroke: transparent; stroke-width: 16` no
  path ou path-halo dedicado). E2E: TODA UF tem bounding box ≥ 24px na menor
  dimensão em 390px E o toque no centro do halo conta.
- data-attrs: `data-uf-pedida`, `data-acertos`; cada estado `data-uf="BA"`.

**Motor puro**: `gerarFase(nivel, seed)` (8 perguntas sem repetição),
`responder(pergunta, uf)`.

**Aceite**: unidade — 27 UFs no mapa com path não-vazio, capitais corretas
(fixture hard-coded das 27), fases sem repetição (100 seeds). E2E — acertar
via `data-uf-pedida`→`data-uf`; errar 2× e ver o scaffold piscar; halos
respondem; 3 formatos.

### 3.3 Tangram da Manu (`/tangram`) — PR C

**Conceito**: as 7 peças clássicas (2 triângulos grandes, 1 médio, 2
pequenos, 1 quadrado, 1 paralelogramo) arrastadas para montar uma silhueta.

**Regras (FECHADAS)**:
- 10 silhuetas desenhadas à mão em `lib/tangram/dados.ts` (gato, casa, barco,
  pássaro, árvore, peixe, foguete, coelho, coração, estrela), cada uma =
  lista de alvos `{ peca, x, y, rotacao, espelhado? }` num canvas lógico
  200×200. Progressão sequencial persistida (`nivel` = última silhueta).
- Interação: arrastar por pointer events (uma peça por vez); peça SELECIONADA
  (último toque) mostra 2 botões fixos: GIRAR (+45°) e ESPELHAR (só ativo no
  paralelogramo). Sem gesto de rotação por multitouch (complexo para 6 anos).
- **Encaixe (tolerâncias FECHADAS)**: snap quando o centro está a ≤ **16px
  lógicos** do alvo E a rotação equivale módulo a simetria da peça (quadrado:
  90°; triângulos: 360°; paralelogramo: 180° + estado de espelho). Peça
  encaixada trava (som `passo`), levemente escurecida.
- 7 encaixes → silhueta completa: confete + `vitoria` + próxima.
- Sem timer, sem contagem de erros — é um brinquedo de paciência.
- data-attrs: `data-encaixadas`, cada peça `data-peca` + `data-alvo-x/y/rot`
  (gancho de teste explícito, padrão `data-seq`).

**Motor puro**: `verificarEncaixe(peca, pose, alvo): boolean` (distância +
rotação modular), `SILHUETAS`.

**Aceite**: unidade — encaixe exato aceita; 17px de distância rejeita;
rotações equivalentes por simetria aceitam (quadrado a 0°=90°=180°=270°);
espelho exigido rejeita não-espelhado; 10 silhuetas usam CADA peça exatamente
1×. E2E — arrastar 1 peça até o alvo via sequência de PointerEvents com dedo
real (variante com `pointermove` do helper), snap confirmado; completar uma
silhueta inteira guiada por `data-alvo-*`; 3 formatos (peças ≥ 56px na tela —
piso próprio: as peças pequenas do tangram são menores que 72 por natureza,
exceção documentada).

### 3.4 Damas (`/damas`) — PR D

**Conceito**: damas para DOIS jogadores no mesmo aparelho (Rosa × Azul),
sem IA no v1 (decisão: IA é onda futura; jogar com o adulto/irmão é o uso
real da faixa).

**Regras da casa (FECHADAS — simplificadas para 6-10, documentadas na tela
de início)**:
- Tabuleiro 8×8, 12 peças por lado, movimento diagonal 1 casa para frente.
- Captura por pulo (frente OU trás), encadeável na mesma jogada; captura NÃO
  é obrigatória (menos frustração — decisão pedagógica explícita).
- Promoção na última linha: a dama anda e captura 1 casa em QUALQUER diagonal
  (não voadora).
- Fim: capturou tudo OU adversário sem movimento legal. Empate não existe
  (sem movimento = perdeu).
- Interação: tocar peça da vez → casas legais destacam → tocar destino.
  Captura encadeada: a mesma peça continua destacada enquanto houver pulo
  disponível; botão "parar aqui" encerra a cadeia (capturas não obrigatórias).
- Indicador de vez GRANDE (borda da tela na cor de quem joga). Vitória:
  confete + placar. Persistência: APENAS o placar acumulado de vitórias por
  cor (gaveta `damas`; `nivel` = total de partidas, `melhor` = null; o
  TABULEIRO nunca persiste — partida viva só em memória).
- data-attrs: `data-vez`, `data-pecas-rosa`, `data-pecas-azul`, casas
  `data-casa="c3"`, peças `data-dama` quando promovidas.
- **Alvos (exceção documentada)**: casas de 8×8 em 390px ≈ 44px — piso
  próprio de 44px (tabuleiro real não comporta 72), E2E valida ≥44 e
  containment.

**Motor puro** (`lib/damas/motor.ts`): `estadoInicial()`,
`movimentosLegais(estado, casa)`, `mover(estado, de, para)` (aplica captura,
promoção, troca de vez, detecta fim e cadeia disponível), tudo imutável.

**Aceite**: unidade — fixtures hard-coded: movimento simples, captura por
pulo (peça removida), captura encadeada dupla, promoção na 8ª linha, dama
capturando para trás, fim por bloqueio; jogada ilegal = mesma referência.
E2E — 2 lances de abertura alternando a vez; uma captura real no tabuleiro
inicial (sequência de lances conhecida hard-coded no teste); contadores de
peças; 3 formatos (casas ≥44px).

### 3.5 Caça-Números (`/caca`) — PR E

**Conceito**: grade 4×4 de números; a criança toca TODOS os que obedecem à
regra pedida (herdeiro do gnumch, sem o monstro — toque direto).

**Regras (FECHADAS)**:
- Níveis: 1 = pares OU ímpares (números 1-30) · 2 = múltiplos de M (M ∈ 2..9,
  números 1-60) · 3 = fatores de N (N composto ∈ {12,16,18,20,24,30,36};
  grade contém TODOS os fatores de N e distratores que não dividem N).
- Grade gerada POR CONSTRUÇÃO: entre 4 e 8 células corretas por rodada
  (invariante testada); sem números repetidos na grade.
- Tocar certo: célula vira estrela com `acerto`; errado: shake + `erro`
  (célula fica). Rodada completa quando TODOS os certos foram achados →
  `passo` + próxima. 6 rodadas → fase completa (confete).
- data-attrs: `data-instrucao` ("multiplos-de-3", "fatores-de-12",
  "pares"...), `data-restantes`, células `data-numero` + `data-estado`.

**Motor puro**: `gerarRodada(nivel, rng)`, `ehCerto(instrucao, numero)`.

**Aceite**: unidade — oráculo INDEPENDENTE no teste (reimplementa
par/múltiplo/fator) valida 200 rodadas/nível: todos os certos marcados são
certos, contagem 4-8, sem repetição, nível 3 contém todos os fatores de N.
E2E — completar uma rodada via `data-instrucao` + oráculo do teste; tocar
errado não remove; 3 formatos (células ≥72px).

## 4. Plano de entrega (ordem FECHADA)

| PR | Conteúdo |
|----|----------|
| A | BD v4 + gavetas ×5, teste de migração v4/14, **Pizza das Frações**, SW v11 |
| B | **Estados do Brasil** + `docs/CREDITOS.md` (licença do mapa verificada), hub 4/5 colunas (10º jogo), SW v12 |
| C | **Tangram da Manu**, SW v13 |
| D | **Damas**, SW v14 |
| E | **Caça-Números**, SW v15 |

Disciplina por PR idêntica às ondas 1-2: gates → intent jogado com screenshot
→ PR → review cross-model (autor≠revisor) → simplify → squash merge → deploy
verificado JOGANDO em produção antes do próximo.

## 5. Escopo negativo

- Ondas 1-2 congeladas (`components/{atelie,contas,memoria,labirinto,
  palavras,forca,relogio,lojinha,genius}/**` e respectivos `lib/`), exceto
  transversais nomeados: `lib/armazenamento.ts`, `lib/jogos.ts`,
  `public/sw.js`, `app/page.tsx`, `components/hub/CardJogo.tsx`,
  `tests/e2e/{pwa,hub,contas}.spec.ts`.
- Sem dependência nova, i18n, backend, game over, timer punitivo.
- Damas SEM IA (v1); Tangram SEM gesto multitouch de rotação.
- Mapa: NUNCA prosseguir com asset de licença incerta (gate do PR B).

## 6. Riscos

| Risco | Mitigação |
|---|---|
| Licença do mapa do Brasil | Gate explícito no PR B + CREDITOS.md |
| Estados minúsculos intocáveis | Halos de 16px + E2E de bounding box ≥24px |
| Drag do Tangram flaky no E2E | Helper de arrasto com PointerEvents (mesma técnica provada do Ateliê) + tolerância 16px |
| Damas: explosão de casos no motor | Fixtures hard-coded por regra + imutabilidade (jogada ilegal = mesma referência) |
| Hub com 14 cards | hub.spec continua o gate; densidade 4/5 colunas fechada com folga calculada |
| Float em frações | Comparação por produto cruzado, inteiros sempre |

## 7. Onda 4 — condicional (NÃO especificada; pré-condições para abrir SPEC)

| Candidato | Pré-condição para especificar |
|---|---|
| **Digitação** (adaptar [kdtype](https://github.com/steveruizok/kdtype), MIT — único caso de código third-party permitido) | A Manuela usar o app com TECLADO FÍSICO (iPad+teclado ou desktop) com alguma frequência; decidir adaptação vs reimplementação após ler o código |
| **Ciências** (FoodChain/HumanBody, ref. Sugarizer Apache) | Pipeline de arte própria definido (ilustrações de animais/corpo humano não saem de emoji; gerador de imagem ou ilustrador) |

Nenhum dos dois entra em SPEC antes de a pré-condição virar fato — mesma
regra usada para segurar a Digitação fora das ondas 2 e 3.

## 8. Próximos passos (quando o dono disparar)

1. Juiz adversarial (rodada única, padrão aprovado) sobre ESTA SPEC.
2. Revisão v1.1 com os blockers do juízo.
3. Build PR A→E com a disciplina das ondas anteriores.
