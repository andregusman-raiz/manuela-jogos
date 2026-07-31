import type { Metadata } from "next";
import { Forca } from "@/components/forca/Forca";

export const metadata: Metadata = {
  title: "Forca da Manu",
};

export default function PaginaForca() {
  return <Forca />;
}
