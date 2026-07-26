"use client";

import { useEffect, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { MAX_RECORD_SECONDS, modulateVoice } from "@/lib/voice";
import type { Database } from "@/lib/supabase/database.types";

type Message = Database["public"]["Tables"]["messages"]["Row"];
type Supabase = ReturnType<typeof createClient>;

/**
 * Realtime chat inside a match. Messages stream in over Supabase Realtime
 * and RLS guarantees only the two participants can read or write the thread.
 * Voice notes are pitch-shifted on-device before upload (see lib/voice.ts).
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
  const [supabase] = useState(() => createClient());
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Voice recording state
  const [recState, setRecState] = useState<"idle" | "recording" | "processing">(
    "idle",
  );
  const [recSeconds, setRecSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const cancelRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function appendMessage(m: Message) {
    setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
  }

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
    appendMessage(data);
  }

  async function startRecording() {
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("마이크 권한이 필요해요. 브라우저에서 마이크를 허용해주세요.");
      return;
    }

    const recorder = new MediaRecorder(stream);
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);

      if (cancelRef.current) {
        setRecState("idle");
        return;
      }

      setRecState("processing");
      try {
        const raw = new Blob(chunks, {
          type: recorder.mimeType || "audio/webm",
        });
        // Disguise the voice BEFORE it leaves the device.
        const modulated = await modulateVoice(raw);

        const path = `${matchId}/${crypto.randomUUID()}.wav`;
        const { error: uploadError } = await supabase.storage
          .from("voice-messages")
          .upload(path, modulated, { contentType: "audio/wav" });
        if (uploadError) throw uploadError;

        const { data, error: insertError } = await supabase
          .from("messages")
          .insert({ match_id: matchId, sender_id: myId, audio_path: path })
          .select()
          .single();
        if (insertError) throw insertError;
        appendMessage(data);
      } catch {
        setError("음성 메시지를 보내지 못했어요. 다시 시도해주세요.");
      }
      setRecState("idle");
    };

    cancelRef.current = false;
    recorderRef.current = recorder;
    setRecSeconds(0);
    timerRef.current = setInterval(() => {
      setRecSeconds((s) => {
        if (s + 1 >= MAX_RECORD_SECONDS && recorder.state === "recording") {
          recorder.stop(); // auto-send at the cap
        }
        return s + 1;
      });
    }, 1000);

    recorder.start();
    setRecState("recording");
  }

  function stopRecording(cancel: boolean) {
    cancelRef.current = cancel;
    const recorder = recorderRef.current;
    if (recorder && recorder.state === "recording") recorder.stop();
  }

  return (
    <>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {messages.length === 0 && (
          <p className="mt-10 text-center text-sm text-zinc-400 dark:text-zinc-500">
            매칭을 축하해요! 🎉
            <br />
            첫인사를 건네보세요. 🎤 버튼으로 변조된 목소리도 보낼 수 있어요.
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
                  {m.audio_path ? (
                    <VoiceBubble supabase={supabase} path={m.audio_path} />
                  ) : (
                    m.content
                  )}
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
      <div className="border-t border-black/[.06] bg-white/70 p-3 backdrop-blur dark:border-white/[.08] dark:bg-black/40">
        {error && (
          <p className="mb-2 text-center text-xs text-red-500">{error}</p>
        )}

        {recState === "recording" ? (
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 text-sm font-medium text-red-500">
              <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
              녹음 중 {recSeconds}s / {MAX_RECORD_SECONDS}s
            </span>
            <span className="flex-1 text-center text-xs text-zinc-400">
              자동으로 음성이 변조돼요
            </span>
            <button
              type="button"
              onClick={() => stopRecording(true)}
              className="rounded-full border border-black/[.1] px-4 py-2 text-sm font-medium text-zinc-500 dark:border-white/[.15]"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => stopRecording(false)}
              className="rounded-full bg-gradient-to-r from-rose-500 to-pink-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-rose-500/30"
            >
              보내기
            </button>
          </div>
        ) : recState === "processing" ? (
          <p className="py-2 text-center text-sm text-zinc-500 dark:text-zinc-400">
            🎭 음성 변조 중...
          </p>
        ) : (
          <form onSubmit={send} className="flex items-center gap-2">
            <button
              type="button"
              onClick={startRecording}
              aria-label="음성 메시지 녹음"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/[.1] text-lg transition-colors hover:border-rose-300 dark:border-white/[.15] dark:hover:border-rose-700"
            >
              🎤
            </button>
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
          </form>
        )}
      </div>
    </>
  );
}

/** Fetches a signed URL for a private voice file and renders a player. */
function VoiceBubble({ supabase, path }: { supabase: Supabase; path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.storage
      .from("voice-messages")
      .createSignedUrl(path, 3600)
      .then(({ data, error }) => {
        if (!alive) return;
        if (error || !data) setFailed(true);
        else setUrl(data.signedUrl);
      });
    return () => {
      alive = false;
    };
  }, [supabase, path]);

  if (failed) return <span>🎙️ 음성을 불러오지 못했어요</span>;
  if (!url) return <span>🎙️ 불러오는 중...</span>;
  return (
    <audio controls preload="metadata" src={url} className="h-10 w-52 max-w-full" />
  );
}
