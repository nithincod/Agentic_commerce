"use client";

import { useEffect, useState } from "react";
import AppSidebar from "@/components/AppSidebar";
import Topbar from "@/components/Topbar";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadApprovals() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/checkout/approvals", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Unable to load approvals");

      setApprovals(data.approvals || []);
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to load approvals");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadApprovals();
  }, []);

  async function decide(checkoutId, decision) {
    try {
      setActionId(checkoutId);
      setMessage("");
      setError("");

      const startResponse = await fetch("/api/checkout/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkoutId }),
      });
      const startData = await startResponse.json();
      if (!startResponse.ok) throw new Error(startData?.error || "Unable to start approval workflow");

      const threadId = startData.threadId;
      if (!threadId || !startData.result?.__interrupt__) {
        throw new Error("This checkout is not waiting for an approval decision.");
      }

      const response = await fetch("/api/checkout/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, decision }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Unable to process approval");

      setMessage(
        decision === "approve"
          ? "Checkout approved successfully."
          : "Checkout rejected successfully."
      );
      await loadApprovals();
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to process approval");
    } finally {
      setActionId("");
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f8fc]">
      <AppSidebar mode="buyer" />
      <Topbar />

      <main className="ml-[260px] px-8 pb-10 pt-[108px]">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Payment Approvals</h1>
            <p className="mt-1 text-sm text-slate-500">Live checkouts that require an explicit buyer decision.</p>
          </div>
          <button
            type="button"
            onClick={loadApprovals}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Refresh
          </button>
        </div>

        {message && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            <CheckCircle2 size={17} /> {message}
          </div>
        )}
        {error && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle size={17} /> {error}
          </div>
        )}

        {loading && !approvals.length ? (
          <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-slate-200 bg-white">
            <Loader2 size={22} className="animate-spin text-violet-600" />
          </div>
        ) : approvals.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <ShieldCheck className="mx-auto text-emerald-500" size={28} />
            <div className="mt-3 text-sm font-semibold text-slate-800">No approvals waiting</div>
            <p className="mt-1 text-sm text-slate-500">All current checkouts have either not reached approval or have already been decided.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {approvals.map((approval) => (
              <div key={approval.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <h2 className="font-semibold text-slate-900">Checkout {approval.id}</h2>
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">Awaiting approval</span>
                    </div>
                    <div className="mt-2 text-2xl font-bold text-violet-600">₹{Number(approval.amount).toLocaleString("en-IN")}</div>
                    <div className="mt-1 text-xs text-slate-500">Created {new Date(approval.createdAt).toLocaleString("en-IN")}</div>

                    <div className="mt-5 space-y-2">
                      {approval.items.map((item) => (
                        <div key={item.productId} className="flex justify-between rounded-xl bg-slate-50 p-3 text-sm">
                          <span className="text-slate-700">{item.name} × {item.quantity}</span>
                          <span className="font-medium text-slate-800">₹{Number(item.price * item.quantity).toLocaleString("en-IN")}</span>
                        </div>
                      ))}
                    </div>

                    {approval.policy?.reason && (
                      <div className="mt-4 rounded-xl border border-violet-100 bg-violet-50 p-4 text-sm text-violet-800">
                        {approval.policy.reason}
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 gap-3">
                    <button
                      type="button"
                      disabled={actionId === approval.id}
                      onClick={() => decide(approval.id, "reject")}
                      className="flex items-center gap-2 rounded-xl border border-red-200 px-5 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      <XCircle size={16} /> Reject
                    </button>
                    <button
                      type="button"
                      disabled={actionId === approval.id}
                      onClick={() => decide(approval.id, "approve")}
                      className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {actionId === approval.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                      Approve
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
