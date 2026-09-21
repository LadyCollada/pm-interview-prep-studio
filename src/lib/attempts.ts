export type CompletionStatus = "completed" | "timed_out" | "abandoned";

export type Attempt = {
  id: string;
  question_id: string;
  question_prompt: string;
  category: string;
  started_at: string;
  ended_at: string;
  time_limit_seconds: 120 | 300 | 600 | 1200 | 1800;
  time_elapsed_seconds: number;
  completion_status: CompletionStatus;
};

export type ActiveAttempt = Omit<
  Attempt,
  "ended_at" | "time_elapsed_seconds" | "completion_status"
> & { last_elapsed_seconds: number };

const ATTEMPTS_KEY = "pm-interview-prep-attempts-v1";
const ACTIVE_KEY = "pm-interview-prep-active-attempt-v1";

export function readAttempts(): Attempt[] {
  try { return JSON.parse(localStorage.getItem(ATTEMPTS_KEY) ?? "[]") as Attempt[]; }
  catch { return []; }
}

export function saveAttempt(attempt: Attempt) {
  localStorage.setItem(ATTEMPTS_KEY, JSON.stringify([attempt, ...readAttempts()]));
  localStorage.removeItem(ACTIVE_KEY);
}

export function readActiveAttempt(): ActiveAttempt | null {
  try {
    const value = localStorage.getItem(ACTIVE_KEY);
    return value ? (JSON.parse(value) as ActiveAttempt) : null;
  } catch { return null; }
}

export function saveActiveAttempt(attempt: ActiveAttempt) {
  localStorage.setItem(ACTIVE_KEY, JSON.stringify(attempt));
}

export function clearActiveAttempt() { localStorage.removeItem(ACTIVE_KEY); }
