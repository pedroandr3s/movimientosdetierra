"use client";
import { useParams } from "next/navigation";
import { FichaDespacho } from "@/components/despachos/FichaDespacho";

export default function Pagina() {
  const { id } = useParams<{ id: string }>();
  return <FichaDespacho despachoId={id} />;
}
