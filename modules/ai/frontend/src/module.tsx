import type { FrontendModuleDefinition } from '../../../../apps/web/src/modules/types';
import { AiModule } from './AiModule';
import { aiTranslations } from './translations';

export const aiModule: FrontendModuleDefinition = {
  code: 'ai',
  routePath: '/modules/ai',
  Component: AiModule,
  translations: aiTranslations
};
