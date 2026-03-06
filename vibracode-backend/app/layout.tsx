import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { ThemeProvider } from "@/providers/theme-provider";

import { UserInitializer } from "@/components/user-initializer";
import { ConvexClientProvider } from "@/providers/convex-provider";
import { NextAuthProvider } from "@/providers/nextauth-provider";
import { DashboardProvider } from "@/components/dashboard-modal";
import Navbar from "@/components/navbar";
import FeaturebaseMessenger from "@/components/featurebase-messenger";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "VibraCode - AI Mobile App Builder | Create iOS & Android Apps Instantly",
    template: "%s | VibraCode - AI Mobile App Builder"
  },
  description: "Build stunning mobile apps with AI in minutes. Create iOS and Android apps instantly with our intelligent mobile development platform. No coding required - just describe your app idea and watch it come to life!",
  keywords: [
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
    "app development platform"
  ],
  authors: [{ name: "VibraCode Team" }],
  creator: "VibraCode",
  publisher: "VibraCode",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://vibracodeapp.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://vibracodeapp.com',
    siteName: 'VibraCode',
    title: 'VibraCode - AI Mobile App Builder | Create iOS & Android Apps Instantly',
    description: 'Build stunning mobile apps with AI in minutes. Create iOS and Android apps instantly with our intelligent mobile development platform. No coding required!',
    images: [
      {
        url: '/brand-assets/Screenshot 2025-10-13 at 3.23.59 AM.png',
        width: 1200,
        height: 630,
        alt: 'VibraCode - AI Mobile App Builder Homepage',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VibraCode - AI Mobile App Builder | Create iOS & Android Apps Instantly',
    description: 'Build stunning mobile apps with AI in minutes. Create iOS and Android apps instantly with our intelligent mobile development platform. No coding required!',
    images: ['/brand-assets/Screenshot 2025-10-13 at 3.23.59 AM.png'],
    creator: '@vibracodeapp',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'your-google-verification-code',
    yandex: 'your-yandex-verification-code',
    yahoo: 'your-yahoo-verification-code',
  },
  category: 'technology',
  classification: 'Mobile App Development Platform',
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" />
        <link rel="shortcut icon" href="/favicon.svg" />
        <link rel="apple-touch-icon" href="/favicon.svg" />
        <meta name="theme-color" content="#000000" />
        
        {/* Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "VibraCode",
              "description": "Build stunning mobile apps with AI in minutes. Create iOS and Android apps instantly with our intelligent mobile development platform.",
              "url": "https://vibracodeapp.com",
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
                "url": "https://vibracodeapp.com",
                "logo": {
                  "@type": "ImageObject",
                  "url": "https://vibracodeapp.com/brand-assets/Screenshot 2025-10-13 at 3.23.59 AM.png"
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
            })
          }}
        />
        
        {/* Additional SEO Meta Tags */}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#000000" />
        <meta name="msapplication-TileColor" content="#000000" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="VibraCode" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="VibraCode" />
        
        {/* Preconnect to external domains for performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://do.featurebase.app" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-background antialiased min-h-screen flex flex-col`}
      >
        <ClerkProvider
          appearance={{
            baseTheme: dark,
          }}
        >
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            forcedTheme="dark"
            enableSystem={false}
            disableTransitionOnChange
          >
            <ConvexClientProvider>
              <NextAuthProvider>
                <DashboardProvider>
                  <UserInitializer />
                  <Navbar />
                  <FeaturebaseMessenger />
                  {children}
                </DashboardProvider>
              </NextAuthProvider>
            </ConvexClientProvider>
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
