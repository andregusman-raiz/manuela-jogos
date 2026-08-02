# SPEC — Identidade configurável: nome e figura da mascote como variáveis

> **v1.1** (2026-08-02) — após juiz adversarial Codex (6 blockers, todos
> acatados; registro no fim). Pedido do dono: "deixar a figura da manu nos
> diversos usos e o nome da manu como variáveis do sistema (no futuro ele irá
> poder adaptar para outros nomes e usos)".
> Fase 1 (esta SPEC): TODA aparição do nome/figura vem de UM módulo, com a
> arquitetura já pronta para a fase 2 (troca em runtime) sem retocar jogos.

## 1. Inventário do acoplamento (conferido pelo juiz contra o código)

| Onde | O quê |
|---|---|
| `lib/jogos.ts` | 8 nomes/descrições ("Ateliê da Manu", "4 em linha, com a Manu") |
| **22 arquivos** (21 em `components/` + `app/page.tsx`) | **47 tags `<Manu>`** + textos ("Com a Manu", "Manu pensando…", "A Manu venceu!") — inclui consumidores de figura fora de jogos: `Galeria.tsx`, `PortaoParental.tsx` |
| `components/ui-kids/Manu.tsx` | 2 assets + 6 poses, `alt="Manuela"` |
| `app/layout.tsx` + `app/manifest.ts` | título, descrição "Feito **para a** Manuela", applicationName, apple-title, **`short_name: "Manu Jogos"`** |
| **6 metadados de rota** (blocker J1) | `title` próprios em `app/{desenhar,forca,labirinto,lojinha,ludo,tangram}/page.tsx` ("Forca da Manu"…) |
| `app/page.tsx` | h1 + saudação com gênero ("Bem-vinda!") |
| `lib/compartilhar.ts` | `desenho-da-manu.png` (linha 10) e "Desenho da Manu" (18) |
| `lib/labirinto/motor.ts:40` | string interna "fase sem Manu" |
| Conquistas com gênero implícito | "Mestre das pizzas!" (`Fracoes.tsx:261`), "Caçador de números!" (`Caca.tsx:188`) |

**Fica como está (contrato técnico, mudar quebra upgrade):** tokens CSS
`*-manu-*` (289 literais), keyframes `manu-*`, BD `manu-jogos`, chave
`manu-jogos-ocultos`, caches `manu-app-*`/`manu-assets-*`, discriminantes
internos `"manu"` de modo de jogo (32 usos em Lig-4/Mancala/Rota — valor de
enum, não texto), paths `/manu/*` dos assets/ícones, rotas, repo.

## 2. Módulo central — `lib/identidade.ts`

### 2.1 Fábrica (blocker J2: derivação, nunca campos soltos)

```ts
export interface DadosIdentidade { nome: string; apelido: string; genero: "a" | "o" }
export interface Identidade extends DadosIdentidade {
  tituloApp: string;       // `${nome} Jogos`
  tituloCurto: string;     // `${apelido} Jogos`  (manifest short_name)
  descricaoApp: string;    // `Jogos para brincar… Feito ${paraAMascote()}.`
  altMascote: string;      // nome
  slug: string;            // apelido normalizado p/ arquivo: "manu" (a-z0-9-)
}
export function criarIdentidade(d: DadosIdentidade): Identidade;  // PURA
export const IDENTIDADE = criarIdentidade({ nome: "Manuela", apelido: "Manu", genero: "a" });
```

- Derivar TUDO da tripla `{nome, apelido, genero}` — campos duplicados
  editáveis criam estado incoerente (o aceite "Theo" da v1.0 nem compilava).
- Validação na fábrica: nome/apelido não-vazios, ≤20 chars; slug via
  normalização NFD + `[^a-z0-9]+ → -`.

### 2.2 Helpers de flexão (blocker J3: cobertura conferida frase a frase)

```ts
flexionar(masc: string, fem: string): string   // genérico: base de todos
daMascote(): string        // "da Manu" | "do Theo"
aMascote(): string         // "a Manu"  | "o Theo"
comAMascote(): string      // "com a Manu"
paraAMascote(): string     // "para a Manuela" (layout/manifest — J3)
saudacao(): string         // "Bem-vinda!" | "Bem-vindo!"
```

