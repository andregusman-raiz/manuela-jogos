import type { Desenho, Operacao } from "./tipos";

/**
 * Funções puras sobre o documento (a lista de operações). Ficam fora do Motor
 * para serem testáveis sem canvas e reusáveis pelo share da galeria.
 */

/**
 * Reescreve uma operação para outra escala de canvas.
 *
 * É o que torna a exportação VETORIAL: em vez de esticar o bitmap (borrado),
 * re-executamos as operações num canvas maior. O balde re-roda o flood fill no
 * espaço maior — mais caro, mas exportar é raro e o resultado é nítido.
 */
export function escalarOperacao(op: Operacao, f: number): Operacao {
  switch (op.kind) {
    case "traco":
      return {
        ...op,
        espessura: op.espessura * f,
        pontos: op.pontos.map((p) => ({ x: p.x * f, y: p.y * f, f: p.f })),
      };
    case "carimbo":
      return { ...op, x: op.x * f, y: op.y * f, tamanho: op.tamanho * f };
    case "forma":
      return {
        ...op,
        espessura: op.espessura * f,
        x1: op.x1 * f,
        y1: op.y1 * f,
        x2: op.x2 * f,
        y2: op.y2 * f,
      };
    case "balde":
      return { ...op, x: op.x * f, y: op.y * f };
    case "fundo":
    case "regiao":
      return op;
  }
}

export function escalarDesenho(desenho: Desenho, f: number): Desenho {
  return {
    ...desenho,
    largura: Math.max(1, Math.round(desenho.largura * f)),
    altura: Math.max(1, Math.round(desenho.altura * f)),
    operacoes: desenho.operacoes.map((op) => escalarOperacao(op, f)),
  };
}

/** Cores por região do livro de colorir, a partir das operações (última vence). */
export function regioesDeOperacoes(operacoes: Operacao[]): Record<string, string> {
  const mapa: Record<string, string> = {};
  for (const op of operacoes) {
    if (op.kind === "regiao") mapa[op.regiao] = op.cor;
  }
  return mapa;
}
