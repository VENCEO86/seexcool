"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Header() {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-gray-900/98 backdrop-blur-md border-b border-gray-800/50 shadow-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-18">
          <Link href="/" className="flex items-center group">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent group-hover:from-blue-300 group-hover:via-purple-400 group-hover:to-pink-400 transition-all duration-300 drop-shadow-lg">
              See X Cool
            </h1>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/"
              className={`text-sm font-medium transition-all duration-200 px-3 py-2 rounded-lg ${
                !isAdmin
                  ? "text-white bg-blue-500/20 border border-blue-500/30"
                  : "text-gray-300 hover:text-white hover:bg-gray-800/50"
              }`}
            >
              홈
            </Link>
            <Link
              href="/admin"
              className={`text-sm font-medium transition-all duration-200 px-3 py-2 rounded-lg ${
                isAdmin
                  ? "text-white bg-blue-500/20 border border-blue-500/30"
                  : "text-gray-300 hover:text-white hover:bg-gray-800/50"
              }`}
            >
              관리자
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}

