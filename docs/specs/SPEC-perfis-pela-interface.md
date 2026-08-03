# SPEC — Criar jogadores pela interface (perfis dinâmicos)

> **v1.1** (2026-08-03) — após juiz adversarial Codex (10 blockers com
> reprodução, TODOS acatados; registro no fim). Pedido do dono: criar novos
> acessos direto na UI — selecionando a imagem INTEIRA da criança/mascote E
> o rosto, menino/menina (cores), nome e o que mais precisar.

## 0. Estratégia em uma página

1. **Registro híbrido**: 3 perfis de fábrica (código) + perfis dinâmicos
   numa loja nova `perfis` do IndexedDB (**BD v6**, aditivo). Lista mesclada
   única; dinâmicos ordenados por `criadoEm`.
2. **Imagens no aparelho**: processadas no navegador (canvas) e guardadas
   como Blob PNG na loja `perfis`; servidas por `blob:` URL com ciclo de
   vida CONTRATADO (§3). Nada sai do aparelho — a promessa do rodapé vale
   para as fotos. SW intocado (`blob:` não pertence a CASCA/FIGURAS).
3. **Fluxo do adulto** atrás do Portão Parental (tabuada existente):
   criar, editar e apagar.
4. A memória por perfil já usa `perfil.id` — dinâmicos herdam o isolamento.

## 1. Fundações (juiz B2/B3 — os dois CRÍTICOS)

### 1.1 Dono único do schema: `lib/bd.ts`
`abrir()` sai de `armazenamento.ts` para um módulo `lib/bd.ts`, ÚNICO dono
do schema v6: o upgrade cria idempotentemente `atelie` + 18 lojas de jogos +
`perfis`, seja quem for que abra primeiro (perfis.ts ou armazenamento.ts) —
sem isso o schema dependeria da ordem de abertura (`NotFoundError`).
Todas as operações (inclusive `carregarPerfis`, criar/editar/apagar)
seguem abre-1 transação-fecha; cache só de REGISTROS e blob URLs, nunca de
`IDBDatabase`. Corrige-se também o furo atual do teto de 4s: `onsuccess`
tardio depois do reject FECHA a conexão imediatamente (hoje vaza).

### 1.2 Máquina de boot: id síncrono ≠ objeto Perfil
- **Chaves de memória usam o ID salvo, não o objeto**: `armazenamento.ts` e
  `preferencias.ts` passam a derivar as chaves de `idJogadorSalvo()`
  (string do localStorage, síncrona, SEM validação contra o catálogo) —
  `progresso:sofia` funciona ANTES do catálogo carregar. `perfilAtivo()`
  NUNCA responde "Manuela" como placeholder de carregamento (a corrida do
  juiz: `/contas` por link direto com jogador dinâmico e IDB lento lia E
  GRAVAVA em `progresso:manuela`).
- Estados do registro: `carregando → pronto`. A UI (hub E rotas de jogo)
  só monta conteúdo dependente de identidade quando `pronto`; o véu
  anti-FOUC só sai DEPOIS da validação do id contra o catálogo (id apagado
  → limpa a escolha e abre o picker, sem flash de hub).
- O fallback legado da Manuela continua comparando o ID string
  (`=== "manuela"`) — nada muda na camada de memória.

## 2. Modelo de dados

```ts
interface PerfilDinamico {
  id: string;        // slug ÚNICO e IMUTÁVEL após criação (juiz B8)
  nome: string; apelido: string; genero: "a" | "o";
  anel: string;      // classe ring-* completa; default por gênero
  corpo: Blob; corpoLargura: number; corpoAltura: number;  // PNG ≤1024
  avatar: Blob;      // PNG 512×512
  criadoEm: number; atualizadoEm: number;
}
```

- **Criação transacional** (juiz B9): `count + alocação de slug + add`
  numa ÚNICA transação readwrite (`add`, não `put` — colisão aborta);
  submit desabilitado enquanto pendente. Limite: 3 de fábrica + **5
  dinâmicos** (o 6º é recusado com mensagem).
- Ids reservados: `manuela|leo|gustavo|novo` e prefixos
  `progresso|rascunho`. Colisão de slug → `-2`, `-3`…
- **Editar NUNCA muda o id** (dados ficam com a criança). **Apagar SEMPRE
  apaga os salvamentos** (juiz B8: a opção "manter" permitia o próximo
  "sofia" herdar tudo): uma transação única cobrindo `perfis` + 18 lojas
  (`progresso:<id>`) + `atelie` (desenhos `perfil==id` + `rascunho:<id>`),
  depois a chave `manu-jogos-ocultos:<id>` e, se era o ativo, a escolha.
