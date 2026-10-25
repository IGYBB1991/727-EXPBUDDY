import { PageHeader } from "@/components/layout/page-header";
import { requireMember } from "@/lib/auth";
import { listCategories } from "@/lib/db/categories";
import { CategoryManager } from "./category-manager";

export default async function CategoriesPage() {
  const { supabase } = await requireMember();
  const categories = await listCategories(supabase);

  return (
    <>
      <PageHeader
        title="Categories"
        description="Add, rename, recolor, hide or reorder. Categories in the same group (like Food) add up together on the dashboard. Transfers and Income never count as spending."
      />
      <CategoryManager categories={categories} />
    </>
  );
}
