/**
 * Contact Page
 * 
 * A dedicated contact page for general inquiries.
 * Displays contact information and a lead form that submits to Perfex CRM.
 * 
 * Features:
 * - Contact information section with phone and email
 * - General inquiry form using InquiryForm component
 * - Mobile-first responsive design
 * - Consistent styling with the rest of the site
 * 
 * @module app/contact/page
 */

import type { Metadata } from 'next';
import { InquiryForm } from '@/components/InquiryForm';
import { siteConfig } from '../layout';

export const metadata: Metadata = {
  title: 'Contact | Houston Home Spotlight',
  description: 'Get in touch with NB Elite Realty. Contact Bernard for all your Houston real estate needs.',
  keywords: [
    'contact Houston realtor',
    'Houston real estate agent',
    'NB Elite Realty contact',
    'buy home Houston contact',
    'sell home Houston',
  ],
  alternates: {
    canonical: '/contact',
  },
  openGraph: {
    type: 'website',
    url: `${siteConfig.url}/contact`,
    title: 'Contact | Houston Home Spotlight',
    description: 'Get in touch with NB Elite Realty. Contact Bernard for all your Houston real estate needs.',
    images: [
      {
        url: siteConfig.ogImage,
        width: 1200,
        height: 630,
        alt: 'Contact Houston Home Spotlight',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: siteConfig.twitterHandle,
    creator: siteConfig.twitterHandle,
    title: 'Contact | Houston Home Spotlight',
    description: 'Get in touch with NB Elite Realty.',
    images: [siteConfig.ogImage],
  },
};

/**
 * Contact page component
 * 
 * @returns {JSX.Element} The contact page
 */
export default function ContactPage(): JSX.Element {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="gradient-primary py-16 md:py-24">
        <div className="container-custom text-center">
          <h1 className="text-white font-serif font-bold mb-4">
            Get In Touch
          </h1>
          <p className="text-primary-100 text-lg md:text-xl max-w-2xl mx-auto">
            Ready to find your dream home? I&apos;m here to help you navigate 
            the Houston real estate market.
          </p>
        </div>
      </section>

      {/* Contact Content */}
      <section className="section-padding py-12 md:py-20">
        <div className="container-custom max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
            {/* Contact Information */}
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl md:text-3xl font-serif font-bold text-gray-900 mb-6">
                  Contact Information
                </h2>
                <p className="text-gray-600 mb-8">
                  Whether you&apos;re buying, selling, or just exploring the market, 
                  I&apos;m here to provide expert guidance every step of the way.
                </p>
              </div>

              {/* Phone */}
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                  <svg 
                    className="w-6 h-6 text-primary-600" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" 
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Phone</h3>
                  <a 
                    href="tel:+17135551234" 
                    className="text-primary-600 hover:text-primary-700 transition-colors"
                  >
                    (713) 555-1234
                  </a>
                  <p className="text-sm text-gray-500 mt-1">
                    Mon-Sat: 8am - 7pm
                  </p>
                </div>
              </div>

              {/* Email */}
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                  <svg 
                    className="w-6 h-6 text-primary-600" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" 
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Email</h3>
                  <a 
                    href="mailto:bernard@nbeliterealty.com" 
                    className="text-primary-600 hover:text-primary-700 transition-colors"
                  >
                    bernard@nbeliterealty.com
                  </a>
                  <p className="text-sm text-gray-500 mt-1">
                    Response within 24 hours
                  </p>
                </div>
              </div>

              {/* Office Address */}
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                  <svg 
                    className="w-6 h-6 text-primary-600" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" 
                    />
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" 
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Office</h3>
                  <p className="text-gray-600">
                    NB Elite Realty<br />
                    123 Main Street, Suite 200<br />
                    Houston, TX 77002
                  </p>
                </div>
              </div>

              {/* License Info */}
              <div className="pt-6 border-t border-gray-200">
                <p className="text-sm text-gray-500">
                  <span className="font-medium">License:</span> Texas Real Estate Commission<br />
                  <span className="font-medium">Service Areas:</span> Harris & Fort Bend Counties
                </p>
              </div>
            </div>

            {/* Contact Form */}
            <div className="card p-6 md:p-8">
              <h2 className="text-xl md:text-2xl font-serif font-bold text-gray-900 mb-2">
                Send a Message
              </h2>
              <p className="text-gray-600 mb-6">
                Fill out the form below and I&apos;ll get back to you as soon as possible.
              </p>
              <InquiryForm />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
