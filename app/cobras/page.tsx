import type { Metadata } from "next";
import { Cobras } from "@/components/cobras/Cobras";

export const metadata: Metadata = {
  title: "Cobras e Escadas",
};

export default function PaginaCobras() {
  return <Cobras />;
}
