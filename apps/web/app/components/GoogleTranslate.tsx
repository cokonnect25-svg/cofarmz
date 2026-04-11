'use client';

import { useEffect } from 'react';

export default function GoogleTranslate() {
  useEffect(() => {
    (window as any).googleTranslateElementInit = () => {
      new (window as any).google.translate.TranslateElement(
        {
          pageLanguage: 'en',
          includedLanguages: 'hi,te,ta,kn,mr,gu,pa,bn,ml,ur,en',
          autoDisplay: false,
        },
        'google_translate_element'
      );
    };

    if (!document.getElementById('google-translate-script')) {
      const script = document.createElement('script');
      script.id = 'google-translate-script';
      script.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      script.async = true;
      document.body.appendChild(script);
    }

    // Expose a global translate trigger function
    (window as any).triggerTranslate = (lang: string) => {
      const attempt = (tries: number) => {
        const combo = document.querySelector('select.goog-te-combo') as HTMLSelectElement | null;
        if (combo) {
          combo.value = lang;
          combo.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (tries > 0) {
          setTimeout(() => attempt(tries - 1), 500);
        } else {
          // Fallback: set cookie and reload
          document.cookie = `googtrans=/en/${lang}; path=/`;
          document.cookie = `googtrans=/en/${lang}; path=/; domain=.${window.location.hostname}`;
          window.location.reload();
        }
      };
      attempt(10);
    };
  }, []);

  return <div id="google_translate_element" style={{ display: 'none', position: 'absolute' }} />;
}
