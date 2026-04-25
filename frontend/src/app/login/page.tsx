"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth-provider";
import { Shell } from "@/components/shell";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(event.currentTarget);

    try {
      await login(String(formData.get("username")), String(formData.get("password")));
      router.push("/dashboard");
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell requiresAuth={false}>
      <section className="page-frame aurora-frame reveal-up rounded-[34px] px-6 py-10 sm:px-8 sm:py-12">
        <div className="starfield" />
        <p className="f1-kicker">Secure Access</p>
        <h2 className="f1-title mt-6 text-5xl leading-[0.95] sm:text-6xl">ENTER THE RACE CONTROL GRID</h2>
        <p className="mt-6 max-w-2xl text-base leading-7 text-zinc-300">
          Sign in to unlock telemetry, prediction, race engineering, reporting, and the F1 knowledge systems.
        </p>
      </section>

      <section className="f1-panel mesh-card reveal-up delay-2 mt-8 rounded-[32px] p-6 sm:p-8">
        <form className="mx-auto max-w-xl space-y-5" onSubmit={onSubmit}>
          <div>
            <label className="text-sm uppercase tracking-[0.22em] text-zinc-400">Username</label>
            <input className="f1-input mt-2 rounded-2xl px-4 py-3" defaultValue="demo" name="username" />
          </div>
          <div>
            <label className="text-sm uppercase tracking-[0.22em] text-zinc-400">Password</label>
            <input className="f1-input mt-2 rounded-2xl px-4 py-3" defaultValue="demo123" name="password" type="password" />
          </div>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <div className="flex flex-wrap items-center gap-4">
            <button className="holo-button rounded-full bg-accent px-6 py-3 font-bold uppercase tracking-[0.18em] text-white" disabled={loading} type="submit">
              {loading ? "Signing In..." : "Login"}
            </button>
            <p className="text-sm text-zinc-500">Demo credentials are prefilled for you.</p>
          </div>
        </form>
      </section>
    </Shell>
  );
}
