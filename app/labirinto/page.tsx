import type { Metadata } from "next";
import { Labirinto } from "@/components/labirinto/Labirinto";

export const metadata: Metadata = {
  title: "Labirinto da Manu",
};

export default function PaginaLabirinto() {
  return <Labirinto />;
}
