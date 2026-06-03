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
    'nav.users': 'Používatelia',
    'nav.signOut': 'Odhlásiť sa',
    'workspace.label': 'Pracovný režim',
    'workspace.platform': 'Platform Admin',
    'shell.loading': 'Načítavam platformu...',
    'shell.signedIn': 'Prihlásený',
    'dashboard.eyebrow': 'Platforma',
    'dashboard.title': 'Stav systému',
    'dashboard.permissions': '{{count}} oprávnení',
    'dashboard.health': 'Zdravie systému',
    'dashboard.healthUnavailable': 'Kontrola zdravia',
    'dashboard.healthUnavailableDetail': 'Stav systému sa nepodarilo načítať.',
    'users.eyebrow': 'Platforma',
    'users.title': 'Používatelia',
    'users.create': 'Vytvoriť používateľa',
    'users.edit': 'Upraviť',
    'users.delete': 'Vymazať',
    'users.deleteTitle': 'Vymazať používateľa',
    'users.cancel': 'Zrušiť',
    'users.save': 'Uložiť',
    'users.actions': 'Akcie',
    'users.email': 'Email',
    'users.displayName': 'Meno',
    'users.locale': 'Jazyk',
    'users.roles': 'Roly',
    'users.status': 'Stav',
    'users.password': 'Heslo',
    'users.active': 'Aktívny',
    'users.passwordSet': 'Nastavené',
    'users.passwordPending': 'Čaká na nastavenie',
    'users.setupLink': 'Odkaz na nastavenie hesla',
    'users.created': 'Používateľ bol vytvorený.',
    'users.updated': 'Používateľ bol upravený.',
    'users.deleted': 'Používateľ bol vymazaný.',
    'users.error': 'Používateľa sa nepodarilo vytvoriť.',
    'users.updateError': 'Používateľa sa nepodarilo upraviť.',
    'users.deleteError': 'Používateľa sa nepodarilo vymazať.',
    'users.confirmDelete': 'Naozaj chcete vymazať používateľa {{email}}?',
    'setup.title': 'Nastavenie hesla',
    'setup.subtitle': 'Nastavte si prvé heslo pre účet {{email}}.',
    'setup.password': 'Nové heslo',
    'setup.confirmPassword': 'Potvrdenie hesla',
    'setup.submit': 'Nastaviť heslo',
    'setup.success': 'Heslo bolo nastavené. Teraz sa môžete prihlásiť.',
    'setup.error': 'Odkaz je neplatný alebo expiroval.',
    'setup.passwordMismatch': 'Heslá sa nezhodujú.',
    'setup.passwordShort': 'Heslo musí mať aspoň 8 znakov.'
  },
  en: {
    'app.brand': 'Admin Flow',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.signIn': 'Sign in',
    'auth.signingIn': 'Signing in...',
    'auth.error': 'Could not sign in. Make sure the gateway and database are running.',
    'nav.dashboard': 'Dashboard',
    'nav.users': 'Users',
    'nav.signOut': 'Sign out',
    'workspace.label': 'Workspace',
    'workspace.platform': 'Platform Admin',
    'shell.loading': 'Loading platform...',
    'shell.signedIn': 'Signed in',
    'dashboard.eyebrow': 'Platform',
    'dashboard.title': 'System Health',
    'dashboard.permissions': '{{count}} permissions',
    'dashboard.health': 'Health',
    'dashboard.healthUnavailable': 'Health check',
    'dashboard.healthUnavailableDetail': 'Could not load system health.',
    'users.eyebrow': 'Platform',
    'users.title': 'Users',
    'users.create': 'Create user',
    'users.edit': 'Edit',
    'users.delete': 'Delete',
    'users.deleteTitle': 'Delete user',
    'users.cancel': 'Cancel',
    'users.save': 'Save',
    'users.actions': 'Actions',
    'users.email': 'Email',
    'users.displayName': 'Name',
    'users.locale': 'Language',
    'users.roles': 'Roles',
    'users.status': 'Status',
    'users.password': 'Password',
    'users.active': 'Active',
    'users.passwordSet': 'Set',
    'users.passwordPending': 'Pending setup',
    'users.setupLink': 'Password setup link',
    'users.created': 'User was created.',
    'users.updated': 'User was updated.',
    'users.deleted': 'User was deleted.',
    'users.error': 'Could not create user.',
    'users.updateError': 'Could not update user.',
    'users.deleteError': 'Could not delete user.',
    'users.confirmDelete': 'Delete user {{email}}?',
    'setup.title': 'Set password',
    'setup.subtitle': 'Set the first password for {{email}}.',
    'setup.password': 'New password',
    'setup.confirmPassword': 'Confirm password',
    'setup.submit': 'Set password',
    'setup.success': 'Password was set. You can sign in now.',
    'setup.error': 'This link is invalid or expired.',
    'setup.passwordMismatch': 'Passwords do not match.',
    'setup.passwordShort': 'Password must have at least 8 characters.'
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
