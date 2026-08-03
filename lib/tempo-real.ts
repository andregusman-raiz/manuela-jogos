/**
 * Laço de tempo real da casa (SPEC-jogos-corrida §0.1) — fixed timestep com
 * acumulador.
 *
 * Os motores continuam `tick(estado, entrada)` PUROS com dt fixo de 1/60 s;
 * quem fecha o loop é isto aqui. Sem o acumulador, tick=rAF faria o jogo
 * rodar 2× mais rápido num iPhone ProMotion (120 Hz) e uma aba lenta
 * dispararia uma rajada de recuperação que congela a UI (blocker B1 do juiz).
 *
 * `agendar`/`cancelar` são injetáveis para o teste de unidade dirigir os
 * quadros com timestamps sintéticos; na UI ficam os defaults de rAF.
 */

export const PASSO_MS = 1000 / 60;
export const DELTA_MAXIMO_MS = 250;
export const PASSOS_MAXIMOS_POR_QUADRO = 5;

export interface LacoTempoReal {
  /** Agenda o primeiro quadro (não faz nada se já está rodando). */
  iniciar(): void;
  /** Cancela o próximo quadro e zera o relógio (pausa/fim/unmount). */
  parar(): void;
  rodando(): boolean;
}

export function criarLaco(opcoes: {
  /** Um passo de simulação (dt fixo 1/60). Chamado 0..5 vezes por quadro. */
  aoPasso: () => void;
  /** Pintura — exatamente 1 vez por quadro, depois dos passos. */
  aoQuadro: () => void;
  agendar?: (cb: (agora: number) => void) => number;
  cancelar?: (id: number) => void;
}): LacoTempoReal {
  const agendar = opcoes.agendar ?? ((cb) => requestAnimationFrame(cb));
  const cancelar = opcoes.cancelar ?? ((id) => cancelAnimationFrame(id));
  let anterior: number | null = null;
  let acumulado = 0;
  let idQuadro: number | null = null;
  // flag própria: parar() DENTRO de um aoPasso (fim de corrida) precisa
  // impedir o reagendamento no fim do quadro corrente — cancelar o id de um
  // rAF que já disparou é no-op e o laço ressuscitava (review PR #56 B1)
  let ativo = false;

  const quadro = (agora: number) => {
    if (!ativo) return;
    // truncar o delta cobre aba dormindo/minimizada: ao voltar, no máximo
    // DELTA_MAXIMO entra no acumulador — nunca "2 s de ticks de uma vez"
    if (anterior !== null) acumulado += Math.min(agora - anterior, DELTA_MAXIMO_MS);
    anterior = agora;
    let passos = 0;
    while (ativo && acumulado >= PASSO_MS && passos < PASSOS_MAXIMOS_POR_QUADRO) {
      opcoes.aoPasso();
      acumulado -= PASSO_MS;
      passos += 1;
    }
    // atraso além do teto de passos é DESCARTADO (preserva só a fração)
    if (acumulado >= PASSO_MS) acumulado = acumulado % PASSO_MS;
    opcoes.aoQuadro();
    if (ativo) idQuadro = agendar(quadro);
  };

  return {
    iniciar() {
      if (ativo) return;
      ativo = true;
      anterior = null;
      acumulado = 0;
      idQuadro = agendar(quadro);
    },
    parar() {
      ativo = false;
      if (idQuadro !== null) cancelar(idQuadro);
      idQuadro = null;
      anterior = null;
      acumulado = 0;
    },
    rodando() {
      return ativo;
    },
  };
}
