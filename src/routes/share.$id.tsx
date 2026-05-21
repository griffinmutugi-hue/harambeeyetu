import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { getCampaign } from "@/lib/campaigns";
import { Check, Copy, MessageCircle } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/share/$id")({
  component: ShareScreen,
  notFoundComponent: () => (
    <div className="app-shell flex min-h-screen items-center justify-center px-6 text-center">
      <Link to="/" className="text-primary underline">Back to discovery</Link>
    </div>
  ),
});

function ShareScreen() {
  const { id } = Route.useParams();
  const campaign = getCampaign(id);
  if (!campaign) throw notFound();

  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/campaign/${id}`
      : `/campaign/${id}`;

  const message = `Hi! I just started a harambee on Harambee: "${campaign.title}". Every shilling counts — please support if you can: ${url}`;
  const waLink = `https://wa.me/?text=${encodeURIComponent(message)}`;

  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  return (
    <div className="app-shell">
      <AppHeader back />

      <div className="px-5 pt-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground" style={{ boxShadow: "0 12px 32px -10px var(--primary)" }}>
          <Check className="h-8 w-8" strokeWidth={3} />
        </div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-flag-red">Harambee launched</p>
        <h1 className="mt-2 font-display text-2xl font-bold leading-tight">
          Now spread the word.
        </h1>
        <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
          A harambee only works when the village shows up. Share with family, WhatsApp groups, and your church or chama.
        </p>
      </div>

      {/* Campaign preview card */}
      <div className="mx-5 mt-6 overflow-hidden rounded-2xl border border-border bg-card" style={{ boxShadow: "var(--shadow-card)" }}>
        <img src={campaign.image} alt={campaign.title} className="aspect-[5/3] w-full object-cover" />
        <div className="p-4">
          <h3 className="font-display text-base font-bold">{campaign.title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">by {campaign.organizer}</p>
        </div>
      </div>

      {/* Link */}
      <div className="px-5 pt-6">
        <label className="text-xs font-semibold text-muted-foreground">Campaign link</label>
        <div className="mt-1.5 flex items-center gap-2 rounded-2xl border border-border bg-card p-2 pl-4">
          <p className="flex-1 truncate text-sm text-foreground">{url}</p>
          <button
            onClick={copy}
            className="flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-3 px-5 pt-5 pb-10">
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-full py-4 font-display text-base font-bold text-white transition-transform active:scale-[0.98]"
          style={{ backgroundColor: "#25D366" }}
        >
          <MessageCircle className="h-5 w-5" fill="currentColor" />
          Share on WhatsApp
        </a>
        <Link
          to="/campaign/$id"
          params={{ id }}
          className="block w-full rounded-full border border-border bg-card py-4 text-center font-display text-base font-bold text-foreground"
        >
          View Campaign
        </Link>
        <Link to="/" className="block py-2 text-center text-sm text-muted-foreground hover:text-foreground">
          Back to discovery
        </Link>
      </div>
    </div>
  );
}
