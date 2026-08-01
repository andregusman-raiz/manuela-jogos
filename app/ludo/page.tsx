import type { Metadata } from "next";
import { Ludo } from "@/components/ludo/Ludo";

export const metadata: Metadata = {
  title: "Ludo da Manu",
};

export default function PaginaLudo() {
  return <Ludo />;
}
