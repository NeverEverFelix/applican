export type StageTimer = {
  end: () => number;
};

export function startStageTimer(): StageTimer {
  const startedAt = performance.now();

  return {
    end() {
      return Math.max(0, Math.round(performance.now() - startedAt));
    },
  };
}

export async function measureStage<T>(
  execute: () => Promise<T> | T,
): Promise<{ result: T; durationMs: number }> {
  const timer = startStageTimer();
  const result = await execute();
  return {
    result,
    durationMs: timer.end(),
  };
}
