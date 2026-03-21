import axios from "axios";
import type {
  ArgumentDetail,
  ArgumentSubmitResponse,
  LeaderboardResponse,
  TopicResponse,
} from "../types/index.ts";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
});

export async function fetchActiveTopic(): Promise<TopicResponse> {
  const { data } = await api.get<TopicResponse>("/api/topics/active");
  return data;
}

export async function fetchLeaderboard(
  topicId: string,
): Promise<LeaderboardResponse> {
  const { data } = await api.get<LeaderboardResponse>("/api/arguments", {
    params: { topic_id: topicId },
  });
  return data;
}

export async function fetchArgumentDetail(
  id: string,
): Promise<ArgumentDetail> {
  const { data } = await api.get<ArgumentDetail>(`/api/arguments/${id}`);
  return data;
}

export async function submitArgument(
  body: string,
  authorName?: string,
): Promise<ArgumentSubmitResponse> {
  const { data } = await api.post<ArgumentSubmitResponse>("/api/arguments", {
    body,
    author_name: authorName || null,
  });
  return data;
}
