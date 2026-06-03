import { useAuth } from './auth';
import { useI18n } from '../i18n/I18nProvider';

export function Dashboard() {
  const { modules, user } = useAuth();
  const { t } = useI18n();

  return (
    <main className="page">
      <section className="page-header">
        <div>
          <span className="eyebrow">{t('dashboard.eyebrow')}</span>
          <h1>{t('dashboard.title')}</h1>
        </div>
        <div className="permission-count">{t('dashboard.permissions', { count: user?.permissions.length ?? 0 })}</div>
      </section>

      <section className="module-grid">
        {modules.map((module) => (
          <article className="module-card" key={module.code}>
            <span className="module-code">{module.code}</span>
            <h2>{module.name}</h2>
            <p>{module.description}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
