import Link from "next/link";
import { ReactNode } from "react";

export function FeaturePoster({
  eyebrow,
  title,
  description,
  href,
  badge,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  badge: string;
  children: ReactNode;
}) {
  return (
    <article className="page-frame aurora-frame reveal-up rounded-[30px] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="f1-kicker !text-[0.6rem]">{eyebrow}</p>
          <h3 className="f1-title mt-4 text-3xl sm:text-4xl">{title}</h3>
          <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-400 sm:text-base">{description}</p>
        </div>
        <div className="warp-line rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-zinc-300">
          {badge}
        </div>
      </div>
      <div className="scan-panel mt-6">{children}</div>
      <div className="mt-5">
        <Link className="nav-pill holo-button rounded-full bg-accent px-5 py-3 text-xs font-bold uppercase tracking-[0.24em] text-white" href={href}>
          Open Module
        </Link>
      </div>
    </article>
  );
}
