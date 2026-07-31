import { describe, expect, test } from "vitest";
import {
  contar,
  estadoInicial,
  mover,
  movimentosLegais,
  pararCadeia,
  temMovimento,
} from "@/lib/damas/motor";
import type { EstadoDamas, Peca } from "@/lib/damas/motor";

/** Monta um tabuleiro a partir de um mapa esparso "linha,coluna" → peça. */
function tabuleiroCom(pecas: Record<string, Peca>, vez: "rosa" | "azul" = "rosa"): EstadoDamas {
  const tabuleiro = Array.from({ length: 8 }, () => new Array<Peca | null>(8).fill(null));
  for (const [chave, peca] of Object.entries(pecas)) {
    const [linha, coluna] = chave.split(",").map(Number);
    tabuleiro[linha][coluna] = peca;
  }
  return { tabuleiro, vez, cadeia: null, vencedor: null };
}

const R: Peca = { cor: "rosa", dama: false };
const A: Peca = { cor: "azul", dama: false };
const DR: Peca = { cor: "rosa", dama: true };

describe("estado inicial", () => {
  test("12 peças de cada cor nas casas escuras; rosa começa", () => {
    const e = estadoInicial();
    expect(contar(e, "rosa")).toBe(12);
    expect(contar(e, "azul")).toBe(12);
    expect(e.vez).toBe("rosa");
    for (let l = 0; l < 8; l++) {
      for (let c = 0; c < 8; c++) {
        if (e.tabuleiro[l][c]) expect((l + c) % 2).toBe(1);
      }
    }
  });
});

