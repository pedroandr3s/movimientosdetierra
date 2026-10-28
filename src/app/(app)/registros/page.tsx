import { Suspense } from "react";
import { ListaRegistros } from "@/components/registros/ListaRegistros";
import { Cargando } from "@/components/ui/base";

export default function Pagina() {
  return (
    <Suspense fallback={<Cargando />}>
      <ListaRegistros />
    </Suspense>
  );
}
