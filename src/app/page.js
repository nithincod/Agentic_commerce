import Link from "next/link";
import {
  ArrowRight,
  Bot,
  ShieldCheck,
  Sparkles,
  Activity,
  ShoppingCart,
} from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#07142f] text-white">
      <nav className="flex items-center justify-between px-8 py-6 lg:px-14">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600">
            <Bot size={21} />
          </div>

          <div>
            <div className="font-bold">AGENTPAY</div>
            <div className="text-[10px] text-slate-400">
              AI Commerce Platform
            </div>
          </div>
        </div>

        <div className="hidden items-center gap-8 text-sm text-slate-300 md:flex">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <a href="#security">Security</a>
          <a href="#pricing">Pricing</a>
        </div>

        <div className="flex gap-3">
          <Link
            href="/buyer"
            className="rounded-xl border border-white/20 px-4 py-2.5 text-sm font-medium hover:bg-white/10"
          >
            Buyer
          </Link>

          <Link
            href="/merchant"
            className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold hover:bg-violet-700"
          >
            Merchant
          </Link>
        </div>
      </nav>

      <section className="relative mx-auto max-w-7xl px-8 pb-20 pt-16 lg:px-14 lg:pt-24">
        <div className="absolute left-1/3 top-20 h-96 w-96 rounded-full bg-violet-600/20 blur-[140px]" />

        <div className="relative grid items-center gap-14 lg:grid-cols-2">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-500/10 px-4 py-2 text-xs font-medium text-violet-200">
              <Sparkles size={14} />
              AI-native commerce
            </div>

            <h1 className="max-w-2xl text-5xl font-bold leading-[1.05] tracking-tight lg:text-7xl">
              Commerce built for{" "}
              <span className="text-violet-400">AI agents.</span>
            </h1>

            <p className="mt-7 max-w-xl text-lg leading-8 text-slate-300">
              Discover. Decide. Transact. Grow.
              <br />
              AgentPay enables AI agents to autonomously discover
              products, complete transactions, and grow merchant
              revenue within explicit controls.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/buyer"
                className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold hover:bg-violet-700"
              >
                Start Shopping
                <ArrowRight size={16} />
              </Link>

              <Link
                href="/merchant"
                className="rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold hover:bg-white/10"
              >
                Merchant Dashboard
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="rounded-[32px] border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur">
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600">
                    <Bot size={24} />
                  </div>

                  <div>
                    <div className="font-semibold">Buyer Agent</div>
                    <div className="text-xs text-emerald-400">
                      ● Autonomous
                    </div>
                  </div>
                </div>

                <div className="text-xs text-slate-400">
                  Live
                </div>
              </div>

              <div className="space-y-3">
                {[
                  ["Search catalog", "✓"],
                  ["Check inventory", "✓"],
                  ["Create checkout", "✓"],
                  ["Policy validation", "✓"],
                  ["Human approval", "●"],
                ].map(([label, status]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3"
                  >
                    <span className="text-sm text-slate-300">
                      {label}
                    </span>
                    <span className="text-violet-300">
                      {status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="features"
        className="border-t border-white/10 px-8 py-16 lg:px-14"
      >
        <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-2 lg:grid-cols-4">
          {[
            {
              title: "Bounded Actions",
              text: "Strict limits and policies keep agents safe.",
              icon: ShieldCheck,
            },
            {
              title: "Approval Gates",
              text: "Sensitive financial actions require approval.",
              icon: ShieldCheck,
            },
            {
              title: "Full Audit Trail",
              text: "Every agent action is recorded and explainable.",
              icon: Activity,
            },
            {
              title: "Failure Recovery",
              text: "Transactions recover gracefully when things fail.",
              icon: ShoppingCart,
            },
          ].map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.title}
                className="rounded-2xl border border-white/10 bg-white/5 p-6"
              >
                <Icon className="mb-5 text-violet-400" size={22} />
                <h3 className="font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {item.text}
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}