"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { ExternalLink, RefreshCw, QrCode } from "lucide-react";
import { DotPattern } from "@/components/ui/dot-pattern";
import IPhoneMockup from "./iphone-mockup";
import BootingMachine from "./booting-machine";

interface MobilePreviewProps {
  url: string;
  isLoading?: boolean;
  loadingLabel?: string;
  showControls?: boolean;
}

export default function MobilePreview({
  url,
  isLoading = false,
  loadingLabel = "Loading...",
  showControls = true
}: MobilePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleRefresh = () => {
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
  };

  const handleOpenInNewTab = () => {
    if (url) {
      window.open(url, '_blank');
    }
  };

  const generateQRCode = (url: string) => {
    // Convert https:// to exp:// for deep linking
    const expUrl = url.replace(/^https:\/\//, 'exp://');
    // Generate QR code using a simple QR code service
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(expUrl)}`;
  };

  return (
    <div className="relative flex h-full bg-background overflow-hidden">
      {/* Dotted Background Pattern */}
      <DotPattern
        width={20}
        height={20}
        cx={1}
        cy={1}
        cr={1}
        className="opacity-30"
      />

      {/* Mobile Device Preview */}
      <div className="relative z-10 flex-1 flex items-center justify-center p-6 overflow-hidden">
        <div className="relative mt-8">
          {isLoading ? (
            <IPhoneMockup className="scale-95">
              <BootingMachine label={loadingLabel} size="lg" />
            </IPhoneMockup>
          ) : (
            <IPhoneMockup url={url} className="scale-95" ref={iframeRef} />
          )}
        </div>
      </div>

      {/* Control Panel */}
      {showControls && (
        <div className="relative z-10 w-72 p-6 flex flex-col justify-center gap-6">
          <div className="space-y-8">
            {/* Action Buttons */}
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-xl font-bold text-foreground mb-2">Preview Controls</h3>
                <p className="text-sm text-muted-foreground">Manage your mobile preview</p>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={handleRefresh}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start hover:bg-primary/10 hover:border-primary/20 transition-all duration-200 group"
                  disabled={isLoading || !url}
                >
                  <RefreshCw className="h-4 w-4 mr-3 group-hover:rotate-180 transition-transform duration-300" />
                  Refresh Preview
                </Button>

                <Button
                  onClick={handleOpenInNewTab}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start hover:bg-primary/10 hover:border-primary/20 transition-all duration-200 group"
                  disabled={isLoading || !url}
                >
                  <ExternalLink className="h-4 w-4 mr-3 group-hover:scale-110 transition-transform duration-200" />
                  Open in New Tab
                </Button>
              </div>
            </div>

            {/* QR Code Section */}
            {url && !isLoading && (
              <div className="space-y-6">
                <div className="text-center">
                  <h4 className="text-xl font-bold text-foreground mb-3">Mobile Preview</h4>
                  <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                    Scan QR code to preview on your mobile phone for the best result
                  </p>

                  <div className="flex justify-center">
                    <div className="p-4 bg-white dark:bg-gray-900 rounded-2xl shadow-lg border-2 border-gray-200 dark:border-gray-700">
                      <img
                        src={generateQRCode(url)}
                        alt="QR Code for mobile preview"
                        className="w-40 h-40 rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="text-center py-16">
                <div className="relative">
                  <div className="animate-spin w-10 h-10 border-3 border-primary/20 border-t-primary rounded-full mx-auto mb-4" />
                  <div className="absolute inset-0 animate-ping w-10 h-10 border border-primary/30 rounded-full mx-auto" />
                </div>
                <p className="text-sm text-muted-foreground font-medium">{loadingLabel}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
