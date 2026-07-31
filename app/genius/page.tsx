import type { Metadata } from "next";
import { Genius } from "@/components/genius/Genius";

export const metadata: Metadata = {
  title: "Genius dos Sons",
};

export default function PaginaGenius() {
  return <Genius />;
}
