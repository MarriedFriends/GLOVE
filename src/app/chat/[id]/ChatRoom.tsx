"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { MAX_RECORD_SECONDS, modulateVoice } from "@/lib/voice";
import type { Database } from "@/lib/supabase/database.types";

type Message = Database["public"]["Tables"]["messages"]["Row"];
type Question = Database["public"]["Tables"]["questions"]["Row"];
type Round = Database["public"]["Tables"]["question_rounds"]["Row"];
type Answer = Database["public"]["Tables"]["question_answers"]["Row"];
type Supabase = ReturnType<typeof createClient>;

const STAGE_NAMES: Record<number, string> = {
  1: "아이스브레이킹",
  2: "취향과 가치관",
  3: "깊은 이야기",
};

const SILENCE_MS = 3 * 60 * 1000; // 3 minutes of quiet → next question
const STALE_ROUND_MS = 10 * 60 * 1000; // unanswered 10 min → system skips it

/**
 * Realtime chat inside a match, with the staged question curriculum.
 * Answers stay hidden (RLS) until both sides submit; the reveal arrives as a
 * question_rounds UPDATE over Realtime, so both screens flip simultaneously.
 */
export function ChatRoom({
  matchId,
  myId,
  userLow,
  other,
  initialMessages,
  questions,
  initialRounds,
  initialAnswers,
}: {
  matchId: string;
  myId: string;
  userLow: string;
  other: { handle: string; emoji: string };
  initialMessages: Message[];
  questions: Question[];
  initialRounds: Round[];
  initialAnswers: Answer[];
}) {
  const [supabase] = useState(() => createClient());
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [rounds, setRounds] = useState<Round[]>(initialRounds);
  const [answers, setAnswers] = useState<Record<string, Answer[]>>(() => {
    const byRound: Record<string, Answer[]> = {};
    for (const a of initialAnswers) (byRound[a.round_id] ??= []).push(a);
    return byRound;
  });
  const [text, setText] = useState("");
  const [draft, setDraft] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [answerSending, setAnswerSending] = useState(false);
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

  const questionById = useMemo(
    () => new Map(questions.map((q) => [q.id, q])),
    [questions],
  );
  const activeRound = rounds.find((r) => r.status === "active");
  const usedQuestionIds = useMemo(
    () => new Set(rounds.map((r) => r.question_id)),
    [rounds],
  );
  const remainingQuestions = questions.filter(
    (q) => !usedQuestionIds.has(q.id),
  ).length;

  function upsertRound(r: Round) {
    setRounds((prev) => {
      const i = prev.findIndex((x) => x.id === r.id);
      if (i === -1) return [...prev, r].sort((a, b) => a.round_no - b.round_no);
      const next = [...prev];
      next[i] = r;
      return next;
    });
  }

  async function fetchAnswers(roundId: string) {
    const { data } = await supabase
      .from("question_answers")
      .select("*")
      .eq("round_id", roundId);
    if (data) setAnswers((prev) => ({ ...prev, [roundId]: data }));
  }

  // Live updates: messages + question rounds.
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
        (payload) => {
          const r = payload.new as Round;
          upsertRound(r);
          if (r.status === "revealed") fetchAnswers(r.id); // 동시 공개
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, matchId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, rounds]);

  // Old matches created before the curriculum: pull the first question once.
  useEffect(() => {
    if (initialRounds.length === 0) {
      supabase.rpc("request_next_question", { p_match_id: matchId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The system advances the curriculum by itself: after 3 minutes of chat
  // silence the next question appears; a question nobody completed within
  // 10 minutes is skipped server-side. No user controls involved.
  useEffect(() => {
    const interval = setInterval(() => {
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
  }, [supabase, matchId, activeRound, remainingQuestions, messages, rounds]);

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
  }

  async function submitAnswer(round: Round) {
    const answer = draft.trim();
    if (!answer || answerSending) return;
    setAnswerSending(true);
    setError(null);
    const { data, error: insertError } = await supabase
      .from("question_answers")
      .insert({ round_id: round.id, user_id: myId, answer })
      .select()
      .single();
    setAnswerSending(false);
    if (insertError) {
      setError("답변을 제출하지 못했어요. 다시 시도해주세요.");
      return;
    }
    setDraft("");
    setAnswers((prev) => ({
      ...prev,
      [round.id]: [...(prev[round.id] ?? []), data],
    }));
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

  // Merge messages and question cards into one timeline by time.
  const timeline = useMemo(() => {
    const items: { at: number; el: "message" | "round"; key: string; m?: Message; r?: Round }[] = [
      ...messages.map((m) => ({
        at: +new Date(m.created_at),
        el: "message" as const,
        key: `m-${m.id}`,
        m,
      })),
      ...rounds.map((r) => ({
        at: +new Date(r.created_at),
        el: "round" as const,
        key: `r-${r.id}`,
        r,
      })),
    ];
    return items.sort((a, b) => a.at - b.at);
  }, [messages, rounds]);

  // Progress gauge: per-stage completion.
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

  // The newest completed round is where the "다음" vote lives.
  const latestCompleted = rounds
    .filter((r) => r.status !== "active")
    .reduce<Round | null>(
      (best, r) => (!best || r.round_no > best.round_no ? r : best),
      null,
    );

  // Revealed answers by the other person, for the profile side panel.
  const theirRevealedAnswers = rounds
    .filter((r) => r.status === "revealed")
    .map((r) => ({
      round: r,
      question: questionById.get(r.question_id),
      answer: (answers[r.id] ?? []).find((a) => a.user_id !== myId),
    }))
    .filter((x) => x.answer);

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
            <span className="block text-xs text-zinc-400 dark:text-zinc-500">
              아이콘을 누르면 상대의 답변 모음을 볼 수 있어요
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

      {/* Timeline: messages + question cards */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {timeline.length === 0 && (
          <p className="mt-10 text-center text-sm text-zinc-400 dark:text-zinc-500">
            매칭을 축하해요! 🎉 곧 첫 질문이 도착해요.
          </p>
        )}
        <div className="flex flex-col gap-3">
          {timeline.map((item) =>
            item.el === "message" && item.m ? (
              <MessageBubble
                key={item.key}
                m={item.m}
                mine={item.m.sender_id === myId}
                supabase={supabase}
              />
            ) : item.r ? (
              <QuestionCard
                key={item.key}
                round={item.r}
                question={questionById.get(item.r.question_id)}
                answers={answers[item.r.id] ?? []}
                myId={myId}
                userLow={userLow}
                draft={draft}
                setDraft={setDraft}
                submitting={answerSending}
                onSubmit={() => submitAnswer(item.r!)}
                showNextVote={
                  !activeRound &&
                  remainingQuestions > 0 &&
                  item.r.id === latestCompleted?.id
                }
                onReadyNext={readyForNext}
              />
            ) : null,
          )}
        </div>

        {!activeRound && remainingQuestions > 0 && timeline.length > 0 && (
          <p className="mt-4 text-center text-[10px] text-zinc-400 dark:text-zinc-600">
            둘 다 &lsquo;다음 질문&rsquo;을 누르거나 잠시 조용해지면 다음 질문이
            도착해요 💌
          </p>
        )}
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
            {theirRevealedAnswers.length === 0 ? (
              <p className="mt-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
                아직 공개된 답변이 없어요.
                <br />
                질문에 서로 답하면 여기에 쌓여요!
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {theirRevealedAnswers.map(({ round, question, answer }) => (
                  <div
                    key={round.id}
                    className="rounded-2xl border border-black/[.06] bg-rose-50/50 p-3.5 dark:border-white/[.08] dark:bg-rose-950/20"
                  >
                    <p className="text-[10px] font-semibold text-rose-400">
                      {question?.stage ?? 1}단계 · 질문 {round.round_no}
                    </p>
                    <p className="mt-0.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                      Q. {question?.prompt}
                    </p>
                    <p className="mt-1.5 text-sm leading-6 text-zinc-800 dark:text-zinc-200">
                      {answer?.answer}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function MessageBubble({
  m,
  mine,
  supabase,
}: {
  m: Message;
  mine: boolean;
  supabase: Supabase;
}) {
  return (
    <div className={`flex items-end gap-1.5 ${mine ? "flex-row-reverse" : ""}`}>
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
}

/** The system question card, in all of its states. */
function QuestionCard({
  round,
  question,
  answers,
  myId,
  userLow,
  draft,
  setDraft,
  submitting,
  onSubmit,
  showNextVote,
  onReadyNext,
}: {
  round: Round;
  question: Question | undefined;
  answers: Answer[];
  myId: string;
  userLow: string;
  draft: string;
  setDraft: (v: string) => void;
  submitting: boolean;
  onSubmit: () => void;
  showNextVote: boolean;
  onReadyNext: () => void;
}) {
  const myAnswer = answers.find((a) => a.user_id === myId);
  const theirAnswer = answers.find((a) => a.user_id !== myId);
  const iAmLow = myId === userLow;
  const otherSubmitted = iAmLow ? round.high_submitted : round.low_submitted;
  const myNextPressed = iAmLow ? round.low_next : round.high_next;
  const otherNextPressed = iAmLow ? round.high_next : round.low_next;
  const stage = question?.stage ?? 1;

  const nextVote = showNextVote && (
    <div className="mt-3">
      {myNextPressed ? (
        <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
          ⏳ 상대도 &lsquo;다음&rsquo;을 누르면 새 질문이 도착해요 (1/2)
        </p>
      ) : (
        <>
          {otherNextPressed && (
            <p className="mb-1.5 text-center text-xs font-medium text-rose-500">
              👀 상대가 다음 질문을 기다리고 있어요!
            </p>
          )}
          <button
            type="button"
            onClick={onReadyNext}
            className="w-full rounded-full border border-rose-200 bg-white py-2 text-xs font-semibold text-rose-500 transition-colors hover:bg-rose-50 dark:border-rose-900 dark:bg-zinc-900 dark:hover:bg-rose-950/40"
          >
            다음 질문 →
          </button>
        </>
      )}
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-sm rounded-2xl border-2 border-rose-200 bg-rose-50/80 p-4 dark:border-rose-900 dark:bg-rose-950/30">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-rose-400">
        {stage}단계 질문 {round.round_no}
      </p>
      <p className="mt-1 text-sm font-bold leading-6 text-zinc-900 dark:text-white">
        Q. {question?.prompt ?? "질문"}
      </p>

      {round.status === "passed" ? (
        <>
          <p className="mt-3 rounded-xl bg-black/[.04] px-3 py-2 text-xs text-zinc-500 dark:bg-white/[.06] dark:text-zinc-400">
            {round.passed_by
              ? `🙅 ${round.passed_by === myId ? "내가" : "상대가"} 이 질문을 패스했어요`
              : "⏰ 답변 없이 지나간 질문이에요"}
          </p>
          {nextVote}
        </>
      ) : round.status === "revealed" ? (
        <div className="mt-3 flex flex-col gap-2">
          <p className="text-center text-[11px] font-semibold text-rose-500">
            ✨ 두 답변이 동시에 공개됐어요!
          </p>
          <div className="rounded-xl bg-white px-3 py-2.5 text-sm dark:bg-zinc-900">
            <p className="mb-0.5 text-[10px] font-semibold text-zinc-400">
              상대의 답
            </p>
            {theirAnswer?.answer ?? "..."}
          </div>
          <div className="rounded-xl bg-white px-3 py-2.5 text-sm dark:bg-zinc-900">
            <p className="mb-0.5 text-[10px] font-semibold text-rose-400">
              나의 답
            </p>
            {myAnswer?.answer ?? "..."}
          </div>
          {nextVote}
        </div>
      ) : myAnswer ? (
        <div className="mt-3">
          <div className="rounded-xl bg-white px-3 py-2.5 text-sm dark:bg-zinc-900">
            <p className="mb-0.5 text-[10px] font-semibold text-rose-400">
              나의 답 (제출됨)
            </p>
            {myAnswer.answer}
          </div>
          <p className="mt-2 text-center text-xs text-zinc-500 dark:text-zinc-400">
            ⏳ 상대가 아직 작성 중이에요 — 둘 다 제출하면 동시에 공개돼요
          </p>
        </div>
      ) : (
        <div className="mt-3">
          {otherSubmitted && (
            <p className="mb-2 text-center text-xs font-medium text-rose-500">
              👀 상대는 이미 답을 보냈어요!
            </p>
          )}
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="내 답변 (상대가 제출하기 전엔 안 보여요)"
            className="w-full resize-none rounded-xl border border-black/[.08] bg-white p-3 text-sm outline-none focus:border-rose-400 dark:border-white/[.12] dark:bg-zinc-900"
          />
          <button
            type="button"
            onClick={onSubmit}
            disabled={!draft.trim() || submitting}
            className="mt-2 w-full rounded-full bg-gradient-to-r from-rose-500 to-pink-500 py-2 text-xs font-semibold text-white shadow shadow-rose-500/30 disabled:opacity-40"
          >
            제출하기
          </button>
        </div>
      )}
    </div>
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
