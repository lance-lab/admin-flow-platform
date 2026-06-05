import { Building2, Landmark, Pencil, Plus, Trash2, UserPlus } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { useI18n } from '../../../../apps/web/src/i18n/I18nProvider';
import { useNotifications } from '../../../../apps/web/src/shell/Notifications';
import {
  createBankAccount,
  createCompany,
  createContact,
  deleteBankAccount,
  deleteCompany,
  deleteContact,
  getCompany,
  listCompanies,
  resolveCompanyByIco,
  updateBankAccount,
  updateCompany,
  updateContact,
  type CompanyBankAccount,
  type CompanyContact,
  type CompanyDetail,
  type CompanyPersonRole,
  type CompanySummary
} from './api';

type PanelMode = 'closed' | 'detail' | 'company' | 'editCompany' | 'contact' | 'bankAccount';
type CreateSurface = 'main' | 'sidePanel';
type CreateMode = 'lookup' | 'manual';
type CreateStep = 'company' | 'persons' | 'bankAccounts' | 'review';
type CountryOption = {
  code: string;
  en: string;
  sk: string;
  aliases?: string[];
};

const EU_COUNTRIES: CountryOption[] = [
  { code: 'AT', en: 'Austria', sk: 'Rakúsko' },
  { code: 'BE', en: 'Belgium', sk: 'Belgicko' },
  { code: 'BG', en: 'Bulgaria', sk: 'Bulharsko' },
  { code: 'HR', en: 'Croatia', sk: 'Chorvátsko' },
  { code: 'CY', en: 'Cyprus', sk: 'Cyprus' },
  { code: 'CZ', en: 'Czech Republic', sk: 'Česká republika', aliases: ['CZ', 'Ceska republika'] },
  { code: 'DK', en: 'Denmark', sk: 'Dánsko' },
  { code: 'EE', en: 'Estonia', sk: 'Estónsko' },
  { code: 'FI', en: 'Finland', sk: 'Fínsko' },
  { code: 'FR', en: 'France', sk: 'Francúzsko' },
  { code: 'DE', en: 'Germany', sk: 'Nemecko' },
  { code: 'GR', en: 'Greece', sk: 'Grécko' },
  { code: 'HU', en: 'Hungary', sk: 'Maďarsko' },
  { code: 'IE', en: 'Ireland', sk: 'Írsko' },
  { code: 'IT', en: 'Italy', sk: 'Taliansko' },
  { code: 'LV', en: 'Latvia', sk: 'Lotyšsko' },
  { code: 'LT', en: 'Lithuania', sk: 'Litva' },
  { code: 'LU', en: 'Luxembourg', sk: 'Luxembursko' },
  { code: 'MT', en: 'Malta', sk: 'Malta' },
  { code: 'NL', en: 'Netherlands', sk: 'Holandsko' },
  { code: 'PL', en: 'Poland', sk: 'Poľsko' },
  { code: 'PT', en: 'Portugal', sk: 'Portugalsko' },
  { code: 'RO', en: 'Romania', sk: 'Rumunsko' },
  { code: 'SK', en: 'Slovakia', sk: 'Slovensko', aliases: ['SK', 'Slovenská republika'] },
  { code: 'SI', en: 'Slovenia', sk: 'Slovinsko' },
  { code: 'ES', en: 'Spain', sk: 'Španielsko' },
  { code: 'SE', en: 'Sweden', sk: 'Švédsko' }
];

const CREATE_STEPS: CreateStep[] = ['company', 'persons', 'bankAccounts', 'review'];

interface DraftContact {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  dateOfBirth: string;
  role: CompanyPersonRole | '';
  preferred: boolean;
}

const PERSON_ROLE_OPTIONS: CompanyPersonRole[] = [
  'board_member',
  'vice_chairman',
  'chairman',
  'executive_dictor',
  'owner'
];

const PERSON_ROLE_ALIASES: Record<string, CompanyPersonRole> = {
  board_member: 'board_member',
  'board member': 'board_member',
  'člen predstavenstva': 'board_member',
  vice_chairman: 'vice_chairman',
  'vice-chairman of the board': 'vice_chairman',
  'podpredseda predstavenstva': 'vice_chairman',
  chairman: 'chairman',
  'chairman of the board': 'chairman',
  'predseda predstavenstva': 'chairman',
  executive_dictor: 'executive_dictor',
  'executive director': 'executive_dictor',
  konateľ: 'executive_dictor',
  owner: 'owner',
  majiteľ: 'owner'
};

