"use client";

import Head from "next/head";

interface SEOOptimizationProps {
  title?: string;
  description?: string;
  keywords?: string[];
  canonicalUrl?: string;
  ogImage?: string;
  structuredData?: any;
}

export function SEOOptimization({
  title = "VibraCode - AI Mobile App Builder | Create iOS & Android Apps Instantly",
  description = "Build stunning mobile apps with AI in minutes. Create iOS and Android apps instantly with our intelligent mobile development platform. No coding required!",
  keywords = [
    "mobile app builder",
    "AI app builder",
    "iOS app builder", 
    "Android app builder",
    "create mobile app",
    "build app with AI",
    "no code app builder",
    "mobile app development",
    "app maker",
    "instant app creation",
    "mobile app generator",
    "AI mobile development",
    "cross platform app builder",
    "mobile app creator",
    "app development platform",
    "VibraCode",
    "vibracodeapp.com"
  ],
  canonicalUrl = "https://vibracodeapp.com",
  ogImage = "/brand-assets/vibra-logo.png",
  structuredData
}: SEOOptimizationProps) {
  const defaultStructuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "VibraCode",
    "description": description,
    "url": canonicalUrl,
    "applicationCategory": "DeveloperApplication",
    "operatingSystem": ["iOS", "Android"],
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD",
      "availability": "https://schema.org/InStock"
    },
    "author": {
      "@type": "Organization",
      "name": "VibraCode Team"
    },
    "publisher": {
      "@type": "Organization",
      "name": "VibraCode",
      "url": canonicalUrl,
      "logo": {
        "@type": "ImageObject",
        "url": `${canonicalUrl}${ogImage}`
      }
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "ratingCount": "150"
    },
    "featureList": [
      "AI-powered mobile app creation",
      "iOS and Android app generation", 
      "No coding required",
      "Instant app deployment",
      "Cross-platform compatibility"
    ]
  };

  return (
    <Head>
      {/* Primary Meta Tags */}
      <title>{title}</title>
      <meta name="title" content={title} />
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords.join(", ")} />
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={`${canonicalUrl}${ogImage}`} />
      <meta property="og:site_name" content="VibraCode" />
      <meta property="og:locale" content="en_US" />

      {/* Twitter */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:url" content={canonicalUrl} />
      <meta property="twitter:title" content={title} />
      <meta property="twitter:description" content={description} />
      <meta property="twitter:image" content={`${canonicalUrl}${ogImage}`} />
      <meta property="twitter:creator" content="@vibracodeapp" />

      {/* Additional SEO Meta Tags */}
      <meta name="robots" content="index, follow" />
      <meta name="googlebot" content="index, follow" />
      <meta name="bingbot" content="index, follow" />
      <meta name="language" content="English" />
      <meta name="revisit-after" content="1 days" />
      <meta name="distribution" content="global" />
      <meta name="rating" content="general" />
      <meta name="geo.region" content="US" />
      <meta name="geo.placename" content="United States" />

      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData || defaultStructuredData)
        }}
      />

      {/* Additional Performance Optimizations */}
      <link rel="preload" href="/brand-assets/vibra-logo.png" as="image" />
      <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
      <link rel="dns-prefetch" href="https://fonts.gstatic.com" />
    </Head>
  );
}
