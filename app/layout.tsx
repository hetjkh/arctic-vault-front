import type { Metadata } from 'next';
import './globals.css';
import ClientLayout from '@/components/ClientLayout';

export const metadata: Metadata = {
  title: 'Arctic Vault — Finance Tracker',
  description: 'Shared finance tracker for Ronit & Het',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ background: '#000', color: '#fff', margin: 0, overflowX: 'hidden' }}>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
