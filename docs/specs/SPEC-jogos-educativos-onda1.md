# SPEC — Jogos Educativos Onda 1 (4 novos jogos PT-BR no hub)

> **Versão**: 1.1 (revisada após juiz adversarial — ver §10).
> **Status**: pronta para build (juiz Codex rodada 1 = REVISE com 11 blockers; todos endereçados nesta versão; sem nova rodada por decisão do dono).
> **Repo**: `andregusman-raiz/manuela-jogos` (`~/Claude/GitHub-pessoal/manuela-jogos`, porta 3006, Vercel escopo PESSOAL).
> **Data**: 2026-07-30.

---

## 1. Objetivo

Expandir o Manuela Jogos (hoje: só o Ateliê da Manu) com **4 mini-jogos educativos** para a faixa 6-10 anos, inspirados nos melhores jogos open source levantados no GitHub (pesquisa 2026-07-30), **reimplementados nativamente em PT-BR** dentro da arquitetura existente do app.

| # | Jogo | Ensina | Mecânica de referência (open source) |
|---|------|--------|--------------------------------------|
| 1 | **Foguete das Contas** (`/contas`) | Aritmética: soma, subtração, tabuada | TuxMath (tux4kids/tuxmath, GPL) — meteoros com contas caindo |
| 2 | **Jogo da Memória** (`/memoria`) | Memória visual + pares conta↔resultado | GCompris "memory" (AGPL) / Sugarizer "memorize" (Apache) |
| 3 | **Labirinto da Manu** (`/labirinto`) | Lógica e sequenciamento (pré-programação) | Blockly Games "Maze" (Apache-2.0) / GCompris "programming maze" |
| 4 | **Palavra Mágica** (`/palavras`) | Alfabetização PT-BR: letra/sílaba faltante | GCompris "missing letter" (AGPL) / Antura (BSD) |

## 2. Decisão de licenciamento (FECHADA)

**Nenhuma linha de código e nenhum asset de terceiros entra no repo.** Os projetos de referência são AGPL/GPL (contaminariam o código) ou usam engines incompatíveis (Qt, Unity). O que se aproveita é **mecânica e desenho pedagógico** — não protegidos por copyright. Consequências:

- Reimplementação 100% própria, seguindo a regra já vigente do repo: **zero dependência de runtime além de Next/React** (nada de Blockly, Phaser, howler etc.).
- Arte: emojis literais + ícones SVG próprios (padrão `components/ui-kids/Icone.tsx`) + poses existentes da Manu. Nenhum sprite/som baixado.
- Tradução: não há "tradução" de strings de terceiros — todo texto nasce em PT-BR (o app é PT-BR nativo, sem framework i18n; **não introduzir i18n**).
- Se um dia importar código de fora: só Apache-2.0/BSD/MIT, com atribuição em `docs/CREDITOS.md` (fora do escopo desta onda).

## 3. Arquitetura (decisões FECHADAS — seguem o padrão do Ateliê)

### 3.1 Estrutura por jogo

Cada jogo replica o contrato do Ateliê (rota fina + componente client + lógica pura testável):

```
app/<rota>/page.tsx              # server component fino: Metadata + monta o componente
components/<jogo>/<Jogo>.tsx     # client component raiz (tela única com estados internos)
lib/<jogo>/motor.ts              # lógica PURA (gera rodadas, valida resposta, avança nível) — sem DOM
lib/<jogo>/tipos.ts              # types do jogo
lib/<jogo>/dados.ts              # bancos estáticos (palavras, fases do labirinto) quando houver
tests/unidade/<jogo>.test.ts     # vitest sobre o motor puro
tests/e2e/<jogo>.spec.ts         # playwright com helper de toque de dedo (§6.2)
```

Nomes de arquivo/símbolos em PT-BR, como todo o repo (`motor`, `rodada`, `acertou`, …).

### 3.2 Registro no hub — `lib/jogos.ts`

Adicionar 4 entradas ao array `JOGOS`. O card `em-breve` **permanece até o PR D e é removido no PR D** (decisão única — enquanto a onda estiver incompleta, ele sinaliza que vem mais). Entradas exatas:

