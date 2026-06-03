import { BriefcaseBusiness, LayoutDashboard, LogOut, ShieldCheck } from 'lucide-react';
import { Navigate, NavLink, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import { useI18n } from '../i18n/I18nProvider';

function Shell() {
  const { user, modules, loading, signOut } = useAuth();
  const { locale, locales, setLocale, t } = useI18n();

  if (loading) {
    return <main className="center-screen">{t('shell.loading')}</main>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <ShieldCheck aria-hidden="true" />
          <span>{t('app.brand')}</span>
        </div>

        <nav className="nav-list" aria-label="Main navigation">
          <NavLink to="/" end>
            <LayoutDashboard aria-hidden="true" />
            {t('nav.dashboard')}
          </NavLink>
          {modules.map((module) => (
            <NavLink key={module.code} to={module.routePath}>
              <BriefcaseBusiness aria-hidden="true" />
              {module.name}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div>
            <span className="eyebrow">{t('shell.signedIn')}</span>
            <strong>{user.displayName}</strong>
          </div>
          <div className="topbar-actions">
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
            <button className="icon-text-button" type="button" onClick={signOut}>
              <LogOut aria-hidden="true" />
              {t('nav.signOut')}
            </button>
          </div>
        </header>
        <Outlet />
      </div>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
