/**
 * TZ Digital — self-contained cookie consent banner (no external consent-management service).
 *
 * Gates two things until the visitor has made a choice:
 *   - Google Analytics 4 (gtag.js is not even injected into the page until consent is granted)
 *   - The Google Maps embed on the homepage (its iframe src is not set until consent is granted)
 *
 * Implements Google Consent Mode v2: a "default" (all denied) consent state is pushed to the
 * dataLayer before gtag.js ever loads, and "update" is pushed once the visitor responds.
 *
 * Only two categories exist here on purpose: "Notwendig" (always on, nothing to gate — the site
 * has no cookies of its own) and "Statistik" (covers both GA4 and the Maps embed, since neither
 * is used for advertising/personalization). The ad_storage/ad_user_data/ad_personalization
 * consent signals are still set for Consent Mode v2 completeness, but nothing on this site
 * actually reads them for ad purposes.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'tzd-consent';
  var GA_MEASUREMENT_ID = 'G-J4BN0QL2QE';

  /* --------------------------------------------------------------------------
     dataLayer / gtag stub + Consent Mode v2 default state.
     This must run before the real gtag.js library ever loads. Since gtag.js is only
     ever injected by loadAnalytics() below (never statically in the HTML), that
     ordering is guaranteed as long as this runs first in this file.
     -------------------------------------------------------------------------- */

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = gtag;

  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    wait_for_update: 500
  });

  /* --------------------------------------------------------------------------
     Storage
     -------------------------------------------------------------------------- */

  function readStoredConsent() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return typeof parsed.statistics === 'boolean' ? parsed : null;
    } catch (e) {
      return null;
    }
  }

  function writeStoredConsent(statistics) {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ statistics: statistics, timestamp: new Date().toISOString() })
      );
    } catch (e) {
      /* localStorage unavailable (private mode, disabled storage, etc.) — the banner will
         simply reappear next visit, which is the safe fallback. */
    }
  }

  /* --------------------------------------------------------------------------
     Gated resources: GA4 + Google Maps
     -------------------------------------------------------------------------- */

  var gaLoaded = false;

  function loadAnalytics() {
    if (gaLoaded) return;
    gaLoaded = true;

    gtag('consent', 'update', { analytics_storage: 'granted' });
    gtag('js', new Date());
    gtag('config', GA_MEASUREMENT_ID);

    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_MEASUREMENT_ID;
    document.head.appendChild(script);
  }

  function signalAnalyticsDenied() {
    gtag('consent', 'update', { analytics_storage: 'denied' });
  }

  function loadGatedEmbeds() {
    var embeds = document.querySelectorAll('[data-consent-embed="maps"]');
    embeds.forEach(function (iframe) {
      var src = iframe.getAttribute('data-src');
      if (src && !iframe.getAttribute('src')) {
        iframe.setAttribute('src', src);
      }
      iframe.style.display = '';
      var wrapper = iframe.closest('[data-consent-embed-wrapper]');
      if (wrapper) {
        var placeholder = wrapper.querySelector('.consent-embed-placeholder');
        if (placeholder) placeholder.hidden = true;
      }
    });
  }

  function applyConsent(statistics) {
    if (statistics) {
      loadAnalytics();
      loadGatedEmbeds();
    } else {
      signalAnalyticsDenied();
    }
  }

  /* --------------------------------------------------------------------------
     Banner UI — built entirely in JS so the markup/text lives in one place
     instead of being duplicated across every page.
     -------------------------------------------------------------------------- */

  var bannerEl = null;
  var statisticsCheckbox = null;

  function buildBanner() {
    var el = document.createElement('div');
    el.className = 'consent-banner';
    el.id = 'consent-banner';
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', 'Cookie-Einstellungen');
    el.hidden = true;

    el.innerHTML =
      '<div class="consent-banner__inner">' +
      '<p class="consent-banner__title">Cookie-Einstellungen</p>' +
      '<p class="consent-banner__text">' +
      'Wir verwenden auf dieser Website Cookies bzw. vergleichbare Speichertechnologien. ' +
      '„Notwendig“ sind technisch erforderlich und immer aktiv — diese Website selbst ' +
      'setzt keine eigenen Cookies. „Statistik“ aktiviert Google Analytics und lädt die ' +
      'eingebettete Google-Karte; beides bleibt aus, bis Sie zustimmen. Ihre Wahl können Sie ' +
      'jederzeit über „Cookie-Einstellungen“ im Footer ändern.' +
      '</p>' +
      '<div class="consent-banner__categories" id="consent-banner-categories" hidden>' +
      '<label class="consent-banner__category">' +
      '<input type="checkbox" checked disabled>' +
      '<span><strong>Notwendig</strong> — für den Betrieb der Website erforderlich, immer aktiv.</span>' +
      '</label>' +
      '<label class="consent-banner__category">' +
      '<input type="checkbox" id="consent-toggle-statistics">' +
      '<span><strong>Statistik</strong> — Google Analytics und die eingebettete Google-Karte. Nur mit Ihrer Zustimmung aktiv.</span>' +
      '</label>' +
      '<button type="button" class="consent-banner__btn" id="consent-btn-save">Auswahl speichern</button>' +
      '</div>' +
      '<div class="consent-banner__actions" id="consent-banner-actions">' +
      '<button type="button" class="consent-banner__btn" id="consent-btn-categories">Kategorien wählen</button>' +
      '<button type="button" class="consent-banner__btn" id="consent-btn-reject">Nur notwendige</button>' +
      '<button type="button" class="consent-banner__btn" id="consent-btn-accept">Alle akzeptieren</button>' +
      '</div>' +
      '</div>';

    document.body.appendChild(el);

    statisticsCheckbox = el.querySelector('#consent-toggle-statistics');

    el.querySelector('#consent-btn-accept').addEventListener('click', function () {
      writeStoredConsent(true);
      applyConsent(true);
      hideBanner();
    });

    el.querySelector('#consent-btn-reject').addEventListener('click', function () {
      writeStoredConsent(false);
      applyConsent(false);
      hideBanner();
    });

    el.querySelector('#consent-btn-categories').addEventListener('click', function () {
      var categories = el.querySelector('#consent-banner-categories');
      var actions = el.querySelector('#consent-banner-actions');
      var willShowCategories = categories.hidden;
      categories.hidden = !willShowCategories;
      actions.hidden = willShowCategories;
    });

    el.querySelector('#consent-btn-save').addEventListener('click', function () {
      var statistics = !!statisticsCheckbox.checked;
      writeStoredConsent(statistics);
      applyConsent(statistics);
      hideBanner();
    });

    return el;
  }

  function showBanner() {
    if (!bannerEl) bannerEl = buildBanner();

    // Reset to the collapsed (three-button) view each time it's opened, but reflect
    // the visitor's current stored choice in the checkbox in case they open
    // "Kategorien wählen" to review/change it.
    var stored = readStoredConsent();
    statisticsCheckbox.checked = stored ? stored.statistics : false;
    bannerEl.querySelector('#consent-banner-categories').hidden = true;
    bannerEl.querySelector('#consent-banner-actions').hidden = false;

    bannerEl.hidden = false;
  }

  function hideBanner() {
    if (bannerEl) bannerEl.hidden = true;
  }

  /* --------------------------------------------------------------------------
     Init
     -------------------------------------------------------------------------- */

  var stored = readStoredConsent();
  if (stored) {
    applyConsent(stored.statistics);
  } else {
    showBanner();
  }

  document.querySelectorAll('[data-open-consent-settings]').forEach(function (trigger) {
    trigger.addEventListener('click', function (e) {
      e.preventDefault();
      showBanner();
    });
  });
})();
