import { StudyPage } from '@/components/study-page';

export default async function StudyProblemRoute({
  params,
}: {
  params: Promise<{ problemId: string }>;
}) {
  const { problemId } = await params;

  return <StudyPage problemId={problemId} />;
}