interface DraftBankAccount {
  id: string;
  bankAccountNumber: string;
  bankCode: string;
  preferred: boolean;
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function emptyRoleToNull(value: CompanyPersonRole | '') {
  return value || null;
}

function normalizeCountryName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function countryOption(value: string | null) {
  const normalized = normalizeCountryName(value ?? '');

  return (
    EU_COUNTRIES.find(
      (country) =>
        normalizeCountryName(country.code) === normalized ||
        normalizeCountryName(country.en) === normalized ||
        normalizeCountryName(country.sk) === normalized ||
        (country.aliases ?? []).some((alias) => normalizeCountryName(alias) === normalized)
    ) ?? EU_COUNTRIES.find((country) => country.code === 'SK')
  );
}

function countryEnglishName(value: string | null) {
  return countryOption(value)?.en ?? 'Slovakia';
}

function countryLabel(value: string | null, locale: 'en' | 'sk') {
  const country = countryOption(value);
  return country ? country[locale] : value ?? '';
}

function formatAddress(company: CompanySummary | CompanyDetail, locale: 'en' | 'sk') {
  return [
    [company.addressStreet, company.addressNumber].filter(Boolean).join(' '),
    [company.addressPostalCode, company.addressCity].filter(Boolean).join(' '),
    countryLabel(company.addressCountry, locale)
  ]
    .filter(Boolean)
    .join(', ');
}

function countryCode(value: string | null) {
  return countryOption(value)?.code ?? 'SK';
}

function normalizePersonRole(value: string | null | undefined): CompanyPersonRole | '' {
  const normalized = (value ?? '').trim().toLocaleLowerCase();
  return normalized ? (PERSON_ROLE_ALIASES[normalized] ?? '') : '';
}

function personRoleLabel(role: CompanyPersonRole | string | null | undefined, t: (key: string) => string) {
  const normalizedRole = normalizePersonRole(role);
  return normalizedRole ? t(`companies.personRole.${normalizedRole}`) : '-';
}

function draftId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isDraftAssociatedRecord(id: string) {
  return id.startsWith('draft-');
}

export function CompaniesModule() {
  const { locale, t } = useI18n();
  const { confirm, notify } = useNotifications();
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<CompanyDetail | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>('closed');
  const [createSurface, setCreateSurface] = useState<CreateSurface>('sidePanel');
  const [editCompanyId, setEditCompanyId] = useState<string | null>(null);
  const [deletedContactIds, setDeletedContactIds] = useState<string[]>([]);
  const [deletedBankAccountIds, setDeletedBankAccountIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [resolvingIco, setResolvingIco] = useState(false);
  const [createMode, setCreateMode] = useState<CreateMode>('lookup');
  const [createStep, setCreateStep] = useState<CreateStep>('company');
  const [lookupComplete, setLookupComplete] = useState(false);

  const [companyName, setCompanyName] = useState('');
  const [ico, setIco] = useState('');
  const [dic, setDic] = useState('');
  const [icDph, setIcDph] = useState('');
  const [addressStreet, setAddressStreet] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [addressCity, setAddressCity] = useState('');
  const [addressCountry, setAddressCountry] = useState('Slovakia');
  const [addressPostalCode, setAddressPostalCode] = useState('');
  const [contractingAuthority, setContractingAuthority] = useState(false);

  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhoneNumber, setContactPhoneNumber] = useState('');
  const [contactDateOfBirth, setContactDateOfBirth] = useState('');
  const [contactRole, setContactRole] = useState<CompanyPersonRole | ''>('');
  const [contactPreferred, setContactPreferred] = useState(false);

  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [bankPreferred, setBankPreferred] = useState(false);

  const [draftContacts, setDraftContacts] = useState<DraftContact[]>([]);
  const [draftContactName, setDraftContactName] = useState('');
  const [draftContactEmail, setDraftContactEmail] = useState('');
  const [draftContactPhoneNumber, setDraftContactPhoneNumber] = useState('');
  const [draftContactDateOfBirth, setDraftContactDateOfBirth] = useState('');
  const [draftContactRole, setDraftContactRole] = useState<CompanyPersonRole | ''>('');
  const [draftContactPreferred, setDraftContactPreferred] = useState(false);
  const [showDraftContactForm, setShowDraftContactForm] = useState(false);

  const [draftBankAccounts, setDraftBankAccounts] = useState<DraftBankAccount[]>([]);
  const [draftBankAccountNumber, setDraftBankAccountNumber] = useState('');
  const [draftBankCode, setDraftBankCode] = useState('');
  const [draftBankPreferred, setDraftBankPreferred] = useState(false);
  const [showDraftBankAccountForm, setShowDraftBankAccountForm] = useState(false);

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
    setCreateSurface('sidePanel');
    setEditCompanyId(null);
    setDeletedContactIds([]);
    setDeletedBankAccountIds([]);
  }

  function resetCompanyForm() {
    setCreateMode('lookup');
    setCreateStep('company');
    setLookupComplete(false);
    setCompanyName('');
    setIco('');
    setDic('');
    setIcDph('');
    setAddressStreet('');
    setAddressNumber('');
    setAddressCity('');
    setAddressCountry('Slovakia');
    setAddressPostalCode('');
    setContractingAuthority(false);
    setDraftContacts([]);
    setDraftBankAccounts([]);
    setShowDraftContactForm(false);
    setShowDraftBankAccountForm(false);
    resetDraftContactForm();
    resetDraftBankAccountForm();
  }

  function populateCompanyForm(company: CompanySummary | CompanyDetail) {
    setCompanyName(company.name);
    setIco(company.ico ?? '');
    setDic(company.dic ?? '');
    setIcDph(company.icDph ?? '');
    setAddressStreet(company.addressStreet ?? '');
    setAddressNumber(company.addressNumber ?? '');
    setAddressCity(company.addressCity ?? '');
    setAddressCountry(countryEnglishName(company.addressCountry));
    setAddressPostalCode(company.addressPostalCode ?? '');
    setContractingAuthority(company.contractingAuthority);
  }

  function updateSelectedContact(contactId: string, patch: Partial<CompanyContact>) {
    setSelectedCompany((currentCompany) =>
      currentCompany
        ? {
            ...currentCompany,
            contacts: currentCompany.contacts.map((contact) =>
              contact.id === contactId ? { ...contact, ...patch } : contact
            )
          }
        : currentCompany
    );
  }

