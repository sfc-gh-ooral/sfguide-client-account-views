import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import './globals.css';
import Shell from '@/components/Shell';

// next/font downloads these at build time and serves them from the app: no CDN at runtime.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const grotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-grotesk', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains', display: 'swap' });

export const metadata: Metadata = {
  title: 'Quillstone Advisor Desk · Client Account Views at App Speed',
  description: 'Advisor account pages served straight from Snowflake interactive tables, with a reconciliation compare, a load lab and a cost model. Synthetic data.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${grotesk.variable} ${mono.variable}`}>
      <body><Shell>{children}</Shell></body>
    </html>
  );
}
