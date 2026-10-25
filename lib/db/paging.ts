// Supabase returns at most 1,000 rows per request. This keeps asking for the
// next page until everything has arrived.
const PAGE_SIZE = 1000;

// Stops early once `limit` rows have arrived.
export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  limit = Infinity,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from < limit; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, Math.min(from + PAGE_SIZE, limit) - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < Math.min(PAGE_SIZE, limit - from)) break;
  }
  return rows.slice(0, limit);
}
