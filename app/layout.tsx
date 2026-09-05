import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Astra Formula — Browser Racing',
  description:
    'An original open-wheel browser racer. Three circuits, changing conditions, and your next apex.',
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
