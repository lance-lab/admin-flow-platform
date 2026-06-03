import { FormEvent, useState } from 'react';
import { LockKeyhole, LogIn } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import { useI18n } from '../i18n/I18nProvider';

function LoginForm() {
  const navigate = useNavigate();
  const { signIn, user } = useAuth();
  const { locale, locales, setLocale, t } = useI18n();
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('demo-password');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await signIn(email, password);
      navigate('/');
    } catch {
      setError(t('auth.error'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <form className="login-panel" onSubmit={handleSubmit}>
        <div className="login-mark">
          <LockKeyhole aria-hidden="true" />
        </div>
        <div className="login-heading">
          <h1>{t('app.brand')}</h1>
          <select
            aria-label="Language"
            className="language-select"
            value={locale}
            onChange={(event) => setLocale(event.target.value === 'en' ? 'en' : 'sk')}
          >
            {Object.entries(locales).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <label>
          {t('auth.email')}
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
        </label>
        <label>
          {t('auth.password')}
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <button className="primary-button" disabled={submitting} type="submit">
          <LogIn aria-hidden="true" />
          {submitting ? t('auth.signingIn') : t('auth.signIn')}
        </button>
      </form>
    </main>
  );
}

export function Login() {
  return (
    <AuthProvider>
      <LoginForm />
    </AuthProvider>
  );
}
