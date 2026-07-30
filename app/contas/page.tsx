import type { Metadata } from "next";
import { Contas } from "@/components/contas/Contas";

export const metadata: Metadata = {
  title: "Foguete das Contas",
};

export default function PaginaContas() {
  return <Contas />;
}
