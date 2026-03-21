import { useCallback, useEffect, useReducer, useRef } from "react";
import { fetchArgumentDetail } from "../api/client.ts";
import type {
  ArgumentDetail,
  ArgumentStatus,
  ScoreResponse,
} from "../types/index.ts";

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 30000;

interface UseArgumentPollingOptions {
  argumentId: string | null;
  enabled: boolean;
}

interface PollState {
  status: ArgumentStatus;
  scores: ScoreResponse[];
  compositeScore: number | null;
  isComplete: boolean;
  error: string | null;
}

type PollAction =
  | { type: "reset" }
  | { type: "update"; detail: ArgumentDetail }
  | { type: "complete" }
  | { type: "timeout" };

const initialState: PollState = {
  status: "pending",
  scores: [],
  compositeScore: null,
  isComplete: false,
  error: null,
};

function isTerminalStatus(status: ArgumentStatus): boolean {
  return status === "scored" || status === "partial" || status === "failed";
}

function pollReducer(state: PollState, action: PollAction): PollState {
  switch (action.type) {
    case "reset":
      return initialState;
    case "update": {
      const terminal = isTerminalStatus(action.detail.status);
      return {
        status: action.detail.status,
        scores: action.detail.scores,
        compositeScore: action.detail.composite_score,
        isComplete: terminal,
        error: null,
      };
    }
    case "complete":
      return { ...state, isComplete: true };
    case "timeout":
      return {
        ...state,
        isComplete: true,
        error: "Scoring timed out. Please refresh to check status.",
      };
  }
}

export function useArgumentPolling({
  argumentId,
  enabled,
}: UseArgumentPollingOptions): PollState {
  const [state, dispatch] = useReducer(pollReducer, initialState);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const poll = useCallback(
    async (id: string) => {
      // Check timeout
      if (Date.now() - startTimeRef.current > POLL_TIMEOUT_MS) {
        stopPolling();
        dispatch({ type: "timeout" });
        return;
      }

      try {
        const detail: ArgumentDetail = await fetchArgumentDetail(id);
        dispatch({ type: "update", detail });

        if (isTerminalStatus(detail.status)) {
          stopPolling();
        }
      } catch {
        // Don't stop polling on transient errors — just skip this tick
      }
    },
    [stopPolling],
  );

  useEffect(() => {
    if (!enabled || !argumentId) {
      stopPolling();
      return;
    }

    dispatch({ type: "reset" });
    startTimeRef.current = Date.now();

    // Immediate first poll
    void poll(argumentId);

    // Set up interval
    intervalRef.current = setInterval(() => {
      void poll(argumentId);
    }, POLL_INTERVAL_MS);

    return () => {
      stopPolling();
    };
  }, [argumentId, enabled, poll, stopPolling]);

  // When disabled, return initial state (avoids stale data from previous poll)
  if (!enabled) {
    return initialState;
  }

  return state;
}
