"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { MAX_RECORD_SECONDS, modulateVoice } from "@/lib/voice";
import { DrawingModal } from "./DrawingModal";
import type { Database } from "@/lib/supabase/database.types";

type Message = Database["public"]["Tables"]["messages"]["Row"];
type Contact = Database["public"]["Tables"]["contact_reveals"]["Row"];
type Question = Database["public"]["Tables"]["questions"]["Row"];
type Round = Database["public"]["Tables"]["question_rounds"]["Row"];
type Supabase = ReturnType<typeof createClient>;

const STAGE_NAMES: Record<number, string> = {
  1: "아이스브레이킹",
  2: "취향과 가치관",
  3: "깊은 이야기",
};

const SILENCE_MS = 3 * 60 * 1000; // 3 minutes of quiet → next question
const CHAT_LIFETIME_MS = 48 * 3600 * 1000; // chats last 48 hours
const STALE_ROUND_MS = 10 * 60 * 1000; // unanswered 10 min → system skips it

/**
 * Realtime anonymous chat. The current question is pinned above the thread;
 * each person's FIRST message while it's active is tagged as their answer by
 * a DB trigger. When both have answered, the 다음 vote (or the silence timer)
 * brings the next question.
 */
export function ChatRoom({
  matchId,
  myId,
  userLow,
  other,
  matchCreatedAt,
  initialContacts,
  initialMessages,
  questions,
  initialRounds,
}: {
  matchId: string;
  myId: string;
  userLow: string;
  other: { handle: string; emoji: string };
  matchCreatedAt: string;
  initialContacts: Contact[];
  initialMessages: Message[];
  questions: Question[];
  initialRounds: Round[];
}) {
  const [supabase] = useState(() => createClient());
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [rounds, setRounds] = useState<Round[]>(initialRounds);
  const [text, setText] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [contactDraft, setContactDraft] = useState("");
  const [contactSending, setContactSending] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [drawOpen, setDrawOpen] = useState(false);
  const [drawSending, setDrawSending] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const expiresAtMs = +new Date(matchCreatedAt) + CHAT_LIFETIME_MS;
  const expired = now >= expiresAtMs;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Voice recording state
  const [recState, setRecState] = useState<"idle" | "recording" | "processing">(
    "idle",
  );
  const [recSeconds, setRecSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const cancelRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const questionById = useMemo(
    () => new Map(questions.map((q) => [q.id, q])),
    [questions],
  );
  const roundById = useMemo(
    () => new Map(rounds.map((r) => [r.id, r])),
    [rounds],
  );
  const activeRound = rounds.find((r) => r.status === "active");
  const usedQuestionIds = useMemo(
    () => new Set(rounds.map((r) => r.question_id)),
    [rounds],
  );
  const remainingQuestions = questions.filter(
    (q) => !usedQuestionIds.has(q.id),
  ).length;
  const latestCompleted = rounds
    .filter((r) => r.status !== "active")
    .reduce<Round | null>(
      (best, r) => (!best || r.round_no > best.round_no ? r : best),
      null,
    );
  const iAmLow = myId === userLow;

  function upsertRound(r: Round) {
    setRounds((prev) => {
      const i = prev.findIndex((x) => x.id === r.id);
      if (i === -1) return [...prev, r].sort((a, b) => a.round_no - b.round_no);
      const next = [...prev];
      next[i] = r;
      return next;
    });
  }

  async function fetchContacts() {
    const { data } = await supabase
      .from("contact_reveals")
      .select("*")
      .eq("match_id", matchId);
    if (data) setContacts(data);
  }

  async function submitContact(e: React.FormEvent) {
    e.preventDefault();
    const contact = contactDraft.trim();
    if (!contact || contactSending) return;
    setContactSending(true);
    setError(null);
    const { error: insertError } = await supabase
      .from("contact_reveals")
      .insert({ match_id: matchId, user_id: myId, contact });
    setContactSending(false);
    if (insertError) {
      setError("연락처를 공개하지 못했어요. 다시 시도해주세요.");
      return;
    }
    setContactDraft("");
    fetchContacts();
  }

  // Live updates: messages + question rounds + contact reveals.
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
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "question_rounds",
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => upsertRound(payload.new as Round),
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "question_rounds",
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => upsertRound(payload.new as Round),
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "contact_reveals",
          filter: `match_id=eq.${matchId}`,
        },
        () => fetchContacts(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, matchId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Matches created before the curriculum existed: pull the first question.
  useEffect(() => {
    if (initialRounds.length === 0 && !expired) {
      supabase.rpc("request_next_question", { p_match_id: matchId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // System pacing: 3 minutes of silence brings the next question; a question
  // nobody finished within 10 minutes gets skipped server-side.
  useEffect(() => {
    const interval = setInterval(() => {
      if (expired) return;
      const staleActive =
        activeRound &&
        Date.now() - +new Date(activeRound.created_at) >= STALE_ROUND_MS;
      if (activeRound && !staleActive) return;
      if (!activeRound && remainingQuestions === 0) return;

      const timestamps = [
        ...messages.map((m) => +new Date(m.created_at)),
        ...rounds.map((r) => +new Date(r.revealed_at ?? r.created_at)),
      ];
      const last = timestamps.length ? Math.max(...timestamps) : 0;
      if (staleActive || (last && Date.now() - last >= SILENCE_MS)) {
        supabase.rpc("request_next_question", { p_match_id: matchId });
      }
    }, 10_000);
    return () => clearInterval(interval);
  }, [supabase, matchId, activeRound, remainingQuestions, messages, rounds, expired]);

  function appendMessage(m: Message) {
    setMessages((prev) =>
      prev.some((x) => x.id === m.id) ? prev : [...prev, m],
    );
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
    // The trigger may have tagged this message as an answer / completed the
    // round — refresh the round list so the banner reflects it immediately.
    refreshRounds();
  }

  async function refreshRounds() {
    const { data: freshRounds } = await supabase
      .from("question_rounds")
      .select("*")
      .eq("match_id", matchId)
      .order("round_no");
    if (freshRounds) setRounds(freshRounds);
  }

  async function sendDrawing(blob: Blob) {
    if (drawSending) return;
    setDrawSending(true);
    setError(null);
    try {
      const path = `${matchId}/${crypto.randomUUID()}.png`;
      const { error: uploadError } = await supabase.storage
        .from("chat-images")
        .upload(path, blob, { contentType: "image/png" });
      if (uploadError) throw uploadError;
      const { data, error: insertError } = await supabase
        .from("messages")
        .insert({ match_id: matchId, sender_id: myId, image_path: path })
        .select()
        .single();
      if (insertError) throw insertError;
      appendMessage(data);
      setDrawOpen(false);
      refreshRounds();
    } catch {
      setError("그림을 보내지 못했어요. 다시 시도해주세요.");
    }
    setDrawSending(false);
  }

  async function readyForNext() {
    setError(null);
    await supabase.rpc("ready_for_next", { p_match_id: matchId });
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
        const raw = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
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
        refreshRounds();
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
          recorder.stop();
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

  // Progress gauge data.
  const stageProgress = [1, 2, 3].map((stage) => {
    const total = questions.filter((q) => q.stage === stage).length;
    const done = rounds.filter(
      (r) =>
        r.status !== "active" &&
        questionById.get(r.question_id)?.stage === stage,
    ).length;
    return { stage, total, done };
  });
  const currentStage =
    (activeRound && questionById.get(activeRound.question_id)?.stage) ??
    stageProgress.find((s) => s.done < s.total)?.stage ??
    3;

  // The partner's answers (= their messages tagged by the trigger).
  const theirAnswers = messages
    .filter((m) => m.answer_round_id && m.sender_id !== myId)
    .map((m) => {
      const r = roundById.get(m.answer_round_id!);
      return {
        message: m,
        round: r,
        question: r ? questionById.get(r.question_id) : undefined,
      };
    });

  // Banner state for the active question.
  const myAnswered = activeRound
    ? iAmLow
      ? activeRound.low_submitted
      : activeRound.high_submitted
    : false;
  const otherAnswered = activeRound
    ? iAmLow
      ? activeRound.high_submitted
      : activeRound.low_submitted
    : false;
  const myNextPressed = latestCompleted
    ? iAmLow
      ? latestCompleted.low_next
      : latestCompleted.high_next
    : false;
  const otherNextPressed = latestCompleted
    ? iAmLow
      ? latestCompleted.high_next
      : latestCompleted.low_next
    : false;

  return (
    <>
      {/* Header — tap the partner's icon/name to open their answers panel */}
      <div className="flex items-center gap-3 border-b border-black/[.06] bg-white/70 px-5 py-3 backdrop-blur dark:border-white/[.08] dark:bg-black/40">
        <Link
          href="/matches"
          className="text-sm font-medium text-zinc-500 dark:text-zinc-400"
        >
          ←
        </Link>
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className="text-2xl">{other.emoji}</span>
          <span className="min-w-0">
            <span className="block truncate font-semibold text-zinc-900 dark:text-white">
              {other.handle}
            </span>
            <span
              suppressHydrationWarning
              className={`block text-xs ${expired ? "font-semibold text-rose-500" : "text-zinc-400 dark:text-zinc-500"}`}
            >
              {expired
                ? "⏰ 48시간 채팅이 종료됐어요"
                : `⏳ 남은 시간 ${Math.floor((expiresAtMs - now) / 3600000)}시간 ${Math.floor(((expiresAtMs - now) % 3600000) / 60000)}분 · 아이콘을 누르면 상대의 답변 모음`}
            </span>
          </span>
        </button>
      </div>

      {/* Curriculum progress gauge */}
      <div className="border-b border-black/[.06] bg-white/50 px-5 py-2.5 dark:border-white/[.08] dark:bg-black/30">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="font-semibold text-rose-500">
            {currentStage}단계 · {STAGE_NAMES[currentStage]}
          </span>
          <span className="text-zinc-400 dark:text-zinc-500">
            질문 {rounds.filter((r) => r.status !== "active").length}/
            {questions.length}
          </span>
        </div>
        <div className="flex gap-1.5">
          {stageProgress.map((s) => (
            <div
              key={s.stage}
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/[.06] dark:bg-white/[.1]"
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-rose-500 to-pink-500 transition-all duration-500"
                style={{ width: `${(s.done / s.total) * 100}%` }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Pinned question banner */}
      {!expired && activeRound && (
        <div className="border-b border-rose-200/60 bg-rose-50/80 px-5 py-3 dark:border-rose-900/60 dark:bg-rose-950/30">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-rose-400">
            질문 {activeRound.round_no}
          </p>
          <p className="mt-0.5 text-sm font-bold leading-6 text-zinc-900 dark:text-white">
            Q. {questionById.get(activeRound.question_id)?.prompt}
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {!myAnswered && !otherAnswered && (
              <>
                {questionById
                  .get(activeRound.question_id)
                  ?.prompt.includes("자화상")
                  ? "🎨 입력창 옆 그리기 버튼으로 그려서 보내면 답이 돼요"
                  : "✍️ 지금 보내는 첫 메시지가 이 질문의 답이 돼요"}
              </>
            )}
            {!myAnswered && otherAnswered && (
              <>👀 상대는 답했어요 — 내 첫 메시지가 답이 돼요</>
            )}
            {myAnswered && !otherAnswered && (
              <>✓ 나는 답했어요 · ⏳ 상대의 답을 기다리는 중</>
            )}
          </p>
        </div>
      )}
      {!expired && !activeRound && latestCompleted && remainingQuestions > 0 && (
        <div className="border-b border-rose-200/60 bg-rose-50/60 px-5 py-2.5 text-center dark:border-rose-900/60 dark:bg-rose-950/20">
          {myNextPressed ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              ⏳ 상대도 &lsquo;다음&rsquo;을 누르면 새 질문이 나와요 (1/2) —
              조용해지면 자동으로도 와요
            </p>
          ) : (
            <div className="flex items-center justify-center gap-2">
              {otherNextPressed && (
                <span className="text-xs font-medium text-rose-500">
                  👀 상대가 기다려요!
                </span>
              )}
              <button
                type="button"
                onClick={readyForNext}
                className="rounded-full border border-rose-300 bg-white px-4 py-1.5 text-xs font-semibold text-rose-500 transition-colors hover:bg-rose-50 dark:border-rose-800 dark:bg-zinc-900 dark:hover:bg-rose-950/40"
              >
                다음 질문 →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {messages.length === 0 && (
          <p className="mt-10 text-center text-sm text-zinc-400 dark:text-zinc-500">
            매칭을 축하해요! 🎉
            <br />위 질문에 첫 메시지로 답하며 대화를 시작해보세요.
          </p>
        )}
        <div className="flex flex-col gap-2">
          {messages.map((m) => {
            const mine = m.sender_id === myId;
            const answerRound = m.answer_round_id
              ? roundById.get(m.answer_round_id)
              : undefined;
            return (
              <div
                key={m.id}
                className={`flex items-end gap-1.5 ${mine ? "flex-row-reverse" : ""}`}
              >
                <div className={`max-w-[75%] ${mine ? "text-right" : ""}`}>
                  {answerRound && (
                    <p
                      className={`mb-0.5 text-[10px] font-semibold text-rose-400 ${mine ? "mr-1" : "ml-1"}`}
                    >
                      💌 질문 {answerRound.round_no} 답변
                    </p>
                  )}
                  <div
                    className={`inline-block rounded-2xl px-4 py-2.5 text-left text-sm leading-6 ${
                      mine
                        ? "rounded-br-md bg-gradient-to-r from-rose-500 to-pink-500 text-white"
                        : "rounded-bl-md border border-black/[.06] bg-white text-zinc-800 dark:border-white/[.1] dark:bg-zinc-900 dark:text-zinc-200"
                    } ${answerRound ? "ring-2 ring-rose-200 dark:ring-rose-900" : ""}`}
                  >
                    {m.audio_path ? (
                      <VoiceBubble supabase={supabase} path={m.audio_path} />
                    ) : m.image_path ? (
                      <ImageBubble supabase={supabase} path={m.image_path} />
                    ) : (
                      m.content
                    )}
                  </div>
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

      {/* Composer / contact exchange */}
      <div className="border-t border-black/[.06] bg-white/70 p-3 backdrop-blur dark:border-white/[.08] dark:bg-black/40">
        {error && (
          <p className="mb-2 text-center text-xs text-red-500">{error}</p>
        )}
        {expired ? (
          (() => {
            const myContact = contacts.find((c) => c.user_id === myId);
            const theirContact = contacts.find((c) => c.user_id !== myId);
            if (myContact && theirContact) {
              return (
                <div className="rounded-2xl bg-gradient-to-r from-rose-500 to-pink-500 p-5 text-center text-white">
                  <p className="text-2xl">🎉</p>
                  <p className="mt-1 text-sm font-semibold">
                    연락처가 교환됐어요! 이제 밖에서 만나요
                  </p>
                  <p className="mt-2 rounded-xl bg-white/20 px-4 py-2.5 text-base font-bold">
                    {other.handle}: {theirContact.contact}
                  </p>
                </div>
              );
            }
            if (myContact) {
              return (
                <div className="py-2 text-center">
                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    ⏳ 상대의 공개를 기다리고 있어요
                  </p>
                  <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                    상대도 공개하면 서로의 연락처가 동시에 보여요 (내 공개:{" "}
                    {myContact.contact})
                  </p>
                </div>
              );
            }
            return (
              <form onSubmit={submitContact}>
                <p className="mb-2 text-center text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  48시간이 끝났어요 — 더 이어가고 싶다면 연락처를 공개하세요
                </p>
                <div className="flex items-center gap-2">
                  <input
                    value={contactDraft}
                    onChange={(e) => setContactDraft(e.target.value)}
                    maxLength={100}
                    placeholder="인스타 @glove_kim 또는 카톡 ID"
                    className="flex-1 rounded-full border border-black/[.1] bg-white px-4 py-2.5 text-sm outline-none focus:border-rose-400 dark:border-white/[.15] dark:bg-zinc-900"
                  />
                  <button
                    disabled={!contactDraft.trim() || contactSending}
                    className="rounded-full bg-gradient-to-r from-rose-500 to-pink-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rose-500/30 disabled:opacity-40"
                  >
                    공개
                  </button>
                </div>
                <p className="mt-1.5 text-center text-[10px] text-zinc-400 dark:text-zinc-600">
                  서로 공개해야만 상대에게 보여요 · 공개하지 않으면 그대로 안녕
                </p>
              </form>
            );
          })()
        ) : recState === "recording" ? (
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
            <button
              type="button"
              onClick={() => setDrawOpen(true)}
              aria-label="그림 그리기"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/[.1] text-lg transition-colors hover:border-rose-300 dark:border-white/[.15] dark:hover:border-rose-700"
            >
              🎨
            </button>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={2000}
              placeholder={
                activeRound && !myAnswered
                  ? "질문에 대한 내 답을 보내보세요..."
                  : "메시지 보내기..."
              }
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

      {/* Partner answers side panel (slides in from the right) */}
      <div
        className={`fixed inset-0 z-50 transition-opacity duration-200 ${
          panelOpen ? "" : "pointer-events-none opacity-0"
        }`}
      >
        <div
          className="absolute inset-0 bg-black/30"
          onClick={() => setPanelOpen(false)}
        />
        <div
          className={`absolute right-0 top-0 flex h-full w-80 max-w-[85%] transform flex-col bg-white shadow-2xl transition-transform duration-200 dark:bg-zinc-950 ${
            panelOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="border-b border-black/[.06] p-5 text-center dark:border-white/[.08]">
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              aria-label="닫기"
              className="absolute right-4 top-4 text-zinc-400"
            >
              ✕
            </button>
            <p className="text-4xl">{other.emoji}</p>
            <p className="mt-2 font-bold text-zinc-900 dark:text-white">
              {other.handle}
            </p>
            <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
              질문에 답한 내용들이에요
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {theirAnswers.length === 0 ? (
              <p className="mt-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
                아직 답변이 없어요.
                <br />
                질문에 서로 답하면 여기에 쌓여요!
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {theirAnswers.map(({ message, round, question }) => (
                  <div
                    key={message.id}
                    className="rounded-2xl border border-black/[.06] bg-rose-50/50 p-3.5 dark:border-white/[.08] dark:bg-rose-950/20"
                  >
                    <p className="text-[10px] font-semibold text-rose-400">
                      {question?.stage ?? 1}단계 · 질문 {round?.round_no ?? "?"}
                    </p>
                    <p className="mt-0.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                      Q. {question?.prompt}
                    </p>
                    <p className="mt-1.5 text-sm leading-6 text-zinc-800 dark:text-zinc-200">
                      {message.audio_path ? (
                        "🎙️ 음성으로 답했어요"
                      ) : message.image_path ? (
                        <ImageBubble supabase={supabase} path={message.image_path} />
                      ) : (
                        message.content
                      )}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {drawOpen && !expired && (
        <DrawingModal
          sending={drawSending}
          onClose={() => setDrawOpen(false)}
          onSend={sendDrawing}
        />
      )}
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


/** Fetches a signed URL for a private drawing and renders it. */
function ImageBubble({ supabase, path }: { supabase: Supabase; path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.storage
      .from("chat-images")
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

  if (failed) return <span>🎨 그림을 불러오지 못했어요</span>;
  if (!url) return <span>🎨 불러오는 중...</span>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt="그림 메시지"
      className="h-44 w-44 max-w-full rounded-lg bg-white object-contain"
    />
  );
}
