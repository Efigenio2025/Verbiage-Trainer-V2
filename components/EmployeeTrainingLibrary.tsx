'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { TrainingModule } from '@/lib/trainingLibrary';

const libraryCategories = ['All', 'Phonetic', 'De-ice', 'Movement'] as const;

export type LibraryCategory = (typeof libraryCategories)[number];

const categoryGlyph: Record<string, string> = {
  Phonetic: '🔤',
  'De-ice': '❄️',
  Movement: '🛫'
};

type EmployeeTrainingLibraryProps = {
  modules: TrainingModule[];
  backHref?: string;
  onBack?: () => void;
};

export default function EmployeeTrainingLibrary({
  modules,
  backHref,
  onBack
}: EmployeeTrainingLibraryProps) {
  const [activeCategory, setActiveCategory] = useState<LibraryCategory>('All');

  const filteredModules = useMemo(() => {
    if (activeCategory === 'All') {
      return modules;
    }

    return modules.filter((module) => module.category === activeCategory);
  }, [activeCategory, modules]);

  return (
    <div className="employee-library">
      <div className="employee-topbar">
        {onBack ? (
          <button
            type="button"
            className="employee-topbar__back"
            aria-label="Back to Home"
            onClick={onBack}
          >
            <svg
              className="employee-topbar__icon"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M15 5L8 12L15 19"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : (
          <Link
            href={backHref ?? '/app'}
            className="employee-topbar__back"
            aria-label="Back to Home"
          >
            <svg
              className="employee-topbar__icon"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M15 5L8 12L15 19"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        )}
        <h1 className="employee-topbar__title">Training Library</h1>
      </div>

      <div className="training-filter" role="tablist" aria-label="Filter training categories">
        {libraryCategories.map((category) => {
          const isActive = category === activeCategory;
          return (
            <button
              key={category}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`training-filter__chip${isActive ? ' training-filter__chip--active' : ''}`}
              onClick={() => setActiveCategory(category)}
            >
              {category}
            </button>
          );
        })}
      </div>

      <div className="training-library__list">
        {filteredModules.length > 0 ? (
          filteredModules.map((module) => {
            const glyph = categoryGlyph[module.category] ?? '🎯';
            const clampedProgress = Math.max(0, Math.min(100, module.progress));

            return (
              <Link
                key={module.slug}
                href={`/app/trainings/${module.slug}`}
                className="training-library__card"
              >
                <div className="training-library__icon" aria-hidden="true">
                  {glyph}
                </div>
                <div className="training-library__body">
                  <p className="training-library__title">{module.title}</p>
                  <p className="training-library__description">{module.summary}</p>
                  <div
                    className="training-library__progress"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={clampedProgress}
                    aria-label={`${module.title} progress`}
                  >
                    <span
                      className="training-library__progress-fill"
                      style={{ width: `${clampedProgress}%` }}
                    />
                  </div>
                </div>
              </Link>
            );
          })
        ) : (
          <div className="training-library__card training-library__card--empty">
            <div className="training-library__empty">
              <p className="training-library__empty-title">No modules match this filter.</p>
              <p className="training-library__empty-subtitle">Try a different category to keep exploring.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}