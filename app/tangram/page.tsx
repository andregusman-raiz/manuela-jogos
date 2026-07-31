import type { Metadata } from "next";
import { Tangram } from "@/components/tangram/Tangram";

export const metadata: Metadata = {
  title: "Tangram da Manu",
};

export default function PaginaTangram() {
  return <Tangram />;
}
