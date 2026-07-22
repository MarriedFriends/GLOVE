"use client";

import { useEffect, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

type Message = Database["public"]["Tables"]["messages"]["Row"];

/**
 * Realtime chat inside a match. Messages stream in over Supabase Realtime
 * (the `messages` table is in the realtime publication) and RLS guarantees
 * only the two participants can read or write this thread.
 */
export function ChatRoom({
  matchId,
  myId,
  initialMessages,
}: {
  matchId: string;
  myId: string;
  initialMessages: Message[];
}) {
  // One browser client per mounted room.
  const [supabase] = useState(() => createClient());
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Live updates: append messages inserted by either side.
  useEffect(() => {
    const channel = supabase
      .channel(`match-${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          const incoming = payload.new as Message;
          setMessages((prev) =>
            prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming],
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, matchId]);

  // Keep the newest message in view.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content || sending) return;

    setSending(true);
    setError(null);
    const { data, error: insertError } = await supabase
      .from("messages")
      .insert({ match_id: matchId, sender_id: myId, content })
      .select()
      .single();
    setSending(false);

    if (insertError) {
      setError("메시지를 보내지 못했어요. 잠시 후 다시 시도해주세요.");
      return;
    }

    setText("");
    setMessages((prev) =>
      prev.some((m) => m.id === data.id) ? prev : [...prev, data],
    );
  }

  return (
    <>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {messages.length === 0 && (
          <p className="mt-10 text-center text-sm text-zinc-400 dark:text-zinc-500">
            매칭을 축하해요! 🎉
            <br />
            첫인사를 건네보세요.
          </p>
        )}
        <div className="flex flex-col gap-2">
          {messages.map((m) => {
            const mine = m.sender_id === myId;
            return (
              <div
                key={m.id}
                className={`flex items-end gap-1.5 ${mine ? "flex-row-reverse" : ""}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-6 ${
                    mine
                      ? "rounded-br-md bg-gradient-to-r from-rose-500 to-pink-500 text-white"
                      : "rounded-bl-md border border-black/[.06] bg-white text-zinc-800 dark:border-white/[.1] dark:bg-zinc-900 dark:text-zinc-200"
                  }`}
                >
                  {m.content}
                </div>
                <span
                  suppressHydrationWarning
                  className="text-[10px] text-zinc-400 dark:text-zinc-600"
                >
                  {new Date(m.created_at).toLocaleTimeString("ko-KR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            );
          })}
        </div>
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <form
        onSubmit={send}
        className="border-t border-black/[.06] bg-white/70 p-3 backdrop-blur dark:border-white/[.08] dark:bg-black/40"
      >
        {error && (
          <p className="mb-2 text-center text-xs text-red-500">{error}</p>
        )}
        <div className="flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2000}
            placeholder="메시지 보내기..."
            className="flex-1 rounded-full border border-black/[.1] bg-white px-4 py-2.5 text-sm outline-none focus:border-rose-400 dark:border-white/[.15] dark:bg-zinc-900"
          />
          <button
            disabled={!text.trim() || sending}
            className="rounded-full bg-gradient-to-r from-rose-500 to-pink-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rose-500/30 disabled:opacity-40"
          >
            전송
          </button>
        </div>
      </form>
    </>
  );
}
