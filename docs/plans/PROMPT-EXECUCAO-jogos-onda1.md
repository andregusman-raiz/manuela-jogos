# PROMPT DE EXECUÇÃO — Jogos Educativos Onda 1: do código ao deploy

> Cole este prompt numa sessão Claude Code aberta em `~/Claude/GitHub-pessoal/manuela-jogos`.
> Ele executa a SPEC aprovada até o app estar em produção. Rota híbrida (Codex): ver §7.

---

## O prompt

Você vai executar a onda 1 de jogos educativos do Manuela Jogos, do primeiro commit até o deploy verificado em produção. Trabalhe de forma autônoma; só pare nos pontos marcados como GATE DE DONO.

### 0. Leitura obrigatória ANTES de qualquer código

1. `docs/specs/SPEC-jogos-educativos-onda1.md` (v1.1, juiz adversarial APROVADO com revisões incorporadas — é o contrato; nada de improvisar fora dela).
2. `AGENTS.md` do repo: **a versão do Next.js deste repo NÃO é a do seu conhecimento de treino** — leia os guias relevantes em `node_modules/next/dist/docs/` antes de escrever qualquer rota/componente.
3. Padrões vivos do repo (ler, não recriar): `lib/jogos.ts`, `lib/som.ts`, `lib/armazenamento.ts`, `components/ui-kids/BotaoBolha.tsx`, `components/atelie/Atelie.tsx` (cabeçalho/Link `bolha`), `tests/e2e/atelie.spec.ts` (contextos por formato, filosofia de toque), `tests/e2e/pwa.spec.ts`, `public/sw.js`.

### 1. Regras inegociáveis (violou = pare e pergunte)

- **Escopo**: só o que a SPEC §5 lista por PR. Escopo negativo da SPEC §7 é lei — `components/atelie/**`, `lib/desenho/**`, `lib/colorir/**` e `tests/e2e/atelie.spec.ts` são intocáveis; exceções pontuais estão nomeadas lá.
- **Zero dependência de runtime nova.** `bun add` de qualquer pacote = parar e perguntar.
- **Nunca**: `git push --force`, `reset --hard` em branch compartilhada, `rm -rf`, commit direto na `main`, `vercel --prod` manual (deploy é pela integração git ao mergear), tocar em outro repo/serviço/banco.
- **Convenções**: conventional commits EN; feature branch + PR + squash merge; máx. 5 mudanças sem commit.
- **Ambiguidade na SPEC** → não decidir sozinho: registrar a pergunta, propor a/b/c e parar.
- **Máx. 3 ciclos de fix-and-retest por PR.** No 3º vermelho: parar e reportar Esperado vs Atual + opções.
- Porta local canônica: **3006**. Para matar servidor preso: `lsof -ti:3006 | xargs kill` (`pkill "next start"` não mata `next-server`).

### 2. Sequência de PRs (estritamente A → B → C → D, um por vez)

Para CADA PR (conteúdo exato por PR: SPEC §5):

1. `git checkout main && git pull` → branch `feat/onda1-<slug>` (`contas`, `memoria`, `labirinto`, `palavras`).
2. Implementar conforme a seção do jogo na SPEC (§4.x) + infra do PR (§3). Motor puro primeiro, com testes de unidade (os "aceites específicos" de cada §4.x são obrigatórios, inclusive máquinas de estados e fixtures de solução ótima do labirinto); componente depois.
3. **Service worker**: cada PR que adiciona rota inclui a rota no precache e **bumpa a versão do cache** em `public/sw.js` — sem bump, cliente existente nunca vê o jogo novo offline.
4. Gates locais (todos verdes antes de abrir PR):
   ```bash
   bun run typecheck && bun run lint && bun run test && bun run test:e2e
   ```
   E2E novo segue SPEC §6.2: helper `tests/e2e/_toque.ts` (toque com área de dedo + click sintético), 3 formatos via contexto novo (390×844, 820×1180, 1440×900), confete por `data-ativo`, persistência pós-reload. Filtrar output: `| grep -B2 -A8 -iE "fail|error" | head -60`.
