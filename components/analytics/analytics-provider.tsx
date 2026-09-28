'use client';

import { usePathname } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  isValidGa4MeasurementId,
  sanitizeAnalyticsPath,
  sanitizeAnalyticsReferrer,
} from '@/lib/analytics-tracking';

type AnalyticsConsent = 'accepted' | 'rejected' | null;

type AnalyticsConsentContextValue = {
  openPreferences: () => void;
};

type Gtag = (...args: unknown[]) => void;
type AnalyticsWindow = Window & { dataLayer?: unknown[]; gtag?: Gtag };

const CONSENT_STORAGE_KEY = 'natarot.analytics-consent.v1';
const TAG_SCRIPT_ID = 'natarot-ga4-tag';
const AnalyticsConsentContext = createContext<AnalyticsConsentContextValue | null>(null);

function getGtag(): Gtag {
  const analyticsWindow = window as AnalyticsWindow;
  analyticsWindow.dataLayer ??= [];
  analyticsWindow.gtag ??= (...args: unknown[]) => {
    analyticsWindow.dataLayer?.push(args);
  };
  return analyticsWindow.gtag;
}

function clearGaCookies() {
  const names = document.cookie.split(';').map((cookie) => cookie.trim().split('=', 1)[0]);
  const hostname = window.location.hostname;
  const domainParts = hostname.split('.');
  const domains = [undefined, hostname];
  for (let index = 1; index < domainParts.length - 1; index += 1) {
    domains.push(domainParts.slice(index).join('.'));
  }

  const pathParts = window.location.pathname.split('/').filter(Boolean);
  const paths = ['/'];
  for (let index = 1; index <= pathParts.length; index += 1) {
    paths.push(`/${pathParts.slice(0, index).join('/')}`);
  }

  for (const name of names) {
    if (!/^_ga(?:_|$)/.test(name)) continue;
    for (const domain of domains) {
      for (const path of paths) {
        document.cookie = `${name}=; Max-Age=0; Path=${path}${domain ? `; Domain=${domain}` : ''}`;
      }
    }
  }
}

function analyticsLocation(pathname: string): string {
  return `${window.location.origin}${sanitizeAnalyticsPath(pathname)}`;
}

function analyticsReferrer(previousPath?: string): string {
  const referrer = sanitizeAnalyticsReferrer(
    document.referrer,
    window.location.origin,
    previousPath,
  );
  // An explicit origin-only fallback prevents gtag from inferring a raw document.referrer.
  if (!referrer) return window.location.origin;
  return referrer.startsWith('/') ? `${window.location.origin}${referrer}` : referrer;
}