  function removeSelectedContact(contactId: string) {
    if (!isDraftAssociatedRecord(contactId)) {
      setDeletedContactIds((currentIds) => [...currentIds, contactId]);
    }
    setSelectedCompany((currentCompany) =>
      currentCompany
        ? {
            ...currentCompany,
            contacts: currentCompany.contacts.filter((contact) => contact.id !== contactId)
          }
        : currentCompany
    );
  }

  function addSelectedContact() {
    setSelectedCompany((currentCompany) =>
      currentCompany
        ? {
            ...currentCompany,
            contacts: [
              ...currentCompany.contacts,
              {
                id: `draft-${draftId()}`,
                name: '',
                email: '',
                phoneNumber: '',
                dateOfBirth: '',
                role: null,
                preferred: false
              }
            ]
          }
        : currentCompany
    );
  }

  function updateSelectedBankAccount(bankAccountId: string, patch: Partial<CompanyBankAccount>) {
    setSelectedCompany((currentCompany) =>
      currentCompany
        ? {
            ...currentCompany,
            bankAccounts: currentCompany.bankAccounts.map((bankAccount) =>
              bankAccount.id === bankAccountId ? { ...bankAccount, ...patch } : bankAccount
            )
          }
        : currentCompany
    );
  }

  function removeSelectedBankAccount(bankAccountId: string) {
    if (!isDraftAssociatedRecord(bankAccountId)) {
      setDeletedBankAccountIds((currentIds) => [...currentIds, bankAccountId]);
    }
    setSelectedCompany((currentCompany) =>
      currentCompany
        ? {
            ...currentCompany,
            bankAccounts: currentCompany.bankAccounts.filter((bankAccount) => bankAccount.id !== bankAccountId)
          }
        : currentCompany
    );
  }

  function addSelectedBankAccount() {
    setSelectedCompany((currentCompany) =>
      currentCompany
        ? {
            ...currentCompany,
            bankAccounts: [
              ...currentCompany.bankAccounts,
              {
                id: `draft-${draftId()}`,
                bankAccountNumber: '',
                bankCode: '',
                preferred: false
              }
            ]
          }
        : currentCompany
    );
  }

