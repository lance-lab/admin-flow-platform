import { ClipboardList, Download, Pencil, Plus, Trash2 } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../../../apps/web/src/i18n/I18nProvider';
import { useNotifications } from '../../../../apps/web/src/shell/Notifications';
import {
  createProcurementContract,
  getContractingAuthorityCompany,
  getTendersOverview,
  listContractingAuthorityCompanies,
  listProcurementContracts,
  updateProcurementContract,
  type CompanyBankAccountSummary,
  type CompanyContactSummary,
  type ContractingAuthorityCompanyDetail,
  type ContractingAuthorityCompanySummary,
  type ProcurementContractSummary,
  type ProcurementItemInput,
  type ProcurementItemUnit,
  type ProcurementType,
  type TenderType,
  type TendersOverview
} from './api';

type ViewMode = 'list' | 'create' | 'edit';
type PanelMode = 'closed' | 'detail';
type DraftItem = ProcurementItemInput & { id: string };
type ExportRow = { label: string; value: string | number | boolean | null };
type CompanyAssociationValue = {
  companyId: string;
  contactPersonId: string;
  bankAccountId: string;
};

const TENDER_TYPES: TenderType[] = ['survey', 'competition'];
const PROCUREMENT_TYPES: ProcurementType[] = ['goods', 'services', 'works'];
const PROCUREMENT_ITEM_UNITS: ProcurementItemUnit[] = ['pcs', 'm', 'kg'];
const CAPABILITY_TRANSLATION_KEYS: Record<string, string> = {
  'Tender records': 'tenders.capabilities.tenderRecords',
  Measures: 'tenders.capabilities.measures',
  'Procurement contracts': 'tenders.capabilities.procurementContracts',
  'Procurement items': 'tenders.capabilities.procurementItems',
  'Contract list and creation': 'tenders.capabilities.contractListAndCreation'
};

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function numberToNull(value: string) {
  const normalized = value.replace(/,/g, '').trim();
  const parsed = normalized ? Number(normalized) : null;
  return parsed === null || Number.isFinite(parsed) ? parsed : null;
}

function stringFromNumber(value: number | null) {
  return value === null ? '' : String(value);
}

