"use client";
import { useParams } from "next/navigation";
import { EntregaConductor } from "@/components/conductor/EntregaConductor";

export default function Pagina() {
  const { id } = useParams<{ id: string }>();
  return <EntregaConductor despachoId={id} />;
}
