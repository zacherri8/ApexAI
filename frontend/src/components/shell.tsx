"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

import { AuthGate } from "@/components/auth-gate";
import { useAuth } from "@/components/auth-provider";

const navItems = [
  ["Home", "/"],
  ["Dashboard", "/dashboard"],
  ["Compare", "/compare"],
  ["Replay", "/replay"],
  ["Engineer", "/engineer"],
  ["Predictor", "/predictor"],
  ["Report", "/report"],
  ["Chatbot", "/chatbot"],
  ["History", "/history"],
];

export function Shell({
  children,
  requiresAuth = true,
}: {
  children: ReactNode;
  requiresAuth?: boolean;
}) {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  return (
    <div className="app-shell text-white">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <header className="page-frame reveal-up rounded-[26px] px-5 py-4 sm:px-6">
          <div className="f1-orb f1-orb-red right-8 top-4 h-16 w-16" />
          <div className="f1-orb f1-orb-cyan bottom-4 right-28 h-12 w-12" />
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="min-w-0">
                <p className="f1-kicker">ApexAI Race Lab</p>
                <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                  <div className="min-w-0">
                    <Link href="/" className="group">
                      <h1 className="f1-title text-2xl leading-none transition duration-200 group-hover:text-red-400 sm:text-3xl xl:text-[2.7rem]">
                        F1 Analytics & Strategy Platform
                      </h1>
                    </Link>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
                      Telemetry, strategy, prediction, reporting, and F1 knowledge in one race-control workspace.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 xl:justify-end">
                    {user ? (
                      <>
                        <Link
                          className="flex items-center gap-3 rounded-full border border-emerald-400/15 bg-emerald-400/5 px-2 py-2 pr-4 text-xs uppercase tracking-[0.22em] text-zinc-200 transition hover:border-red-500/50 hover:bg-red-600/10 hover:text-white"
                          href="/profile"
                        >
                          <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/5 text-sm font-bold tracking-normal text-white">
                            {user.profile_image ? (
                              <img
                                alt={`${user.full_name} profile`}
                                className="h-full w-full object-cover"
                                src={user.profile_image}
                              />
                            ) : (
                              user.full_name
                                .split(" ")
                                .filter(Boolean)
                                .slice(0, 2)
                                .map((part) => part[0]?.toUpperCase())
                                .join("")
                            )}
                          </span>
                          <span>{user.full_name}</span>
                        </Link>
                        <button
                          className="nav-pill rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-zinc-300 transition hover:border-red-600/60 hover:bg-red-600/10 hover:text-white"
                          onClick={logout}
                          type="button"
                        >
                          Logout
                        </button>
                      </>
                    ) : (
                      <Link
                        className="holo-button rounded-full bg-accent px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white"
                        href="/login"
                      >
                        Login
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-3 border-t border-white/10 pt-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-2 w-2 rounded-full bg-red-500 shadow-[0_0_16px_rgba(225,6,0,0.7)]" />
                <p className="text-[0.64rem] font-semibold uppercase tracking-[0.32em] text-zinc-500">
                  Navigation
                </p>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {navItems.map(([label, href], index) => (
                  <Link
                    key={href}
                    className={`nav-pill rounded-full border px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-[0.22em] transition ${
                      pathname === href
                        ? "border-red-500/60 bg-red-600/15 text-white"
                        : "border-white/10 bg-white/5 text-zinc-300 hover:border-red-600/60 hover:bg-red-600/10 hover:text-white"
                    }`}
                    href={href}
                  >
                    <span className="mr-2 text-red-500/85">0{index + 1}</span>
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </header>
        <main className="mt-6">{requiresAuth ? <AuthGate>{children}</AuthGate> : children}</main>
      </div>
    </div>
  );
}
