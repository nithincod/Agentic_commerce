"use client";

import {
  CheckCircle2,
  Circle,
  Loader2,
  Activity,
} from "lucide-react";

export default function AgentActivity({ steps }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Activity size={18} className="text-violet-600" />
            <h2 className="font-semibold text-slate-900">
              Agent Activity
            </h2>
          </div>

          <p className="mt-1 text-xs text-slate-500">
            Real-time agent execution steps
          </p>
        </div>

        <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Live
        </span>
      </div>

      <div className="space-y-1">
        {steps.map((step) => (
          <div
            key={step.label}
            className={`relative flex gap-3 rounded-xl p-3 ${
              step.current ? "bg-violet-50" : ""
            }`}
          >
            <div className="relative flex w-5 justify-center">
              {step.done ? (
                <CheckCircle2
                  size={19}
                  className="relative z-10 text-emerald-500"
                />
              ) : step.current ? (
                <Loader2
                  size={19}
                  className="relative z-10 animate-spin text-violet-600"
                />
              ) : (
                <Circle
                  size={19}
                  className="relative z-10 text-slate-300"
                />
              )}
            </div>

            <div>
              <div
                className={`text-sm font-semibold ${
                  step.current
                    ? "text-violet-700"
                    : "text-slate-800"
                }`}
              >
                {step.label}
              </div>

              <div className="mt-1 text-xs text-slate-500">
                {step.description}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}