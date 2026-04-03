"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface PortalSwitcherLink {
  href: string;
  label: string;
}

export function PortalSwitcher({ links }: { links: PortalSwitcherLink[] }) {
  const pathname = usePathname();
  if (links.length <= 1) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-4 py-2.5 text-sm shadow-sm lg:px-8">
      <span className="text-gray-500">Portals:</span>
      {links.map((l) => {
        const active =
          l.href === "/student"
            ? pathname.startsWith("/student")
            : l.href === "/teacher"
              ? pathname.startsWith("/teacher")
              : pathname.startsWith("/principal");
        return (
          <Link
            key={l.href}
            href={l.href}
            className={
              active
                ? "rounded-md bg-indigo-100 px-3 py-1 font-medium text-indigo-800"
                : "rounded-md px-3 py-1 text-gray-700 hover:bg-gray-100 hover:text-gray-900"
            }
          >
            {l.label}
          </Link>
        );
      })}
    </div>
  );
}
