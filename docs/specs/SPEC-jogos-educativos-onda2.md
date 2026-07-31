# SPEC — Jogos Educativos Onda 2 (Forca, Relógio, Lojinha, Genius)

> **Versão**: 1.1 (revisada após juiz adversarial — rodada única; 10 blockers endereçados, ver §7).
> **Base**: pesquisa `docs/plans/PESQUISA-jogos-onda2.md`; herda arquitetura, disciplina e lições da onda 1.
> **Repo**: `andregusman-raiz/manuela-jogos` (porta 3006, Vercel PESSOAL). Data: 2026-07-31.

---

## 1. Objetivo

4 jogos novos: **alfabetização consolidada** (Forca), **horas** (Relógio),
**dinheiro/troco em R$** (Lojinha), **memória auditiva** (Genius). Referências:
GCompris `hangman`/`clockgame`/`money` e o Simon clássico — **reimplementação
100% própria, zero código AGPL/GPL, zero dependência nova**.

Cores dos cards (FECHADO, nenhum token novo): Forca `bg-manu-ceu-claro` 🎈 ·
Relógio `bg-manu-sol/70` ⏰ · Lojinha `bg-manu-pele` 🛒 · Genius `bg-manu-ceu` 🎵.

## 2. Infra transversal (decisões FECHADAS)

- **IndexedDB v2→v3**: `LOJAS_JOGOS` ganha `forca`, `relogio`, `lojinha`,
  `genius`; o `onupgradeneeded` já itera a lista (migração aditiva confirmada).
