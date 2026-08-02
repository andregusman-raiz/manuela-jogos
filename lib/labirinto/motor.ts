import type { Comando, Direcao, Execucao, Fase, Posicao } from "./tipos";

/**
 * Motor do Labirinto — simulação PURA e síncrona: o componente só anima a
 * lista de passos que sai daqui. Semântica da SPEC §4.3: frente avança 1
 * célula; giros são puros (90°, não avançam).
 */

export const FILA_MAXIMA = 12;

const DELTA: Record<Direcao, { dx: number; dy: number }> = {
  norte: { dx: 0, dy: -1 },
  sul: { dx: 0, dy: 1 },
  leste: { dx: 1, dy: 0 },
  oeste: { dx: -1, dy: 0 },
};

const ESQUERDA: Record<Direcao, Direcao> = {
  norte: "oeste",
  oeste: "sul",
  sul: "leste",
  leste: "norte",
};
const DIREITA: Record<Direcao, Direcao> = {
  norte: "leste",
  leste: "sul",
  sul: "oeste",
  oeste: "norte",
};

export function girar(direcao: Direcao, comando: "girar-esquerda" | "girar-direita"): Direcao {
  return comando === "girar-esquerda" ? ESQUERDA[direcao] : DIREITA[direcao];
}

export function posicaoInicial(fase: Fase): Posicao {
  for (let y = 0; y < fase.grade.length; y++) {
    const x = fase.grade[y].indexOf("M");
    if (x >= 0) return { x, y, direcao: fase.direcaoInicial };
  }
  throw new Error("fase sem personagem");
}

export function posicaoEstrela(fase: Fase): { x: number; y: number } {
  for (let y = 0; y < fase.grade.length; y++) {
    const x = fase.grade[y].indexOf("E");
    if (x >= 0) return { x, y };
  }
  throw new Error("fase sem estrela");
}

export function ehParede(fase: Fase, x: number, y: number): boolean {
  if (y < 0 || y >= fase.grade.length) return true;
  if (x < 0 || x >= fase.grade[y].length) return true;
  return fase.grade[y][x] === "#";
}

/**
 * Executa a fila inteira. Para no primeiro evento terminal: estrela alcançada,
 * parede batida, ou fila esgotada sem estrela.
 */
export function executar(fase: Fase, fila: Comando[]): Execucao {
  const estrela = posicaoEstrela(fase);
  let atual = posicaoInicial(fase);
  const passos: Posicao[] = [];

  for (const comando of fila.slice(0, FILA_MAXIMA)) {
    if (comando === "frente") {
      const { dx, dy } = DELTA[atual.direcao];
      const proxima = { x: atual.x + dx, y: atual.y + dy, direcao: atual.direcao };
      if (ehParede(fase, proxima.x, proxima.y)) {
        // o esbarrão NÃO entra na parede: a Manu fica onde está (o shake do
        // componente comunica a batida; posição inválida sumia com ela da grade)
        passos.push({ ...atual });
        return { passos, resultado: "parede" };
      }
      atual = proxima;
    } else {
      atual = { ...atual, direcao: girar(atual.direcao, comando) };
    }
    passos.push(atual);
    if (atual.x === estrela.x && atual.y === estrela.y) {
      return { passos, resultado: "estrela" };
    }
  }
  return { passos, resultado: "fim-da-fila" };
}
