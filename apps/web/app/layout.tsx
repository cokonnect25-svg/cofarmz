'use client';

import "./globals.css";
import { AppGenProvider } from "@/components/appgen-provider";
import TopNav from "@/app/components/TopNav";
import Footer from "@/app/components/Footer";
import GoogleTranslate from "@/app/components/GoogleTranslate";
import { usePathname, useRouter } from "next/navigation";
import { RoleSelectionGuard } from "@/components/RoleSelectionGuard";
import LocationPermissionPopup from "@/app/components/LocationPermissionPopup";
import BottomNav from "@/app/components/BottomNav";
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { useEffect } from "react";
import { authClient } from "@/lib/auth-client";

function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const hideNav = ['/login', '/signup', '/forgot-password', '/reset-password', '/select-role', '/auth-callback'].includes(pathname);

  useEffect(() => {
    const handleUrlOpen = async (event: any) => {
      const url = event.url;
      if (url.includes('auth-callback')) {
        await Browser.close();
        
        // Give Capacitor a moment to sync cookies before refreshing
        setTimeout(async () => {
          await authClient.getSession();
          // Force a full page reload to ensure all guards and state are reset
          window.location.replace('/');
        }, 500);
      }
    };

    const listener = App.addListener('appUrlOpen', handleUrlOpen);

    return () => {
      listener.then(l => l.remove());
    };
  }, []);

  return (
    <>
      {!hideNav && <TopNav />}
      <main className={!hideNav ? 'pt-16 pb-28 md:pb-0' : ''}>
        <RoleSelectionGuard>
          {children}
        </RoleSelectionGuard>
      </main>
      {!hideNav && <Footer />}
      {!hideNav && <BottomNav />}
      <div
  onClick={() => window.open('https://play.google.com/store/apps/details?id=YOUR_PACKAGE_NAME', '_blank')}
  className="fixed bottom-24 right-4 z-[9999] flex items-center gap-3 bg-gradient-to-r from-green-600 to-emerald-500 text-white px-4 py-3 rounded-full shadow-xl cursor-pointer animate-bounce hover:animate-none active:scale-95 transition-all before:absolute before:inset-0 before:rounded-full before:bg-green-400/30 before:blur-lg before:-z-10"
>
<img
  src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg"
  className="w-24 h-auto"
/>
  <span className="text-sm font-bold">Get App</span>
</div>
      <LocationPermissionPopup />
    </>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
        <title>CoFarmz</title>
        <link rel="icon" href="/assets/cofarmz-logo.png" type="image/png" />
        <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=satoshi@900,700,500,400&display=swap" />
        <script src="https://unpkg.com/@phosphor-icons/web"></script>
        <style>{`
          .goog-te-banner-frame { display: none !important; }
          body { top: 0 !important; }
          #google_translate_element { position: absolute; opacity: 0; pointer-events: none; }
          .goog-te-gadget { font-size: 0 !important; }
        `}</style>
      </head>
      <body className="antialiased bg-surface-muted" suppressHydrationWarning>
        <AppGenProvider>
          <GoogleTranslate />
          <LayoutContent>{children}</LayoutContent>
        </AppGenProvider>
      </body>
    </html>
  );
}
