import { Suspense } from "react";
import { ListaVentas } from "@/components/ventas/ListaVentas";
import { Cargando } from "@/components/ui/base";

export default function Pagina() {
  return (
    <Suspense fallback={<Cargando />}>
      <ListaVentas />
    </Suspense>
  );
}
