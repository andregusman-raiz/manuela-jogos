import type { Fase } from "./tipos";

/**
 * 10 fases desenhadas à mão (SPEC §4.3), progressão 3×3 → 7×7.
 * Toda fase tem solução com <= 12 comandos na semântica de giro puro —
 * PROVADO por um solver BFS em tests/unidade/labirinto.test.ts.
 */
export const FASES: Fase[] = [
  // 1 — dois passos em linha reta: aprender o "frente"
  { grade: ["...", "M.E", "..."], direcaoInicial: "leste" },

  // 2 — a primeira dobra: frente, frente, girar, frente, frente
  { grade: ["M..", "...", "..E"], direcaoInicial: "leste" },

  // 3 — a parede no caminho: contornar por cima
  { grade: ["...", "M#E", "..."], direcaoInicial: "leste" },

  // 4 — muro em L: descer duas linhas para passar
  { grade: ["M.#.", "..#E", "....", "...."], direcaoInicial: "leste" },

  // 5 — muro vertical com passagem por baixo
  { grade: ["..#..", "..#..", "M.#.E", "..#..", "....."], direcaoInicial: "leste" },

  // 6 — subir a lateral com becos falsos
  { grade: ["....E", ".##..", ".#...", ".#.##", "M...."], direcaoInicial: "norte" },

  // 7 — corredor em L com miolo fechado
  { grade: [".....E", ".####.", ".#....", ".#.##.", ".#....", "M....."], direcaoInicial: "norte" },
  // 8 — a volta completa pela borda
  {
    grade: ["M.....", ".####.", ".#..#.", ".#..#.", ".####.", ".....E"],
    direcaoInicial: "leste",
  },

  // 9 — muro alto com uma única janela (na segunda linha)
  {
    grade: ["...#...", "...#...", ".......", "M..#..E", "...#...", "...#...", "...#..."],
    direcaoInicial: "leste",
  },

  // 10 — o miolo cheio de becos, subir e cruzar
  {
    grade: ["...E...", ".#####.", ".#...#.", ".#.#.#.", ".#...#.", ".#####.", "M......"],
    direcaoInicial: "norte",
  },
];
