import {
  Ban, Banknote, Bell, Building2, CalendarCheck, CalendarDays, Check, CircleAlert, CircleCheck, ClipboardList,
  Clock, Copy, Download, Droplets, Eye, FileBarChart, FileJson, FileText, Fuel, Gauge, HardHat, History, Info, Layers,
  LayoutDashboard, ChartLine, LoaderCircle, LogOut, MapPin, Menu, Package, Pencil, Phone, Plus, Printer, Receipt,
  RotateCcw, Route, Save, Search, Settings, ShieldCheck, SlidersHorizontal, Trash2, TrendingDown, TrendingUp,
  TriangleAlert, Truck, Upload, User, Users, Wrench, X, ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
  ArrowRight, ArrowLeft, ArrowUpDown, Database, Smartphone, Play, Flag, Minus, Mail, CreditCard, Wallet, Undo2,
  type LucideIcon,
} from "lucide-react";

export {
  Ban, Banknote, Bell, Building2, CalendarCheck, CalendarDays, Check, CircleAlert, CircleCheck, ClipboardList,
  Clock, Copy, Download, Droplets, Eye, FileBarChart, FileJson, FileText, Fuel, Gauge, HardHat, History, Info, Layers,
  LayoutDashboard, ChartLine, LoaderCircle, LogOut, MapPin, Menu, Package, Pencil, Phone, Plus, Printer, Receipt,
  RotateCcw, Route, Save, Search, Settings, ShieldCheck, SlidersHorizontal, Trash2, TrendingDown, TrendingUp,
  TriangleAlert, Truck, Upload, User, Users, Wrench, X, ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
  ArrowRight, ArrowLeft, ArrowUpDown, Database, Smartphone, Play, Flag, Minus, Mail, CreditCard, Wallet, Undo2,
};
export type { LucideIcon };

/** Íconos usados por la navegación (clave de texto definida en permisos.ts). */
const MAPA: Record<string, LucideIcon> = {
  "layout-dashboard": LayoutDashboard,
  "line-chart": ChartLine,
  route: Route,
  truck: Truck,
  "file-bar-chart": FileBarChart,
  receipt: Receipt,
  "clipboard-list": ClipboardList,
  "calendar-check": CalendarCheck,
  fuel: Fuel,
  building: Building2,
  "map-pin": MapPin,
  layers: Layers,
  users: Users,
  history: History,
  settings: Settings,
};

export function IconoNav({ nombre, className }: { nombre: string; className?: string }) {
  const I = MAPA[nombre] ?? Info;
  return <I className={className} aria-hidden />;
}
