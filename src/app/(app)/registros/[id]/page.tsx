"use client";
import { useParams } from "next/navigation";
import { FichaRegistro } from "@/components/registros/FichaRegistro";

export default function Pagina() {
  const { id } = useParams<{ id: string }>();
  return <FichaRegistro registroId={id} />;
}
