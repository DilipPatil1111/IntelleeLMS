"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Show total item count alongside page info */
  totalItems?: number;
  /** Label for items (default: "items") */
  itemLabel?: string;
  className?: string;
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
  totalItems,
  itemLabel = "items",
  className = "",
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = getVisiblePages(page, totalPages);

  return (
    <div className={`flex items-center justify-between gap-4 ${className}`}>
      <p className="text-sm text-gray-500 tabular-nums">
        Page {page} of {totalPages}
        {totalItems !== undefined && (
          <span className="ml-1.5 text-gray-400">
            ({totalItems.toLocaleString()} {itemLabel})
          </span>
        )}
      </p>

      <div className="flex items-center gap-1">
        <PaginationButton
          onClick={() => onPageChange(1)}
          disabled={page <= 1}
          aria-label="First page"
        >
          <ChevronsLeft className="h-4 w-4" />
        </PaginationButton>
        <PaginationButton
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </PaginationButton>

        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`ellipsis-${i}`} className="px-1 text-gray-400 text-sm select-none">
              ...
            </span>
          ) : (
            <PaginationButton
              key={p}
              onClick={() => onPageChange(p as number)}
              active={p === page}
            >
              {p}
            </PaginationButton>
          )
        )}

        <PaginationButton
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </PaginationButton>
        <PaginationButton
          onClick={() => onPageChange(totalPages)}
          disabled={page >= totalPages}
          aria-label="Last page"
        >
          <ChevronsRight className="h-4 w-4" />
        </PaginationButton>
      </div>
    </div>
  );
}

function PaginationButton({
  children,
  onClick,
  disabled,
  active,
  ...rest
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center min-w-[32px] h-8 px-2 text-sm font-medium rounded-lg transition-all duration-150
        ${active
          ? "bg-indigo-600 text-white shadow-sm scale-105"
          : "text-gray-700 hover:bg-gray-100 hover:scale-105"
        }
        ${disabled ? "opacity-40 cursor-not-allowed pointer-events-none" : "cursor-pointer"}
      `}
      {...rest}
    >
      {children}
    </button>
  );
}

function getVisiblePages(current: number, total: number): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | "...")[] = [1];

  if (current > 3) pages.push("...");

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (current < total - 2) pages.push("...");

  pages.push(total);
  return pages;
}