- Validação (alinhada e ESTENDIDA em `criarIdentidade`): nome E apelido
  precisam de ≥1 letra/número após normalização (hoje só o apelido —
  `nome:"👧"` passava); teto 20 unidades UTF-16 (documentado); não-latinos
  ok (slug via NFD; se o slug do apelido normalizar vazio → mensagem).
- Registro corrompido no IDB (blob ausente, campos inválidos) é PULADO com
  aviso no console — nunca derruba o catálogo.

## 3. Blob URLs — contrato de ciclo de vida (juiz B1)

Cache module-level `Map<id, {atualizadoEm, corpoUrl, avatarUrl}>`:
- `createObjectURL` SÓ quando o id entra no cache ou `atualizadoEm` mudou;
  NUNCA em render; recarregar o picker sem mudança reutiliza as URLs.
- Replace (edição): cria as novas → publica o snapshot → revoga as ANTIGAS
  somente após o novo snapshot montar (microtask após notificação, com as
  imagens novas carregadas). Delete: remove do snapshot → revoga após a
  desmontagem. `pagehide`: revoga tudo.
- `Mascote` renderiza `blob:` com `<img>` (mesmas classes; `next/image`
  não otimiza blob). Teste espiona create/revoke e prova estabilidade em
  re-render, reload do picker, troca, edição e exclusão.

## 4. Fluxo de UI

Card **"+ Novo jogador"** (tracejado) no fim do picker → Portão Parental →
assistente de 3 passos:

