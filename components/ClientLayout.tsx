'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import BottomNav from '@/components/BottomNav';
import Sidebar from '@/components/Sidebar';
import { getSession, SessionUser } from '@/lib/auth';

const PUBLIC_PATHS = ['/login'];

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const session = getSession();
    const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

    if (!session && !isPublic) {
      router.replace('/login');
      return;
    }
    if (session && pathname === '/login') {
      router.replace('/dashboard');
      return;
    }
    setUser(session);
    setChecking(false);
  }, [pathname, router]);

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (checking && !isPublic) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: '#000' }}>
        <div style={{ width: 22, height: 22, border: '2px solid #00ff41', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  void user;

  if (isPublic) {
    return <main>{children}</main>;
  }

  return (
    <>
      {/* Sidebar: desktop-only panel (hidden on mobile via CSS) */}
      <Sidebar />

      {/*
        Single shared <main> that adapts via CSS classes:
        - On mobile: top spacer (55px for the top bar) + bottom padding for BottomNav
        - On desktop: left margin (240px) for the sidebar
      */}
      <main
        className="md:ml-[240px]"
        style={{ minHeight: '100dvh' }}
      >
        {/* Mobile top-bar spacer — only visible on mobile */}
        <div className="md:hidden" style={{ height: 53 }} />

        {children}

        {/* Mobile bottom-nav spacer */}
        <div className="md:hidden" style={{ height: 100 }} />
      </main>

      {/* BottomNav: mobile only */}
      <div className="md:hidden">
        <BottomNav />
      </div>
    </>
  );
}
