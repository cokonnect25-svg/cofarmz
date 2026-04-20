'use client';

import "./globals.css";
import { AppGenProvider } from "@/components/appgen-provider";
import TopNav from "@/app/components/TopNav";
import Footer from "@/app/components/Footer";
import GoogleTranslate from "@/app/components/GoogleTranslate";
import LocationPermissionPopup from "@/app/components/LocationPermissionPopup";
import BottomNav from "@/app/components/BottomNav";
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { useEffect } from "react";
import { authClient } from "@/lib/auth-client";
import { useAuth } from "@/hooks/useAuth";

const TOP_NAV_H = 64;  // must match TopNav h-[64px]
const BOTTOM_NAV_H = 60; // must match BottomNav height

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const showBottomNav = !!user;

  useEffect(() => {
    const handleUrlOpen = async (event: any) => {
      const url = event.url;
      if (url.includes('auth-callback')) {
        await Browser.close();
        setTimeout(async () => {
          await authClient.getSession();
          window.location.replace('/');
        }, 500);
      }
    };
    const listener = App.addListener('appUrlOpen', handleUrlOpen);
    return () => { listener.then(l => l.remove()); };
  }, []);

  return (
   <div className="flex flex-col min-h-[100dvh]">
      <TopNav />

      <main
        className="flex-1 w-full"
        style={{
          paddingTop: `calc(${TOP_NAV_H}px + env(safe-area-inset-top))`,
          // Global bottom padding — every page is safe without per-page changes
          paddingBottom: showBottomNav
            ? `calc(${BOTTOM_NAV_H}px + env(safe-area-inset-bottom))`
            : '0px',
        }}
      >
        {/*
          Override min-min-h-[100dvh] / min-h-[100dvh] globally when BottomNav is showing.
          Pages that use these utilities would otherwise overflow the safe area
          and hide their bottom content behind the nav.
        */}
        {showBottomNav && (
          <style>{`
            .min-min-h-[100dvh] {
              min-height: calc(
                100dvh
                - ${TOP_NAV_H}px
                - ${BOTTOM_NAV_H}px
                - env(safe-area-inset-top)
                - env(safe-area-inset-bottom)
              ) !important;
            }
            .min-h-[100dvh] {
              height: calc(
                100dvh
                - ${TOP_NAV_H}px
                - ${BOTTOM_NAV_H}px
                - env(safe-area-inset-top)
                - env(safe-area-inset-bottom)
              ) !important;
            }
          `}</style>
        )}

        {children}
      </main>

      {showBottomNav && <BottomNav />}

      {/* Footer only rendered for logged-out users */}
      {!showBottomNav && <Footer />}

      <LocationPermissionPopup />
    </div>
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
        <link rel="shortcut icon" href="/assets/cofarmz-logo.png" type="image/png" />
        <link rel="apple-touch-icon" href="/assets/cofarmz-logo.png" />
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