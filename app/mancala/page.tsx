import type { Metadata } from "next";
import { Mancala } from "@/components/mancala/Mancala";

export const metadata: Metadata = {
  title: "Mancala",
};

export default function PaginaMancala() {
  return <Mancala />;
}
