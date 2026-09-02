"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppSidebar from "@/components/AppSidebar";
import Topbar from "@/components/Topbar";
import {
  ArrowRight,
  Minus,
  Plus,
  ShieldCheck,
  Trash2,
  Loader2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

export default function CartPage() {
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState("");
  const [error, setError] = useState("");
  const [policy, setPolicy] = useState(null);

  async function loadCart() {
    try {
      setLoading(true);
      setError("");

      const [response, policyResponse] = await Promise.all([
        fetch("/api/cart", { cache: "no-store" }),
        fetch("/api/policy/config", { cache: "no-store" }),
      ]);
      const data = await response.json();
      const policyData = await policyResponse.json();

      if (!response.ok) {
        throw new Error(data?.error || "Unable to load cart");
      }

      setCart(data.cart || null);
      if (policyResponse.ok) setPolicy(policyData.policy || null);
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to load cart");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCart();
  }, []);

  async function updateQuantity(item, quantity) {
    if (!cart || quantity < 1) return;

    try {
      setActionId(item.id);
      setError("");

      const response = await fetch("/api/cart/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cartId: cart.id,
          cartItemId: item.id,
          quantity,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Unable to update cart");

      await loadCart();
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to update cart");
    } finally {
      setActionId("");
    }
  }

  async function removeItem(item) {
    if (!cart) return;

    try {
      setActionId(item.id);
      setError("");

      const response = await fetch("/api/cart/remove", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cartId: cart.id,
          cartItemId: item.id,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Unable to remove item");

      await loadCart();
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to remove item");
    } finally {
      setActionId("");
    }
  }

  const items = cart?.items || [];
  const total = cart?.subtotal || 0;
  const autoLimit = Number(policy?.MAX_AUTO_PAYMENT || 0);
  const withinBudget = autoLimit > 0 ? total <= autoLimit : true;

  return (
    <div className="min-h-screen bg-[#f7f8fc]">
      <AppSidebar mode="buyer" />
      <Topbar />

      <main className="ml-[260px] px-8 pb-10 pt-[108px]">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <Link href="/buyer" className="text-sm font-medium text-violet-600">
              ← Continue Shopping
            </Link>
            <h1 className="mt-3 text-2xl font-bold text-slate-900">Your Cart</h1>
            <p className="mt-1 text-sm text-slate-500">
              Live contents from your authenticated cart.
            </p>
          </div>

          <button
            type="button"
            onClick={loadCart}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        {loading && !cart ? (
          <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-slate-200 bg-white">
            <Loader2 size={22} className="animate-spin text-violet-600" />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
            <div className="space-y-4">
              {!items.length && (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
                  <div className="text-sm font-semibold text-slate-800">Your cart is empty</div>
                  <p className="mt-2 text-sm text-slate-500">Ask the Buyer Agent to find something to buy.</p>
                  <Link
                    href="/buyer"
                    className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    Go shopping <ArrowRight size={15} />
                  </Link>
                </div>
              )}

              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs text-slate-400">
                      Product
                    </div>

                    <div className="min-w-0">
                      <h2 className="truncate font-semibold text-slate-900">
                        {item.product?.name || "Unavailable product"}
                      </h2>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                        {item.product?.description || ""}
                      </p>
                      <div className="mt-2 text-sm font-semibold text-violet-600">
                        ₹{Number(item.product?.price || 0).toLocaleString("en-IN")}
                      </div>
                    </div>
                  </div>

                  <div className="ml-4 flex shrink-0 items-center gap-4">
                    <div className="flex items-center rounded-xl border border-slate-200">
                      <button
                        type="button"
                        disabled={actionId === item.id || item.quantity <= 1}
                        onClick={() => updateQuantity(item, item.quantity - 1)}
                        className="p-2 disabled:opacity-40"
                        aria-label="Decrease quantity"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-8 text-center text-sm">{item.quantity}</span>
                      <button
                        type="button"
                        disabled={actionId === item.id || item.quantity >= (item.product?.inventory || 0)}
                        onClick={() => updateQuantity(item, item.quantity + 1)}
                        className="p-2 disabled:opacity-40"
                        aria-label="Increase quantity"
                      >
                        <Plus size={14} />
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={actionId === item.id}
                      onClick={() => removeItem(item)}
                      className="text-slate-400 hover:text-red-500 disabled:opacity-40"
                      aria-label="Remove item"
                    >
                      {actionId === item.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="font-semibold text-slate-900">Order Summary</h2>

              <div className="mt-5 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Items</span>
                  <span>{cart?.itemCount || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Subtotal</span>
                  <span>₹{Number(total).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Shipping</span>
                  <span>₹0</span>
                </div>
                <div className="border-t border-slate-200 pt-4">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span>₹{Number(total).toLocaleString("en-IN")}</span>
                  </div>
                </div>
              </div>

              <div className={`mt-5 rounded-xl p-4 ${withinBudget ? "bg-emerald-50" : "bg-amber-50"}`}>
                <div className={`flex items-center gap-2 font-semibold ${withinBudget ? "text-emerald-700" : "text-amber-700"}`}>
                  <ShieldCheck size={15} />
                  {withinBudget ? "Within current auto-payment limit" : "Above current auto-payment limit"}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Current subtotal: ₹{Number(total).toLocaleString("en-IN")}{autoLimit > 0 ? ` · Limit ₹${autoLimit.toLocaleString("en-IN")}` : ""}
                </div>
              </div>

              <Link
                href={cart?.id ? `/checkout?cartId=${encodeURIComponent(cart.id)}` : "/cart"}
                aria-disabled={!items.length}
                className={`mt-5 flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold ${items.length ? "bg-violet-600 text-white hover:bg-violet-700" : "pointer-events-none bg-slate-200 text-slate-400"}`}
              >
                Proceed to Checkout
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
