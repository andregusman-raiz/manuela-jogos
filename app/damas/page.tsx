import type { Metadata } from "next";
import { Damas } from "@/components/damas/Damas";

export const metadata: Metadata = {
  title: "Damas",
};

export default function PaginaDamas() {
  return <Damas />;
}
