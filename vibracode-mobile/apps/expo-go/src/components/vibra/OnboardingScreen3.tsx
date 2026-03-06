import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  StatusBar,
  ImageBackground,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VibraColors, VibraSpacing, VibraBorderRadius } from '../../constants/VibraColors';

interface OnboardingScreen3Props {
  onNext: () => void;
  onBack: () => void;
}

interface ChatMessage {
  id: number;
  text: string;
  isUser: boolean;
  timestamp: number;
}

// Chat simulation component - Just message bubbles with individual animations
const ChatSimulation: React.FC<{ visible: boolean }> = ({ visible }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [messageAnimations, setMessageAnimations] = useState<{ [key: number]: Animated.Value }>({});

  const demoMessages: ChatMessage[] = [
    { id: 1, text: 'Build me a weather app', isUser: true, timestamp: Date.now() },
    {
      id: 2,
      text: 'Perfect! I created a weather app with real-time data and smooth animations.',
      isUser: false,
      timestamp: Date.now() + 1000,
    },
    {
      id: 3,
      text: 'Add payments to it and publish to app store',
      isUser: true,
      timestamp: Date.now() + 2000,
    },
    {
      id: 4,
      text: 'Okay, I just added Stripe payments and published it to the App Store. Done! 🚀',
      isUser: false,
      timestamp: Date.now() + 3000,
    },
  ];

  useEffect(() => {
    if (!visible) return;

    const timer = setTimeout(
      () => {
        if (currentMessageIndex < demoMessages.length) {
          const message = demoMessages[currentMessageIndex];

          // Create animation for this message
          const messageAnim = new Animated.Value(0);
          setMessageAnimations((prev) => ({ ...prev, [message.id]: messageAnim }));

          if (message.isUser) {
            // User message appears immediately
            setMessages((prev) => [...prev, message]);
            Animated.spring(messageAnim, {
              toValue: 1,
              tension: 100,
              friction: 8,
              useNativeDriver: true,
            }).start();
            setCurrentMessageIndex((prev) => prev + 1);
          } else {
            // AI message with typing effect
            setIsTyping(true);
            setTimeout(() => {
              setMessages((prev) => [...prev, message]);
              setIsTyping(false);
              Animated.spring(messageAnim, {
                toValue: 1,
                tension: 100,
                friction: 8,
                useNativeDriver: true,
              }).start();
              setCurrentMessageIndex((prev) => prev + 1);
            }, 300);
          }
        }
      },
      currentMessageIndex === 0 ? 1000 : 1500
    );

    return () => clearTimeout(timer);
  }, [visible, currentMessageIndex]);

  if (!visible) return null;

  return (
    <View style={styles.chatBubbles}>
      {messages.map((message) => {
        const messageAnim = messageAnimations[message.id] || new Animated.Value(1);

        if (message.isUser) {
          return (
            <Animated.View
              key={message.id}
              style={[
                styles.userBubble,
                {
                  opacity: messageAnim,
                  transform: [
                    { scale: messageAnim },
                    {
                      translateY: messageAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [20, 0],
                      }),
                    },
                  ],
                },
              ]}>
              <View style={styles.userMessage}>
                <Text style={styles.userText}>{message.text}</Text>
              </View>
            </Animated.View>
          );
        } else {
          const isCompletionMessage = message.id === 4;
          return (
            <Animated.View
              key={message.id}
              style={[
                styles.aiBubble,
                {
                  opacity: messageAnim,
                  transform: [
                    { scale: messageAnim },
                    {
                      translateY: messageAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [20, 0],
                      }),
                    },
                  ],
                },
              ]}>
              <View
                style={[
                  styles.assistantMessageContainer,
                  isCompletionMessage && styles.completionMessage,
                ]}>
                <Text
                  style={[styles.assistantTextPlain, isCompletionMessage && styles.completionText]}>
                  {message.text}
                </Text>
              </View>
            </Animated.View>
          );
        }
      })}

      {isTyping && (
        <Animated.View style={styles.aiBubble}>
          <View style={styles.assistantMessageContainer}>
            <View style={styles.typingIndicator}>
              <View style={styles.typingDot} />
              <View style={styles.typingDot} />
              <View style={styles.typingDot} />
            </View>
          </View>
        </Animated.View>
      )}
    </View>
  );
};

