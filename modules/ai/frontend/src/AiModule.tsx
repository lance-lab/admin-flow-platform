import { Bot, Clock3, Play, Sparkles } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../../../apps/web/src/i18n/I18nProvider';
import { useNotifications } from '../../../../apps/web/src/shell/Notifications';
import { getAiOverview, listAiModelRuns, runAiChat, type AiChatResponse, type AiModelRun, type AiOverview } from './api';

const CAPABILITY_TRANSLATION_KEYS: Record<string, string> = {
  'Local model chat': 'ai.capabilities.localChat',
  'Slovak prompt testing': 'ai.capabilities.slovakPromptTesting',
  'Model run history': 'ai.capabilities.modelRunHistory',
  'Worker-ready AI jobs': 'ai.capabilities.workerReadyAiJobs'
};

export function AiModule() {
  const { t } = useI18n();
  const { notify } = useNotifications();
  const [overview, setOverview] = useState<AiOverview | null>(null);
  const [runs, setRuns] = useState<AiModelRun[]>([]);
  const [prompt, setPrompt] = useState('');
  const [systemPrompt, setSystemPrompt] = useState(() => t('ai.defaultSystemPrompt'));
  const [systemPromptEdited, setSystemPromptEdited] = useState(false);
  const [result, setResult] = useState<AiChatResponse | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!systemPromptEdited) {
      setSystemPrompt(t('ai.defaultSystemPrompt'));
    }
  }, [systemPromptEdited, t]);

  useEffect(() => {
    void Promise.all([getAiOverview(), listAiModelRuns()])
      .then(([loadedOverview, { modelRuns }]) => {
        setOverview(loadedOverview);
        setRuns(modelRuns);
      })
      .catch(() => notify({ type: 'error', message: t('ai.error') }));
  }, [notify, t]);

  const capabilityLabels = useMemo(
    () =>
      overview?.capabilities.map((capability) => t(CAPABILITY_TRANSLATION_KEYS[capability] ?? capability)) ?? [],
    [overview?.capabilities, t]
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setRunning(true);
    try {
      const response = await runAiChat({
        prompt,
        systemPrompt: systemPrompt.trim() ? systemPrompt : null
      });
      setResult(response);
      const { modelRuns } = await listAiModelRuns();
      setRuns(modelRuns);
    } catch {
      notify({ type: 'error', message: t('ai.error') });
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="page">
      <section className="page-header">
        <div>
          <span className="eyebrow">{t('ai.eyebrow')}</span>
          <h1>{t('ai.title')}</h1>
        </div>
      </section>

      <section className="ai-layout">
        <div className="ai-primary">
          <form className="ai-panel" onSubmit={submit}>
            <div className="ai-panel-heading">
              <Sparkles aria-hidden="true" />
              <div>
                <h2>{t('ai.prompt')}</h2>
                <p>
                  {overview?.provider ?? '-'} / {overview?.model ?? '-'}
                </p>
              </div>
            </div>

            <label>
              {t('ai.systemPrompt')}
              <textarea
                rows={3}
                placeholder={t('ai.systemPromptPlaceholder')}
                value={systemPrompt}
                onChange={(event) => {
                  setSystemPromptEdited(true);
                  setSystemPrompt(event.target.value);
                }}
              />
            </label>

            <label>
              {t('ai.prompt')}
              <textarea
                rows={6}
                placeholder={t('ai.promptPlaceholder')}
                required
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
              />
            </label>

            <button className="primary-button" type="submit" disabled={running}>
              <Play aria-hidden="true" />
              {running ? t('ai.running') : t('ai.run')}
            </button>
          </form>

          {result ? (
            <section className="ai-panel">
              <div className="ai-panel-heading">
                <Bot aria-hidden="true" />
                <div>
                  <h2>{t('ai.response')}</h2>
                  <p>{t('ai.duration', { duration: result.durationMs ?? 0 })}</p>
                </div>
              </div>
              <p className="ai-response">{result.response}</p>
            </section>
          ) : null}
        </div>

        <aside className="ai-secondary">
          <section className="ai-panel">
            <h2>{t('ai.status')}</h2>
            <dl className="detail-list">
              <div>
                <dt>{t('ai.provider')}</dt>
                <dd>{overview?.provider ?? '-'}</dd>
              </div>
              <div>
                <dt>{t('ai.model')}</dt>
                <dd>{overview?.model ?? '-'}</dd>
              </div>
            </dl>
            <div className="capability-list">
              {capabilityLabels.map((capability) => (
                <span key={capability}>{capability}</span>
              ))}
            </div>
          </section>

          <section className="ai-panel">
            <div className="ai-panel-heading">
              <Clock3 aria-hidden="true" />
              <h2>{t('ai.recentRuns')}</h2>
            </div>
            <div className="ai-run-list">
              {runs.map((run) => (
                <article key={run.id}>
                  <strong>{run.model}</strong>
                  <p>{run.prompt}</p>
                  <span>{t('ai.duration', { duration: run.durationMs ?? 0 })}</span>
                </article>
              ))}
              {runs.length === 0 ? <p>{t('ai.emptyRuns')}</p> : null}
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