- **Política de `onblocked` REFEITA (blocker #2 do juízo)**: o fallback
  `open(nome)` da onda 1 é INÚTIL — opens do mesmo banco são serializados e o
  segundo fica na fila atrás do upgrade bloqueado. Correção no PR A: **remover
  o fallback; `onblocked` apenas aguarda**, com comentário-invariante: TODAS as
  conexões do app (qualquer versão já publicada) são curtas (abrem, uma
  transação, fecham) e as abas novas têm `onversionchange` — bloqueio é
  transitório por construção. NUNCA introduzir conexão de vida longa.
- **Teste de migração**: `tests/e2e/contas.spec.ts` (só o teste de upgrade)
  passa a esperar **versão 3 e as 9 gavetas** — entra no escopo permitido.
- **Sons**: Genius adiciona `nota1..nota4` ao union + 4 receitas juntas
  (sine 523.25/659.25/783.99/1046.5 Hz, dur 0.28, vol 0.2) no PR D —
  `RECEITAS: Record<Efeito, …>` é exaustivo, o typecheck cobra.
- **Service worker**: um bump por PR (v7→v10) + rota no `CASCA`. `pwa.spec`:
  o poll de precache cobre TODAS as rotas; o teste offline INTERATIVO (abre e
  responde a toque) cobre `/contas` + **a rota mais nova da onda a cada PR**
  (HTML precacheado sem chunk não passa — disciplina da onda 1).
- **Hub com 9 jogos (blocker #3, com a conta do juízo)**: já no **PR A** o grid
  vira `grid-cols-3` em TODOS os formatos (2 colunas × 7+ cards estoura a dobra
  no desktop: 4 linhas × 192px + header > 900px). Nome `text-sm` no celular.
  `hub.spec.ts` continua sendo o gate em todos os PRs.
- **E2E**: padrão da onda 1 (dedo, 3 formatos, confete `data-ativo`,
  persistência, containment no viewport).
- **Piso de toque**: 72px em alvos de jogo; exceção ÚNICA: teclado da Forca
  (§3.1) com piso 48px e layout fechado.

## 3. Jogos

### 3.1 Forca da Manu (`/forca`) — PR A

**Conceito**: adivinhar a palavra letra a letra. 6 balões 🎈; cada erro estoura
um (som `erro`); estourar todos revela a palavra ("Era GATO!", som `vazio`) e
**a fila avança** — nunca game over. Emoji da palavra visível como dica.

**Regras (FECHADAS)**:
- Reusa `lib/palavras/dados.ts` (62 palavras — import read-only). Níveis:
  1 = palavras nível 1 · 2 = nível 2. Fase = 6 palavras sem repetição.
- **Fase termina após 6 palavras APRESENTADAS** (ganhas ou reveladas) —
  blocker #4: derrota também avança. Tela final: confete + "Você acertou X de
  6!" (neutro). "Mais difícil" aparece com **≥4 ganhas** (senão só "De novo");
  `nivel` persiste apenas ao subir. `melhor` = null.
- **Teclado (layout FECHADO — blocker #5)**: grid de **6 colunas fixas**
  (linhas 6/6/6/6/2), teclas `48×48px` mínimo, gap 6px → bloco de 318×264px,
  cabe em 358px úteis. Ordem alfabética A-Z fixa. Tecla usada: `disabled`
  (acerto verde-grama, erro rosa). E2E: as 26 teclas ≥48px **e dentro do
  viewport** nos 3 formatos.
- **Acentos de graça**: casamento por letra-base (NFD sem diacrítico): A revela
  Á/Ã/Â, C revela Ç. `QU` são duas letras normais (sem tratamento especial).
  A palavra exibe o caractere real.
- data-attrs: `data-palavra`, `data-erros`, `data-jogadas`, `data-ganhas`.

**Motor puro** (`lib/forca/motor.ts`): `gerarFase(nivel, seed)`,
`tentar(estado, letra)` (repetida = no-op por referência; acerto revela todas
as ocorrências da base; 6º erro → palavra `revelada` e avança), `ERROS_MAXIMOS = 6`.

**Aceite**: unidade — A revela o Ã de AVIÃO e C o Ç de PALHAÇO (NFD); letra
repetida não conta 2º erro; 6º erro revela e a fase SEGUE até 6 jogadas mesmo
perdendo todas; 100 seeds sem palavra repetida. E2E — fluxo do card ao confete
via `data-palavra`; perder 1 palavra inteira e chegar ao confete mesmo assim;
teclado ≥48px + containment nos 3 formatos.

### 3.2 Relógio Mágico (`/relogio`) — PR B

**Conceito**: relógio analógico SVG próprio; a criança lê e escolhe entre 4
opções digitais ("7:30", formato 1-12).

**Regras (FECHADAS)**:
- Níveis: 1 = hora cheia · 2 = :00/:15/:30/:45 · 3 = grade de 5 em 5 min.
- **Algoritmo de distratores (FECHADO — blocker #6)**, tudo NA GRADE DO NÍVEL,
  ordem determinística, descartando colisões: (1) hora+1 mesmo minuto;
  (2) hora−1 mesmo minuto; (3) "leitura trocada" QUANTIZADA: hora' =
  round(minuto/5) lido NO MOSTRADOR (0 → 12: com minuto 0 o ponteiro aponta
  para o 12, e é "12" que a criança lê — não clamp para 1), minuto' =
  (hora%12)×5 arredondado à grade do nível; (4) minuto vizinho na grade (±15 no nível 2, ±5 no 3; nível 1 usa
  hora±2). Preenche com hora±2 se ainda faltar. Teste de unidade prova 4 únicas
  na grade em 200 rodadas/nível.
- Ângulos (o que ensina): minuto = m×6°; hora = (h%12)×30° + m×0.5° — o
  ponteiro de hora ANDA com os minutos.
- 8 acertos → fase completa. Erro: shake + `erro`, relógio não muda.
- data-attrs: `data-hora="7:30"`, `data-acertos`, e os ponteiros com
  `data-graus-hora`/`data-graus-minuto`.
- **Anti-mutação "relógio mentiroso" (do juízo)**: o E2E lê o `transform`
  COMPUTADO dos ponteiros no DOM e confere com `data-hora` (7:30 → 225°/180°)
  — motor certo com SVG errado falha.

**Motor puro**: `gerarRodada(nivel, rng)` → `{ hora, minuto, rotulo, opcoes,
angulos }`.

**Aceite**: unidade — 200 rodadas/nível: rótulo↔hora/minuto consistentes,
4 opções únicas na grade do nível, ângulos exatos hard-coded (7:30 → 225/180;
3:00 → 90/0), nível 1 sempre m=0. E2E — fluxo completo via `data-hora` +
verificação do transform; 3 formatos.

### 3.3 Lojinha da Manu (`/lojinha`) — PR C

**Conceito**: comprar com dinheiro brasileiro ESTILIZADO (SVG próprio:
retângulos coloridos com o valor para notas — 2 azul, 5 roxo, 10 vermelho,
20 amarelo — e círculos para moedas; **PROIBIDO reproduzir arte real do BC**).

**Regras (FECHADAS)**:
- **Carteira infinita** (peças reutilizáveis sem limite — decisão fechada).
- **Preço construído por soma (blocker #7)**: o motor SORTEIA 2-5 peças do
  nível e o preço É a soma — pagável por construção, sem greedy, sem R$3
  impagável. Peças por nível: 1 = notas {2,5,10,20} · 2 = notas + moedas
  {0.25, 0.50, 1} · 3 = idem nível 2 para o preço.
- **Nível 3 (troco, blocker #8)**: pagamento = **menor valor em {5,10,20}
  estritamente maior que o preço** (preço sorteado em 1.00–18.75) → troco
  sempre > 0. 4 opções: troco certo, ±0.25/±1 na grade, preço (o erro
  clássico), únicas e ≥0.
- Níveis 1-2: tocar peça soma no visor (`data-soma`); tocar peça DO VISOR
  devolve (peça ausente = no-op por máquina); soma > preço → visor treme +
  `erro` e a última peça volta sozinha; soma == preço habilita PAGAR
  (`acerto`; PAGAR trava até a próxima rodada — sem pagamento duplo).
- 8 compras → fase completa. Banco de 24 produtos (emoji + nome PT-BR).
- Dinheiro em centavos INTEIROS no motor (nunca float).
- data-attrs: `data-preco` (centavos), `data-soma`, `data-acertos`.

**Motor puro**: `gerarRodada(nivel, rng)`, `somar/devolver` (máquina),
`ehTrocoCerto`.

**Aceite**: unidade — **oráculo independente**: DP de subset-sum com repetição
ESCRITO NO TESTE confirma que 200 preços/nível são pagáveis com as peças do
nível; troco = pagamento−preço > 0 sempre; devolver peça ausente = no-op;
pagar 2× = no-op; tudo em centavos inteiros. E2E — comprar pagando exato;
estourar o preço e ver a devolução automática; nível 3 via progresso salvo;
3 formatos.

### 3.4 Genius dos Sons (`/genius`) — PR D

**Conceito**: Simon — 4 quadrantes (rosa, céu, sol, grama), cada um com a sua
nota. O app mostra; a criança repete.

**Regras (FECHADAS)**:
- `criarPartida(seed)` **pré-gera a sequência inteira até 8** (mulberry32);
  a rodada N usa o prefixo de tamanho N — crescimento determinístico por
  construção (blocker #9).
- Máquina COMPLETA no motor: estados `mostrando(indice) | ouvindo(posicao) |
  fase-completa`; eventos: `avancarReplay` (mostra o próximo item; após o
  último → `ouvindo`), `ouvir(botao)` (certo avança posição; sequência inteira
  → prefixo+1 e volta a `mostrando`, ou `fase-completa` aos 8; errado →
  `mostrando` do MESMO prefixo, posição zerada). Toque em `mostrando` = no-op
  por referência. O componente só agenda timers de 450ms chamando
  `avancarReplay` e pinta o item corrente.
- Começa com 2; fase completa ao repetir 8 (confete + `vitoria`).
  `nivel` = maior prefixo repetido (helper monotônico já cobre); `melhor` null.
- Quadrantes ≥120px no celular (2×2 = 252px em 358 úteis — conta do juízo ✓),
  flash via `data-aceso="true"` + nota.
- data-attrs: `data-seq` (sequência completa, ex. "0,2,1,3,…" — mesma decisão
  do `data-par`/`data-resposta`: gancho de teste explícito), `data-tamanho`,
  `data-fase-genius`.
- **Anti-mutação "Genius mudo" (do juízo)**: o E2E instala `addInitScript` que
  envelopa `AudioContext.prototype.createOscillator` num contador; ao fim do
  replay o contador tem de ser > 0 — visual sem som falha.

**Aceite**: unidade — toque em `mostrando` no-op (referência); erro mantém o
prefixo e zera a posição; acerto integral cresce exatamente 1; seed
determinístico; completa aos 8. E2E — jogar lendo `data-seq` esperando
`data-fase-genius="ouvindo"` (sem MutationObserver de timing); erro proposital
no meio prova replay-sem-encolher; osciladores > 0; 3 formatos.

## 4. Plano de entrega (ordem FECHADA)

| PR | Conteúdo |
|----|----------|
| A | BD v3 + política onblocked refeita + teste de migração atualizado, hub `grid-cols-3`, **Forca**, SW v7 |
| B | **Relógio Mágico**, SW v8 |
| C | **Lojinha da Manu**, SW v9 |
| D | **Genius** + `nota1..4` em som.ts, SW v10 |

Cada PR: gates → intent jogado com screenshot → PR → review cross-model →
simplify → squash merge → deploy verificado JOGANDO em produção.

## 5. Escopo negativo

- Onda 1 congelada: `components/{contas,memoria,labirinto,palavras}/**` e
  `lib/{contas,memoria,labirinto,palavras}/**` — exceto import read-only de
  `lib/palavras/dados.ts` pela Forca.
- Transversais permitidos: `lib/armazenamento.ts`, `lib/som.ts`,
  `lib/jogos.ts`, `public/sw.js`, `app/page.tsx`,
  `components/hub/CardJogo.tsx`, `tests/e2e/{pwa,hub,contas}.spec.ts`
  (contas: SÓ o teste de migração).
- Sem dependência nova, i18n, backend, game over, timer punitivo, arte real de
  cédulas, Ateliê/colorir.

## 6. Riscos

| Risco | Mitigação |
|---|---|
| Blocked de IndexedDB em cenários não previstos | Invariante "conexões sempre curtas" documentada no código; teste manual de 2 abas segue pendente (herdado da onda 1) |
| Teclado da Forca no 390px | Layout fixo 6 colunas + E2E de containment |
| Distratores do Relógio colidirem | Algoritmo determinístico com descarte + teste de unicidade |
| Float em dinheiro | Centavos inteiros no motor, testado |
| Replay do Genius flaky no E2E | Sem observer: `data-seq` + espera de estado |

## 7. Registro do juízo (rodada única — 2026-07-31)

Veredito REVISE, 10 blockers — todos endereçados nesta v1.1: (1) teste de
migração entra no escopo e espera v3/9 gavetas; (2) fallback de onblocked
removido (opens serializados o tornavam inócuo) → política "aguardar + 
invariante de conexões curtas"; (3) hub vai a 3 colunas já no PR A com a conta
do juízo; (4) derrota na Forca avança a fila e a fase fecha em 6 jogadas;
(5) teclado com layout fixo 6×48px + containment no E2E; (6) distratores do
relógio com algoritmo determinístico quantizado à grade; (7) preço construído
por soma + oráculo DP no teste (greedy descartado — {2,5,10,20} não é
canônico); (8) pagamento sempre estritamente maior que o preço → troco > 0 +
máquinas de devolver/pagar; (9) máquina do Genius completa no motor com
sequência pré-gerada e E2E por `data-seq`; (10) offline interativo cobre a
rota mais nova de cada PR. Warnings: banco tem 62 palavras (corrigido no
texto); `Record<Efeito,…>` exige as 4 receitas juntas (planejado assim).
Mutações mortas: relógio mentiroso (transform computado no E2E) e Genius mudo
(contador de osciladores).
