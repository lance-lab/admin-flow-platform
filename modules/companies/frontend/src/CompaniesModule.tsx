import { Building2, Landmark, Plus, Trash2, UserPlus } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { useI18n } from '../../../../apps/web/src/i18n/I18nProvider';
import { useNotifications } from '../../../../apps/web/src/shell/Notifications';
import {
  createBankAccount,
  createCompany,
  createContact,
  deleteCompany,
  getCompany,
  listCompanies,
  resolveCompanyByIco,
  type CompanyDetail,
  type ResolvedBankAccount,
  type CompanySummary
} from './api';

type PanelMode = 'closed' | 'detail' | 'company' | 'contact' | 'bankAccount';

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function formatAddress(company: CompanySummary | CompanyDetail) {
  return [
    [company.addressStreet, company.addressNumber].filter(Boolean).join(' '),
    [company.addressPostalCode, company.addressCity].filter(Boolean).join(' '),
    company.addressCountry
  ]
    .filter(Boolean)
    .join(', ');
}

function countryCode(value: string | null) {
  const normalized = (value ?? '').trim().toLowerCase();

  if (normalized.includes('česk') || normalized.includes('cesk') || normalized === 'cz') {
    return 'CZ';
  }

  return 'SK';
}

export function CompaniesModule() {
  const { t } = useI18n();
  const { confirm, notify } = useNotifications();
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<CompanyDetail | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>('closed');
  const [submitting, setSubmitting] = useState(false);
  const [resolvingIco, setResolvingIco] = useState(false);
  const [resolvedBankAccounts, setResolvedBankAccounts] = useState<ResolvedBankAccount[]>([]);

  const [companyName, setCompanyName] = useState('');
  const [ico, setIco] = useState('');
  const [dic, setDic] = useState('');
  const [icDph, setIcDph] = useState('');
  const [addressStreet, setAddressStreet] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [addressCity, setAddressCity] = useState('');
  const [addressCountry, setAddressCountry] = useState('SK');
  const [addressPostalCode, setAddressPostalCode] = useState('');

  const [contactName, setContactName] = useState('');
  const [contactSurname, setContactSurname] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhoneNumber, setContactPhoneNumber] = useState('');
  const [contactDateOfBirth, setContactDateOfBirth] = useState('');
  const [contactRole, setContactRole] = useState('');
  const [contactPreferred, setContactPreferred] = useState(false);

  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [bankPreferred, setBankPreferred] = useState(false);

  async function loadCompanies(nextSelectedCompanyId = selectedCompanyId) {
    const { companies: loadedCompanies } = await listCompanies();
    setCompanies(loadedCompanies);

    const fallbackCompanyId = loadedCompanies[0]?.id ?? null;
    const resolvedCompanyId =
      nextSelectedCompanyId && loadedCompanies.some((company) => company.id === nextSelectedCompanyId)
        ? nextSelectedCompanyId
        : fallbackCompanyId;

    setSelectedCompanyId(resolvedCompanyId);

    if (resolvedCompanyId) {
      const { company } = await getCompany(resolvedCompanyId);
      setSelectedCompany(company);
    } else {
      setSelectedCompany(null);
    }
  }

  useEffect(() => {
    void loadCompanies();
  }, []);

  async function selectCompany(companyId: string) {
    setSelectedCompanyId(companyId);
    const { company } = await getCompany(companyId);
    setSelectedCompany(company);
    setPanelMode('detail');
  }

  function closePanel() {
    setPanelMode('closed');
  }

  function resetCompanyForm() {
    setCompanyName('');
    setIco('');
    setDic('');
    setIcDph('');
    setAddressStreet('');
    setAddressNumber('');
    setAddressCity('');
    setAddressCountry('SK');
    setAddressPostalCode('');
    setResolvedBankAccounts([]);
  }

  function resetContactForm() {
    setContactName('');
    setContactSurname('');
    setContactEmail('');
    setContactPhoneNumber('');
    setContactDateOfBirth('');
    setContactRole('');
    setContactPreferred(false);
  }

  function resetBankAccountForm() {
    setBankAccountNumber('');
    setBankCode('');
    setBankPreferred(false);
  }

  async function handleCreateCompany(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);

    try {
      const { company } = await createCompany({
        name: companyName.trim(),
        ico: emptyToNull(ico),
        dic: emptyToNull(dic),
        ic_dph: emptyToNull(icDph),
        address_street: emptyToNull(addressStreet),
        address_number: emptyToNull(addressNumber),
        address_city: emptyToNull(addressCity),
        address_country: addressCountry.trim() || 'SK',
        address_postal_code: emptyToNull(addressPostalCode)
      });

      notify({ type: 'success', message: t('companies.created') });
      for (const bankAccount of resolvedBankAccounts) {
        await createBankAccount(company.id, {
          bank_account_number: bankAccount.Ucet,
          bank_code: emptyToNull(bankAccount.Banka ?? ''),
          preferred: false
        });
      }
      resetCompanyForm();
      await loadCompanies(company.id);
      setPanelMode('detail');
    } catch {
      notify({ type: 'error', message: t('companies.createError') });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResolveCompany() {
    const normalizedIco = ico.trim();

    if (!normalizedIco) {
      notify({ type: 'error', message: t('companies.resolveMissingIco') });
      return;
    }

    setResolvingIco(true);

    try {
      const resolved = await resolveCompanyByIco(normalizedIco, addressCountry || 'SK');
      setCompanyName(resolved.Meno ?? '');
      setIco(resolved.Ico ?? normalizedIco);
      setDic(resolved.Dic ?? '');
      setIcDph(resolved.IcDph ?? '');
      setAddressStreet(resolved.Ulica ?? '');
      setAddressNumber(resolved.CisloDomu ?? '');
      setAddressCity(resolved.Mesto ?? '');
      setAddressCountry(countryCode(resolved.Stat));
      setAddressPostalCode(resolved.Psc ?? '');
      setResolvedBankAccounts(resolved.BankoveUcty ?? []);
      notify({ type: 'success', message: t('companies.resolved') });
    } catch {
      notify({ type: 'error', message: t('companies.resolveError') });
    } finally {
      setResolvingIco(false);
    }
  }

  async function handleCreateContact(event: FormEvent) {
    event.preventDefault();

    if (!selectedCompanyId) {
      return;
    }

    setSubmitting(true);

    try {
      await createContact(selectedCompanyId, {
        name: contactName.trim(),
        surname: contactSurname.trim(),
        email: emptyToNull(contactEmail),
        phone_number: emptyToNull(contactPhoneNumber),
        date_of_birth: emptyToNull(contactDateOfBirth),
        role: emptyToNull(contactRole),
        preferred: contactPreferred
      });

      notify({ type: 'success', message: t('companies.contactCreated') });
      resetContactForm();
      await loadCompanies(selectedCompanyId);
      setPanelMode('detail');
    } catch {
      notify({ type: 'error', message: t('companies.contactCreateError') });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateBankAccount(event: FormEvent) {
    event.preventDefault();

    if (!selectedCompanyId) {
      return;
    }

    setSubmitting(true);

    try {
      await createBankAccount(selectedCompanyId, {
        bank_account_number: bankAccountNumber.trim(),
        bank_code: emptyToNull(bankCode),
        preferred: bankPreferred
      });

      notify({ type: 'success', message: t('companies.bankAccountCreated') });
      resetBankAccountForm();
      await loadCompanies(selectedCompanyId);
      setPanelMode('detail');
    } catch {
      notify({ type: 'error', message: t('companies.bankAccountCreateError') });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteCompany(company: CompanyDetail) {
    const confirmed = await confirm({
      title: t('companies.deleteTitle'),
      message: t('companies.confirmDelete', { name: company.name }),
      confirmLabel: t('companies.delete'),
      cancelLabel: t('companies.cancel')
    });

    if (!confirmed) {
      return;
    }

    setSubmitting(true);

    try {
      await deleteCompany(company.id);
      notify({ type: 'success', message: t('companies.deleted') });
      setSelectedCompanyId(null);
      setSelectedCompany(null);
      closePanel();
      await loadCompanies(null);
    } catch {
      notify({ type: 'error', message: t('companies.deleteError') });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page">
      <section className="page-header">
        <div>
          <span className="eyebrow">{t('companies.eyebrow')}</span>
          <h1>{t('companies.title')}</h1>
        </div>
        <button className="primary-button page-action-button" type="button" onClick={() => setPanelMode('company')}>
          <Plus aria-hidden="true" />
          {t('companies.create')}
        </button>
      </section>

      <section className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('companies.name')}</th>
              <th>{t('companies.ico')}</th>
              <th>{t('companies.city')}</th>
              <th>{t('companies.contacts')}</th>
              <th>{t('companies.bankAccounts')}</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((company) => (
              <tr
                className={company.id === selectedCompanyId ? 'selected-row' : undefined}
                key={company.id}
                onClick={() => void selectCompany(company.id)}
              >
                <td>
                  <strong>{company.name}</strong>
                </td>
                <td>{company.ico ?? '-'}</td>
                <td>{company.addressCity ?? '-'}</td>
                <td>{company.contactCount}</td>
                <td>{company.bankAccountCount}</td>
              </tr>
            ))}
            {companies.length === 0 ? (
              <tr>
                <td colSpan={5}>{t('companies.empty')}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      {panelMode !== 'closed' ? (
        <aside
          className={panelMode === 'detail' ? 'side-panel detail-side-panel' : 'side-panel'}
          aria-label={t(`companies.panel.${panelMode}`)}
        >
          {panelMode === 'detail' && selectedCompany ? (
            <div className="side-panel-form">
              <div className="panel-heading">
                <div className="detail-heading">
                  <Building2 aria-hidden="true" />
                  <div>
                    <span className="eyebrow">{t('companies.selected')}</span>
                    <h2>{selectedCompany.name}</h2>
                  </div>
                </div>
                <button className="icon-text-button" type="button" onClick={closePanel}>
                  {t('companies.cancel')}
                </button>
              </div>
              <div className="row-actions">
                <button
                  className="danger-button"
                  disabled={submitting}
                  type="button"
                  onClick={() => void handleDeleteCompany(selectedCompany)}
                >
                  <Trash2 aria-hidden="true" />
                  {t('companies.delete')}
                </button>
              </div>
              <dl className="detail-list">
                <div>
                  <dt>{t('companies.ico')}</dt>
                  <dd>{selectedCompany.ico ?? '-'}</dd>
                </div>
                <div>
                  <dt>{t('companies.dic')}</dt>
                  <dd>{selectedCompany.dic ?? '-'}</dd>
                </div>
                <div>
                  <dt>{t('companies.icDph')}</dt>
                  <dd>{selectedCompany.icDph ?? '-'}</dd>
                </div>
                <div>
                  <dt>{t('companies.address')}</dt>
                  <dd>{formatAddress(selectedCompany) || '-'}</dd>
                </div>
              </dl>

              <section className="detail-section">
                <div className="section-heading-row">
                  <h3>{t('companies.contacts')}</h3>
                  <button className="icon-text-button" type="button" onClick={() => setPanelMode('contact')}>
                    <UserPlus aria-hidden="true" />
                    {t('companies.addContact')}
                  </button>
                </div>
                <div className="compact-list">
                  {selectedCompany.contacts.map((contact) => (
                    <article className="compact-item" key={contact.id}>
                      <strong>
                        {contact.name} {contact.surname}
                      </strong>
                      <span>{contact.role ?? '-'}</span>
                      <span>{[contact.email, contact.phoneNumber].filter(Boolean).join(' / ') || '-'}</span>
                      {contact.preferred ? <span className="mini-pill">{t('companies.preferred')}</span> : null}
                    </article>
                  ))}
                  {selectedCompany.contacts.length === 0 ? (
                    <p className="helper-text">{t('companies.noContacts')}</p>
                  ) : null}
                </div>
              </section>

              <section className="detail-section">
                <div className="section-heading-row">
                  <h3>{t('companies.bankAccounts')}</h3>
                  <button className="icon-text-button" type="button" onClick={() => setPanelMode('bankAccount')}>
                    <Landmark aria-hidden="true" />
                    {t('companies.addBankAccount')}
                  </button>
                </div>
                <div className="compact-list">
                  {selectedCompany.bankAccounts.map((account) => (
                    <article className="compact-item" key={account.id}>
                      <strong>{account.bankAccountNumber}</strong>
                      <span>{account.bankCode ?? '-'}</span>
                      {account.preferred ? <span className="mini-pill">{t('companies.preferred')}</span> : null}
                    </article>
                  ))}
                  {selectedCompany.bankAccounts.length === 0 ? (
                    <p className="helper-text">{t('companies.noBankAccounts')}</p>
                  ) : null}
                </div>
              </section>
            </div>
          ) : null}

          {panelMode === 'company' ? (
            <form className="side-panel-form" onSubmit={handleCreateCompany}>
              <div className="panel-heading">
                <h2>{t('companies.create')}</h2>
                <button className="icon-text-button" type="button" onClick={closePanel}>
                  {t('companies.cancel')}
                </button>
              </div>
              <label>
                {t('companies.name')}
                <input value={companyName} onChange={(event) => setCompanyName(event.target.value)} required />
              </label>
              <div className="form-grid">
                <label>
                  {t('companies.ico')}
                  <input value={ico} onChange={(event) => setIco(event.target.value)} />
                </label>
                <label>
                  {t('companies.dic')}
                  <input value={dic} onChange={(event) => setDic(event.target.value)} />
                </label>
                <label>
                  {t('companies.icDph')}
                  <input value={icDph} onChange={(event) => setIcDph(event.target.value)} />
                </label>
                <label>
                  {t('companies.country')}
                  <input value={addressCountry} onChange={(event) => setAddressCountry(event.target.value)} />
                </label>
              </div>
              <button
                className="icon-text-button"
                disabled={resolvingIco || !ico.trim()}
                type="button"
                onClick={() => void handleResolveCompany()}
              >
                {resolvingIco ? t('companies.resolving') : t('companies.resolveByIco')}
              </button>
              <label>
                {t('companies.street')}
                <input value={addressStreet} onChange={(event) => setAddressStreet(event.target.value)} />
              </label>
              <div className="form-grid">
                <label>
                  {t('companies.number')}
                  <input value={addressNumber} onChange={(event) => setAddressNumber(event.target.value)} />
                </label>
                <label>
                  {t('companies.postalCode')}
                  <input value={addressPostalCode} onChange={(event) => setAddressPostalCode(event.target.value)} />
                </label>
              </div>
              <label>
                {t('companies.city')}
                <input value={addressCity} onChange={(event) => setAddressCity(event.target.value)} />
              </label>
              {resolvedBankAccounts.length > 0 ? (
                <section className="compact-list">
                  <span className="eyebrow">{t('companies.resolvedBankAccounts')}</span>
                  {resolvedBankAccounts.map((account) => (
                    <article className="compact-item" key={`${account.Ucet}-${account.Banka ?? ''}`}>
                      <strong>{account.Ucet}</strong>
                      <span>{account.Banka ?? '-'}</span>
                    </article>
                  ))}
                </section>
              ) : null}
              <button className="primary-button" disabled={submitting} type="submit">
                {t('companies.create')}
              </button>
            </form>
          ) : null}

          {panelMode === 'contact' ? (
            <form className="side-panel-form" onSubmit={handleCreateContact}>
              <div className="panel-heading">
                <h2>{t('companies.addContact')}</h2>
                <button className="icon-text-button" type="button" onClick={closePanel}>
                  {t('companies.cancel')}
                </button>
              </div>
              <div className="form-grid">
                <label>
                  {t('companies.contactName')}
                  <input value={contactName} onChange={(event) => setContactName(event.target.value)} required />
                </label>
                <label>
                  {t('companies.contactSurname')}
                  <input value={contactSurname} onChange={(event) => setContactSurname(event.target.value)} required />
                </label>
              </div>
              <label>
                {t('companies.role')}
                <input value={contactRole} onChange={(event) => setContactRole(event.target.value)} />
              </label>
              <label>
                {t('companies.email')}
                <input value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} type="email" />
              </label>
              <label>
                {t('companies.phone')}
                <input value={contactPhoneNumber} onChange={(event) => setContactPhoneNumber(event.target.value)} />
              </label>
              <label>
                {t('companies.dateOfBirth')}
                <input
                  value={contactDateOfBirth}
                  onChange={(event) => setContactDateOfBirth(event.target.value)}
                  type="date"
                />
              </label>
              <label className="checkbox-row">
                <input
                  checked={contactPreferred}
                  onChange={(event) => setContactPreferred(event.target.checked)}
                  type="checkbox"
                />
                {t('companies.preferred')}
              </label>
              <button className="primary-button" disabled={submitting || !selectedCompanyId} type="submit">
                {t('companies.addContact')}
              </button>
            </form>
          ) : null}

          {panelMode === 'bankAccount' ? (
            <form className="side-panel-form" onSubmit={handleCreateBankAccount}>
              <div className="panel-heading">
                <h2>{t('companies.addBankAccount')}</h2>
                <button className="icon-text-button" type="button" onClick={closePanel}>
                  {t('companies.cancel')}
                </button>
              </div>
              <label>
                {t('companies.bankAccountNumber')}
                <input
                  value={bankAccountNumber}
                  onChange={(event) => setBankAccountNumber(event.target.value)}
                  required
                />
              </label>
              <label>
                {t('companies.bankCode')}
                <input value={bankCode} onChange={(event) => setBankCode(event.target.value)} />
              </label>
              <label className="checkbox-row">
                <input
                  checked={bankPreferred}
                  onChange={(event) => setBankPreferred(event.target.checked)}
                  type="checkbox"
                />
                {t('companies.preferred')}
              </label>
              <button className="primary-button" disabled={submitting || !selectedCompanyId} type="submit">
                {t('companies.addBankAccount')}
              </button>
            </form>
          ) : null}
        </aside>
      ) : null}
    </main>
  );
}
