import { FormEvent, useEffect, useState } from 'react';
import type { Locale, PlatformRole, PlatformUser } from '../../../../packages/shared-types/src';
import { createUser, deleteUser, getRoles, getUsers, updateUser } from '../api/client';
import { useI18n } from '../i18n/I18nProvider';
import { useNotifications } from './Notifications';

type FormMode = 'closed' | 'create' | 'edit';

export function Users() {
  const { locale, locales, t } = useI18n();
  const { confirm, notify } = useNotifications();
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [roles, setRoles] = useState<PlatformRole[]>([]);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [userLocale, setUserLocale] = useState<Locale>(locale);
  const [roleCodes, setRoleCodes] = useState<string[]>(['admin']);
  const [setupUrl, setSetupUrl] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<FormMode>('closed');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [active, setActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function loadUsers() {
    const [{ users: loadedUsers }, { roles: loadedRoles }] = await Promise.all([getUsers(), getRoles()]);
    setUsers(loadedUsers);
    setRoles(loadedRoles);
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  function toggleRole(code: string) {
    setRoleCodes((current) =>
      current.includes(code) ? current.filter((roleCode) => roleCode !== code) : [...current, code]
    );
  }

  function resetForm() {
    setEmail('');
    setDisplayName('');
    setUserLocale(locale);
    setRoleCodes(['admin']);
    setActive(true);
    setSetupUrl(null);
    setEditingUserId(null);
  }

  function openCreateForm() {
    resetForm();
    setFormMode('create');
  }

  function openEditForm(user: PlatformUser) {
    setFormMode('edit');
    setEditingUserId(user.id);
    setEmail(user.email);
    setDisplayName(user.displayName);
    setUserLocale(user.locale);
    setRoleCodes(user.roles.map((role) => role.code));
    setActive(user.active);
    setSetupUrl(null);
  }

  function closeForm() {
    resetForm();
    setFormMode('closed');
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setSetupUrl(null);

    try {
      if (formMode === 'edit' && editingUserId) {
        await updateUser(editingUserId, { displayName, locale: userLocale, active, roleCodes });
        notify({ type: 'success', message: t('users.updated') });
        setFormMode('closed');
      } else {
        const result = await createUser({ email, displayName, locale: userLocale, roleCodes });
        setSetupUrl(result.setupUrl);
        notify({ type: 'success', message: t('users.created') });
        setEmail('');
        setDisplayName('');
        setRoleCodes(['admin']);
      }
      await loadUsers();
    } catch {
      notify({ type: 'error', message: formMode === 'edit' ? t('users.updateError') : t('users.error') });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(user: PlatformUser) {
    const confirmed = await confirm({
      title: t('users.deleteTitle'),
      message: t('users.confirmDelete', { email: user.email }),
      confirmLabel: t('users.delete'),
      cancelLabel: t('users.cancel')
    });

    if (!confirmed) {
      return;
    }

    try {
      await deleteUser(user.id);
      notify({ type: 'success', message: t('users.deleted') });
      await loadUsers();
    } catch {
      notify({ type: 'error', message: t('users.deleteError') });
    }
  }

  return (
    <main className="page">
      <section className="page-header">
        <div>
          <span className="eyebrow">{t('users.eyebrow')}</span>
          <h1>{t('users.title')}</h1>
        </div>
        <button className="primary-button page-action-button" type="button" onClick={openCreateForm}>
          {t('users.create')}
        </button>
      </section>

      <section className="management-layout table-only">
        <section className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('users.displayName')}</th>
                <th>{t('users.email')}</th>
                <th>{t('users.roles')}</th>
                <th>{t('users.status')}</th>
                <th>{t('users.password')}</th>
                <th>{t('users.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.displayName}</td>
                  <td>{user.email}</td>
                  <td>{user.roles.map((role) => role.name).join(', ')}</td>
                  <td>{user.active ? t('users.active') : '-'}</td>
                  <td>{user.passwordSet ? t('users.passwordSet') : t('users.passwordPending')}</td>
                  <td>
                    <div className="row-actions">
                      <button className="icon-text-button" type="button" onClick={() => openEditForm(user)}>
                        {t('users.edit')}
                      </button>
                      <button className="danger-button" type="button" onClick={() => void handleDelete(user)}>
                        {t('users.delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </section>

      {formMode !== 'closed' ? (
        <aside className="side-panel" aria-label={formMode === 'edit' ? t('users.edit') : t('users.create')}>
          <form className="side-panel-form" onSubmit={handleSubmit}>
            <div className="panel-heading">
              <h2>{formMode === 'edit' ? t('users.edit') : t('users.create')}</h2>
              <button className="icon-text-button" type="button" onClick={closeForm}>
                {t('users.cancel')}
              </button>
            </div>
            <label>
              {t('users.email')}
              <input
                readOnly={formMode === 'edit'}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                required
              />
            </label>
            <label>
              {t('users.displayName')}
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
            </label>
            <label>
              {t('users.locale')}
              <select
                className="language-select"
                value={userLocale}
                onChange={(event) => setUserLocale(event.target.value === 'en' ? 'en' : 'sk')}
              >
                {Object.entries(locales).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="role-list">
              <legend>{t('users.roles')}</legend>
              {roles.map((role) => (
                <label key={role.code}>
                  <input
                    checked={roleCodes.includes(role.code)}
                    onChange={() => toggleRole(role.code)}
                    type="checkbox"
                  />
                  {role.name}
                </label>
              ))}
            </fieldset>
            {formMode === 'edit' ? (
              <fieldset className="role-list">
                <legend>{t('users.status')}</legend>
                <label>
                  <input checked={active} onChange={(event) => setActive(event.target.checked)} type="checkbox" />
                  {t('users.active')}
                </label>
              </fieldset>
            ) : null}
            {setupUrl && formMode === 'create' ? (
              <label>
                {t('users.setupLink')}
                <input readOnly value={setupUrl} onFocus={(event) => event.currentTarget.select()} />
              </label>
            ) : null}
            <button className="primary-button" disabled={submitting} type="submit">
              {formMode === 'edit' ? t('users.save') : t('users.create')}
            </button>
          </form>
        </aside>
      ) : null}
    </main>
  );
}
