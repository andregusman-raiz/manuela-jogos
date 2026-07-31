import { describe, expect, test } from "vitest";
import { ESTADOS, type SiglaUF } from "@/lib/estados/mapa";
import {
  PERGUNTAS_POR_FASE,
  completa,
  enunciado,
  gerarFase,
  perguntaAtual,
  responder,
} from "@/lib/estados/motor";

/** Oráculo: capitais das 27 UFs hard-coded (fonte: conhecimento comum). */
const CAPITAIS: Record<string, string> = {
  AC: "Rio Branco", AL: "Maceió", AP: "Macapá", AM: "Manaus", BA: "Salvador",
  CE: "Fortaleza", DF: "Brasília", ES: "Vitória", GO: "Goiânia", MA: "São Luís",
  MT: "Cuiabá", MS: "Campo Grande", MG: "Belo Horizonte", PA: "Belém",
  PB: "João Pessoa", PR: "Curitiba", PE: "Recife", PI: "Teresina",
  RJ: "Rio de Janeiro", RN: "Natal", RS: "Porto Alegre", RO: "Porto Velho",
  RR: "Boa Vista", SC: "Florianópolis", SP: "São Paulo", SE: "Aracaju",
  TO: "Palmas",
};

describe("mapa do IBGE", () => {
  test("27 UFs com path não-vazio e capitais corretas (oráculo do teste)", () => {
    const siglas = Object.keys(ESTADOS);
    expect(siglas).toHaveLength(27);
    for (const sigla of siglas) {
      const uf = ESTADOS[sigla as SiglaUF];
      expect(uf.path.length, sigla).toBeGreaterThan(50);
      expect(uf.path.startsWith("M "), sigla).toBe(true);
      expect(uf.capital, sigla).toBe(CAPITAIS[sigla]);
    }
  });

  test("âncoras geográficas SOBRE OS PATHS: trocar dois paths quebra aqui", () => {
    // bbox derivado do PRÓPRIO path — validar só o metadado centroide deixava
    // a mutação path-trocado passar (review do PR B)
    const bbox = (s: SiglaUF) => {
      const nums = ESTADOS[s].path.match(/[\d.]+/g)!.map(Number);
      const xs = nums.filter((_, i) => i % 2 === 0);
      const ys = nums.filter((_, i) => i % 2 === 1);
      return {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minY: Math.min(...ys),
        maxY: Math.max(...ys),
      };
    };
    const siglas = Object.keys(ESTADOS) as SiglaUF[];
    const norteMais = siglas.reduce((a, b) => (bbox(a).minY < bbox(b).minY ? a : b));
    const sulMais = siglas.reduce((a, b) => (bbox(a).maxY > bbox(b).maxY ? a : b));
    const oesteMais = siglas.reduce((a, b) => (bbox(a).minX < bbox(b).minX ? a : b));
    expect(norteMais).toBe("RR");
    expect(sulMais).toBe("RS");
    expect(oesteMais).toBe("AC");
    // costa leste: PB e RN mais a leste que BA; AM a oeste de PA
    expect(bbox("PB").maxX).toBeGreaterThan(bbox("BA").maxX);
    expect(bbox("RN").maxX).toBeGreaterThan(bbox("BA").maxX);
    expect(bbox("AM").minX).toBeLessThan(bbox("PA").minX);
    // DF: bbox CONTIDO no bbox de GO (contenção, não proximidade)
    const df = bbox("DF");
    const go = bbox("GO");
    expect(df.minX).toBeGreaterThan(go.minX);
    expect(df.maxX).toBeLessThan(go.maxX);
    expect(df.minY).toBeGreaterThan(go.minY);
    expect(df.maxY).toBeLessThan(go.maxY);
    // e o centroide publicado fica dentro do bbox do próprio path
    for (const s of siglas) {
      const b = bbox(s);
      const [cx, cy] = ESTADOS[s].centroide;
      expect(cx, s).toBeGreaterThanOrEqual(b.minX);
      expect(cx, s).toBeLessThanOrEqual(b.maxX);
      expect(cy, s).toBeGreaterThanOrEqual(b.minY);
      expect(cy, s).toBeLessThanOrEqual(b.maxY);
    }
  });

  test("os pinos previstos pela conta do juízo existem", () => {
    for (const sigla of ["DF", "SE", "AL", "RN", "PB"]) {
      expect(ESTADOS[sigla as SiglaUF].pino, sigla).toBe(true);
    }
  });
});

describe("máquina da fase", () => {
  test("100 seeds: 8 perguntas sem repetição", () => {
    for (let seed = 0; seed < 100; seed++) {
      const fase = gerarFase(1, seed);
      expect(new Set(fase.perguntas).size).toBe(PERGUNTAS_POR_FASE);
    }
  });

  test("scaffold no 2º erro DA MESMA pergunta; acerto depois conta normal", () => {
    const fase = gerarFase(1, 7);
    const alvo = perguntaAtual(fase)!;
    const errada = (Object.keys(ESTADOS) as SiglaUF[]).find((s) => s !== alvo)!;

    const e1 = responder(fase, errada);
    expect(e1.evento).toBe("erro");
    const e2 = responder(e1.fase, errada);
    expect(e2.evento).toBe("scaffold");
    // acertar depois do scaffold conta e ZERA os erros para a próxima
    const ok = responder(e2.fase, alvo);
    expect(ok.evento).toBe("acerto");
    expect(ok.fase.acertos).toBe(1);
    expect(ok.fase.erros).toBe(0);
  });

  test("8 acertos completam; responder depois é 'nada'", () => {
    let fase = gerarFase(3, 9);
    for (let i = 0; i < PERGUNTAS_POR_FASE; i++) {
      fase = responder(fase, perguntaAtual(fase)!).fase;
    }
    expect(completa(fase)).toBe(true);
    expect(responder(fase, "BA").evento).toBe("nada");
  });

  test("enunciados por nível", () => {
    expect(enunciado(1, "CE")).toBe("Toque em: Ceará");
    expect(enunciado(2, "BA")).toBe("Onde fica Salvador?");
    expect(enunciado(3, "BA")).toBe("Toque em: BA");
  });
});
