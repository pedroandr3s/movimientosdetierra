"use client";
import { useParams } from "next/navigation";
import { FichaVenta } from "@/components/ventas/FichaVenta";

export default function Pagina() {
  const { id } = useParams<{ id: string }>();
  return <FichaVenta ventaId={id} />;
}
