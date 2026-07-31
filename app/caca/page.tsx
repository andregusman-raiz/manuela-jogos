import type { Metadata } from "next";
import { Caca } from "@/components/caca/Caca";

export const metadata: Metadata = {
  title: "Caça-Números",
};

export default function PaginaCaca() {
  return <Caca />;
}
