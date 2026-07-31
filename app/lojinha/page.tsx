import type { Metadata } from "next";
import { Lojinha } from "@/components/lojinha/Lojinha";

export const metadata: Metadata = {
  title: "Lojinha da Manu",
};

export default function PaginaLojinha() {
  return <Lojinha />;
}
