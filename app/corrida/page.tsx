import type { Metadata } from "next";
import { daMascote } from "@/lib/identidade";
import { Corrida } from "@/components/corrida/Corrida";

export const metadata: Metadata = {
  title: `Corrida ${daMascote()}`,
};

export default function PaginaCorrida() {
  return <Corrida />;
}
