import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "Movimiento de Tierra CR SPA · ERP demo",
  description: "Demostración de ERP de ventas, despacho y control de flota con datos de ejemplo.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0d2542" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CL" className="h-full antialiased">
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
