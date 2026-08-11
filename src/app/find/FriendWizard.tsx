"use client";

import { useState } from "react";

import {
  MIN_ADMISSION_YEAR,
  MAX_ADMISSION_YEAR,
  MIN_AGE,
  MAX_AGE,
  HOBBY_OPTIONS,
} from "@/lib/onboarding-options";
import { RangeSlider } from "./RangeSlider";
import { savePreferences } from "./actions";

const TOTAL_STEPS = 2;

const bigButton =
  "flex flex-col items-center justify-center gap-2 rounded-2xl border-2 p-5 text-base font-semibold transition-all";
const unselected =
  "border-black/[.08] bg-white text-zinc-700 hover:border-rose-300 dark:border-white/[.12] dark:bg-zinc-900 dark:text-zinc-200";
const selected =
  "border-rose-500 bg-rose-50 text-rose-600 shadow-lg shadow-rose-500/10 dark:bg-rose-950/40 dark:text-rose-300";

/**
 * Friend-mode condition wizard: same-gender matching with only 나이 · 학번 ·
 * 학교 · 취미 conditions (no looks/lifestyle filters — it's friendship).
 */
export function FriendWizard({ error }: { error?: string }) {
  const [step, setStep] = useState(0);

  const [ageRange, setAgeRange] = useState<[number, number]>([MIN_AGE, MAX_AGE]);
  const [admissionRange, setAdmissionRange] = useState<[number, number]>([
    MIN_ADMISSION_YEAR,
    MAX_ADMISSION_YEAR,
  ]);
  const [universityScope, setUniversityScope] = useState<
    "same" | "different" | "any"
  >("any");
  const [hobby, setHobby] = useState<string | null>(null);

  const canNext = [true, hobby !== null][step];
  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  return (
    <div className="w-full max-w-md">
      {/* Progress */}
      <div className="mb-8">
        <div className="mb-2 flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={back}
            className={`font-medium text-zinc-500 dark:text-zinc-400 ${
              step === 0 ? "invisible" : ""
            }`}
          >
            ← 이전
          </button>
          <span className="font-medium text-rose-500">
            {step + 1} / {TOTAL_STEPS}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-black/[.06] dark:bg-white/[.1]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-rose-500 to-pink-500 transition-all duration-300"
            style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
          />
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      {/* Step 1 — age, admission year, university */}
      {step === 0 && (
        <section className="flex flex-col gap-9">
          <h2 className="text-center text-2xl font-bold text-zinc-900 dark:text-white">
            어떤 친구를 찾고 있나요?
          </h2>

          <div>
            <p className="mb-1 text-center text-sm text-zinc-500 dark:text-zinc-400">
              원하는 나이
            </p>
            <p className="mb-4 text-center text-2xl font-bold text-rose-500">
              {ageRange[0]}살 ~ {ageRange[1]}살
            </p>
            <RangeSlider
              min={MIN_AGE}
              max={MAX_AGE}
              low={ageRange[0]}
              high={ageRange[1]}
              onChange={(low, high) => setAgeRange([low, high])}
            />
          </div>

          <div>
            <p className="mb-1 text-center text-sm text-zinc-500 dark:text-zinc-400">
              원하는 학번
            </p>
            <p className="mb-4 text-center text-2xl font-bold text-rose-500">
              {String(admissionRange[0]).slice(2)}학번 ~{" "}
              {String(admissionRange[1]).slice(2)}학번
            </p>
            <RangeSlider
              min={MIN_ADMISSION_YEAR}
              max={MAX_ADMISSION_YEAR}
              low={admissionRange[0]}
              high={admissionRange[1]}
              onChange={(low, high) => setAdmissionRange([low, high])}
            />
          </div>

          <div>
            <p className="mb-3 text-center text-sm text-zinc-500 dark:text-zinc-400">
              어느 학교에서 찾을까요?
            </p>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setUniversityScope("same")}
                className={`${bigButton} !p-4 !text-sm ${universityScope === "same" ? selected : unselected}`}
              >
                <span className="text-3xl">🏫</span>
                같은 학교만
              </button>
              <button
                type="button"
                onClick={() => setUniversityScope("different")}
                className={`${bigButton} !p-4 !text-sm ${universityScope === "different" ? selected : unselected}`}
              >
                <span className="text-3xl">🚌</span>
                다른 학교만
              </button>
              <button
                type="button"
                onClick={() => setUniversityScope("any")}
                className={`${bigButton} !p-4 !text-sm ${universityScope === "any" ? selected : unselected}`}
              >
                <span className="text-3xl">🌍</span>
                상관없음
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Step 2 — one hobby to share */}
      {step === 1 && (
        <section>
          <h2 className="mb-2 text-center text-2xl font-bold text-zinc-900 dark:text-white">
            함께하고 싶은 취미 하나를 골라주세요
          </h2>
          <p className="mb-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
            딱 하나만!
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {HOBBY_OPTIONS.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setHobby(h)}
                className={`rounded-full border-2 px-4 py-2 text-sm font-medium transition-all ${
                  hobby === h ? selected : unselected
                }`}
              >
                {h}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Footer */}
      <div className="mt-10">
        {step < TOTAL_STEPS - 1 ? (
          <button
            type="button"
            onClick={next}
            disabled={!canNext}
            className="w-full rounded-full bg-gradient-to-r from-rose-500 to-pink-500 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-rose-500/30 transition-transform hover:scale-[1.02] disabled:opacity-40 disabled:hover:scale-100"
          >
            다음
          </button>
        ) : (
          <form action={savePreferences}>
            <input type="hidden" name="mode" value="friend" />
            <input type="hidden" name="min_age" value={ageRange[0]} />
            <input type="hidden" name="max_age" value={ageRange[1]} />
            <input
              type="hidden"
              name="min_admission_year"
              value={admissionRange[0]}
            />
            <input
              type="hidden"
              name="max_admission_year"
              value={admissionRange[1]}
            />
            <input
              type="hidden"
              name="university_scope"
              value={universityScope}
            />
            <input type="hidden" name="hobby" value={hobby ?? ""} />
            <button
              disabled={!canNext}
              className="w-full rounded-full bg-gradient-to-r from-rose-500 to-pink-500 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-rose-500/30 transition-transform hover:scale-[1.02] disabled:opacity-40 disabled:hover:scale-100"
            >
              이 조건으로 친구 찾기 🤝
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
