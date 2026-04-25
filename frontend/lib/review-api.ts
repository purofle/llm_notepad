import axios from 'axios';

import type {
  ReviewFeedbackRequest,
  ReviewRecommendationResponse,
} from './types';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://192.168.2.3:8000';
const REVIEW_RECOMMENDATION_ENDPOINT = `${API_BASE_URL}/review/recommendation`;
const REVIEW_RECORDS_ENDPOINT = `${API_BASE_URL}/review-records`;

let recommendationCache: ReviewRecommendationResponse | null = null;
let recommendationRequest: Promise<ReviewRecommendationResponse> | null = null;

function isRecommendationResponse(value: unknown): value is ReviewRecommendationResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const problem = candidate.problem;

  const validProblem =
    problem === null ||
    problem === undefined ||
    (typeof problem === 'object' &&
      problem !== null &&
      typeof (problem as Record<string, unknown>).id === 'string' &&
      typeof (problem as Record<string, unknown>).content === 'string' &&
      typeof (problem as Record<string, unknown>).answer === 'string' &&
      typeof (problem as Record<string, unknown>).subject === 'string' &&
      typeof (problem as Record<string, unknown>).type === 'string' &&
      typeof (problem as Record<string, unknown>).response_id === 'string' &&
      typeof (problem as Record<string, unknown>).created_at === 'string' &&
      typeof (problem as Record<string, unknown>).due_at === 'string' &&
      Array.isArray((problem as Record<string, unknown>).tags));

  return (
    validProblem &&
    typeof candidate.due_count === 'number' &&
    typeof candidate.total_count === 'number' &&
    (candidate.next_due_at === null ||
      candidate.next_due_at === undefined ||
      typeof candidate.next_due_at === 'string')
  );
}

async function getRecommendationFromServer() {
  const response = await axios.get<unknown>(REVIEW_RECOMMENDATION_ENDPOINT);

  if (!isRecommendationResponse(response.data)) {
    throw new Error('后端返回的复习推荐格式不正确');
  }

  recommendationCache = response.data;
  return response.data;
}

export async function fetchReviewRecommendation() {
  if (recommendationCache) {
    return recommendationCache;
  }

  if (!recommendationRequest) {
    recommendationRequest = getRecommendationFromServer();
  }

  try {
    return await recommendationRequest;
  } finally {
    recommendationRequest = null;
  }
}

export async function submitReviewFeedback(payload: ReviewFeedbackRequest) {
  const response = await axios.post<unknown>(REVIEW_RECORDS_ENDPOINT, payload, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!isRecommendationResponse(response.data)) {
    throw new Error('后端返回的复习推荐格式不正确');
  }

  recommendationCache = response.data;
  recommendationRequest = null;
  return response.data;
}

export function invalidateReviewRecommendationCache() {
  recommendationCache = null;
  recommendationRequest = null;
}
