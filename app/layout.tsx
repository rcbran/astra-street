import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Astra Street — Canyon Racing',
  description:
    'Drive the Astra S9 through coastal canyons, mountain forests and city nights. Drift, build your score and hit the nitro.',
  icons: { icon: '/favicon.svg' },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
