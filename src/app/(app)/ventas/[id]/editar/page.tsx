"use client";
import { useParams } from "next/navigation";
import { FormularioVenta } from "@/components/ventas/FormularioVenta";

export default function Pagina() {
  const { id } = useParams<{ id: string }>();
  return <FormularioVenta ventaId={id} />;
}
