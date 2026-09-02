import type { Metadata } from 'next';

import './globals.css';

const productionUrl = new URL(
  'https://unsaid-agreement.kbelcher.chatgpt.site',
);

export const metadata: Metadata = {
  metadataBase: productionUrl,
  title: 'UNSAID — Private Context, Shared Agreement',
  description:
    'A minimum-disclosure decision room where personal agents construct common ground and people ratify it.',
  alternates: { canonical: '/' },
  icons: { icon: '/favicon.svg' },
  openGraph: {
    url: '/',
    title: 'UNSAID — Private Context, Shared Agreement',
    description:
      'Tell your agent the whole truth. Tell the room only enough to agree.',
    images: [
      {
        url: '/og.jpg',
        width: 1280,
        height: 720,
        alt: 'UNSAID minimum-disclosure decision room',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'UNSAID — Private Context, Shared Agreement',
    description:
      'A minimum-disclosure decision room where personal agents construct common ground and people ratify it.',
    images: ['/og.jpg'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
