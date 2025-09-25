import { notFound } from 'next/navigation';
import TrainApp from '@/components/deice/TrainApp';

export const metadata = {
  title: 'De-ice Procedures Simulator'
};

type SimulatorPageProps = {
  params: {
    slug: string;
  };
};

export default function DeIceSimulatorPage({ params }: SimulatorPageProps) {
  if (params.slug !== 'de-ice-procedures') {
    notFound();
  }

  return (
    <main className="page">
      <TrainApp />
    </main>
  );
}
