"use client";

import { useRef, useEffect, forwardRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface IPhoneMockupProps {
  url?: string;
  children?: React.ReactNode;
  className?: string;
}

const IPhoneMockup = forwardRef<HTMLIFrameElement, IPhoneMockupProps>(({ url, children, className = "" }, ref) => {
  const internalRef = useRef<HTMLIFrameElement>(null);
  const iframeRef = ref || internalRef;
  const [loadError, setLoadError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Reset states when URL changes
  useEffect(() => {
    if (url) {
      setLoadError(false);
      setIsLoading(true);

      // Set a timeout - if iframe doesn't load in 15s, it's likely blocked
      const timeout = setTimeout(() => {
        if (isLoading) {
          console.log('⚠️ Preview timeout - may be blocked by X-Frame-Options');
          // Don't set error, just let it keep trying
        }
      }, 15000);

      return () => clearTimeout(timeout);
    }
  }, [url]);

  // Inject mobile viewport CSS into iframe
  useEffect(() => {
    if (iframeRef.current && url) {
      const iframe = iframeRef.current;
      
      const handleLoad = () => {
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
          if (iframeDoc) {
            // Add mobile viewport meta tag
            let viewportMeta = iframeDoc.querySelector('meta[name="viewport"]');
            if (!viewportMeta) {
              viewportMeta = iframeDoc.createElement('meta');
              viewportMeta.setAttribute('name', 'viewport');
              iframeDoc.head.appendChild(viewportMeta);
            }
            viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
            
            // Add mobile-responsive CSS
            const style = iframeDoc.createElement('style');
            style.textContent = `
              * {
                box-sizing: border-box;
              }
              html, body {
                margin: 0;
                padding: 0;
                width: 100%;
                height: 100%;
                overflow-x: hidden;
              }
              body {
                font-size: 14px;
                line-height: 1.4;
              }
              img, video, iframe {
                max-width: 100%;
                height: auto;
              }
              .container, .wrapper, main, section {
                max-width: 100%;
                overflow-x: hidden;
              }
            `;
            iframeDoc.head.appendChild(style);
          }
        } catch (error) {
          // Cross-origin restrictions might prevent this
          console.log('Cannot access iframe content due to CORS restrictions');
        }
      };

      iframe.addEventListener('load', handleLoad);
      return () => iframe.removeEventListener('load', handleLoad);
    }
  }, [url]);

  return (
    <div className={`flex items-center justify-center ${className}`}>
      {/* iPhone 15 Container */}
      <div className="relative w-64 h-[540px] rounded-[40px] shadow-[0_0_2px_2px_rgba(255,255,255,0.1)] border-6 border-zinc-900 mobile-mockup">
        {/* Dynamic Island */}
        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 w-[90px] h-[22px] bg-zinc-900 rounded-full z-20"></div>


        {/* Screen Content */}
        <div className="relative w-full h-full rounded-[32px] overflow-hidden bg-background">
          {url ? (
            loadError ? (
              // Show fallback when iframe can't load (X-Frame-Options issue)
              <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-zinc-950">
                <div className="text-sm text-muted-foreground mb-3">
                  Preview blocked by security headers
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(url, '_blank')}
                  className="gap-2"
                >
                  <ExternalLink className="h-3 w-3" />
                  Open in Browser
                </Button>
              </div>
            ) : (
              <div className="w-full h-full relative overflow-hidden">
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-zinc-950 z-10">
                    <div className="animate-spin w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full" />
                  </div>
                )}
                <iframe
                  ref={iframeRef as React.RefObject<HTMLIFrameElement>}
                  src={url}
                  className="absolute top-0 left-0 border-none rounded-none"
                  style={{
                    // Make iframe larger than container, then scale down
                    width: '200%',
                    height: '200%',
                    border: 'none',
                    borderRadius: '0',
                    // Scale down by 50% to fit the phone screen
                    transform: 'scale(0.5)',
                    transformOrigin: '0 0',
                    // Ensure proper mobile scaling
                    zoom: '1'
                  }}
                  // Add mobile viewport meta tag simulation
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
                  loading="lazy"
                  // Force mobile viewport
                  title="Mobile Preview"
                  onLoad={() => setIsLoading(false)}
                  onError={() => {
                    setLoadError(true);
                    setIsLoading(false);
                  }}
                />
              </div>
            )
          ) : children ? (
            <div className="w-full h-full flex items-center justify-center">
              {children}
            </div>
          ) : (
            // Default Apple logo when no content
            <>
              <svg className="text-zinc-700 h-20" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path fill="currentColor" d="M17.05 20.28c-.98.95-2.05.8-3.08.35c-1.09-.46-2.09-.48-3.24 0c-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8c1.18-.24 2.31-.93 3.57-.84c1.51.12 2.65.72 3.4 1.8c-3.12 1.87-2.38 5.98.48 7.13c-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25c.29 2.58-2.34 4.5-3.74 4.25" />
              </svg>
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-24 w-12 bg-zinc-600 blur-[80px]"></div>
            </>
          )}
        </div>

        {/* Left Side Buttons */}
        {/* Silent Switch */}
        <div className="absolute left-[-12px] top-20 w-[6px] h-8 bg-zinc-900 rounded-l-md shadow-md"></div>

        {/* Volume Up */}
        <div className="absolute left-[-12px] top-36 w-[6px] h-12 bg-zinc-900 rounded-l-md shadow-md"></div>

        {/* Volume Down */}
        <div className="absolute left-[-12px] top-52 w-[6px] h-12 bg-zinc-900 rounded-l-md shadow-md"></div>

        {/* Right Side Button (Power) */}
        <div className="absolute right-[-12px] top-36 w-[6px] h-16 bg-zinc-900 rounded-r-md shadow-md"></div>
      </div>
    </div>
  );
});

IPhoneMockup.displayName = "IPhoneMockup";

export default IPhoneMockup;
