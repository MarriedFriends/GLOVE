"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

type Match = Database["public"]["Tables"]["matches"]["Row"];

/**
 * The app's daily heartbeat happens at 12:00 noon KST: new daily picks AND
 * the like-acceptance announcement (which starts chats). This component,
 * mounted globally for logged-in users, fires an alert for each:
 * - noon passes → "오늘의 추천 도착" (once per day, localStorage-guarded),
 *   and triggers the settlement RPC so matches appear without a reload
 * - a match involving me is created → "매칭 성사, 채팅 시작!" via Realtime
 */
export function NoonNotifier({ userId }: { userId: string }) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [toast, setToast] = useState<{
    title: string;
    body: string;
    href: string;
  } | null>(null);

  // Ask for notification permission once, shortly after load.
  useEffect(() => {
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "default"
    ) {
      const t = setTimeout(() => {
        Notification.requestPermission().catch(() => {});
      }, 3000);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(t);
  }, [toast]);

  const notify = useCallback(
    (title: string, body: string, href: string) => {
      if (
        document.visibilityState !== "visible" &&
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        const n = new Notification(title, { body, tag: href });
        n.onclick = () => {
          window.focus();
          router.push(href);
        };
      } else {
        setToast({ title, body, href });
      }
    },
    [router],
  );

  // The "noon day" key: flips exactly at 12:00 KST.
  const noonKey = () => {
    const kstMinusNoon = new Date(Date.now() + 9 * 3600 * 1000 - 12 * 3600 * 1000);
    return kstMinusNoon.toISOString().slice(0, 10);
  };

  // Watch for the noon flip (also fires on first open after noon).
  useEffect(() => {
    const check = () => {
      const key = noonKey();
      if (localStorage.getItem("glove-noon-key") === key) return;
      localStorage.setItem("glove-noon-key", key);
      // Settle pending mutual likes right away so 매칭 성사 alerts fire live.
      supabase.rpc("process_pending_matches");
      notify(
        "💘 오늘의 추천 도착!",
        "낮 12시의 새로운 3명을 확인해보세요",
        "/discover",
      );
    };
    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, [supabase, notify]);

  // 매칭 성사 (chat start) — matches INSERT arrives via Realtime; RLS ensures
  // we only receive matches we participate in, but double-check anyway.
  useEffect(() => {
    const channel = supabase
      .channel(`match-alerts-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "matches" },
        (payload) => {
          const m = payload.new as Match;
          if (m.user_low !== userId && m.user_high !== userId) return;
          notify(
            "🎉 매칭 성사!",
            "낮 12시 발표 — 48시간 익명 채팅이 시작됐어요",
            `/chat/${m.id}`,
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId, notify]);

  if (!toast) return null;

  return (
    <button
      type="button"
      onClick={() => {
        const href = toast.href;
        setToast(null);
        router.push(href);
      }}
      className="fixed left-1/2 top-4 z-[60] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center gap-3 rounded-2xl border border-rose-200 bg-white/95 p-3.5 text-left shadow-xl shadow-rose-500/10 backdrop-blur transition-transform hover:scale-[1.02] dark:border-rose-900 dark:bg-zinc-900/95"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-zinc-900 dark:text-white">
          {toast.title}
        </span>
        <span className="block truncate text-sm text-zinc-600 dark:text-zinc-300">
          {toast.body}
        </span>
      </span>
      <span className="shrink-0 text-xs font-semibold text-rose-500">
        열기 →
      </span>
    </button>
  );
}
