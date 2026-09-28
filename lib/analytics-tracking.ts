const STATIC_ANALYTICS_PATHS = new Set([
  '/',
  '/account',
  '/admin',
  '/admin/readers',
  '/affiliate',
  '/auth',
  '/auth/complete',
  '/book',
  '/bookings',
  '/checkout',
  '/community',
  '/create',
  '/daily-spread',
  '/decks',
  '/forgot-password',
  '/game',
  '/guidebook',
  '/invites',
  '/journal',
  '/login',
  '/packages',
  '/practice',
  '/privacy',
  '/profile',
  '/register',
  '/reset-password',
  '/room',
  '/terms',
]);

export function isValidGa4MeasurementId(value: string | undefined): value is string {
  return typeof value === 'string' && /^G-[A-Z0-9]+$/.test(value);
}

export function sanitizeAnalyticsPath(pathname: string): string {
  const path = pathname.split(/[?#]/, 1)[0].replace(/\/$/, '') || '/';

  if (STATIC_ANALYTICS_PATHS.has(path)) return path;
  if (/^\/guidebook\/[^/]+$/.test(path)) return '/guidebook/[card]';
  if (/^\/r\/[^/]+$/.test(path)) return '/r/[share]';

  return '/[page]';
}

export function sanitizeAnalyticsReferrer(
  referrer: string,
  siteOrigin: string,
  previousPath?: string,
): string | undefined {
  if (previousPath !== undefined) {
    return previousPath.startsWith('/') && !previousPath.startsWith('//')
      ? sanitizeAnalyticsPath(previousPath)
      : undefined;
  }

  if (!referrer) return undefined;

  try {
    const site = new URL(siteOrigin);
    const source = new URL(referrer);
    if (!['http:', 'https:'].includes(site.protocol) || !['http:', 'https:'].includes(source.protocol)) {
      return undefined;
    }

    return source.origin === site.origin
      ? sanitizeAnalyticsPath(source.pathname)
      : source.origin;
  } catch {
    return undefined;
  }
}
