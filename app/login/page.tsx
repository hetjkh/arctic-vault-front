'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { setSession } from '@/lib/auth';
import { TrendingUp } from 'lucide-react';

type LoginUser = {
  id: string;
  username: string;
  fullName: string;
  name: string;
  initial: string;
  color: string;
  shadow: string;
};

const NUMPAD = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['', '0', '⌫'],
];

export default function LoginPage() {
  const router = useRouter();
  const [users, setUsers] = useState<LoginUser[]>([]);
  const [selected, setSelected] = useState<LoginUser | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadUsers = async () => {
      try {
        const res = await fetch('http://localhost:4000/api/users');
        if (!res.ok) throw new Error('Failed to load users');
        const list = (await res.json()) as Array<{ id: string; username: string; fullName: string }>;

        if (!mounted) return;

        const mapped = list.map((u, idx) => {
          const displayName = u.fullName?.trim() || u.username.trim();
          const firstName = displayName.split(' ')[0] || displayName;
          const neon = idx % 2 === 0;
          return {
            id: u.id,
            username: u.username,
            fullName: displayName,
            name: firstName,
            initial: (displayName[0] || 'U').toUpperCase(),
            color: neon ? '#00ff41' : '#ffffff',
            shadow: neon ? 'rgba(0,255,65,0.4)' : 'rgba(255,255,255,0.25)',
          };
        });

        setUsers(mapped);
      } catch {
        setError('Could not load users from backend.');
      } finally {
        if (mounted) setUsersLoading(false);
      }
    };

    loadUsers();
    return () => {
      mounted = false;
    };
  }, []);

  const handleSelectUser = (u: LoginUser) => {
    setSelected(u);
    setPin('');
    setError('');
  };

  const handleKey = (key: string) => {
    if (key === '⌫') {
      setPin((p) => p.slice(0, -1));
      setError('');
      return;
    }
    if (key === '') return;
    if (pin.length >= 4) return;

    const next = pin + key;
    setPin(next);

    if (next.length === 4) {
      submitPin(next);
    }
  };

  const submitPin = async (enteredPin: string) => {
    if (!selected) return;
    setLoading(true);
    try {
      const res = await fetch('http://localhost:4000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: selected.username, pin: enteredPin }),
      });

      if (!res.ok) {
        setShake(true);
        setError('Wrong PIN. Try again.');
        setPin('');
        setLoading(false);
        setTimeout(() => setShake(false), 600);
        return;
      }

      const user = await res.json();
      const normalizedSession = {
        id: 1,
        name: selected.name,
        fullName: user.fullName || selected.fullName,
        username: selected.username,
        backendUserId: user.id,
      };
      setSession(normalizedSession);
      router.replace('/dashboard');
    } catch {
      setError('Connection error. Try again.');
      setPin('');
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: '#000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '0 24px',
      }}
    >
      {/* Logo */}
      <div style={{ textAlign: 'center', paddingTop: 72, marginBottom: 48 }}>
        <div
          style={{
            width: 60, height: 60, borderRadius: 18,
            background: '#111', border: '1px solid rgba(255,255,255,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 0 30px rgba(0,255,65,0.15)',
          }}
        >
          <TrendingUp size={28} color="#00ff41" />
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 6px', letterSpacing: -0.5 }}>
          Arctic Vault
        </h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)', margin: 0 }}>
          Finance made simple.
        </p>
      </div>

      {/* User selection */}
      {!selected && (
        <div style={{ width: '100%', maxWidth: 360 }}>
          <p
            style={{
              fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.3)',
              textAlign: 'center', letterSpacing: '0.08em', textTransform: 'uppercase',
              marginBottom: 20,
            }}
          >
            Who are you?
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {users.map((u) => (
              <button
                key={u.username}
                onClick={() => handleSelectUser(u)}
                style={{
                  background: '#111', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 24, padding: '28px 16px',
                  cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = `${u.color}50`;
                  (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.02)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.08)';
                  (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
                }}
              >
                <div
                  style={{
                    width: 64, height: 64, borderRadius: '50%',
                    background: u.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 24, fontWeight: 800,
                    color: '#000',
                    boxShadow: `0 0 24px ${u.shadow}`,
                  }}
                >
                  {u.initial}
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 16, fontWeight: 700, margin: '0 0 2px', color: '#fff' }}>{u.name}</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', margin: 0 }}>{u.fullName}</p>
                </div>
                <div
                  style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                    color: u.color, padding: '4px 12px',
                    background: `${u.color}15`, borderRadius: 100,
                    border: `1px solid ${u.color}30`,
                  }}
                >
                  SIGN IN →
                </div>
              </button>
            ))}
          </div>
          {usersLoading && (
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 14 }}>
              Loading users...
            </p>
          )}
          {!usersLoading && users.length === 0 && (
            <p style={{ fontSize: 12, color: '#ff0033', textAlign: 'center', marginTop: 14 }}>
              No users found. Create one from backend API/CLI.
            </p>
          )}
        </div>
      )}

      {/* PIN entry */}
      {selected && (
        <div
          style={{
            width: '100%', maxWidth: 340,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            animation: shake ? 'shake 0.5s ease' : 'none',
          }}
        >
          <style>{`
            @keyframes shake {
              0%,100%{transform:translateX(0)}
              15%{transform:translateX(-8px)}
              30%{transform:translateX(8px)}
              45%{transform:translateX(-6px)}
              60%{transform:translateX(6px)}
              75%{transform:translateX(-3px)}
              90%{transform:translateX(3px)}
            }
            @keyframes popIn {
              0%{transform:scale(0.5);opacity:0}
              80%{transform:scale(1.1)}
              100%{transform:scale(1);opacity:1}
            }
          `}</style>

          {/* Back + user badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32, width: '100%' }}>
            <button
              onClick={() => { setSelected(null); setPin(''); setError(''); }}
              style={{
                background: '#111', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '50%', width: 36, height: 36,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: 'rgba(255,255,255,0.6)', fontSize: 18,
              }}
            >
              ←
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 36, height: 36, borderRadius: '50%', background: selected.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 800, color: '#000',
                  boxShadow: `0 0 14px ${selected.shadow}`,
                }}
              >
                {selected.initial}
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{selected.fullName}</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', margin: 0 }}>Enter your 4-digit PIN</p>
              </div>
            </div>
          </div>

          {/* PIN dots */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  width: 14, height: 14, borderRadius: '50%',
                  background: pin.length > i ? selected.color : 'rgba(255,255,255,0.15)',
                  boxShadow: pin.length > i ? `0 0 10px ${selected.shadow}` : 'none',
                  transition: 'all 0.15s',
                  animation: pin.length === i + 1 ? 'popIn 0.2s ease' : 'none',
                }}
              />
            ))}
          </div>

          {/* Error message */}
          <p
            style={{
              fontSize: 12, color: '#ff0033', height: 20,
              marginBottom: 20, textAlign: 'center',
              opacity: error ? 1 : 0, transition: 'opacity 0.2s',
            }}
          >
            {error}
          </p>

          {/* Numpad */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, width: '100%' }}>
            {NUMPAD.flat().map((key, i) => {
              const isEmpty = key === '';
              const isBack = key === '⌫';
              return (
                <button
                  key={i}
                  onClick={() => !loading && !isEmpty && handleKey(key)}
                  disabled={loading || isEmpty}
                  style={{
                    height: 70, borderRadius: 20,
                    background: isEmpty ? 'transparent' : isBack ? 'rgba(255,0,51,0.1)' : '#111',
                    border: isEmpty
                      ? 'none'
                      : isBack
                      ? '1px solid rgba(255,0,51,0.2)'
                      : '1px solid rgba(255,255,255,0.07)',
                    color: isBack ? '#ff0033' : '#ffffff',
                    fontSize: key.length > 1 ? 18 : 22,
                    fontWeight: 600,
                    cursor: isEmpty ? 'default' : 'pointer',
                    transition: 'all 0.1s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                  onMouseDown={(e) => {
                    if (!isEmpty && !loading) {
                      (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.92)';
                      (e.currentTarget as HTMLButtonElement).style.background = isBack
                        ? 'rgba(255,0,51,0.2)'
                        : 'rgba(255,255,255,0.08)';
                    }
                  }}
                  onMouseUp={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
                    (e.currentTarget as HTMLButtonElement).style.background = isEmpty
                      ? 'transparent'
                      : isBack ? 'rgba(255,0,51,0.1)' : '#111';
                  }}
                >
                  {loading && key === '0' ? (
                    <div style={{ width: 16, height: 16, border: '2px solid #00ff41', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  ) : key}
                </button>
              );
            })}
          </div>

          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {/* Footer hint */}
      <p style={{ marginTop: 'auto', paddingBottom: 32, fontSize: 11, color: 'rgba(255,255,255,0.15)', textAlign: 'center' }}>
        Users load dynamically from backend API
      </p>
    </div>
  );
}
