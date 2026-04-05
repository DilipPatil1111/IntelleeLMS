"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

type GrantRow = {
  id: string;
  portal: string;
  createdAt: string;
  user: { id: string; email: string; firstName: string; lastName: string; role: string };
  createdBy: { id: string; email: string; firstName: string; lastName: string } | null;
};

type SearchUser = { id: string; email: string; firstName: string; lastName: string; role: string };

const PORTAL_OPTIONS = [
  { value: "STUDENT", label: "Student portal" },
  { value: "TEACHER", label: "Teacher portal" },
  { value: "PRINCIPAL", label: "Principal portal" },
];

export function PortalAccessSettings() {
  const [grants, setGrants] = useState<GrantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState("");
  const [searchHits, setSearchHits] = useState<SearchUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [portal, setPortal] = useState("STUDENT");
  const [saving, setSaving] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [rollingBackUserId, setRollingBackUserId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const grantCountForSelected = selectedUserId
    ? grants.filter((g) => g.user.id === selectedUserId).length
    : 0;

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/principal/portal-grants", { credentials: "same-origin" });
    const data = await res.json().catch(() => ({}));
    if (res.ok && Array.isArray(data.grants)) {
      setGrants(data.grants);
    } else {
      setGrants([]);
      if (res.status === 401 || res.status === 403) {
        setMessage({ tone: "error", text: "You don’t have permission to load portal grants." });
      } else if (!res.ok) {
        setMessage({ tone: "error", text: (data as { error?: string }).error || "Could not load grants." });
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    const t = setTimeout(async () => {
      const q = searchQ.trim();
      if (q.length < 2) {
        setSearchHits([]);
        return;
      }
      const res = await fetch(`/api/principal/users-search?q=${encodeURIComponent(q)}`, {
        credentials: "same-origin",
      });
      const data = await res.json().catch(() => ({}));
      setSearchHits(Array.isArray(data.users) ? data.users : []);
    }, 300);
    return () => clearTimeout(t);
  }, [searchQ]);

  async function addGrant() {
    if (!selectedUserId) {
      setMessage({ tone: "error", text: "Select a user from the search results first." });
      return;
    }
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/principal/portal-grants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ userId: selectedUserId, portal }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setMessage({ tone: "error", text: (data as { error?: string }).error || "Could not save grant." });
      return;
    }
    setMessage({
      tone: "success",
      text: "Access granted. The user must sign out and sign in again for new portals to appear in their session.",
    });
    setSearchQ("");
    setSearchHits([]);
    setSelectedUserId("");
    void load();
  }

  async function rollbackAllForSelectedUser() {
    if (!selectedUserId) {
      setMessage({ tone: "error", text: "Select a user from the search results first." });
      return;
    }
    if (grantCountForSelected === 0) {
      setMessage({ tone: "error", text: "This user has no extra portal grants to roll back." });
      return;
    }
    setRollingBack(true);
    setMessage(null);
    const res = await fetch(`/api/principal/portal-grants?userId=${encodeURIComponent(selectedUserId)}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    const data = await res.json().catch(() => ({}));
    setRollingBack(false);
    if (!res.ok) {
      setMessage({ tone: "error", text: (data as { error?: string }).error || "Roll back failed." });
      return;
    }
    const removed = (data as { removed?: number }).removed ?? 0;
    setMessage({
      tone: "success",
      text: `Rolled back ${removed} grant(s). Only their primary role applies now. They should sign out and sign in again.`,
    });
    void load();
  }

  async function rollbackAllForUserId(userId: string) {
    const count = grants.filter((g) => g.user.id === userId).length;
    if (count === 0) return;
    setRollingBackUserId(userId);
    setMessage(null);
    const res = await fetch(`/api/principal/portal-grants?userId=${encodeURIComponent(userId)}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    const data = await res.json().catch(() => ({}));
    setRollingBackUserId(null);
    if (!res.ok) {
      setMessage({ tone: "error", text: (data as { error?: string }).error || "Roll back failed." });
      return;
    }
    const removed = (data as { removed?: number }).removed ?? 0;
    setMessage({
      tone: "success",
      text: `Rolled back ${removed} grant(s). User should sign out and sign in again.`,
    });
    void load();
  }

  async function removeGrant(id: string) {
    setMessage(null);
    setRevokingId(id);
    const res = await fetch(`/api/principal/portal-grants?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    setRevokingId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMessage({ tone: "error", text: (data as { error?: string }).error || "Remove failed." });
      return;
    }
    void load();
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Portal access grants</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm text-gray-600">
          Grant additional portal access (Student, Teacher, or Principal) to any user. Their primary account role is unchanged;
          they can switch portals using the links at the top of the dashboard when they have more than one. Use{" "}
          <strong>Roll back</strong> to remove <em>all</em> extra grants for the selected user and restore access to their
          original primary role only. You can also revoke individual rows in the table below. After any change, the affected
          user should <strong>sign out and sign in</strong> to refresh their session.
        </p>

        {message && (
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              message.tone === "success"
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-5">
            <Input
              label="Find user"
              placeholder="Type email or name (min. 2 characters)"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              autoComplete="off"
            />
            {searchHits.length > 0 && (
              <ul className="mt-2 max-h-40 overflow-y-auto rounded-md border border-gray-200 bg-white text-sm shadow-sm">
                {searchHits.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      className={`w-full px-3 py-2 text-left hover:bg-indigo-50 ${
                        selectedUserId === u.id ? "bg-indigo-100" : ""
                      }`}
                      onClick={() => setSelectedUserId(u.id)}
                    >
                      <span className="font-medium text-gray-900">
                        {u.firstName} {u.lastName}
                      </span>
                      <span className="block text-xs text-gray-500">{u.email}</span>
                      <span className="text-xs text-gray-400">Primary role: {u.role}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="lg:col-span-3">
            <Select
              label="Grant portal"
              value={portal}
              onChange={(e) => setPortal(e.target.value)}
              options={PORTAL_OPTIONS}
              placeholder="Portal"
            />
          </div>
          <div className="flex flex-col gap-2 lg:col-span-4">
            <span className="text-sm font-medium text-gray-700">Actions</span>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                onClick={() => void addGrant()}
                isLoading={saving}
                disabled={!selectedUserId || rollingBack || rollingBackUserId !== null || revokingId !== null}
              >
                Grant access
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void rollbackAllForSelectedUser()}
                isLoading={rollingBack}
                disabled={
                  !selectedUserId ||
                  saving ||
                  grantCountForSelected === 0 ||
                  rollingBackUserId !== null ||
                  revokingId !== null
                }
              >
                Roll back
              </Button>
            </div>
            {selectedUserId && grantCountForSelected > 0 && (
              <p className="text-xs text-gray-500">
                Selected user has {grantCountForSelected} extra grant(s). Roll back removes all of them.
              </p>
            )}
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600">User</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Primary role</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Extra portal</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Granted</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600"> </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                    Loading…
                  </td>
                </tr>
              ) : grants.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                    No extra portal grants yet.
                  </td>
                </tr>
              ) : (
                grants.map((g) => (
                  <tr key={g.id}>
                    <td className="px-3 py-2">
                      {g.user.firstName} {g.user.lastName}
                      <div className="text-xs text-gray-500">{g.user.email}</div>
                    </td>
                    <td className="px-3 py-2 text-gray-700">{g.user.role}</td>
                    <td className="px-3 py-2 font-medium text-indigo-800">{g.portal}</td>
                    <td className="px-3 py-2 text-gray-500">
                      {new Date(g.createdAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void removeGrant(g.id)}
                          isLoading={revokingId === g.id}
                          disabled={rollingBackUserId !== null || revokingId !== null}
                        >
                          Revoke
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void rollbackAllForUserId(g.user.id)}
                          isLoading={rollingBackUserId === g.user.id}
                          disabled={
                            rollingBack ||
                            saving ||
                            revokingId !== null ||
                            (rollingBackUserId !== null && rollingBackUserId !== g.user.id)
                          }
                          title="Remove all extra portal grants for this user"
                        >
                          Roll back all
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
