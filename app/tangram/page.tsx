import type { Metadata } from "next";
import { daMascote } from "@/lib/identidade";
import { Tangram } from "@/components/tangram/Tangram";

export const metadata: Metadata = {
  title: `Tangram ${daMascote()}`,
};

export default function PaginaTangram() {
  return <Tangram />;
}