describe("movimentos e capturas — regras da casa", () => {
  test("comum anda 1 para frente; movimento ilegal = MESMA referência", () => {
    const e = tabuleiroCom({ "5,2": R });
    const legais = movimentosLegais(e, { linha: 5, coluna: 2 });
    expect(legais.map((m) => `${m.para.linha},${m.para.coluna}`).sort()).toEqual(["4,1", "4,3"]);
    expect(mover(e, { de: { linha: 5, coluna: 2 }, para: { linha: 3, coluna: 2 } })).toBe(e);
  });

  test("captura por pulo remove a peça — inclusive PARA TRÁS (regra da casa)", () => {
    // azul ATRÁS da rosa: pulo para trás permitido
    const e = tabuleiroCom({ "4,3": R, "5,4": A });
    const capturas = movimentosLegais(e, { linha: 4, coluna: 3 }).filter((m) => m.captura);
    expect(capturas).toHaveLength(1);
    const depois = mover(e, capturas[0]);
    expect(contar(depois, "azul")).toBe(0);
    expect(depois.vencedor).toBe("rosa"); // azul ficou sem peças
  });

  test("captura NÃO é obrigatória: andar simples continua legal com pulo disponível", () => {
    const e = tabuleiroCom({ "4,3": R, "3,4": A });
    const legais = movimentosLegais(e, { linha: 4, coluna: 3 });
    expect(legais.some((m) => m.captura)).toBe(true);
    expect(legais.some((m) => !m.captura)).toBe(true);
  });

  test("cadeia dupla: mesma peça segue capturando e SÓ ela pode jogar", () => {
    const e = tabuleiroCom({ "6,1": R, "5,2": A, "3,4": A, "6,5": R });
    const primeira = movimentosLegais(e, { linha: 6, coluna: 1 }).find((m) => m.captura)!;
    const meio = mover(e, primeira);
    expect(meio.vez).toBe("rosa"); // cadeia: vez NÃO troca
    expect(meio.cadeia).toEqual({ linha: 4, coluna: 3 });
    // a outra peça rosa não pode jogar durante a cadeia
    expect(movimentosLegais(meio, { linha: 6, coluna: 5 })).toHaveLength(0);
    // e a peça da cadeia SÓ tem capturas
    const seg = movimentosLegais(meio, { linha: 4, coluna: 3 });
    expect(seg.length).toBeGreaterThan(0);
    expect(seg.every((m) => m.captura)).toBe(true);
    const fim = mover(meio, seg[0]);
    expect(contar(fim, "azul")).toBe(0);
  });

  test("'parar aqui' encerra a cadeia e passa a vez", () => {
    const e = tabuleiroCom({ "6,1": R, "5,2": A, "3,4": A, "0,7": A });
    const primeira = movimentosLegais(e, { linha: 6, coluna: 1 }).find((m) => m.captura)!;
    const meio = mover(e, primeira);
    expect(meio.cadeia).not.toBeNull();
    const parado = pararCadeia(meio);
    expect(parado.cadeia).toBeNull();
    expect(parado.vez).toBe("azul");
    // fora de cadeia, pararCadeia é no-op por referência
    expect(pararCadeia(parado)).toBe(parado);
  });

  test("PROMOÇÃO ENCERRA A JOGADA mesmo com pulo disponível (fixture do juízo)", () => {
    // rosa em 2,1 captura azul em 1,2 e cai em 0,3 (última linha → dama);
    // haveria pulo de volta sobre azul em 1,4 — mas a jogada TERMINA
    const e = tabuleiroCom({ "2,1": R, "1,2": A, "1,4": A });
    const captura = movimentosLegais(e, { linha: 2, coluna: 1 }).find(
      (m) => m.para.linha === 0 && m.para.coluna === 3,
    )!;
    const depois = mover(e, captura);
    expect(depois.tabuleiro[0][3]?.dama).toBe(true);
    expect(depois.cadeia).toBeNull();
    expect(depois.vez).toBe("azul");
    expect(contar(depois, "azul")).toBe(1); // só a segunda sobrou
  });

  test("dama anda e captura 1 casa em QUALQUER diagonal (não voadora)", () => {
    const e = tabuleiroCom({ "4,3": DR, "3,2": A });
    const legais = movimentosLegais(e, { linha: 4, coluna: 3 });
    // andar nas 3 diagonais livres + capturar a azul
    expect(legais.filter((m) => !m.captura)).toHaveLength(3);
    const captura = legais.find((m) => m.captura)!;
    expect(captura.para).toEqual({ linha: 2, coluna: 1 });
    // não voadora: nada de destino a 2+ casas sem captura
    for (const m of legais.filter((x) => !x.captura)) {
      expect(Math.abs(m.para.linha - 4)).toBe(1);
    }
  });

  test("fim NATURAL da cadeia (sem segundo pulo): vez troca sozinha", () => {
    const e = tabuleiroCom({ "6,1": R, "5,2": A, "0,7": A });
    const captura = movimentosLegais(e, { linha: 6, coluna: 1 }).find((m) => m.captura)!;
    const depois = mover(e, captura);
    expect(depois.cadeia).toBeNull();
    expect(depois.vez).toBe("azul");
  });

  test("temMovimento DURANTE cadeia ignora a trava (sonda o jogo inteiro)", () => {
    const e = tabuleiroCom({ "6,1": R, "5,2": A, "3,4": A, "0,1": A });
    const primeira = movimentosLegais(e, { linha: 6, coluna: 1 }).find((m) => m.captura)!;
    const meio = mover(e, primeira);
    expect(meio.cadeia).not.toBeNull();
    expect(temMovimento(meio, "azul")).toBe(true);
  });

  test("'parar aqui' pode DECLARAR vencedor (adversário bloqueado)", () => {
    // azul única em 0,1 travada; rosa entra em cadeia e para — azul sem lance
    const e = tabuleiroCom({ "6,1": R, "5,2": A, "3,4": A, "0,1": A, "1,0": R, "1,2": R, "2,3": R });
    const primeira = movimentosLegais(e, { linha: 6, coluna: 1 }).find((m) => m.captura)!;
    const meio = mover(e, primeira);
    expect(meio.cadeia).not.toBeNull();
    const parado = pararCadeia(meio);
    // azul restante: 3,4 (a segunda foi... não: 5,2 capturada; restam 3,4 e 0,1)
    // 3,4 TEM movimento → sem vencedor neste cenário; agora o de bloqueio real:
    expect(parado.vencedor).toBeNull();

    const bloqueado = tabuleiroCom({ "6,1": R, "5,2": A, "0,1": A, "1,0": R, "1,2": R, "2,3": R });
    const cap = movimentosLegais(bloqueado, { linha: 6, coluna: 1 }).find((m) => m.captura)!;
    const m2 = mover(bloqueado, cap);
    // capturou a 5,2; azul só tem a 0,1 travada → vencedor imediato ou ao parar
    const final = m2.cadeia ? pararCadeia(m2) : m2;
    expect(final.vencedor).toBe("rosa");
  });

  test("DAMA captura PARA TRÁS (a fixture anterior só cobria para frente)", () => {
    // dama rosa em 3,2 com azul ATRÁS dela (4,3): pulo para trás cai em 5,4
    const e = tabuleiroCom({ "3,2": DR, "4,3": A, "0,7": A });
    const capturas = movimentosLegais(e, { linha: 3, coluna: 2 }).filter((m) => m.captura);
    expect(capturas.some((m) => m.para.linha === 5 && m.para.coluna === 4)).toBe(true);
  });

  test("fim por BLOQUEIO: adversário com peça mas sem movimento perde", () => {
    // azul em 0,1 travada: 1,0 ocupada por rosa protegida (pulo cairia fora) e 1,2 ocupada com 2,3 ocupada
    const e = tabuleiroCom({ "0,1": A, "1,0": R, "1,2": R, "2,3": R, "7,6": R }, "rosa");
    expect(temMovimento(e, "azul")).toBe(false);
    // rosa joga qualquer coisa e azul fica sem resposta → rosa vence
    const mov = movimentosLegais(e, { linha: 7, coluna: 6 })[0];
    const depois = mover(e, mov);
    expect(depois.vencedor).toBe("rosa");
  });
});
