import type { Metadata } from "next";
import { daMascote } from "@/lib/identidade";
import { Forca } from "@/components/forca/Forca";

export const metadata: Metadata = {
  title: `Forca ${daMascote()}`,
};

export default function PaginaForca() {
  return <Forca />;
}
