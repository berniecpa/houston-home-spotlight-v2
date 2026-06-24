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
import { siteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Contact | Houston Home Spotlight',
  description: 'Have a question about a listing? Interested in featuring a property? Get in touch with Houston Home Spotlight.',
  keywords: [
    'contact Houston Home Spotlight',
    'Houston real estate inquiry',
    'feature a Houston listing',
    'Houston property question',
    'submit a listing Houston',
  ],
  alternates: {
    canonical: '/contact',
  },
  openGraph: {
    type: 'website',
    url: `${siteConfig.url}/contact`,
    title: 'Contact | Houston Home Spotlight',
    description: 'Have a question about a listing? Interested in featuring a property? Get in touch with Houston Home Spotlight.',
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
    description: 'Questions about a featured property or interested in having a listing showcased? Get in touch.',
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
            Questions about a featured property or interested in having a listing
            showcased? Reach out below.
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
                  Houston Home Spotlight features curated residential listings across
                  Harris and Fort Bend counties. For property inquiries or listing
                  submissions, use the form below or reach out directly.
                </p>
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
                    href="mailto:info@houstonhomespotlight.com" 
                    className="text-primary-600 hover:text-primary-700 transition-colors"
                  >
                    info@houstonhomespotlight.com
                  </a>
                  <p className="text-sm text-gray-500 mt-1">
                    Response within 24 hours
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
                Send us a message and we&apos;ll respond within one business day.
              </p>
              <InquiryForm
                requireMessage
                showInquiryType
                messagePlaceholder="Tell us about your inquiry — property question, listing submission, or general feedback."
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
