import { PageHeader } from "@/components/layout/page-header";
import { requireMember } from "@/lib/auth";
import { listAccounts } from "@/lib/db/accounts";
import { listCategories } from "@/lib/db/categories";
import { listMembers } from "@/lib/db/members";
import { UploadFlow } from "./upload-flow";

export default async function UploadPage() {
  const { supabase, member } = await requireMember();
  const [categories, members, accounts] = await Promise.all([
    listCategories(supabase),
    listMembers(supabase),
    listAccounts(supabase),
  ]);
  const partner = members.find((m) => m.id !== member.id) ?? null;

  return (
    <>
      <PageHeader
        title="Upload statements"
        description="Add CSV or PDF statements from your bank or credit card. You'll check everything before it's saved."
      />
      <UploadFlow
        categories={categories}
        accounts={accounts.map((a) => a.name)}
        myName={member.display_name}
        partnerName={partner?.display_name ?? null}
      />
    </>
  );
}