export function AnalyticsProvider({
  children,
  measurementId,
}: {
  children: React.ReactNode;
  measurementId?: string;
}) {
  const pathname = usePathname();
  const validMeasurementId = isValidGa4MeasurementId(measurementId) ? measurementId : null;
  const [consent, setConsent] = useState<AnalyticsConsent>(null);
  const [hydrated, setHydrated] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [tagReady, setTagReady] = useState(false);
  const consentRef = useRef<AnalyticsConsent>(null);
  const previousPathRef = useRef<string | null>(null);
  const lastTrackedPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!validMeasurementId) return;
    try {
      const stored = window.localStorage.getItem(CONSENT_STORAGE_KEY);
      const choice = stored === 'accepted' || stored === 'rejected' ? stored : null;
      consentRef.current = choice;
      setConsent(choice);
    } catch {
      consentRef.current = null;
    }
    setHydrated(true);
  }, [validMeasurementId]);

  useEffect(() => {
    if (!validMeasurementId || !hydrated || consent !== 'accepted') return;

    const gtag = getGtag();
    gtag('consent', 'default', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    gtag('consent', 'update', { analytics_storage: 'granted' });

    const initializeTag = () => {
      if (consentRef.current !== 'accepted') return;
      const script = document.getElementById(TAG_SCRIPT_ID) as HTMLScriptElement | null;
      if (script?.dataset.natarotReady !== 'true') {
        const referrer = analyticsReferrer();
        gtag('js', new Date());
        gtag('config', validMeasurementId, {
          send_page_view: false,
          allow_google_signals: false,
          allow_ad_personalization_signals: false,
          page_title: 'NaTarot',
          page_location: analyticsLocation(window.location.pathname),
          page_referrer: referrer,
        });
        if (script) script.dataset.natarotReady = 'true';
      }
      setTagReady(true);
    };

    let script = document.getElementById(TAG_SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = TAG_SCRIPT_ID;
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(validMeasurementId)}`;
      const newScript = script;
      script.addEventListener('load', () => {
        newScript.dataset.natarotLoaded = 'true';
      }, { once: true });
      script.addEventListener('load', initializeTag, { once: true });
      document.head.appendChild(script);
    } else if (script.dataset.natarotLoaded === 'true' || script.dataset.natarotReady === 'true') {
      initializeTag();
    } else {
      script.addEventListener('load', initializeTag, { once: true });
    }

    return () => {
      script?.removeEventListener('load', initializeTag);
    };
  }, [consent, hydrated, validMeasurementId]);

  useEffect(() => {
    if (!validMeasurementId || !tagReady || consent !== 'accepted' || consentRef.current !== 'accepted' || !pathname) return;
    const currentPath = sanitizeAnalyticsPath(pathname);
    if (lastTrackedPathRef.current === pathname) return;

    const referrer = analyticsReferrer(previousPathRef.current ?? undefined);
    getGtag()('event', 'page_view', {
      page_title: 'NaTarot',
      page_location: analyticsLocation(pathname),
      page_referrer: referrer,
      send_to: validMeasurementId,
    });
    previousPathRef.current = currentPath;
    lastTrackedPathRef.current = pathname;
  }, [consent, pathname, tagReady, validMeasurementId]);

  const chooseConsent = useCallback((choice: Exclude<AnalyticsConsent, null>) => {
    const wasAccepted = consentRef.current === 'accepted';
    consentRef.current = choice;
    if (choice === 'rejected' && wasAccepted) {
      getGtag()('consent', 'update', {
        analytics_storage: 'denied',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
      });
      clearGaCookies();
      previousPathRef.current = null;
      lastTrackedPathRef.current = null;
      setTagReady(false);
    }
    try {
      window.localStorage.setItem(CONSENT_STORAGE_KEY, choice);
    } catch {
      // The choice still applies for this page when browser storage is unavailable.
    }
    setConsent(choice);
    setPreferencesOpen(false);
  }, []);

  const openPreferences = useCallback(() => {
    if (validMeasurementId) setPreferencesOpen(true);
  }, [validMeasurementId]);

  return (
    <AnalyticsConsentContext.Provider value={validMeasurementId ? { openPreferences } : null}>
      {children}
      {validMeasurementId && hydrated && (consent === null || preferencesOpen) && (
        <section className="analytics-consent" aria-label="Tùy chọn phân tích / Analytics preferences">
          <div className="analytics-consent__content">
            <h2>Quyền riêng tư / Your privacy</h2>
            <p>NaTarot chỉ đo lượt xem trang và phiên truy cập sau khi bạn cho phép. / NaTarot measures page views and sessions only after you allow it.</p>
          </div>
          <div className="analytics-consent__actions">
            <button type="button" onClick={() => chooseConsent('accepted')}>
              Cho phép phân tích / Allow analytics
            </button>
            <button type="button" onClick={() => chooseConsent('rejected')}>
              Từ chối / Reject
            </button>
          </div>
        </section>
      )}
    </AnalyticsConsentContext.Provider>
  );
}

export function AnalyticsPreferencesButton() {
  const context = useContext(AnalyticsConsentContext);
  if (!context) return null;
  return (
    <button type="button" className="analytics-consent__preferences" onClick={context.openPreferences}>
      Tùy chọn phân tích / Analytics preferences
    </button>
  );
}
