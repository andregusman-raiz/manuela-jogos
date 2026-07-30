import type { Metadata } from "next";
import { Memoria } from "@/components/memoria/Memoria";

export const metadata: Metadata = {
  title: "Jogo da Memória",
};

export default function PaginaMemoria() {
  return <Memoria />;
}
