import type { Metadata } from "next";
import { Relogio } from "@/components/relogio/Relogio";

export const metadata: Metadata = {
  title: "Relógio Mágico",
};

export default function PaginaRelogio() {
  return <Relogio />;
}
