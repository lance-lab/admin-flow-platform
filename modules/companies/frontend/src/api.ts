import { request } from '../../../../apps/web/src/api/client';

export interface CompaniesOverview {
  module: string;
  status: string;
  capabilities: string[];
}

export interface CompanySummary {
  id: string;
  name: string;
  ico: string | null;
  dic: string | null;
  icDph: string | null;
  addressStreet: string | null;
  addressNumber: string | null;
  addressCity: string | null;
  addressCountry: string;
  addressPostalCode: string | null;
  contactCount: number;
  bankAccountCount: number;
}

export interface CompanyContact {
  id: string;
  personId: string;
  name: string;
  surname: string;
  email: string | null;
  phoneNumber: string | null;
  dateOfBirth: string | null;
  role: string | null;
  preferred: boolean;
}

export interface CompanyBankAccount {
  id: string;
  bankAccountNumber: string;
  bankCode: string | null;
  preferred: boolean;
}

export interface CompanyDetail extends Omit<CompanySummary, 'contactCount' | 'bankAccountCount'> {
  contacts: CompanyContact[];
  bankAccounts: CompanyBankAccount[];
}

export interface CompanyInput {
  name: string;
  ico?: string | null;
  dic?: string | null;
  ic_dph?: string | null;
  address_street?: string | null;
  address_number?: string | null;
  address_city?: string | null;
  address_country: string;
  address_postal_code?: string | null;
}

export interface ContactInput {
  name: string;
  surname: string;
  email?: string | null;
  phone_number?: string | null;
  date_of_birth?: string | null;
  role?: string | null;
  preferred: boolean;
}

export interface BankAccountInput {
  bank_account_number: string;
  bank_code?: string | null;
  preferred: boolean;
}

export interface ResolvedBankAccount {
  Ucet: string;
  Banka: string | null;
}

export interface ResolvedCompany {
  Ico: string;
  Meno: string;
  Dic: string | null;
  IcDph: string | null;
  PlnaAdresa: string | null;
  Mesto: string | null;
  Ulica: string | null;
  CisloDomu: string | null;
  Stat: string | null;
  Psc: string | null;
  BankoveUcty: ResolvedBankAccount[];
}

export function getCompaniesOverview() {
  return request<CompaniesOverview>('/api/modules/companies/overview');
}

export function listCompanies() {
  return request<{ companies: CompanySummary[] }>('/api/modules/companies/companies');
}

export function createCompany(input: CompanyInput) {
  return request<{ company: CompanySummary }>('/api/modules/companies/companies', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export function resolveCompanyByIco(ico: string, country: string) {
  return request<ResolvedCompany>(
    `/api/modules/companies/companies/resolve/${encodeURIComponent(ico)}?country=${encodeURIComponent(country)}`
  );
}

export function deleteCompany(companyId: string) {
  return request<{ success: true }>(`/api/modules/companies/companies/${companyId}`, {
    method: 'DELETE'
  });
}

export function getCompany(companyId: string) {
  return request<{ company: CompanyDetail }>(`/api/modules/companies/companies/${companyId}`);
}

export function createContact(companyId: string, input: ContactInput) {
  return request<{ contact: { id: string } }>(`/api/modules/companies/companies/${companyId}/contacts`, {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export function createBankAccount(companyId: string, input: BankAccountInput) {
  return request<{ bankAccount: { id: string } }>(
    `/api/modules/companies/companies/${companyId}/bank-accounts`,
    {
      method: 'POST',
      body: JSON.stringify(input)
    }
  );
}
