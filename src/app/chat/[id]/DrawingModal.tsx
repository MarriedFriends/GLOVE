"use client";

import { useEffect, useRef, useState } from "react";

const COLORS = [
  "#18181b", // black
  "#f43f5e", // rose
  "#3b82f6", // blue
  "#22c55e", // green
  "#eab308", // yellow
  "#a855f7", // purple
];
const SIZES = [4, 9, 18];
const CANVAS_SIZE = 480;

/**
 * Finger/mouse drawing canvas for picture messages (e.g. the self-portrait
 * question). Exports a PNG blob on send.
 */
export function DrawingModal({
  sending,
  onClose,
  onSend,
}: {
  sending: boolean;
  onClose: () => void;
  onSend: (blob: Blob) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState<string>(COLORS[0]);
  const [size, setSize] = useState<number>(SIZES[1]);
  const [eraser, setEraser] = useState(false);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  function toCanvasPos(e: React.PointerEvent) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function stroke(from: { x: number; y: number }, to: { x: number; y: number }) {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = eraser ? "#ffffff" : color;
    ctx.lineWidth = eraser ? size * 3 : size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }

  function handleDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const p = toCanvasPos(e);
    last.current = p;
    stroke(p, p); // dot on tap
  }

  function handleMove(e: React.PointerEvent) {
    if (!drawing.current || !last.current) return;
    const p = toCanvasPos(e);
    stroke(last.current, p);
    last.current = p;
  }

  function handleUp() {
    drawing.current = false;
    last.current = null;
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function send() {
    canvasRef.current?.toBlob((blob) => {
      if (blob) onSend(blob);
    }, "image/png");
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-4 shadow-2xl dark:bg-zinc-900">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-bold text-zinc-900 dark:text-white">
            🎨 그림 그리기
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="text-zinc-400"
          >
            ✕
          </button>
        </div>

        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onPointerCancel={handleUp}
          className="aspect-square w-full touch-none rounded-2xl border border-black/[.08] bg-white dark:border-white/[.15]"
        />

        {/* Colors + eraser */}
        <div className="mt-3 flex items-center justify-center gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`색상 ${c}`}
              onClick={() => {
                setColor(c);
                setEraser(false);
              }}
              className={`h-7 w-7 rounded-full border-2 transition-transform ${
                !eraser && color === c
                  ? "scale-125 border-zinc-900 dark:border-white"
                  : "border-black/[.1] dark:border-white/[.2]"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
          <button
            type="button"
            onClick={() => setEraser(true)}
            className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-sm ${
              eraser
                ? "scale-125 border-zinc-900 dark:border-white"
                : "border-black/[.1] dark:border-white/[.2]"
            }`}
            aria-label="지우개"
          >
            🧽
          </button>
        </div>

        {/* Brush sizes + actions */}
        <div className="mt-3 flex items-center gap-2">
          {SIZES.map((sz) => (
            <button
              key={sz}
              type="button"
              onClick={() => setSize(sz)}
              aria-label={`굵기 ${sz}`}
              className={`flex h-9 w-9 items-center justify-center rounded-full border ${
                size === sz
                  ? "border-rose-400 bg-rose-50 dark:bg-rose-950/40"
                  : "border-black/[.1] dark:border-white/[.15]"
              }`}
            >
              <span
                className="rounded-full bg-zinc-800 dark:bg-zinc-200"
                style={{ width: sz / 1.5 + 3, height: sz / 1.5 + 3 }}
              />
            </button>
          ))}
          <button
            type="button"
            onClick={clearCanvas}
            className="ml-auto rounded-full border border-black/[.1] px-3 py-2 text-xs font-medium text-zinc-500 dark:border-white/[.15] dark:text-zinc-400"
          >
            전체 지우기
          </button>
          <button
            type="button"
            onClick={send}
            disabled={sending}
            className="rounded-full bg-gradient-to-r from-rose-500 to-pink-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-rose-500/30 disabled:opacity-40"
          >
            {sending ? "전송 중..." : "보내기"}
          </button>
        </div>
      </div>
    </div>
  );
}
