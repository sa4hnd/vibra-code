import { Canvas, Rect, Group, Blur, FractalNoise, Fill } from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { Wand2, FolderOpen } from 'lucide-react-native';
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Animated,
  Easing,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

import { GlassBackButton, GlassContinueButton } from './OnboardingComponents';

// OpenAI Icon Component
const OpenAIIcon = ({ size = 32 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="#000000">
    <Path d="M21.55 10.004a5.416 5.416 0 00-.478-4.501c-1.217-2.09-3.662-3.166-6.05-2.66A5.59 5.59 0 0010.831 1C8.39.995 6.224 2.546 5.473 4.838A5.553 5.553 0 001.76 7.496a5.487 5.487 0 00.691 6.5 5.416 5.416 0 00.477 4.502c1.217 2.09 3.662 3.165 6.05 2.66A5.586 5.586 0 0013.168 23c2.443.006 4.61-1.546 5.361-3.84a5.553 5.553 0 003.715-2.66 5.488 5.488 0 00-.693-6.497v.001zm-8.381 11.558a4.199 4.199 0 01-2.675-.954c.034-.018.093-.05.132-.074l4.44-2.53a.71.71 0 00.364-.623v-6.176l1.877 1.069c.02.01.033.029.036.05v5.115c-.003 2.274-1.87 4.118-4.174 4.123zM4.192 17.78a4.059 4.059 0 01-.498-2.763c.032.02.09.055.131.078l4.44 2.53c.225.13.504.13.73 0l5.42-3.088v2.138a.068.068 0 01-.027.057L9.9 19.288c-1.999 1.136-4.552.46-5.707-1.51h-.001zM3.023 8.216A4.15 4.15 0 015.198 6.41l-.002.151v5.06a.711.711 0 00.364.624l5.42 3.087-1.876 1.07a.067.067 0 01-.063.005l-4.489-2.559c-1.995-1.14-2.679-3.658-1.53-5.63h.001zm15.417 3.54l-5.42-3.088L14.896 7.6a.067.067 0 01.063-.006l4.489 2.557c1.998 1.14 2.683 3.662 1.529 5.633a4.163 4.163 0 01-2.174 1.807V12.38a.71.71 0 00-.363-.623zm1.867-2.773a6.04 6.04 0 00-.132-.078l-4.44-2.53a.731.731 0 00-.729 0l-5.42 3.088V7.325a.068.068 0 01.027-.057L14.1 4.713c2-1.137 4.555-.46 5.707 1.513.487.833.664 1.809.499 2.757h.001zm-11.741 3.81l-1.877-1.068a.065.065 0 01-.036-.051V6.559c.001-2.277 1.873-4.122 4.181-4.12.976 0 1.92.338 2.671.954-.034.018-.092.05-.131.073l-4.44 2.53a.71.71 0 00-.365.623l-.003 6.173v.002zm1.02-2.168L12 9.25l2.414 1.375v2.75L12 14.75l-2.415-1.375v-2.75z" />
  </Svg>
);

// Claude Icon Component - WHITE icon on orange background
const ClaudeIcon = ({ size = 32 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z"
      fill="#FFFFFF"
      fillRule="nonzero"
    />
  </Svg>
);

// Gemini Icon Component
const GeminiIcon = ({ size = 32 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Defs>
      <LinearGradient
        id="gemini-green"
        x1="7"
        y1="15.5"
        x2="11"
        y2="12"
        gradientUnits="userSpaceOnUse">
        <Stop stopColor="#08B962" />
        <Stop offset="1" stopColor="#08B962" stopOpacity="0" />
      </LinearGradient>
      <LinearGradient
        id="gemini-red"
        x1="8"
        y1="5.5"
        x2="11.5"
        y2="11"
        gradientUnits="userSpaceOnUse">
        <Stop stopColor="#F94543" />
        <Stop offset="1" stopColor="#F94543" stopOpacity="0" />
      </LinearGradient>
      <LinearGradient
        id="gemini-yellow"
        x1="3.5"
        y1="13.5"
        x2="17.5"
        y2="12"
        gradientUnits="userSpaceOnUse">
        <Stop stopColor="#FABC12" />
        <Stop offset="0.46" stopColor="#FABC12" stopOpacity="0" />
      </LinearGradient>
    </Defs>
    <Path
      d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z"
      fill="#3186FF"
    />
    <Path
      d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z"
      fill="url(#gemini-green)"
    />
    <Path
      d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z"
      fill="url(#gemini-red)"
    />
    <Path
      d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z"
      fill="url(#gemini-yellow)"
    />
  </Svg>
);

// Mesh Gradient Background (same as screen 3)
const MeshGradientBackground = React.memo(
  ({ width, height }: { width: number; height: number }) => {
    const scaleX = width / 500;
    const scaleY = height / 1000;

    return (
      <Canvas style={StyleSheet.absoluteFillObject}>
        <Rect x={0} y={0} width={width} height={height} color="#0091FF" />
        <Group>
          <Blur blur={100 * Math.min(scaleX, scaleY)} />
          <Rect
            x={-165 * scaleX}
            y={313 * scaleY}
            width={593 * scaleX}
            height={503 * scaleY}
            color="#003CFF"
          />
          <Rect
            x={141 * scaleX}
            y={-116 * scaleY}
            width={348 * scaleX}
            height={590 * scaleY}
            color="#5DA6F0"
          />
          <Rect
            x={-width * 0.3}
            y={-height * 0.4}
            width={width * 1.6}
            height={height * 0.55}
            color="#000000"
          />
          <Rect
            x={-width * 0.4}
            y={-height * 0.2}
            width={width * 0.5}
            height={height * 0.5}
            color="#000000"
          />
          <Rect
            x={width * 0.9}
            y={-height * 0.2}
            width={width * 0.5}
            height={height * 0.5}
            color="#000000"
          />
        </Group>
        <Group blendMode="overlay" opacity={0.35}>
          <Fill>
            <FractalNoise freqX={0.6} freqY={0.6} octaves={3} />
          </Fill>
        </Group>
      </Canvas>
    );
  }
);

interface NewOnboardingScreen9Props {
  onNext: () => void;
  onBack: () => void;
}

export const NewOnboardingScreen9: React.FC<NewOnboardingScreen9Props> = ({ onNext, onBack }) => {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  // Animation values for logos
  // GPT (OpenAI) - from top-left
  const openaiAnim = useRef(new Animated.ValueXY({ x: -150, y: -150 })).current;
  const openaiRotate = useRef(new Animated.Value(-25)).current;
  // Claude - from top center
  const claudeAnim = useRef(new Animated.ValueXY({ x: 0, y: -200 })).current;
  const claudeRotate = useRef(new Animated.Value(15)).current;
  // Gemini - from top-right
  const geminiAnim = useRef(new Animated.ValueXY({ x: 150, y: -150 })).current;
  const geminiRotate = useRef(new Animated.Value(20)).current;

  // Animation for text content fade in
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const featureOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Smooth ease-in-out bezier curve for buttery animations
    const easeInOut = Easing.bezier(0.4, 0, 0.2, 1);

    Animated.parallel([
      // OpenAI logo animation
      Animated.timing(openaiAnim, {
        toValue: { x: 0, y: 0 },
        duration: 800,
        easing: easeInOut,
        useNativeDriver: true,
      }),
      Animated.timing(openaiRotate, {
        toValue: -8,
        duration: 800,
        easing: easeInOut,
        useNativeDriver: true,
      }),
      // Claude logo animation
      Animated.timing(claudeAnim, {
        toValue: { x: 0, y: 0 },
        duration: 800,
        delay: 80,
        easing: easeInOut,
        useNativeDriver: true,
      }),
      Animated.timing(claudeRotate, {
        toValue: 0,
        duration: 800,
        delay: 80,
        easing: easeInOut,
        useNativeDriver: true,
      }),
      // Gemini logo animation
      Animated.timing(geminiAnim, {
        toValue: { x: 0, y: 0 },
        duration: 800,
        delay: 160,
        easing: easeInOut,
        useNativeDriver: true,
      }),
      Animated.timing(geminiRotate, {
        toValue: 10,
        duration: 800,
        delay: 160,
        easing: easeInOut,
        useNativeDriver: true,
      }),
      // Content fade in animation
      Animated.timing(titleOpacity, {
        toValue: 1,
        duration: 600,
        delay: 350,
        easing: easeInOut,
        useNativeDriver: true,
      }),
      Animated.timing(featureOpacity, {
        toValue: 1,
        duration: 600,
        delay: 500,
        easing: easeInOut,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Mesh Gradient Background */}
      <MeshGradientBackground width={width} height={height} />

      {/* Back Button */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <GlassBackButton onPress={onBack} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Animated Logo Icons */}
        <View style={styles.logosContainer}>
          {/* OpenAI - white bg, tilted -8deg */}
          <Animated.View
            style={[
              styles.logoWrapper,
              styles.logoOpenAI,
              {
                transform: [
                  { translateX: openaiAnim.x },
                  { translateY: openaiAnim.y },
                  {
                    rotate: openaiRotate.interpolate({
                      inputRange: [-25, -8],
                      outputRange: ['-25deg', '-8deg'],
                    }),
                  },
                ],
              },
            ]}>
            <OpenAIIcon size={44} />
          </Animated.View>

          {/* Claude - orange bg with white icon, no tilt */}
          <Animated.View
            style={[
              styles.logoWrapper,
              styles.logoClaude,
              {
                transform: [
                  { translateX: claudeAnim.x },
                  { translateY: claudeAnim.y },
                  {
                    rotate: claudeRotate.interpolate({
                      inputRange: [0, 15],
                      outputRange: ['0deg', '15deg'],
                    }),
                  },
                ],
              },
            ]}>
            <ClaudeIcon size={44} />
          </Animated.View>

          {/* Gemini - white bg, tilted 10deg */}
          <Animated.View
            style={[
              styles.logoWrapper,
              styles.logoGemini,
              {
                transform: [
                  { translateX: geminiAnim.x },
                  { translateY: geminiAnim.y },
                  {
                    rotate: geminiRotate.interpolate({
                      inputRange: [10, 20],
                      outputRange: ['10deg', '20deg'],
                    }),
                  },
                ],
              },
            ]}>
            <GeminiIcon size={44} />
          </Animated.View>
        </View>

        {/* Title - moved down */}
        <Animated.Text style={[styles.title, { opacity: titleOpacity }]}>
          All the powerful APIs{'\n'}at your fingertips
        </Animated.Text>

        {/* Feature List - centered and moved down */}
        <Animated.View style={[styles.featureList, { opacity: featureOpacity }]}>
          <View style={styles.featureItem}>
            <Wand2 size={20} color="rgba(255,255,255,0.7)" style={styles.featureIcon} />
            <View style={styles.featureTextContainer}>
              <Text style={styles.featureText}>
                <Text style={styles.featureTextBold}>Vibracode agent</Text>
                <Text>
                  {' '}
                  can access 40+ iOS and AI tools like OpenAI, Calendar, Location and more!
                </Text>
              </Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <FolderOpen size={20} color="rgba(255,255,255,0.7)" style={styles.featureIcon} />
            <View style={styles.featureTextContainer}>
              <Text style={styles.featureText}>
                <Text style={styles.featureTextBold}>Full-code export</Text>
                <Text> — open the project in Cursor with 1 click</Text>
              </Text>
            </View>
          </View>
        </Animated.View>
      </View>

      {/* Continue Button - Glass */}
      <View style={[styles.bottomSection, { paddingBottom: Math.max(insets.bottom + 16, 32) }]}>
        <GlassContinueButton onPress={onNext} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 16,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 110,
  },
  logosContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 36,
    marginTop: 30,
    height: 100,
  },
  logoWrapper: {
    width: 80,
    height: 80,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  logoOpenAI: {
    backgroundColor: '#FFFFFF',
    marginRight: -12,
    zIndex: 1,
  },
  logoClaude: {
    backgroundColor: '#E87A3D',
    zIndex: 2,
    marginTop: -28,
  },
  logoGemini: {
    backgroundColor: '#FFFFFF',
    marginLeft: -12,
    zIndex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.3,
    lineHeight: 36,
    marginBottom: 40,
    paddingHorizontal: 24,
  },
  featureList: {
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 32,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
    maxWidth: 320,
  },
  featureIcon: {
    marginRight: 12,
    marginTop: 3,
  },
  featureTextContainer: {
    flex: 1,
  },
  featureText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 24,
    textAlign: 'left',
  },
  featureTextBold: {
    fontWeight: '600',
    color: '#FFFFFF',
  },
  bottomSection: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
});

export default NewOnboardingScreen9;
