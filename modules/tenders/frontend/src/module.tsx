import type { FrontendModuleDefinition } from '../../../../apps/web/src/modules/types';
import { TendersModule } from './TendersModule';
import { tendersTranslations } from './translations';

export const tendersModule: FrontendModuleDefinition = {
  code: 'tenders',
  routePath: '/modules/tenders',
  Component: TendersModule,
  translations: tendersTranslations
};