```ts
{ id: "contas",    nome: "Foguete das Contas", descricao: "Contas de somar e tabuada", rota: "/contas",    emoji: "🚀", cor: "bg-manu-ceu",   disponivel: true },
{ id: "memoria",   nome: "Jogo da Memória",    descricao: "Encontre os pares",         rota: "/memoria",   emoji: "🃏", cor: "bg-manu-sol",   disponivel: true },
{ id: "labirinto", nome: "Labirinto da Manu",  descricao: "Guie a Manu até a estrela", rota: "/labirinto", emoji: "⭐", cor: "bg-manu-grama", disponivel: true },
{ id: "palavras",  nome: "Palavra Mágica",     descricao: "Complete as palavras",      rota: "/palavras",  emoji: "🔤", cor: "bg-manu-nuvem", disponivel: true },
```

- **`bg-manu-grama` não existe hoje** (`manu-chama` no globals.css é keyframe de animação, não cor). O PR C cria o token `--color-manu-grama` em `app/globals.css` (verde-folha suave, mesma saturação da família `manu-*`, contraste AA com `manu-cacau`). Nenhuma outra cor nova.
- O grid do hub (`app/page.tsx`) já é `sm:grid-cols-2` e renderiza do manifesto — **não tocar no layout do hub** além do que 5-6 cards exigirem (se estourarem a altura em 360×640, scroll vertical natural; não redesenhar).

### 3.3 Sons — `lib/som.ts`

Estender o union `Efeito` com 4 efeitos sintetizados (mesma técnica WebAudio, sem arquivos):

- `acerto` — arpejo curto ascendente (recompensa imediata, mais contido que `salvar`)
- `erro` — tom grave suave, 1 nota (aviso, **não punição** — mesmo espírito do `apagar`)
- `vitoria` — fanfarra curta (fim de fase; pode reusar a curva do `salvar` com variação)
- `passo` — clique percussivo curto (cada passo da Manu no labirinto / carta virando)

**Correção junto (PR A)**: `tocar()` hoje chama `ctx.resume()` sem aguardar — o 1º som após contexto suspenso pode se perder (`lib/som.ts:82` e `:133`). Passar a aguardar o `resume()` (ou agendar o efeito no `then`) antes do primeiro agendamento. Comportamento de mudo e API pública inalterados.

### 3.4 Persistência — `lib/armazenamento.ts`

- `VERSAO_BD: 1 → 2`. No `onupgradeneeded`, criar as gavetas que faltarem: `contas`, `memoria`, `labirinto`, `palavras` (keyPath `id`, índice `atualizadoEm`), mantendo `atelie` intacta (migração aditiva; upgrade v1→v2 não pode tocar dados existentes).
- **Política de duas abas (nova, obrigatória no PR A)** — hoje `abrir()` não trata `onblocked`/`onversionchange` (`armazenamento.ts:26`):
  - `onversionchange`: fechar a conexão imediatamente (deixa a outra aba fazer o upgrade).
  - `onblocked`: rejeitar após 3s. Os helpers de progresso tratam rejeição como **"sem persistência nesta aba"**: o jogo roda normalmente em memória, nada trava, nada de UI de erro para a criança.
- Registro único por jogo: `{ id: "progresso", nivel: number, melhor: number | null, atualizadoEm: number }`.
  - `nivel` = maior nível/fase alcançado. `melhor` só tem semântica na **Memória** (menor nº de tentativas da fase mais alta concluída); nos demais jogos fica `null`. Valor inicial de `melhor` = `null` (**nunca 0** — `min` com 0 congelaria o recorde).
  - `salvarProgresso` é **monotônico**: grava `nivel = max(gravado, novo)` e `melhor = min` ignorando `null`. Duas abas nunca regridem progresso.
- Expor helpers genéricos `lerProgresso(loja)` / `salvarProgresso(loja, progresso)` (não duplicar `openDB`).

### 3.5 UI compartilhada (reusar, não criar)

