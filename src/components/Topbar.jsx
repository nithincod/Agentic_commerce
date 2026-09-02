"use client";

import {
  useEffect,
  useState,
} from "react";

import { signOut } from "next-auth/react";

import {
  ChevronDown,
  Loader2,
  Wallet,
  Store,
} from "lucide-react";

export default function Topbar() {
  const [session, setSession] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [open, setOpen] =
    useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const response =
          await fetch(
            "/api/auth/session",
            {
              cache: "no-store",
            }
          );

        const data =
          await response.json();

        if (!cancelled) {
          setSession(
            data || null
          );
        }
      } catch (error) {
        console.error(
          "Session load failed:",
          error
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const user =
    session?.user;

  const isMerchant =
    Boolean(
      user?.merchantId
    );

  /*
   * A merchant is also buyer-capable
   * in the current AgentPay architecture.
   */
  const profileRole =
    isMerchant
      ? "Buyer · Merchant"
      : "Buyer";

  const initials =
    (
      user?.name ||
      user?.email ||
      "U"
    )
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(
        (part) =>
          part[0]?.toUpperCase()
      )
      .join("");

  return (
    <header className="fixed left-[260px] right-0 top-0 z-30 flex h-[84px] items-center justify-end gap-4 border-b border-slate-200 bg-white px-8">

      {/* Signed-in account */}
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <Wallet
          size={18}
          className="text-slate-500"
        />

        <div>
          <div className="text-[11px] text-slate-500">
            Signed-in account
          </div>

          <div className="max-w-[240px] truncate font-semibold text-slate-900">
            {user?.email ||
              user?.name ||
              "Account"}
          </div>
        </div>
      </div>

      {/* Profile */}
      <div className="relative">
        <button
          type="button"
          onClick={() =>
            setOpen(
              (value) => !value
            )
          }
          className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm"
        >
          {/* Avatar */}
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-violet-600 text-sm font-bold text-white">
            {user?.image ? (
              <img
                src={user.image}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : loading ? (
              <Loader2
                size={16}
                className="animate-spin"
              />
            ) : (
              initials || "U"
            )}
          </div>

          {/* Name + capability */}
          <div className="text-left">
            <div className="text-sm font-semibold text-slate-900">
              {user?.name ||
                "Account"}
            </div>

            <div className="flex items-center gap-1 text-xs text-slate-500">
              {isMerchant && (
                <Store
                  size={12}
                />
              )}

              <span>
                {profileRole}
              </span>
            </div>
          </div>

          <ChevronDown
            size={16}
            className="text-slate-500"
          />
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">

            <div className="border-b border-slate-100 px-3 py-3">
              <div className="text-xs text-slate-500">
                Account capabilities
              </div>

              <div className="mt-2 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Wallet
                    size={15}
                    className="text-violet-600"
                  />

                  Buyer
                </div>

                {isMerchant && (
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Store
                      size={15}
                      className="text-violet-600"
                    />

                    Merchant
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                signOut({
                  callbackUrl:
                    "/login",
                })
              }
              className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}