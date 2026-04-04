import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';
import ClientLayout from '@/components/ClientLayout';

const GTM_ID = 'GTM-MCQBJDF7';

export const metadata: Metadata = {
  title: 'Arctic Vault — Finance Tracker',
  description: 'Shared finance tracker for Ronit & Het',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ background: '#000', color: '#fff', margin: 0, overflowX: 'hidden' }}>
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
            height={0}
            width={0}
            style={{ display: 'none', visibility: 'hidden' }}
            title="Google Tag Manager"
          />
        </noscript>
        <Script id="google-tag-manager" strategy="beforeInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`}
        </Script>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
