import { useEffect, useState, useRef } from "react";

interface UseUrlAvailabilityOptions {
  url?: string;
  enabled?: boolean;
  retryInterval?: number;
  timeout?: number;
}

export function useUrlAvailability({
  url,
  enabled = true,
  retryInterval = 2000,
  timeout = 5000,
}: UseUrlAvailabilityOptions) {
  const [isUrlReady, setIsUrlReady] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const checkUrlWithIframe = (urlToCheck: string) => {
    if (!urlToCheck) return;

    setIsChecking(true);
    setIsUrlReady(false);

    // Create a hidden iframe to test the URL
    const testIframe = document.createElement("iframe");
    testIframe.style.display = "none";
    testIframe.style.width = "1px";
    testIframe.style.height = "1px";

    let hasLoaded = false;
    let hasError = false;

    const cleanup = () => {
      if (document.body.contains(testIframe)) {
        document.body.removeChild(testIframe);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const onLoad = () => {
      if (!hasLoaded && !hasError) {
        hasLoaded = true;
        setIsUrlReady(true);
        setIsChecking(false);
        cleanup();
      }
    };

    const onError = () => {
      if (!hasLoaded && !hasError) {
        hasError = true;
        // If error, try again after retry interval
        timeoutRef.current = setTimeout(() => {
          if (!isUrlReady) {
            checkUrlWithIframe(urlToCheck);
          }
        }, retryInterval);
        cleanup();
      }
    };

    // Set timeout to prevent infinite waiting
    timeoutRef.current = setTimeout(() => {
      if (!hasLoaded && !hasError) {
        hasError = true;
        // If timeout, try again after retry interval
        timeoutRef.current = setTimeout(() => {
          if (!isUrlReady) {
            checkUrlWithIframe(urlToCheck);
          }
        }, retryInterval);
        cleanup();
      }
    }, timeout);

    testIframe.onload = onLoad;
    testIframe.onerror = onError;
    testIframe.src = urlToCheck;

    document.body.appendChild(testIframe);
  };

  useEffect(() => {
    if (url && enabled) {
      checkUrlWithIframe(url);
    } else {
      setIsUrlReady(false);
      setIsChecking(false);
    }

    // Cleanup on unmount or when dependencies change
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [url, enabled, retryInterval, timeout]);

  return {
    isUrlReady,
    isChecking,
    checkUrl: () => url && checkUrlWithIframe(url),
  };
}
