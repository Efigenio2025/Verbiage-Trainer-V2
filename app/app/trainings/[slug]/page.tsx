import Link from 'next/link';
import { notFound } from 'next/navigation';
import PolarCard from '@/components/PolarCard';
import { getTrainingModule } from '@/lib/trainingLibrary';

type TrainingDetailPageProps = {
  params: {
    slug: string;
  };
};

export default function TrainingDetailPage({ params }: TrainingDetailPageProps) {
  const training = getTrainingModule(params.slug);

  if (!training) {
    notFound();
  }

  return (
    <main className="page">
      <PolarCard
        title={training.title}
        subtitle={training.nextAction}
        className="dashboard-card training-detail-card"
      >
        <div className="training-detail">
          <p className="training-detail__summary">{training.description}</p>
          <div className="training-detail__meta">
            <div className="training-detail__meta-item">
              <span className="muted">Status</span>
              <p>{training.status}</p>
            </div>
            <div className="training-detail__meta-item">
              <span className="muted">Duration</span>
              <p>{training.duration}</p>
            </div>
            <div className="training-detail__meta-item">
              <span className="muted">Level</span>
              <p>{training.level}</p>
            </div>
            <div className="training-detail__meta-item">
              <span className="muted">Category</span>
              <p>{training.category}</p>
            </div>
            <div className="training-detail__meta-item">
              <span className="muted">Progress</span>
              <p>{training.progress}% complete</p>
            </div>
          </div>
          <div className="training-detail__focus">
            <h2 className="training-detail__subheading">Focus areas</h2>
            <ul className="training-detail__focus-list">
              {training.focusAreas.map((focus) => (
                <li key={focus}>{focus}</li>
              ))}
            </ul>
          </div>
          <div className="training-detail__focus">
            <h2 className="training-detail__subheading">Expected outcomes</h2>
            <ul className="training-detail__focus-list">
              {training.outcomes.map((outcome) => (
                <li key={outcome}>{outcome}</li>
              ))}
            </ul>
          </div>
          <div className="dashboard__quick training-detail__actions">
            <Link href="/app" className="btn btn-outline">
              Back to dashboard
            </Link>
            <Link
              href={`/app/trainings/${training.slug}?start=next`}
              className="btn btn-primary"
            >
              Start next session
            </Link>
          </div>
        </div>
      </PolarCard>
    </main>
  );
}
