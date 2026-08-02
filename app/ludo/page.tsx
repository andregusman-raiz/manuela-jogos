import type { Metadata } from "next";
import { daMascote } from "@/lib/identidade";
import { Ludo } from "@/components/ludo/Ludo";

export const metadata: Metadata = {
  title: `Ludo ${daMascote()}`,
};

export default function PaginaLudo() {
  return <Ludo />;
}
