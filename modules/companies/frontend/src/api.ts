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
  contractingAuthority: boolean;
  contactCount: number;
  bankAccountCount: number;
}

export interface CompanyContact {
  id: string;
  name: string;
  email: string | null;
  phoneNumber: string | null;
  dateOfBirth: string | null;
  role: CompanyPersonRole | null;
  preferred: boolean;
}

export interface CompanyBankAccount {
  id: string;
  bankAccountNumber: string;
  bankCode: string | null;
  preferred: boolean;
}

export type CompanyPersonRole = 'board_member' | 'vice_chairman' | 'chairman' | 'executive_dictor' | 'owner';

export interface CompanyDetail extends Omit<CompanySummary, 'contactCount' | 'bankAccountCount'> {
  contacts: CompanyContact[];
  bankAccounts: CompanyBankAccount[];
}

export interface CompanyInput {
  name: string;
  ico?: string | null;
  dic?: string | null;
  icDph?: string | null;
  addressStreet?: string | null;
  addressNumber?: string | null;
  addressCity?: string | null;
  addressCountry: string;
  addressPostalCode?: string | null;
  contractingAuthority: boolean;
}

export interface ContactInput {
  name: string;
  email?: string | null;
  phoneNumber?: string | null;
  dateOfBirth?: string | null;
  role?: CompanyPersonRole | null;
  preferred: boolean;
}

export interface BankAccountInput {
  bankAccountNumber: string;
  bankCode?: string | null;
  preferred: boolean;
}

export interface ResolvedBankAccount {
  bankAccountNumber: string;
  bankCode: string | null;
}

export interface ResolvedStatutoryBody {
  name: string | null;
  role: string | null;
}

export interface ResolvedCompany {
  ico: string;
  name: string;
  dic: string | null;
  icDph: string | null;
  addressFull: string | null;
  addressCity: string | null;
  addressStreet: string | null;
  addressNumber: string | null;
  addressCountry: string | null;
  addressPostalCode: string | null;
  statutoryBodies: ResolvedStatutoryBody[];
  bankAccounts: ResolvedBankAccount[];
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

export function updateCompany(companyId: string, input: CompanyInput) {
  return request<{ company: CompanySummary }>(`/api/modules/companies/companies/${companyId}`, {
    method: 'PATCH',
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

export function updateContact(companyId: string, contactId: string, input: ContactInput) {
  return request<{ contact: { id: string } }>(
    `/api/modules/companies/companies/${companyId}/contacts/${contactId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input)
    }
  );
}

export function deleteContact(companyId: string, contactId: string) {
  return request<{ success: true }>(`/api/modules/companies/companies/${companyId}/contacts/${contactId}`, {
    method: 'DELETE'
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

export function updateBankAccount(companyId: string, bankAccountId: string, input: BankAccountInput) {
  return request<{ bankAccount: { id: string } }>(
    `/api/modules/companies/companies/${companyId}/bank-accounts/${bankAccountId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input)
    }
  );
}

export function deleteBankAccount(companyId: string, bankAccountId: string) {
  return request<{ success: true }>(
    `/api/modules/companies/companies/${companyId}/bank-accounts/${bankAccountId}`,
    {
      method: 'DELETE'
    }
  );
}
