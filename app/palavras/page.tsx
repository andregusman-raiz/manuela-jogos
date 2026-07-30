import type { Metadata } from "next";
import { Palavras } from "@/components/palavras/Palavras";

export const metadata: Metadata = {
  title: "Palavra Mágica",
};

export default function PaginaPalavras() {
  return <Palavras />;
}