- Conquistas com gênero: `flexionar("Mestre", "Mestra")` das pizzas,
  `flexionar("Caçador", "Caçadora")` de números. **Decisão fechada**: a fase 1
  CORRIGE a concordância — hoje a Manuela recebe "Mestre" e "Caçador" no
  masculino (bug de concordância pré-existente). São as ÚNICAS duas mudanças
  de texto da fase 1 ("Mestra das pizzas!", "Caçadora de números!"),
  destacadas no PR como intencionais. E2E que as citar é atualizado JUNTO.
- Conferido sem flexão necessária: "Que viajante!" (epiceno), "Pronto"
  (rótulo), "pra/à Manu" (não existem no código).
- `lib/compartilhar.ts` usa `slug` + `daMascote()`: default permanece
  byte-idêntico `desenho-da-manu.png` / "Desenho da Manu" (J2).
- `lib/labirinto/motor.ts:40` "fase sem Manu" → "fase sem personagem"
  (string interna de erro; neutralizar em vez de excecionar no gate).

### 2.3 Arquitetura pronta para a fase 2 (blocker J5)

- **Sem ciclo de módulos**: `identidade.ts` é puro e não importa NADA do app
  (nem `preferencias.ts`, que importa `JOGOS`). O override futuro vive num
  módulo próprio (`lib/identidade-override.ts`) que compõe os dois.
- **Catálogo como função**: `lib/jogos.ts` exporta
  `criarJogos(identidade): Jogo[]` (pura) e mantém
  `export const JOGOS = criarJogos(IDENTIDADE)` para compatibilidade — a
  fase 2 recalcula chamando a função, sem tocar consumers.
- **Assinatura React**: a fase 2 introduz `useIdentidade()` via
  `useSyncExternalStore` (padrão preferencias/som). A fase 1 NÃO cria o hook
  (constantes bastam), mas deixa todos os call-sites lendo de
  `IDENTIDADE`/helpers — o hook substituirá o import sem mudar JSX.
- **Figura assíncrona**: o componente `Mascote` (§3.1) encapsula o par
  src/dimensões vindo de `MASCOTE`; a fase 2 troca a FONTE (IndexedDB +
  Blob URL com fallback e validação de MIME/dimensões) dentro do componente,
  invisível para os 47 usos.
- **Limitações aceitas da fase 2** (registradas já): metadata/manifest e
  ícones de PWA instalada ficam no default (não re-geram em runtime); SSR do
  hub renderiza o default e o override aplica na hidratação (flash aceito,
  igual ao filtro de jogos).

## 3. Mudanças por área (fase 1)

### 3.1 `components/ui-kids/Manu.tsx` → `Mascote.tsx`
Rename ATÔMICO (arquivo + símbolo + tipo `PoseManu` + 22 imports + 47 tags
num único commit com typecheck — batches de 5 criariam estados sem compilar;
melhoria do juiz). Assets/dimensões/alt saem de `MASCOTE` em `identidade.ts`.

### 3.2 `lib/jogos.ts`
`criarJogos(identidade)` com nomes template (`` `Ateliê ${daMascote()}` ``);
ids/rotas/emoji/cor intactos. Jogos sem apelido ficam literais.

### 3.3 Textos dos componentes + 6 `title` de rota + manifest
Interpolação via `IDENTIDADE`/helpers em todos os pontos do inventário §1 —
incluindo os 6 `metadata.title` de página e `short_name` (=`tituloCurto`).

### 3.4 h1 do hub (blocker J6)
Contrato determinístico: **linha 1 = `nome`, linha 2 = "Jogos"** — "Maria
Clara" fica inteira na linha 1. (A regra da v1.0 "quebra na primeira
palavra" separaria nomes compostos.)

## 4. Testes

1. **Unit `identidade.test.ts`**: fábrica com Manuela (valores EXATOS atuais,
   byte a byte — incluindo `desenho-da-manu.png`), com
   `{nome:"Theo", genero:"o"}` ("Theo Jogos", "do Theo", "Bem-vindo!",
   "Mestre") e com `{nome:"Maria Clara"}` (título "Maria Clara Jogos", slug
   "maria-clara"); validação rejeita nome vazio/gigante; snapshot do catálogo
   `criarJogos` nas 3 identidades (endurecimento do aceite, J6).
