import type { Metadata } from 'next';
import { Fredoka } from 'next/font/google';
import localFont from 'next/font/local';
import './globals.css';
import { Providers } from './providers';

const fredoka = Fredoka({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-fredoka',
  display: 'swap',
});

const geistSans = localFont({
  src: '../src/fonts/Geist.woff2',
  variable: '--font-geist-sans',
  weight: '100 900',
  display: 'swap',
});

const geistMono = localFont({
  src: '../src/fonts/GeistMono.woff2',
  variable: '--font-geist-mono',
  weight: '100 900',
  display: 'swap',
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://127.0.0.1:3000';
const description = 'Structured yield products, built on DeepBook Predict.';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Anker Protocol',
    template: '%s · Anker Protocol',
  },
  description,
  applicationName: 'Anker Protocol',
  icons: {
    icon: '/icon.png',
    apple: '/icon.png',
  },
  openGraph: {
    type: 'website',
    siteName: 'Anker Protocol',
    title: 'Anker Protocol',
    description,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Anker Protocol',
    description,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${fredoka.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
