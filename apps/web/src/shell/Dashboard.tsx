import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { getPlatformHealth } from '../api/client';
import { useAuth } from './auth';
import { useI18n } from '../i18n/I18nProvider';

interface HealthService {
  code: string;
  name: string;
  status: 'ok' | 'error';
  detail: string;
}

export function Dashboard() {
  const { user } = useAuth();
  const { locale, t } = useI18n();
  const [services, setServices] = useState<HealthService[]>([]);

  useEffect(() => {
    getPlatformHealth(locale)
      .then(({ services: loadedServices }) => setServices(loadedServices))
      .catch(() =>
        setServices([
          {
            code: 'platform-health',
            name: t('dashboard.healthUnavailable'),
            status: 'error',
            detail: t('dashboard.healthUnavailableDetail')
          }
        ])
      );
  }, [locale, t]);

  return (
    <main className="page">
      <section className="page-header">
        <div>
          <span className="eyebrow">{t('dashboard.eyebrow')}</span>
          <h1>{t('dashboard.title')}</h1>
        </div>
        <div className="permission-count">{t('dashboard.permissions', { count: user?.permissions.length ?? 0 })}</div>
      </section>

      <section className="health-grid">
        {services.map((service) => {
          const Icon = service.status === 'ok' ? CheckCircle2 : XCircle;
          return (
            <article className={`health-card ${service.status}`} key={service.code}>
              <Icon aria-hidden="true" />
              <div>
                <span className="module-code">{service.code}</span>
                <h2>{service.name}</h2>
                <p>{service.detail}</p>
              </div>
            </article>
          );
        })}
        {services.length === 0 ? (
          <article className="health-card">
            <div>
              <span className="module-code">{t('dashboard.health')}</span>
              <h2>{t('shell.loading')}</h2>
            </div>
          </article>
        ) : null}
      </section>
    </main>
  );
}
