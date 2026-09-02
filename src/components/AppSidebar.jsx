"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Bot,
  LayoutDashboard,
  Lightbulb,
  Megaphone,
  Package,
  ShoppingCart,
  Store,
  ClipboardList,
  ShieldCheck,
  LogOut,
} from "lucide-react";

export default function AppSidebar({ mode = "buyer" }) {
  const pathname = usePathname();

  const buyerItems = [
    { label: "Buyer", href: "/buyer", icon: Bot },
    { label: "Cart", href: "/cart", icon: ShoppingCart },
    { label: "Checkout", href: "/checkout", icon: ClipboardList },
  ];

  const merchantItems = [
    { label: "Dashboard", href: "/merchant", icon: LayoutDashboard },
    {
      label: "Opportunities",
      href: "/merchant/opportunities",
      icon: Lightbulb,
    },
    {
      label: "Campaigns",
      href: "/merchant/campaigns",
      icon: Megaphone,
    },
    { label: "Products", href: "/merchant/products", icon: Package },
  ];

  const auditItems = [
    { label: "Approvals", href: "/approvals", icon: ShieldCheck },
    { label: "Audit", href: "/audit", icon: ClipboardList },
  ];

  function isActive(href) {
    if (href === "/merchant") {
      return pathname === "/merchant";
    }

    if (href === "/buyer") {
      return pathname === "/buyer";
    }

    return pathname.startsWith(href);
  }

  const menuItems =
    mode === "merchant" ? merchantItems : buyerItems;

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-[260px] flex-col border-r border-slate-200 bg-white">
      {/* Logo */}
      <div className="flex h-[84px] items-center gap-3 border-b border-slate-200 px-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-600">
          <Store size={22} className="text-white" />
        </div>

        <div>
          <div className="text-lg font-bold tracking-tight text-slate-900">
            AGENTPAY
          </div>

          <div className="text-xs text-slate-500">
            AI Commerce Platform
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-5">
        <div className="mb-3 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          {mode === "merchant" ? "Merchant" : "Buyer"}
        </div>

        <div className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                  isActive(item.href)
                    ? "bg-violet-50 text-violet-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Workspace */}
        <div className="mt-8">
          <div className="mb-3 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Workspace
          </div>

          <div className="space-y-1">
            {auditItems.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                    isActive(item.href)
                      ? "bg-violet-50 text-violet-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom switch */}
      <div className="border-t border-slate-200 p-3">
        {mode === "merchant" ? (
          <Link
            href="/buyer"
            className="mb-2 flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            <ShoppingCart size={18} />
            Switch to Buyer
          </Link>
        ) : (
          <Link
            href="/merchant"
            className="mb-2 flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            <Store size={18} />
            Switch to Merchant
          </Link>
        )}

        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-500 transition hover:bg-red-50 hover:text-red-600"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </aside>
  );
}