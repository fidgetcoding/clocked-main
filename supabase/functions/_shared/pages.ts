// Reads a list a page at a time until a short page says it's done. A single read stops at the
// server's row cap (1,000 by default), so the rest of a long list would silently go missing.

export const PAGE_SIZE = 1000;
// Stop rather than loop forever if a server keeps answering full pages
const MAX_PAGES = 500;

export interface Page<T> {
  rows: T[] | null;
  error: { message: string } | null;
}

/** fetchPage gets a zero-based page index and the inclusive row range it covers. */
export async function readAllPages<T>(fetchPage: (index: number, from: number, to: number) => Promise<Page<T>>): Promise<T[]> {
  const all: T[] = [];
  for (let index = 0; index < MAX_PAGES; index++) {
    const from = index * PAGE_SIZE;
    const { rows, error } = await fetchPage(index, from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    all.push(...(rows ?? []));
    if (!rows || rows.length < PAGE_SIZE) return all;
  }
  throw new Error(`Stopped after ${MAX_PAGES} pages of ${PAGE_SIZE}`);
}
