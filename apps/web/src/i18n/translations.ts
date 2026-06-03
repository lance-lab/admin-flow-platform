import type { Locale } from '../../../../packages/shared-types/src';

type TranslationParams = Record<string, string | number>;

export type TranslationKey = string;
export type TranslationResources = Record<Locale, Record<TranslationKey, string>>;

export const locales: Record<Locale, string> = {
  sk: 'Slovenčina',
  en: 'English'
};

export const defaultLocale: Locale = 'sk';

const shellTranslations: TranslationResources = {
  sk: {
    'app.brand': 'Admin Flow',
    'auth.email': 'Email',
    'auth.password': 'Heslo',
    'auth.signIn': 'Prihlásiť sa',
    'auth.signingIn': 'Prihlasujem...',
    'auth.error': 'Prihlásenie zlyhalo. Skontrolujte, či beží gateway a databáza.',
    'nav.dashboard': 'Prehľad',
    'nav.signOut': 'Odhlásiť sa',
    'shell.loading': 'Načítavam platformu...',
    'shell.signedIn': 'Prihlásený',
    'dashboard.eyebrow': 'Platforma',
    'dashboard.title': 'Prevádzkový prehľad',
    'dashboard.permissions': '{{count}} oprávnení'
  },
  en: {
    'app.brand': 'Admin Flow',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.signIn': 'Sign in',
    'auth.signingIn': 'Signing in...',
    'auth.error': 'Could not sign in. Make sure the gateway and database are running.',
    'nav.dashboard': 'Dashboard',
    'nav.signOut': 'Sign out',
    'shell.loading': 'Loading platform...',
    'shell.signedIn': 'Signed in',
    'dashboard.eyebrow': 'Platform',
    'dashboard.title': 'Operations Dashboard',
    'dashboard.permissions': '{{count}} permissions'
  }
};

export function mergeTranslations(extraResources: TranslationResources[] = []): TranslationResources {
  return extraResources.reduce<TranslationResources>(
    (merged, resources) => ({
      sk: { ...merged.sk, ...resources.sk },
      en: { ...merged.en, ...resources.en }
    }),
    {
      sk: { ...shellTranslations.sk },
      en: { ...shellTranslations.en }
    }
  );
}

export function translate(
  resources: TranslationResources,
  locale: Locale,
  key: TranslationKey,
  params: TranslationParams = {}
) {
  const translations = resources;
  const template = translations[locale][key] ?? translations[defaultLocale][key] ?? key;

  return Object.entries(params).reduce(
    (text, [name, value]) => text.split(`{{${name}}}`).join(String(value)),
    template
  );
}