- **Botões de ação**: só `BotaoBolha` (piso 72px; `xl` 88px para ações principais) e `BotaoSegurar` para qualquer ação destrutiva.
- **Voltar ao hub**: `BotaoBolha` NÃO aceita `href` — o padrão real do repo é **`Link` estilizado com a classe `bolha`** (`components/atelie/Atelie.tsx:389`: `Link` + `aria-label` + `onPointerDown={() => feedback("toque")}`). Replicar exatamente esse padrão. **Proibido** aninhar `<button>` dentro de `<a>`.
- **Cabeçalho** de cada jogo: voltar (padrão acima, com `Manu pose="rosto"`), título `font-titulo text-manu-cacau` oculto em telas estreitas, botão de mudo.
- **Recompensa**: `Confete` no fim de fase + pose da Manu. **O componente `Confete` ganha `data-ativo="true|false"`** refletindo se há partículas vivas — é o gancho de asserção do E2E (o canvas está sempre no DOM; `toBeVisible()` não prova nada — ver §6.2).
- **Erro sem texto**: shake + som `erro` (padrão já vigente). Texto só para o adulto.
- **Animações**: pulses/loops SEMPRE via box-shadow/opacity — **NUNCA `scale` em animação contínua de botão** (quebra o click do Playwright; gotcha documentado do repo).

## 4. Especificação por jogo

### 4.1 Foguete das Contas (`/contas`)

**Conceito**: contas descem do topo da tela dentro de meteoros; a criança toca a resposta certa entre **4 bolhas** fixas na base; acertar dispara o foguete da Manu que estoura o meteoro (confete pequeno + `acerto`).

**Regras (FECHADAS)**:
- Níveis: 1 = soma até 10 · 2 = soma/subtração até 20 (**subtração sempre `a ≥ b` — resultado nunca negativo**) · 3 = tabuada do 2 ao 5 · 4 = tabuada do 6 ao 9 · 5 = **mistura uniforme dos níveis 1-4** (cada rodada sorteia o tipo com probabilidade igual; faixas de operandos idênticas às do nível de origem). Nível inicial = último salvo.
- 1 meteoro por vez (sem fila — tela limpa, foco único). Descida lenta: 12s do topo à base no nível 1, −1s por nível (piso 8s).
- **Máquina de estados da rodada (obrigatória no motor)**: `caindo → resolvida | quicou`. A transição é **atômica**: o primeiro evento (toque certo OU chegada à base) vence; o outro é ignorado. Acertar **cancela o timer** de descida. Após o 10º acerto o estado vira `fase-completa` e **nenhum meteoro novo é criado**. Sem essa máquina, toque e `animationend` no mesmo frame contam acerto+erro ou duplicam rodada — blocker do juízo.
- Meteoro que chega à base NÃO explode nada: quica, some com som `erro` suave e a mesma conta volta ao topo mais devagar. Nunca "game over".
- 10 acertos → fase completa: `Confete` + `vitoria` + Manu comemora; oferece "de novo" ou "mais difícil" (avança nível, persiste).
- Respostas erradas nas bolhas: distratores plausíveis (±1, ±10, troca de dígitos), únicos entre si e ≥ 0.
- Erro ao tocar bolha errada: shake na bolha + `erro`; meteoro continua (a criança pode tentar de novo).

**Motor puro** (`lib/contas/motor.ts`): `gerarRodada(nivel, seed): { conta: string; resposta: number; opcoes: number[] }` + `resolver(estado, evento): estado` (a máquina de estados acima) + `proximoNivel`. Determinístico sob seed injetável.

**Aceite específico**: em `tests/unidade/contas.test.ts` — (a) 200 rodadas por nível: resposta presente, 4 opções únicas ≥0, operandos na faixa, subtração sem negativo; (b) máquina de estados: evento `toque-certo` seguido de `chegou-base` (e vice-versa) produz exatamente 1 transição; após `fase-completa`, evento `spawn` é rejeitado.

### 4.2 Jogo da Memória (`/memoria`)

**Conceito**: cartas viradas para baixo; toque revela; dois iguais somem com `acerto`; diferentes viram de volta após 900ms com `passo`.

