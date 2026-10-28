"use client";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { inicializar } from "@/lib/store";
import { Avisos } from "./ui/overlay";

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    inicializar();
  }, []);
  return (
    <>
      {children}
      <Avisos />
    </>
  );
}
