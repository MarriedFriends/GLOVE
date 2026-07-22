"use client";

import { useState } from "react";

import {
  FACE_OPTIONS,
  HEIGHT_BUCKETS,
  formatHeight,
} from "@/lib/onboarding-options";
import type { Database } from "@/lib/supabase/database.types";
import { sendLike } from "./actions";

type Candidate =
  Database["public"]["Functions"]["get_daily_candidates"]["Returns"][number];
type Prefs = Database["public"]["Tables"]["match_preferences"]["Row"];

/** Small glowing chip for a condition the candidate satisfies. */
const glowChip =
  "inline-flex items-center gap-1 rounded-full border border-green-400 bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700 shadow-[0_0_10px_rgba(74,222,128,0.45)] dark:border-green-600 dark:bg-green-950/40 dark:text-green-300";

/** Compatibility tier — shown instead of the raw score. */
function scoreTier(score: number): { label: string; classes: string } {
  if (score >= 80) {
    return {
      label: "최상",
      classes:
        "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300",
    };
  }
  if (score >= 60) {
    return {
      label: "매우 좋음",
      classes:
        "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    };
  }
  if (score >= 40) {
    return {
      label: "좋음",
      classes:
        "bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-400",
    };
  }
  if (score >= 20) {
    return {
      label: "무난함",
      classes:
        "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300",
    };
  }
  return {
    label: "보통",
    classes:
      "bg-zinc-100 text-zinc-500 dark:bg-white/[.08] dark:text-zinc-400",
  };
}

export function DiscoverList({
  candidates,
  prefs,
}: {
  candidates: Candidate[];
  prefs: Prefs;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      {candidates.map((c) => {
        const open = openId === c.candidate_id;
        const face = FACE_OPTIONS.find((o) => o.value === c.face_type);
        const heightIdx = HEIGHT_BUCKETS.indexOf(
          c.height_range as (typeof HEIGHT_BUCKETS)[number],
        );

        // Only the conditions that actually match become green chips.
        // (Age/학번 are shown small next to the name instead.)
        const matchedChips: string[] = [];
        if (
          heightIdx >= prefs.min_height_idx &&
          heightIdx <= prefs.max_height_idx
        ) {
          matchedChips.push(`키 ${formatHeight(c.height_range)}`);
        }
        if (prefs.face_types.includes(c.face_type)) {
          matchedChips.push(`${face?.emoji ?? ""} ${face?.label ?? c.face_type}`);
        }
        if (prefs.same_university && c.university) {
          matchedChips.push("같은 학교");
        }
        if (prefs.hobby && c.hobbies.includes(prefs.hobby)) {
          matchedChips.push(`취미 ${prefs.hobby}`);
        }

        return (
          <div
            key={c.candidate_id}
            className="overflow-hidden rounded-3xl border border-black/[.08] bg-white/80 dark:border-white/[.12] dark:bg-white/[.04]"
          >
            {/* Compact banner — click to expand */}
            <button
              type="button"
              onClick={() => setOpenId(open ? null : c.candidate_id)}
              className="flex w-full items-center justify-between p-5 text-left transition-colors hover:bg-black/[.02] dark:hover:bg-white/[.03]"
            >
              <div className="flex items-center gap-3">
                <span className="text-4xl">{face?.emoji ?? "🙂"}</span>
                <div>
                  <p className="text-lg font-bold text-zinc-900 dark:text-white">
                    {c.handle}
                    <span className="ml-2 text-xs font-medium text-zinc-400 dark:text-zinc-500">
                      {c.age}살 · {String(c.admission_year).slice(2)}학번
                    </span>
                  </p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {c.mbti}
                    {c.university ? ` · ${c.university}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-3 py-1.5 text-sm font-bold ${scoreTier(c.score).classes}`}
                >
                  궁합 {scoreTier(c.score).label}
                </span>
                <span
                  className={`text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`}
                >
                  ▾
                </span>
              </div>
            </button>

            {/* Expanded detail */}
            {open && (
              <div className="border-t border-black/[.06] p-5 dark:border-white/[.08]">
                {/* Matched conditions — small green chips, only what matches */}
                {matchedChips.length > 0 && (
                  <div className="mb-4">
                    <p className="mb-2 text-xs font-medium text-green-600 dark:text-green-400">
                      ✓ 내가 원한 조건과 일치해요
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {matchedChips.map((chip) => (
                        <span key={chip} className={glowChip}>
                          {chip} ✓
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Compact survey summary */}
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {formatHeight(c.height_range)} ·{" "}
                  {face ? `${face.emoji} ${face.label}` : c.face_type} · {c.mbti}
                </p>

                {c.hobbies.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {c.hobbies.map((h) => (
                      <span
                        key={h}
                        className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-600 dark:bg-rose-950/40 dark:text-rose-300"
                      >
                        {h}
                      </span>
                    ))}
                  </div>
                )}

                {c.intro && (
                  <p className="mt-4 rounded-2xl bg-black/[.03] p-4 text-sm leading-6 text-zinc-700 dark:bg-white/[.06] dark:text-zinc-300">
                    &ldquo;{c.intro}&rdquo;
                  </p>
                )}

                {c.liked ? (
                  <div className="mt-5 rounded-full border-2 border-rose-200 py-3 text-center text-sm font-semibold text-rose-400 dark:border-rose-900 dark:text-rose-500">
                    💗 좋아요 보냄 — 상대의 응답을 기다려요
                  </div>
                ) : (
                  <form action={sendLike} className="mt-5">
                    <input
                      type="hidden"
                      name="likee_id"
                      value={c.candidate_id}
                    />
                    <button className="w-full rounded-full bg-gradient-to-r from-rose-500 to-pink-500 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-500/30 transition-transform hover:scale-[1.02]">
                      💗 좋아요
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