**Regras (FECHADAS)**:
- Nível 1: 6 pares emoji (grid 3×4) · Nível 2: 8 pares emoji (4×4) · Nível 3: 6 pares **conta↔resultado** (ex.: "3×4" casa com "12").
- **Pareamento por `parId` explícito** no modelo da carta — nunca por igualdade visual. No nível 3 o gerador garante **resultados únicos na fase** (duas contas com o mesmo resultado são proibidas — senão "3×4" casaria com o "12" de "2×6").
- **Máquina de estados do tabuleiro (obrigatória no motor)**: `livre → uma-aberta → resolvendo`. Em `resolvendo` (2 cartas abertas, janela de 900ms) **todo toque é ignorado**. Tocar carta já aberta ou já removida é no-op em qualquer estado. **Tentativa = par revelado** (entra em `resolvendo`), nunca toque avulso.
- Emojis literais do repertório da criança, sorteados de um banco fixo de 24 no `dados.ts`.
- Cartas com aspect-ratio em grid: **`auto-rows` explícita obrigatória** (gotcha documentado: rows colapsam a ~18px).
- Flip por transform pontual (transição única, não animação infinita). Alvo de cada carta ≥72px **no viewport de 390px** (iPhone 13, o menor dos projects — não 412).
- Fim de fase: confete + "Você achou todos!" (neutro, sem ranking). Persistir `melhor` = menor nº de tentativas (inicial `null`, §3.4).
- Nível 3: cartas de conta com fundo `bg-manu-ceu-claro`, cartas de resultado com fundo branco (pareamento visual explícito).

**Motor puro**: `embaralhar(nivel, seed)` + `tocar(estado, indiceCarta): novoEstado` — a máquina de estados inteira fora do React; os 900ms são um evento `fechar` injetado, não um `setTimeout` dentro do motor.

**Aceite específico**: unidade — sequência `tocar(A) tocar(B) tocar(C)` com A≠B: C é ignorado enquanto `resolvendo`; `tocar(A) tocar(A)` conta 1 revelação; nível 3 gerado 100× nunca tem resultado duplicado.

### 4.3 Labirinto da Manu (`/labirinto`)

**Conceito**: grid com a Manu, paredes e uma estrela. A criança monta uma **fila de comandos** e aperta ▶; a Manu executa passo a passo com som `passo`.

**Regras (FECHADAS)**:
- **Semântica dos comandos (fechada — era ambígua)**: 3 comandos — `frente` (avança 1 célula na direção atual), `girar-esquerda` e `girar-direita` (**giro puro de 90°, NÃO avança**). É o modelo do Blockly Games Maze: giro relativo é o que se ensina.
- **Cada fase declara `direcaoInicial`** (`norte|sul|leste|oeste`) nos dados, além da matriz de células (parede/livre/manu/estrela). O render mostra a Manu **rotacionada na direção atual** o tempo todo — a criança precisa ver para onde ela aponta.
- 10 fases desenhadas à mão em `lib/labirinto/dados.ts`, progressão: 3×3 sem parede → 7×7 com becos. Fase liberada sequencialmente; a última alcançada persiste.
- Fila máx. 12 comandos, mostrada como bolhas removíveis (tocar remove; sem drag-and-drop).
- Bater na parede: execução para, Manu balança (shake) + `erro`, volta à posição/direção inicial **mantendo a fila** para editar.
- Chegar na estrela: `vitoria` + confete + próxima fase. Fila esgotada sem estrela: mesmo tratamento do erro de parede (sem punição).
- Execução: 1 passo a cada 450ms; botões desabilitados durante execução (estado `executando`).

**Motor puro**: `executar(fase, fila): { passos: Passo[]; resultado: "estrela" | "parede" | "fim-da-fila" }` — simulação síncrona sobre estado (posição, direção); o componente só anima a lista de passos.

**Aceite específico (com oráculo independente — mata a mutação apontada pelo juízo)**:
- Solver BFS sobre (posição, direção) prova que as 10 fases têm solução com ≤12 comandos.
- **Fixtures com solução ótima hardcoded no teste, escritas à mão** (independentes do motor): fase 1 resolve com exatamente `[frente, frente]`; uma fase de giro resolve com `[frente, girar-direita, frente]` e **falha** com `[frente, esquerda-como-deslocamento-absoluto]`. Se o builder implementar esquerda/direita como deslocamento absoluto, este teste quebra — o solver sozinho não pega (ele validaria a semântica errada contra ela mesma).

