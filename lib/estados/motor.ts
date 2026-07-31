import { criarRng } from "@/lib/contas/motor";
import { ESTADOS, type SiglaUF } from "./mapa";

/**
 * Motor do Estados do Brasil — SPEC onda 3 §3.2. O SCAFFOLD vive AQUI:
 * o estado da fase carrega a pergunta corrente e o contador de erros dela;
 * eventos pertencem à pergunta que os gerou (corrida com o acerto morre por
 * construção).
 */

export { criarRng };
export { ESTADOS };
export type { SiglaUF };

export type NivelEstados = 1 | 2 | 3;
export const PERGUNTAS_POR_FASE = 8;
export const ERROS_PARA_SCAFFOLD = 2;
export const NIVEL_MAXIMO_ESTADOS: NivelEstados = 3;

export type FaseEstados = {
  nivel: NivelEstados;
  perguntas: SiglaUF[];
  indice: number;
  /** erros na pergunta CORRENTE. */
  erros: number;
  acertos: number;
};

export type EventoEstados = "acerto" | "erro" | "scaffold" | "nada";

export function enunciado(nivel: NivelEstados, uf: SiglaUF): string {
  if (nivel === 1) return `Toque em: ${ESTADOS[uf].nome}`;
  if (nivel === 2) return `Onde fica ${ESTADOS[uf].capital}?`;
  return `Toque em: ${uf}`;
}

function embaralhar<T>(itens: T[], rng: () => number): T[] {
  const copia = [...itens];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

export function gerarFase(nivel: NivelEstados, seed: number): FaseEstados {
  const rng = criarRng(seed);
  const perguntas = embaralhar(Object.keys(ESTADOS) as SiglaUF[], rng).slice(
    0,
    PERGUNTAS_POR_FASE,
  );
  return { nivel, perguntas, indice: 0, erros: 0, acertos: 0 };
}

export function perguntaAtual(fase: FaseEstados): SiglaUF | null {
  return fase.indice < fase.perguntas.length ? fase.perguntas[fase.indice] : null;
}

/** Fase completa? */
export function completa(fase: FaseEstados): boolean {
  return fase.indice >= PERGUNTAS_POR_FASE;
}

export function responder(
  fase: FaseEstados,
  uf: SiglaUF,
): { fase: FaseEstados; evento: EventoEstados } {
  const alvo = perguntaAtual(fase);
  if (!alvo) return { fase, evento: "nada" };

  if (uf === alvo) {
    return {
      fase: { ...fase, indice: fase.indice + 1, erros: 0, acertos: fase.acertos + 1 },
      evento: "acerto",
    };
  }
  const erros = fase.erros + 1;
  return {
    fase: { ...fase, erros },
    evento: erros >= ERROS_PARA_SCAFFOLD ? "scaffold" : "erro",
  };
}

export function proximoNivelEstados(nivel: NivelEstados): NivelEstados {
  return nivel >= NIVEL_MAXIMO_ESTADOS ? NIVEL_MAXIMO_ESTADOS : ((nivel + 1) as NivelEstados);
}