  function resetContactForm() {
    setContactName('');
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

  function resetDraftContactForm() {
    setDraftContactName('');
    setDraftContactEmail('');
    setDraftContactPhoneNumber('');
    setDraftContactDateOfBirth('');
    setDraftContactRole('');
    setDraftContactPreferred(false);
  }

  function resetDraftBankAccountForm() {
    setDraftBankAccountNumber('');
    setDraftBankCode('');
    setDraftBankPreferred(false);
  }

  function openCreateCompany() {
    resetCompanyForm();
    setCreateSurface('main');
    setPanelMode('company');
  }

  async function openEditCompany(companyId: string) {
    const { company } = await getCompany(companyId);
    resetCompanyForm();
    populateCompanyForm(company);
    setSelectedCompanyId(company.id);
    setSelectedCompany(company);
    setEditCompanyId(company.id);
    setDeletedContactIds([]);
    setDeletedBankAccountIds([]);
    setCreateSurface('main');
    setPanelMode('editCompany');
  }

  async function handleCreateCompany(event: FormEvent) {
    event.preventDefault();

    if (createStep !== 'review') {
      goToNextCreateStep();
      return;
    }

    setSubmitting(true);

    try {
      const { company } = await createCompany({
        name: companyName.trim(),
        ico: emptyToNull(ico),
        dic: emptyToNull(dic),
        icDph: emptyToNull(icDph),
        addressStreet: emptyToNull(addressStreet),
        addressNumber: emptyToNull(addressNumber),
        addressCity: emptyToNull(addressCity),
        addressCountry: countryEnglishName(addressCountry),
        addressPostalCode: emptyToNull(addressPostalCode),
        contractingAuthority
      });

      try {
        for (const contact of draftContacts) {
          await createContact(company.id, {
            name: contact.name,
            email: emptyToNull(contact.email),
            phoneNumber: emptyToNull(contact.phoneNumber),
            dateOfBirth: emptyToNull(contact.dateOfBirth),
            role: emptyRoleToNull(contact.role),
            preferred: contact.preferred
          });
        }

        for (const bankAccount of draftBankAccounts) {
          await createBankAccount(company.id, {
            bankAccountNumber: bankAccount.bankAccountNumber,
            bankCode: emptyToNull(bankAccount.bankCode),
            preferred: bankAccount.preferred
          });
        }
      } catch (error) {
        await deleteCompany(company.id);
        throw error;
      }

      notify({ type: 'success', message: t('companies.created') });
      resetCompanyForm();
      await loadCompanies(company.id);
      closePanel();
    } catch {
      notify({ type: 'error', message: t('companies.createError') });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateCompany(event: FormEvent) {
    event.preventDefault();

    if (!editCompanyId || !selectedCompany) {
      return;
    }

    const companyToUpdate = selectedCompany;

    setSubmitting(true);

    try {
      await updateCompany(editCompanyId, {
        name: companyName.trim(),
        ico: emptyToNull(ico),
        dic: emptyToNull(dic),
        icDph: emptyToNull(icDph),
        addressStreet: emptyToNull(addressStreet),
        addressNumber: emptyToNull(addressNumber),
        addressCity: emptyToNull(addressCity),
        addressCountry: countryEnglishName(addressCountry),
        addressPostalCode: emptyToNull(addressPostalCode),
        contractingAuthority
      });

      for (const contact of companyToUpdate.contacts) {
        const input = {
          name: contact.name.trim(),
          email: emptyToNull(contact.email ?? ''),
          phoneNumber: emptyToNull(contact.phoneNumber ?? ''),
          dateOfBirth: emptyToNull(contact.dateOfBirth ?? ''),
          role: emptyRoleToNull(normalizePersonRole(contact.role)),
          preferred: contact.preferred
        };

        if (isDraftAssociatedRecord(contact.id)) {
          await createContact(editCompanyId, input);
        } else {
          await updateContact(editCompanyId, contact.id, input);
        }
      }

      for (const bankAccount of companyToUpdate.bankAccounts) {
        const input = {
          bankAccountNumber: bankAccount.bankAccountNumber.trim(),
          bankCode: emptyToNull(bankAccount.bankCode ?? ''),
          preferred: bankAccount.preferred
        };

        if (isDraftAssociatedRecord(bankAccount.id)) {
          await createBankAccount(editCompanyId, input);
        } else {
          await updateBankAccount(editCompanyId, bankAccount.id, input);
        }
      }

      for (const contactId of deletedContactIds) {
        await deleteContact(editCompanyId, contactId);
      }

      for (const bankAccountId of deletedBankAccountIds) {
        await deleteBankAccount(editCompanyId, bankAccountId);
      }

      notify({ type: 'success', message: t('companies.updated') });
      await loadCompanies(editCompanyId);
      closePanel();
    } catch {
      notify({ type: 'error', message: t('companies.updateError') });
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
      const resolved = await resolveCompanyByIco(normalizedIco, countryCode(addressCountry));
      setCompanyName(resolved.name ?? '');
      setIco(resolved.ico ?? normalizedIco);
      setDic(resolved.dic ?? '');
      setIcDph(resolved.icDph ?? '');
      setAddressStreet(resolved.addressStreet ?? '');
      setAddressNumber(resolved.addressNumber ?? '');
      setAddressCity(resolved.addressCity ?? '');
      setAddressCountry(countryEnglishName(resolved.addressCountry));
      setAddressPostalCode(resolved.addressPostalCode ?? '');
      setDraftContacts(
        (resolved.statutoryBodies ?? [])
          .filter((person) => person.name?.trim())
          .map((person) => ({
            id: draftId(),
            name: person.name?.trim() ?? '',
            email: '',
            phoneNumber: '',
            dateOfBirth: '',
            role: normalizePersonRole(person.role),
            preferred: false
          }))
      );
      setDraftBankAccounts(
        (resolved.bankAccounts ?? []).map((account) => ({
          id: draftId(),
          bankAccountNumber: account.bankAccountNumber,
          bankCode: account.bankCode ?? '',
          preferred: false
        }))
      );
      setLookupComplete(true);
      notify({ type: 'success', message: t('companies.resolved') });
    } catch {
      notify({ type: 'error', message: t('companies.resolveError') });
    } finally {
      setResolvingIco(false);
    }
  }

  function handleCreateModeChange(nextMode: CreateMode) {
    setCreateMode(nextMode);
    setCreateStep('company');
    setLookupComplete(nextMode === 'manual');
  }

  function handleAddDraftContact() {
    if (!draftContactName.trim()) {
      return;
    }

    setDraftContacts((currentContacts) => [
      ...currentContacts,
      {
        id: draftId(),
        name: draftContactName.trim(),
        email: draftContactEmail.trim(),
        phoneNumber: draftContactPhoneNumber.trim(),
        dateOfBirth: draftContactDateOfBirth,
        role: draftContactRole,
        preferred: draftContactPreferred
      }
    ]);
    resetDraftContactForm();
    setShowDraftContactForm(false);
  }

  function handleAddDraftBankAccount() {
    if (!draftBankAccountNumber.trim()) {
      return;
    }

    setDraftBankAccounts((currentAccounts) => [
      ...currentAccounts,
      {
        id: draftId(),
        bankAccountNumber: draftBankAccountNumber.trim(),
        bankCode: draftBankCode.trim(),
        preferred: draftBankPreferred
      }
    ]);
    resetDraftBankAccountForm();
    setShowDraftBankAccountForm(false);
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
        email: emptyToNull(contactEmail),
        phoneNumber: emptyToNull(contactPhoneNumber),
        dateOfBirth: emptyToNull(contactDateOfBirth),
        role: emptyRoleToNull(contactRole),
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
        bankAccountNumber: bankAccountNumber.trim(),
        bankCode: emptyToNull(bankCode),
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

  const showCreateDraftForm = createMode === 'manual' || lookupComplete;
  const createStepIndex = CREATE_STEPS.indexOf(createStep);
  const canContinueFromCompany = showCreateDraftForm && Boolean(companyName.trim());
  const canOpenCreateStep = (step: CreateStep) => step === 'company' || canContinueFromCompany;
  const showMainCreateCompany = panelMode === 'company' && createSurface === 'main';
  const showMainEditCompany = panelMode === 'editCompany';
  const showMainCompanyForm = showMainCreateCompany || showMainEditCompany;
  const canSaveEditCompany =
    Boolean(companyName.trim()) &&
    (selectedCompany?.contacts.every((contact) => contact.name.trim()) ?? true) &&
    (selectedCompany?.bankAccounts.every((bankAccount) => bankAccount.bankAccountNumber.trim()) ?? true);

  function goToCreateStep(step: CreateStep) {
    if (canOpenCreateStep(step)) {
      setCreateStep(step);
    }
  }

  function goToNextCreateStep() {
    const nextStep = CREATE_STEPS[createStepIndex + 1];
    if (nextStep && canOpenCreateStep(nextStep)) {
      setCreateStep(nextStep);
    }
  }

  function goToPreviousCreateStep() {
    const previousStep = CREATE_STEPS[createStepIndex - 1];
    if (previousStep) {
      setCreateStep(previousStep);
    }
  }

  return (
    <main className="page">
      <section className="page-header">
        <div>
          <span className="eyebrow">{t('companies.eyebrow')}</span>
          <h1>{t('companies.title')}</h1>
        </div>
        {!showMainCompanyForm ? (
          <button className="primary-button page-action-button" type="button" onClick={openCreateCompany}>
            <Plus aria-hidden="true" />
            {t('companies.create')}
          </button>
        ) : null}
      </section>

      {!showMainCompanyForm ? (
        <section className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('companies.name')}</th>
                <th>{t('companies.ico')}</th>
                <th>{t('companies.city')}</th>
                <th>{t('companies.contractingAuthorityShort')}</th>
                <th>{t('companies.contacts')}</th>
                <th>{t('companies.bankAccounts')}</th>
                <th className="table-action-column">{t('companies.actions')}</th>
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
                  <td>{company.contractingAuthority ? t('companies.yes') : t('companies.no')}</td>
                  <td>{company.contactCount}</td>
                  <td>{company.bankAccountCount}</td>
                  <td className="table-action-column">
                    <button
                      className="icon-text-button"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void openEditCompany(company.id);
                      }}
                    >
                      <Pencil aria-hidden="true" />
                      {t('companies.edit')}
                    </button>
                  </td>
                </tr>
              ))}
              {companies.length === 0 ? (
                <tr>
                  <td colSpan={7}>{t('companies.empty')}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      ) : null}

      {panelMode !== 'closed' ? (
        <aside
          className={
            panelMode === 'detail'
              ? 'side-panel detail-side-panel'
              : panelMode === 'company' || panelMode === 'editCompany'
                ? `side-panel create-side-panel${createSurface === 'main' ? ' company-main-panel' : ''}`
                : 'side-panel'
          }
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
                  <dd>{formatAddress(selectedCompany, locale) || '-'}</dd>
                </div>
                <div>
                  <dt>{t('companies.contractingAuthority')}</dt>
                  <dd>{selectedCompany.contractingAuthority ? t('companies.yes') : t('companies.no')}</dd>
                </div>
              </dl>

              <section className="detail-section">
                <div className="section-heading-row">
                  <h3>{t('companies.contacts')}</h3>
                </div>
                <div className="compact-list">
                  {selectedCompany.contacts.map((contact) => (
                    <article className="compact-item" key={contact.id}>
                      <strong>{contact.name}</strong>
                      <span>{personRoleLabel(contact.role, t)}</span>
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
                </div>
                <div className="compact-list">
                  {selectedCompany.bankAccounts.map((account) => (
                    <article className="compact-item bank-account-summary" key={account.id}>
                      <strong className="bank-account-number">{account.bankAccountNumber}</strong>
                      <span className="bank-account-bank">{account.bankCode ?? '-'}</span>
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

              <div className="create-stepper" role="tablist" aria-label={t('companies.createSteps')}>
                {CREATE_STEPS.map((step, index) => (
                  <button
                    aria-selected={createStep === step}
                    className={createStep === step ? 'active' : undefined}
                    disabled={!canOpenCreateStep(step)}
                    key={step}
                    type="button"
                    onClick={() => goToCreateStep(step)}
                  >
                    <span>{index + 1}</span>
                    {t(`companies.createStep.${step}`)}
                  </button>
                ))}
              </div>

              {createStep === 'company' ? (
                <>
                  <div className="segmented-control" role="group" aria-label={t('companies.createMode')}>
                    <button
                      className={createMode === 'lookup' ? 'active' : undefined}
                      type="button"
                      onClick={() => handleCreateModeChange('lookup')}
                    >
                      {t('companies.createMode.lookup')}
                    </button>
                    <button
                      className={createMode === 'manual' ? 'active' : undefined}
                      type="button"
                      onClick={() => handleCreateModeChange('manual')}
                    >
                      {t('companies.createMode.manual')}
                    </button>
                  </div>

                  {createMode === 'lookup' ? (
                    <section className="draft-section">
                      <span className="eyebrow">{t('companies.resolveByIco')}</span>
                      <div className="form-grid">
                        <label>
                          {t('companies.ico')}
                          <input value={ico} onChange={(event) => setIco(event.target.value)} />
                        </label>
                        <label>
                          {t('companies.country')}
                          <select value={addressCountry} onChange={(event) => setAddressCountry(event.target.value)}>
                            {EU_COUNTRIES.map((country) => (
                              <option key={country.code} value={country.en}>
                                {country[locale]}
                              </option>
                            ))}
                          </select>
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
                    </section>
                  ) : null}

                  {showCreateDraftForm ? (
                    <section className="draft-section">
                      <span className="eyebrow">{t('companies.companyDetails')}</span>
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
                          <select value={addressCountry} onChange={(event) => setAddressCountry(event.target.value)}>
                            {EU_COUNTRIES.map((country) => (
                              <option key={country.code} value={country.en}>
                                {country[locale]}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
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
                          <input
                            value={addressPostalCode}
                            onChange={(event) => setAddressPostalCode(event.target.value)}
                          />
                        </label>
                      </div>
                      <label>
                        {t('companies.city')}
                        <input value={addressCity} onChange={(event) => setAddressCity(event.target.value)} />
                      </label>
                      <label className="checkbox-row">
                        <input
                          checked={contractingAuthority}
                          onChange={(event) => setContractingAuthority(event.target.checked)}
                          type="checkbox"
                        />
                        {t('companies.contractingAuthority')}
                      </label>
                    </section>
                  ) : null}
                </>
              ) : null}

              {createStep === 'persons' ? (
                <section className="draft-section">
                  <div className="section-heading-row">
                    <h3>{t('companies.draftContacts')}</h3>
                    <button
                      className="icon-text-button"
                      type="button"
                      disabled={showDraftContactForm && !draftContactName.trim()}
                      onClick={() => {
                        if (showDraftContactForm) {
                          handleAddDraftContact();
                        } else {
                          setShowDraftContactForm(true);
                        }
                      }}
                    >
                      <UserPlus aria-hidden="true" />
                      {t('companies.addContact')}
                    </button>
                  </div>
                  {showDraftContactForm ? (
                    <div className="inline-add-form">
                      <label>
                        {t('companies.contactName')}
                        <input value={draftContactName} onChange={(event) => setDraftContactName(event.target.value)} />
                      </label>
                      <label>
                        {t('companies.role')}
                        <select
                          value={draftContactRole}
                          onChange={(event) => setDraftContactRole(event.target.value as CompanyPersonRole | '')}
                        >
                          <option value="">{t('companies.noRole')}</option>
                          {PERSON_ROLE_OPTIONS.map((role) => (
                            <option key={role} value={role}>
                              {t(`companies.personRole.${role}`)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        {t('companies.email')}
                        <input
                          value={draftContactEmail}
                          onChange={(event) => setDraftContactEmail(event.target.value)}
                          type="email"
                        />
                      </label>
                      <label>
                        {t('companies.phone')}
                        <input
                          value={draftContactPhoneNumber}
                          onChange={(event) => setDraftContactPhoneNumber(event.target.value)}
                        />
                      </label>
                      <label>
                        {t('companies.dateOfBirth')}
                        <input
                          value={draftContactDateOfBirth}
                          onChange={(event) => setDraftContactDateOfBirth(event.target.value)}
                          type="date"
                        />
                      </label>
                      <label className="checkbox-row">
                        <input
                          checked={draftContactPreferred}
                          onChange={(event) => setDraftContactPreferred(event.target.checked)}
                          type="checkbox"
                        />
                        {t('companies.preferred')}
                      </label>
                    </div>
                  ) : null}
                  <div className="compact-list">
                    {draftContacts.map((contact) => (
                      <article className="compact-item draft-item" key={contact.id}>
                        <div className="contact-summary">
                          <strong className="contact-name">{contact.name}</strong>
                          <span className="contact-role">{personRoleLabel(contact.role, t)}</span>
                          <span>{[contact.email, contact.phoneNumber].filter(Boolean).join(' / ') || '-'}</span>
                        </div>
                        <button
                          className="icon-only-button"
                          type="button"
                          aria-label={t('companies.remove')}
                          onClick={() =>
                            setDraftContacts((currentContacts) =>
                              currentContacts.filter((currentContact) => currentContact.id !== contact.id)
                            )
                          }
                        >
                          <Trash2 aria-hidden="true" />
                        </button>
                      </article>
                    ))}
                    {draftContacts.length === 0 ? (
                      <p className="helper-text">{t('companies.noDraftContacts')}</p>
                    ) : null}
                  </div>
                </section>
              ) : null}

              {createStep === 'bankAccounts' ? (
                <section className="draft-section">
                  <div className="section-heading-row">
                    <h3>{t('companies.draftBankAccounts')}</h3>
                    <button
                      className="icon-text-button"
                      type="button"
                      disabled={showDraftBankAccountForm && !draftBankAccountNumber.trim()}
                      onClick={() => {
                        if (showDraftBankAccountForm) {
                          handleAddDraftBankAccount();
                        } else {
                          setShowDraftBankAccountForm(true);
                        }
                      }}
                    >
                      <Landmark aria-hidden="true" />
                      {t('companies.addBankAccount')}
                    </button>
                  </div>
                  {showDraftBankAccountForm ? (
                    <div className="inline-add-form">
                      <label>
                        {t('companies.bankAccountNumber')}
                        <input
                          value={draftBankAccountNumber}
                          onChange={(event) => setDraftBankAccountNumber(event.target.value)}
                        />
                      </label>
                      <label>
                        {t('companies.bankCode')}
                        <input value={draftBankCode} onChange={(event) => setDraftBankCode(event.target.value)} />
                      </label>
                      <label className="checkbox-row">
                        <input
                          checked={draftBankPreferred}
                          onChange={(event) => setDraftBankPreferred(event.target.checked)}
                          type="checkbox"
                        />
                        {t('companies.preferred')}
                      </label>
                    </div>
                  ) : null}
                  <div className="compact-list">
                    {draftBankAccounts.map((account) => (
                      <article className="compact-item draft-item" key={account.id}>
                        <div className="bank-account-summary">
                          <strong className="bank-account-number">{account.bankAccountNumber}</strong>
                          <span className="bank-account-bank">{account.bankCode || '-'}</span>
                          {account.preferred ? <span className="mini-pill">{t('companies.preferred')}</span> : null}
                        </div>
                        <button
                          className="icon-only-button"
                          type="button"
                          aria-label={t('companies.remove')}
                          onClick={() =>
                            setDraftBankAccounts((currentAccounts) =>
                              currentAccounts.filter((currentAccount) => currentAccount.id !== account.id)
                            )
                          }
                        >
                          <Trash2 aria-hidden="true" />
                        </button>
                      </article>
                    ))}
                    {draftBankAccounts.length === 0 ? (
                      <p className="helper-text">{t('companies.noDraftBankAccounts')}</p>
                    ) : null}
                  </div>
                </section>
              ) : null}

              {createStep === 'review' ? (
                <section className="draft-section">
                  <span className="eyebrow">{t('companies.review')}</span>
                  <dl className="detail-list">
                    <div>
                      <dt>{t('companies.name')}</dt>
                      <dd>{companyName || '-'}</dd>
                    </div>
                    <div>
                      <dt>{t('companies.ico')}</dt>
                      <dd>{ico || '-'}</dd>
                    </div>
                    <div>
                      <dt>{t('companies.icDph')}</dt>
                      <dd>{icDph || '-'}</dd>
                    </div>
                    <div>
                      <dt>{t('companies.address')}</dt>
                      <dd>
                        {[
                          [addressStreet, addressNumber].filter(Boolean).join(' '),
                          [addressPostalCode, addressCity].filter(Boolean).join(' '),
                          countryLabel(addressCountry, locale)
                        ]
                          .filter(Boolean)
                          .join(', ') || '-'}
                      </dd>
                    </div>
                    <div>
                      <dt>{t('companies.contractingAuthority')}</dt>
                      <dd>{contractingAuthority ? t('companies.yes') : t('companies.no')}</dd>
                    </div>
                  </dl>

                  <div className="review-summary">
                    <h3>{t('companies.contacts')}</h3>
                    <div className="compact-list">
                      {draftContacts.map((contact) => (
                        <article className="compact-item" key={contact.id}>
                          <strong>{contact.name}</strong>
                          <span>{personRoleLabel(contact.role, t)}</span>
                          <span>{[contact.email, contact.phoneNumber].filter(Boolean).join(' / ') || '-'}</span>
                        </article>
                      ))}
                      {draftContacts.length === 0 ? (
                        <p className="helper-text">{t('companies.noDraftContacts')}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="review-summary">
                    <h3>{t('companies.bankAccounts')}</h3>
                    <div className="compact-list">
                      {draftBankAccounts.map((account) => (
                        <article className="compact-item bank-account-summary" key={account.id}>
                          <strong className="bank-account-number">{account.bankAccountNumber}</strong>
                          <span className="bank-account-bank">{account.bankCode || '-'}</span>
                          {account.preferred ? <span className="mini-pill">{t('companies.preferred')}</span> : null}
                        </article>
                      ))}
                      {draftBankAccounts.length === 0 ? (
                        <p className="helper-text">{t('companies.noDraftBankAccounts')}</p>
                      ) : null}
                    </div>
                  </div>
                </section>
              ) : null}

              <div className="create-step-actions">
                <button
                  className="icon-text-button"
                  disabled={createStepIndex === 0}
                  type="button"
                  onClick={goToPreviousCreateStep}
                >
                  {t('companies.back')}
                </button>
                {createStep === 'review' ? (
                  <button className="primary-button" disabled={submitting || !canContinueFromCompany} type="submit">
                    {t('companies.create')}
                  </button>
                ) : (
                  <button
                    className="primary-button"
                    disabled={!canContinueFromCompany}
                    type="button"
                    onClick={goToNextCreateStep}
                  >
                    {t('companies.next')}
                  </button>
                )}
              </div>
            </form>
          ) : null}

          {panelMode === 'editCompany' && selectedCompany ? (
            <form className="side-panel-form" onSubmit={handleUpdateCompany}>
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">{t('companies.selected')}</span>
                  <h2>{t('companies.editCompany')}</h2>
                </div>
                <button className="icon-text-button" type="button" onClick={closePanel}>
                  {t('companies.cancel')}
                </button>
              </div>

              <section className="draft-section">
                <span className="eyebrow">{t('companies.companyDetails')}</span>
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
                    <select value={addressCountry} onChange={(event) => setAddressCountry(event.target.value)}>
                      {EU_COUNTRIES.map((country) => (
                        <option key={country.code} value={country.en}>
                          {country[locale]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
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
                <label className="checkbox-row">
                  <input
                    checked={contractingAuthority}
                    onChange={(event) => setContractingAuthority(event.target.checked)}
                    type="checkbox"
                  />
                  {t('companies.contractingAuthority')}
                </label>
              </section>

              <section className="draft-section">
                <div className="section-heading-row">
                  <h3>{t('companies.contacts')}</h3>
                  <button className="icon-text-button" type="button" onClick={addSelectedContact}>
                    <UserPlus aria-hidden="true" />
                    {t('companies.addContact')}
                  </button>
                </div>
                <div className="inline-edit-list">
                  {selectedCompany.contacts.map((contact) => (
                    <article className="compact-item associated-edit-item" key={contact.id}>
                      <div className="form-grid">
                        <label>
                          {t('companies.contactName')}
                          <input
                            value={contact.name}
                            onChange={(event) => updateSelectedContact(contact.id, { name: event.target.value })}
                            required
                          />
                        </label>
                        <label>
                          {t('companies.role')}
                          <select
                            value={contact.role ?? ''}
                            onChange={(event) =>
                              updateSelectedContact(contact.id, {
                                role: (event.target.value || null) as CompanyPersonRole | null
                              })
                            }
                          >
                            <option value="">{t('companies.noRole')}</option>
                            {PERSON_ROLE_OPTIONS.map((role) => (
                              <option key={role} value={role}>
                                {t(`companies.personRole.${role}`)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          {t('companies.email')}
                          <input
                            value={contact.email ?? ''}
                            onChange={(event) => updateSelectedContact(contact.id, { email: event.target.value })}
                            type="email"
                          />
                        </label>
                        <label>
                          {t('companies.phone')}
                          <input
                            value={contact.phoneNumber ?? ''}
                            onChange={(event) =>
                              updateSelectedContact(contact.id, { phoneNumber: event.target.value })
                            }
                          />
                        </label>
                        <label>
                          {t('companies.dateOfBirth')}
                          <input
                            value={contact.dateOfBirth ?? ''}
                            onChange={(event) =>
                              updateSelectedContact(contact.id, { dateOfBirth: event.target.value })
                            }
                            type="date"
                          />
                        </label>
                        <label className="checkbox-row">
                          <input
                            checked={contact.preferred}
                            onChange={(event) => updateSelectedContact(contact.id, { preferred: event.target.checked })}
                            type="checkbox"
                          />
                          {t('companies.preferred')}
                        </label>
                      </div>
                      <button
                        className="icon-only-button"
                        type="button"
                        aria-label={t('companies.remove')}
                        onClick={() => removeSelectedContact(contact.id)}
                      >
                        <Trash2 aria-hidden="true" />
                      </button>
                    </article>
                  ))}
                  {selectedCompany.contacts.length === 0 ? (
                    <p className="helper-text">{t('companies.noContacts')}</p>
                  ) : null}
                </div>
              </section>

              <section className="draft-section">
                <div className="section-heading-row">
                  <h3>{t('companies.bankAccounts')}</h3>
                  <button className="icon-text-button" type="button" onClick={addSelectedBankAccount}>
                    <Landmark aria-hidden="true" />
                    {t('companies.addBankAccount')}
                  </button>
                </div>
                <div className="inline-edit-list">
                  {selectedCompany.bankAccounts.map((bankAccount) => (
                    <article className="compact-item associated-edit-item" key={bankAccount.id}>
                      <div className="form-grid">
                        <label>
                          {t('companies.bankAccountNumber')}
                          <input
                            value={bankAccount.bankAccountNumber}
                            onChange={(event) =>
                              updateSelectedBankAccount(bankAccount.id, { bankAccountNumber: event.target.value })
                            }
                            required
                          />
                        </label>
                        <label>
                          {t('companies.bankCode')}
                          <input
                            value={bankAccount.bankCode ?? ''}
                            onChange={(event) =>
                              updateSelectedBankAccount(bankAccount.id, { bankCode: event.target.value })
                            }
                          />
                        </label>
                        <label className="checkbox-row">
                          <input
                            checked={bankAccount.preferred}
                            onChange={(event) =>
                              updateSelectedBankAccount(bankAccount.id, { preferred: event.target.checked })
                            }
                            type="checkbox"
                          />
                          {t('companies.preferred')}
                        </label>
                      </div>
                      <button
                        className="icon-only-button"
                        type="button"
                        aria-label={t('companies.remove')}
                        onClick={() => removeSelectedBankAccount(bankAccount.id)}
                      >
                        <Trash2 aria-hidden="true" />
                      </button>
                    </article>
                  ))}
                  {selectedCompany.bankAccounts.length === 0 ? (
                    <p className="helper-text">{t('companies.noBankAccounts')}</p>
                  ) : null}
                </div>
              </section>

              <div className="create-step-actions">
                <button
                  className="danger-button"
                  disabled={submitting}
                  type="button"
                  onClick={() => void handleDeleteCompany(selectedCompany)}
                >
                  <Trash2 aria-hidden="true" />
                  {t('companies.delete')}
                </button>
                <button className="primary-button" disabled={submitting || !canSaveEditCompany} type="submit">
                  {t('companies.save')}
                </button>
              </div>
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
              <label>
                {t('companies.contactName')}
                <input value={contactName} onChange={(event) => setContactName(event.target.value)} required />
              </label>
              <label>
                {t('companies.role')}
                <select
                  value={contactRole}
                  onChange={(event) => setContactRole(event.target.value as CompanyPersonRole | '')}
                >
                  <option value="">{t('companies.noRole')}</option>
                  {PERSON_ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {t(`companies.personRole.${role}`)}
                    </option>
                  ))}
                </select>
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