### 4.4 Palavra Mágica (`/palavras`)

**Conceito**: emoji grande + palavra com lacuna (`G_TO` 🐈); a criança escolhe a letra certa entre 4 bolhas.

**Regras (FECHADAS)**:
- Banco mínimo de **60 palavras PT-BR** em `lib/palavras/dados.ts`, cada uma **`{ palavra, emoji, nivel, silabas: string[] }`** — a segmentação silábica é **escrita à mão no banco** (PÁS-SA-RO, CHU-VA…), nunca derivada por algoritmo (separação silábica PT-BR algorítmica erra dígrafos e encontros — blocker do juízo). Vocabulário concreto de 6-10 anos; sem acento no nível 1 (GATO, BOLA, PATO…), acento/dígrafos no nível 2.
- Nível 1: 1 letra faltante (posição sorteada) · Nível 2: palavras maiores/dígrafos · Nível 3: **sílaba faltante** entre 4 opções.
- Distratores de letra: visualmente/foneticamente próximas (P/B, T/D, F/V, M/N) quando existirem. **Distratores de sílaba**: sorteados das sílabas de OUTRAS palavras do banco com o mesmo nº de letras (regra determinística, sem inventar sílabas).
- **Contrato anti-repetição (fechado — era impossível na v1)**: o motor gera a **fase inteira** de uma vez: `gerarFase(nivel, seed): Rodada[]` com 8 rodadas **sem palavra repetida**. Não existe `gerarRodada` avulsa.
- Acertou: a letra/sílaba voa para a lacuna, palavra completa pisca + `acerto`; 8 palavras → fase completa (confete).
- Errou: shake na bolha + `erro`; a palavra permanece (a criança tenta até acertar).
- Tipografia: palavra em caixa alta, `font-titulo`, ≥ `text-4xl`.

**Motor puro**: `gerarFase(nivel, seed)` + `responder(rodada, opcao): boolean`.

**Aceite específico**: unidade — 100 fases geradas por nível: 8 palavras únicas, lacuna válida, 4 opções únicas contendo a correta; nível 3 usa exatamente as sílabas do campo `silabas`; banco tem ≥60 itens e toda palavra é igual à concatenação das suas sílabas.

## 5. Plano de entrega — 1 PR por jogo (ordem FECHADA)

| PR | Conteúdo | Por quê nessa ordem |
|----|----------|---------------------|
| A | Infra transversal: `Efeito` novos + await resume em som.ts, `VERSAO_BD=2` + política de duas abas + helpers de progresso, **atualização de `tests/e2e/pwa.spec.ts`** (§6.3), `data-ativo` no Confete, helper de toque `tests/e2e/_toque.ts`, entrada `contas` no manifesto + **Foguete das Contas** completo | Upgrade de BD, sons e helpers saem junto do 1º consumidor (regra do repo: nada registrado sem caller) |
| B | Jogo da Memória | Menor risco, reusa infra do PR A |
| C | Labirinto da Manu + token `--color-manu-grama` | Maior superfície nova (execução animada) |
| D | Palavra Mágica + **remoção do card `em-breve`** | Fecha a onda com o hub definitivo |

Cada PR: feature branch + conventional commit EN (`feat(contas): …`), squash merge, **todos os gates verdes antes de abrir**.

## 6. Testes e critérios de aceite (verificáveis)

### 6.1 Gates do repo (obrigatórios em cada PR)

```bash
bun run typecheck   # esperado: exit 0
bun run lint        # esperado: exit 0
bun run test        # esperado: exit 0 (unidade, inclui novos tests/unidade/<jogo>.test.ts)
bun run test:e2e    # esperado: exit 0 nos projects android + iphone (porta 3006)
```

### 6.2 E2E por jogo (`tests/e2e/<jogo>.spec.ts`)

