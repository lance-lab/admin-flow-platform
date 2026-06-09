import { request } from '../../../../apps/web/src/api/client';

export interface TendersOverview {
  module: string;
  status: string;
  capabilities: string[];
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
