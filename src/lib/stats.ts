import type { Attempt } from "@/lib/attempts";

export type DailyStats = {
  date: string;
  questions_attempted: number;
  questions_completed: number;
  total_time_seconds: number;
  completion_ratio: number;
};

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function deriveDailyStats(attempts: Attempt[], day = new Date()): DailyStats {
  const date = localDateKey(day);
  const dailyAttempts = attempts.filter((attempt) => localDateKey(new Date(attempt.started_at)) === date);
  const questionsCompleted = dailyAttempts.filter((attempt) => attempt.completion_status !== "abandoned").length;

  return {
    date,
    questions_attempted: dailyAttempts.length,
    questions_completed: questionsCompleted,
    total_time_seconds: dailyAttempts.reduce((total, attempt) => total + attempt.time_elapsed_seconds, 0),
    completion_ratio: dailyAttempts.length ? questionsCompleted / dailyAttempts.length : 0,
  };
}
