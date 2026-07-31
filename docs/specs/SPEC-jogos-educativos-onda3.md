# SPEC — Jogos Educativos Onda 3 (Frações, Estados, Tangram, Damas, Caça-Números)

> **Versão**: 1.1 — pós-juízo (rodada única, 13 blockers endereçados — ver §9).
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
  `damas`, `caca`. **Teste de migração REFORÇADO (blocker #1)**: semeia um
  banco **v3 completo** com DUAS sentinelas — desenho na `atelie` E progresso
  `nivel 4` na `contas` — e afirma, pós-upgrade: v4, as 14 gavetas (`atelie` +
  13 jogos) e AMBAS as sentinelas intactas (mutação apague-e-recrie morre).
- **`lib/armazenamento.ts` ganha `atualizarRegistro(loja, id, fn)`** —
  read-modify-write genérico numa ÚNICA transação readwrite (blocker #11:
  o placar das Damas não cabe no Progresso monotônico; incrementos exigem
  merge transacional próprio).
- **Hub com 10-14 cards — densidade FECHADA com a conta do juízo (blockers
  #2-#3)**: a mudança acontece **no PR A** (Frações é o 10º jogo). Celular:
  `grid-cols-4`, `min-h-28` (112px), `gap-2`, nome `text-xs line-clamp-2`,
  emoji `text-3xl`, Manu do header `max-h-24dvh` → 4×112+3×8+~203+~70 ≈ 761px
  ≤ 844 ✓. `sm:`: **5 colunas**, `sm:min-h-40` (160px), `sm:text-sm
  line-clamp-2`, `sm:p-3` → 3×160+2×16+~216+~80 ≈ 828px ≤ 900 ✓. `hub.spec`
  continua o gate; ajuste fino permitido só com ele verde.
- **SW v11→v15** (um bump por PR, rota no CASCA); `pwa.spec`: o poll de
  precache cresce **incrementalmente, uma rota por PR** (warning do juízo:
  exigir as 5 no PR A falharia antes de existirem); offline INTERATIVO cobre
  `/contas` + a rota mais nova de cada PR.
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
  4 opções "N'/D'". **Distratores (blocker #4 — frações próprias apenas não
  fecham para 1/2)**: candidatos podem ser qualquer N'/D' com 1 ≤ N' ≤ D' ≤ 8
  (inclui 2/2 = pizza inteira; exclui 0). Ordem determinística: complemento
  (D−N)/D (o erro clássico: contar o NÃO-pintado), (N+1)/D com teto D,
  (N−1)/D com piso 1, N/(D+1) teto 8, N/(D−1) quando N ≤ D−1, depois N/(D±2).
  **Unicidade por VALOR** (produto cruzado — 1/2 e 2/4 não convivem nas
  opções), testada em 200 rodadas/nível.
- **Nível 2 — CONSTRUIR**: pedido "Pinte N/D"; tocar fatia alterna
  pintado/despintado; botão CONFERIR sempre habilitado. **Máquina no motor
  (blocker #5)**: rodada tem fase `montando | resolvida`; `conferir(estado)`
  em `resolvida` devolve a MESMA referência (acerto duplo por toque rápido é
  impossível por construção — padrão consolidado das ondas 1-2). Certo →
  `acerto` + próxima; errado → shake + `erro`, pintura PERMANECE.
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
- **Scaffold NO MOTOR (blocker #7)**: o estado da fase carrega a pergunta
  corrente e o contador de erros DELA; `responder(fase, uf)` devolve
  `{ fase', evento: "acerto" | "erro" | "scaffold" }` — no 2º erro o evento
  `scaffold` manda o React piscar o certo 2×; corrida com o acerto morre por
  construção (evento pertence à pergunta que o gerou).
- 8 acertos → fase completa. Estados já perguntados não repetem na fase.
- **Alvos pequenos — PINOS, não halos (blocker #6: a conta do DF dá 9×5px;
  stroke de 16 não chega a 24)**: UFs cuja bounding box renderizada em 390px
  fique < 24px (DF, SE, AL e as que a conta indicar) ganham um **pino
  circular** explícito (`circle` r=14px lógicos com `data-uf`, linha-guia até
  o estado, estilo mapa escolar), desenhado ACIMA dos paths — o pino é o alvo.
  Pinos vizinhos não podem se sobrepor (offset manual + linha-guia).
- data-attrs: `data-uf-pedida`, `data-acertos`; cada estado/pino `data-uf`.

**Motor puro**: `gerarFase(nivel, seed)` (8 perguntas sem repetição),
`responder(fase, uf)` com scaffold.

**Aceite**: unidade — 27 UFs com path não-vazio; capitais corretas (fixture
das 27); fases sem repetição (100 seeds); **geometria-âncora (mata a mutação
"mapa falso")**: asserções hard-coded de ordem geográfica sobre os centroides
dos paths (RR é o mais ao norte; RS o mais ao sul; AC o mais a oeste; PB/RN
mais a leste que BA; AM a oeste de PA; DF dentro de GO) — trocar dois paths
quebra. E2E — acertar via `data-uf-pedida`→`data-uf`; errar 2× e ver o
scaffold (evento do motor); pinos respondem; TODA UF com alvo ≥24px em 390px;
3 formatos.

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
  90°; triângulos: 360°; paralelogramo: 180° + estado de espelho — e o
  INVERSO também rejeita: alvo não-espelhado recusa peça espelhada). Peça
  encaixada trava (som `passo`), levemente escurecida.
- **Conversão lógico↔tela EXPLÍCITA (blocker #8)**: o tabuleiro é um único
  `<svg viewBox="0 0 200 200">`; todo PointerEvent é convertido para
  coordenadas lógicas via `getScreenCTM().inverse()` (padrão SVG — imune a
  escala e letterbox); o drag guarda o offset de agarre EM LÓGICAS. O E2E
  converte alvos lógicos → pixels de tela via `boundingBox` do svg ×
  (alvo/200) e arrasta em pixels.
- 7 encaixes → silhueta completa: confete + `vitoria` + próxima.
- Sem timer, sem contagem de erros — é um brinquedo de paciência.
- data-attrs: `data-encaixadas`, cada peça `data-peca` + `data-alvo-x/y/rot`
  (gancho de teste explícito, padrão `data-seq`).

**Motor puro**: `verificarEncaixe(peca, pose, alvo): boolean` (distância +
rotação modular), `SILHUETAS`.

**Aceite**: unidade — encaixe exato aceita; 17px de distância rejeita;
rotações equivalentes por simetria aceitam (quadrado a 0°=90°=180°=270°);
espelho exigido rejeita não-espelhado E vice-versa; 10 silhuetas usam CADA
peça exatamente 1×; **anti-"silhueta inexistente" (blocker #9 / mutação do
juízo)**: em cada silhueta os centros das 7 peças distam ≥ 24px lógicos par a
par E a união dos bounding boxes das peças posicionadas é CONEXA (figura de
uma peça só encostada nas outras — sete peças no mesmo ponto ou espalhadas
morrem aqui). Aceite VISUAL obrigatório: o PR inclui screenshot das 10
silhuetas montadas (script de render) revisado como intent. E2E — arrastar 1
peça até o alvo com dedo real (PointerEvents com `pointermove`), snap
confirmado; completar uma silhueta guiada por `data-alvo-*` com a conversão
do §; 3 formatos (peças ≥ 56px na tela — exceção documentada).

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
  (não voadora). **Promoção ENCERRA a jogada imediatamente (blocker #10)** —
  mesmo que exista pulo disponível, a cadeia NÃO continua (regra oficial das
  damas brasileiras; fixture composta obrigatória: captura que termina na 8ª
  linha promove e passa a vez, com pulo disponível ignorado).
- Fim: capturou tudo OU adversário sem movimento legal. Empate não existe
  (sem movimento = perdeu).
- Interação: tocar peça da vez → casas legais destacam → tocar destino.
  Captura encadeada: a mesma peça continua destacada enquanto houver pulo
  disponível; botão "parar aqui" encerra a cadeia (capturas não obrigatórias).
- Indicador de vez GRANDE (borda da tela na cor de quem joga). Vitória:
  confete + placar. **Persistência (blocker #11 — o Progresso monotônico não
  comporta placar)**: registro PRÓPRIO `{ id: "placar", rosa, azul,
  atualizadoEm }` na gaveta `damas`, gravado com `atualizarRegistro` (§2 —
  incremento na MESMA transação; duas abas somam, nunca sobrescrevem). O
  TABULEIRO nunca persiste — partida viva só em memória.
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
  números 1-60) · 3 = fatores de N com **N ∈ {12, 16, 18, 20, 24, 30}**
  (blocker #12: 36 tem NOVE fatores e violaria o teto de 8; os escolhidos têm
  5-8) — a grade contém TODOS os fatores de N.
- **Domínio dos distratores FECHADO (blocker #13)**: nível 3 sorteia
  não-divisores de N em **2..60** (≥40 candidatos — 16 células únicas sempre
  possíveis); níveis 1-2 completam a grade dentro da própria faixa.
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
| A | BD v4 + gavetas ×5 + `atualizarRegistro`, teste de migração v3→v4 com sentinelas duplas, **hub 4/5 colunas** (Frações é o 10º jogo — blocker #2), **Pizza das Frações**, SW v11 |
| B | **Estados do Brasil** + `docs/CREDITOS.md` (licença do mapa verificada), SW v12 |
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

## 8. Próximos passos

~~Juiz adversarial~~ FEITO (rodada única). Build PR A→E com a disciplina das
ondas anteriores.

## 9. Registro do juízo (rodada única — 2026-07-31)

Veredito REVISE, 13 blockers — todos endereçados nesta v1.1: (1) migração
testada de v3 com sentinelas duplas; (2-3) hub muda no PR A com densidade
FECHADA pela conta do juízo (4 colunas/112px no celular + Manu 24dvh; 5
colunas/160px no sm); (4) distratores de frações podem ser impróprias ≤ 1
inteiro (complemento primeiro) com unicidade por VALOR; (5) conferir
idempotente por máquina no motor; (6) pinos escolares em vez de halos (a
conta do DF: 9×5px); (7) scaffold no motor com evento por pergunta; (8)
conversão lógico↔tela via getScreenCTM; (9) silhuetas provadas por
centros ≥24px + união conexa + screenshot das 10; (10) promoção encerra a
jogada; (11) placar via atualizarRegistro transacional; (12) 36 fora do
conjunto de N; (13) domínio de distratores 2..60. Warnings incorporados:
poll de precache incremental por PR; teste inverso do espelho; oráculo
aritmético próprio no E2E do nível 3 de frações; bytes UTF-8 no orçamento do
mapa. Mutações mortas: mapa falso (âncoras geográficas por centroide) e
tangram sem silhueta (conexidade + screenshot).
