import type { Metadata } from "next";
import { daMascote } from "@/lib/identidade";
import { Atelie } from "@/components/atelie/Atelie";

export const metadata: Metadata = {
  title: `Ateliê ${daMascote()}`,
};

export default function PaginaDesenhar() {
  return <Atelie />;
}
