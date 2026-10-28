"use client";
import { useParams } from "next/navigation";
import { FichaCliente } from "@/components/catalogos/FichaCliente";

export default function Pagina() {
  const { id } = useParams<{ id: string }>();
  return <FichaCliente clienteId={id} />;
}
