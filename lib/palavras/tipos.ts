export type NivelPalavras = 1 | 2 | 3;

export type Rodada = {
  palavra: string;
  emoji: string;
  /** Trecho faltante: palavra.slice(inicio, fim). */
  inicio: number;
  fim: number;
  resposta: string;
  /** 4 opções únicas embaralhadas, contendo a resposta. */
  opcoes: string[];
};
