import { NativeSelect } from "@/components/ui/native-select";
import type { Category } from "@/lib/types";

// A category picker. Hidden categories are left out unless one is already
// selected.
export function CategorySelect({
  categories,
  value,
  onChange,
  className,
  allowNone = true,
  noneLabel = "Choose a category",
  ...props
}: {
  categories: Category[];
  value: string | null;
  onChange: (categoryId: string | null) => void;
  className?: string;
  allowNone?: boolean;
  noneLabel?: string;
} & Omit<React.ComponentProps<"select">, "value" | "onChange">) {
  const visible = categories.filter((c) => c.is_active || c.id === value);
  return (
    <NativeSelect
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className={className}
      {...props}
    >
      {(allowNone || value === null) && <option value="">{noneLabel}</option>}
      {visible.map((c) => (
        <option key={c.id} value={c.id}>
          {c.group_name ? `${c.group_name}: ${c.name}` : c.name}
        </option>
      ))}
    </NativeSelect>
  );
}
