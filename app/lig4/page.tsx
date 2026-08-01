import type { Metadata } from "next";
import { Lig4 } from "@/components/lig4/Lig4";

export const metadata: Metadata = {
  title: "Lig-4",
};

export default function PaginaLig4() {
  return <Lig4 />;
}
