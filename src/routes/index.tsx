import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/AppHeader";
import { CampaignCard } from "@/components/CampaignCard";
import { listActiveCampaigns } from "@/lib/campaigns.functions";
import { useState } from "react";

const campaignsQuery = queryOptions({
  queryKey: ["campaigns", "active"],
  queryFn: () => listActiveCampaigns(),
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Harambee — Crowdfunding for Kenya" },
      { name: "description", content: "Discover and support Kenyan community campaigns. Real causes, real people, M-Pesa simple." },
      { property: "og:title", content: "Harambee — Crowdfunding for Kenya" },
      { property: "og:description", content: "Discover and support Kenyan community campaigns. Real causes, real people, M-Pesa simple." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(campaignsQuery),
  component: Discovery,
  errorComponent: () => (
    <div className="app-shell mx-0 max-w-none px-5 py-24 text-center shadow-none">
      <p className="text-sm text-muted-foreground">We couldn't load the campaigns. Please refresh.</p>
    </div>
  ),
});

const filters = ["All", "Medical", "Education", "Community", "Other"] as const;

function Discovery() {
  const { data: all } = useSuspenseQuery(campaignsQuery);
  const [active, setActive] = useState<(typeof filters)[number]>("All");

  const list =
    active === "All" ? all : all.filter((c) => c.category === active.toLowerCase());

  const totalRaised = all.reduce((s, c) => s + c.raised, 0);

  return (
    <div className="app-shell mx-0 max-w-none pb-12 shadow-none">
      <AppHeader />

      <section className="grid gap-5 px-5 pb-7 pt-6 md:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)] md:items-end md:px-8 md:pb-10 md:pt-10 xl:px-12 xl:pb-12 xl:pt-12">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-flag-red">
            Harambee · Tuko pamoja
          </p>
          <h1 className="mt-2 max-w-4xl font-display text-3xl font-bold leading-[1.05] tracking-normal text-foreground md:text-5xl lg:text-6xl">
            When we pull <span className="text-primary">together,</span> we lift each other.
          </h1>
        </div>
        <div className="mt-1 flex items-center gap-3 rounded-2xl border border-border bg-card p-3 md:mt-0 md:p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          </span>
          <div className="flex-1">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Raised on Harambee</p>
            <p className="font-display text-lg font-bold text-foreground">
              KES {Math.round(totalRaised).toLocaleString("en-KE")}
            </p>
          </div>
          <p className="text-right text-[11px] text-muted-foreground">
            {all.length}<br/>causes
          </p>
        </div>
      </section>

      <nav className="sticky top-[65px] z-20 -mx-px flex gap-2 overflow-x-auto border-b border-border/60 bg-background/90 px-5 py-3 backdrop-blur-md md:px-8 xl:px-12 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {filters.map((f) => {
          const isActive = f === active;
          return (
            <button
              key={f}
              onClick={() => setActive(f)}
              className={
                "whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semibold transition-colors " +
                (isActive
                  ? "bg-foreground text-background"
                  : "bg-secondary text-secondary-foreground hover:bg-muted")
              }
            >
              {f}
            </button>
          );
        })}
      </nav>

      <section className="grid grid-cols-1 items-stretch gap-4 px-5 pt-5 md:grid-cols-2 md:gap-5 md:px-8 lg:grid-cols-3 xl:grid-cols-4 xl:gap-6 xl:px-12">
        {list.map((c) => (
          <CampaignCard key={c.id} c={c} />
        ))}
        {list.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground md:col-span-2 lg:col-span-3 xl:col-span-4">
            No campaigns in this category yet.
          </p>
        )}
      </section>
    </div>
  );
}
