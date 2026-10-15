import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppHeader } from "@/components/AppHeader";
import { ProgressBar } from "@/components/ProgressBar";
import { formatKES } from "@/lib/campaigns";
import { closeCampaign, extendCampaign, getOrganizerDashboard } from "@/lib/campaigns.functions";
import { getPaymentSettings, savePaymentSettings } from "@/lib/payments.functions";
import type { Campaign } from "@/lib/campaigns";
import { Plus, CalendarPlus, CircleCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Your dashboard — Harambee" },
      {
        name: "description",
        content: "Track your harambees: money raised, every donation, and the updates you've posted.",
      },
      { property: "og:title", content: "Your dashboard — Harambee" },
      {
        property: "og:description",
        content: "Track your harambees: money raised, every donation, and the updates you've posted.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
  errorComponent: () => (
    <div className="app-shell px-5 py-24 text-center">
      <p className="text-sm text-muted-foreground">We couldn't load your dashboard. Please refresh.</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="app-shell px-5 py-24 text-center">
      <Link to="/" className="text-primary underline">Back to discovery</Link>
    </div>
  ),
});

function Dashboard() {
  const fetchDashboard = useServerFn(getOrganizerDashboard);
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => fetchDashboard(),
  });

  return (
    <div className="app-shell pb-16">
      <AppHeader />

      <section className="px-5 pt-6">
        <div className="flex items-center gap-3">
          {data?.organizerPhoto ? (
            <img
              src={data.organizerPhoto}
              alt={data.organizerName}
              width={96}
              height={96}
              className="h-12 w-12 rounded-full object-cover"
              suppressHydrationWarning
            />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 font-display text-base font-bold text-primary">
              {(data?.organizerName ?? "O").charAt(0).toUpperCase()}
            </span>
          )}
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Organizer</p>
            <h1 className="font-display text-xl font-bold leading-tight">
              {data?.organizerName ?? "Your harambees"}
            </h1>
          </div>
        </div>

        {isLoading && (
          <p className="py-16 text-center text-sm text-muted-foreground">Loading your harambees…</p>
        )}

        {data && (
          <>
            <div className="mt-5 grid grid-cols-3 gap-2.5">
              <Stat label="Raised" value={formatKES(data.totalRaised)} />
              <Stat label="Campaigns" value={String(data.campaigns.length)} />
              <Stat label="Donations" value={String(data.donations.length)} />
            </div>

            <PaymentSetup />

            <h2 className="mt-8 font-display text-base font-bold">Your campaigns</h2>
            <div className="mt-3 space-y-3">
               {data.campaigns.map((c) => (
                 <CampaignRow key={c.id} campaign={c} />
               ))}
               {data.campaigns.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center">
                  <p className="text-sm text-muted-foreground">You haven't started a harambee yet.</p>
                  <Link
                    to="/create"
                    className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2.5 text-xs font-semibold text-background"
                  >
                    <Plus className="h-3.5 w-3.5" strokeWidth={3} />
                    Start a campaign
                  </Link>
                </div>
              )}
            </div>

            <h2 className="mt-8 font-display text-base font-bold">Recent donations</h2>
            <div className="mt-3 space-y-2.5">
              {data.donations.slice(0, 20).map((d) => (
                <div key={d.id} className="rounded-2xl border border-border bg-card px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">{d.name}</p>
                    <p className="font-display text-sm font-bold text-primary">{formatKES(d.amount)}</p>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {d.campaignTitle} · {d.when}
                  </p>
                  {d.message && (
                    <p className="mt-1.5 text-xs italic text-foreground/75">“{d.message}”</p>
                  )}
                </div>
              ))}
              {data.donations.length === 0 && (
                <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                  No donations yet — share your campaign to get the first one.
                </p>
              )}
            </div>

            <h2 className="mt-8 font-display text-base font-bold">Your updates</h2>
            <div className="mt-3 space-y-2.5">
              {data.updates.map((u) => (
                <div key={u.id} className="rounded-2xl border border-border bg-card p-4">
                  <p className="text-sm leading-relaxed text-foreground/85">{u.content}</p>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    <span className="font-semibold text-primary">{u.campaignTitle}</span> · {u.when}
                  </p>
                </div>
              ))}
              {data.updates.length === 0 && (
                <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                  You haven't posted any updates yet. Open a campaign to post one.
                </p>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function CampaignRow({ campaign: c }: { campaign: Campaign & { donorCount: number } }) {
  const extend = useServerFn(extendCampaign);
  const close = useServerFn(closeCampaign);
  const qc = useQueryClient();
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true);
    try {
      await fn();
      await qc.invalidateQueries();
      toast.success(msg);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const hoursLeft = c.decisionDeadline
    ? Math.max(0, Math.ceil((new Date(c.decisionDeadline).getTime() - Date.now()) / 3_600_000))
    : 0;
  const status =
    c.status === "completed"
      ? "Completed"
      : c.isExpired
        ? "Expired"
        : c.deadline
          ? `${c.daysLeft} days left`
          : "No deadline";

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <Link to="/campaign/$id" params={{ id: c.id }} className="text-sm font-semibold leading-snug">
          {c.title}
        </Link>
        <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-secondary-foreground">
          {status}
        </span>
      </div>
      <div className="mt-3">
        <ProgressBar raised={c.raised} goal={c.goal} />
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        {formatKES(c.raised)} of {formatKES(c.goal)} · {c.donorCount} donors
      </p>

      {c.canExtend && (
        <div className="mt-3 rounded-xl bg-secondary/60 p-3">
          <p className="text-xs text-foreground">
            This campaign ended. You have about <b>{hoursLeft}h</b> to extend it or close it.
          </p>
          <div className="mt-2 flex gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-xs"
            />
            <button
              disabled={busy || !date}
              onClick={() => run(() => extend({ data: { campaignId: c.id, deadline: date } }), "Campaign extended.")}
              className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              <CalendarPlus className="h-3.5 w-3.5" /> Extend
            </button>
          </div>
        </div>
      )}

      {c.status === "active" && (
        <button
          disabled={busy}
          onClick={() => {
            if (confirm("Close this campaign? It will stop accepting donations.")) {
              run(() => close({ data: { campaignId: c.id } }), "Campaign closed.");
            }
          }}
          className="mt-3 inline-flex items-center gap-1 rounded-full border border-border px-3 py-2 text-xs font-semibold disabled:opacity-50"
        >
          <CircleCheck className="h-3.5 w-3.5" /> Close campaign
        </button>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-3 py-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-sm font-bold text-foreground">{value}</p>
    </div>
  );
}

function PaymentSetup() {
  const fetchSettings = useServerFn(getPaymentSettings);
  const save = useServerFn(savePaymentSettings);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["payment-settings"], queryFn: () => fetchSettings() });
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    shortcodeType: "till" as "till" | "paybill",
    shortcode: "",
    tillNumber: "",
    accountRef: "",
    displayName: "",
    passkey: "",
    consumerKey: "",
    consumerSecret: "",
  });

  if (!data) return null;

  const openForm = () => {
    setForm((f) => ({
      ...f,
      shortcodeType: data.shortcodeType,
      shortcode: data.shortcode,
      tillNumber: data.tillNumber,
      accountRef: data.accountRef,
      displayName: data.displayName,
    }));
    setOpen(true);
  };

  const submit = async () => {
    setBusy(true);
    try {
      await save({ data: form });
      await qc.invalidateQueries();
      setForm((f) => ({ ...f, passkey: "", consumerKey: "", consumerSecret: "" }));
      setOpen(false);
      toast.success("Payment setup saved. Donations are open.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save payment setup.");
    } finally {
      setBusy(false);
    }
  };

  const field = "mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary";
  const secretHint = data.configured ? "Leave blank to keep current" : "";

  return (
    <div className="mt-8 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-bold">Payment setup</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {data.configured
              ? `Donations go straight to ${data.displayName} (${data.shortcodeType === "till" ? "Till" : "Paybill"} ${data.shortcode}).`
              : "Add your Till or Paybill so donors can pay you directly. Donations stay closed until this is set."}
          </p>
        </div>
        {!open && (
          <button
            onClick={openForm}
            className="shrink-0 rounded-full bg-foreground px-3.5 py-2 text-xs font-semibold text-background"
          >
            {data.configured ? "Edit" : "Set up"}
          </button>
        )}
      </div>

      {open && (
        <div className="mt-4 space-y-3">
          <div className="flex gap-2">
            {(["till", "paybill"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setForm({ ...form, shortcodeType: t })}
                className={
                  "flex-1 rounded-full py-2 text-xs font-semibold " +
                  (form.shortcodeType === t ? "bg-foreground text-background" : "bg-secondary text-secondary-foreground")
                }
              >
                {t === "till" ? "Till (Buy Goods)" : "Paybill"}
              </button>
            ))}
          </div>
          <label className="block text-xs font-semibold text-muted-foreground">
            Business name shown to donors
            <input className={field} value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
          </label>
          <label className="block text-xs font-semibold text-muted-foreground">
            {form.shortcodeType === "till" ? "Store number (Daraja shortcode)" : "Paybill number"}
            <input className={field} inputMode="numeric" value={form.shortcode} onChange={(e) => setForm({ ...form, shortcode: e.target.value })} />
          </label>
          {form.shortcodeType === "till" ? (
            <label className="block text-xs font-semibold text-muted-foreground">
              Till number (if different from store number)
              <input className={field} inputMode="numeric" value={form.tillNumber} onChange={(e) => setForm({ ...form, tillNumber: e.target.value })} />
            </label>
          ) : (
            <label className="block text-xs font-semibold text-muted-foreground">
              Account number shown to donors
              <input className={field} value={form.accountRef} onChange={(e) => setForm({ ...form, accountRef: e.target.value })} />
            </label>
          )}
          <p className="pt-1 text-[11px] text-muted-foreground">
            Daraja credentials are encrypted and only used on the server to send payment prompts.
          </p>
          <label className="block text-xs font-semibold text-muted-foreground">
            Passkey
            <input className={field} type="password" autoComplete="off" placeholder={secretHint} value={form.passkey} onChange={(e) => setForm({ ...form, passkey: e.target.value })} />
          </label>
          <label className="block text-xs font-semibold text-muted-foreground">
            Consumer key
            <input className={field} type="password" autoComplete="off" placeholder={secretHint} value={form.consumerKey} onChange={(e) => setForm({ ...form, consumerKey: e.target.value })} />
          </label>
          <label className="block text-xs font-semibold text-muted-foreground">
            Consumer secret
            <input className={field} type="password" autoComplete="off" placeholder={secretHint} value={form.consumerSecret} onChange={(e) => setForm({ ...form, consumerSecret: e.target.value })} />
          </label>
          <div className="flex gap-2 pt-1">
            <button
              onClick={submit}
              disabled={busy}
              className="flex-1 rounded-full bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="rounded-full border border-border px-5 py-3 text-sm font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
