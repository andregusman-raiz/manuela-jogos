# Manuela Jogos

Hub de mini-jogos para criança de 6-10 anos, feito para abrir por um link no
celular — sem loja de aplicativos, sem cadastro, sem anúncio e sem coletar dado
nenhum. O primeiro jogo é o **Ateliê da Manu**: desenhar, pintar e colorir.

## Como rodar

```bash
bun install
bun run dev          # http://localhost:3006 (porta canônica deste projeto)
```

Gates antes de abrir PR:

```bash
bun run typecheck && bun run lint && bun run test && bun run test:e2e
```

O E2E sobe o build de produção sozinho (é onde o service worker entra em jogo) e
roda em viewport de celular com toque — é o único jeito que reproduz o uso real.

## Decisões que moldaram o código

**Nada de texto essencial.** Aos 6 anos a leitura está começando. Toda ação é
ícone literal com rótulo `aria-label` para leitor de tela; nenhuma depende de ler.

**Alvo de toque de 72px+.** A NN/g mede ~2cm×2cm para mão de criança (4× o alvo
adulto). Em tela de 360px a barra cede até ~66px por botão, e o E2E cobra o piso.

**Nenhuma ação destrói trabalho num toque.** Apagar tudo e apagar da galeria
exigem *segurar* o dedo com anel de progresso — a criança entende segurando, sem
precisar ler caixa de confirmação.

**O desenho é lista de operações, não bitmap.** Desfazer remove a última
operação e reconstrói. Guardar snapshot de imagem estouraria a memória de celular
de entrada; e é isso que faz o autosave caber num registro pequeno de IndexedDB.

**Um dedo desenha, dois dedos dão zoom.** Criança apoia a mão na tela: contato
maior que 68px é descartado como palma, e o segundo dedo cancela o traço em
andamento em vez de deixar risco fantasma.

**Livro de colorir é SVG, não balde em bitmap.** Cada área é um path com id, e
pintar troca o `fill`. Não vaza nem deixa halo branco na borda — o problema
clássico do flood fill. No desenho livre, aí sim o balde é scanline em pixels.

**Som sintetizado no WebAudio.** Zero byte para baixar, toca na hora e funciona
offline. Ligado por padrão, com mudo sempre visível no cabeçalho.

**Zero dependência de runtime além de Next/React.** Traço, flood fill, IndexedDB,
sons e confete são código próprio — o app precisa abrir em menos de 3s no 4G.

**Toda arte é original.** O catálogo de temas se inspira nos sites de colorir,
mas nenhuma imagem vem de lá: os termos proíbem redistribuição e as categorias
populares são personagens licenciados. A Manuela é arte própria do projeto.

## Estrutura

```
app/                     rotas (hub, /desenhar) + manifest PWA
components/ui-kids/      botão-bolha, hold-to-confirm, bandeja, confete, portão parental, mascote
components/atelie/       tela de desenho, barras, livro de colorir, galeria
lib/desenho/             motor de canvas, pincéis, formas, balde
lib/colorir/             páginas do livro (geometria) + export para SVG
lib/armazenamento.ts     IndexedDB (rascunho + galeria), uma gaveta por jogo
public/manu/             assets da mascote e ícones do PWA
public/sw.js             service worker offline-first
tests/unidade/           dados e lógica pura (vitest)
tests/e2e/               jornada no navegador com toque (playwright)
```

## Adicionar um jogo novo

1. Criar a rota em `app/<jogo>/`.
2. Acrescentar uma entrada em `lib/jogos.ts` — o hub se monta a partir dessa lista.
3. Reusar `components/ui-kids/` (é o que garante o mesmo padrão de toque, som e
   confirmação) e `lib/armazenamento.ts` com uma gaveta própria.

## Privacidade

Sem conta, sem servidor, sem analytics, sem cookie de rastreio e sem link externo
dentro do jogo. Tudo — rascunho e galeria — fica no IndexedDB do aparelho. A única
coisa que sai dali é o PNG que o adulto escolhe compartilhar, e isso passa por um
portão parental (conta simples, formato aceito por Apple e FTC).
