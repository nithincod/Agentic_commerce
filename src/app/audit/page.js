"use client";

import { useEffect, useState } from "react";
import AppSidebar from "@/components/AppSidebar";
import Topbar from "@/components/Topbar";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";

function eventIcon(event) {
  const status = String(event.status || "").toUpperCase();
  if (status === "SUCCESS") return CheckCircle2;
  if (status === "BLOCKED" || status === "FAILED") return XCircle;
  if (status === "WAITING") return Clock3;
  return Activity;
}

export default function AuditPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadEvents() {
    try {
      setLoading(true);
      setError("");
      const response = await fetch("/api/audit", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Unable to load audit trail");
      setEvents(data.events || []);
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to load audit trail");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvents();
  }, []);

  return (
    <div className="min-h-screen bg-[#f7f8fc]">
      <AppSidebar mode="buyer" />
      <Topbar />

      <main className="ml-[260px] px-8 pb-10 pt-[108px]">
        <div className="mb-8 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100">
              <ShieldCheck size={21} className="text-violet-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Audit Trail</h1>
              <p className="text-sm text-slate-500">Live agent actions from your authenticated account.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadEvents}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-5 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle size={18} /> {error}
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {loading && !events.length ? (
            <div className="flex min-h-[300px] items-center justify-center">
              <Loader2 size={22} className="animate-spin text-violet-600" />
            </div>
          ) : !events.length ? (
            <div className="p-10 text-center text-sm text-slate-500">No audit events available yet.</div>
          ) : (
            <div className="space-y-1">
              {events.map((event) => {
                const Icon = eventIcon(event);
                return (
                  <div key={event.id} className="relative flex gap-4 rounded-xl p-4 hover:bg-slate-50">
                    <div className="relative shrink-0">
                      <Icon size={19} className="text-violet-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div className="font-semibold text-slate-900">{event.action}</div>
                        <div className="text-xs text-slate-400">{new Date(event.createdAt).toLocaleString("en-IN")}</div>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {event.agentType}{event.entityType ? ` · ${event.entityType}` : ""}{event.entityId ? ` · ${event.entityId}` : ""}
                      </div>
                      {event.reason && <div className="mt-2 text-sm text-slate-600">{event.reason}</div>}
                      <div className="mt-2 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                        {event.status}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
