export type Problem = {
  content: string;
  type: string;
  subject: string;
  tags: string[];
  answer: string;
};

export type ProblemRecordApi = Problem & {
  id: string;
  response_id: string;
  created_at: string;
};

export type ReviewRating = 'forgot' | 'hard' | 'good' | 'easy';

export type ReviewRecommendationProblem = ProblemRecordApi & {
  due_at: string;
};

export type ReviewRecommendationResponse = {
  problem: ReviewRecommendationProblem | null;
  due_count: number;
  total_count: number;
  next_due_at: string | null;
};

export type ReviewFeedbackRequest = {
  problem_id: string;
  rating: ReviewRating;
};

export type UploadApiResponse = {
  result?: string;
  problem?: Problem;
  problem_id?: string;
  response_id?: string;
  detail?: string;
  error?: string;
};
