"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { Shell } from "@/components/shell";
import { StatsCard } from "@/components/stats-card";
import { useAuth } from "@/components/auth-provider";
import { UserProfileUpdate } from "@/types/api";

const teamOptions = ["McLaren", "Ferrari", "Mercedes", "Red Bull", "Aston Martin"];
const driverOptions = ["Lando Norris", "Charles Leclerc", "Lewis Hamilton", "Max Verstappen", "George Russell"];
const roleOptions = ["Race Strategist", "Telemetry Engineer", "Performance Analyst", "Data Scientist", "Pit Wall Lead"];

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const [formState, setFormState] = useState<UserProfileUpdate>({
    full_name: "",
    role: "",
    favorite_team: "",
    favorite_driver: "",
    location: "",
    profile_image: "",
    bio: "",
  });
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      return;
    }

    setFormState({
      full_name: user.full_name,
      role: user.role,
      favorite_team: user.favorite_team,
      favorite_driver: user.favorite_driver,
      location: user.location,
      profile_image: user.profile_image,
      bio: user.bio,
    });
  }, [user]);

  const initials = useMemo(() => {
    return (
      formState.full_name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("") || "AP"
    );
  }, [formState.full_name]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatus("");
    setError("");

    try {
      await updateProfile(formState);
      setStatus("Profile synced to race control.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Profile update failed.");
    } finally {
      setSaving(false);
    }
  }

  function onProfileImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setFormState((current) => ({ ...current, profile_image: result }));
    };
    reader.readAsDataURL(file);
  }

  return (
    <Shell>
      <section className="page-frame aurora-frame reveal-up rounded-[34px] px-6 py-8 sm:px-8 sm:py-10">
        <div className="starfield" />
        <div className="f1-orb f1-orb-red right-10 top-10 h-24 w-24" />
        <div className="f1-orb f1-orb-cyan bottom-8 left-16 h-20 w-20" />
        <p className="f1-kicker">Profile Control</p>
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr,0.85fr] lg:items-end">
          <div>
            <h2 className="f1-title text-4xl sm:text-5xl">Build Your Driver Identity</h2>
            <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-300">
              Tune your race-control persona, favorite team stack, and personal briefing card so the platform feels like your own pit wall.
            </p>
          </div>
          <div className="f1-panel scan-panel rounded-[28px] p-5">
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-red-500/20 bg-white/5 text-xl font-bold text-white shadow-[0_0_24px_rgba(225,6,0,0.14)]">
                {formState.profile_image ? (
                  <img
                    alt={`${formState.full_name || "Apex Operator"} profile`}
                    className="h-full w-full object-cover"
                    src={formState.profile_image}
                  />
                ) : (
                  initials
                )}
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.26em] text-zinc-500">Live Identity</p>
                <p className="mt-2 text-2xl font-semibold text-white">{formState.full_name || "Apex Operator"}</p>
                <p className="mt-1 text-sm text-zinc-400">{formState.role || "Race Strategist"}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="reveal-up delay-1">
          <StatsCard label="Primary Team" value={formState.favorite_team || "Unset"} accent="#e10600" />
        </div>
        <div className="reveal-up delay-2">
          <StatsCard label="Focus Driver" value={formState.favorite_driver || "Unset"} accent="#f5f5f5" />
        </div>
        <div className="reveal-up delay-3">
          <StatsCard label="Location" value={formState.location || "Unset"} accent="#43d9ff" />
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
        <section className="f1-panel mesh-card reveal-up delay-2 rounded-[32px] p-6 sm:p-8">
          <div className="warp-line border-b border-white/10 pb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Profile Editor</p>
          </div>

          <form className="mt-6 space-y-5" onSubmit={onSubmit}>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="text-sm uppercase tracking-[0.22em] text-zinc-400">Profile Picture</label>
                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/5 text-lg font-bold text-white">
                    {formState.profile_image ? (
                      <img
                        alt={`${formState.full_name || "Apex Operator"} preview`}
                        className="h-full w-full object-cover"
                        src={formState.profile_image}
                      />
                    ) : (
                      initials
                    )}
                  </div>
                  <div className="flex-1">
                    <input
                      accept="image/*"
                      className="f1-input rounded-2xl px-4 py-3 file:mr-4 file:rounded-full file:border-0 file:bg-red-600 file:px-4 file:py-2 file:text-xs file:font-bold file:uppercase file:tracking-[0.18em] file:text-white"
                      type="file"
                      onChange={onProfileImageChange}
                    />
                    <p className="mt-2 text-xs uppercase tracking-[0.22em] text-zinc-500">
                      Upload a square image for the cleanest topbar avatar.
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <label className="text-sm uppercase tracking-[0.22em] text-zinc-400">Full Name</label>
                <input
                  className="f1-input mt-2 rounded-2xl px-4 py-3"
                  value={formState.full_name}
                  onChange={(event) => setFormState((current) => ({ ...current, full_name: event.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm uppercase tracking-[0.22em] text-zinc-400">Role</label>
                <select
                  className="f1-input mt-2 rounded-2xl px-4 py-3"
                  value={formState.role}
                  onChange={(event) => setFormState((current) => ({ ...current, role: event.target.value }))}
                >
                  {roleOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm uppercase tracking-[0.22em] text-zinc-400">Favorite Team</label>
                <select
                  className="f1-input mt-2 rounded-2xl px-4 py-3"
                  value={formState.favorite_team}
                  onChange={(event) => setFormState((current) => ({ ...current, favorite_team: event.target.value }))}
                >
                  {teamOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm uppercase tracking-[0.22em] text-zinc-400">Favorite Driver</label>
                <select
                  className="f1-input mt-2 rounded-2xl px-4 py-3"
                  value={formState.favorite_driver}
                  onChange={(event) => setFormState((current) => ({ ...current, favorite_driver: event.target.value }))}
                >
                  {driverOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm uppercase tracking-[0.22em] text-zinc-400">Location</label>
              <input
                className="f1-input mt-2 rounded-2xl px-4 py-3"
                value={formState.location}
                onChange={(event) => setFormState((current) => ({ ...current, location: event.target.value }))}
              />
            </div>

            <div>
              <label className="text-sm uppercase tracking-[0.22em] text-zinc-400">Bio</label>
              <textarea
                className="f1-input mt-2 min-h-36 rounded-3xl px-4 py-4"
                value={formState.bio}
                onChange={(event) => setFormState((current) => ({ ...current, bio: event.target.value }))}
              />
            </div>

            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            {status ? <p className="text-sm text-emerald-400">{status}</p> : null}

            <div className="flex flex-wrap items-center gap-4">
              <button
                className="holo-button rounded-full bg-accent px-6 py-3 font-bold uppercase tracking-[0.18em] text-white"
                disabled={saving}
                type="submit"
              >
                {saving ? "Syncing..." : "Save Profile"}
              </button>
              <p className="text-sm text-zinc-500">Your profile updates live across the protected workspace.</p>
            </div>
          </form>
        </section>

        <section className="space-y-6">
          <div className="f1-panel mesh-card scan-panel reveal-up delay-3 rounded-[32px] p-6">
            <div className="warp-line border-b border-white/10 pb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Profile Snapshot</p>
            </div>
            <div className="mt-6 space-y-4">
              <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Operator Handle</p>
                <p className="mt-3 text-3xl font-semibold text-white">{user?.username}</p>
              </div>
              <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Avatar</p>
                <div className="mt-4 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/5 text-xl font-bold text-white">
                  {formState.profile_image ? (
                    <img
                      alt={`${formState.full_name || "Apex Operator"} snapshot`}
                      className="h-full w-full object-cover"
                      src={formState.profile_image}
                    />
                  ) : (
                    initials
                  )}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
                  <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Favorite Team</p>
                  <p className="mt-3 text-lg font-semibold text-white">{formState.favorite_team}</p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
                  <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Favorite Driver</p>
                  <p className="mt-3 text-lg font-semibold text-white">{formState.favorite_driver}</p>
                </div>
              </div>
              <div className="rounded-[26px] border border-red-600/20 bg-red-600/8 p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-red-300">Mission Brief</p>
                <p className="mt-3 text-sm leading-7 text-zinc-300">{formState.bio}</p>
              </div>
            </div>
          </div>

          <div className="f1-panel reveal-up delay-4 rounded-[32px] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Quick Access</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Link className="nav-pill rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-zinc-200 transition hover:border-red-500/50 hover:bg-red-600/10" href="/">
                Return to Home
              </Link>
              <Link className="nav-pill rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-zinc-200 transition hover:border-red-500/50 hover:bg-red-600/10" href="/dashboard">
                Open Dashboard
              </Link>
            </div>
          </div>
        </section>
      </div>
    </Shell>
  );
}
