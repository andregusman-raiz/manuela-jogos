import type { Metadata } from "next";
import { daMascote } from "@/lib/identidade";
import { Lojinha } from "@/components/lojinha/Lojinha";

export const metadata: Metadata = {
  title: `Lojinha ${daMascote()}`,
};

export default function PaginaLojinha() {
  return <Lojinha />;
}
