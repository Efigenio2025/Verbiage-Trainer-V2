import { ReactNode } from 'react';
import clsx from 'clsx';

type PolarCardProps = {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  id?: string;
};

export default function PolarCard({ title, subtitle, children, className, id }: PolarCardProps) {
  return (
    <section id={id} className={clsx('polar-card', className)}>
      {(title || subtitle) && (
        <header className="polar-card__header">
          {title && <h1 className="polar-card__title">{title}</h1>}
          {subtitle && <p className="polar-card__subtitle">{subtitle}</p>}
        </header>
      )}
      <div className="polar-card__content">{children}</div>
    </section>
  );
}
