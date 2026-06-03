import { useEffect } from 'react';
import { BriefcaseBusiness, LayoutDashboard, LogOut, ShieldCheck, Users } from 'lucide-react';
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import { useI18n } from '../i18n/I18nProvider';

const WORKSPACE_KEY = 'admin-flow-workspace';

function Shell() {
  const { user, modules, loading, signOut, hasPermission } = useAuth();
  const { locale, locales, setLocale, t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const activeModule = modules.find((module) => location.pathname.startsWith(module.routePath));
  const activeWorkspace = activeModule ? `module:${activeModule.code}` : 'platform';

  useEffect(() => {
    if (!loading && user) {
      window.localStorage.setItem(WORKSPACE_KEY, activeWorkspace);
    }
  }, [activeWorkspace, loading, user]);

  if (loading) {
    return <main className="center-screen">{t('shell.loading')}</main>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  function switchWorkspace(workspace: string) {
    window.localStorage.setItem(WORKSPACE_KEY, workspace);

    if (workspace === 'platform') {
      navigate('/admin');
      return;
    }

    const moduleCode = workspace.replace('module:', '');
    const module = modules.find((availableModule) => availableModule.code === moduleCode);
    navigate(module?.routePath ?? '/admin');
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <ShieldCheck aria-hidden="true" />
          <span>{t('app.brand')}</span>
        </div>

        <label className="workspace-switcher">
          <span>{t('workspace.label')}</span>
          <select value={activeWorkspace} onChange={(event) => switchWorkspace(event.target.value)}>
            <option value="platform">{t('workspace.platform')}</option>
            {modules.map((module) => (
              <option key={module.code} value={`module:${module.code}`}>
                {module.name}
              </option>
            ))}
          </select>
        </label>

        <nav className="nav-list" aria-label="Main navigation">
          {activeWorkspace === 'platform' ? (
            <>
              <NavLink to="/admin" end>
                <LayoutDashboard aria-hidden="true" />
                {t('nav.dashboard')}
              </NavLink>
              {hasPermission('platform.users.read') ? (
                <NavLink to="/admin/users">
                  <Users aria-hidden="true" />
                  {t('nav.users')}
                </NavLink>
              ) : null}
            </>
          ) : (
            activeModule ? (
              <NavLink to={activeModule.routePath}>
                <BriefcaseBusiness aria-hidden="true" />
                {t('nav.dashboard')}
              </NavLink>
            ) : null
          )}
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
