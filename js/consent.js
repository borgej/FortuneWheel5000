// ---------------------------------------------------------------------------
// Cookie consent management
// ---------------------------------------------------------------------------
(function initConsent() {
  function applyConsent(consent) {
    mwSetCookie('mw.consent', consent, 365);
    if (typeof gtag === 'function') {
      gtag('consent', 'update', { analytics_storage: consent.analytics ? 'granted' : 'denied' });
    }
  }

  const banner = document.getElementById('consentBanner');
  const analyticsCheckbox = document.getElementById('consentAnalytics');
  if (!banner) return;

  const stored = mwGetCookie('mw.consent');
  if (!stored || !stored.decided) {
    // First visit — show banner with analytics unchecked (opt-in, GDPR compliant)
    if (analyticsCheckbox) analyticsCheckbox.checked = false;
    banner.style.display = 'flex';
  } else {
    // Restore checkbox state for when settings are re-opened
    if (analyticsCheckbox) analyticsCheckbox.checked = !!stored.analytics;
  }

  document.getElementById('consentAcceptAll')?.addEventListener('click', () => {
    if (analyticsCheckbox) analyticsCheckbox.checked = true;
    applyConsent({ analytics: true, decided: true });
    banner.style.display = 'none';
  });
  document.getElementById('consentSaveChoices')?.addEventListener('click', () => {
    applyConsent({ analytics: !!analyticsCheckbox?.checked, decided: true });
    banner.style.display = 'none';
  });
  document.getElementById('consentRejectAll')?.addEventListener('click', () => {
    if (analyticsCheckbox) analyticsCheckbox.checked = false;
    applyConsent({ analytics: false, decided: true });
    banner.style.display = 'none';
  });

  // "Cookie settings" link reopens the banner
  document.getElementById('cookieSettingsLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (analyticsCheckbox && stored) analyticsCheckbox.checked = !!stored.analytics;
    banner.style.display = 'flex';
  });
  // Close banner on backdrop click
  banner.addEventListener('click', (e) => { if (e.target === banner) banner.style.display = 'none'; });
})();
