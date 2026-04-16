import './globals.css';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: '선호피엔에스 설비보전일지',
  manifest: '/manifest.json',
  icons: { icon: '/favicon.ico', apple: '/icon-192.png' },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: '선호피엔에스' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#2d6cdf',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
