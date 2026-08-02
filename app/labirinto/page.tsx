import type { Metadata } from "next";
import { daMascote } from "@/lib/identidade";
import { Labirinto } from "@/components/labirinto/Labirinto";

export const metadata: Metadata = {
  title: `Labirinto ${daMascote()}`,
};

export default function PaginaLabirinto() {
  return <Labirinto />;
}
