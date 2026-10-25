import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireMember } from "@/lib/auth";

export default async function DashboardPage() {
  const { supabase, member } = await requireMember();
  const { count } = await supabase
    .from("categories")
    .select("id", { count: "exact", head: true });

  return (
    <>
      <PageHeader title={`Hi, ${member.display_name}`} description="Your household dashboard." />
      <Card>
        <CardHeader>
          <CardTitle>You&apos;re signed in</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          The database is connected and has {count ?? 0} categories ready. The dashboard arrives
          in a later build step.
        </CardContent>
      </Card>
    </>
  );
}
