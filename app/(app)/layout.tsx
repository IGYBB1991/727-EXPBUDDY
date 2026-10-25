import Link from "next/link";
import { LogOut, Wallet } from "lucide-react";

import { DesktopNav, MobileNav } from "@/components/layout/app-nav";
import { Button } from "@/components/ui/button";
import { requireMember } from "@/lib/auth";
import { signOut } from "../login/actions";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { member } = await requireMember();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Wallet className="size-5 text-primary" />
            <span>Household Expenses</span>
          </Link>
          <DesktopNav />
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {member.display_name}
            </span>
            <form action={signOut}>
              <Button variant="ghost" size="icon-sm" type="submit" title="Sign out">
                <LogOut />
                <span className="sr-only">Sign out</span>
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-4 pb-24 md:pb-10">{children}</main>
      <MobileNav />
    </div>
  );
}
