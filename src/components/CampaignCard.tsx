import { Link } from "@tanstack/react-router";
import { ProgressBar } from "./ProgressBar";
import { categoryLabel, formatKES, type Campaign, type Category } from "@/lib/campaigns";
import {
  CircleHelp,
  Clock,
  GraduationCap,
  HeartPulse,
  UsersRound,
} from "lucide-react";
import { useState } from "react";

const categoryIcons = {
  medical: HeartPulse,
  education: GraduationCap,
  community: UsersRound,
  other: CircleHelp,
};

const categoryPlaceholderClasses: Record<Category, string> = {
  medical: "bg-flag-red/10 text-flag-red",
  education: "bg-category-education/10 text-category-education",
  community: "bg-flag-green/10 text-flag-green",
  other: "bg-category-other/10 text-category-other",
};

export function CampaignCard({ c }: { c: Campaign }) {
  const pct = Math.min(100, Math.round((c.raised / c.goal) * 100));
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const CategoryIcon = categoryIcons[c.category];
  const showImage = Boolean(c.image) && c.image !== failedImage;
  return (
    <Link
      to="/campaign/$id"
      params={{ id: c.id }}
      className="group flex h-full min-w-0 flex-col overflow-hidden rounded-3xl bg-card transition-transform active:scale-[0.99]"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="relative h-[180px] shrink-0 overflow-hidden">
        {showImage ? (
          <img
            src={c.image}
            alt={c.title}
            loading="lazy"
            width={1024}
            height={614}
            onError={() => setFailedImage(c.image)}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div
            aria-hidden="true"
            className={`flex h-full w-full items-center justify-center ${categoryPlaceholderClasses[c.category]}`}
          >
            <CategoryIcon className="h-12 w-12 opacity-80" strokeWidth={1.6} />
          </div>
        )}
        <div className="absolute inset-x-3 top-3 z-10 flex items-start justify-between gap-2">
          <span className="chip whitespace-nowrap bg-flag-black/80 text-cream backdrop-blur">
            <Clock className="h-3 w-3" /> {c.deadline ? `${c.daysLeft}d left` : "No deadline"}
          </span>
          <span className="chip whitespace-nowrap bg-background/90 text-foreground backdrop-blur">
            {categoryLabel[c.category]}
          </span>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
        <div className="min-w-0">
          <h3 className="line-clamp-2 min-h-[2.75rem] break-words font-display text-base font-bold leading-snug text-foreground">
            {c.title}
          </h3>
          <div className="mt-2 flex min-w-0 items-center gap-2">
            {c.organizerPhoto ? (
              <img
                src={c.organizerPhoto}
                alt={c.organizer}
                loading="lazy"
                width={64}
                height={64}
                className="h-7 w-7 rounded-full object-cover"
                suppressHydrationWarning
              />
            ) : (
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 font-display text-xs font-bold text-primary">
                {c.organizer.charAt(0).toUpperCase()}
              </span>
            )}
            <p className="min-w-0 truncate text-xs text-muted-foreground">by {c.organizer}</p>
          </div>
        </div>
        {c.latestUpdate && (
          <div className="rounded-xl bg-secondary px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
              Latest update · {c.latestUpdate.when}
            </p>
            <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-foreground/80">
              {c.latestUpdate.content}
            </p>
          </div>
        )}
        <div className="mt-auto space-y-3">
          <ProgressBar raised={c.raised} goal={c.goal} />
          <div className="flex items-end justify-between">
            <div>
              <p className="font-display text-lg font-bold text-primary">
                {formatKES(c.raised)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                raised of {formatKES(c.goal)} · {pct}%
              </p>
            </div>
            <span className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground">
              Donate
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
