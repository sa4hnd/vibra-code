import { AlertCircle, RefreshCw, Link, ExternalLink } from 'lucide-react-native';
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';

import { VibraColors, VibraSpacing } from '../../constants/VibraColors';

interface ConvexDashboardProps {
  deploymentName: string;
  deploymentUrl: string;
  adminKey: string;
  onOpenInBrowser?: () => void;
}

export const ConvexDashboard: React.FC<ConvexDashboardProps> = ({
  deploymentName,
  deploymentUrl,
  adminKey,
  onOpenInBrowser,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const webViewRef = useRef<WebView>(null);

  console.log('🔍 ConvexDashboard props:', {
    deploymentName,
    deploymentUrl,
    adminKey: adminKey ? `${adminKey.substring(0, 20)}...` : 'undefined',
  });

  const dashboardUrl = 'https://dashboard-embedded.convex.dev/data';
  const shownUrl = `https://dashboard.convex.dev/d/${deploymentName}/data`;

  // Create injected JavaScript to send credentials
  const injectedJavaScript = `
    (function() {
      console.log('🔧 Injected JS: Setting up credential sending...');
      
      const credentials = {
        type: 'dashboard-credentials',
        adminKey: '${adminKey}',
        deploymentUrl: '${deploymentUrl}',
        deploymentName: '${deploymentName}',
      };
      
      console.log('🔧 Injected JS: Credentials prepared:', credentials);
      
      // Try to send credentials immediately
      setTimeout(() => {
        console.log('🔧 Injected JS: Sending credentials to iframe...');
        const iframe = document.querySelector('iframe');
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage(credentials, '*');
          console.log('🔧 Injected JS: Credentials sent to iframe');
        } else {
          console.log('🔧 Injected JS: No iframe found yet');
        }
      }, 1000);
      
      // Also listen for messages from the iframe
      window.addEventListener('message', (event) => {
        console.log('🔧 Injected JS: Received message:', event.data);
        if (event.data?.type === 'dashboard-credentials-request') {
          console.log('🔧 Injected JS: Dashboard requesting credentials, sending...');
          event.source.postMessage(credentials, '*');
        }
      });
    })();
    true; // Required for injectedJavaScript
  `;

  useEffect(() => {
    // Set up message listener for WebView communication
    const handleMessage = (event: any) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);

        if (data.type === 'dashboard-credentials-request') {
          // Send credentials to the embedded dashboard
          const credentials = {
            type: 'dashboard-credentials',
            adminKey,
            deploymentUrl,
            deploymentName,
          };

          webViewRef.current?.postMessage(JSON.stringify(credentials));
        }
      } catch (err) {
        console.error('Error handling WebView message:', err);
      }
    };

    // Fallback: Send credentials after a delay even if no request message
    const fallbackTimeout = setTimeout(() => {
      console.log('⏰ Fallback: Sending credentials without request message');
      const credentials = {
        type: 'dashboard-credentials',
        adminKey,
        deploymentUrl,
        deploymentName,
      };

      console.log('📤 Sending credentials via postMessage:', credentials);
      webViewRef.current?.postMessage(JSON.stringify(credentials));

      // Try multiple times with different delays
      setTimeout(() => {
        console.log('🔄 Retry 1: Sending credentials again');
        webViewRef.current?.postMessage(JSON.stringify(credentials));
      }, 1000);

      setTimeout(() => {
        console.log('🔄 Retry 2: Sending credentials again');
        webViewRef.current?.postMessage(JSON.stringify(credentials));
      }, 2000);
    }, 3000);

    return () => {
      clearTimeout(fallbackTimeout);
    };
  }, [adminKey, deploymentUrl, deploymentName]);

  const handleWebViewLoad = () => {
    setIsLoaded(true);
    setError(null);
  };

  const handleWebViewError = (syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    console.error('WebView error:', nativeEvent);
    setError('Failed to load Convex dashboard');
  };

  const handleOpenInBrowser = () => {
    if (onOpenInBrowser) {
      onOpenInBrowser();
    } else {
      Linking.openURL(shownUrl);
    }
  };

  const handleRefresh = () => {
    setError(null);
    setIsLoaded(false);
    webViewRef.current?.reload();
  };

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <View style={styles.errorContent}>
          <AlertCircle size={48} color="#FF6B6B" />
          <Text style={styles.errorTitle}>Failed to Load Dashboard</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
            <RefreshCw size={20} color="#FFFFFF" />
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with URL and actions */}
      <View style={styles.header}>
        <View style={styles.urlContainer}>
          <Link size={16} color={VibraColors.neutral.textSecondary} />
          <Text style={styles.urlText} numberOfLines={1}>
            {shownUrl}
          </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButton} onPress={handleRefresh}>
            <RefreshCw size={16} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleOpenInBrowser}>
            <ExternalLink size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* WebView Container */}
      <View style={styles.webViewContainer}>
        <WebView
          ref={webViewRef}
          source={{ uri: dashboardUrl }}
          style={styles.webView}
          onLoad={handleWebViewLoad}
          onError={handleWebViewError}
          injectedJavaScript={injectedJavaScript}
          onMessage={(event) => {
            try {
              console.log('📨 WebView received message:', event.nativeEvent.data);
              const data = JSON.parse(event.nativeEvent.data);
              console.log('📊 Parsed message data:', data);

              if (data.type === 'dashboard-credentials-request') {
                console.log('🔑 Dashboard requesting credentials, sending...');
                // Send credentials to the embedded dashboard
                const credentials = {
                  type: 'dashboard-credentials',
                  adminKey,
                  deploymentUrl,
                  deploymentName,
                };

                console.log('📤 Sending credentials:', credentials);
                webViewRef.current?.postMessage(JSON.stringify(credentials));
              } else {
                console.log('⚠️ Unknown message type:', data.type);
              }
            } catch (err) {
              console.error('❌ Error handling WebView message:', err);
            }
          }}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={VibraColors.accent.blue} />
              <Text style={styles.loadingText}>Loading Convex Dashboard...</Text>
            </View>
          )}
        />

        {!isLoaded && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={VibraColors.accent.blue} />
            <Text style={styles.loadingText}>Loading Convex Dashboard...</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: VibraSpacing.lg,
    paddingVertical: VibraSpacing.md,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  urlContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: VibraSpacing.md,
    paddingVertical: VibraSpacing.sm,
    borderRadius: 8,
    marginRight: VibraSpacing.md,
    gap: VibraSpacing.sm,
  },
  urlText: {
    color: VibraColors.neutral.textSecondary,
    fontSize: 12,
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: VibraSpacing.sm,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  webViewContainer: {
    flex: 1,
    position: 'relative',
  },
  webView: {
    flex: 1,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0A0F',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0A0F',
  },
  loadingText: {
    color: VibraColors.neutral.textSecondary,
    fontSize: 14,
    marginTop: VibraSpacing.md,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: VibraSpacing.xl,
  },
  errorContent: {
    alignItems: 'center',
  },
  errorTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginTop: VibraSpacing.lg,
    marginBottom: VibraSpacing.md,
  },
  errorMessage: {
    color: VibraColors.neutral.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: VibraSpacing.xl,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: VibraColors.accent.blue,
    paddingHorizontal: VibraSpacing.lg,
    paddingVertical: VibraSpacing.md,
    borderRadius: 8,
    gap: VibraSpacing.sm,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