export const OnboardingScreen3: React.FC<OnboardingScreen3Props> = ({ onNext, onBack }) => {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Responsive breakpoints
  const isTablet = width > 768;
  const isLandscape = width > height;
  const isCompact = height < 700;

  const titleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleSlide = useRef(new Animated.Value(30)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const chatOpacity = useRef(new Animated.Value(0)).current;
  const [showChat, setShowChat] = useState(false);

  // Responsive styles
  const responsiveStyles = {
    headerHeight: isLandscape
      ? height * 0.28
      : isTablet
        ? height * 0.25
        : isCompact
          ? height * 0.22
          : height * 0.28,
    titleSize: isTablet ? 34 : isCompact ? 30 : 34,
    titleLineHeight: isTablet ? 42 : isCompact ? 36 : 42,
    contentPadding: isTablet ? VibraSpacing['3xl'] : VibraSpacing.xl,
    buttonWidth: isTablet ? Math.min(400, width * 0.5) : width * 0.75,
  };

  useEffect(() => {
    // Smooth entrance sequence
    Animated.sequence([
      // Title fade in
      Animated.timing(titleOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),

      // Show chat simulation
      Animated.delay(300),
      Animated.timing(chatOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),

      // Button entrance - delay until after messages
      Animated.delay(6000),
      Animated.timing(buttonOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    // Start chat simulation after title appears
    setTimeout(() => {
      setShowChat(true);
    }, 1000);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Back Button */}
      <View style={[styles.header, { top: insets.top + VibraSpacing.md }]}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <ChevronLeft size={20} color={VibraColors.neutral.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Header with Cosmic Background */}
      <View style={[styles.headerSection, { height: responsiveStyles.headerHeight }]}>
        <ImageBackground
          source={{ uri: 'https://i.imgur.com/jfFmH88.png' }}
          style={styles.cosmicOverlay}
          resizeMode="cover"
        />

        {/* Fade Gradient Overlay */}
        <LinearGradient
          colors={['transparent', 'transparent', VibraColors.neutral.background]}
          locations={[0, 0.6, 1]}
          style={styles.fadeGradient}
        />
      </View>

      {/* Title Section */}
      <View style={[styles.titleSection, { paddingHorizontal: responsiveStyles.contentPadding }]}>
        <Animated.Text
          style={[
            styles.title,
            {
              opacity: titleOpacity,
              fontSize: responsiveStyles.titleSize,
              lineHeight: responsiveStyles.titleLineHeight,
            },
          ]}>
          Watch AI code{'\n'}your dream app{'\n'}in real-time
        </Animated.Text>
      </View>

      {/* Chat Section */}
      <Animated.View style={[styles.chatSection, { opacity: chatOpacity }]}>
        <ChatSimulation visible={showChat} />
      </Animated.View>

      {/* Spacer */}
      <View style={styles.spacer} />

      {/* CTA Section */}
      <Animated.View
        style={[
          styles.ctaSection,
          {
            opacity: buttonOpacity,
            paddingBottom: Math.max(insets.bottom, VibraSpacing.md),
          },
        ]}>
        <TouchableOpacity
          style={[styles.nextButton, { minWidth: responsiveStyles.buttonWidth }]}
          onPress={onNext}
          activeOpacity={0.9}>
          <LinearGradient
            colors={[VibraColors.neutral.text, VibraColors.neutral.textSecondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.buttonGradient}>
            <Text style={styles.buttonText}>Start Building</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Progress Dots */}
        <View style={styles.progressContainer}>
          <View style={styles.dots}>
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={[styles.dot, styles.dotActive]} />
            <View style={styles.dot} />
          </View>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: VibraColors.neutral.background,
  },

  // Header Section with Cosmic Background
  headerSection: {
    position: 'relative',
    overflow: 'hidden',
  },

  // Cosmic Landscape Overlay
  cosmicOverlay: {
    position: 'absolute',
    top: -50,
    left: 0,
    right: 0,
    bottom: -50,
    zIndex: 1,
  },

  fadeGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
  },

  // Title Section
  titleSection: {
    alignItems: 'center',
    paddingBottom: VibraSpacing.lg,
  },

  // Typography
  title: {
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -1,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },

  // Spacer
  spacer: {
    flex: 1,
  },

  // CTA Section
  ctaSection: {
    alignItems: 'center',
    paddingHorizontal: VibraSpacing.xl,
    paddingTop: VibraSpacing.lg,
  },

  nextButton: {
    borderRadius: VibraBorderRadius['2xl'],
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },

  buttonGradient: {
    paddingHorizontal: VibraSpacing['3xl'],
    paddingVertical: VibraSpacing.lg,
    borderRadius: VibraBorderRadius['2xl'],
    alignItems: 'center',
  },

  buttonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
    letterSpacing: -0.3,
  },

  // Progress Dots
  progressContainer: {
    alignItems: 'center',
    marginTop: VibraSpacing.xl,
  },

  dots: {
    flexDirection: 'row',
    gap: VibraSpacing.sm,
  },

  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: VibraColors.neutral.border,
  },

  dotActive: {
    backgroundColor: VibraColors.neutral.text,
    width: 24,
  },

  // Chat Section
  chatSection: {
    marginHorizontal: VibraSpacing.xl,
    flex: 1,
    maxHeight: 220,
  },

  chatBubbles: {
    width: '100%',
    gap: VibraSpacing.md,
  },

  userBubble: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    marginVertical: 2,
  },

  aiBubble: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    marginVertical: 2,
  },

  userMessage: {
    borderRadius: 18,
    maxWidth: '80%',
    borderBottomRightRadius: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: VibraSpacing.md,
    paddingVertical: VibraSpacing.sm,
  },

  userText: {
    color: '#000000',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },

  assistantMessageContainer: {
    backgroundColor: '#000000',
    borderRadius: 18,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: '#333333',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    paddingHorizontal: VibraSpacing.md,
    paddingVertical: VibraSpacing.sm,
    maxWidth: '80%',
  },

  assistantTextPlain: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },

  completionMessage: {
    backgroundColor: '#000000',
    borderColor: '#333333',
  },

  completionText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },

  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: VibraColors.neutral.textSecondary,
  },

  // Header and Back Button
  header: {
    position: 'absolute',
    left: VibraSpacing.lg,
    zIndex: 10,
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: VibraColors.surface.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
  },
});

export default OnboardingScreen3;
