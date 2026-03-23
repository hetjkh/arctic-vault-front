'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ArrowLeftRight,
  PlusCircle,
  FileText,
  Users2,
  ChevronLeft,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { getSession } from '@/lib/auth';

const navItems = [
  { href: '/dashboard',    label: 'Dashboard',       icon: LayoutDashboard },
  { href: '/transactions', label: 'Transactions',     icon: ArrowLeftRight },
  { href: '/add',          label: 'Add Transaction',  icon: PlusCircle },
  { href: '/invoices',     label: 'Invoices',         icon: FileText },
  { href: '/founders',     label: 'Founders',         icon: Users2 },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const session = getSession();
  const displayName = session?.name || session?.fullName || 'U';
  const initial = displayName[0]?.toUpperCase() || 'U';

  const sidebarWidth = collapsed ? 68 : 240;

  return (
    <>
      {/* ── Mobile top bar (hidden on desktop via CSS, no inline display override) */}
      <div
        className="md:hidden"
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
          alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 20px',
          background: 'rgba(0,0,0,0.9)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          /* NOTE: no display property here — Tailwind's md:hidden uses display:none at ≥768px  */
          /* At <768px, browser default for div is block; we use flexbox via CSS class below */
        }}
      >
        {/* Inner row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: '#00ff41',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Zap size={14} color="#000" strokeWidth={3} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase' }}>
              Arctic Vault
            </span>
          </div>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10, padding: '8px', cursor: 'pointer', color: 'rgba(255,255,255,0.7)',
            }}
          >
            <div style={{ width: 18, height: 14, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <span style={{ display: 'block', height: 1.5, background: 'currentColor', borderRadius: 2, transition: 'all 0.2s', transform: mobileOpen ? 'rotate(45deg) translateY(6px)' : '' }} />
              <span style={{ display: 'block', height: 1.5, background: 'currentColor', borderRadius: 2, transition: 'all 0.2s', opacity: mobileOpen ? 0 : 1 }} />
              <span style={{ display: 'block', height: 1.5, background: 'currentColor', borderRadius: 2, transition: 'all 0.2s', transform: mobileOpen ? 'rotate(-45deg) translateY(-6px)' : '' }} />
            </div>
          </button>
        </div>
      </div>

      {/* ── Mobile drawer overlay */}
      {mobileOpen && (
        <div
          className="md:hidden"
          style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => setMobileOpen(false)}
        >
          <nav
            style={{
              position: 'absolute', top: 53, left: 0, right: 0,
              background: 'rgba(8,8,10,0.99)',
              backdropFilter: 'blur(20px)',
              borderBottom: '1px solid rgba(255,255,255,0.07)',
              padding: '6px 12px 14px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {navItems.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '11px 14px', borderRadius: 12,
                    fontSize: 14, fontWeight: isActive ? 700 : 500,
                    textDecoration: 'none',
                    color: isActive ? '#000' : 'rgba(255,255,255,0.65)',
                    background: isActive ? '#00ff41' : 'transparent',
                    marginBottom: 2,
                    transition: 'all 0.15s',
                  }}
                >
                  <Icon size={17} strokeWidth={isActive ? 2.5 : 1.8} />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}

      {/* ── Desktop sidebar (hidden on mobile via Tailwind) */}
      <aside
        className="hidden md:flex"
        style={{
          position: 'fixed', top: 0, left: 0, bottom: 0,
          width: sidebarWidth,
          zIndex: 40,
          flexDirection: 'column',
          background: 'rgba(6,6,8,0.96)',
          backdropFilter: 'blur(32px) saturate(180%)',
          WebkitBackdropFilter: 'blur(32px) saturate(180%)',
          borderRight: '1px solid rgba(255,255,255,0.07)',
          transition: 'width 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          overflow: 'hidden',
        }}
      >
        {/* Logo */}
        <div style={{
          display: 'flex', alignItems: 'center',
          gap: collapsed ? 0 : 10,
          padding: collapsed ? '18px 0' : '18px 16px',
          justifyContent: collapsed ? 'center' : 'flex-start',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          minHeight: 60,
          flexShrink: 0,
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            background: '#00ff41',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Zap size={15} color="#000" strokeWidth={3} />
          </div>
          {!collapsed && (
            <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.8, textTransform: 'uppercase', lineHeight: 1.2 }}>Arctic Vault</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>Finance Tracker</div>
            </div>
          )}
        </div>

        {/* Nav links */}
        <nav style={{ flex: 1, padding: '10px 8px', overflowY: 'auto', overflowX: 'hidden' }}>
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                style={{
                  display: 'flex', alignItems: 'center',
                  gap: collapsed ? 0 : 10,
                  padding: collapsed ? '10px 0' : '10px 12px',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  borderRadius: 10,
                  fontSize: 13, fontWeight: isActive ? 700 : 500,
                  textDecoration: 'none', marginBottom: 2,
                  color: isActive ? '#000' : 'rgba(255,255,255,0.45)',
                  background: isActive ? '#00ff41' : 'transparent',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
                    (e.currentTarget as HTMLElement).style.color = '#fff';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                    (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)';
                  }
                }}
              >
                <Icon size={16} strokeWidth={isActive ? 2.5 : 1.8} style={{ flexShrink: 0 }} />
                {!collapsed && <span style={{ marginLeft: 2 }}>{label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User profile section */}
        {!collapsed && session && (
          <div style={{
            margin: '0 8px 8px',
            padding: '10px 12px',
            borderRadius: 12,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                background: session?.id === 1 ? '#00ff41' : '#ffffff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 800, color: '#000',
              }}>
                {initial}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#fff' }}>
                  {session?.fullName || displayName}
                </div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>Founder · 50%</div>
              </div>
            </div>
          </div>
        )}

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            margin: '0 8px 14px',
            padding: '8px',
            borderRadius: 10,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            cursor: 'pointer', color: 'rgba(255,255,255,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
            gap: 6, fontSize: 11, fontWeight: 500,
            flexShrink: 0,
            transition: 'all 0.2s',
          }}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed
            ? <ChevronRight size={14} />
            : <><ChevronLeft size={14} /><span>Collapse</span></>
          }
        </button>
      </aside>
    </>
  );
}
