"use client";

import { useState } from "react";

import {
  GENDER_OPTIONS,
  MIN_ADMISSION_YEAR,
  MAX_ADMISSION_YEAR,
  MIN_AGE,
  MAX_AGE,
  HEIGHT_BUCKETS,
  formatHeight,
  FACE_OPTIONS,
  MBTI_PAIRS,
  HOBBY_OPTIONS,
  MAX_HOBBIES,
} from "@/lib/onboarding-options";
import { saveOnboarding } from "./actions";

const TOTAL_STEPS = 6;

const bigButton =
  "flex flex-col items-center justify-center gap-2 rounded-2xl border-2 p-6 text-lg font-semibold transition-all";
const unselected =
  "border-black/[.08] bg-white text-zinc-700 hover:border-rose-300 dark:border-white/[.12] dark:bg-zinc-900 dark:text-zinc-200";
const selected =
  "border-rose-500 bg-rose-50 text-rose-600 shadow-lg shadow-rose-500/10 dark:bg-rose-950/40 dark:text-rose-300";

export function OnboardingWizard({ error }: { error?: string }) {
  const [step, setStep] = useState(0);

  const [gender, setGender] = useState<string | null>(null);
  const [admissionYear, setAdmissionYear] = useState(2024);
  const [age, setAge] = useState(21);
  const [heightIdx, setHeightIdx] = useState(4); // "166~170"
  const [face, setFace] = useState<string | null>(null);
  const [mbti, setMbti] = useState<Record<number, string>>({});
  const [hobbies, setHobbies] = useState<string[]>([]);

  const mbtiString = MBTI_PAIRS.map((_, i) => mbti[i] ?? "").join("");

  const canNext = [
    gender !== null,
    true, // sliders always have a value
    true,
    face !== null,
    mbtiString.length === 4,
    hobbies.length >= 1,
  ][step];

  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const pick = (setter: (v: string) => void) => (value: string) => {
    setter(value);
    next(); // single-choice steps advance automatically
  };

  const toggleHobby = (hobby: string) =>
    setHobbies((prev) =>
      prev.includes(hobby)
        ? prev.filter((h) => h !== hobby)
        : prev.length < MAX_HOBBIES
          ? [...prev, hobby]
          : prev,
    );

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

      {/* Step 1 — gender */}
      {step === 0 && (
        <section>
          <h2 className="mb-6 text-center text-2xl font-bold text-zinc-900 dark:text-white">
            성별이 어떻게 되세요?
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {GENDER_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => pick(setGender)(o.value)}
                className={`${bigButton} ${gender === o.value ? selected : unselected}`}
              >
                <span className="text-4xl">{o.emoji}</span>
                {o.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Step 2 — admission year + age */}
      {step === 1 && (
        <section className="flex flex-col gap-10">
          <h2 className="text-center text-2xl font-bold text-zinc-900 dark:text-white">
            학번과 나이를 알려주세요
          </h2>

          <div>
            <p className="mb-1 text-center text-sm text-zinc-500 dark:text-zinc-400">
              학번
            </p>
            <p className="mb-4 text-center text-3xl font-bold text-rose-500">
              {String(admissionYear).slice(2)}학번
            </p>
            <input
              type="range"
              min={MIN_ADMISSION_YEAR}
              max={MAX_ADMISSION_YEAR}
              step={1}
              value={admissionYear}
              onChange={(e) => setAdmissionYear(Number(e.target.value))}
              className="w-full accent-rose-500"
            />
            <div className="mt-1 flex justify-between text-xs text-zinc-400">
              <span>{String(MIN_ADMISSION_YEAR).slice(2)}학번</span>
              <span>{String(MAX_ADMISSION_YEAR).slice(2)}학번</span>
            </div>
          </div>

          <div>
            <p className="mb-1 text-center text-sm text-zinc-500 dark:text-zinc-400">
              나이
            </p>
            <p className="mb-4 text-center text-3xl font-bold text-rose-500">
              {age}살
            </p>
            <input
              type="range"
              min={MIN_AGE}
              max={MAX_AGE}
              step={1}
              value={age}
              onChange={(e) => setAge(Number(e.target.value))}
              className="w-full accent-rose-500"
            />
            <div className="mt-1 flex justify-between text-xs text-zinc-400">
              <span>{MIN_AGE}살</span>
              <span>{MAX_AGE}살</span>
            </div>
          </div>
        </section>
      )}

      {/* Step 3 — height */}
      {step === 2 && (
        <section>
          <h2 className="mb-6 text-center text-2xl font-bold text-zinc-900 dark:text-white">
            키가 어떻게 되세요?
          </h2>
          <p className="mb-4 text-center text-3xl font-bold text-rose-500">
            {formatHeight(HEIGHT_BUCKETS[heightIdx])}
          </p>
          <input
            type="range"
            min={0}
            max={HEIGHT_BUCKETS.length - 1}
            step={1}
            value={heightIdx}
            onChange={(e) => setHeightIdx(Number(e.target.value))}
            className="w-full accent-rose-500"
          />
          <div className="mt-1 flex justify-between text-xs text-zinc-400">
            <span>150 이하</span>
            <span>190 이상</span>
          </div>
        </section>
      )}

      {/* Step 4 — face type */}
      {step === 3 && (
        <section>
          <h2 className="mb-6 text-center text-2xl font-bold text-zinc-900 dark:text-white">
            나는 어떤 얼굴상인가요?
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {FACE_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => pick(setFace)(o.value)}
                className={`${bigButton} ${face === o.value ? selected : unselected}`}
              >
                <span className="text-4xl">{o.emoji}</span>
                {o.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Step 5 — MBTI */}
      {step === 4 && (
        <section>
          <h2 className="mb-2 text-center text-2xl font-bold text-zinc-900 dark:text-white">
            MBTI를 완성해보세요
          </h2>
          <p className="mb-6 text-center text-2xl font-bold tracking-[.3em] text-rose-500">
            {MBTI_PAIRS.map((_, i) => mbti[i] ?? "·").join("")}
          </p>
          <div className="flex flex-col gap-5">
            {MBTI_PAIRS.map((pair, i) => {
              const chosen = pair.options.find((o) => o.value === mbti[i]);
              return (
                <div key={pair.name}>
                  <div className="grid grid-cols-2 gap-2">
                    {pair.options.map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => setMbti((m) => ({ ...m, [i]: o.value }))}
                        className={`rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-all ${
                          mbti[i] === o.value ? selected : unselected
                        }`}
                      >
                        <span className="mr-1.5 text-base font-bold">
                          {o.value}
                        </span>
                        {o.label}
                      </button>
                    ))}
                  </div>
                  <p
                    className={`mt-1.5 min-h-5 text-center text-xs text-zinc-500 transition-opacity dark:text-zinc-400 ${
                      chosen ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    {chosen?.desc ?? ""}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Step 6 — hobbies */}
      {step === 5 && (
        <section>
          <h2 className="mb-2 text-center text-2xl font-bold text-zinc-900 dark:text-white">
            취미를 골라주세요
          </h2>
          <p className="mb-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
            최대 {MAX_HOBBIES}개까지 ({hobbies.length}/{MAX_HOBBIES})
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {HOBBY_OPTIONS.map((hobby) => (
              <button
                key={hobby}
                type="button"
                onClick={() => toggleHobby(hobby)}
                className={`rounded-full border-2 px-4 py-2 text-sm font-medium transition-all ${
                  hobbies.includes(hobby) ? selected : unselected
                }`}
              >
                {hobby}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Footer: next / submit */}
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
          <form action={saveOnboarding}>
            <input type="hidden" name="gender" value={gender ?? ""} />
            <input type="hidden" name="admission_year" value={admissionYear} />
            <input type="hidden" name="age" value={age} />
            <input
              type="hidden"
              name="height_range"
              value={HEIGHT_BUCKETS[heightIdx]}
            />
            <input type="hidden" name="face_type" value={face ?? ""} />
            <input type="hidden" name="mbti" value={mbtiString} />
            {hobbies.map((h) => (
              <input key={h} type="hidden" name="hobbies" value={h} />
            ))}
            <button
              disabled={!canNext}
              className="w-full rounded-full bg-gradient-to-r from-rose-500 to-pink-500 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-rose-500/30 transition-transform hover:scale-[1.02] disabled:opacity-40 disabled:hover:scale-100"
            >
              완료하고 시작하기 🎉
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
