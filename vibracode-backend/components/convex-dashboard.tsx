'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';

interface ConvexDashboardProps {
  deploymentName?: string;
  deploymentUrl?: string;
  adminKey?: string;
  onClose?: () => void;
}

export function ConvexDashboard({ 
  deploymentName, 
  deploymentUrl, 
  adminKey, 
  onClose 
}: ConvexDashboardProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // We first wait for the iframe to send a dashboard-credentials-request message.
      // This makes sure that we don't send the credentials until the iframe is ready.
      if (event.data?.type !== 'dashboard-credentials-request') {
        return;
      }
      
      iframeRef.current?.contentWindow?.postMessage(
        {
          type: 'dashboard-credentials',
          adminKey,
          deploymentUrl,
          deploymentName,
        },
        '*',
      );
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [deploymentUrl, adminKey, deploymentName]);

  if (!deploymentName || !deploymentUrl || !adminKey) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">No Convex project connected</p>
          <p className="text-sm text-muted-foreground mt-2">
            Click the Database button to connect to Convex
          </p>
        </div>
      </div>
    );
  }

  const actualUrl = `https://dashboard-embedded.convex.dev/data`;
  const shownUrl = `https://dashboard.convex.dev/d/${deploymentName}/data`;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center gap-1.5 bg-muted p-2 flex-shrink-0">
        <div className="flex grow items-center gap-1 rounded-full border bg-background px-3 py-1 text-sm">
          <input 
            className="w-full bg-transparent outline-none" 
            type="text" 
            value={shownUrl} 
            disabled 
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            window.open(shownUrl, '_blank');
          }}
          aria-label="Open dashboard in new tab"
        >
          <ExternalLink className="h-4 w-4" />
        </Button>
        {onClose && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
          >
            Close
          </Button>
        )}
      </div>
      <div className="flex-1 border-t relative overflow-hidden">
        <iframe
          ref={iframeRef}
          className="absolute inset-0 w-full h-full border-none bg-white"
          src={actualUrl}
          allow="clipboard-write"
          onLoad={() => setIsLoaded(true)}
        />
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-background">
            <div className="text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Loading Convex Dashboard...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
