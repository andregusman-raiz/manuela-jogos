import { describe, expect, test } from "vitest";
import { criarDado } from "@/lib/dado";
import {
  CHEGADA,
  ESTRELAS,
  SAIDA,
  criarPartida,
  jogadasLegais,
  mover,
  posicaoGlobal,
  rolar,
} from "@/lib/ludo/motor";
import type { DadoLudo, EstadoLudo, PeaoLudo } from "@/lib/ludo/motor";

/** Estado sob medida: motor puro aceita qualquer estado bem-formado. */
function estadoCom(
  peoes: PeaoLudo[],
  extra: Partial<EstadoLudo> = {},
): EstadoLudo {
  return {
    nivel: 1,
    jogadores: 2,
    peoes,
    vez: 0,
    dado: null,
    seisSeguidos: 0,
    situacao: "rolar",
    vencedor: null,
    ...extra,
  };
}

describe("posicaoGlobal — fronteira volta/coluna (oráculo do juiz, J3)", () => {
  // hard-coded por cor: progresso 49/50 têm global; 51/55/56 NÃO (coluna/chegada)
  const oraculo: Array<[cor: 0 | 1 | 2 | 3, progresso: number, global: number | null]> = [
    [0, 49, 49], [0, 50, 50], [0, 51, null], [0, 55, null], [0, 56, null],
    [1, 49, 10], [1, 50, 11], [1, 51, null], [1, 55, null], [1, 56, null],
    [2, 49, 23], [2, 50, 24], [2, 51, null], [2, 55, null], [2, 56, null],
    [3, 49, 36], [3, 50, 37], [3, 51, null], [3, 55, null], [3, 56, null],
  ];
  test.each(oraculo)("cor %i progresso %i → global %s", (cor, progresso, global) => {
    expect(posicaoGlobal({ cor, indice: 0, progresso })).toBe(global);
  });

  test("base (-1) não tem posição global", () => {
    expect(posicaoGlobal({ cor: 0, indice: 0, progresso: -1 })).toBeNull();
  });
});

describe("saída da base", () => {
  test("só sai com 6", () => {
    const base = estadoCom([
      { cor: 0, indice: 0, progresso: -1 },
      { cor: 1, indice: 0, progresso: 20 },
    ]);
    for (const d of [1, 2, 3, 4, 5] as DadoLudo[]) {
      const rolado = rolar(base, d);
      expect(rolado.situacao, `dado ${d} não deveria dar jogada`).toBe("rolar");
      expect(rolado.vez).toBe(1); // sem jogada legal → passou a vez
    }
    const seis = rolar(base, 6);
    expect(seis.situacao).toBe("mover");
    const movido = mover(seis, 0);
    expect(movido.peoes[0].progresso).toBe(0);
    expect(movido.vez).toBe(0); // 6 repete a vez
  });
});

describe("captura", () => {
  test("pousar em adversário devolve à base — e captura PILHA inteira (J2)", () => {
    // dois peões da cor 1 na global 10 (progresso 10 deles); cor 0 chega lá
    const estado = estadoCom(
      [
        { cor: 0, indice: 0, progresso: 4 }, // global 4; 4+6=10 (não-segura)
        { cor: 1, indice: 0, progresso: 49 }, // global (13+49)%52 = 10
        { cor: 1, indice: 1, progresso: 49 },
      ],
    );
    const movido = mover(rolar(estado, 6), 0);
    expect(movido.peoes[0].progresso).toBe(10);
    expect(movido.peoes[1].progresso).toBe(-1);
    expect(movido.peoes[2].progresso).toBe(-1);
  });

  test("casa segura (estrela e saída) NÃO captura", () => {
    expect(ESTRELAS).toContain(8);
    const estrela = estadoCom([
      { cor: 0, indice: 0, progresso: 2 }, // 2+6=8 = estrela
      { cor: 1, indice: 0, progresso: 47 }, // global (13+47)%52 = 8
    ]);
    const naEstrela = mover(rolar(estrela, 6), 0);
    expect(naEstrela.peoes[1].progresso).toBe(47); // coexistem

    const saida = estadoCom([
      { cor: 0, indice: 0, progresso: 7 }, // 7+6=13 = SAIDA da cor 1
      { cor: 1, indice: 0, progresso: 0 }, // global 13
    ]);
    expect(SAIDA).toContain(13);
    const naSaida = mover(rolar(saida, 6), 0);
    expect(naSaida.peoes[1].progresso).toBe(0);
  });

  test("peão na coluna final nunca captura nem é capturado", () => {
    const estado = estadoCom([
      { cor: 0, indice: 0, progresso: 51 },
      { cor: 1, indice: 0, progresso: 38 }, // global (13+38)%52 = 51... sem colisão: globais distintos
    ]);
    // cor 0 progresso 51 não tem global; mover cor 0 com 1 → 52, segue sem tocar ninguém
    const movido = mover(rolar(estado, 1), 0);
    expect(movido.peoes[0].progresso).toBe(52);
    expect(movido.peoes[1].progresso).toBe(38);
  });
});

