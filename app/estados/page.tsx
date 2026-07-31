import type { Metadata } from "next";
import { Estados } from "@/components/estados/Estados";

export const metadata: Metadata = {
  title: "Estados do Brasil",
};

export default function PaginaEstados() {
  return <Estados />;
}
