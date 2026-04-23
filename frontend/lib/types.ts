export type Problem = {
  content: string;
  type: string;
  subject: string;
  tags: string[];
  answer: string;
};

export type UploadApiResponse = {
  result?: string;
  problem?: Problem;
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
