"use client";

import { useEffect, useState } from "react";
import AppSidebar from "@/components/AppSidebar";
import Topbar from "@/components/Topbar";
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Target,
  TrendingUp,
  ShoppingBag,
  Package,
} from "lucide-react";

export default function OpportunitiesPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({
    discountPercent: "",
    budget: "",
    expectedRevenue: "",
  });
  const [actionLoading, setActionLoading] = useState(false);

  async function loadInsights() {
    try {
      setLoading(true);
      setError("");
      const response = await fetch("/api/merchant/revenue/insights", {
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(
          result?.error || "Unable to load opportunities"
        );
      }
      setData(result);
    } catch (err) {
      console.error(err);
      setError(
        err.message || "Unable to load opportunities"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInsights();
  }, []);

  function openCreate(opportunity, defaults) {
    setSelected(opportunity);
    setForm({
      discountPercent:
        defaults.discountPercent === undefined
          ? ""
          : String(defaults.discountPercent),
      budget: "",
      expectedRevenue:
        defaults.expectedRevenue == null
          ? ""
          : String(Math.round(defaults.expectedRevenue)),
    });
    setMessage("");
    setError("");
  }

  async function createCampaign() {
    if (!selected) return;

    const discountPercent = Number(form.discountPercent || 0);
    const budget = Number(form.budget);
    const expectedRevenue = Number(form.expectedRevenue);

    if (
      !Number.isInteger(discountPercent) ||
      !Number.isInteger(budget) ||
      !Number.isInteger(expectedRevenue) ||
      discountPercent < 0 ||
      discountPercent > 15 ||
      budget < 0 ||
      expectedRevenue < 0
    ) {
      setError(
        "Enter valid integer values. Discount must be between 0% and 15%."
      );
      return;
    }

    try {
      setActionLoading(true);
      setError("");
      setMessage("");

      const response = await fetch(
        "/api/merchant/campaigns",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: selected.title,
            type: selected.type,
            description: selected.description,
            targetAudience: selected.targetAudience,
            discountPercent,
            budget,
            expectedRevenue,
            sourceProductId:
              selected.sourceProductId || null,
            targetProductId:
              selected.targetProductId || null,
            targetProductIds:
              selected.targetProductIds || [],
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error || "Unable to create campaign"
        );
      }

      setMessage(
        `Draft campaign ${result.campaign?.id || ""} created successfully.`
      );
      setSelected(null);
      await loadInsights();
    } catch (err) {
      console.error(err);
      setError(
        err.message || "Unable to create campaign"
      );
    } finally {
      setActionLoading(false);
    }
  }

  const crossSell =
    data?.crossSell?.opportunities || [];
  const upsell =
    data?.upsell?.opportunities || [];
  const abandoned =
    data?.abandonedCart?.opportunities || [];
  const inventory =
    data?.inventory?.opportunities || [];

  return (
    <div className="min-h-screen bg-[#f7f8fc]">
      <AppSidebar mode="merchant" />
      <Topbar />

      <main className="ml-[260px] px-8 pb-10 pt-[108px]">
        <div className="mb-8 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100">
              <Target
                size={21}
                className="text-violet-600"
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                AI Opportunities
              </h1>
              <p className="text-sm text-slate-500">
                Live opportunities derived from your merchant data.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={loadInsights}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50"
          >
            {loading ? (
              <Loader2
                size={16}
                className="animate-spin"
              />
            ) : (
              <RefreshCw size={16} />
            )}
            Refresh
          </button>
        </div>

        {message && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            <CheckCircle2 size={17} />
            {message}
          </div>
        )}

        {error && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle size={17} />
            {error}
          </div>
        )}

        {loading && !data ? (
          <div className="flex min-h-[400px] items-center justify-center rounded-2xl border border-slate-200 bg-white">
            <Loader2
              size={22}
              className="animate-spin text-violet-600"
            />
          </div>
        ) : (
          <div className="grid gap-4">
            {crossSell.map(
              (opportunity, index) => (
                <OpportunityCard
                  key={`cross-${index}`}
                  icon={Target}
                  type="CROSS-SELL"
                  title={`${opportunity.sourceProduct.name} → ${opportunity.targetProduct.name}`}
                  description="Increase attachment between products already observed in paid customer behavior."
                  metrics={[
                    [
                      "Source buyers",
                      opportunity.customersBuyingSource,
                    ],
                    [
                      "Attachment rate",
                      `${opportunity.attachmentRatePercent}%`,
                    ],
                    [
                      "Potential revenue",
                      `₹${Number(
                        opportunity.potentialRevenue || 0
                      ).toLocaleString("en-IN")}`,
                    ],
                  ]}
                  onCreate={() =>
                    openCreate(
                      {
                        title: `${opportunity.sourceProduct.name} → ${opportunity.targetProduct.name}`,
                        type: "CROSS_SELL",
                        description: `Cross-sell ${opportunity.targetProduct.name} to customers who purchased ${opportunity.sourceProduct.name}.`,
                        targetAudience: `Customers who purchased ${opportunity.sourceProduct.name}`,
                        sourceProductId:
                          opportunity.sourceProduct.id,
                        targetProductId:
                          opportunity.targetProduct.id,
                      },
                      {
                        expectedRevenue:
                          opportunity.potentialRevenue,
                        discountPercent: 0,
                      }
                    )
                  }
                />
              )
            )}

            {upsell.map(
              (opportunity, index) => (
                <OpportunityCard
                  key={`upsell-${index}`}
                  icon={TrendingUp}
                  type="UPSELL"
                  title={`${opportunity.baseProduct.name} → ${opportunity.targetProduct.name}`}
                  description={opportunity.recommendation}
                  metrics={[
                    [
                      "Current price",
                      `₹${Number(
                        opportunity.baseProduct.price
                      ).toLocaleString("en-IN")}`,
                    ],
                    [
                      "Premium price",
                      `₹${Number(
                        opportunity.targetProduct.price
                      ).toLocaleString("en-IN")}`,
                    ],
                    [
                      "Incremental revenue",
                      `₹${Number(
                        opportunity.incrementalRevenue || 0
                      ).toLocaleString("en-IN")}`,
                    ],
                  ]}
                  onCreate={() =>
                    openCreate(
                      {
                        title: `${opportunity.baseProduct.name} Premium Upgrade`,
                        type: "UPSELL",
                        description:
                          opportunity.recommendation,
                        targetAudience: `Customers considering ${opportunity.baseProduct.name}`,
                        sourceProductId:
                          opportunity.baseProduct.id,
                        targetProductId:
                          opportunity.targetProduct.id,
                      },
                      {
                        expectedRevenue:
                          opportunity.incrementalRevenue,
                        discountPercent: 0,
                      }
                    )
                  }
                />
              )
            )}

            {abandoned.map(
              (opportunity) => (
                <OpportunityCard
                  key={opportunity.cartId}
                  icon={ShoppingBag}
                  type="RECOVERY"
                  title={`${opportunity.customer?.name || "Customer"}'s abandoned cart`}
                  description={opportunity.recommendation}
                  metrics={[
                    [
                      "Cart value",
                      `₹${Number(
                        opportunity.cartValue || 0
                      ).toLocaleString("en-IN")}`,
                    ],
                    [
                      "Products",
                      opportunity.products?.length || 0,
                    ],
                    [
                      "Potential recovery",
                      `₹${Number(
                        opportunity.cartValue || 0
                      ).toLocaleString("en-IN")}`,
                    ],
                  ]}
                  onCreate={() =>
                    openCreate(
                      {
                        title: `Recover abandoned cart ${opportunity.cartId}`,
                        type: "RECOVERY",
                        description:
                          opportunity.recommendation,
                        targetAudience: `Customer with abandoned cart ${opportunity.cartId}`,
                        targetProductIds:
                          opportunity.products?.map(
                            (product) => product.id
                          ) || [],
                      },
                      {
                        expectedRevenue:
                          opportunity.cartValue,
                        discountPercent: 0,
                      }
                    )
                  }
                />
              )
            )}

            {inventory.map(
              (opportunity) => (
                <OpportunityCard
                  key={opportunity.productId}
                  icon={Package}
                  type="INVENTORY"
                  title={opportunity.productName}
                  description={opportunity.recommendation}
                  metrics={[
                    [
                      "Inventory",
                      opportunity.inventory,
                    ],
                    [
                      "Unit price",
                      `₹${Number(
                        opportunity.price || 0
                      ).toLocaleString("en-IN")}`,
                    ],
                    [
                      "Inventory value",
                      `₹${Number(
                        opportunity.inventoryValue || 0
                      ).toLocaleString("en-IN")}`,
                    ],
                  ]}
                  onCreate={() =>
                    openCreate(
                      {
                        title: `${opportunity.productName} Inventory Promotion`,
                        type: "INVENTORY",
                        description:
                          opportunity.recommendation,
                        targetAudience: `Customers likely to purchase ${opportunity.productName}`,
                        targetProductId:
                          opportunity.productId,
                      },
                      {
                        expectedRevenue:
                          opportunity.inventoryValue,
                        discountPercent: 0,
                      }
                    )
                  }
                />
              )
            )}

            {!crossSell.length &&
              !upsell.length &&
              !abandoned.length &&
              !inventory.length && (
                <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
                  No opportunities detected from current merchant data.
                </div>
              )}
          </div>
        )}
      </main>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-6">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold text-slate-900">
                  Create campaign draft
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {selected.title}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelected(null)
                }
                className="text-sm text-slate-500 hover:text-slate-700"
              >
                Close
              </button>
            </div>

            <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              <div className="font-semibold text-slate-800">
                Campaign type
              </div>
              <div className="mt-1">
                {selected.type}
              </div>

              <div className="mt-4 font-semibold text-slate-800">
                Target audience
              </div>
              <div className="mt-1">
                {selected.targetAudience}
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <Field
                label="Discount %"
                value={form.discountPercent}
                onChange={(value) =>
                  setForm((previous) => ({
                    ...previous,
                    discountPercent: value,
                  }))
                }
                placeholder="0-15"
                min="0"
                max="15"
              />

              <Field
                label="Budget (₹)"
                value={form.budget}
                onChange={(value) =>
                  setForm((previous) => ({
                    ...previous,
                    budget: value,
                  }))
                }
                placeholder="Enter campaign budget"
                min="0"
              />

              <Field
                label="Expected revenue (₹)"
                value={form.expectedRevenue}
                onChange={(value) =>
                  setForm((previous) => ({
                    ...previous,
                    expectedRevenue: value,
                  }))
                }
                placeholder="Enter expected revenue"
                min="0"
              />
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() =>
                  setSelected(null)
                }
                className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-700"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={createCampaign}
                disabled={actionLoading}
                className="flex-1 rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {actionLoading
                  ? "Creating..."
                  : "Create Draft"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  min,
  max,
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold text-slate-500">
        {label}
      </span>

      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-violet-500"
      />
    </label>
  );
}

function OpportunityCard({
  icon: Icon,
  type,
  title,
  description,
  metrics,
  onCreate,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100">
              <Icon
                size={18}
                className="text-violet-600"
              />
            </div>

            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
              {type}
            </span>
          </div>

          <h2 className="mt-4 text-base font-semibold text-slate-900">
            {title}
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            {description}
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {metrics.map(
              ([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl bg-slate-50 p-3"
                >
                  <div className="text-[11px] font-medium text-slate-500">
                    {label}
                  </div>
                  <div className="mt-1 text-sm font-bold text-slate-800">
                    {value}
                  </div>
                </div>
              )
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onCreate}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-700"
        >
          Create draft
          <ArrowUpRight size={15} />
        </button>
      </div>
    </div>
  );
}
