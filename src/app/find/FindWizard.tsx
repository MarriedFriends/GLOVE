"use client";

import { useState } from "react";

import {
  MIN_ADMISSION_YEAR,
  MAX_ADMISSION_YEAR,
  MIN_AGE,
  MAX_AGE,
  HEIGHT_BUCKETS,
  FACE_OPTIONS,
  HOBBY_OPTIONS,
} from "@/lib/onboarding-options";
import { RangeSlider } from "./RangeSlider";
import { savePreferences } from "./actions";

const TOTAL_STEPS = 5;

const bigButton =
  "flex flex-col items-center justify-center gap-2 rounded-2xl border-2 p-5 text-base font-semibold transition-all";
const unselected =
  "border-black/[.08] bg-white text-zinc-700 hover:border-rose-300 dark:border-white/[.12] dark:bg-zinc-900 dark:text-zinc-200";
const selected =
  "border-rose-500 bg-rose-50 text-rose-600 shadow-lg shadow-rose-500/10 dark:bg-rose-950/40 dark:text-rose-300";

// Bucket edges for a friendly height-range label.
const LOWER_CM = [150, 151, 156, 161, 166, 171, 176, 181, 186, 191];
const UPPER_CM = [150, 155, 160, 165, 170, 175, 180, 185, 190, 191];

function heightLabel(lowIdx: number, highIdx: number): string {
  if (lowIdx === 0 && highIdx === HEIGHT_BUCKETS.length - 1) return "모든 키";
  const low = lowIdx === 0 ? "150cm 이하" : `${LOWER_CM[lowIdx]}cm`;
  const high =
    highIdx === HEIGHT_BUCKETS.length - 1
      ? "190cm 이상"
      : `${UPPER_CM[highIdx]}cm`;
  return `${low} ~ ${high}`;
}

export function FindWizard({ error }: { error?: string }) {
  const [step, setStep] = useState(0);

  const [ageRange, setAgeRange] = useState<[number, number]>([MIN_AGE, MAX_AGE]);
  const [admissionRange, setAdmissionRange] = useState<[number, number]>([
    MIN_ADMISSION_YEAR,
    MAX_ADMISSION_YEAR,
  ]);
  const [sameUniversity, setSameUniversity] = useState(true);
  const [heightRange, setHeightRange] = useState<[number, number]>([
    0,
    HEIGHT_BUCKETS.length - 1,
  ]);
  const [faceTypes, setFaceTypes] = useState<string[]>([]);
  const [hobby, setHobby] = useState<string | null>(null);
  const [intro, setIntro] = useState("");

  const introLength = intro.trim().length;

  const canNext = [
    true, // ranges + toggle always valid
    true,
    faceTypes.length >= 1,
    hobby !== null,
    introLength >= 10 && introLength <= 80,
  ][step];

  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const toggleFace = (value: string) =>
    setFaceTypes((prev) =>
      prev.includes(value)
        ? prev.filter((f) => f !== value)
        : [...prev, value],
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

      {/* Step 1 — age range, admission-year range, same university */}
      {step === 0 && (
        <section className="flex flex-col gap-9">
          <h2 className="text-center text-2xl font-bold text-zinc-900 dark:text-white">
            어떤 상대를 찾고 있나요?
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
              같은 학교에서 찾을까요?
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSameUniversity(true)}
                className={`${bigButton} ${sameUniversity ? selected : unselected}`}
              >
                <span className="text-3xl">🏫</span>
                같은 학교만
              </button>
              <button
                type="button"
                onClick={() => setSameUniversity(false)}
                className={`${bigButton} ${!sameUniversity ? selected : unselected}`}
              >
                <span className="text-3xl">🌍</span>
                다른 학교도 좋아요
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Step 2 — height range */}
      {step === 1 && (
        <section>
          <h2 className="mb-6 text-center text-2xl font-bold text-zinc-900 dark:text-white">
            원하는 키는 어느 정도인가요?
          </h2>
          <p className="mb-4 text-center text-2xl font-bold text-rose-500">
            {heightLabel(heightRange[0], heightRange[1])}
          </p>
          <RangeSlider
            min={0}
            max={HEIGHT_BUCKETS.length - 1}
            low={heightRange[0]}
            high={heightRange[1]}
            onChange={(low, high) => setHeightRange([low, high])}
          />
          <div className="mt-1 flex justify-between text-xs text-zinc-400">
            <span>150 이하</span>
            <span>190 이상</span>
          </div>
        </section>
      )}

      {/* Step 3 — preferred face types (multi-select) */}
      {step === 2 && (
        <section>
          <h2 className="mb-2 text-center text-2xl font-bold text-zinc-900 dark:text-white">
            어떤 얼굴상이 좋아요?
          </h2>
          <p className="mb-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
            여러 개 골라도 돼요
          </p>
          <div className="grid grid-cols-2 gap-3">
            {FACE_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => toggleFace(o.value)}
                className={`${bigButton} ${
                  faceTypes.includes(o.value) ? selected : unselected
                }`}
              >
                <span className="text-4xl">{o.emoji}</span>
                {o.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Step 4 — one hobby to share */}
      {step === 3 && (
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
                onClick={() => {
                  setHobby(h);
                  next();
                }}
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

      {/* Step 5 — intro message */}
      {step === 4 && (
        <section>
          <h2 className="mb-2 text-center text-2xl font-bold text-zinc-900 dark:text-white">
            나를 소개하는 한마디
          </h2>
          <p className="mb-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
            매칭된 상대에게 처음 보여질 말이에요 (10~80자)
          </p>
          <textarea
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            maxLength={80}
            rows={3}
            placeholder="안녕하세요! 같이 카페 투어 다닐 사람 찾고 있어요 ☕"
            className="w-full resize-none rounded-2xl border-2 border-black/[.08] bg-white p-4 text-sm outline-none focus:border-rose-400 dark:border-white/[.12] dark:bg-zinc-900"
          />
          <p
            className={`mt-1 text-right text-xs ${
              introLength > 0 && introLength < 10
                ? "text-rose-500"
                : "text-zinc-400"
            }`}
          >
            {introLength < 10 ? `최소 10자 (지금 ${introLength}자)` : `${introLength}/80자`}
          </p>
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
              name="same_university"
              value={sameUniversity ? "true" : "false"}
            />
            <input type="hidden" name="min_height_idx" value={heightRange[0]} />
            <input type="hidden" name="max_height_idx" value={heightRange[1]} />
            {faceTypes.map((f) => (
              <input key={f} type="hidden" name="face_types" value={f} />
            ))}
            <input type="hidden" name="hobby" value={hobby ?? ""} />
            <input type="hidden" name="intro" value={intro.trim()} />
            <button
              disabled={!canNext}
              className="w-full rounded-full bg-gradient-to-r from-rose-500 to-pink-500 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-rose-500/30 transition-transform hover:scale-[1.02] disabled:opacity-40 disabled:hover:scale-100"
            >
              이 조건으로 찾기 시작 💘
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
