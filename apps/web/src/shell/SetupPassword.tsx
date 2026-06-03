import { FormEvent, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { completePasswordSetup, getPasswordSetup } from '../api/client';
import { useI18n } from '../i18n/I18nProvider';

export function SetupPassword() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setError(t('setup.error'));
      setLoading(false);
      return;
    }

    getPasswordSetup(token)
      .then(({ user }) => {
        setEmail(user.email);
        setError(null);
      })
      .catch(() => setError(t('setup.error')))
      .finally(() => setLoading(false));
  }, [token, t]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError(t('setup.passwordShort'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('setup.passwordMismatch'));
      return;
    }

    try {
      await completePasswordSetup(token, password);
      setSuccess(true);
    } catch {
      setError(t('setup.error'));
    }
  }

  return (
    <main className="login-page">
      <form className="login-panel" onSubmit={handleSubmit}>
        <div className="login-heading">
          <h1>{t('setup.title')}</h1>
        </div>
        {loading ? <p>{t('shell.loading')}</p> : null}
        {!loading && !success ? (
          <>
            <p className="helper-text">{t('setup.subtitle', { email })}</p>
            <label>
              {t('setup.password')}
              <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" />
            </label>
            <label>
              {t('setup.confirmPassword')}
              <input
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                type="password"
              />
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            <button className="primary-button" type="submit">
              {t('setup.submit')}
            </button>
          </>
        ) : null}
        {success ? (
          <>
            <p className="form-success">{t('setup.success')}</p>
            <Link className="icon-text-button" to="/login">
              {t('auth.signIn')}
            </Link>
          </>
        ) : null}
      </form>
    </main>
  );
}

