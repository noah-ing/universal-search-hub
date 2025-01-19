'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navigation() {
  const pathname = usePathname();

  const isActive = (path: string) => {
    return pathname === path ? 'bg-blue-600' : 'hover:bg-[#252B38]';
  };

  return (
    <nav className="bg-[#1A1F2A] mb-8 rounded-lg">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link 
              href="/"
              className="text-white font-semibold text-lg"
            >
              Vector Search Hub
            </Link>
          </div>
          <div className="flex space-x-4">
            <Link
              href="/"
              className={`px-4 py-2 rounded-md text-sm text-white transition-colors ${isActive('/')}`}
            >
              Search
            </Link>
            <Link
              href="/benchmark"
              className={`px-4 py-2 rounded-md text-sm text-white transition-colors ${isActive('/benchmark')}`}
            >
              Benchmark
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
