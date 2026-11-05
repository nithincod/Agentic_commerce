"use client";

import { CheckCircle2, ShoppingCart, Loader2 } from "lucide-react";

export default function ProductCard({
  product,
  recommended = false,
  onAddToCart,
  onBuyNow,
  loading = false,
}) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl ${
        recommended
          ? "border-violet-400 ring-2 ring-violet-100"
          : "border-slate-200"
      }`}
    >
      <div className="relative flex h-40 items-center justify-center bg-slate-50">
        {recommended && (
          <div className="absolute left-3 top-3 rounded-full bg-violet-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
            Top pick
          </div>
        )}
        <div className="text-sm font-medium text-slate-400">
          {product.category || "Product"}
        </div>
      </div>

      <div className="p-5">
        <h3 className="font-semibold text-slate-900">{product.name}</h3>

        <div className="mt-2 text-xl font-bold text-violet-600">
          ₹{Number(product.price || 0).toLocaleString("en-IN")}
        </div>

        <div className="mt-4 space-y-2 text-sm text-slate-600">
          {product.description && (
            <div className="flex items-start gap-2">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-500" />
              <span>{product.description}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-500" />
            {product.inventory} units in stock
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            disabled={loading || product.inventory <= 0}
            onClick={() => onAddToCart?.(product)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-violet-500 px-3 py-2.5 text-xs font-semibold text-violet-600 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <ShoppingCart size={15} />}
            {loading ? "Adding..." : "Add to Cart"}
          </button>
          <button
            type="button"
            disabled={loading || product.inventory <= 0}
            onClick={() => onBuyNow?.(product)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Buy Now
          </button>
        </div>
      </div>
    </div>
  );
}
