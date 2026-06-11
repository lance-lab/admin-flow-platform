import { request } from '../../../../apps/web/src/api/client';

export interface TendersOverview {
  module: string;
  status: string;
  capabilities: string[];
}

export interface ContractingAuthorityCompanySummary {
  id: string;
  name: string;
  ico: string | null;
}

export interface CompanyContactSummary {
  id: string;
  name: string;
  email: string | null;
  phoneNumber: string | null;
  dateOfBirth: string | null;
  role: string | null;
  preferred: boolean;
}

export interface CompanyBankAccountSummary {
  id: string;
  bankAccountNumber: string;
  bankCode: string | null;
  preferred: boolean;
}

export interface ContractingAuthorityCompanyDetail extends ContractingAuthorityCompanySummary {
  dic: string | null;
  icDph: string | null;
  addressStreet: string | null;
  addressNumber: string | null;
  addressCity: string | null;
  addressCountry: string | null;
  addressPostalCode: string | null;
  contractingAuthority: boolean;
  contacts: CompanyContactSummary[];
  bankAccounts: CompanyBankAccountSummary[];
}

export type TenderType = 'survey' | 'competition';
export type ProcurementType = 'goods' | 'services' | 'works';
export type ProcurementItemUnit = 'pcs' | 'm' | 'kg';

export interface ProcurementItemSummary {
  id: string;
  procurementContractId: string;
  name: string;
  description: string | null;
  quantity: number | null;
  unit: ProcurementItemUnit | null;
  estimatedValueExclVat: number | null;
  estimatedValueInclVat: number | null;
}

export interface ProcurementContractSummary {
  id: string;
  tenderId: string;
  tenderType: TenderType;
  josephineExternalId: string | null;
  contractingAuthorityCompanyId: string | null;
  contractingAuthorityCompanyName: string | null;
  contractingAuthorityCompanyIco: string | null;
  contractingAuthorityCompanyDic: string | null;
  contractingAuthorityCompanyIcDph: string | null;
  contractingAuthorityCompanyAddressStreet: string | null;
  contractingAuthorityCompanyAddressNumber: string | null;
  contractingAuthorityCompanyAddressCity: string | null;
  contractingAuthorityCompanyAddressCountry: string | null;
  contractingAuthorityCompanyAddressPostalCode: string | null;
  contractingAuthorityCompanyContractingAuthority: boolean | null;
  contractingAuthorityContactPersonId: string | null;
  contractingAuthorityContactPersonName: string | null;
  contractingAuthorityContactPersonEmail: string | null;
  contractingAuthorityContactPersonPhoneNumber: string | null;
  contractingAuthorityContactPersonDateOfBirth: string | null;
  contractingAuthorityContactPersonRole: string | null;
  contractingAuthorityBankAccountId: string | null;
  contractingAuthorityBankAccountNumber: string | null;
  contractingAuthorityBankCode: string | null;
  supplierCompanyId: string | null;
  supplierCompanyName: string | null;
  supplierCompanyIco: string | null;
  supplierCompanyDic: string | null;
  supplierCompanyIcDph: string | null;
  supplierCompanyAddressStreet: string | null;
  supplierCompanyAddressNumber: string | null;
  supplierCompanyAddressCity: string | null;
  supplierCompanyAddressCountry: string | null;
  supplierCompanyAddressPostalCode: string | null;
  supplierCompanyContractingAuthority: boolean | null;
  supplierContactPersonId: string | null;
  supplierContactPersonName: string | null;
  supplierContactPersonEmail: string | null;
  supplierContactPersonPhoneNumber: string | null;
  supplierContactPersonDateOfBirth: string | null;
  supplierContactPersonRole: string | null;
  supplierBankAccountId: string | null;
  supplierBankAccountNumber: string | null;
  supplierBankCode: string | null;
  measureId: string | null;
  measureNumber: string | null;
  measureSubNumber: string | null;
  callNumber: string | null;
  procurementType: ProcurementType | null;
  name: string;
  lotDivision: string | null;
  projectName: string | null;
  projectCode: string | null;
  cpvCode: string | null;
  contractType: string | null;
  deliveryAddressStreetNumber: string | null;
  deliveryAddressPostalCode: string | null;
  deliveryAddressCity: string | null;
  estimatedValueExclVat: number | null;
  estimatedValueInclVat: number | null;
  items: ProcurementItemSummary[];
}

export interface ProcurementContractInput {
  tenderType: TenderType;
  josephineExternalId?: string | null;
  contractingAuthorityCompanyId?: string | null;
  contractingAuthorityContactPersonId?: string | null;
  contractingAuthorityBankAccountId?: string | null;
  supplierCompanyId?: string | null;
  supplierContactPersonId?: string | null;
  supplierBankAccountId?: string | null;
  measureNumber?: string | null;
  measureSubNumber?: string | null;
  callNumber?: string | null;
  procurementType?: ProcurementType | null;
  name: string;
  lotDivision?: string | null;
  projectName?: string | null;
  projectCode?: string | null;
  cpvCode?: string | null;
  contractType?: string | null;
  deliveryAddressStreetNumber?: string | null;
  deliveryAddressPostalCode?: string | null;
  deliveryAddressCity?: string | null;
  estimatedValueExclVat?: number | null;
  estimatedValueInclVat?: number | null;
  items?: ProcurementItemInput[];
}

export interface ProcurementItemInput {
  name: string;
  description?: string | null;
  quantity?: number | null;
  unit?: ProcurementItemUnit | null;
  estimatedValueExclVat?: number | null;
  estimatedValueInclVat?: number | null;
}

export function getTendersOverview() {
  return request<TendersOverview>('/api/modules/tenders/overview');
}

export function listProcurementContracts() {
  return request<{ procurementContracts: ProcurementContractSummary[] }>(
    '/api/modules/tenders/procurement-contracts'
  );
}

export async function listContractingAuthorityCompanies() {
  return request<{ companies: ContractingAuthorityCompanySummary[] }>(
    '/api/modules/tenders/contracting-authority-companies'
  );
}

export async function getContractingAuthorityCompany(companyId: string) {
  return request<{ company: ContractingAuthorityCompanyDetail }>(
    `/api/modules/tenders/contracting-authority-companies/${companyId}`
  );
}

export async function listCompanies() {
  return request<{ companies: ContractingAuthorityCompanySummary[] }>('/api/modules/tenders/companies');
}

export async function getCompany(companyId: string) {
  return request<{ company: ContractingAuthorityCompanyDetail }>(`/api/modules/tenders/companies/${companyId}`);
}

export function createProcurementContract(input: ProcurementContractInput) {
  return request<{ procurementContract: { id: string } }>('/api/modules/tenders/procurement-contracts', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export function updateProcurementContract(procurementContractId: string, input: ProcurementContractInput) {
  return request<{ procurementContract: { id: string } }>(
    `/api/modules/tenders/procurement-contracts/${procurementContractId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input)
    }
  );
}

export function createProcurementItem(procurementContractId: string, input: ProcurementItemInput) {
  return request<{ procurementItem: ProcurementItemSummary }>(
    `/api/modules/tenders/procurement-contracts/${procurementContractId}/items`,
    {
      method: 'POST',
      body: JSON.stringify(input)
    }
  );
}
