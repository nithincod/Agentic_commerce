"use client";

import { useEffect, useState } from "react";
import AppSidebar from "@/components/AppSidebar";
import Topbar from "@/components/Topbar";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  Loader2,
  Play,
  RefreshCw,
  ShieldCheck,
  BarChart3,
} from "lucide-react";

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [performance, setPerformance] = useState(null);
  const [performanceLoading, setPerformanceLoading] = useState(false);

  async function loadCampaigns() {
    try {
      setLoading(true);
      setError("");
      const response = await fetch("/api/merchant/campaigns", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Unable to load campaigns");
      setCampaigns(Array.isArray(data?.campaigns) ? data.campaigns : []);
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to load campaigns");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCampaigns();
  }, []);

  async function campaignAction(id, action) {
    try {
      setActionId(id);
      setMessage("");
      setError("");
      const response = await fetch(`/api/merchant/campaigns/${id}/${action}`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || `Unable to ${action} campaign`);
      setMessage(action === "approve" ? "Campaign approved successfully." : "Campaign launched successfully.");
      await loadCampaigns();
    } catch (err) {
      console.error(err);
      setError(err.message || `Unable to ${action} campaign`);
    } finally {
      setActionId("");
    }
  }

  async function loadPerformance(id) {
    try {
      setPerformanceLoading(true);
      setError("");
      const response = await fetch(`/api/merchant/campaigns/${id}/performance`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Unable to load campaign performance");
      setPerformance(data);
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to load campaign performance");
    } finally {
      setPerformanceLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f8fc]">
      <AppSidebar mode="merchant" />
      <Topbar />
      <main className="ml-[260px] px-8 pb-10 pt-[108px]">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Campaigns</h1>
            <p className="mt-1 text-sm text-slate-500">Draft, approve, launch, and measure campaigns owned by your merchant account.</p>
          </div>
          <button type="button" onClick={loadCampaigns} disabled={loading} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Refresh
          </button>
        </div>

        {message && <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"><CheckCircle2 size={17} />{message}</div>}
        {error && <div className="mb-5 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertCircle size={17} />{error}</div>}

        {loading && !campaigns.length ? (
          <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-slate-200 bg-white"><Loader2 size={22} className="animate-spin text-violet-600" /></div>
        ) : !campaigns.length ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">No campaigns found. Create a draft from an AI opportunity first.</div>
        ) : (
          <div className="space-y-4">
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="font-semibold text-slate-900">{campaign.name}</h2>
                      <StatusBadge status={campaign.status} />
                      {campaign._count?.exposures !== undefined && (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                          {campaign._count.exposures} exposure{campaign._count.exposures === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>

                    <p className="mt-2 max-w-3xl text-sm text-slate-500">{campaign.description}</p>

                    {campaign.targets?.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {campaign.targets.map((target) => (
                          <span key={`${target.productId}-${target.role}`} className="rounded-lg bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700">
                            {target.role}: {target.product?.name || target.productId}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-4 grid gap-4 sm:grid-cols-5">
                      <Stat label="Type" value={campaign.type} />
                      <Stat label="Discount" value={`${campaign.discountPercent}%`} />
                      <Stat label="Budget" value={`₹${Number(campaign.budget || 0).toLocaleString("en-IN")}`} />
                      <Stat label="Expected revenue" value={`₹${Number(campaign.expectedRevenue || 0).toLocaleString("en-IN")}`} />
                      <Stat label="Created" value={new Date(campaign.createdAt).toLocaleDateString("en-IN")} />
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-3 lg:justify-end">
                    {campaign.status === "DRAFT" && (
                      <button type="button" disabled={actionId === campaign.id} onClick={() => campaignAction(campaign.id, "approve")} className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                        {actionId === campaign.id ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />} Approve
                      </button>
                    )}

                    {campaign.status === "APPROVED" && (
                      <button type="button" disabled={actionId === campaign.id} onClick={() => campaignAction(campaign.id, "launch")} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                        {actionId === campaign.id ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} Launch
                      </button>
                    )}

                    {campaign.status === "ACTIVE" && (
                      <>
                        <span className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700"><CheckCircle2 size={16} /> Live</span>
                        <button type="button" disabled={performanceLoading} onClick={() => loadPerformance(campaign.id)} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50">
                          {performanceLoading ? <Loader2 size={16} className="animate-spin" /> : <BarChart3 size={16} />} Performance
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {performance && (
          <div className="mt-6 rounded-2xl border border-violet-200 bg-violet-50 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-violet-900"><BarChart3 size={17} /> Campaign Performance</div>
                <div className="mt-1 text-lg font-bold text-slate-900">{performance.campaign?.name}</div>
              </div>
              <button type="button" onClick={() => setPerformance(null)} className="text-sm font-semibold text-violet-700">Close</button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-5">
              <Perf label="Exposures" value={performance.performance?.exposures || 0} />
              <Perf label="Conversions" value={performance.performance?.conversions || 0} />
              <Perf label="Conversion rate" value={`${performance.performance?.conversionRate || 0}%`} />
              <Perf label="Attributed revenue" value={`₹${Number(performance.performance?.attributedRevenue || 0).toLocaleString("en-IN")}`} />
              <Perf label="Revenue / exposure" value={`₹${Number(performance.performance?.revenuePerExposure || 0).toLocaleString("en-IN")}`} />
            </div>

            <div className="mt-5 rounded-xl bg-white/70 p-4 text-xs text-slate-600">
              Attribution model: <strong>{performance.attribution?.model || "LAST_TOUCH"}</strong>. Only paid orders with eligible campaign exposure are counted.
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    DRAFT: "bg-slate-100 text-slate-600",
    APPROVED: "bg-violet-100 text-violet-700",
    ACTIVE: "bg-emerald-100 text-emerald-700",
    COMPLETED: "bg-blue-100 text-blue-700",
  };

  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${styles[status] || "bg-slate-100 text-slate-600"}`}>{status}</span>;
}

function Stat({ label, value }) {
  return <div><div className="text-[11px] font-medium text-slate-500">{label}</div><div className="mt-1 text-sm font-semibold text-slate-800">{value}</div></div>;
}

function Perf({ label, value }) {
  return <div className="rounded-xl border border-violet-100 bg-white p-4"><div className="text-xs text-slate-500">{label}</div><div className="mt-1 text-lg font-bold text-slate-900">{value}</div></div>;
}
