import { useState } from 'react';

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
export type PageSize = typeof PAGE_SIZE_OPTIONS[number];

export function usePagination<T>(items: T[], defaultPageSize: PageSize = 10) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(defaultPageSize);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = items.slice((safePage - 1) * pageSize, safePage * pageSize);

  function changePageSize(size: PageSize) {
    setPageSize(size);
    setPage(1);
  }

  function changePage(p: number) {
    setPage(Math.max(1, Math.min(p, totalPages)));
  }

  return { paginated, page: safePage, totalPages, pageSize, changePage, changePageSize };
}
