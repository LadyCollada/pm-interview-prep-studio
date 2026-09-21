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
import { deriveDailyStats } from "@/lib/stats";

const LIMITS = [120, 300, 600, 1200, 1800] as const;
const CATEGORIES = ["All", "Design", "Improvement", "Metrics", "Execution", "Leadership", "Strategy"] as const;
type Limit = (typeof LIMITS)[number];
type View = "practice" | "bank" | "today" | "history";
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
  const todayStats = useMemo(() => deriveDailyStats(attempts), [attempts]);

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
  const statusLabel = (status: CompletionStatus) => status === "abandoned"
    ? "ball drained"
    : status === "timed_out" ? "bonus time" : "stage clear";

  return (
    <main className="arcade-shell min-h-screen text-[#f7f7ff]">
      <div className="relative z-10 mx-auto max-w-6xl px-5 py-6 sm:px-8 sm:py-8">
        <header className="cabinet-header flex flex-wrap items-center justify-between gap-5 pb-5">
          <div className="brand-lockup">
            <p className="arcade-kicker">PM INTERVIEW PREP</p>
            <h1 className="arcade-logo">STUDIO</h1>
            <p className="mt-2 text-sm text-[#aeb2c8]">Build the answer. Build the instinct.</p>
          </div>
          <nav className="arcade-nav flex flex-wrap gap-2" aria-label="Studio navigation">
            {(["practice", "bank", "today", "history"] as View[]).map((item) => (
              <button
                key={item}
                onClick={() => setView(item)}
                disabled={phase === "running" && item !== "practice"}
                className={`arcade-tab ${view === item ? "is-active" : ""}`}
              >
                {item === "practice" ? "PLAY" : item === "bank" ? "SELECT" : item === "today" ? "TODAY" : `SCORES ${attempts.length}`}
              </button>
            ))}
          </nav>
        </header>

        {view === "practice" && (
          <section className="mx-auto max-w-5xl py-8 sm:py-12">
            <div className="status-strip" aria-hidden="true">
              <span>PLAYER 1</span><span>CHALLENGE {String(question.number).padStart(3, "0")}</span><span>HI-SCORE {String(attempts.length).padStart(5, "0")}</span>
            </div>
            <div key={question.id} className={`stage-card ${isOverTarget && phase === "running" ? "is-overtime" : ""}`}>
              <div className="crt-scanlines" aria-hidden="true" />
              <div className="charge-shell">
                <div className="charge-labels"><span>TIME CHARGE</span><span>{Math.round(progress)}%</span></div>
                <div className="charge-meter" role="progressbar" aria-label="Target time elapsed" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
                  <div className={`charge-fill ${isOverTarget ? "is-maxed" : ""}`} style={{ width: `${progress}%` }} />
                </div>
              </div>
              <div className="relative p-6 sm:p-10 lg:p-12">
                <div className="flex flex-wrap items-start justify-between gap-6">
                  <div>
                    <p className="arcade-kicker text-[#31f7ff]">{question.category} / STAGE {String(question.number).padStart(2, "0")}</p>
                    {phase === "ready" && <p className="ready-prompt mt-4">READY?</p>}
                  </div>
                  {phase === "running" && (
                    <div className={`timer-console ${isOverTarget ? "is-overtime" : ""}`}>
                      <p className="timer-label">{isOverTarget ? "OVERTIME" : "ELAPSED"}</p>
                      <SegmentedTimer seconds={elapsed} />
                      <p className="timer-target">
                        {isOverTarget ? `+${formatTime(elapsed - limit)} PAST TARGET` : `TARGET ${formatTime(limit)}`}
                      </p>
                    </div>
                  )}
                </div>
                <h2 className="challenge-copy mt-7 max-w-4xl text-3xl font-bold leading-[1.12] sm:text-5xl">{question.prompt}</h2>

                {phase === "ready" && (
                  <div className="control-deck mt-10 pt-7">
                    <p className="arcade-kicker text-[#ff4fd8]">SELECT TARGET</p>
                    <p className="mt-3 text-sm text-[#bec2d5]">Choose a quick prompt or a full case-style answer. The stopwatch keeps running after the target—no hard cutoff.</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {LIMITS.map((seconds) => (
                        <button key={seconds} onClick={() => setLimit(seconds)} className={`target-chip ${limit === seconds ? "is-selected" : ""}`}>
                          {seconds / 60}:00
                        </button>
                      ))}
                    </div>
                    <div className="mt-7 flex flex-wrap gap-3">
                      <button onClick={start} className="arcade-button arcade-button-primary">INSERT COIN / START</button>
                      <button onClick={nextQuestion} className="arcade-button arcade-button-ghost">CHANGE CHALLENGE</button>
                    </div>
                  </div>
                )}

                {phase === "running" && (
                  <div className="control-deck mt-10 flex flex-wrap gap-3 pt-7">
                    <button onClick={() => finish("done")} className="arcade-button arcade-button-primary">LOCK IN ANSWER</button>
                    <button onClick={() => finish("abandoned")} className="arcade-button arcade-button-ghost">EXIT STAGE</button>
                  </div>
                )}

                {phase === "result" && lastAttempt && (
                  <div className="result-panel mt-10 pt-8">
                    <p className={`result-banner ${lastAttempt.completion_status === "abandoned" ? "is-extra-ball" : ""}`}>{statusLabel(lastAttempt.completion_status)}</p>
                    <div className="result-grid mt-7">
                      <div><span>FINAL TIME</span><strong>{formatTime(lastAttempt.time_elapsed_seconds)}</strong></div>
                      <div><span>TARGET</span><strong>{formatTime(lastAttempt.time_limit_seconds)}</strong></div>
                      <div><span>STATUS</span><strong>{statusLabel(lastAttempt.completion_status)}</strong></div>
                    </div>
                    {lastAttempt.completion_status === "abandoned" ? (
                      <div className="extra-ball-panel mt-6">
                        <p className="extra-ball-title">EXTRA BALL READY</p>
                        <p>Ball drained. That’s part of the game. Take the same shot again whenever you’re ready.</p>
                        <div className="mt-6 flex flex-wrap gap-3">
                          <button onClick={start} className="arcade-button arcade-button-primary">ONE MORE SHOT</button>
                          <button onClick={nextQuestion} className="arcade-button arcade-button-ghost">CHANGE CHALLENGE</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="mt-5 text-sm text-[#bec2d5]">Full elapsed time saved. Your run stays intact—even after the target.</p>
                        <div className="mt-6 flex flex-wrap gap-3">
                          <button onClick={nextQuestion} className="arcade-button arcade-button-primary">NEXT STAGE</button>
                          <button onClick={() => selectQuestion(questionIndex)} className="arcade-button arcade-button-ghost">RETRY</button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
            <p className="insert-coin mt-6 text-center">ANSWER OUT LOUD // TARGET GUIDES, NEVER CUTS OFF</p>
          </section>
        )}

        {view === "today" && (
          <section className="arcade-screen py-10 sm:py-14">
            <div className="screen-heading">
              <p className="arcade-kicker text-[#ff4fd8]">POST-GAME SCORE</p>
              <h2>TODAY’S GAME</h2>
              <p>Every shot counts—clears, bonus time, and ball drains all stay on the board.</p>
            </div>
            <div className="today-marquee mt-8">
              <span>PLAYER 1</span><span>{todayStats.date}</span><span>TABLE OPEN</span>
            </div>
            <div className="daily-stat-grid">
              <DailyStat label="BALLS PLAYED" value={String(todayStats.questions_attempted).padStart(2, "0")} description="questions attempted" />
              <DailyStat label="STAGES CLEARED" value={String(todayStats.questions_completed).padStart(2, "0")} description="completed, including bonus time" />
              <DailyStat label="TIME ON TABLE" value={formatTime(todayStats.total_time_seconds).padStart(5, "0")} description="full elapsed time" />
              <DailyStat label="CLEAR RATIO" value={`${todayStats.questions_completed}/${todayStats.questions_attempted}`} description="clears per attempt" />
            </div>
            <div className="game-note mt-7">
              <p>KEEP THE BALL MOVING</p>
              <span>No judgment, no red marks. A drained ball simply earns another shot.</span>
            </div>
          </section>
        )}

        {view === "bank" && (
          <section className="arcade-screen py-9 sm:py-12">
            <div className="screen-heading">
              <p className="arcade-kicker text-[#ff4fd8]">CHOOSE YOUR CHALLENGE</p>
              <h2>CHALLENGE SELECT</h2>
              <p>Pick a category, then load a question into the studio.</p>
            </div>
            <div className="category-console mt-8 flex flex-wrap gap-2" aria-label="Question categories">
              {CATEGORIES.map((item) => (
                <button key={item} onClick={() => setCategory(item)} className={`arcade-filter ${category === item ? "is-selected" : ""}`}>{item}</button>
              ))}
            </div>
            <p className="bank-count mt-6">{String(filteredQuestions.length).padStart(3, "0")} CHALLENGES AVAILABLE</p>
            <div className="challenge-grid mt-4 grid gap-4 sm:grid-cols-2">
              {filteredQuestions.map((item) => (
                <button key={item.id} onClick={() => selectQuestion(item.number - 1)} className="challenge-select-card text-left">
                  <span className="challenge-number">STAGE {String(item.number).padStart(3, "0")}</span>
                  <span className="challenge-category">{item.category}</span>
                  <span className="challenge-question">{item.prompt}</span>
                  <span className="challenge-cta" aria-hidden="true">PRESS START →</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {view === "history" && (
          <section className="arcade-screen py-10 sm:py-14">
            <div className="screen-heading">
              <p className="arcade-kicker text-[#ff4fd8]">PLAYER RECORD</p>
              <h2>RUN ARCHIVE</h2>
              <p>Every answer stays on the board with its full elapsed time.</p>
            </div>
            <div className="score-grid mt-8 grid gap-4 sm:grid-cols-3">
              <Metric label="Attempts" value={String(attempts.length)} />
              <Metric label="Average elapsed" value={formatTime(averageSeconds)} />
              <Metric label="Over target" value={String(attempts.filter((attempt) => attempt.completion_status === "timed_out").length)} />
            </div>
            <div className="score-table mt-7">
              <div className="score-table-header" aria-hidden="true"><span>CHALLENGE</span><span>TIME</span><span>RESULT</span></div>
              {attempts.length === 0 ? <p className="empty-score">NO RUNS YET // CLEAR A STAGE TO POST A SCORE</p> : attempts.slice(0, 20).map((attempt, index) => (
                <div key={attempt.id} className="score-row">
                  <div>
                    <p className="score-rank">#{String(index + 1).padStart(2, "0")} / {attempt.category}</p>
                    <p className="score-question">{attempt.question_prompt}</p>
                    <p className="score-date">{new Date(attempt.started_at).toLocaleDateString()}</p>
                  </div>
                  <p className="score-time">{formatTime(attempt.time_elapsed_seconds)}</p>
                  <span className={`score-status is-${attempt.completion_status}`}>{statusLabel(attempt.completion_status)}</span>
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
  return <div className="score-card"><p>{label}</p><strong>{value}</strong></div>;
}

function DailyStat({ label, value, description }: { label: string; value: string; description: string }) {
  return (
    <div className="daily-stat-card">
      <p>{label}</p>
      <SegmentedValue value={value} label={`${label}: ${value}`} />
      <span>{description}</span>
    </div>
  );
}

const SEGMENTS: Record<string, string[]> = {
  "0": ["a", "b", "c", "d", "e", "f"],
  "1": ["b", "c"],
  "2": ["a", "b", "g", "e", "d"],
  "3": ["a", "b", "c", "d", "g"],
  "4": ["f", "g", "b", "c"],
  "5": ["a", "f", "g", "c", "d"],
  "6": ["a", "f", "g", "e", "c", "d"],
  "7": ["a", "b", "c"],
  "8": ["a", "b", "c", "d", "e", "f", "g"],
  "9": ["a", "b", "c", "d", "f", "g"],
};

function SegmentedTimer({ seconds }: { seconds: number }) {
  const value = formatTime(seconds).padStart(5, "0");
  return <SegmentedValue value={value} label={`${value} elapsed`} role="timer" />;
}

function SegmentedValue({ value, label, role = "img" }: { value: string; label: string; role?: "img" | "timer" }) {
  return (
    <div className="segment-display" role={role} aria-label={label}>
      {value.split("").map((character, index) => {
        if (character === ":") return <span className="segment-colon" aria-hidden="true" key={`colon-${index}`}><i /><i /></span>;
        if (character === "/") return <span className="segment-slash" aria-hidden="true" key={`slash-${index}`} />;
        return (
          <span className="segment-digit" aria-hidden="true" key={`${character}-${index}`}>
            {["a", "b", "c", "d", "e", "f", "g"].map((segment) => <i key={segment} className={`${segment} ${SEGMENTS[character]?.includes(segment) ? "on" : ""}`} />)}
          </span>
        );
      })}
    </div>
  );
}
