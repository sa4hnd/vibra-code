"use client";

import { useRef } from "react";
import BootingMachine from "./booting-machine";

interface WebPreviewProps {
  url: string;
  isLoading?: boolean;
  loadingLabel?: string;
}

export default function WebPreview({
  url,
  isLoading = false,
  loadingLabel = "Loading..."
}: WebPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  return (
    <div className="flex flex-col h-full">
      {/* Web Preview */}
      <div className="flex-1 flex items-center justify-center bg-background overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-full w-full">
            <BootingMachine label={loadingLabel} size="lg" />
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            src={url}
            className="w-full h-full border-none bg-white"
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              borderRadius: '0'
            }}
            title="Web Preview"
            allow="clipboard-write"
          />
        )}
      </div>
    </div>
  );
}
