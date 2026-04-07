import React, { useState, useEffect } from 'react';
import { api, type StudyListItem } from '../../lib/api';
import { StudyCard } from './StudyCard';

export function StudiesSection() {
  const [studies, setStudies] = useState<StudyListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.studies.list();
        setStudies(res.studies);
      } catch {
        // Silently fail — section just won't show
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading || studies.length === 0) return null;

  const activeCount = studies.filter(s => s.is_active).length;

  return (
    <section className="studies-section">
      {/* Counter injected into hero area */}
      <ActiveStudyCounter count={activeCount} />

      <div className="studies-section__header">
        <span className="studies-section__number">02</span>
        <h2 className="studies-section__title">Research Studies</h2>
      </div>
      <p className="studies-section__description">
        Curated batteries of cognitive tasks with peer comparison. Join a study to see how you compare.
      </p>
      <div className="studies-section__grid">
        {studies.map(study => (
          <StudyCard key={study.slug} study={study} variant="landing" />
        ))}
      </div>
    </section>
  );
}

function ActiveStudyCounter({ count }: { count: number }) {
  useEffect(() => {
    // Inject the active study count into the hero meta area
    const heroMeta = document.querySelector('.hero-meta');
    if (!heroMeta || count === 0) return;

    const existingCounter = document.getElementById('active-study-counter');
    if (existingCounter) {
      existingCounter.textContent = `${count} Active ${count === 1 ? 'Study' : 'Studies'}`;
      return;
    }

    const item = document.createElement('div');
    item.className = 'hero-meta-item';
    item.id = 'active-study-counter';

    const dot = document.createElement('span');
    dot.className = 'dot';
    item.appendChild(dot);

    const text = document.createTextNode(`${count} Active ${count === 1 ? 'Study' : 'Studies'}`);
    item.appendChild(text);

    heroMeta.appendChild(item);

    return () => {
      item.remove();
    };
  }, [count]);

  return null;
}

// Styles
const styles = `
  .studies-section {
    margin-bottom: var(--space-2xl);
  }

  .studies-section__header {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    margin-bottom: var(--space-sm);
    padding-bottom: var(--space-sm);
    border-bottom: 1px solid var(--faded-light);
  }

  .studies-section__number {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--gold);
  }

  .studies-section__title {
    font-family: var(--font-serif);
    font-size: 1.25rem;
    font-weight: 400;
    font-style: italic;
    color: var(--text-light);
    margin: 0;
  }

  .studies-section__description {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--faded);
    line-height: 1.5;
    margin-bottom: var(--space-lg);
  }

  .studies-section__grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-md);
  }
`;

if (typeof document !== 'undefined') {
  const styleId = 'studies-section-styles';
  if (!document.getElementById(styleId)) {
    const el = document.createElement('style');
    el.id = styleId;
    el.textContent = styles;
    document.head.appendChild(el);
  }
}
