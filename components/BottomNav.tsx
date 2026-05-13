'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, BookOpen, ClipboardList, ArrowLeftRight, Plus, FileText, Users2 } from 'lucide-react';

const navItems = [
  { href: '/dashboard', icon: Home, label: 'Home' },
  { href: '/money-guide', icon: BookOpen, label: 'Guide' },
  { href: '/money-lists', icon: ClipboardList, label: 'Lists' },
  { href: '/transactions', icon: ArrowLeftRight, label: 'Transactions' },
  { href: '/add', icon: Plus, label: 'Add', isCenter: true },
  { href: '/invoices', icon: FileText, label: 'Invoices' },
  { href: '/founders', icon: Users2, label: 'Founders' },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pb-7 px-6">
      <nav
        className="flex items-center gap-1"
        style={{
          background: '#111',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '100px',
          padding: '8px 12px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.8), 0 0 0 0.5px rgba(255,255,255,0.05)',
        }}
      >
        {navItems.map(({ href, icon: Icon, isCenter }) => {
          const isActive = pathname === href;

          if (isCenter) {
            return (
              <Link
                key={href}
                href={href}
                className="mx-1 w-14 h-14 rounded-full flex items-center justify-center active:scale-95"
                style={{
                  background: '#00ff41',
                  boxShadow: '0 0 24px rgba(0,255,65,0.5), 0 0 60px rgba(0,255,65,0.2)',
                }}
              >
                <Plus className="w-6 h-6 text-black" strokeWidth={3} />
              </Link>
            );
          }

          return (
            <Link
              key={href}
              href={href}
              className="w-12 h-12 flex items-center justify-center rounded-full active:scale-90"
              style={{
                color: isActive ? '#ffffff' : 'rgba(255,255,255,0.28)',
                background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
              }}
            >
              <Icon className="w-[22px] h-[22px]" strokeWidth={isActive ? 2.5 : 1.8} />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
