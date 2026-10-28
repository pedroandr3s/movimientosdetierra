import { AppShell } from "@/components/AppShell";

export default function LayoutApp({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
