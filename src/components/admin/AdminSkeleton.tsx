"use client";

/** Skeleton para tabela de marcações (Agenda) */
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-sm">
      <div className="border-b border-[#eee] bg-[#F5F5F5] p-3">
        <div className="flex gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-4 w-16 animate-pulse rounded bg-[#ddd]" />
          ))}
        </div>
      </div>
      <div className="divide-y divide-[#eee]">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4 p-3">
            <div className="h-4 w-20 animate-pulse rounded bg-[#eee]" />
            <div className="h-4 w-24 animate-pulse rounded bg-[#eee]" />
            <div className="h-4 w-32 animate-pulse rounded bg-[#eee]" />
            <div className="h-4 w-28 animate-pulse rounded bg-[#eee]" />
            <div className="h-4 w-12 animate-pulse rounded bg-[#eee]" />
            <div className="h-5 w-16 animate-pulse rounded-full bg-[#eee]" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Skeleton para painéis de cards */
export function CardsSkeleton() {
  return (
    <div className="flex flex-wrap gap-4">
      {[1, 2].map((i) => (
        <div key={i} className="rounded-lg border border-[#eee] px-4 py-3">
          <div className="mb-1 h-3 w-16 animate-pulse rounded bg-[#eee]" />
          <div className="h-6 w-24 animate-pulse rounded bg-[#ddd]" />
        </div>
      ))}
    </div>
  );
}

/** Skeleton para layout CRM (sidebar + conteúdo) */
export function CRMSkeleton() {
  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="w-full rounded-xl bg-white p-4 shadow-sm lg:w-72">
        <div className="mb-3 h-4 w-32 animate-pulse rounded bg-[#eee]" />
        <div className="space-y-1">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-9 w-full animate-pulse rounded-lg bg-[#eee]" />
          ))}
        </div>
      </div>
      <div className="flex-1 rounded-xl bg-white p-6 shadow-sm">
        <div className="mb-6 h-6 w-48 animate-pulse rounded bg-[#eee]" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border border-[#eee] p-4">
              <div className="mb-2 h-4 w-40 animate-pulse rounded bg-[#eee]" />
              <div className="h-4 w-full animate-pulse rounded bg-[#eee]" />
              <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-[#eee]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Skeleton para financeiro */
export function FinanceiroSkeleton() {
  return (
    <>
      <div className="mb-8 h-24 w-full animate-pulse rounded-xl bg-[#ddd] p-6" />
      <div className="mb-8 rounded-xl bg-white p-6 shadow-sm">
        <div className="mb-4 h-5 w-48 animate-pulse rounded bg-[#eee]" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex justify-between">
              <div className="h-4 w-32 animate-pulse rounded bg-[#eee]" />
              <div className="h-4 w-16 animate-pulse rounded bg-[#eee]" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
