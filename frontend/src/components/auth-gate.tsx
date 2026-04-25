"use client";

import Link from "next/link";
import { ReactNode } from "react";

import { useAuth } from "@/components/auth-provider";

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <section className="page-frame aurora-frame rounded-[32px] px-6 py-12 text-center">
        <p className="f1-kicker justify-center">Authenticating</p>
        <h2 className="f1-title mt-5 text-4xl">Checking Access</h2>
        <p className="mt-4 text-zinc-400">Syncing your race control profile...</p>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="page-frame aurora-frame rounded-[32px] px-6 py-12 text-center">
        <p className="f1-kicker justify-center">Restricted Access</p>
        <h2 className="f1-title mt-5 text-4xl">Login Required</h2>
        <p className="mx-auto mt-4 max-w-xl text-zinc-400">
          Sign in with the demo credentials to access the analytics workspace, AI tools, and telemetry dashboards.
        </p>
        <div className="mt-8">
          <Link className="holo-button rounded-full bg-accent px-6 py-3 font-bold uppercase tracking-[0.18em] text-white" href="/login">
            Open Login
          </Link>
        </div>
      </section>
    );
  }

  return <>{children}</>;
}