2. **Gate anti-regressão por AST** (blocker J4 — a versão regex-em-texto
   nasceria com ~327 falsos positivos): função `varrerIdentidadeVazada(src)`
   usando o compilador TypeScript (devDependency já presente) sobre
   `components/`, `app/` e **`lib/`** (a v1.0 esquecia `lib/` — onde moram
   jogos.ts e compartilhar.ts), exceto `identidade.ts` e testes. Inspeciona
   `StringLiteral`, `JsxText`, `NoSubstitutionTemplateLiteral` e cabeças/
   segmentos de template; ignora comentários e specifiers de import. Acusa
   `/(?<![\p{L}\p{N}_])(manuela|manu|bem-vind[ao])(?![\p{L}\p{N}_])/iu`
   EXCETO literais integralmente técnicos: paths `^/manu/`, ids conhecidos
   (`manu-jogos`, `manu-app-`, `manu-assets-`, `manu-jogos-ocultos`),
   discriminante exato `"manu"` (valor de modo), strings compostas só de
   tokens CSS `*-manu-*`. **O scanner é uma função testada**: unit com
   fixtures prova que pega `"da Manu"`/`` `Vez ${x} da Manu` `` e libera
   `"bg-manu-rosa/40"`, `"manu-jogos"`, `"manu"`.
3. **E2E existentes**: intocados EXCETO os que citarem as 2 correções de
   concordância (§2.2), atualizados no mesmo PR. `getByAltText("Manuela")`
   do deitado.spec continua válido (alt = nome, default inalterado —
   conferido pelo juiz).
4. Gates completos da casa.

## 5. Aceite (verificável)

1. Suite completa verde; unit de default prova byte a byte que NENHUM texto
   mudou além das 2 correções de concordância listadas.
2. Gate por AST verde na árvore real E o unit do scanner mata as mutações
   (fixture com literal proibido falha; técnicos passam).
3. Snapshots de Theo e Maria Clara no unit (não mais "trocar em dev e tirar
   screenshot" — o juiz apontou que era demonstração, não gate; o screenshot
   de Theo continua no PR só como ilustração).
4. Diff vazio em `armazenamento.ts`, `sw.js`, `globals.css` (tokens),
   `preferencias.ts` (chave), e em qualquer id/rota do manifesto.

## 6. Escopo negativo

Sem UI de configuração (fase 2); sem rename de tokens/BD/caches/chaves/rotas;
sem regeneração de ícones PWA; sem i18n; sem trocar a arte default; sem hook
`useIdentidade()` na fase 1 (entra na 2 sobre os mesmos call-sites).

## 7. Entrega

1 PR (`feat/identidade-mascote`): módulo+fábrica+helpers, rename atômico,
varredura do inventário §1, catálogo como função, gate AST + units, 2
correções de concordância destacadas. Review cross-model Codex. No PR: diff
do grep antes/depois e screenshot ilustrativo com "Theo".

---

## Registro do julgamento (v1.0 → v1.1)

Juiz Codex (read-only, 1 rodada, 2026-08-02): **REVISE**, 6 blockers — todos
acatados: J1 inventário +6 titles de rota, +short_name, +Galeria/Portão
(contagens reais: 22 arquivos, 47 tags); J2 fábrica `criarIdentidade` com
derivação (aceite Theo da v1.0 não compilava; compartilhar preservado byte a
byte via slug+apelido); J3 helpers +`paraAMascote` +`flexionar` para as 2
conquistas (decisão: corrigir a concordância — únicas mudanças de texto);
J4 gate reescrito por AST cobrindo `lib/`, com scanner testável (v1.0 teria
~327 falsos positivos e não veria jogos.ts); J5 fase 2 viabilizada de verdade
(fábrica pura, catálogo-função, sem ciclo com preferencias, hook adiado mas
call-sites prontos, figura assíncrona encapsulada); J6 h1 = nome/"Jogos"
(nome composto não quebra) e aceite endurecido com snapshots em vez de
screenshot manual. Melhorias aceitas: rename atômico (não em batches);
validação de nome (vazio/tamanho/slug).
