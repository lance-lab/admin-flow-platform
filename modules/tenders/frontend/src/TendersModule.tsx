import { Building2, ClipboardList, FileText, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useI18n, type TranslationKey } from '../../../../apps/web/src/i18n/I18nProvider';
import { getTendersOverview, type TendersOverview } from './api';

const placeholders = [
  {
    title: 'tenders.cards.crud.title',
    description: 'tenders.cards.crud.description',
    icon: ClipboardList
  },
  {
    title: 'tenders.cards.companies.title',
    description: 'tenders.cards.companies.description',
    icon: Building2
  },
  {
    title: 'tenders.cards.ai.title',
    description: 'tenders.cards.ai.description',
    icon: Sparkles
  },
  {
    title: 'tenders.cards.documents.title',
    description: 'tenders.cards.documents.description',
    icon: FileText
  }
] satisfies Array<{ title: TranslationKey; description: TranslationKey; icon: typeof ClipboardList }>;

export function TendersModule() {
  const { t } = useI18n();
  const [overview, setOverview] = useState<TendersOverview | null>(null);

  useEffect(() => {
    getTendersOverview()
      .then(setOverview)
      .catch(() => setOverview(null));
  }, []);

  return (
    <main className="page">
      <section className="page-header">
        <div>
          <span className="eyebrow">{t('tenders.eyebrow')}</span>
          <h1>{t('tenders.title')}</h1>
        </div>
        <span className="status-pill">{overview?.status ?? t('tenders.connecting')}</span>
      </section>

      <div className="status-row">
        {(overview?.capabilities ?? [t('tenders.backendPending')]).map((capability) => (
          <span className="permission-count" key={capability}>
            {capability}
          </span>
        ))}
      </div>

      <section className="tenders-actions">
        {placeholders.map((item) => {
          const Icon = item.icon;
          return (
            <article className="action-panel" key={item.title}>
              <Icon aria-hidden="true" />
              <h2>{t(item.title)}</h2>
              <p>{t(item.description)}</p>
            </article>
          );
        })}
      </section>
    </main>
  );
}
