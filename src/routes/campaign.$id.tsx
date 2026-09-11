import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { ProgressBar } from "@/components/ProgressBar";
import { categoryLabel, formatKES, type Category } from "@/lib/campaigns";
import { getCampaignDetail, submitDonation } from "@/lib/campaigns.functions";
import { Check, MessageCircle, Share2, X } from "lucide-react";

const detailQuery = (id: string) =>
  queryOptions({
    queryKey: ["campaign", id],
    queryFn: () => getCampaignDetail({ data: { id } }),
  });

export const Route = createFileRoute("/campaign/$id")({
  head: () => ({
    meta: [
      { title: "Campaign — Harambee" },
      { name: "description", content: "Read the story, see the progress and support this harambee with M-Pesa." },
      { property: "og:title", content: "Campaign — Harambee" },
      { property: "og:description", content: "Read the story, see the progress and support this harambee with M-Pesa." },
    ],
  }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(detailQuery(params.id)),
  component: CampaignDetail,
  errorComponent: () => (
    <div className="app-shell flex min-h-screen items-center justify-center px-6 text-center">
      <div>
        <p className="text-sm text-muted-foreground">We couldn't load this campaign.</p>
        <Link to="/" className="mt-3 block text-primary underline">Back to discovery</Link>
      </div>
    </div>
  ),
  notFoundComponent: () => (
    <div className="app-shell flex min-h-screen items-center justify-center px-6 text-center">
      <Link to="/" className="text-primary underline">Back to discovery</Link>
    </div>
  ),
});

function CampaignDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: campaign } = useSuspenseQuery(detailQuery(id));
  const [open, setOpen] = useState(false);

  if (!campaign) {
    return (
      <div className="app-shell flex min-h-screen items-center justify-center px-6 text-center">
        <Link to="/" className="text-primary underline">Back to discovery</Link>
      </div>
    );
  }

  const pct = Math.min(100, Math.round((campaign.raised / campaign.goal) * 100));

  const share = async () => {
    const url = `${window.location.origin}/campaign/${id}`;
    const text = `Support "${campaign.title}" on Harambee — every shilling counts: ${url}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: campaign.title, text, url });
        return;
      } catch {}
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <div className="app-shell pb-32">
      <AppHeader back />

      {campaign.image && (
        <div className="relative">
          <img src={campaign.image} alt={campaign.title} className="aspect-[5/4] w-full object-cover" />
          <span className="absolute left-4 top-4 rounded-full bg-background/90 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-foreground backdrop-blur">
            {categoryLabel[campaign.category as Category] ?? "Other"}
          </span>
        </div>
      )}

      <div className="px-5 pt-5">
        <h1 className="font-display text-2xl font-bold leading-tight">{campaign.title}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Organized by <span className="font-semibold text-foreground">{campaign.organizer}</span>
        </p>

        <div className="mt-5 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="font-display text-2xl font-bold text-primary">{formatKES(campaign.raised)}</p>
              <p className="text-xs text-muted-foreground">raised of {formatKES(campaign.goal)}</p>
            </div>
            <p className="font-display text-lg font-bold text-foreground">{pct}%</p>
          </div>
          <div className="mt-3">
            <ProgressBar raised={campaign.raised} goal={campaign.goal} />
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span><b className="text-foreground">{campaign.donorCount}</b> donors</span>
            <span><b className="text-foreground">{campaign.daysLeft}</b> days left</span>
          </div>
        </div>

        <section className="mt-6">
          <h2 className="font-display text-base font-bold">The story</h2>
          <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-foreground/85">
            {campaign.story}
          </p>
        </section>

        {campaign.updates.length > 0 && (
          <section className="mt-7">
            <h2 className="font-display text-base font-bold">Updates</h2>
            <div className="mt-3 space-y-3">
              {campaign.updates.map((u) => (
                <div key={u.id} className="rounded-2xl border border-border bg-card p-4">
                  <p className="text-sm leading-relaxed text-foreground/85">{u.content}</p>
                  <p className="mt-2 text-[11px] text-muted-foreground">{u.when}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-7">
          <h2 className="font-display text-base font-bold">
            Donors <span className="text-muted-foreground">({campaign.donorCount})</span>
          </h2>
          <div className="mt-3 space-y-2.5">
            {campaign.donors.map((d, i) => (
              <div key={i} className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 font-display text-sm font-bold text-primary">
                  {d.name.charAt(0).toUpperCase()}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{d.name}</p>
                  <p className="text-[11px] text-muted-foreground">{d.when}</p>
                </div>
                <p className="font-display text-sm font-bold text-foreground">{formatKES(d.amount)}</p>
              </div>
            ))}
            {campaign.donors.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Be the first to give to this harambee.
              </p>
            )}
          </div>
        </section>

        <button
          onClick={share}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-full border border-border bg-card py-3.5 text-sm font-semibold text-foreground"
        >
          <Share2 className="h-4 w-4" />
          Share this harambee
        </button>
      </div>

      <div className="fixed bottom-0 left-1/2 z-30 w-full max-w-[480px] -translate-x-1/2 border-t border-border/60 bg-background/95 px-5 py-4 backdrop-blur-md">
        <button
          onClick={() => setOpen(true)}
          className="w-full rounded-full bg-accent py-4 font-display text-base font-bold text-accent-foreground transition-transform active:scale-[0.98]"
        >
          Donate Now
        </button>
      </div>

      {open && (
        <DonateModal
          campaignId={id}
          onClose={() => setOpen(false)}
          onDone={() => navigate({ to: "/campaign/$id", params: { id } })}
        />
      )}
    </div>
  );
}

const quickAmounts = [200, 500, 1000, 5000];

function DonateModal({
  campaignId,
  onClose,
}: {
  campaignId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const donate = useServerFn(submitDonation);
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState(500);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");

  const confirm = async () => {
    if (amount <= 0) return;
    setStatus("sending");
    setError("");
    try {
      const res = await donate({
        data: {
          campaignId,
          amount,
          donorName: anonymous ? "" : name.trim(),
          isAnonymous: anonymous,
        },
      });
      setReference(res.reference);
      await queryClient.invalidateQueries({ queryKey: ["campaign", campaignId] });
      await queryClient.invalidateQueries({ queryKey: ["campaigns", "active"] });
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The donation didn't go through. Please try again.");
      setStatus("idle");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-[480px] rounded-t-3xl border-t border-border bg-background p-5 pb-8">
        {status === "done" ? (
          <div className="py-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check className="h-8 w-8" strokeWidth={3} />
            </div>
            <h3 className="mt-4 font-display text-xl font-bold">Asante sana!</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Your {formatKES(amount)} has been added to this harambee.
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">Reference {reference}</p>
            <button
              onClick={onClose}
              className="mt-6 w-full rounded-full bg-foreground py-3.5 font-display text-sm font-bold text-background"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold">Donate with M-Pesa</h3>
              <button onClick={onClose} aria-label="Close" className="rounded-full p-2 hover:bg-secondary">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5">
              <label className="text-xs font-semibold text-muted-foreground">Amount (KES)</label>
              <input
                type="number"
                inputMode="numeric"
                value={amount || ""}
                onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
                className="mt-1 w-full rounded-xl border border-input bg-background px-4 py-3 font-display text-xl font-bold outline-none focus:border-primary"
              />
              <div className="mt-2 flex gap-2">
                {quickAmounts.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAmount(a)}
                    className={
                      "flex-1 rounded-full py-2 text-xs font-semibold transition " +
                      (amount === a ? "bg-foreground text-background" : "bg-secondary text-secondary-foreground")
                    }
                  >
                    {a.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <label className="text-xs font-semibold text-muted-foreground">M-Pesa number</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                placeholder="07XX XXX XXX"
                className="mt-1 w-full rounded-xl border border-input bg-background px-4 py-3 text-base outline-none focus:border-primary"
              />
            </div>

            {!anonymous && (
              <div className="mt-4">
                <label className="text-xs font-semibold text-muted-foreground">Your name (shown to others)</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Brian K."
                  className="mt-1 w-full rounded-xl border border-input bg-background px-4 py-3 text-base outline-none focus:border-primary"
                />
              </div>
            )}

            <label className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={anonymous}
                onChange={(e) => setAnonymous(e.target.checked)}
                className="h-4 w-4 accent-[var(--primary)]"
              />
              Give anonymously
            </label>

            {error && <p className="mt-3 text-sm text-flag-red">{error}</p>}

            <button
              onClick={confirm}
              disabled={status === "sending" || amount <= 0}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-accent py-4 font-display text-base font-bold text-accent-foreground disabled:opacity-50"
            >
              <MessageCircle className="h-4 w-4" />
              {status === "sending" ? "Confirming…" : `Confirm ${formatKES(amount || 0)}`}
            </button>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Demo mode — no real money moves yet.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
