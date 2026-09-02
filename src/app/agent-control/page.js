"use client";

import { useEffect, useState } from "react";
import AppSidebar from "@/components/AppSidebar";
import Topbar from "@/components/Topbar";
import {
  AlertCircle,
  CheckCircle2,
  Lock,
  RefreshCw,
  Shield,
  SlidersHorizontal,
  Loader2,
} from "lucide-react";

export default function AgentControlPage() {
  const [policy, setPolicy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadPolicy() {
    try {
      setLoading(true);
      setError("");
      const response = await fetch("/api/policy/config", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Unable to load policy configuration");
      setPolicy(data.policy || null);
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to load policy configuration");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPolicy();
  }, []);

  const rules = policy
    ? [
        ["Automatic payment limit", `₹${Number(policy.MAX_AUTO_PAYMENT || 0).toLocaleString("en-IN")}`],
        ["Daily spending limit", `₹${Number(policy.MAX_DAILY_SPENDING || 0).toLocaleString("en-IN")}`],
        ["Maximum discount", `${Number(policy.MAX_DISCOUNT_PERCENT || 0)}%`],
      ]
    : [];

  return (
    <div className="min-h-screen bg-[#f7f8fc]">
      <AppSidebar mode="buyer" />
      <Topbar />

      <main className="ml-[260px] px-8 pb-10 pt-[108px]">
        <div className="mb-8 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100">
              <SlidersHorizontal size={21} className="text-violet-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Agent Control Center</h1>
              <p className="text-sm text-slate-500">Read the policy that is actually enforced by the backend.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadPolicy}
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

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6">
              <h2 className="font-semibold text-slate-900">Enforced Agent Boundaries</h2>
              <p className="mt-1 text-xs text-slate-500">These are capabilities enforced by server-side authentication, tools and policy.</p>
            </div>

            <div className="space-y-3">
              {[
                ["Catalog access", "Allowed", "Data comes from PostgreSQL"],
                ["Inventory checks", "Required", "Backend validates before cart/checkout"],
                ["Cart creation", "Authenticated", "Cart is scoped to the buyer"],
                ["Checkout creation", "Authenticated", "Checkout verifies cart ownership"],
                ["Automatic payment", `Up to ${rules[0]?.[1] || "…"}`, "Policy-controlled"],
                ["Above automatic limit", "Approval required", "LangGraph human interrupt"],
                ["Refunds", "Not exposed to Buyer Agent", "No refund tool is bound"],
              ].map(([label, value, detail]) => (
                <div key={label} className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center gap-3">
                    <Lock size={16} className="text-slate-500" />
                    <div>
                      <div className="text-sm font-medium text-slate-800">{label}</div>
                      <div className="mt-1 text-xs text-slate-500">{detail}</div>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-2">
              <Shield size={19} className="text-violet-600" />
              <div>
                <h2 className="font-semibold text-slate-900">Live Policy Configuration</h2>
                <p className="mt-1 text-xs text-slate-500">Read-only view of values used by policyEngine.js.</p>
              </div>
            </div>

            {loading && !policy ? (
              <div className="flex min-h-[250px] items-center justify-center">
                <Loader2 size={22} className="animate-spin text-violet-600" />
              </div>
            ) : (
              <div className="space-y-4">
                {rules.map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-medium text-slate-500">{label}</div>
                    <div className="mt-1 text-xl font-bold text-slate-900">{value}</div>
                  </div>
                ))}

                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                    <CheckCircle2 size={17} /> Backend policy is authoritative
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    Changing browser controls cannot override these server-side values.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
