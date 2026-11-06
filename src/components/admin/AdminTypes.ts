export type AdminTab =
  | 'dashboard'
  | 'catalog'
  | 'services'
  | 'promos'
  | 'settings';

export type ServicesSubTab = 'CUSTOM_ORDERS' | 'INBOX_MESSAGES';

export const ADMIN_LOGO_PATH = '/logo.jpg?v=2';

export interface FeedbackBanner {
  type: 'success' | 'error';
  message: string;
}