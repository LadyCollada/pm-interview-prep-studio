"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { questions } from "@/data/questions";
import {
  clearActiveAttempt,
  readActiveAttempt,
  readAttempts,
  saveActiveAttempt,
  saveAttempt,
  type ActiveAttempt,
  type Attempt,
  type CompletionStatus,
} from "@/lib/attempts";

const LIMITS = [120, 300, 600] as const;
const CATEGORIES = ["All", "Design", "Improvement", "Metrics", "Execution", "Leadership", "Strategy"] as const;
type Limit = (typeof LIMITS)[number];
type View = "practice" | "bank" | "history";
type Phase = "ready" | "running" | "result";

function formatTime(totalSeconds: number) {
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function Home() {
  const [view, setView] = useState<View>("practice");
  const [phase, setPhase] = useState<Phase>("ready");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("All");
  const [limit, setLimit] = useState<Limit>(300);
  const [elapsed, setElapsed] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [lastAttempt, setLastAttempt] = useState<Attempt | null>(null);
  const activeRef = useRef<ActiveAttempt | null>(null);
  const question = questions[questionIndex];

  const filteredQuestions = useMemo(
    () => category === "All" ? questions : questions.filter((item) => item.category === category),
    [category],
  );

  useEffect(() => {
    const storedAttempts = readAttempts();
    const interrupted = readActiveAttempt();
    let initialAttempts = storedAttempts;
    if (interrupted) {
      const abandoned: Attempt = {
        ...interrupted,
        ended_at: new Date().toISOString(),
        time_elapsed_seconds: interrupted.last_elapsed_seconds,
        completion_status: "abandoned",
      };
      saveAttempt(abandoned);
      initialAttempts = [abandoned, ...storedAttempts];
    }
    const hydrationUpdate = window.setTimeout(() => setAttempts(initialAttempts), 0);
    return () => window.clearTimeout(hydrationUpdate);
  }, []);

  useEffect(() => {
    if (phase !== "running" || startedAt === null) return;
    const update = () => {
      const nextElapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
      setElapsed(nextElapsed);
      if (activeRef.current && nextElapsed !== activeRef.current.last_elapsed_seconds) {
        activeRef.current = { ...activeRef.current, last_elapsed_seconds: nextElapsed };
        saveActiveAttempt(activeRef.current);
      }
    };
    update();
    const interval = window.setInterval(update, 250);
    return () => window.clearInterval(interval);
  }, [phase, startedAt]);

  const start = () => {
    const now = Date.now();
    const active: ActiveAttempt = {
      id: makeId(),
      question_id: question.id,
      question_prompt: question.prompt,
      category: question.category,
      started_at: new Date(now).toISOString(),
      time_limit_seconds: limit,
      last_elapsed_seconds: 0,
    };
    activeRef.current = active;
    saveActiveAttempt(active);
    setStartedAt(now);
    setElapsed(0);
    setLastAttempt(null);
    setPhase("running");
  };

  const finish = (requestedStatus: "done" | "abandoned") => {
    if (!activeRef.current || startedAt === null) return;
    const finalElapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    const status: CompletionStatus = requestedStatus === "abandoned"
      ? "abandoned"
      : finalElapsed >= limit ? "timed_out" : "completed";
    const attempt: Attempt = {
      ...activeRef.current,
      ended_at: new Date().toISOString(),
      time_elapsed_seconds: finalElapsed,
      completion_status: status,
    };
    saveAttempt(attempt);
    activeRef.current = null;
    setElapsed(finalElapsed);
    setAttempts((current) => [attempt, ...current]);
    setLastAttempt(attempt);
    setPhase("result");
  };

  const selectQuestion = (index: number) => {
    if (phase === "running") return;
    clearActiveAttempt();
    activeRef.current = null;
    setQuestionIndex(index);
    setElapsed(0);
    setLastAttempt(null);
    setPhase("ready");
    setView("practice");
  };

  const nextQuestion = () => selectQuestion((questionIndex + 37) % questions.length);
  const progress = Math.min(100, (elapsed / limit) * 100);
  const isOverTarget = elapsed >= limit;
  const averageSeconds = attempts.length
    ? Math.round(attempts.reduce((total, attempt) => total + attempt.time_elapsed_seconds, 0) / attempts.length)
    : 0;

  return (
    <main className="min-h-screen bg-[#07191e] text-[#f1f8f4]">
      <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8 sm:py-9">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#244149] pb-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8aaba6]">PM Interview Prep Studio</p>
            <h1 className="mt-1 text-xl font-semibold">Build the answer. Build the instinct.</h1>
          </div>
          <nav className="flex gap-2" aria-label="Studio navigation">
            {(["practice", "bank", "history"] as View[]).map((item) => (
              <button
                key={item}
                onClick={() => setView(item)}
                disabled={phase === "running" && item !== "practice"}
                className={`rounded-full px-4 py-2 text-sm font-semibold capitalize transition disabled:cursor-not-allowed disabled:opacity-35 ${view === item ? "bg-[#d8ff72] text-[#0b252a]" : "border border-[#36565e] hover:border-[#79969c]"}`}
              >
                {item === "history" ? `History · ${attempts.length}` : item}
              </button>
            ))}
          </nav>
        </header>

        {view === "practice" && (
          <section className="mx-auto max-w-4xl py-10 sm:py-16">
            <div className={`overflow-hidden rounded-[2rem] bg-[#f4f8f1] text-[#102e33] shadow-[0_32px_90px_rgba(0,0,0,0.32)] ${isOverTarget && phase === "running" ? "ring-4 ring-[#e9774e]/25" : ""}`}>
              <div className="h-2 bg-[#d9e2dc]" aria-label={`${Math.round(progress)} percent of target time elapsed`}>
                <div className={`h-full transition-[width,background-color] duration-300 ${isOverTarget ? "bg-[#e9774e]" : "bg-[#7c50ff]"}`} style={{ width: `${progress}%` }} />
              </div>
              <div className="p-7 sm:p-12">
                <div className="flex items-start justify-between gap-6">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#5e7774]">{question.category} · prompt {question.number}</p>
                  {phase === "running" && (
                    <div className="text-right">
                      <p className={`font-mono text-3xl font-semibold tabular-nums sm:text-4xl ${isOverTarget ? "text-[#c54f2c]" : "text-[#173f45]"}`}>{formatTime(elapsed)}</p>
                      <p className={`mt-1 text-xs font-bold ${isOverTarget ? "text-[#c54f2c]" : "text-[#718783]"}`}>
                        {isOverTarget ? `${formatTime(elapsed - limit)} over target` : `${formatTime(limit)} target`}
                      </p>
                    </div>
                  )}
                </div>
                <h2 className="mt-7 max-w-3xl text-3xl font-semibold leading-tight sm:text-5xl">{question.prompt}</h2>

                {phase === "ready" && (
                  <div className="mt-10 border-t border-[#cbd8d1] pt-7">
                    <p className="text-sm font-bold">Set a target time</p>
                    <p className="mt-1 text-sm text-[#647a77]">The stopwatch keeps running after the target.</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {LIMITS.map((seconds) => (
                        <button key={seconds} onClick={() => setLimit(seconds)} className={`rounded-xl px-5 py-3 text-sm font-bold transition ${limit === seconds ? "bg-[#173f45] text-white" : "border border-[#8da29d] hover:border-[#173f45]"}`}>
                          {seconds / 60} min
                        </button>
                      ))}
                    </div>
                    <div className="mt-7 flex flex-wrap gap-3">
                      <button onClick={start} className="rounded-xl bg-[#7c50ff] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-[#7c50ff]/20 transition hover:-translate-y-0.5">Start stopwatch</button>
                      <button onClick={nextQuestion} className="rounded-xl border border-[#8da29d] px-5 py-3 text-sm font-bold hover:border-[#173f45]">Another question</button>
                    </div>
                  </div>
                )}

                {phase === "running" && (
                  <div className="mt-10 flex flex-wrap gap-3 border-t border-[#cbd8d1] pt-7">
                    <button onClick={() => finish("done")} className="rounded-xl bg-[#173f45] px-6 py-3 text-sm font-bold text-white">I’m done</button>
                    <button onClick={() => finish("abandoned")} className="rounded-xl px-5 py-3 text-sm font-bold text-[#7a5144] hover:bg-[#f3e7e1]">Abandon attempt</button>
                  </div>
                )}

                {phase === "result" && lastAttempt && (
                  <div className="mt-10 border-t border-[#cbd8d1] pt-7">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#627a76]">Attempt logged · {lastAttempt.completion_status.replace("_", " ")}</p>
                    <p className="mt-2 text-3xl font-semibold">{formatTime(lastAttempt.time_elapsed_seconds)}</p>
                    <p className="mt-1 text-sm text-[#647a77]">Target: {formatTime(lastAttempt.time_limit_seconds)} · Elapsed time preserved in full</p>
                    <div className="mt-6 flex flex-wrap gap-3">
                      <button onClick={nextQuestion} className="rounded-xl bg-[#7c50ff] px-6 py-3 text-sm font-bold text-white">Next question</button>
                      <button onClick={() => selectQuestion(questionIndex)} className="rounded-xl border border-[#8da29d] px-5 py-3 text-sm font-bold">Redo this question</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <p className="mt-5 text-center text-sm text-[#8eaca7]">Answer out loud. The target guides you; it does not cut you off.</p>
          </section>
        )}

        {view === "bank" && (
          <section className="py-9">
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((item) => (
                <button key={item} onClick={() => setCategory(item)} className={`rounded-full px-4 py-2 text-sm font-semibold ${category === item ? "bg-[#d8ff72] text-[#0b252a]" : "border border-[#36565e]"}`}>{item}</button>
              ))}
            </div>
            <p className="mt-6 text-sm text-[#94b0ac]">{filteredQuestions.length} questions</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {filteredQuestions.map((item) => (
                <button key={item.id} onClick={() => selectQuestion(item.number - 1)} className="rounded-2xl border border-[#294950] bg-[#102b31] p-5 text-left text-base leading-relaxed transition hover:-translate-y-0.5 hover:border-[#d8ff72]">
                  <span className="mr-2 text-sm font-bold text-[#d8ff72]">{item.number}.</span>{item.prompt}
                </button>
              ))}
            </div>
          </section>
        )}

        {view === "history" && (
          <section className="py-10 sm:py-14">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8eaca7]">Practice history</p>
            <h2 className="mt-2 text-4xl font-semibold">The reps, with the time intact.</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <Metric label="Attempts" value={String(attempts.length)} />
              <Metric label="Average elapsed" value={formatTime(averageSeconds)} />
              <Metric label="Over target" value={String(attempts.filter((attempt) => attempt.completion_status === "timed_out").length)} />
            </div>
            <div className="mt-6 overflow-hidden rounded-3xl border border-[#294950] bg-[#102b31]">
              {attempts.length === 0 ? <p className="p-8 text-[#9bb5b1]">Finish a timed answer and it will appear here.</p> : attempts.slice(0, 20).map((attempt) => (
                <div key={attempt.id} className="grid gap-3 border-b border-[#294950] p-5 last:border-b-0 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                  <div>
                    <p className="font-semibold">{attempt.question_prompt}</p>
                    <p className="mt-1 text-sm text-[#91ada8]">{attempt.category} · {new Date(attempt.started_at).toLocaleDateString()}</p>
                  </div>
                  <p className="font-mono text-lg font-semibold tabular-nums">{formatTime(attempt.time_elapsed_seconds)}</p>
                  <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${attempt.completion_status === "timed_out" ? "bg-[#e9774e]/20 text-[#ffae91]" : attempt.completion_status === "abandoned" ? "bg-white/10 text-[#b8c8c5]" : "bg-[#d8ff72]/15 text-[#d8ff72]"}`}>{attempt.completion_status.replace("_", " ")}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-3xl border border-[#294950] bg-[#102b31] p-6"><p className="text-sm text-[#9bb5b1]">{label}</p><p className="mt-2 text-3xl font-semibold text-[#d8ff72]">{value}</p></div>;
}