function draftId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function price(value: number | null) {
  if (value === null) {
    return '-';
  }

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function priceInputValue(value: number | null) {
  return value === null ? '' : price(value);
}

function exportValue(value: string | number | boolean | null) {
  return value === null || value === '' ? '-' : String(value);
}

function PriceInput({
  value,
  onChange
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  const [draftValue, setDraftValue] = useState(value);

  useEffect(() => {
    if (!focused) {
      setDraftValue(value);
    }
  }, [focused, value]);

  function formatDraftValue(rawValue: string) {
    const parsed = numberToNull(rawValue);
    return parsed === null ? '' : price(parsed);
  }

  return (
    <input
      inputMode="decimal"
      value={draftValue}
      onBlur={() => {
        const formattedValue = formatDraftValue(draftValue);
        setFocused(false);
        setDraftValue(formattedValue);
        onChange(formattedValue);
      }}
      onChange={(event) => {
        setDraftValue(event.target.value);
        onChange(event.target.value);
      }}
      onFocus={() => setFocused(true)}
    />
  );
}

function companyLabel(company: ContractingAuthorityCompanySummary) {
  return [company.ico, company.name].filter(Boolean).join(' / ');
}

function bankAccountLabel(bankAccount: CompanyBankAccountSummary) {
  return [bankAccount.bankAccountNumber, bankAccount.bankCode].filter(Boolean).join(' / ');
}

function formatBoolean(value: boolean, t: ReturnType<typeof useI18n>['t']) {
  return value ? t('tenders.yes') : t('tenders.no');
}

function contactRoleLabel(role: string | null | undefined, locale: 'en' | 'sk') {
  const normalizedRole = role === 'executive_director' ? 'executive_dictor' : role;
  const labels: Record<string, Record<'en' | 'sk', string>> = {
    board_member: { en: 'Board member', sk: 'Člen predstavenstva' },
    vice_chairman: { en: 'Vice-chairman', sk: 'Podpredseda predstavenstva' },
    chairman: { en: 'Chairman', sk: 'Predseda predstavenstva' },
    executive_dictor: { en: 'Executive Director', sk: 'Konateľ' },
    owner: { en: 'Owner', sk: 'Majiteľ' }
  };

  if (!normalizedRole) {
    return null;
  }

  return labels[normalizedRole]?.[locale] ?? normalizedRole.replace(/_/g, ' ');
}

function renderInfoTable(title: string, rows: { label: string; value: string | boolean | null }[]) {
  return (
    <section className="association-info-section">
      <h4>{title}</h4>
      <table className="association-info-table">
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              <td>{row.value === null || row.value === '' ? '-' : String(row.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function CompanyAssociationSelector({
  label,
  companies,
  selectedCompany,
  contacts,
  bankAccounts,
  value,
  onChange,
  locale,
  t
}: {
  label: string;
  companies: ContractingAuthorityCompanySummary[];
  selectedCompany: ContractingAuthorityCompanyDetail | null;
  contacts: CompanyContactSummary[];
  bankAccounts: CompanyBankAccountSummary[];
  value: CompanyAssociationValue;
  onChange: (value: CompanyAssociationValue) => void;
  locale: 'en' | 'sk';
  t: ReturnType<typeof useI18n>['t'];
}) {
  const selectedContact = contacts.find((contact) => contact.id === value.contactPersonId) ?? null;
  const selectedBankAccount = bankAccounts.find((bankAccount) => bankAccount.id === value.bankAccountId) ?? null;

  function updateCompanyId(companyId: string) {
    onChange({ companyId, contactPersonId: '', bankAccountId: '' });
  }

  return (
    <>
      <label>
        {label}
        <select value={value.companyId} onChange={(event) => updateCompanyId(event.target.value)}>
          <option value="">{t('tenders.none')}</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {companyLabel(company)}
            </option>
          ))}
        </select>
      </label>
      {selectedCompany
        ? renderInfoTable(t('tenders.companyAssociation.companyInfo'), [
            { label: t('tenders.companyAssociation.name'), value: selectedCompany.name },
            { label: t('tenders.companyAssociation.ico'), value: selectedCompany.ico },
            { label: t('tenders.companyAssociation.dic'), value: selectedCompany.dic },
            { label: t('tenders.companyAssociation.icDph'), value: selectedCompany.icDph },
            { label: t('tenders.companyAssociation.addressStreet'), value: selectedCompany.addressStreet },
            { label: t('tenders.companyAssociation.addressNumber'), value: selectedCompany.addressNumber },
            { label: t('tenders.companyAssociation.addressCity'), value: selectedCompany.addressCity },
            { label: t('tenders.companyAssociation.addressCountry'), value: selectedCompany.addressCountry },
            { label: t('tenders.companyAssociation.addressPostalCode'), value: selectedCompany.addressPostalCode },
            {
              label: t('tenders.contractingAuthority'),
              value: formatBoolean(selectedCompany.contractingAuthority, t)
            }
          ])
        : null}
      <label>
        {t('tenders.companyAssociation.contactPerson')}
        <select
          disabled={!value.companyId}
          value={value.contactPersonId}
          onChange={(event) => onChange({ ...value, contactPersonId: event.target.value })}
        >
          <option value="">{t('tenders.none')}</option>
          {contacts.map((contact) => (
            <option key={contact.id} value={contact.id}>
              {[contact.name, contact.email].filter(Boolean).join(' / ')}
            </option>
          ))}
        </select>
      </label>
      {selectedContact
        ? renderInfoTable(t('tenders.companyAssociation.contactInfo'), [
            { label: t('tenders.companyAssociation.name'), value: selectedContact.name },
            { label: t('tenders.companyAssociation.email'), value: selectedContact.email },
            { label: t('tenders.companyAssociation.phoneNumber'), value: selectedContact.phoneNumber },
            { label: t('tenders.companyAssociation.dateOfBirth'), value: selectedContact.dateOfBirth },
            { label: t('tenders.companyAssociation.role'), value: contactRoleLabel(selectedContact.role, locale) },
            { label: t('tenders.companyAssociation.preferred'), value: formatBoolean(selectedContact.preferred, t) }
          ])
        : null}
      <label>
        {t('tenders.companyAssociation.bankAccount')}
        <select
          disabled={!value.companyId}
          value={value.bankAccountId}
          onChange={(event) => onChange({ ...value, bankAccountId: event.target.value })}
        >
          <option value="">{t('tenders.none')}</option>
          {bankAccounts.map((bankAccount) => (
            <option key={bankAccount.id} value={bankAccount.id}>
              {bankAccountLabel(bankAccount)}
            </option>
          ))}
        </select>
      </label>
      {selectedBankAccount
        ? renderInfoTable(t('tenders.companyAssociation.bankAccountInfo'), [
            {
              label: t('tenders.companyAssociation.bankAccountNumber'),
              value: selectedBankAccount.bankAccountNumber
            },
            { label: t('tenders.companyAssociation.bankCode'), value: selectedBankAccount.bankCode },
            { label: t('tenders.companyAssociation.preferred'), value: formatBoolean(selectedBankAccount.preferred, t) }
          ])
        : null}
    </>
  );
}

function buildExportRows(contract: ProcurementContractSummary, locale: 'en' | 'sk'): ExportRow[] {
  const labels =
    locale === 'sk'
      ? {
          tenders: 'Zakazky',
          tendersType: 'ZakazkyTyp',
          tendersJosephineExternalId: 'ZakazkyJosephineExternyId',
          contractingAuthorityCompany: 'VerejnyZadavatel',
          contractingAuthorityContactPerson: 'VerejnyZadavatelKontaktnaOsoba',
          contractingAuthorityBankAccount: 'VerejnyZadavatelBankovyUcet',
          measures: 'Opatrenia',
          measuresNumber: 'OpatreniaCislo',
          measuresSubNumber: 'OpatreniaCisloPodopatrenia',
          measuresCallNumber: 'OpatreniaCisloVyzvy',
          procurementContracts: 'VerejneZakazky',
          procurementContractsProcurementType: 'VerejneZakazkyDruhZakazky',
          procurementContractsName: 'VerejneZakazkyNazov',
          procurementContractsLotDivision: 'VerejneZakazkyRozdelenieZakazky',
          procurementContractsProjectName: 'VerejneZakazkyNazovProjektu',
          procurementContractsProjectCode: 'VerejneZakazkyKodProjektu',
          procurementContractsCpvCode: 'VerejneZakazkyCpvKod',
          procurementContractsContractType: 'VerejneZakazkyTypZmluvy',
          procurementContractsDeliveryAddressStreetNumber: 'VerejneZakazkyAdresaDodaniaUlicaCislo',
          procurementContractsDeliveryAddressPostalCode: 'VerejneZakazkyAdresaDodaniaPsc',
          procurementContractsDeliveryAddressCity: 'VerejneZakazkyAdresaDodaniaObec',
          procurementContractsEstimatedValueExclVat: 'VerejneZakazkyOdhadovanaHodnotaBezDph',
          procurementContractsEstimatedValueInclVat: 'VerejneZakazkyOdhadovanaHodnotaSDph',
          procurementItems: 'PredmetyZakazky',
          procurementItemsName: 'Nazov',
          procurementItemsDescription: 'Popis',
          procurementItemsQuantity: 'Mnozstvo',
          procurementItemsUnit: 'Jednotka',
          procurementItemsEstimatedValueExclVat: 'OdhadovanaHodnotaBezDph',
          procurementItemsEstimatedValueInclVat: 'OdhadovanaHodnotaSDph'
        }
      : {
          tenders: 'Tenders',
          tendersType: 'TendersType',
          tendersJosephineExternalId: 'TendersJosephineExternalId',
          contractingAuthorityCompany: 'ContractingAuthority',
          contractingAuthorityContactPerson: 'ContractingAuthorityContactPerson',
          contractingAuthorityBankAccount: 'ContractingAuthorityBankAccount',
          measures: 'Measures',
          measuresNumber: 'MeasuresNumber',
          measuresSubNumber: 'MeasuresSubNumber',
          measuresCallNumber: 'MeasuresCallNumber',
          procurementContracts: 'ProcurementContracts',
          procurementContractsProcurementType: 'ProcurementContractsProcurementType',
          procurementContractsName: 'ProcurementContractsName',
          procurementContractsLotDivision: 'ProcurementContractsLotDivision',
          procurementContractsProjectName: 'ProcurementContractsProjectName',
          procurementContractsProjectCode: 'ProcurementContractsProjectCode',
          procurementContractsCpvCode: 'ProcurementContractsCpvCode',
          procurementContractsContractType: 'ProcurementContractsContractType',
          procurementContractsDeliveryAddressStreetNumber: 'ProcurementContractsDeliveryAddressStreetNumber',
          procurementContractsDeliveryAddressPostalCode: 'ProcurementContractsDeliveryAddressPostalCode',
          procurementContractsDeliveryAddressCity: 'ProcurementContractsDeliveryAddressCity',
          procurementContractsEstimatedValueExclVat: 'ProcurementContractsEstimatedValueExclVat',
          procurementContractsEstimatedValueInclVat: 'ProcurementContractsEstimatedValueInclVat',
          procurementItems: 'ProcurementItems',
          procurementItemsName: 'Name',
          procurementItemsDescription: 'Description',
          procurementItemsQuantity: 'Quantity',
          procurementItemsUnit: 'Unit',
          procurementItemsEstimatedValueExclVat: 'EstimatedValueExclVat',
          procurementItemsEstimatedValueInclVat: 'EstimatedValueInclVat'
        };
  const tenderTypeValues: Record<TenderType, string> =
    locale === 'sk' ? { survey: 'Prieskum', competition: 'Sutaz' } : { survey: 'Survey', competition: 'Competition' };
  const procurementTypeValues: Record<ProcurementType, string> =
    locale === 'sk'
      ? { goods: 'Tovary', services: 'Sluzby', works: 'Stavebne prace' }
      : { goods: 'Goods', services: 'Services', works: 'Works' };
  const procurementItemUnitValues: Record<ProcurementItemUnit, string> =
    locale === 'sk' ? { pcs: 'ks', m: 'm', kg: 'kg' } : { pcs: 'pcs', m: 'm', kg: 'kg' };

  return [
    { label: `${labels.tenders}Id`, value: contract.tenderId },
    { label: labels.tendersType, value: tenderTypeValues[contract.tenderType] },
    { label: labels.tendersJosephineExternalId, value: contract.josephineExternalId },
    { label: `${labels.contractingAuthorityCompany}Id`, value: contract.contractingAuthorityCompanyId },
    { label: `${labels.contractingAuthorityCompany}Name`, value: contract.contractingAuthorityCompanyName },
    { label: `${labels.contractingAuthorityCompany}Ico`, value: contract.contractingAuthorityCompanyIco },
    { label: `${labels.contractingAuthorityCompany}Dic`, value: contract.contractingAuthorityCompanyDic },
    { label: `${labels.contractingAuthorityCompany}IcDph`, value: contract.contractingAuthorityCompanyIcDph },
    {
      label: `${labels.contractingAuthorityCompany}AddressStreet`,
      value: contract.contractingAuthorityCompanyAddressStreet
    },
    {
      label: `${labels.contractingAuthorityCompany}AddressNumber`,
      value: contract.contractingAuthorityCompanyAddressNumber
    },
    { label: `${labels.contractingAuthorityCompany}AddressCity`, value: contract.contractingAuthorityCompanyAddressCity },
    {
      label: `${labels.contractingAuthorityCompany}AddressCountry`,
      value: contract.contractingAuthorityCompanyAddressCountry
    },
    {
      label: `${labels.contractingAuthorityCompany}AddressPostalCode`,
      value: contract.contractingAuthorityCompanyAddressPostalCode
    },
    {
      label: `${labels.contractingAuthorityCompany}ContractingAuthority`,
      value: contract.contractingAuthorityCompanyContractingAuthority
    },
    { label: `${labels.contractingAuthorityContactPerson}Id`, value: contract.contractingAuthorityContactPersonId },
    { label: `${labels.contractingAuthorityContactPerson}Name`, value: contract.contractingAuthorityContactPersonName },
    { label: `${labels.contractingAuthorityContactPerson}Email`, value: contract.contractingAuthorityContactPersonEmail },
    {
      label: `${labels.contractingAuthorityContactPerson}PhoneNumber`,
      value: contract.contractingAuthorityContactPersonPhoneNumber
    },
    {
      label: `${labels.contractingAuthorityContactPerson}DateOfBirth`,
      value: contract.contractingAuthorityContactPersonDateOfBirth
    },
    {
      label: `${labels.contractingAuthorityContactPerson}Role`,
      value: contactRoleLabel(contract.contractingAuthorityContactPersonRole, locale)
    },
    { label: `${labels.contractingAuthorityBankAccount}Id`, value: contract.contractingAuthorityBankAccountId },
    { label: `${labels.contractingAuthorityBankAccount}Number`, value: contract.contractingAuthorityBankAccountNumber },
    { label: `${labels.contractingAuthorityBankAccount}BankCode`, value: contract.contractingAuthorityBankCode },
    { label: `${labels.measures}Id`, value: contract.measureId },
    { label: labels.measuresNumber, value: contract.measureNumber },
    { label: labels.measuresSubNumber, value: contract.measureSubNumber },
    { label: labels.measuresCallNumber, value: contract.callNumber },
    { label: `${labels.procurementContracts}Id`, value: contract.id },
    {
      label: labels.procurementContractsProcurementType,
      value: contract.procurementType ? procurementTypeValues[contract.procurementType] : null
    },
    { label: labels.procurementContractsName, value: contract.name },
    { label: labels.procurementContractsLotDivision, value: contract.lotDivision },
    { label: labels.procurementContractsProjectName, value: contract.projectName },
    { label: labels.procurementContractsProjectCode, value: contract.projectCode },
    { label: labels.procurementContractsCpvCode, value: contract.cpvCode },
    { label: labels.procurementContractsContractType, value: contract.contractType },
    { label: labels.procurementContractsDeliveryAddressStreetNumber, value: contract.deliveryAddressStreetNumber },
    { label: labels.procurementContractsDeliveryAddressPostalCode, value: contract.deliveryAddressPostalCode },
    { label: labels.procurementContractsDeliveryAddressCity, value: contract.deliveryAddressCity },
    { label: labels.procurementContractsEstimatedValueExclVat, value: price(contract.estimatedValueExclVat) },
    { label: labels.procurementContractsEstimatedValueInclVat, value: price(contract.estimatedValueInclVat) },
    ...contract.items.flatMap((item, index) => [
      { label: `${labels.procurementItems}.${index}.Id`, value: item.id },
      { label: `${labels.procurementItems}.${index}.${labels.procurementItemsName}`, value: item.name },
      { label: `${labels.procurementItems}.${index}.${labels.procurementItemsDescription}`, value: item.description },
      { label: `${labels.procurementItems}.${index}.${labels.procurementItemsQuantity}`, value: item.quantity },
      {
        label: `${labels.procurementItems}.${index}.${labels.procurementItemsUnit}`,
        value: item.unit ? procurementItemUnitValues[item.unit] : null
      },
      {
        label: `${labels.procurementItems}.${index}.${labels.procurementItemsEstimatedValueExclVat}`,
        value: price(item.estimatedValueExclVat)
      },
      {
        label: `${labels.procurementItems}.${index}.${labels.procurementItemsEstimatedValueInclVat}`,
        value: price(item.estimatedValueInclVat)
      }
    ])
  ];
}

export function TendersModule() {
  const { locale, t } = useI18n();
  const { notify } = useNotifications();
  const [overview, setOverview] = useState<TendersOverview | null>(null);
  const [procurementContracts, setProcurementContracts] = useState<ProcurementContractSummary[]>([]);
  const [contractingAuthorityCompanies, setContractingAuthorityCompanies] = useState<ContractingAuthorityCompanySummary[]>(
    []
  );
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [panelMode, setPanelMode] = useState<PanelMode>('closed');
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [exportContractId, setExportContractId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [tenderType, setTenderType] = useState<TenderType>('survey');
  const [josephineExternalId, setJosephineExternalId] = useState('');
  const [contractingAuthorityCompanyId, setContractingAuthorityCompanyId] = useState('');
  const [contractingAuthorityCompany, setContractingAuthorityCompany] =
    useState<ContractingAuthorityCompanyDetail | null>(null);
  const [contractingAuthorityContacts, setContractingAuthorityContacts] = useState<CompanyContactSummary[]>([]);
  const [contractingAuthorityBankAccounts, setContractingAuthorityBankAccounts] = useState<CompanyBankAccountSummary[]>(
    []
  );
  const [contractingAuthorityContactPersonId, setContractingAuthorityContactPersonId] = useState('');
  const [contractingAuthorityBankAccountId, setContractingAuthorityBankAccountId] = useState('');
  const [measureNumber, setMeasureNumber] = useState('');
  const [measureSubNumber, setMeasureSubNumber] = useState('');
  const [callNumber, setCallNumber] = useState('');
  const [procurementType, setProcurementType] = useState<ProcurementType | ''>('');
  const [contractName, setContractName] = useState('');
  const [lotDivision, setLotDivision] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectCode, setProjectCode] = useState('');
  const [cpvCode, setCpvCode] = useState('');
  const [contractType, setContractType] = useState('');
  const [deliveryAddressStreetNumber, setDeliveryAddressStreetNumber] = useState('');
  const [deliveryAddressPostalCode, setDeliveryAddressPostalCode] = useState('');
  const [deliveryAddressCity, setDeliveryAddressCity] = useState('');
  const [estimatedValueExclVat, setEstimatedValueExclVat] = useState('');
  const [estimatedValueInclVat, setEstimatedValueInclVat] = useState('');
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);

  const selectedContract = useMemo(
    () => procurementContracts.find((contract) => contract.id === selectedContractId) ?? null,
    [procurementContracts, selectedContractId]
  );
  const exportContract = useMemo(
    () => procurementContracts.find((contract) => contract.id === exportContractId) ?? null,
    [procurementContracts, exportContractId]
  );
  const exportRows = useMemo(
    () => (exportContract ? buildExportRows(exportContract, locale) : []),
    [exportContract, locale]
  );

  async function loadProcurementContracts() {
    const { procurementContracts: loadedProcurementContracts } = await listProcurementContracts();
    setProcurementContracts(loadedProcurementContracts);
  }

  useEffect(() => {
    getTendersOverview()
      .then(setOverview)
      .catch(() => setOverview(null));
    void loadProcurementContracts();
    listContractingAuthorityCompanies()
      .then(({ companies }) => setContractingAuthorityCompanies(companies))
      .catch(() => setContractingAuthorityCompanies([]));
  }, []);

  useEffect(() => {
    if (!contractingAuthorityCompanyId) {
      setContractingAuthorityCompany(null);
      setContractingAuthorityContacts([]);
      setContractingAuthorityBankAccounts([]);
      setContractingAuthorityContactPersonId('');
      setContractingAuthorityBankAccountId('');
      return;
    }

    let active = true;

    getContractingAuthorityCompany(contractingAuthorityCompanyId)
      .then(({ company }) => {
        if (!active) {
          return;
        }

        setContractingAuthorityCompany(company);
        setContractingAuthorityContacts(company.contacts);
        setContractingAuthorityBankAccounts(company.bankAccounts);
        setContractingAuthorityContactPersonId((contactPersonId) =>
          company.contacts.some((contact) => contact.id === contactPersonId)
            ? contactPersonId
            : company.contacts.find((contact) => contact.preferred)?.id ?? ''
        );
        setContractingAuthorityBankAccountId((bankAccountId) =>
          company.bankAccounts.some((bankAccount) => bankAccount.id === bankAccountId)
            ? bankAccountId
            : company.bankAccounts.find((bankAccount) => bankAccount.preferred)?.id ?? ''
        );
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setContractingAuthorityCompany(null);
        setContractingAuthorityContacts([]);
        setContractingAuthorityBankAccounts([]);
        setContractingAuthorityContactPersonId('');
        setContractingAuthorityBankAccountId('');
      });

    return () => {
      active = false;
    };
  }, [contractingAuthorityCompanyId]);

  function resetForm() {
    setTenderType('survey');
    setJosephineExternalId('');
    setContractingAuthorityCompanyId('');
    setContractingAuthorityCompany(null);
    setContractingAuthorityContactPersonId('');
    setContractingAuthorityBankAccountId('');
    setContractingAuthorityContacts([]);
    setContractingAuthorityBankAccounts([]);
    setMeasureNumber('');
    setMeasureSubNumber('');
    setCallNumber('');
    setProcurementType('');
    setContractName('');
    setLotDivision('');
    setProjectName('');
    setProjectCode('');
    setCpvCode('');
    setContractType('');
    setDeliveryAddressStreetNumber('');
    setDeliveryAddressPostalCode('');
    setDeliveryAddressCity('');
    setEstimatedValueExclVat('');
    setEstimatedValueInclVat('');
    setDraftItems([]);
  }

  function loadContractIntoForm(contract: ProcurementContractSummary) {
    setTenderType(contract.tenderType);
    setJosephineExternalId(contract.josephineExternalId ?? '');
    setContractingAuthorityCompanyId(contract.contractingAuthorityCompanyId ?? '');
    setContractingAuthorityContactPersonId(contract.contractingAuthorityContactPersonId ?? '');
    setContractingAuthorityBankAccountId(contract.contractingAuthorityBankAccountId ?? '');
    setMeasureNumber(contract.measureNumber ?? '');
    setMeasureSubNumber(contract.measureSubNumber ?? '');
    setCallNumber(contract.callNumber ?? '');
    setProcurementType(contract.procurementType ?? '');
    setContractName(contract.name);
    setLotDivision(contract.lotDivision ?? '');
    setProjectName(contract.projectName ?? '');
    setProjectCode(contract.projectCode ?? '');
    setCpvCode(contract.cpvCode ?? '');
    setContractType(contract.contractType ?? '');
    setDeliveryAddressStreetNumber(contract.deliveryAddressStreetNumber ?? '');
    setDeliveryAddressPostalCode(contract.deliveryAddressPostalCode ?? '');
    setDeliveryAddressCity(contract.deliveryAddressCity ?? '');
    setEstimatedValueExclVat(priceInputValue(contract.estimatedValueExclVat));
    setEstimatedValueInclVat(priceInputValue(contract.estimatedValueInclVat));
    setDraftItems(
      contract.items.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        estimatedValueExclVat: item.estimatedValueExclVat,
        estimatedValueInclVat: item.estimatedValueInclVat
      }))
    );
  }

  function buildContractInput() {
    return {
      tenderType,
      josephineExternalId: emptyToNull(josephineExternalId),
      contractingAuthorityCompanyId: emptyToNull(contractingAuthorityCompanyId),
      contractingAuthorityContactPersonId: emptyToNull(contractingAuthorityContactPersonId),
      contractingAuthorityBankAccountId: emptyToNull(contractingAuthorityBankAccountId),
      measureNumber: emptyToNull(measureNumber),
      measureSubNumber: emptyToNull(measureSubNumber),
      callNumber: emptyToNull(callNumber),
      procurementType: procurementType || null,
      name: contractName.trim(),
      lotDivision: emptyToNull(lotDivision),
      projectName: emptyToNull(projectName),
      projectCode: emptyToNull(projectCode),
      cpvCode: emptyToNull(cpvCode),
      contractType: emptyToNull(contractType),
      deliveryAddressStreetNumber: emptyToNull(deliveryAddressStreetNumber),
      deliveryAddressPostalCode: emptyToNull(deliveryAddressPostalCode),
      deliveryAddressCity: emptyToNull(deliveryAddressCity),
      estimatedValueExclVat: numberToNull(estimatedValueExclVat),
      estimatedValueInclVat: numberToNull(estimatedValueInclVat),
      items: draftItems
        .filter((item) => item.name.trim())
        .map((item) => ({
          name: item.name.trim(),
          description: emptyToNull(item.description ?? ''),
          quantity: typeof item.quantity === 'number' ? item.quantity : null,
          unit: item.unit || null,
          estimatedValueExclVat: typeof item.estimatedValueExclVat === 'number' ? item.estimatedValueExclVat : null,
          estimatedValueInclVat: typeof item.estimatedValueInclVat === 'number' ? item.estimatedValueInclVat : null
        }))
    };
  }

  function openCreate() {
    resetForm();
    setSelectedContractId(null);
    setPanelMode('closed');
    setViewMode('create');
  }

  function openDetail(contractId: string) {
    setSelectedContractId(contractId);
    setPanelMode('detail');
  }

  function openEdit(contract: ProcurementContractSummary) {
    setSelectedContractId(contract.id);
    loadContractIntoForm(contract);
    setPanelMode('closed');
    setViewMode('edit');
  }

  function openExport(contractId: string) {
    setExportContractId(contractId);
  }

  function closeExport() {
    setExportContractId(null);
  }

  function closePanel() {
    setPanelMode('closed');
  }

  function closeMainForm() {
    resetForm();
    setViewMode('list');
    setPanelMode('closed');
  }

  function addDraftItem() {
    setDraftItems((items) => [
      ...items,
      {
        id: draftId(),
        name: '',
        description: null,
        quantity: null,
        unit: null,
        estimatedValueExclVat: null,
        estimatedValueInclVat: null
      }
    ]);
  }

  function updateDraftItem(itemId: string, updates: Partial<DraftItem>) {
    setDraftItems((items) => items.map((item) => (item.id === itemId ? { ...item, ...updates } : item)));
  }

  function removeDraftItem(itemId: string) {
    setDraftItems((items) => items.filter((item) => item.id !== itemId));
  }

  async function handleCreateProcurementContract(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);

    try {
      const created = await createProcurementContract(buildContractInput());
      notify({ type: 'success', message: t('tenders.procurementContracts.created') });
      await loadProcurementContracts();
      setSelectedContractId(created.procurementContract.id);
      resetForm();
      setViewMode('list');
      setPanelMode('detail');
    } catch {
      notify({ type: 'error', message: t('tenders.procurementContracts.createError') });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateProcurementContract(event: FormEvent) {
    event.preventDefault();

    if (!selectedContractId) {
      return;
    }

    setSubmitting(true);

    try {
      await updateProcurementContract(selectedContractId, buildContractInput());
      notify({ type: 'success', message: t('tenders.procurementContracts.updated') });
      await loadProcurementContracts();
      resetForm();
      setViewMode('list');
      setPanelMode('detail');
    } catch {
      notify({ type: 'error', message: t('tenders.procurementContracts.updateError') });
    } finally {
      setSubmitting(false);
    }
  }

  function renderItems(items: ProcurementContractSummary['items']) {
    return (
      <div className="compact-list">
        {items.map((item) => (
          <article className="compact-item" key={item.id}>
            <strong>{item.name}</strong>
            {item.description ? <span>{item.description}</span> : null}
            <span>
              {[
                item.quantity === null ? null : price(item.quantity),
                item.unit ? t(`tenders.procurementItems.unit.${item.unit}`) : null,
                price(item.estimatedValueExclVat)
              ]
                .filter(Boolean)
                .join(' / ') || '-'}
            </span>
          </article>
        ))}
        {items.length === 0 ? <p className="helper-text">{t('tenders.procurementItems.empty')}</p> : null}
      </div>
    );
  }

  function renderDraftItems() {
    return (
      <section className="draft-section">
        <div className="section-heading-row">
          <h3>{t('tenders.procurementItems.title')}</h3>
          <button className="icon-text-button" type="button" onClick={addDraftItem}>
            <Plus aria-hidden="true" />
            {t('tenders.procurementItems.add')}
          </button>
        </div>
        <div className="inline-edit-list">
          {draftItems.map((item) => (
            <article className="compact-item associated-edit-item" key={item.id}>
              <div className="form-grid">
                <label>
                  {t('tenders.procurementItems.name')}
                  <input
                    value={item.name}
                    onChange={(event) => updateDraftItem(item.id, { name: event.target.value })}
                    required
                  />
                </label>
                <label>
                  {t('tenders.procurementItems.description')}
                  <input
                    value={item.description ?? ''}
                    onChange={(event) => updateDraftItem(item.id, { description: event.target.value })}
                  />
                </label>
                <label>
                  {t('tenders.procurementItems.quantity')}
                  <input
                    min="0"
                    step="0.01"
                    type="number"
                    value={stringFromNumber(item.quantity ?? null)}
                    onChange={(event) => updateDraftItem(item.id, { quantity: numberToNull(event.target.value) })}
                  />
                </label>
                <label>
                  {t('tenders.procurementItems.unit')}
                  <select
                    value={item.unit ?? ''}
                    onChange={(event) =>
                      updateDraftItem(item.id, { unit: (event.target.value || null) as ProcurementItemUnit | null })
                    }
                  >
                    <option value="">{t('tenders.none')}</option>
                    {PROCUREMENT_ITEM_UNITS.map((unit) => (
                      <option key={unit} value={unit}>
                        {t(`tenders.procurementItems.unit.${unit}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t('tenders.procurementItems.estimatedValueExclVat')}
                  <PriceInput
                    value={priceInputValue(item.estimatedValueExclVat ?? null)}
                    onChange={(event) =>
                      updateDraftItem(item.id, { estimatedValueExclVat: numberToNull(event) })
                    }
                  />
                </label>
                <label>
                  {t('tenders.procurementItems.estimatedValueInclVat')}
                  <PriceInput
                    value={priceInputValue(item.estimatedValueInclVat ?? null)}
                    onChange={(event) =>
                      updateDraftItem(item.id, { estimatedValueInclVat: numberToNull(event) })
                    }
                  />
                </label>
              </div>
              <button
                aria-label={t('tenders.remove')}
                className="icon-only-button"
                type="button"
                onClick={() => removeDraftItem(item.id)}
              >
                <Trash2 aria-hidden="true" />
              </button>
            </article>
          ))}
          {draftItems.length === 0 ? <p className="helper-text">{t('tenders.procurementItems.empty')}</p> : null}
        </div>
      </section>
    );
  }

  function renderContractForm(mode: 'create' | 'edit') {
    return (
      <form
        className="side-panel-form"
        onSubmit={mode === 'create' ? handleCreateProcurementContract : handleUpdateProcurementContract}
      >
        <div className="panel-heading">
          <div>
            {mode === 'edit' ? <span className="eyebrow">{t('tenders.selected')}</span> : null}
            <h2>{mode === 'create' ? t('tenders.procurementContracts.create') : t('tenders.procurementContracts.edit')}</h2>
            <p className="helper-text">{t('tenders.procurementContracts.minimumRequired')}</p>
          </div>
          <button className="icon-text-button" type="button" onClick={closeMainForm}>
            {t('tenders.cancel')}
          </button>
        </div>

        <section className="draft-section">
          <span className="eyebrow">{t('tenders.tender')}</span>
          <div className="form-grid">
            <label>
              {t('tenders.procurementContracts.tenderType')}
              <select required value={tenderType} onChange={(event) => setTenderType(event.target.value as TenderType)}>
                {TENDER_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`tenders.tenderType.${type}`)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('tenders.procurementContracts.josephineExternalId')}
              <input
                maxLength={20}
                value={josephineExternalId}
                onChange={(event) => setJosephineExternalId(event.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="draft-section">
          <span className="eyebrow">{t('tenders.contractingAuthority')}</span>
          <div className="form-grid contracting-authority-grid">
            <CompanyAssociationSelector
              bankAccounts={contractingAuthorityBankAccounts}
              companies={contractingAuthorityCompanies}
              contacts={contractingAuthorityContacts}
              label={t('tenders.contractingAuthority')}
              locale={locale}
              selectedCompany={contractingAuthorityCompany}
              t={t}
              value={{
                companyId: contractingAuthorityCompanyId,
                contactPersonId: contractingAuthorityContactPersonId,
                bankAccountId: contractingAuthorityBankAccountId
              }}
              onChange={(value) => {
                setContractingAuthorityCompanyId(value.companyId);
                setContractingAuthorityContactPersonId(value.contactPersonId);
                setContractingAuthorityBankAccountId(value.bankAccountId);
              }}
            />
          </div>
        </section>

        <section className="draft-section">
          <span className="eyebrow">{t('tenders.measure')}</span>
          <div className="form-grid">
            <label>
              {t('tenders.procurementContracts.measureNumber')}
              <input value={measureNumber} onChange={(event) => setMeasureNumber(event.target.value)} />
            </label>
            <label>
              {t('tenders.procurementContracts.measureSubNumber')}
              <input value={measureSubNumber} onChange={(event) => setMeasureSubNumber(event.target.value)} />
            </label>
            <label>
              {t('tenders.procurementContracts.callNumber')}
              <input value={callNumber} onChange={(event) => setCallNumber(event.target.value)} />
            </label>
            <label>
              {t('tenders.procurementContracts.procurementType')}
              <select
                value={procurementType}
                onChange={(event) => setProcurementType(event.target.value as ProcurementType | '')}
              >
                <option value="">{t('tenders.none')}</option>
                {PROCUREMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`tenders.procurementType.${type}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="draft-section">
          <span className="eyebrow">{t('tenders.procurementContract')}</span>
          <label>
            {t('tenders.procurementContracts.name')}
            <input value={contractName} onChange={(event) => setContractName(event.target.value)} required />
          </label>
          <div className="form-grid">
            <label>
              {t('tenders.procurementContracts.lotDivision')}
              <input value={lotDivision} onChange={(event) => setLotDivision(event.target.value)} />
            </label>
            <label>
              {t('tenders.procurementContracts.contractType')}
              <input value={contractType} onChange={(event) => setContractType(event.target.value)} />
            </label>
            <label>
              {t('tenders.procurementContracts.projectName')}
              <input value={projectName} onChange={(event) => setProjectName(event.target.value)} />
            </label>
            <label>
              {t('tenders.procurementContracts.projectCode')}
              <input value={projectCode} onChange={(event) => setProjectCode(event.target.value)} />
            </label>
            <label>
              {t('tenders.procurementContracts.cpvCode')}
              <input value={cpvCode} onChange={(event) => setCpvCode(event.target.value)} />
            </label>
          </div>
        </section>

        <section className="draft-section">
          <span className="eyebrow">{t('tenders.delivery')}</span>
          <div className="form-grid">
            <label>
              {t('tenders.procurementContracts.deliveryAddressStreetNumber')}
              <input
                value={deliveryAddressStreetNumber}
                onChange={(event) => setDeliveryAddressStreetNumber(event.target.value)}
              />
            </label>
            <label>
              {t('tenders.procurementContracts.deliveryAddressPostalCode')}
              <input
                value={deliveryAddressPostalCode}
                onChange={(event) => setDeliveryAddressPostalCode(event.target.value)}
              />
            </label>
            <label>
              {t('tenders.procurementContracts.deliveryAddressCity')}
              <input value={deliveryAddressCity} onChange={(event) => setDeliveryAddressCity(event.target.value)} />
            </label>
          </div>
        </section>

        <section className="draft-section">
          <span className="eyebrow">{t('tenders.values')}</span>
          <div className="form-grid">
            <label>
              {t('tenders.procurementContracts.estimatedValueExclVat')}
              <PriceInput value={estimatedValueExclVat} onChange={setEstimatedValueExclVat} />
            </label>
            <label>
              {t('tenders.procurementContracts.estimatedValueInclVat')}
              <PriceInput value={estimatedValueInclVat} onChange={setEstimatedValueInclVat} />
            </label>
          </div>
        </section>

        {renderDraftItems()}

        <div className="create-step-actions">
          <button className="icon-text-button" type="button" onClick={closeMainForm}>
            {t('tenders.cancel')}
          </button>
          <button className="primary-button" disabled={submitting || !contractName.trim()} type="submit">
            {mode === 'create' ? t('tenders.procurementContracts.create') : t('tenders.save')}
          </button>
        </div>
      </form>
    );
  }

  return (
    <main className="page">
      <section className="page-header">
        <div>
          <span className="eyebrow">{t('tenders.eyebrow')}</span>
          <h1>{t('tenders.title')}</h1>
        </div>
        {viewMode === 'list' ? (
          <button className="primary-button page-action-button" type="button" onClick={openCreate}>
            <Plus aria-hidden="true" />
            {t('tenders.procurementContracts.create')}
          </button>
        ) : null}
      </section>

      {viewMode === 'list' ? (
        <>
          <div className="status-row">
            {(overview?.capabilities ?? [t('tenders.backendPending')]).map((capability) => (
              <span className="permission-count" key={capability}>
                {CAPABILITY_TRANSLATION_KEYS[capability] ? t(CAPABILITY_TRANSLATION_KEYS[capability]) : capability}
              </span>
            ))}
          </div>

          <section className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('tenders.procurementContracts.name')}</th>
                  <th>{t('tenders.procurementContracts.tenderType')}</th>
                  <th>{t('tenders.procurementContracts.josephineExternalId')}</th>
                  <th>{t('tenders.contractingAuthority')}</th>
                  <th>{t('tenders.procurementContracts.measure')}</th>
                  <th>{t('tenders.procurementContracts.procurementType')}</th>
                  <th>{t('tenders.procurementContracts.project')}</th>
                  <th>{t('tenders.procurementContracts.cpvCode')}</th>
                  <th>{t('tenders.procurementItems.title')}</th>
                  <th className="table-action-column">{t('tenders.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {procurementContracts.map((contract) => (
                  <tr
                    className={contract.id === selectedContractId ? 'selected-row' : undefined}
                    key={contract.id}
                    onClick={() => openDetail(contract.id)}
                  >
                    <td>
                      <strong>{contract.name}</strong>
                    </td>
                    <td>{t(`tenders.tenderType.${contract.tenderType}`)}</td>
                    <td>{contract.josephineExternalId ?? '-'}</td>
                    <td>{contract.contractingAuthorityCompanyName ?? '-'}</td>
                    <td>
                      {[contract.measureNumber, contract.measureSubNumber, contract.callNumber]
                        .filter(Boolean)
                        .join(' / ') || '-'}
                    </td>
                    <td>{contract.procurementType ? t(`tenders.procurementType.${contract.procurementType}`) : '-'}</td>
                    <td>{contract.projectName ?? contract.projectCode ?? '-'}</td>
                    <td>{contract.cpvCode ?? '-'}</td>
                    <td>{contract.items.length}</td>
                    <td className="table-action-column">
                      <div className="table-actions">
                        <button
                          className="icon-text-button"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openExport(contract.id);
                          }}
                        >
                          <Download aria-hidden="true" />
                          {t('tenders.export')}
                        </button>
                        <button
                          className="icon-text-button"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openEdit(contract);
                          }}
                        >
                          <Pencil aria-hidden="true" />
                          {t('tenders.edit')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {procurementContracts.length === 0 ? (
                  <tr>
                    <td colSpan={10}>{t('tenders.procurementContracts.empty')}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </section>
        </>
      ) : null}

      {viewMode !== 'list' ? (
        <section
          aria-label={t(viewMode === 'create' ? 'tenders.panel.create' : 'tenders.panel.edit')}
          className="side-panel create-side-panel company-main-panel"
        >
          {viewMode === 'create' ? renderContractForm('create') : null}
          {viewMode === 'edit' && selectedContract ? renderContractForm('edit') : null}
        </section>
      ) : null}

      {panelMode === 'detail' && selectedContract ? (
        <aside aria-label={t('tenders.panel.detail')} className="side-panel detail-side-panel">
          <div className="side-panel-form">
            <div className="panel-heading">
              <div className="detail-heading">
                <ClipboardList aria-hidden="true" />
                <div>
                  <span className="eyebrow">{t('tenders.selected')}</span>
                  <h2>{selectedContract.name}</h2>
                </div>
              </div>
              <button className="icon-text-button" type="button" onClick={closePanel}>
                {t('tenders.cancel')}
              </button>
            </div>

            <dl className="detail-list">
              <div>
                <dt>{t('tenders.procurementContracts.tenderType')}</dt>
                <dd>{t(`tenders.tenderType.${selectedContract.tenderType}`)}</dd>
              </div>
              <div>
                <dt>{t('tenders.procurementContracts.josephineExternalId')}</dt>
                <dd>{selectedContract.josephineExternalId ?? '-'}</dd>
              </div>
              <div>
                <dt>{t('tenders.contractingAuthority')}</dt>
                <dd>{selectedContract.contractingAuthorityCompanyName ?? '-'}</dd>
              </div>
              <div>
                <dt>{t('tenders.companyAssociation.contactPerson')}</dt>
                <dd>{selectedContract.contractingAuthorityContactPersonName ?? '-'}</dd>
              </div>
              <div>
                <dt>{t('tenders.companyAssociation.bankAccount')}</dt>
                <dd>{selectedContract.contractingAuthorityBankAccountNumber ?? '-'}</dd>
              </div>
              <div>
                <dt>{t('tenders.procurementContracts.measure')}</dt>
                <dd>
                  {[selectedContract.measureNumber, selectedContract.measureSubNumber, selectedContract.callNumber]
                    .filter(Boolean)
                    .join(' / ') || '-'}
                </dd>
              </div>
              <div>
                <dt>{t('tenders.procurementContracts.project')}</dt>
                <dd>{selectedContract.projectName ?? selectedContract.projectCode ?? '-'}</dd>
              </div>
              <div>
                <dt>{t('tenders.procurementContracts.cpvCode')}</dt>
                <dd>{selectedContract.cpvCode ?? '-'}</dd>
              </div>
              <div>
                <dt>{t('tenders.procurementContracts.estimatedValueExclVat')}</dt>
                <dd>{price(selectedContract.estimatedValueExclVat)}</dd>
              </div>
            </dl>

            <section className="detail-section">
              <div className="section-heading-row">
                <h3>{t('tenders.procurementItems.title')}</h3>
              </div>
              {renderItems(selectedContract.items)}
            </section>
          </div>
        </aside>
      ) : null}

      {exportContract ? (
        <div className="modal-backdrop" onClick={closeExport}>
          <section
            aria-labelledby="tenders-export-title"
            aria-modal="true"
            className="export-modal"
            role="dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="panel-heading">
              <div>
                <span className="eyebrow">{t('tenders.export')}</span>
                <h2 id="tenders-export-title">{t('tenders.export.title')}</h2>
              </div>
              <button className="icon-text-button" type="button" onClick={closeExport}>
                {t('tenders.cancel')}
              </button>
            </div>
            <div className="export-list-wrap">
              <dl className="export-list">
                {exportRows.map((row) => (
                  <div key={row.label}>
                    <dt>{row.label}</dt>
                    <dd>{exportValue(row.value)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
