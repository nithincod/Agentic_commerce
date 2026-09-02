"use client";

import {
  useEffect,
  useState,
} from "react";

import Link from "next/link";

import AppSidebar from "@/components/AppSidebar";
import Topbar from "@/components/Topbar";

import {
  AlertCircle,
  ArrowUpRight,
  Brain,
  DollarSign,
  Loader2,
  RefreshCw,
  ShoppingBag,
  Target,
  TrendingUp,
} from "lucide-react";

export default function MerchantDashboard() {
  const [insights, setInsights] =
    useState(null);

  const [campaigns, setCampaigns] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  async function loadDashboard() {
    try {
      setLoading(true);
      setError("");

      const [
        insightsResponse,
        campaignsResponse,
      ] = await Promise.all([
        fetch(
          "/api/merchant/revenue/insights",
          {
            cache: "no-store",
          }
        ),

        fetch(
          "/api/merchant/campaigns",
          {
            cache: "no-store",
          }
        ),
      ]);

      const insightsData =
        await insightsResponse.json();

      const campaignsData =
        await campaignsResponse.json();

      if (!insightsResponse.ok) {
        throw new Error(
          insightsData?.error ||
            "Unable to load merchant insights"
        );
      }

      if (!campaignsResponse.ok) {
        throw new Error(
          campaignsData?.error ||
            "Unable to load campaigns"
        );
      }

      setInsights(
        insightsData
      );

      setCampaigns(
        Array.isArray(
          campaignsData?.campaigns
        )
          ? campaignsData.campaigns
          : []
      );
    } catch (err) {
      console.error(
        "Merchant dashboard error:",
        err
      );

      setError(
        err?.message ||
          "Unable to load merchant dashboard"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  /*
   * --------------------------------------------------
   * Revenue data
   *
   * These values come from PostgreSQL through the
   * merchant revenue API.
   * --------------------------------------------------
   */
  const revenue =
    insights?.revenue || {};

  const actualRevenue =
    Number(
      revenue.totalRevenue || 0
    );

  const paidOrders =
    Number(
      revenue.paidOrders || 0
    );

  const last30DaysRevenue =
    Number(
      revenue.last30DaysRevenue ||
        0
    );

  const last30DaysOrders =
    Number(
      revenue.last30DaysOrders ||
        0
    );

  const recentOrders =
    Array.isArray(
      revenue.recentOrders
    )
      ? revenue.recentOrders
      : [];

  /*
   * --------------------------------------------------
   * Opportunity data
   * --------------------------------------------------
   */
  const crossSell =
    Array.isArray(
      insights?.crossSell
        ?.opportunities
    )
      ? insights.crossSell.opportunities
      : [];

  const upsell =
    Array.isArray(
      insights?.upsell
        ?.opportunities
    )
      ? insights.upsell.opportunities
      : [];

  const abandoned =
    Array.isArray(
      insights?.abandonedCart
        ?.opportunities
    )
      ? insights.abandonedCart
          .opportunities
      : [];

  const crossSellCount =
    Number(
      insights?.crossSell?.count ||
        0
    );

  const upsellCount =
    Number(
      insights?.upsell?.count ||
        0
    );

  const abandonedCount =
    Number(
      insights?.abandonedCart
        ?.count || 0
    );

  const inventoryCount =
    Number(
      insights?.inventory?.count ||
        0
    );

  const recoverable =
    Number(
      insights?.abandonedCart
        ?.totalRecoverableRevenue ||
        0
    );

  const crossSellRevenue =
    crossSell.reduce(
      (sum, item) =>
        sum +
        Number(
          item?.potentialRevenue ||
            0
        ),
      0
    );

  const upsellRevenue =
    upsell.reduce(
      (sum, item) =>
        sum +
        Number(
          item?.potentialRevenue ||
            0
        ),
      0
    );

  const totalOpportunityRevenue =
    recoverable +
    crossSellRevenue +
    upsellRevenue;

  /*
   * --------------------------------------------------
   * Campaign data
   * --------------------------------------------------
   */
  const activeCampaigns =
    campaigns.filter(
      (campaign) =>
        campaign?.status ===
        "ACTIVE"
    ).length;

  const draftCampaigns =
    campaigns.filter(
      (campaign) =>
        campaign?.status ===
        "DRAFT"
    ).length;

  /*
   * --------------------------------------------------
   * Combined opportunities
   * --------------------------------------------------
   */
  const topOpportunities = [
    ...crossSell.map(
      (item) => ({
        id: `cross-${item?.sourceProduct?.id}-${item?.targetProduct?.id}`,

        title:
          `${item?.sourceProduct?.name || "Product"} → ${item?.targetProduct?.name || "Product"}`,

        detail:
          `${Number(
            item?.attachmentRatePercent ||
              0
          )}% attachment · ₹${Number(
            item?.potentialRevenue ||
              0
          ).toLocaleString(
            "en-IN"
          )} potential`,

        icon: Target,
      })
    ),

    ...upsell.map(
      (item) => ({
        id: `upsell-${item?.baseProduct?.id}-${item?.targetProduct?.id}`,

        title:
          `${item?.baseProduct?.name || "Product"} → ${item?.targetProduct?.name || "Product"}`,

        detail:
          `Upsell · ₹${Number(
            item?.potentialRevenue ||
              0
          ).toLocaleString(
            "en-IN"
          )} potential`,

        icon: TrendingUp,
      })
    ),

    ...abandoned.map(
      (item) => ({
        id:
          `abandoned-${item?.cartId || Math.random()}`,

        title:
          `Abandoned cart · ${item?.customer?.name || "Customer"}`,

        detail:
          `₹${Number(
            item?.cartValue || 0
          ).toLocaleString(
            "en-IN"
          )} cart value`,

        icon: ShoppingBag,
      })
    ),
  ];

  /*
   * --------------------------------------------------
   * Loading state
   * --------------------------------------------------
   */
  if (
    loading &&
    !insights
  ) {
    return (
      <div className="min-h-screen bg-[#f7f8fc]">
        <AppSidebar mode="merchant" />

        <Topbar />

        <main className="ml-[260px] px-8 pb-10 pt-[108px]">
          <div className="flex min-h-[500px] items-center justify-center rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <Loader2
                size={22}
                className="animate-spin text-violet-600"
              />

              Loading merchant dashboard...
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8fc]">
      <AppSidebar mode="merchant" />

      <Topbar />

      <main className="ml-[260px] px-8 pb-10 pt-[108px]">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Revenue Command Center
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Live merchant performance and revenue opportunities.
            </p>
          </div>

          <button
            type="button"
            onClick={
              loadDashboard
            }
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <Loader2
                size={16}
                className="animate-spin"
              />
            ) : (
              <RefreshCw
                size={16}
              />
            )}

            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle
              size={18}
              className="mt-0.5 shrink-0"
            />

            <div>
              <div className="font-semibold">
                Unable to load dashboard
              </div>

              <div className="mt-1">
                {error}
              </div>
            </div>
          </div>
        )}

        {/* --------------------------------------------------
            REAL MERCHANT METRICS
           -------------------------------------------------- */}
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            label="Actual Revenue"
            value={`₹${actualRevenue.toLocaleString(
              "en-IN"
            )}`}
            change={`${paidOrders} paid ${
              paidOrders === 1
                ? "order"
                : "orders"
            }`}
            icon={DollarSign}
            positive
          />

          <MetricCard
            label="Last 30 Days"
            value={`₹${last30DaysRevenue.toLocaleString(
              "en-IN"
            )}`}
            change={`${last30DaysOrders} paid ${
              last30DaysOrders === 1
                ? "order"
                : "orders"
            }`}
            icon={TrendingUp}
            positive
          />

          <MetricCard
            label="Estimated Opportunity"
            value={`₹${totalOpportunityRevenue.toLocaleString(
              "en-IN"
            )}`}
            change={`${
              crossSellCount +
              upsellCount +
              abandonedCount
            } detected`}
            icon={Target}
          />

          <MetricCard
            label="Abandoned Carts"
            value={abandonedCount}
            change={`₹${recoverable.toLocaleString(
              "en-IN"
            )} recoverable`}
            icon={ShoppingBag}
          />

          <MetricCard
            label="Active Campaigns"
            value={activeCampaigns}
            change={`${draftCampaigns} drafts`}
            icon={Brain}
          />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          {/* --------------------------------------------------
              OPPORTUNITIES
             -------------------------------------------------- */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="font-semibold text-slate-900">
                Top Live Opportunities
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Generated from your merchant's real customer,
                product, cart, and sales data.
              </p>
            </div>

            <div className="space-y-3">
              {topOpportunities
                .slice(0, 8)
                .map(
                  (item) => (
                    <OpportunityRow
                      key={
                        item.id
                      }
                      title={
                        item.title
                      }
                      detail={
                        item.detail
                      }
                      icon={
                        item.icon
                      }
                    />
                  )
                )}

              {topOpportunities.length ===
                0 && (
                <div className="rounded-xl bg-slate-50 p-10 text-center">
                  <Target
                    size={24}
                    className="mx-auto text-slate-300"
                  />

                  <div className="mt-3 text-sm font-medium text-slate-600">
                    No current revenue opportunities
                  </div>

                  <div className="mt-1 text-xs text-slate-400">
                    New opportunities will appear as customer and
                    sales data grows.
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* --------------------------------------------------
              REVENUE SIGNALS
             -------------------------------------------------- */}
          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5">
                <h2 className="font-semibold text-slate-900">
                  Revenue Signals
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Live counts returned by the merchant insight tools.
                </p>
              </div>

              <div className="space-y-3">
                <Signal
                  label="Cross-sell opportunities"
                  value={
                    crossSellCount
                  }
                  icon={Target}
                />

                <Signal
                  label="Upsell opportunities"
                  value={
                    upsellCount
                  }
                  icon={
                    TrendingUp
                  }
                />

                <Signal
                  label="Abandoned carts"
                  value={
                    abandonedCount
                  }
                  icon={
                    ShoppingBag
                  }
                />

                <Signal
                  label="Inventory opportunities"
                  value={
                    inventoryCount
                  }
                  icon={Brain}
                />
              </div>
            </section>

            {/* --------------------------------------------------
                RECENT PAID ORDERS
               -------------------------------------------------- */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5">
                <h2 className="font-semibold text-slate-900">
                  Recent Paid Orders
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Actual completed sales from your merchant-owned products.
                </p>
              </div>

              <div className="space-y-3">
                {recentOrders
                  .slice(0, 5)
                  .map(
                    (order) => (
                      <div
                        key={
                          order.id
                        }
                        className="flex items-center justify-between rounded-xl border border-slate-200 p-4"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-800">
                            Order{" "}
                            {
                              order.id
                            }
                          </div>

                          <div className="mt-1 text-xs text-slate-500">
                            {order.createdAt
                              ? new Date(
                                  order.createdAt
                                ).toLocaleString(
                                  "en-IN"
                                )
                              : "Date unavailable"}
                          </div>
                        </div>

                        <div className="ml-4 shrink-0 font-semibold text-emerald-600">
                          ₹
                          {Number(
                            order.amount ||
                              0
                          ).toLocaleString(
                            "en-IN"
                          )}
                        </div>
                      </div>
                    )
                  )}

                {recentOrders.length ===
                  0 && (
                  <div className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">
                    No paid orders yet.
                  </div>
                )}
              </div>
            </section>

            {/* --------------------------------------------------
                REVENUE AGENT
               -------------------------------------------------- */}
            <section className="rounded-2xl border border-violet-200 bg-violet-50 p-6">
              <div className="flex items-start gap-3">
                <Brain
                  size={20}
                  className="mt-0.5 shrink-0 text-violet-600"
                />

                <div>
                  <h3 className="font-semibold text-violet-900">
                    Revenue Agent
                  </h3>

                  <p className="mt-1 text-sm leading-6 text-violet-700">
                    Revenue is calculated from completed paid
                    orders. Opportunity values are kept separate
                    from actual earned revenue.
                  </p>

                  <Link
                    href="/merchant/opportunities"
                    className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-violet-700"
                  >
                    Review opportunities

                    <ArrowUpRight
                      size={15}
                    />
                  </Link>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

function MetricCard({
  label,
  value,
  change,
  icon: Icon,
  positive = false,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500">
          {label}
        </span>

        <Icon
          size={18}
          className="text-violet-500"
        />
      </div>

      <div className="mt-4 text-2xl font-bold text-slate-900">
        {typeof value ===
        "number"
          ? value.toLocaleString(
              "en-IN"
            )
          : value}
      </div>

      <div
        className={`mt-2 text-xs font-semibold ${
          positive
            ? "text-emerald-600"
            : "text-slate-500"
        }`}
      >
        {change}
      </div>
    </div>
  );
}

function Signal({
  label,
  value,
  icon: Icon,
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100">
          <Icon
            size={17}
            className="text-violet-600"
          />
        </div>

        <span className="text-sm font-medium text-slate-700">
          {label}
        </span>
      </div>

      <span className="font-bold text-slate-900">
        {Number(
          value || 0
        ).toLocaleString(
          "en-IN"
        )}
      </span>
    </div>
  );
}

function OpportunityRow({
  title,
  detail,
  icon: Icon,
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100">
        <Icon
          size={16}
          className="text-violet-600"
        />
      </div>

      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-slate-800">
          {title}
        </div>

        <div className="mt-1 text-xs text-slate-500">
          {detail}
        </div>
      </div>
    </div>
  );
}