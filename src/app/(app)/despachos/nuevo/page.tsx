import { Suspense } from "react";
import { FormularioDespacho } from "@/components/despachos/FormularioDespacho";
import { Cargando } from "@/components/ui/base";

export default function Pagina() {
  return (
    <Suspense fallback={<Cargando />}>
      <FormularioDespacho />
    </Suspense>
  );
}
