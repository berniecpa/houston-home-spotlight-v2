import type { Metadata, Viewport } from "next";
import { Inter, Merriweather } from "next/font/google";
import { cookies } from "next/headers";
import { getTokens } from "next-firebase-auth-edge";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { authEdgeConfig } from "@/lib/auth-edge";
import { siteConfig } from "@/lib/site-config";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const merriweather = Merriweather({
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-merriweather",
});

/**
 * Viewport configuration for mobile-first design
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#1e3a8a",
};

/**
 * Root metadata configuration
 * Includes OpenGraph and Twitter card metadata for social sharing
 */
export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: siteConfig.keywords,
  authors: [{ name: siteConfig.author }],
  creator: siteConfig.author,
  publisher: siteConfig.author,
  metadataBase: new URL(siteConfig.url),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: siteConfig.name,
    description: siteConfig.description,
    images: [
      {
        url: siteConfig.ogImage,
        width: 1200,
        height: 630,
        alt: `${siteConfig.name} - Houston Real Estate Listings`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: siteConfig.twitterHandle,
    creator: siteConfig.twitterHandle,
    title: siteConfig.name,
    description: siteConfig.description,
    images: [siteConfig.ogImage],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
  verification: {
    google: undefined, // Add Google Search Console verification code when available
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Determine auth state server-side so the header can show Agent Login vs
  // Agent Logout. getTokens returns null (and never throws) for no/invalid
  // session; guard defensively so a header read can never break the page.
  let isAuthenticated = false;
  try {
    const tokens = await getTokens(await cookies(), authEdgeConfig);
    isAuthenticated = tokens != null;
  } catch {
    isAuthenticated = false;
  }

  return (
    <html lang="en">
      <head>
        <script defer src="https://siteanalytics.b3rni3vault.com/script.js" data-website-id="dcbb81c7-861c-425a-bce2-8dd14ea5453b"></script>
      </head>
      <body
        className={`${inter.variable} ${merriweather.variable} font-sans antialiased min-h-screen flex flex-col`}
      >
        <Header isAuthenticated={isAuthenticated} />
        <main className="flex-grow">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
