"use client";

/**
 * A slider with TWO draggable handles for picking a range (e.g. age 21~25).
 * Built from two overlapping native <input type="range"> elements: the track
 * ignores pointer events, only the round thumbs receive them.
 */

const thumbStyle =
  "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-rose-500 [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-rose-500";

export function RangeSlider({
  min,
  max,
  low,
  high,
  onChange,
}: {
  min: number;
  max: number;
  low: number;
  high: number;
  onChange: (low: number, high: number) => void;
}) {
  const pct = (v: number) => ((v - min) / (max - min)) * 100;

  return (
    <div className="relative h-6">
      {/* Track */}
      <div className="absolute top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-black/[.08] dark:bg-white/[.12]" />
      {/* Highlighted selection between the two handles */}
      <div
        className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-gradient-to-r from-rose-500 to-pink-500"
        style={{ left: `${pct(low)}%`, width: `${pct(high) - pct(low)}%` }}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={low}
        onChange={(e) => onChange(Math.min(Number(e.target.value), high), high)}
        className={`pointer-events-none absolute inset-0 w-full appearance-none bg-transparent ${thumbStyle}`}
        style={{ zIndex: low > (min + max) / 2 ? 5 : 3 }}
        aria-label="최솟값"
      />
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={high}
        onChange={(e) => onChange(low, Math.max(Number(e.target.value), low))}
        className={`pointer-events-none absolute inset-0 w-full appearance-none bg-transparent ${thumbStyle}`}
        style={{ zIndex: 4 }}
        aria-label="최댓값"
      />
    </div>
  );
}
