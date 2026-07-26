"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

type Message = Database["public"]["Tables"]["messages"]["Row"];

/**
 * Global new-message alerts for the user's active chat. Mounted in the root
 * layout so it works on every page:
 * - tab in background → browser (OS) notification
 * - app visible but on another page → in-app toast, tap to open the chat
 * - already reading the chat → nothing
 */
export function MessageNotifier({
  userId,
  matchId,
  partnerHandle,
}: {
  userId: string;
  matchId: string;
  partnerHandle: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [toast, setToast] = useState<string | null>(null);

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

  // Auto-dismiss the toast.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const channel = supabase
      .channel(`notify-${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          const m = payload.new as Message;
          if (m.sender_id === userId) return;

          const visible = document.visibilityState === "visible";
          const onChatPage = pathname === `/chat/${matchId}`;
          if (onChatPage && visible) return; // already reading it

          const body =
            m.content ?? (m.image_path ? "🎨 그림 메시지" : "🎙️ 음성 메시지");

          if (
            !visible &&
            typeof Notification !== "undefined" &&
            Notification.permission === "granted"
          ) {
            const n = new Notification(`💬 ${partnerHandle}`, {
              body,
              tag: matchId, // collapse multiple into one
            });
            n.onclick = () => {
              window.focus();
              router.push(`/chat/${matchId}`);
            };
          } else {
            setToast(body);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, matchId, userId, pathname, partnerHandle, router]);

  if (!toast) return null;

  return (
    <button
      type="button"
      onClick={() => {
        setToast(null);
        router.push(`/chat/${matchId}`);
      }}
      className="fixed left-1/2 top-4 z-[60] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center gap-3 rounded-2xl border border-rose-200 bg-white/95 p-3.5 text-left shadow-xl shadow-rose-500/10 backdrop-blur transition-transform hover:scale-[1.02] dark:border-rose-900 dark:bg-zinc-900/95"
    >
      <span className="text-2xl">💬</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-zinc-900 dark:text-white">
          {partnerHandle}
        </span>
        <span className="block truncate text-sm text-zinc-600 dark:text-zinc-300">
          {toast}
        </span>
      </span>
      <span className="text-xs font-semibold text-rose-500">열기 →</span>
    </button>
  );
}
