import {
  LayoutDashboard,
  ListOrdered,
  PiggyBank,
  Settings,
  Tags,
  Upload,
  type LucideIcon,
} from "lucide-react";

export type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  // Shown in the phone's bottom bar. The rest are reached from Settings.
  mobile: boolean;
};

export const NAV_LINKS: NavLink[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, mobile: true },
  { href: "/transactions", label: "Transactions", icon: ListOrdered, mobile: true },
  { href: "/upload", label: "Upload", icon: Upload, mobile: true },
  { href: "/budgets", label: "Budgets", icon: PiggyBank, mobile: true },
  { href: "/categories", label: "Categories", icon: Tags, mobile: false },
  { href: "/settings", label: "Settings", icon: Settings, mobile: true },
];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
