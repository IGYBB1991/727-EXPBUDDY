// A stand-in for the Supabase client that answers every query with fixed
// rows, for testing code that reads from the database.
export function fakeSupabase(tables: Record<string, unknown[]>) {
  return {
    from(table: string) {
      const rows = tables[table] ?? [];
      const builder: Record<string, unknown> = {};
      for (const method of ["select", "is", "eq", "gte", "lte", "in", "order", "limit"]) {
        builder[method] = () => builder;
      }
      builder.range = (from: number, to: number) =>
        Promise.resolve({ data: rows.slice(from, to + 1), error: null });
      builder.then = (resolve: (value: unknown) => unknown) => resolve({ data: rows, error: null });
      return builder;
    },
  } as never;
}
