import type { Metadata } from "next";
import { Rota } from "@/components/rota/Rota";

export const metadata: Metadata = {
  title: "Roda Romana",
};

export default function PaginaRota() {
  return <Rota />;
}
