'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { LogoutButton } from '@/components/auth/LogoutButton';

/** Props for the site Header. */
interface HeaderProps {
  /** True when a valid agent session exists — toggles Agent Login ↔ Agent Logout. */
  isAuthenticated?: boolean;
}

export default function Header({ isAuthenticated = false }: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/listings', label: 'Listings' },
    { href: '/contact', label: 'Contact' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm">
      <div className="container-custom">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center"
            aria-label="Houston Home Spotlight — home"
          >
            <Image
              src="/logo.png"
              alt="Houston Home Spotlight"
              width={512}
              height={512}
              priority
              className="h-9 w-auto md:h-11"
            />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-gray-600 hover:text-primary-900 font-medium transition-colors duration-200 py-2"
              >
                {link.label}
              </Link>
            ))}
            {isAuthenticated ? (
              <>
                <LogoutButton
                  label="Logout"
                  className="text-gray-600 hover:text-primary-900 font-medium transition-colors duration-200 py-2 disabled:opacity-50"
                />
                <Link href="/dashboard" className="btn-primary">
                  Dashboard
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-gray-600 hover:text-primary-900 font-medium transition-colors duration-200 py-2"
                >
                  Agent Login
                </Link>
                <Link href="/register" className="btn-primary">
                  List Your Property
                </Link>
              </>
            )}
          </nav>

          {/* Mobile Menu Button */}
          <button
            type="button"
            className="md:hidden p-2.5 min-w-[44px] min-h-[44px] rounded-lg text-gray-600 hover:text-primary-900 hover:bg-gray-100 transition-colors flex items-center justify-center"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isMenuOpen}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              {isMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Navigation */}
        <div
          className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${
            isMenuOpen ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <nav className="py-4 border-t border-gray-100">
            <ul className="space-y-2">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="block px-4 py-3 min-h-[44px] flex items-center text-gray-600 hover:text-primary-900 hover:bg-gray-50 rounded-lg font-medium transition-colors duration-200"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              {isAuthenticated ? (
                <>
                  <li>
                    <Link
                      href="/dashboard"
                      className="block px-4 py-3 min-h-[44px] flex items-center text-gray-600 hover:text-primary-900 hover:bg-gray-50 rounded-lg font-medium transition-colors duration-200"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Dashboard
                    </Link>
                  </li>
                  <li>
                    <LogoutButton
                      label="Logout"
                      className="w-full text-left px-4 py-3 min-h-[44px] flex items-center text-gray-600 hover:text-primary-900 hover:bg-gray-50 rounded-lg font-medium transition-colors duration-200 disabled:opacity-50"
                    />
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <Link
                      href="/login"
                      className="block px-4 py-3 min-h-[44px] flex items-center text-gray-600 hover:text-primary-900 hover:bg-gray-50 rounded-lg font-medium transition-colors duration-200"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Agent Login
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/register"
                      className="block px-4 py-3 min-h-[44px] flex items-center text-primary-900 hover:bg-gray-50 rounded-lg font-semibold transition-colors duration-200"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      List Your Property
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </nav>
        </div>
      </div>
    </header>
  );
}