5. **Verificação de intent no browser** (Playwright MCP, localhost:3006): jogar 1 fase inteira do jogo do PR como criança jogaria — card do hub → fase completa → confete → voltar. Screenshot antes/depois no PR. Gate verde SEM essa verificação = não entregue.
6. Abrir PR (`gh pr create`) com descrição: o que ensina, decisões da SPEC exercidas, screenshots, saída resumida dos gates.
7. **Review autor≠revisor**: rodar `pr-review-toolkit:code-reviewer` no diff. Findings CONFIRMED → corrigir e re-rodar gates.
8. **Simplify**: passe de minimalidade no diff aprovado ("qual o menor diff que resolve? o que dá para deletar?"). Aplicar, re-rodar gates.
9. Squash merge. Deletar branch.
10. **Verificar o deploy do merge** (§3 abaixo) antes de começar o próximo PR.

### 3. Deploy e verificação em produção (após CADA merge)

O deploy é automático via integração git do Vercel — **escopo PESSOAL `andregusman-raizs-projects`** (NUNCA o escopo raizeducacao). Após o merge:

1. Aguardar o deployment de `main` ficar READY: `vercel ls --scope andregusman-raizs-projects` (ou dashboard). Build falhou → tratar como PR vermelho (fix na branch nova, nunca hotfix direto na main).
2. Smoke em produção via Playwright MCP contra `https://manuela-jogos.vercel.app`:
   - Hub carrega com o card novo; entrar no jogo; jogar até 1 acerto; sem erro de console.
   - Após o PR A: galeria do Ateliê continua abrindo (upgrade IndexedDB v2 não comeu dados — testar num perfil com desenho salvo).
   - PWA: recarregar 2× (SW novo ativa) e conferir versão de cache nova no DevTools/asserção.
3. Registrar no PR (comentário) a URL do deployment verificado.

### 4. GATES DE DONO (únicos pontos de parada obrigatória)

- **Após o PR A verificado em produção**: reportar ao André com screenshots do Foguete das Contas em prod + confirmação da galeria intacta. Só seguir para B/C/D com OK dele (o PR A carrega o risco real: upgrade de BD + SW).
- **Qualquer ambiguidade/violação das regras §1.**

B, C e D não precisam de aprovação intermediária — merge e siga.

### 5. Encerramento da onda (Definition of Done)

Após o PR D em produção, rodar a auditoria da SPEC §6.4 item por item e produzir relatório final em `docs/reports/RELATORIO-onda1-jogos-<data>.md`:

- Checklist §6.4 completo (com evidência por item, não "ok" seco).
- 4 jogos jogados em produção (celular viewport 390px + desktop), screenshots.
- Saída resumida dos 4 gates na main final.
- Gaps remanescentes, se houver: Esperado vs Atual + opções a/b/c — nunca "aceitável, corrige depois" silencioso.

### 6. Estimativa de esforço (calibração, não promessa)

4 PRs × (build ~15min + E2E + review + simplify + deploy-verify) — sessão longa. Se o contexto apertar, fechar o PR corrente até o merge verificado e fazer handoff (`/handoff`) — nunca parar no meio de um PR com working tree sujo.

---

## 7. Rota alternativa — build via Codex (híbrido)

Se o build for delegado ao Codex em vez de feito na sessão Claude:

```bash
cbuild docs/specs/SPEC-jogos-educativos-onda1.md "bun run typecheck && bun run lint && bun run test && bun run test:e2e"
```

- 1 invocação por PR (A→D), cada uma em worktree isolado (`.codex/worktrees/`), instruindo no prompt qual PR da SPEC §5 executar. Lembrar: cbuild ramifica do HEAD local — rodar a partir da `main` limpa e atualizada.
- Worktree sem `node_modules`: rodar `bun install` no worktree antes dos gates (gotcha documentado: gate "verde" com exit 127 testa código errado).
- Codex NUNCA faz: merge, deploy, review do próprio diff. Fases 3-4 (review + simplify) e §3 (deploy-verify) continuam na sessão Claude, exatamente como no fluxo acima.