### Passo 1 — Foto do corpo inteiro (contrato iOS — juiz B5)
- DOIS botões: "Tirar foto" (`capture="environment"`) e "Escolher da
  galeria" (sem capture) — `accept="image/*"` é só dica.
- Decode: `createImageBitmap(file, { imageOrientation: "from-image" })`
  com fallback `<img>` (EXIF: fotos de câmera vêm rotacionadas; o caminho
  from-image aplica a orientação; fixture JPEG EXIF-6 no E2E). HEIC:
  decode nativo do Safari; se o decode REJEITAR (HEIC fora do Safari,
  arquivo corrompido, MIME falso) → mensagem gentil "essa foto não abriu,
  tente outra" (caminho verificável).
- Limites: arquivo ≤12MB E ≤32 megapixels (checados após metadados);
  downscale para maior lado 1024 DIRETO no decode/drawImage — nunca canvas
  no tamanho original. `toBlob() === null` → mesmo caminho de erro. URL
  temporária do arquivo revogada em `finally`.
- Fundo: se a imagem JÁ tem alpha → pula remoção; senão, se ≥70% dos
  pixels de borda têm RGB ≥ **245** (limiar ÚNICO, o mesmo do flood),
  roda o flood-fill (§5) + recorte do bounding box; bbox vazio (imagem
  toda transparente/branca) → mensagem "não achei ninguém na foto".
  Fundo complexo fica como está (v1 sem segmentação/ML — decisão honesta).
- Preview sobre o fundo real do app + "tentar outra foto" (cancela
  processamento em voo).

### Passo 2 — Rosto
Quadro quadrado arrastável com alça de tamanho (pointer + clamp),
inicializado no terço superior central; preview redondo (como no header).
Downscale em 2 passos para 512×512.

### Passo 3 — Nome e gênero
Nome + apelido opcional (default = primeira palavra — VALOR real, não
placeholder); seletor menina/menino com os anéis rosa/céu à mostra (define
`genero` + `anel`); card-resumo idêntico ao do picker; "Criar" grava
(transação do §2) e volta ao picker com o novo card selecionável.

### Gerenciar (juiz B6 — sem toque longo)
Cada card DINÂMICO ganha um botão irmão **"✎"** (44×44, canto superior,
`aria-label="gerenciar <nome>"`, NUNCA button aninhado) → Portão Parental
→ Editar (assistente pré-preenchido, id imutável) | Apagar (confirmação
com o nome; sempre apaga salvamentos — §2). Long-press descartado:
conflita com o scroll do picker e não tem equivalente acessível.

## 5. Processamento de imagem

- `lib/imagem.ts` (PURO, testável): `fundoClaro`, `removerFundo` (BFS com
  fila `Uint32Array` — medido ~5ms/megapixel; `Array.shift()` PROIBIDO),
  `caixaUtil`, antisserrilhado (alpha 140 nos vizinhos).
- **Orçamento**: pipeline completo (flood 1024² pior caso + recortes) sem
  long task >50ms além do flood em si; indicador de processamento visível
  e cancelamento ao trocar de foto. Se a medição em iPhone real estourar,
  o algoritmo puro (já isolado sobre ArrayBuffer) vai para um Web Worker
  inline — permitido (não é dependência).
- `lib/imagem-canvas.ts` (wrappers finos) coberto pelo E2E real de upload
  (jsdom não tem canvas; "não testável em unit" ≠ não testado).

## 6. Testes / aceite (verificáveis — juiz B10)

- Unit: flood preserva branco interno; borda suavizada; `fundoClaro`;
  `caixaUtil` (incl. vazio); slug único com colisão e reservados; validação
  nome/apelido (emoji-só reprova, não-latino passa); merge ordena fábrica
  primeiro + dinâmicos por `criadoEm`; registro corrompido pulado.
- E2E `perfil-novo.spec.ts`: criar via `setInputFiles` (fixtures: PNG fundo
  branco, **JPEG EXIF-6**, arquivo corrompido → mensagem); recorte do
  rosto por drag; menina/menino → anel; card novo aparece, selecioná-lo
  flexiona o app ("Sofia Jogos", "Bem-vinda!", "Ateliê da Sofia"); reload
  persiste; **cold start em `/contas` por link direto com jogador dinâmico
  e IDB atrasado → NENHUMA leitura/escrita em `progresso:manuela`**; id
  salvo de perfil apagado → picker SEM flash de hub; editar apelido mantém
  id e dados; apagar + recriar mesmo nome NÃO herda nada; duas criações
  concorrentes (2 abas) respeitam limite e slug; scroll segurando o dedo
  600ms NÃO abre gerenciamento; gerenciar acessível por teclado; blob URLs
  estáveis (spy create/revoke); upgrade v3→v6 nas DUAS ordens de abertura.
- **Autorizado** (juiz B4): `contas.spec` upgrade vira v3→v6 (version 6,
  lista com `perfis`, sentinelas preservadas).
- Verificação em produção: contexto EFÊMERO; se usar perfil persistente,
  id único + cleanup em `finally` provando que perfil, progresso, rascunho,
  galeria e config não sobraram.

## 7. Escopo negativo

Sem segmentação/ML; sem nuvem/export/import; sem editar/apagar perfis de
fábrica; sem cor além do par menina/menino (campo `anel` já paga o override
futuro); sem poses extras; sem sync entre abas (refresh do catálogo ao
abrir o picker; BroadcastChannel fica anotado como melhoria futura).

## 8. Entrega

2 PRs — **A)** `lib/bd.ts` (dono do schema v6 + fix do teto de 4s) +
loja `perfis` + registro mesclado/máquina de boot + `lib/imagem.ts` com
units + `Mascote` blob + contrato de URLs; **B)** assistente + gerenciar +
E2E completo. Review cross-model por PR; produção verificada criando e
apagando um perfil de teste (cleanup garantido).

---

## Registro do julgamento (v1.0 → v1.1) — Codex: REVISE, 10 blockers

B1 ciclo de vida de blob URLs contratado (cache por id+atualizadoEm,
revoke pós-troca, nunca em render); B2 **CRÍTICO** corrida do boot: chaves
derivam do ID salvo síncrono e a UI espera o catálogo (reprodução: /contas
direto gravava em manuela); B3 **CRÍTICO** `lib/bd.ts` dono único do
schema (NotFoundError dependente de ordem) + fix do vazamento no teto de
4s; B4 autorizada a atualização do teste de upgrade (v3→v6, duas ordens);
B5 contrato iOS: capture explícito, EXIF from-image com fixture, HEIC com
caminho de rejeição, teto de megapixels, sem canvas full-res; B6 long-press
descartado → botão ✎ acessível; B7 orçamento de perf medido (fila
Uint32Array ~5ms/MP; worker como plano B, jank nunca silencioso); B8 id
IMUTÁVEL + apagar SEMPRE apaga dados (a opção de manter deixava o próximo
mesmo-slug herdar tudo); B9 criação transacional com `add` + limite 5
dinâmicos + validação alinhada/estendida (nome só-emoji reprovava só no
apelido); B10 aceite reescrito com os cenários de corrida, concorrência e
acessibilidade. Melhorias acatadas: ordenação por criadoEm, registro
corrompido pulado, limiar único 245, produção com cleanup em finally.

## Adendo pós-review do PR A (registro honesto)

- O véu do hub cobre TAMBÉM ids dinâmicos (script inline conhece os ids de
  fábrica). Rotas de JOGO com id dinâmico aceitam um flash da identidade
  default limitado ao carregamento do catálogo (getAll numa loja minúscula,
  tipicamente <100ms com JS ativo) — as CHAVES de memória nunca erram (vêm
  do id salvo). Falha do catálogo degrada para: picker no hub; identidade
  default visual nas rotas de jogo, com chaves corretas. Revisão futura se
  a telemetria de uso real mostrar flash perceptível.
