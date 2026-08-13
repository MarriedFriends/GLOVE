"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { blockUser, reportUser } from "@/app/safety/actions";

const REASONS = [
  { value: "harassment", label: "욕설·괴롭힘" },
  { value: "spam", label: "스팸·광고" },
  { value: "inappropriate", label: "부적절한 콘텐츠" },
  { value: "fake", label: "허위 프로필·사칭" },
  { value: "other", label: "기타" },
] as const;

/**
 * 신고·차단 menu. `variant="icon"` renders the ⋯ button for the chat header;
 * `variant="text"` renders a small text link for profile cards. When the menu
 * is opened from a chat, pass `matchId` — blocking then also ends the chat
 * and navigates home.
 */
export function SafetyMenu({
  targetId,
  targetHandle,
  matchId,
  variant = "icon",
}: {
  targetId: string;
  targetHandle: string;
  matchId?: string;
  variant?: "icon" | "text";
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState<string>("harassment");
  const [details, setDetails] = useState("");
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function afterBlock() {
    if (matchId) router.push("/");
    router.refresh();
  }

  function handleBlock() {
    setMenuOpen(false);
    const ok = window.confirm(
      `${targetHandle}님을 차단할까요?\n서로의 프로필이 보이지 않게 되고${
        matchId ? " 이 채팅도 종료되며" : ""
      } 다시 매칭되지 않아요.`,
    );
    if (!ok) return;
    startTransition(async () => {
      const res = await blockUser(targetId, matchId);
      if (res?.error) {
        window.alert(res.error);
        return;
      }
      afterBlock();
    });
  }

  function handleReport() {
    setError(null);
    startTransition(async () => {
      const res = await reportUser({
        targetId,
        reason,
        details,
        alsoBlock,
        matchId: alsoBlock ? matchId : undefined,
      });
      if (res?.error) {
        setError(res.error);
        return;
      }
      setDone(true);
    });
  }

  function closeReport() {
    setReportOpen(false);
    if (done && alsoBlock) afterBlock();
    setDone(false);
    setDetails("");
    setAlsoBlock(false);
    setError(null);
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="신고·차단 메뉴"
        onClick={() => setMenuOpen((v) => !v)}
        className={
          variant === "icon"
            ? "rounded-full px-2 py-1 text-lg leading-none text-zinc-400 transition-colors hover:bg-black/[.05] dark:text-zinc-500 dark:hover:bg-white/[.08]"
            : "text-xs font-medium text-zinc-400 underline-offset-2 hover:underline dark:text-zinc-500"
        }
      >
        {variant === "icon" ? "⋯" : "🚨 신고·차단"}
      </button>

      {menuOpen && (
        <>
          <button
            type="button"
            aria-label="메뉴 닫기"
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute right-0 z-50 mt-1 w-40 overflow-hidden rounded-xl border border-black/[.08] bg-white shadow-lg dark:border-white/[.12] dark:bg-zinc-900">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setReportOpen(true);
              }}
              className="block w-full px-4 py-3 text-left text-sm text-zinc-700 transition-colors hover:bg-black/[.04] dark:text-zinc-200 dark:hover:bg-white/[.06]"
            >
              🚨 신고하기
            </button>
            <button
              type="button"
              onClick={handleBlock}
              disabled={pending}
              className="block w-full px-4 py-3 text-left text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              ⛔ 차단하기
            </button>
          </div>
        </>
      )}

      {reportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 dark:bg-zinc-900">
            {done ? (
              <>
                <p className="text-lg font-semibold text-zinc-900 dark:text-white">
                  🚨 신고가 접수됐어요
                </p>
                <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                  운영팀이 확인 후 조치할게요.
                  {alsoBlock && " 차단도 함께 처리됐어요."}
                </p>
                <button
                  type="button"
                  onClick={closeReport}
                  className="mt-5 w-full rounded-full bg-zinc-900 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-zinc-900"
                >
                  확인
                </button>
              </>
            ) : (
              <>
                <p className="text-lg font-semibold text-zinc-900 dark:text-white">
                  {targetHandle}님을 신고할까요?
                </p>

                <div className="mt-4 flex flex-col gap-2">
                  {REASONS.map((r) => (
                    <label
                      key={r.value}
                      className="flex cursor-pointer items-center gap-2.5 text-sm text-zinc-700 dark:text-zinc-200"
                    >
                      <input
                        type="radio"
                        name="report-reason"
                        checked={reason === r.value}
                        onChange={() => setReason(r.value)}
                        className="accent-rose-500"
                      />
                      {r.label}
                    </label>
                  ))}
                </div>

                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  maxLength={1000}
                  rows={3}
                  placeholder="자세한 내용 (선택)"
                  className="mt-4 w-full resize-none rounded-xl border border-black/[.12] bg-white px-3 py-2.5 text-sm outline-none focus:border-rose-400 dark:border-white/[.15] dark:bg-zinc-800 dark:text-zinc-100"
                />

                <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-sm text-zinc-700 dark:text-zinc-200">
                  <input
                    type="checkbox"
                    checked={alsoBlock}
                    onChange={(e) => setAlsoBlock(e.target.checked)}
                    className="accent-rose-500"
                  />
                  이 사람 차단도 같이 하기
                </label>

                {error && (
                  <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
                    {error}
                  </p>
                )}

                <div className="mt-5 flex gap-2">
                  <button
                    type="button"
                    onClick={closeReport}
                    className="flex-1 rounded-full border border-black/[.12] py-2.5 text-sm font-medium text-zinc-700 dark:border-white/[.15] dark:text-zinc-200"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={handleReport}
                    disabled={pending}
                    className="flex-1 rounded-full bg-red-500 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {pending ? "접수 중…" : "신고하기"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
