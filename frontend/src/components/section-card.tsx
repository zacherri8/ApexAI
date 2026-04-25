import { ReactNode } from "react";

export function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="f1-panel rounded-[28px] p-6 sm:p-7">
      <div className="mb-5">
        <p className="f1-kicker !text-[0.62rem]">{title}</p>
        {subtitle ? <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}
