"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { useUser } from "@clerk/nextjs";

declare global {
  interface Window {
    Featurebase: any;
  }
}

const FeaturebaseMessenger = () => {
  const { user } = useUser();
  const [userHash, setUserHash] = useState<string | null>(null);

  useEffect(() => {
    const generateHash = async () => {
      if (user) {
        try {
          const { generateFeaturebaseUserHash } = await import("@/app/actions/featurebase/generate-user-hash");
          const hash = await generateFeaturebaseUserHash(user.id);
          setUserHash(hash);
        } catch (error) {
          console.error("Failed to generate Featurebase user hash:", error);
        }
      }
    };

    generateHash();
  }, [user]);

  useEffect(() => {
    const initializeFeaturebase = () => {
      const win = window;
      
      // Initialize Featurebase if it doesn't exist
      if (typeof win.Featurebase !== "function") {
        win.Featurebase = function () {
          (win.Featurebase.q = win.Featurebase.q || []).push(arguments);
        };
      }
      
      // Start with minimal configuration to avoid 400 errors
      win.Featurebase("boot", {
        appId: "68ec382cb73797e68c8d10dd",
        theme: "dark",
        language: "en"
      });
      
      console.log("Featurebase booted with App ID: 68ec382cb73797e68c8d10dd");
      
      if (user && userHash) {
        console.log("User authenticated with Featurebase:", user.id);
      } else if (user) {
        console.log("User signed in but no hash yet:", user.id);
      } else {
        console.log("No user signed in - widget available as anonymous");
      }
    };

    // Run immediately
    initializeFeaturebase();
    
    // Also run after a short delay to ensure SDK is loaded
    const timeout = setTimeout(initializeFeaturebase, 1000);
    
    return () => clearTimeout(timeout);
  }, [user, userHash]);

  return (
    <>
      {/* Load the Featurebase SDK */}
      <Script 
        src="https://do.featurebase.app/js/sdk.js" 
        id="featurebase-sdk" 
        strategy="afterInteractive"
        onLoad={() => {
          console.log("Featurebase SDK loaded");
          // Force boot after SDK loads
          setTimeout(() => {
            const win = window;
            if (win.Featurebase) {
              win.Featurebase("boot", {
                appId: "68ec382cb73797e68c8d10dd",
                theme: "dark",
                language: "en"
              });
              console.log("Featurebase re-booted after SDK load");
            }
          }, 500);
        }}
        onError={(e) => {
          console.error("Featurebase SDK failed to load:", e);
        }}
      />
    </>
  );
};

export default FeaturebaseMessenger;
