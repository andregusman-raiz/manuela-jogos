import type { Metadata } from "next";
import { Autorama } from "@/components/autorama/Autorama";

export const metadata: Metadata = {
  title: "Autorama",
};

export default function PaginaAutorama() {
  return <Autorama />;
}
