import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { ProgressBar } from "@/components/ProgressBar";
import { addDonation, categoryLabel, formatKES, getCampaign } from "@/lib/campaigns";
import { Clock, Users, Target, X, Share2 } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/campaign/$id")({
  component: CampaignDetail,
  notFoundComponent: () => (
    <div className="app-shell flex min-h-screen items-center justify-center px-6 text-center">
      <div>
        <h1 className="font-display text-2xl font-bold">Campaign not found</h1>
        <Link to="/" className="mt-4 inline-block text-primary underline">Back to discovery</Link>
      </div>
    </div>
  ),
});

function CampaignDetail() {
  const { id } = Route.useParams();
  const initial = getCampaign(id);
  if (!initial) throw notFound();
  const [campaign, setCampaign] = useState(initial);
  const [open, setOpen] = useState(false);

  const pct = Math.min(100, Math.round((campaign.raised / campaign.goal) * 100));

  return (
    <div className="app-shell pb-32">
      <AppHeader back />

      <div className="relative aspect-[4/3] overflow-hidden">
        <img src={campaign.image} alt={campaign.title} width={1024} height={768} className="h-full w-full object-cover" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent" />
        <div className="absolute left-4 top-4 chip bg-background/90 text-foreground backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-flag-red" />
          {categoryLabel[campaign.category]}
        </div>
      </div>

      <div className="space-y-6 px-5 pt-4">
        <div>
          <h1 className="font-display text-2xl font-bold leading-tight">{campaign.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Organized by <span className="font-semibold text-foreground">{campaign.organizer}</span></p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-baseline justify-between">
            <p className="font-display text-2xl font-bold text-primary">{formatKES(campaign.raised)}</p>
            <p className="text-xs text-muted-foreground">of {formatKES(campaign.goal)}</p>
          </div>
          <div className="mt-3"><ProgressBar raised={campaign.raised} goal={campaign.goal} /></div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <Stat icon={<Target className="h-4 w-4" />} label="Funded" value={`${pct}%`} />
            <Stat icon={<Users className="h-4 w-4" />} label="Donors" value={`${campaign.donors.length}`} />
            <Stat icon={<Clock className="h-4 w-4" />} label="Days left" value={`${campaign.daysLeft}`} />
          </div>
        </div>

        <div>
          <h2 className="font-display text-lg font-bold">The story</h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground/85">{campaign.story}</p>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">Recent donors</h2>
            <span className="text-xs text-muted-foreground">{campaign.donors.length} total</span>
          </div>
          <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card">
            {campaign.donors.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-muted-foreground">Be the first to donate ❤</li>
            )}
            {campaign.donors.slice(0, 8).map((d, i) => (
              <li key={i} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {d.name.charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{d.name}</p>
                    <p className="text-[11px] text-muted-foreground">{d.when}</p>
                  </div>
                </div>
                <p className="font-display text-sm font-bold text-foreground">{formatKES(d.amount)}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Sticky donate bar */}
      <div className="fixed inset-x-0 bottom-0 z-30">
        <div className="mx-auto max-w-md border-t border-border bg-background/95 px-5 py-4 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigator.share?.({ title: campaign.title, url: window.location.href }).catch(() => {})}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground"
              aria-label="Share"
            >
              <Share2 className="h-5 w-5" />
            </button>
            <button
              onClick={() => setOpen(true)}
              className="flex-1 rounded-full bg-accent px-5 py-3.5 font-display text-base font-bold text-accent-foreground transition-transform active:scale-[0.98]"
            >
              Donate Now
            </button>
          </div>
        </div>
      </div>

      {open && (
        <DonateModal
          onClose={() => setOpen(false)}
          onConfirm={(amount, name) => {
            addDonation(campaign.id, name, amount);
            setCampaign({
              ...campaign,
              raised: campaign.raised + amount,
              donors: [{ name: name || "Anonymous", amount, when: "just now" }, ...campaign.donors],
            });
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-foreground">{icon}</div>
      <p className="mt-1.5 font-display text-sm font-bold">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

function DonateModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: (amount: number, name: string) => void }) {
  const [amount, setAmount] = useState<number>(500);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [processing, setProcessing] = useState(false);

  const presets = [200, 500, 1000, 2500, 5000];

  const submit = () => {
    if (!amount || amount < 10) return;
    setProcessing(true);
    setTimeout(() => onConfirm(amount, name), 1100);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-flag-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="mx-auto w-full max-w-md rounded-t-3xl bg-card p-6 pb-8"
        style={{ animation: "slideUp 0.25s ease" }}
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-border" />
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-flag-red">M-Pesa</p>
            <h3 className="font-display text-xl font-bold">Lipa na M-Pesa</h3>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary"><X className="h-4 w-4" /></button>
        </div>

        <div className="mt-5">
          <label className="text-xs font-semibold text-muted-foreground">Amount (KES)</label>
          <input
            type="number"
            inputMode="numeric"
            value={amount || ""}
            onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
            className="mt-1 w-full rounded-xl border border-input bg-background px-4 py-3 font-display text-2xl font-bold focus:border-primary focus:outline-none"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {presets.map((p) => (
              <button
                key={p}
                onClick={() => setAmount(p)}
                className={
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition " +
                  (amount === p ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground")
                }
              >
                {p.toLocaleString()}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <label className="text-xs font-semibold text-muted-foreground">M-Pesa phone number</label>
          <input
            type="tel"
            placeholder="0712 345 678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 w-full rounded-xl border border-input bg-background px-4 py-3 text-base focus:border-primary focus:outline-none"
          />
        </div>

        <div className="mt-4">
          <label className="text-xs font-semibold text-muted-foreground">Display name (optional)</label>
          <input
            type="text"
            placeholder="Anonymous"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-xl border border-input bg-background px-4 py-3 text-base focus:border-primary focus:outline-none"
          />
        </div>

        <button
          disabled={processing || !amount || !phone}
          onClick={submit}
          className="mt-6 w-full rounded-full bg-primary py-4 font-display text-base font-bold text-primary-foreground transition disabled:opacity-50"
        >
          {processing ? "Sending STK push..." : `Confirm ${formatKES(amount || 0)}`}
        </button>
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          You'll receive an M-Pesa prompt. Demo only — no real charge.
        </p>
      </div>
      <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
    </div>
  );
}
