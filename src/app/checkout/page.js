"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppSidebar from "@/components/AppSidebar";
import Topbar from "@/components/Topbar";
import {
  ArrowLeft,
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Loader2,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";

export default function CheckoutPage() {
  const [cart, setCart] = useState(null);
  const [checkout, setCheckout] = useState(null);
  const [threadId, setThreadId] = useState("");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [approvalRequired, setApprovalRequired] = useState(false);
  const [approved, setApproved] = useState(false);
  const [paymentReady, setPaymentReady] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [orderResult, setOrderResult] = useState(null);

  async function initialize() {
    try {
      setLoading(true);
      setError("");

      const cartResponse = await fetch("/api/cart", { cache: "no-store" });
      const cartData = await cartResponse.json();
      if (!cartResponse.ok) throw new Error(cartData?.error || "Unable to load cart");

      if (!cartData.cart?.id || !cartData.cart?.items?.length) {
        throw new Error("Your cart is empty. Add a product before checkout.");
      }

      setCart(cartData.cart);

      const params = new URLSearchParams(window.location.search);
      const requestedCartId = params.get("cartId");
      const cartId = requestedCartId || cartData.cart.id;

      if (cartId !== cartData.cart.id) {
        throw new Error("The selected cart is not available for this account.");
      }

      const checkoutResponse = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cartId }),
      });

      const checkoutData = await checkoutResponse.json();
      if (!checkoutResponse.ok) {
        throw new Error(checkoutData?.error || "Unable to prepare checkout");
      }

      if (!checkoutData.checkout) {
        throw new Error("Backend did not return a checkout");
      }

      setCheckout(checkoutData.checkout);

      const policy = checkoutData.checkout.policy || checkoutData.policy || null;
      setApprovalRequired(policy?.status === "APPROVAL_REQUIRED");
      setApproved(policy?.status === "APPROVED" && checkoutData.checkout.status === "READY");
      setPaymentReady(false);
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to initialize checkout");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || window.Razorpay) return;
    if (document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]')) return;

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  async function startCheckoutWorkflow() {
    if (!checkout?.id) return;

    try {
      setProcessing(true);
      setError("");
      setMessage("");

      const response = await fetch("/api/checkout/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkoutId: checkout.id }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Unable to start checkout");

      setThreadId(data.threadId || checkout.id);

      const result = data.result || {};
      const interrupt = result.__interrupt__?.[0]?.value;

      if (interrupt) {
        setApprovalRequired(true);
        setApproved(false);
        setMessage(interrupt.message || "Human approval is required for this transaction.");
      } else {
        setApprovalRequired(false);
        setApproved(result.approvalStatus === "APPROVED");
        setPaymentReady(result.paymentStatus === "READY");
        setMessage(result.message || "Checkout workflow is ready.");
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to start checkout workflow");
    } finally {
      setProcessing(false);
    }
  }

  async function submitApproval(decision) {
    if (!threadId) {
      setError("Approval workflow has not been started.");
      return;
    }

    try {
      setProcessing(true);
      setError("");
      setMessage("");

      const response = await fetch("/api/checkout/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, decision }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Approval failed");

      setApproved(decision === "approve");
      setApprovalRequired(false);
      setPaymentReady(data.paymentReady === true);
      setMessage(
        decision === "approve"
          ? "Payment approved. The checkout is ready for payment."
          : "Payment approval rejected."
      );

      setCheckout((previous) =>
        previous
          ? {
              ...previous,
              status: decision === "approve" ? "APPROVED" : "REJECTED",
            }
          : previous
      );
    } catch (err) {
      console.error(err);
      setError(err.message || "Approval failed");
    } finally {
      setProcessing(false);
    }
  }

  async function startPayment() {
    if (!checkout?.id) return;

    try {
      setProcessing(true);
      setError("");
      setMessage("");

      const response = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkoutId: checkout.id }),
      });

      const orderData = await response.json();
      if (!response.ok) throw new Error(orderData?.error || "Unable to create payment order");

      if (!window.Razorpay) {
        throw new Error("Razorpay Checkout has not loaded yet. Refresh and try again.");
      }

      const options = {
        key: orderData.keyId,
        amount: orderData.amountInSubunits,
        currency: orderData.currency,
        name: "AgentPay",
        description: "AgentPay Commerce Transaction",
        order_id: orderData.razorpayOrderId,
        handler: async (razorpayResponse) => {
          try {
            setProcessing(true);
            setMessage("Verifying payment...");

            const verifyResponse = await fetch("/api/payment/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                checkoutId: checkout.id,
                razorpayPaymentId: razorpayResponse.razorpay_payment_id,
                razorpayOrderId: razorpayResponse.razorpay_order_id,
                razorpaySignature: razorpayResponse.razorpay_signature,
              }),
            });

            const verification = await verifyResponse.json();
            if (!verifyResponse.ok) {
              throw new Error(verification?.error || "Payment verification failed");
            }

            const completeResponse = await fetch("/api/payment/complete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                checkoutId: checkout.id,
                razorpayPaymentId: razorpayResponse.razorpay_payment_id,
              }),
            });

            const completed = await completeResponse.json();
            if (!completeResponse.ok) {
              throw new Error(completed?.error || "Unable to complete order");
            }

            setOrderResult(completed);
            setPaymentReady(false);
            setMessage(
              completed?.order?.id
                ? `Payment successful. Order ${completed.order.id} was created.`
                : "Payment successful. Your order was created."
            );
          } catch (err) {
            console.error(err);
            setError(err.message || "Payment completion failed");
          } finally {
            setProcessing(false);
          }
        },
        modal: {
          ondismiss: () => {
            setProcessing(false);
            setMessage("Payment window closed. No payment was confirmed.");
          },
        },
      };

      const razorpayCheckout = new window.Razorpay(options);
      razorpayCheckout.on("payment.failed", (failure) => {
        setProcessing(false);
        setError(failure?.error?.description || "Razorpay payment failed");
      });
      razorpayCheckout.open();
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to start payment");
      setProcessing(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f8fc]">
        <AppSidebar mode="buyer" />
        <Topbar />
        <main className="ml-[260px] px-8 pb-10 pt-[108px]">
          <div className="flex min-h-[60vh] items-center justify-center rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <Loader2 size={20} className="animate-spin text-violet-600" />
              Preparing secure checkout...
            </div>
          </div>
        </main>
      </div>
    );
  }

  const items = checkout?.items || cart?.items || [];
  const total = Number(checkout?.amount || cart?.subtotal || 0);
  const policy = checkout?.policy || null;
  const rules = policy?.rules || [];
  const transactionRule = rules.find((rule) => rule.rule === "MAX_AUTO_PAYMENT");
  const dailyRule = rules.find((rule) => rule.rule === "DAILY_SPENDING_LIMIT");
  const dailySpent = Number(
    policy?.dailySpent ??
      (dailyRule?.previousValue || 0)
  );
  const dailyLimit = Number(dailyRule?.limit || 0);
  const remainingDaily = Math.max(dailyLimit - dailySpent, 0);

  return (
    <div className="min-h-screen bg-[#f7f8fc]">
      <AppSidebar mode="buyer" />
      <Topbar />

      <main className="ml-[260px] px-8 pb-10 pt-[108px]">
        <div className="mx-auto max-w-6xl">
          <Link href="/cart" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-violet-600">
            <ArrowLeft size={16} /> Back to cart
          </Link>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900">Secure Checkout</h1>
            <p className="mt-1 text-sm text-slate-500">Every checkout value below comes from the backend.</p>
          </div>

          {error && (
            <div className="mb-5 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertTriangle size={18} /> {error}
            </div>
          )}

          {message && (
            <div className="mb-5 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-800">
              {message}
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-[1fr_390px]">
            <div className="space-y-6">
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center gap-3">
                  <ShoppingIcon />
                  <h2 className="font-semibold text-slate-900">Order Details</h2>
                </div>

                <div className="space-y-3">
                  {items.map((item) => (
                    <div key={item.productId || item.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
                      <div>
                        <div className="font-semibold text-slate-900">{item.name || item.product?.name}</div>
                        <div className="mt-1 text-xs text-slate-500">Quantity: {item.quantity}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-slate-900">
                          ₹{Number(item.subtotal ?? ((item.unitPrice ?? item.product?.price ?? 0) * item.quantity)).toLocaleString("en-IN")}
                        </div>
                        <div className="text-xs text-slate-500">per current backend price</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-violet-200 bg-violet-50/60 p-6">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100">
                    <Bot size={20} className="text-violet-600" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-slate-900">Policy Decision</h2>
                    <p className="text-xs text-slate-500">Deterministic server-side evaluation</p>
                  </div>
                </div>
                <p className="text-sm leading-6 text-slate-700">{policy?.reason || "Policy decision is not available."}</p>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
                    <ShieldCheck size={20} className="text-emerald-600" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-slate-900">Policy Checks</h2>
                    <p className="text-xs text-slate-500">Values are read from the persisted policy snapshot.</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {transactionRule && (
                    <PolicyRow
                      label="Automatic payment limit"
                      value={`₹${Number(transactionRule.limit).toLocaleString("en-IN")}`}
                      passed={transactionRule.passed}
                    />
                  )}
                  {dailyRule && (
                    <PolicyRow
                      label="Remaining daily limit"
                      value={`₹${remainingDaily.toLocaleString("en-IN")}`}
                      passed={dailyRule.passed}
                    />
                  )}
                  <PolicyRow
                    label="Policy status"
                    value={policy?.status || "Unavailable"}
                    passed={policy?.status === "APPROVED" || policy?.status === "APPROVAL_REQUIRED"}
                  />
                  {approvalRequired && (
                    <PolicyRow label="Human approval" value="Required" passed={false} pending />
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-start gap-3">
                  <LockKeyhole size={19} className="mt-0.5 text-slate-500" />
                  <div>
                    <div className="text-sm font-semibold text-slate-800">Secure agent transaction</div>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      The browser cannot set the payment amount, buyer identity, policy decision, or checkout ownership.
                    </p>
                  </div>
                </div>
              </section>
            </div>

            <aside className="space-y-5">
              <section className="h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="font-semibold text-slate-900">Order Summary</h2>
                <div className="mt-5 space-y-4 text-sm">
                  <SummaryRow label="Items" value={`${items.length}`} />
                  <SummaryRow label="Daily spending before" value={`₹${dailySpent.toLocaleString("en-IN")}`} />
                  <SummaryRow label="Checkout amount" value={`₹${total.toLocaleString("en-IN")}`} />
                  <div className="border-t border-slate-200 pt-4">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900">Total</span>
                      <span className="text-2xl font-bold text-violet-600">₹{total.toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                </div>

                {policy?.status === "BLOCKED" && (
                  <div className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
                    This transaction was blocked by the backend policy.
                  </div>
                )}

                {!checkout?.id ? (
                  <div className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">No checkout was created.</div>
                ) : policy?.status === "BLOCKED" ? null : approvalRequired && !approved ? (
                  <div className="mt-5 space-y-3">
                    {!threadId ? (
                      <button
                        type="button"
                        disabled={processing}
                        onClick={startCheckoutWorkflow}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                      >
                        {processing ? <Loader2 size={17} className="animate-spin" /> : <ShieldCheck size={17} />}
                        {processing ? "Preparing..." : "Review Approval"}
                      </button>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          disabled={processing}
                          onClick={() => submitApproval("reject")}
                          className="rounded-xl border border-slate-300 py-3 text-sm font-semibold text-slate-700 disabled:opacity-50"
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          disabled={processing}
                          onClick={() => submitApproval("approve")}
                          className="rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          Approve
                        </button>
                      </div>
                    )}
                  </div>
                ) : approved || paymentReady ? (
                  <div className="mt-5 rounded-xl bg-emerald-50 p-4">
                    <div className="flex items-center gap-2 font-semibold text-emerald-700">
                      <CheckCircle2 size={18} /> Payment ready
                    </div>
                    <button
                      type="button"
                      disabled={processing}
                      onClick={startPayment}
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                    >
                      {processing ? <Loader2 size={17} className="animate-spin" /> : <CreditCard size={17} />}
                      {processing ? "Processing..." : `Pay ₹${total.toLocaleString("en-IN")}`}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={processing}
                    onClick={startCheckoutWorkflow}
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                  >
                    {processing ? <Loader2 size={17} className="animate-spin" /> : <ShieldCheck size={17} />}
                    {processing ? "Starting..." : "Continue to Payment"}
                  </button>
                )}

                {orderResult?.order?.id && (
                  <Link
                    href="/audit"
                    className="mt-4 flex w-full items-center justify-center rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-700"
                  >
                    View audit trail
                  </Link>
                )}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 text-sm font-semibold text-slate-900">Transaction Flow</div>
                <div className="space-y-3">
                  <FlowItem label="Cart validated" done={items.length > 0} />
                  <FlowItem label="Checkout prepared" done={Boolean(checkout?.id)} />
                  <FlowItem label="Policy checked" done={Boolean(policy)} />
                  <FlowItem label="Human approval" done={!approvalRequired || approved} active={approvalRequired && !approved} />
                  <FlowItem label="Payment" done={Boolean(orderResult)} active={Boolean(approved || paymentReady) && !orderResult} />
                  <FlowItem label="Order confirmation" done={Boolean(orderResult?.order?.id)} />
                </div>
              </section>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}

function PolicyRow({ label, value, passed, pending = false }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3">
      <div>
        <div className="text-sm font-medium text-slate-700">{label}</div>
        <div className="text-xs text-slate-400">{value}</div>
      </div>
      {pending ? (
        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">Pending</span>
      ) : passed ? (
        <CheckCircle2 size={19} className="text-emerald-500" />
      ) : (
        <AlertTriangle size={19} className="text-red-500" />
      )}
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800">{value}</span>
    </div>
  );
}

function FlowItem({ label, done = false, active = false }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`flex h-7 w-7 items-center justify-center rounded-full ${done ? "bg-emerald-100 text-emerald-600" : active ? "bg-violet-100 text-violet-600" : "bg-slate-100 text-slate-400"}`}>
        {done ? <CheckCircle2 size={15} /> : active ? <span className="h-2 w-2 rounded-full bg-violet-600" /> : <span className="h-2 w-2 rounded-full bg-slate-300" />}
      </div>
      <span className={`text-sm ${done || active ? "font-medium text-slate-800" : "text-slate-400"}`}>{label}</span>
    </div>
  );
}

function ShoppingIcon() {
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100">
      <ChevronRight size={18} className="text-violet-600" />
    </div>
  );
}
