import { request } from '../../../../apps/web/src/api/client';

export interface TendersOverview {
  module: string;
  status: string;
  capabilities: string[];
}

export function getTendersOverview() {
  return request<TendersOverview>('/api/modules/tenders/overview');
}