1. **Toque com dedo**: o `tocarComDedo` do `atelie.spec.ts` é **acoplado à `.tela-desenho` e não dispara `click`** — não é extraível como está. O PR A cria helper NOVO `tests/e2e/_toque.ts`: `tocarNoElemento(page, locator, contato = 80)` que resolve o elemento pelo locator e despacha `pointerdown` + `pointerup` **+ `click` sintético** com `width/height` de dedo real (70-90px) — `BotaoBolha` age no `onClick`, então sem o `click` a interação não acontece. O helper do atelie.spec fica intocado. Interações de jogo NUNCA usam `tap()`/`click()` puros do Playwright (contato de 1px passa por filtro de palma — lição documentada).
2. **Três formatos por spec**: seguir o padrão já existente do `atelie.spec.ts:383` — **um `browser.newContext` por formato** (celular 390×844, tablet 820×1180, desktop 1440×900), NUNCA `setViewportSize` no meio do teste (a emulação mobile do project não vira desktop de verdade; contexto novo por formato é o padrão provado do repo). Asserção mínima por formato: elementos interativos visíveis e alvo ≥72px via `boundingBox` — **incluindo o viewport de 390px** (iPhone 13, o piso real).
3. **Fluxo feliz completo**: card do hub → jogar até completar 1 fase → **`Confete` com `data-ativo="true"`** (asserção de atributo, não `toBeVisible()` — o canvas está sempre no DOM e "visível" mesmo sem partícula; blocker do juízo) → voltar ao hub.
4. **Fluxo de erro**: resposta errada NÃO avança e NÃO destrói estado (fila do labirinto mantida, palavra mantida).
5. **Persistência**: completar fase → recarregar página → nível salvo restaurado (IndexedDB).

### 6.3 PWA/offline — atualização obrigatória no PR A

- **`tests/e2e/pwa.spec.ts:74` abre `indexedDB.open("manu-jogos", 1)` com versão fixa** — após o upgrade para v2 isso gera `VersionError` e, sem `onerror` na Promise do teste, trava até timeout. O PR A muda o teste para abrir **sem versão** e adiciona `onerror`/`onblocked` com reject. Este é o primeiro item do PR A — sem ele, `bun run test:e2e` quebra no próprio PR.
- O teste hoje procura cache `manu-app-v1` mas o SW ativo usa `v2` (`public/sw.js:18`) — a asserção degrada para "existe controlador", que não prova precache. O PR A **importa/lê o nome real do cache** (constante única) em vez de hardcode.
- Asserção offline das rotas novas: com SW ativo, cada rota nova abre offline **e responde a um toque** após reload frio (HTML precacheado com chunks não-cacheados renderiza mas não interage — a asserção de toque pega isso). **Limitação registrada**: o teste offline pula WebKit (`pwa.spec.ts:13`), então offline é provado só no project android; no iPhone a validação é manual (aceito pelo dono — app da filha, risco baixo).

### 6.4 Auditoria final da onda (Definition of Done)

- [ ] 4 jogos no hub, jogáveis do card ao confete em celular (390px), tablet e desktop
- [ ] Todo texto do app em PT-BR; nenhuma string em inglês visível
- [ ] `grep -riE "blockly|phaser|howler" package.json` → vazio (zero dependência nova)
- [ ] Nenhum arquivo copiado de repo de terceiros (`git log --stat` dos PRs só contém código próprio)
- [ ] Gavetas novas no IndexedDB sem perda de dados do Ateliê (abrir app com galeria populada antes/depois do upgrade v1→v2)
- [ ] Duas abas abertas simultaneamente: nenhuma trava; progresso nunca regride (teste manual guiado)

## 7. Escopo negativo (o que NÃO tocar)

- **Não tocar** em `components/atelie/**`, `lib/desenho/**`, `lib/colorir/**` (o Ateliê acabou de estabilizar — congelado nesta onda). Exceções explícitas desta SPEC: `lib/som.ts`, `lib/armazenamento.ts`, `lib/jogos.ts`, `components/ui-kids/Confete.tsx` (só o `data-ativo`), `app/globals.css` (só o token `manu-grama`), `tests/e2e/pwa.spec.ts` (§6.3). `tests/e2e/atelie.spec.ts` intocado.
- **Não adicionar** dependência de runtime, framework de i18n, analytics, backend, conta/login.
- **Não copiar** código ou assets de GCompris/TuxMath/Blockly Games/Antura/Sugarizer (referência de mecânica apenas).
- **Não redesenhar** o hub nem o service worker (além do precache das rotas novas).
- **Não criar** modo multiplayer, placares online, timer punitivo ou qualquer mecânica de "game over".
- **Não mexer** na categoria bobbie-goods nem no pipeline de colorir.

