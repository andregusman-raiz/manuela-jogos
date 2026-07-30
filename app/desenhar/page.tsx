import type { Metadata } from "next";
import { Atelie } from "@/components/atelie/Atelie";

export const metadata: Metadata = {
  title: "Ateliê da Manu",
};

export default function PaginaDesenhar() {
  return <Atelie />;
}
