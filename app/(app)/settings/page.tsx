import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireMember } from "@/lib/auth";
import { listAccounts } from "@/lib/db/accounts";
import { listCategories } from "@/lib/db/categories";
import { listMembers } from "@/lib/db/members";
import { listRules } from "@/lib/db/rules";
import { listUploads } from "@/lib/db/uploads";
import { AccountsPanel, NamesPanel, RulesPanel, UploadsPanel } from "./settings-panels";

export default async function SettingsPage() {
  const { supabase, member } = await requireMember();
  const [members, accounts, rules, uploads, categories] = await Promise.all([
    listMembers(supabase),
    listAccounts(supabase),
    listRules(supabase),
    listUploads(supabase),
    listCategories(supabase),
  ]);

  return (
    <>
      <PageHeader title="Settings" />
      <div className="flex flex-col gap-6">
        <NamesPanel members={members} meId={member.id} />
        <AccountsPanel accounts={accounts} members={members} />
        <RulesPanel rules={rules} categories={categories} />
        <UploadsPanel uploads={uploads} members={members} />
        <Card className="py-0">
          <CardContent className="p-0">
            <Link href="/categories" className="flex items-center justify-between px-6 py-4 text-sm font-medium hover:bg-muted/50">
              Edit categories
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