## 8. Riscos e lacunas conhecidas

| Risco | Mitigação |
|---|---|
| Upgrade IndexedDB v1→v2 corromper galeria do Ateliê | Migração aditiva pura; E2E de persistência pré/pós upgrade (6.4); política de duas abas (§3.4) |
| WebKit (aparelho da Manuela) divergir em animação/áudio | E2E roda no project `iphone` desde o PR A; await do `resume()` (§3.3); offline no WebKit fica manual (§6.3) |
| 5-6 cards não caberem em 360×640 | Scroll vertical natural do grid; validado no E2E celular |
| Emoji render divergente Android/iOS | Banco de emojis testado nos 2 projects; emojis ambíguos (🃏) só no card do hub |
| Sílabas PT-BR erradas | Segmentação manual no banco + teste "palavra = concatenação das sílabas" (§4.4) |
| Builder implementar semântica errada do labirinto com testes verdes | Fixtures de solução ótima hardcoded independentes do motor (§4.3) |

## 9. Próximos passos do fluxo

1. ~~Fase 1b — juiz adversarial~~ **FEITO** (rodada única, ver §10).
2. **Fase 2 — build**: `cbuild docs/specs/SPEC-jogos-educativos-onda1.md` (worktree isolado, 1 PR por vez conforme §5). Nota ao executor: **ler `node_modules/next/dist/docs/` antes de codar** (aviso do AGENTS.md do repo — a versão do Next difere do conhecimento de treino).
3. **Fase 3 — review**: `pr-review-toolkit:code-reviewer` por PR (autor ≠ revisor).
4. **Fase 4 — simplify**: passe de minimalidade no diff antes de cada merge.

## 10. Registro do juízo adversarial (rodada 1 — 2026-07-30)

Juiz: Codex (MCP, sandbox read-only). Veredito: **REVISE**, 11 blockers — todos verificados contra o código e endereçados nesta v1.1:

| # | Blocker | Onde foi resolvido |
|---|---------|--------------------|
| 1 | `pwa.spec.ts:74` abre BD com versão 1 → `VersionError` + timeout após upgrade | §6.3 (1º item do PR A) |
| 2 | `tocarComDedo` acoplado à `.tela-desenho` e sem `click` sintético | §6.2.1 (helper novo `_toque.ts`) |
| 3 | `BotaoBolha` não aceita `href`; padrão real é `Link.bolha` | §3.5 |
| 4 | `bg-manu-chama` não existe (é keyframe) | §3.2 (token novo `manu-grama`, PR C) |
| 5 | Contradição sobre remoção do card `em-breve` | §3.2 + §5 (remove no PR D) |
| 6 | `gerarRodada` sem estado não garante não-repetição | §4.4 (`gerarFase` gera as 8 rodadas) |
| 7 | Modelo de palavras sem segmentação silábica | §4.4 (campo `silabas` manual) |
| 8 | Semântica do labirinto indefinida (giro vs deslocamento; direção inicial) | §4.3 |
| 9 | Máquina de estados da memória sem toques concorrentes | §4.2 |
| 10 | Duas abas: upgrade bloqueado + progresso regressivo | §3.4 |
| 11 | Corrida meteoro×acerto sem transição atômica | §4.1 |

Warnings incorporados: contexto novo por formato em vez de `setViewportSize` (W1), piso 390px (W2), offline não provado no WebKit — registrado como limitação aceita (W3), nome de cache real no teste PWA (W4), asserção de interatividade offline pega chunk não-cacheado (W5), await `ctx.resume()` (W6), semântica e inicial de `melhor` (W7), nível 5 e subtração sem negativo (W8). Mutações apontadas (confete sempre "visível"; labirinto com semântica absoluta passando no solver) mataram-se com `data-ativo` (§6.2.3) e fixtures de solução ótima (§4.3).

Decisão do dono: rodada única de juízo — sem re-submissão da v1.1.
