import type { Metadata } from "next";
import { Fracoes } from "@/components/fracoes/Fracoes";

export const metadata: Metadata = {
  title: "Pizza das Frações",
};

export default function PaginaFracoes() {
  return <Fracoes />;
}
