import type { FrontendModuleDefinition } from '../../../../apps/web/src/modules/types';
import { CompaniesModule } from './CompaniesModule';
import { companiesTranslations } from './translations';

export const companiesModule: FrontendModuleDefinition = {
  code: 'companies',
  routePath: '/modules/companies',
  Component: CompaniesModule,
  translations: companiesTranslations
};
