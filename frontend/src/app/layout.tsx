'use client';

import './globals.css';
import { Analytics } from "@vercel/analytics/react";
import Navigation from '@/components/Navigation';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <title>Vector Similarity Search</title>
        <meta name="description" content="High-performance semantic search engine powered by HNSW algorithm" />
      </head>
      <body className="min-h-screen bg-[#0B0E14] text-white">
        <div className="container mx-auto px-4 py-8">
          <Navigation />
          <main>
            {children}
          </main>
        </div>
        <Analytics />
      </body>
    </html>
  );
}
