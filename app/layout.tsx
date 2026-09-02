import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'UNSAID — Private Context, Shared Agreement',
  description:
    'A minimum-disclosure decision room where personal agents construct common ground and people ratify it.',
  icons: { icon: '/favicon.svg' },
  openGraph: {
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
