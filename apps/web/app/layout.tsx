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
import { useAuth } from "@/hooks/useAuth";


function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();

  // ✅ Show BottomNav only when user is logged in
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

    return () => {
      listener.then(l => l.remove());
    };
  }, []);

  return (
    <>
      {/* ✅ Always visible */}
<div className="min-h-screen flex flex-col">
  <TopNav />

  <main className="flex-1 pt-[calc(64px+env(safe-area-inset-top))] pb-20">
    {children}
  </main>

  {showBottomNav && <BottomNav />}

  <Footer />
  <LocationPermissionPopup />
</div>
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
