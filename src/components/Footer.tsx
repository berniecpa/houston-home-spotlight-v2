import Link from 'next/link';
import Image from 'next/image';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    navigation: [
      { href: '/', label: 'Home' },
      { href: '/listings', label: 'Listings' },
      { href: '/contact', label: 'Contact' },
    ],
    legal: [
      { href: '/privacy', label: 'Privacy Policy' },
      { href: '/terms', label: 'Terms of Service' },
    ],
  };

  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="container-custom py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8">
          {/* Brand Column */}
          <div className="space-y-4">
            <Link
              href="/"
              className="inline-flex items-center"
              aria-label="Houston Home Spotlight — home"
            >
              <Image
                src="/logo.png"
                alt="Houston Home Spotlight"
                width={512}
                height={512}
                className="h-20 w-auto rounded-lg bg-white p-2"
              />
            </Link>
            <p className="text-gray-400 leading-relaxed max-w-sm">
              Discover beautiful homes for sale in Houston. Your trusted partner in finding the perfect property.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white font-semibold text-lg mb-4">Quick Links</h3>
            <ul className="space-y-1">
              {footerLinks.navigation.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="inline-flex items-center min-h-[44px] px-2 -ml-2 text-gray-400 hover:text-white transition-colors duration-200 rounded"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-white font-semibold text-lg mb-4">Contact</h3>
            <ul className="space-y-3 text-gray-400">
              <li className="flex items-start space-x-3">
                <svg className="w-5 h-5 mt-0.5 text-primary-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Houston, TX</span>
              </li>
              <li className="flex items-start space-x-3">
                <svg className="w-5 h-5 mt-0.5 text-primary-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <a href="mailto:bernard@nbeliterealty.com" className="hover:text-white transition-colors">
                  bernard@nbeliterealty.com
                </a>
              </li>
              <li className="flex items-start space-x-3">
                <svg className="w-5 h-5 mt-0.5 text-primary-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <a href="tel:+17135551234" className="hover:text-white transition-colors">
                  (713) 555-1234
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-gray-800">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <p className="text-sm text-gray-500 text-center md:text-left">
              {currentYear} NB Elite Realty. All rights reserved.
            </p>
            <div className="flex flex-wrap items-center gap-2 sm:gap-6">
              {footerLinks.legal.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="inline-flex items-center min-h-[44px] px-2 text-sm text-gray-500 hover:text-gray-300 transition-colors rounded"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <p className="text-xs text-gray-600 text-center mt-4">
            Licensed Realtor in Harris and Fort Bend counties
          </p>
        </div>
      </div>
    </footer>
  );
}
