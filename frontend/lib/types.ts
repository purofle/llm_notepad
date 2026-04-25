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

export type UploadApiResponse = {
  result?: string;
  problem?: Problem;
  problem_id?: string;
  response_id?: string;
  detail?: string;
  error?: string;
};

export type SavedProblem = Problem & {
  id: string;
  createdAt: string;
  responseId: string;
  rawResult: string;
  previewImageUrl: string | null;
};
