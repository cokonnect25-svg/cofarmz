'use client';

import "./globals.css";
import { AppGenProvider } from "@/components/appgen-provider";
import TopNav from "@/app/components/TopNav";
import Footer from "@/app/components/Footer";
import OfflineWrapper from '@/app/OfflineScreen/OfflineWrapper';
import GoogleTranslate from "@/app/components/GoogleTranslate";
import LocationPermissionPopup from "@/app/components/LocationPermissionPopup";
import BottomNav from "@/app/components/BottomNav";
import Script from "next/script";
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useAuth } from "@/hooks/useAuth";
import { usePathname } from "next/navigation";
import AdSplash from "./components/AdSplash";
import { useHeartbeat } from '@/hooks/useHeartbeat';
import { getApiUrl } from "@/lib/api";

const TOP_NAV_H = 64;
const BOTTOM_NAV_H = 60;

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [showSplash, setShowSplash] = useState(false);

  useEffect(() => {
    const seen = sessionStorage.getItem("splash_seen");
    if (!seen) {
      sessionStorage.setItem("splash_seen", "1");
      setShowSplash(true);
    }
  }, []);

   useHeartbeat(user?.id);

  useEffect(() => {
    if (!pathname) return;

    const params = new URLSearchParams(window.location.search);
    const pagePath = `${pathname}${window.location.search}`;
    const isMachineryView = pathname === "/machinery-details";
    const isNearbyView = pathname === "/nearby-farmers";
    const isProfileView = pathname === "/farmer-profile" || pathname === "/user-profile";

    fetch(getApiUrl("/api/analytics"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType: isMachineryView ? "machinery_view" : isNearbyView ? "nearby_view" : isProfileView ? "profile_view" : "page_view",
        userId: user?.id || null,
        userName: user?.name || null,
        userEmail: user?.email || null,
        pagePath,
        entityType: isMachineryView ? "machinery" : isProfileView ? "profile" : isNearbyView ? "nearby" : null,
        entityId: params.get("id") || (pathname === "/user-profile" ? user?.id : null),
        metadata: {
          source: params.get("source"),
          type: params.get("type"),
          title: document.title,
        },
      }),
    }).catch(() => {});
  }, [pathname, user?.id]);

  const hideBottomNav = pathname?.startsWith("/chat");
  const showBottomNav = !!user && !hideBottomNav;

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
      {/* Phosphor icons - lazy loaded */}
      <Script
        src="https://unpkg.com/@phosphor-icons/web"
        strategy="lazyOnload"
      />

      {showSplash && <AdSplash onDone={() => setShowSplash(false)} />}
      <TopNav />

      <main
        className="flex-1 w-full"
        style={{
          paddingTop: `calc(${TOP_NAV_H}px + env(safe-area-inset-top))`,
          paddingBottom: showBottomNav
            ? `calc(${BOTTOM_NAV_H}px + env(safe-area-inset-bottom))`
            : `env(safe-area-inset-bottom)`,
        }}
      >
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

        {/* Google Translate CSS cleanup */}
        <style>{`
          .goog-te-banner-frame,
          .goog-te-ftab,
          .goog-te-menu-frame,
          .goog-te-balloon-frame,
          #goog-gt-tt,
          .goog-tooltip,
          .goog-te-menu2,
          .goog-te-gadget-icon,
          .VIpgJd-ZVi9od-ORHb-OEVmcd,
          .VIpgJd-ZVi9od-xl07Ob-lTBxed,
          .VIpgJd-ZVi9od-SmfZ-OEVmcd,
          .VIpgJd-yAWNEb-L7lbkb,
          .VIpgJd-yAWNEb-hvhgNd,
          .VIpgJd-yAWNEb-SmfZ,
          .skiptranslate,
          iframe.goog-te-banner-frame,
          body > .skiptranslate {
            display: none !important;
          }
          body {
            top: 0 !important;
            position: static !important;
          }
          .goog-te-gadget {
            font-size: 0 !important;
            color: transparent !important;
          }
          .goog-logo-link,
          .goog-logo-link:link,
          .goog-logo-link:visited,
          .goog-logo-link:hover,
          .goog-logo-link:active {
            display: none !important;
          }
        `}</style>
      </head>

      <body className="antialiased bg-surface-muted" suppressHydrationWarning>
        <AppGenProvider>
          <OfflineWrapper>
            <GoogleTranslate />
            <LayoutContent>{children}</LayoutContent>
          </OfflineWrapper>
        </AppGenProvider>
      </body>
    </html>
  );
}
