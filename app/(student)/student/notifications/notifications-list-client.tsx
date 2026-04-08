"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { formatDateTime } from "@/lib/utils";

const PAGE_SIZE = 15;

type Notification = {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

interface Props {
  notifications: Notification[];
}

export function NotificationsListClient({ notifications }: Props) {
  const [page, setPage] = useState(1);

  const totalPages = Math.ceil(notifications.length / PAGE_SIZE);
  const paginated = notifications.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (notifications.length === 0) {
    return (
      <Card>
        <CardContent>
          <p className="text-center text-gray-500 py-8">
            No notifications yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {paginated.map((n) => (
          <Card key={n.id} className={n.isRead ? "opacity-60" : ""}>
            <CardContent>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900">
                      {n.title}
                    </h3>
                    {!n.isRead && <Badge variant="info">New</Badge>}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{n.message}</p>
                </div>
                <p className="text-xs text-gray-400 whitespace-nowrap">
                  {formatDateTime(n.createdAt)}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Pagination
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        totalItems={notifications.length}
        itemLabel="notifications"
        className="mt-4"
      />
    </>
  );
}
