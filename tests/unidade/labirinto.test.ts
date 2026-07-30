import { describe, expect, test } from "vitest";
import { FASES } from "@/lib/labirinto/dados";
import { FILA_MAXIMA, executar, girar, posicaoInicial } from "@/lib/labirinto/motor";
import type { Comando, Direcao, Fase } from "@/lib/labirinto/tipos";

/**
 * Solver BFS sobre (x, y, direção) usando o PRÓPRIO motor por passo único.
 * Prova solvabilidade <= 12; a SEMÂNTICA é provada pelas fixtures abaixo,
 * que têm soluções escritas à mão (oráculo independente do motor — um motor
 * com esquerda/direita como deslocamento absoluto passa no BFS, não nelas).
 */
function resolver(fase: Fase): Comando[] | null {
  const inicio = posicaoInicial(fase);
  const chave = (p: { x: number; y: number; direcao: Direcao }) => `${p.x},${p.y},${p.direcao}`;
  const visitados = new Set([chave(inicio)]);
  let fronteira: Array<{ fila: Comando[] }> = [{ fila: [] }];

  for (let profundidade = 0; profundidade < FILA_MAXIMA; profundidade++) {
    const proxima: typeof fronteira = [];
    for (const { fila } of fronteira) {
      for (const comando of ["frente", "girar-esquerda", "girar-direita"] as Comando[]) {
        const tentativa = [...fila, comando];
        const { passos, resultado } = executar(fase, tentativa);
        if (resultado === "estrela") return tentativa;
        if (resultado === "parede") continue;
        const fim = passos[passos.length - 1] ?? inicio;
        if (visitados.has(chave(fim))) continue;
        visitados.add(chave(fim));
        proxima.push({ fila: tentativa });
      }
    }
    fronteira = proxima;
  }
  return null;
}

describe("as 10 fases desenhadas à mão", () => {
  test(`todas têm solução com <= ${FILA_MAXIMA} comandos`, () => {
    expect(FASES).toHaveLength(10);
    FASES.forEach((fase, i) => {
      const solucao = resolver(fase);
      expect(solucao, `fase ${i + 1} sem solução <= ${FILA_MAXIMA}`).not.toBeNull();
    });
  });

  test("toda fase tem exatamente uma Manu e uma estrela, linhas regulares", () => {
    for (const fase of FASES) {
      const tudo = fase.grade.join("");
      expect(tudo.split("M").length - 1).toBe(1);
      expect(tudo.split("E").length - 1).toBe(1);
      const larguras = new Set(fase.grade.map((l) => l.length));
      expect(larguras.size).toBe(1);
    }
  });
});

describe("fixtures com solução ótima escrita à mão (oráculo da semântica)", () => {
  test("fase 1 resolve com exatamente [frente, frente]", () => {
    expect(executar(FASES[0], ["frente", "frente"]).resultado).toBe("estrela");
    expect(executar(FASES[0], ["frente"]).resultado).toBe("fim-da-fila");
  });

  test("fase 2 resolve com [frente, frente, girar-direita, frente, frente]", () => {
    expect(
      executar(FASES[1], ["frente", "frente", "girar-direita", "frente", "frente"]).resultado,
    ).toBe("estrela");
  });

  test("giro é PURO: girar sozinho não move a Manu", () => {
    // estrela imediatamente à esquerda da Manu (que olha para o norte)
    const fase: Fase = { grade: ["...", "EM.", "..."], direcaoInicial: "norte" };
    // um motor com "esquerda = deslocamento absoluto" venceria só com o giro
    expect(executar(fase, ["girar-esquerda"]).resultado).toBe("fim-da-fila");
    const soGiro = executar(fase, ["girar-esquerda"]).passos[0];
    expect(soGiro).toEqual({ x: 1, y: 1, direcao: "oeste" });
    // o certo: girar E andar
    expect(executar(fase, ["girar-esquerda", "frente"]).resultado).toBe("estrela");
  });

  test("bater na parede para a execução e a Manu NÃO entra na parede", () => {
    const fase: Fase = { grade: ["M#E"], direcaoInicial: "leste" };
    const { passos, resultado } = executar(fase, ["frente", "frente"]);
    expect(resultado).toBe("parede");
    expect(passos).toHaveLength(1); // só o passo do esbarrão, nada depois
    // posição VÁLIDA: fica onde estava (nunca dentro do # nem fora da grade)
    expect(passos[0]).toEqual({ x: 0, y: 0, direcao: "leste" });
  });

  test("esbarrão na borda também mantém posição válida", () => {
    const fase: Fase = { grade: ["ME"], direcaoInicial: "oeste" };
    const { passos } = executar(fase, ["frente"]);
    expect(passos[0]).toEqual({ x: 0, y: 0, direcao: "oeste" });
  });

  test("NENHUM giro avança: posição idêntica após girar para cada lado", () => {
    // mata a mutação "girar-direita também dá um passo" — a fixture da fase 2
    // sozinha continuaria verde (chegaria na estrela um comando antes)
    const fase: Fase = { grade: ["M..", "...", "..E"], direcaoInicial: "leste" };
    for (const giro of ["girar-esquerda", "girar-direita"] as const) {
      const { passos } = executar(fase, [giro]);
      expect(passos[0].x).toBe(0);
      expect(passos[0].y).toBe(0);
    }
  });

  test("borda do tabuleiro é parede", () => {
    const fase: Fase = { grade: ["ME"], direcaoInicial: "oeste" };
    expect(executar(fase, ["frente"]).resultado).toBe("parede");
  });

  test("giros compõem o ciclo completo das 4 direções", () => {
    let d: Direcao = "norte";
    for (const esperado of ["leste", "sul", "oeste", "norte"] as Direcao[]) {
      d = girar(d, "girar-direita");
      expect(d).toBe(esperado);
    }
    expect(girar("norte", "girar-esquerda")).toBe("oeste");
  });

  test("fila além do máximo é ignorada", () => {
    const fase: Fase = { grade: ["M............E"], direcaoInicial: "leste" };
    const fila = Array.from({ length: 13 }, () => "frente" as Comando);
    // a estrela está a 13 passos; com teto 12 a fila não chega
    expect(executar(fase, fila).resultado).toBe("fim-da-fila");
  });
});