describe("chegada exata e vitória", () => {
  test("55 + 2 é ilegal; 55 + 1 chega", () => {
    const estado = estadoCom([
      { cor: 0, indice: 0, progresso: 55 },
      { cor: 0, indice: 1, progresso: 56 },
      { cor: 1, indice: 0, progresso: 5 },
    ]);
    const dois = rolar(estado, 2);
    expect(dois.situacao).toBe("rolar"); // sem legal → passou
    expect(dois.vez).toBe(1);
    const um = mover(rolar(estado, 1), 0);
    expect(um.peoes[0].progresso).toBe(CHEGADA);
    expect(um.situacao).toBe("fim");
    expect(um.vencedor).toBe(0);
  });
});

describe("máquina de turno (J1)", () => {
  test("sem jogada legal passa a vez MESMO com 6 (peões em 55 e 56)", () => {
    const estado = estadoCom([
      { cor: 0, indice: 0, progresso: 55 },
      { cor: 0, indice: 1, progresso: 56 },
      { cor: 1, indice: 0, progresso: 5 },
    ]);
    const seis = rolar(estado, 6);
    expect(seis.situacao).toBe("rolar");
    expect(seis.vez).toBe(1);
    expect(seis.seisSeguidos).toBe(0);
  });

  test("três 6 no nível 2 passa a vez sem expor 'mover'; nível 1 não pune", () => {
    const nivel2 = estadoCom(
      [
        { cor: 0, indice: 0, progresso: 10 },
        { cor: 1, indice: 0, progresso: 30 },
      ],
      { nivel: 2, seisSeguidos: 2 },
    );
    const terceiro = rolar(nivel2, 6);
    expect(terceiro.situacao).toBe("rolar");
    expect(terceiro.vez).toBe(1);
    expect(terceiro.seisSeguidos).toBe(0);

    const nivel1 = estadoCom(
      [
        { cor: 0, indice: 0, progresso: 10 },
        { cor: 1, indice: 0, progresso: 30 },
      ],
      { nivel: 1, seisSeguidos: 2 },
    );
    expect(rolar(nivel1, 6).situacao).toBe("mover");
  });

  test("6 com jogada → mover e repetir; sem 6 → próxima vez", () => {
    const estado = estadoCom([
      { cor: 0, indice: 0, progresso: 10 },
      { cor: 1, indice: 0, progresso: 30 },
    ]);
    const comSeis = mover(rolar(estado, 6), 0);
    expect(comSeis.vez).toBe(0);
    expect(comSeis.situacao).toBe("rolar");
    const semSeis = mover(rolar(estado, 3), 0);
    expect(semSeis.vez).toBe(1);
  });
});

describe("bloqueio (nível 2)", () => {
  const pilhaAdversaria = (): PeaoLudo[] => [
    { cor: 0, indice: 0, progresso: 4 }, // quer pousar na global 10
    { cor: 1, indice: 0, progresso: 49 }, // global 10
    { cor: 1, indice: 1, progresso: 49 }, // global 10 → pilha de 2
  ];

  test("≥2 adversários impedem POUSO em casa não-segura", () => {
    const estado = estadoCom(pilhaAdversaria(), { nivel: 2 });
    const rolado = rolar(estado, 6);
    // única jogada seria pousar na 10 (bloqueada) → sem legal → passa
    expect(rolado.situacao).toBe("rolar");
    expect(rolado.vez).toBe(1);
  });

  test("bloqueio NÃO impede passagem por cima", () => {
    const estado = estadoCom(
      [{ cor: 0, indice: 0, progresso: 8 }, ...pilhaAdversaria().slice(1)],
      { nivel: 2 },
    );
    // 8+6=14 passa por cima da 10 sem pousar
    const movido = mover(rolar(estado, 6), 0);
    expect(movido.peoes[0].progresso).toBe(14);
  });

  test("pilha própria no nível 1 NÃO bloqueia adversário", () => {
    const estado = estadoCom(pilhaAdversaria(), { nivel: 1 });
    const movido = mover(rolar(estado, 6), 0);
    expect(movido.peoes[0].progresso).toBe(10); // pousa e captura os dois
    expect(movido.peoes[1].progresso).toBe(-1);
    expect(movido.peoes[2].progresso).toBe(-1);
  });
});

describe("fuzz seeded — partidas inteiras", () => {
  test("500 partidas 2P nível 1 terminam em ≤600 rolagens com peões conservados", () => {
    for (let semente = 1; semente <= 500; semente++) {
      const dado = criarDado(semente);
      let estado = criarPartida(2, 1);
      let rolagens = 0;
      while (estado.situacao !== "fim" && rolagens < 600) {
        if (estado.situacao === "rolar") {
          estado = rolar(estado, dado());
          rolagens++;
        } else {
          const legais = jogadasLegais(estado);
          estado = mover(estado, legais[0]);
        }
        for (const cor of [0, 1]) {
          expect(estado.peoes.filter((p) => p.cor === cor)).toHaveLength(2);
        }
      }
      expect(estado.situacao, `semente ${semente} não terminou`).toBe("fim");
      expect(estado.vencedor).not.toBeNull();
    }
  });
});
