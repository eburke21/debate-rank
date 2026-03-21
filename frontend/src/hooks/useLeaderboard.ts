import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import { fetchActiveTopic, fetchLeaderboard } from "../api/client.ts";
import type { ArgumentSummary, TopicResponse } from "../types/index.ts";

export function useLeaderboard() {
  const [topic, setTopic] = useState<TopicResponse | null>(null);
  const [args, setArgs] = useState<ArgumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const activeTopic = await fetchActiveTopic();
      setTopic(activeTopic);

      const leaderboard = await fetchLeaderboard(activeTopic.id);
      setArgs(leaderboard.arguments);
    } catch (err) {
      // 404 on /api/topics/active means no topic exists yet — not an error
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        setTopic(null);
        setArgs([]);
      } else {
        const message =
          err instanceof Error ? err.message : "Failed to load leaderboard";
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    topic,
    arguments: args,
    loading,
    error,
    refetch: load,
  };
}
