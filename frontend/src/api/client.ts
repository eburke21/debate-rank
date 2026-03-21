import axios, { AxiosError } from "axios";
import type {
  ArgumentDetail,
  ArgumentSubmitResponse,
  LeaderboardResponse,
  TopicResponse,
} from "../types/index.ts";
import { toaster } from "../components/toaster.ts";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
  timeout: 15000,
});

// Response error interceptor — show toast for known failure modes
api.interceptors.response.use(undefined, (error: AxiosError) => {
  if (!error.response) {
    // Network error or timeout
    if (error.code === "ECONNABORTED") {
      toaster.error({
        title: "Request timed out",
        description: "Please try again.",
      });
    } else {
      toaster.error({
        title: "Could not connect to server",
        description: "Check that the backend is running.",
      });
    }
    return Promise.reject(error);
  }

  const { status, data } = error.response;

  if (status === 429) {
    toaster.error({
      title: "Too many submissions",
      description: "Try again in 60 seconds.",
    });
  } else if (status === 422) {
    // Validation error — extract field-level messages
    const errorData = data as { error?: { message?: string; fields?: Record<string, string> } };
    const fields = errorData?.error?.fields;
    const fieldMessages = fields
      ? Object.values(fields).join(". ")
      : errorData?.error?.message ?? "Invalid input.";
    toaster.error({
      title: "Validation error",
      description: fieldMessages,
    });
  } else if (status >= 500) {
    toaster.error({
      title: "Server error",
      description: "Something went wrong. Please try again later.",
    });
  }

  return Promise.reject(error);
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
