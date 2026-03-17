import type { Metadata } from "next";
import { siteConfig } from "../layout";

export const metadata: Metadata = {
  title: "All Listings | Houston Home Spotlight",
  description: "Browse all available homes for sale in Houston. Filter by price, bedrooms, and more to find your perfect home.",
  keywords: [
    "Houston homes for sale",
    "Houston real estate listings",
    "buy home Houston",
    "Houston property search",
    "Houston houses for sale",
  ],
  alternates: {
    canonical: "/listings",
  },
  openGraph: {
    type: "website",
    url: `${siteConfig.url}/listings`,
    title: "All Listings | Houston Home Spotlight",
    description: "Browse all available homes for sale in Houston. Filter by price, bedrooms, and more.",
    images: [
      {
        url: siteConfig.ogImage,
        width: 1200,
        height: 630,
        alt: "Houston Home Spotlight - All Listings",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: siteConfig.twitterHandle,
    creator: siteConfig.twitterHandle,
    title: "All Listings | Houston Home Spotlight",
    description: "Browse all available homes for sale in Houston.",
    images: [siteConfig.ogImage],
  },
};

export default function ListingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
