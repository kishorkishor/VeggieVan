import {
  AlertTriangle,
  BarChart3,
  Beaker,
  CalendarDays,
  Database,
  Info,
  Sparkles,
} from "lucide-react";

import type { ExperimentKey } from "@/lib/growth/experiments";
import type { GrowthDashboardData } from "@/lib/growth/queries";

type FunnelStage = GrowthDashboardData["funnel"]["stages"][number]["name"];

const FUNNEL_LABELS: Record<FunnelStage, string> = {
  product_viewed: "Product viewed",
  add_to_cart: "Added to cart",
  checkout_started: "Checkout started",
  checkout_step_completed: "Checkout step completed",
  order_completed: "Order completed",
};

const EXPERIMENT_LABELS: Record<ExperimentKey, string> = {
  checkout_reassurance_v1: "Checkout reassurance",
  related_product_ranking_v1: "Related product ranking",
};

const EVENT_LABELS: Record<string, string> = {
  add_to_cart: "Recommendation add-to-cart conversion",
  checkout_started: "Checkout-start conversion",
  order_completed: "Order conversion",
};

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function percentagePoints(value: number) {
  const points = value * 100;
  return `${points > 0 ? "+" : ""}${points.toFixed(1)} pp`;
}

function count(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function windowDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

export function GrowthDashboard({
  data,
  dbError = null,
}: {
  data: GrowthDashboardData;
  dbError?: string | null;
}) {
  return (
    <div className="space-y-8">
      <header className="rounded-3xl border border-vv-line bg-white p-6 shadow-soft sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-vv-leafDark">
              <BarChart3 className="h-4 w-4" />
              Evidence dashboard
            </div>
            <h1 className="font-display text-4xl font-semibold tracking-tight">
              Growth analytics
            </h1>
            <p className="mt-2 text-sm leading-6 text-vv-mute">
              A session-level view of where shoppers arrive, move through checkout,
              and encounter the current product experiments.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-vv-line bg-vv-cream px-3 py-1.5 text-xs font-medium text-vv-ink">
              <CalendarDays className="h-3.5 w-3.5 text-vv-leafDark" />
              Last {data.window.days} days
            </span>
            {data.includesDemo && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-vv-yellow/25 px-3 py-1.5 text-xs font-medium text-vv-ink">
                <Sparkles className="h-3.5 w-3.5" />
                Seeded demo data
              </span>
            )}
          </div>
        </div>
        <p className="mt-5 border-t border-vv-line pt-4 font-mono text-xs text-vv-mute">
          {windowDate(data.window.start)}{" \u2013 "}{windowDate(data.window.end)}{" \u00b7 rolling UTC window"}
        </p>
      </header>

      {dbError && (
        <section className="flex items-start gap-3 rounded-xl border border-vv-orange/30 bg-vv-orange/5 px-4 py-3 text-sm">
          <Database className="mt-0.5 h-4 w-4 shrink-0 text-vv-orange" />
          <div>
            <h2 className="font-medium text-vv-ink">Analytics database unavailable</h2>
            <p className="mt-0.5 text-vv-ink/70">{dbError}</p>
          </div>
        </section>
      )}

      <section aria-labelledby="funnel-heading">
        <SectionHeading
          eyebrow="Shopper journey"
          title="Conversion funnel"
          description="Unique anonymous sessions at each stage; repeated actions within a session count once."
          id="funnel-heading"
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {data.funnel.stages.map((stage, index) => (
            <article key={stage.name} className="card overflow-hidden p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="text-xs font-medium uppercase tracking-wide text-vv-mute">
                  Stage {index + 1}
                </div>
                <span className="font-mono text-[11px] text-vv-mute">
                  {percent(stage.overallRate)} overall
                </span>
              </div>
              <h3 className="mt-4 min-h-10 text-sm font-semibold leading-5">
                {FUNNEL_LABELS[stage.name]}
              </h3>
              <div className="mt-2 font-display text-3xl font-semibold">
                {count(stage.sessions)}
              </div>
              <p className="mt-1 text-xs text-vv-mute">
                {index === 0 ? "Window baseline" : `${percent(stage.previousRate)} from previous stage`}
              </p>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-vv-line" aria-hidden="true">
                <div
                  className="h-full rounded-full bg-vv-leaf"
                  style={{ width: `${Math.max(0, Math.min(100, stage.overallRate * 100))}%` }}
                />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="acquisition-heading">
        <SectionHeading
          eyebrow="First touch"
          title="Acquisition sources"
          description="Allowlisted source and campaign values captured when each session first arrived."
          id="acquisition-heading"
        />
        <div className="card mt-4 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-vv-cream/60 text-left text-xs uppercase tracking-wide text-vv-mute">
                <tr>
                  <th className="px-5 py-3 font-medium">Source</th>
                  <th className="px-5 py-3 font-medium">Campaign</th>
                  <th className="px-5 py-3 text-right font-medium">Sessions</th>
                </tr>
              </thead>
              <tbody>
                {data.acquisition.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-10 text-center text-vv-mute">
                      No acquisition sessions in this window.
                    </td>
                  </tr>
                ) : (
                  data.acquisition.map((row) => (
                    <tr key={`${row.source}:${row.campaign ?? ""}`} className="border-t border-vv-line">
                      <td className="px-5 py-3 font-medium">{row.source}</td>
                      <td className="px-5 py-3 text-vv-mute">{row.campaign ?? "No campaign"}</td>
                      <td className="px-5 py-3 text-right font-mono text-xs">{count(row.sessions)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section aria-labelledby="experiments-heading">
        <SectionHeading
          eyebrow="Experiment readouts"
          title="Current experiments"
          description="Descriptive comparisons for the current registry version, attributed after first exposure."
          id="experiments-heading"
        />
        <div className="mt-4 grid gap-5 xl:grid-cols-2">
          {data.experiments.map((experiment) => (
            <article key={experiment.key} className="card p-5 sm:p-6">
              <div className="flex flex-col gap-4 border-b border-vv-line pb-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Beaker className="h-4 w-4 text-vv-leafDark" />
                    <h3 className="font-display text-xl font-semibold">
                      {EXPERIMENT_LABELS[experiment.key]}
                    </h3>
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-vv-mute">
                    {experiment.key}{" \u00b7 v"}{experiment.version}
                  </div>
                </div>
                <div className="rounded-lg bg-vv-leaf/10 px-3 py-2 text-xs text-vv-leafDark">
                  <div className="font-medium">Primary metric</div>
                  <div>{EVENT_LABELS[experiment.conversionEvent] ?? experiment.conversionEvent}</div>
                </div>
              </div>

              <div className="grid gap-3 py-5 sm:grid-cols-2">
                {(["control", "treatment"] as const).map((variant) => {
                  const result = experiment.variants[variant];
                  return (
                    <div key={variant} className="rounded-xl border border-vv-line bg-vv-cream/40 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-vv-mute">
                        {variant}
                      </div>
                      <dl className="mt-3 space-y-2 text-sm">
                        <Metric label="Exposures" value={count(result.exposures)} />
                        <Metric label="Conversions" value={count(result.conversions)} />
                        <Metric label="Conversion rate" value={percent(result.rate)} />
                        <Metric
                          label="95% Wilson interval"
                          value={`${percent(result.interval.low)}\u2013${percent(result.interval.high)}`}
                        />
                      </dl>
                    </div>
                  );
                })}
              </div>

              <dl className="grid gap-3 border-t border-vv-line pt-5 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-vv-mute">{"Absolute lift (treatment \u2212 control)"}</dt>
                  <dd className="mt-1 font-mono text-sm font-semibold">
                    {percentagePoints(experiment.absoluteLift)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-vv-mute">Allocation balance (control / treatment)</dt>
                  <dd className="mt-1 font-mono text-sm font-semibold">
                    {percent(experiment.allocationBalance.control)} / {percent(experiment.allocationBalance.treatment)}
                  </dd>
                </div>
              </dl>

              <div className={`mt-5 flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs ${
                experiment.evidence === "insufficient"
                  ? "bg-vv-yellow/20 text-vv-ink"
                  : "bg-vv-leaf/10 text-vv-leafDark"
              }`}>
                {experiment.evidence === "insufficient" ? (
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                ) : (
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                )}
                <span className="font-medium">
                  {experiment.evidence === "insufficient"
                    ? "Insufficient evidence \u2014 directional only"
                    : "Descriptive comparison only"}
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-vv-line bg-white p-5" aria-labelledby="limitations-heading">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-vv-leafDark" />
          <h2 id="limitations-heading" className="font-display text-xl font-semibold">Limitations</h2>
        </div>
        <ul className="mt-3 grid gap-2 text-sm leading-6 text-vv-mute md:grid-cols-2">
          <li>Sessions are anonymous; repeat visits can represent the same shopper.</li>
          <li>Acquisition is first-touch and does not connect activity across devices.</li>
          <li>Demo-marked records are synthetic and are present only when the badge appears.</li>
          <li>Intervals communicate uncertainty; small samples can produce wide ranges.</li>
        </ul>
      </section>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  id,
}: {
  eyebrow: string;
  title: string;
  description: string;
  id: string;
}) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wider text-vv-mute">{eyebrow}</div>
      <h2 id={id} className="mt-1 font-display text-2xl font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-vv-mute">{description}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-vv-mute">{label}</dt>
      <dd className="font-mono text-xs font-semibold">{value}</dd>
    </div>
  );
}
