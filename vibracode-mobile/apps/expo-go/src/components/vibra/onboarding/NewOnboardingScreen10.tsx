import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, StatusBar, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, G, Rect, Defs, LinearGradient, Stop, RadialGradient } from 'react-native-svg';

import { GlassBackButton, GlassOptionCard, GlassContinueButton } from './OnboardingComponents';
import { OnboardingColors } from './OnboardingConstants';

// Google Icon
const GoogleIcon = ({ size = 24 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 16 16">
    <G fill="none" fillRule="evenodd" clipRule="evenodd">
      <Path
        fill="#F44336"
        d="M7.209 1.061c.725-.081 1.154-.081 1.933 0a6.57 6.57 0 0 1 3.65 1.82a100 100 0 0 0-1.986 1.93q-1.876-1.59-4.188-.734q-1.696.78-2.362 2.528a78 78 0 0 1-2.148-1.658a.26.26 0 0 0-.16-.027q1.683-3.245 5.26-3.86"
        opacity="0.987"
      />
      <Path
        fill="#FFC107"
        d="M1.946 4.92q.085-.013.161.027a78 78 0 0 0 2.148 1.658A7.6 7.6 0 0 0 4.04 7.99q.037.678.215 1.331L2 11.116Q.527 8.038 1.946 4.92"
        opacity="0.997"
      />
      <Path
        fill="#448AFF"
        d="M12.685 13.29a26 26 0 0 0-2.202-1.74q1.15-.812 1.396-2.228H8.122V6.713q3.25-.027 6.497.055q.616 3.345-1.423 6.032a7 7 0 0 1-.51.49"
        opacity="0.999"
      />
      <Path
        fill="#43A047"
        d="M4.255 9.322q1.23 3.057 4.51 2.854a3.94 3.94 0 0 0 1.718-.626q1.148.812 2.202 1.74a6.62 6.62 0 0 1-4.027 1.684a6.4 6.4 0 0 1-1.02 0Q3.82 14.524 2 11.116z"
        opacity="0.993"
      />
    </G>
  </Svg>
);

// Facebook Icon
const FacebookIcon = ({ size = 24 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 256 256">
    <Path
      fill="#1877F2"
      d="M256 128C256 57.308 198.692 0 128 0C57.308 0 0 57.307 0 128c0 63.888 46.808 116.843 108 126.445V165H75.5v-37H108V99.8c0-32.08 19.11-49.8 48.347-49.8C170.352 50 185 52.5 185 52.5V84h-16.14C152.958 84 148 93.867 148 103.99V128h35.5l-5.675 37H148v89.445c61.192-9.602 108-62.556 108-126.445"
    />
    <Path
      fill="#FFF"
      d="m177.825 165l5.675-37H148v-24.01C148 93.866 152.959 84 168.86 84H185V52.5S170.352 50 156.347 50C127.11 50 108 67.72 108 99.8V128H75.5v37H108v89.445A128.959 128.959 0 0 0 128 256a128.9 128.9 0 0 0 20-1.555V165h29.825"
    />
  </Svg>
);

// Instagram Icon
const InstagramIcon = ({ size = 24 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 256 256">
    <Defs>
      <RadialGradient
        id="ig0"
        cx="0"
        cy="0"
        r="1"
        gradientTransform="matrix(0 -253.715 235.975 0 68 275.717)"
        gradientUnits="userSpaceOnUse">
        <Stop stopColor="#FD5" />
        <Stop offset="0.1" stopColor="#FD5" />
        <Stop offset="0.5" stopColor="#FF543E" />
        <Stop offset="1" stopColor="#C837AB" />
      </RadialGradient>
      <RadialGradient
        id="ig1"
        cx="0"
        cy="0"
        r="1"
        gradientTransform="matrix(22.25952 111.2061 -458.39518 91.75449 -42.881 18.441)"
        gradientUnits="userSpaceOnUse">
        <Stop stopColor="#3771C8" />
        <Stop offset="0.128" stopColor="#3771C8" />
        <Stop offset="1" stopColor="#60F" stopOpacity="0" />
      </RadialGradient>
    </Defs>
    <Rect width="256" height="256" fill="url(#ig0)" rx="60" />
    <Rect width="256" height="256" fill="url(#ig1)" rx="60" />
    <Path
      fill="#ffffff"
      d="M128.009 28c-27.158 0-30.567.119-41.233.604c-10.646.488-17.913 2.173-24.271 4.646c-6.578 2.554-12.157 5.971-17.715 11.531c-5.563 5.559-8.98 11.138-11.542 17.713c-2.48 6.36-4.167 13.63-4.646 24.271c-.477 10.667-.602 14.077-.602 41.236s.12 30.557.604 41.223c.49 10.646 2.175 17.913 4.646 24.271c2.556 6.578 5.973 12.157 11.533 17.715c5.557 5.563 11.136 8.988 17.709 11.542c6.363 2.473 13.631 4.158 24.275 4.646c10.667.485 14.073.604 41.23.604c27.161 0 30.559-.119 41.225-.604c10.646-.488 17.921-2.173 24.284-4.646c6.575-2.554 12.146-5.979 17.702-11.542c5.563-5.558 8.979-11.137 11.542-17.712c2.458-6.361 4.146-13.63 4.646-24.272c.479-10.666.604-14.066.604-41.225s-.125-30.567-.604-41.234c-.5-10.646-2.188-17.912-4.646-24.27c-2.563-6.578-5.979-12.157-11.542-17.716c-5.562-5.562-11.125-8.979-17.708-11.53c-6.375-2.474-13.646-4.16-24.292-4.647c-10.667-.485-14.063-.604-41.23-.604h.031Zm-8.971 18.021c2.663-.004 5.634 0 8.971 0c26.701 0 29.865.096 40.409.575c9.75.446 15.042 2.075 18.567 3.444c4.667 1.812 7.994 3.979 11.492 7.48c3.5 3.5 5.666 6.833 7.483 11.5c1.369 3.52 3 8.812 3.444 18.562c.479 10.542.583 13.708.583 40.396c0 26.688-.104 29.855-.583 40.396c-.446 9.75-2.075 15.042-3.444 18.563c-1.812 4.667-3.983 7.99-7.483 11.488c-3.5 3.5-6.823 5.666-11.492 7.479c-3.521 1.375-8.817 3-18.567 3.446c-10.542.479-13.708.583-40.409.583c-26.702 0-29.867-.104-40.408-.583c-9.75-.45-15.042-2.079-18.57-3.448c-4.666-1.813-8-3.979-11.5-7.479s-5.666-6.825-7.483-11.494c-1.369-3.521-3-8.813-3.444-18.563c-.479-10.542-.575-13.708-.575-40.413c0-26.704.096-29.854.575-40.396c.446-9.75 2.075-15.042 3.444-18.567c1.813-4.667 3.983-8 7.484-11.5c3.5-3.5 6.833-5.667 11.5-7.483c3.525-1.375 8.819-3 18.569-3.448c9.225-.417 12.8-.542 31.437-.563v.025Zm62.351 16.604c-6.625 0-12 5.37-12 11.996c0 6.625 5.375 12 12 12s12-5.375 12-12s-5.375-12-12-12v.004Zm-53.38 14.021c-28.36 0-51.354 22.994-51.354 51.355c0 28.361 22.994 51.344 51.354 51.344c28.361 0 51.347-22.983 51.347-51.344c0-28.36-22.988-51.355-51.349-51.355h.002Zm0 18.021c18.409 0 33.334 14.923 33.334 33.334c0 18.409-14.925 33.334-33.334 33.334c-18.41 0-33.333-14.925-33.333-33.334c0-18.411 14.923-33.334 33.333-33.334Z"
    />
  </Svg>
);

// App Store Icon
const AppStoreIcon = ({ size = 24 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 256 256">
    <Defs>
      <LinearGradient id="appstore0" x1="50%" x2="50%" y1="0%" y2="100%">
        <Stop offset="0%" stopColor="#17C9FB" />
        <Stop offset="100%" stopColor="#1A74E8" />
      </LinearGradient>
    </Defs>
    <Path
      fill="url(#appstore0)"
      d="M56.064 0h143.872C230.9 0 256 25.1 256 56.064v143.872C256 230.9 230.9 256 199.936 256H56.064C25.1 256 0 230.9 0 199.936V56.064C0 25.1 25.1 0 56.064 0Z"
    />
    <Path
      fill="#ffffff"
      d="m82.042 185.81l.024.008l-8.753 15.16c-3.195 5.534-10.271 7.43-15.805 4.235c-5.533-3.195-7.43-10.271-4.235-15.805l6.448-11.168l.619-1.072c1.105-1.588 3.832-4.33 9.287-3.814c0 0 12.837 1.393 13.766 8.065c0 0 .126 2.195-1.351 4.391Zm124.143-38.72h-27.294c-1.859-.125-2.67-.789-2.99-1.175l-.02-.035l-29.217-50.606l-.038.025l-1.752-2.512c-2.872-4.392-7.432 6.84-7.432 6.84c-5.445 12.516.773 26.745 2.94 31.046l40.582 70.29c3.194 5.533 10.27 7.43 15.805 4.234c5.533-3.195 7.43-10.271 4.234-15.805l-10.147-17.576c-.197-.426-.539-1.582 1.542-1.587h13.787c6.39 0 11.57-5.18 11.57-11.57c0-6.39-5.18-11.57-11.57-11.57Zm-53.014 15.728s1.457 7.411-4.18 7.411H48.092c-6.39 0-11.57-5.18-11.57-11.57c0-6.39 5.18-11.57 11.57-11.57h25.94c4.188-.242 5.18-2.66 5.18-2.66l.024.012l33.86-58.648l-.01-.002c.617-1.133.103-2.204.014-2.373l-11.183-19.369c-3.195-5.533-1.299-12.61 4.235-15.804c5.534-3.195 12.61-1.3 15.805 4.234l5.186 8.983l5.177-8.967c3.195-5.533 10.271-7.43 15.805-4.234c5.534 3.195 7.43 10.27 4.235 15.804l-47.118 81.61c-.206.497-.269 1.277 1.264 1.414h28.164l.006.275s16.278.253 18.495 15.454Z"
    />
  </Svg>
);

// X (Twitter) Icon
const XIcon = ({ size = 24 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      fill="#000000"
      fillRule="evenodd"
      clipRule="evenodd"
      d="M5 1a4 4 0 0 0-4 4v14a4 4 0 0 0 4 4h14a4 4 0 0 0 4-4V5a4 4 0 0 0-4-4zm-.334 3.5a.75.75 0 0 0-.338 1.154l5.614 7.45l-5.915 6.345l-.044.051H6.03l4.83-5.179l3.712 4.928a.75.75 0 0 0 .337.251h4.422a.75.75 0 0 0 .336-1.154l-5.614-7.45L20.017 4.5h-2.05l-4.83 5.18l-3.714-4.928a.75.75 0 0 0-.337-.252zm10.88 13.548L6.431 5.952H8.45l9.114 12.095z"
    />
  </Svg>
);

// YouTube Icon
const YouTubeIcon = ({ size = 24 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 256 180">
    <Path
      fill="#FF0000"
      d="M250.346 28.075A32.18 32.18 0 0 0 227.69 5.418C207.824 0 127.87 0 127.87 0S47.912.164 28.046 5.582A32.18 32.18 0 0 0 5.39 28.24c-6.009 35.298-8.34 89.084.165 122.97a32.18 32.18 0 0 0 22.656 22.657c19.866 5.418 99.822 5.418 99.822 5.418s79.955 0 99.82-5.418a32.18 32.18 0 0 0 22.657-22.657c6.338-35.348 8.291-89.1-.164-123.134Z"
    />
    <Path fill="#FFF" d="m102.421 128.06l66.328-38.418l-66.328-38.418z" />
  </Svg>
);

// OpenAI Icon (reused from screen 8)
const OpenAIIcon = ({ size = 24 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="#000000">
    <Path d="M21.55 10.004a5.416 5.416 0 00-.478-4.501c-1.217-2.09-3.662-3.166-6.05-2.66A5.59 5.59 0 0010.831 1C8.39.995 6.224 2.546 5.473 4.838A5.553 5.553 0 001.76 7.496a5.487 5.487 0 00.691 6.5 5.416 5.416 0 00.477 4.502c1.217 2.09 3.662 3.165 6.05 2.66A5.586 5.586 0 0013.168 23c2.443.006 4.61-1.546 5.361-3.84a5.553 5.553 0 003.715-2.66 5.488 5.488 0 00-.693-6.497v.001zm-8.381 11.558a4.199 4.199 0 01-2.675-.954c.034-.018.093-.05.132-.074l4.44-2.53a.71.71 0 00.364-.623v-6.176l1.877 1.069c.02.01.033.029.036.05v5.115c-.003 2.274-1.87 4.118-4.174 4.123zM4.192 17.78a4.059 4.059 0 01-.498-2.763c.032.02.09.055.131.078l4.44 2.53c.225.13.504.13.73 0l5.42-3.088v2.138a.068.068 0 01-.027.057L9.9 19.288c-1.999 1.136-4.552.46-5.707-1.51h-.001zM3.023 8.216A4.15 4.15 0 015.198 6.41l-.002.151v5.06a.711.711 0 00.364.624l5.42 3.087-1.876 1.07a.067.067 0 01-.063.005l-4.489-2.559c-1.995-1.14-2.679-3.658-1.53-5.63h.001zm15.417 3.54l-5.42-3.088L14.896 7.6a.067.067 0 01.063-.006l4.489 2.557c1.998 1.14 2.683 3.662 1.529 5.633a4.163 4.163 0 01-2.174 1.807V12.38a.71.71 0 00-.363-.623zm1.867-2.773a6.04 6.04 0 00-.132-.078l-4.44-2.53a.731.731 0 00-.729 0l-5.42 3.088V7.325a.068.068 0 01.027-.057L14.1 4.713c2-1.137 4.555-.46 5.707 1.513.487.833.664 1.809.499 2.757h.001zm-11.741 3.81l-1.877-1.068a.065.065 0 01-.036-.051V6.559c.001-2.277 1.873-4.122 4.181-4.12.976 0 1.92.338 2.671.954-.034.018-.092.05-.131.073l-4.44 2.53a.71.71 0 00-.365.623l-.003 6.173v.002zm1.02-2.168L12 9.25l2.414 1.375v2.75L12 14.75l-2.415-1.375v-2.75z" />
  </Svg>
);

interface NewOnboardingScreen10Props {
  onNext: () => void;
  onBack: () => void;
}

const SOURCE_OPTIONS = [
  { id: 'google', label: 'Google Search', Icon: GoogleIcon, iconBg: null },
  { id: 'facebook', label: 'Facebook', Icon: FacebookIcon, iconBg: null },
  { id: 'ai', label: 'AI Assistant', Icon: OpenAIIcon, iconBg: '#FFFFFF' },
  { id: 'instagram', label: 'Instagram', Icon: InstagramIcon, iconBg: null },
  { id: 'appstore', label: 'App Store', Icon: AppStoreIcon, iconBg: null },
  { id: 'x', label: 'X', Icon: XIcon, iconBg: '#FFFFFF' },
  { id: 'youtube', label: 'YouTube', Icon: YouTubeIcon, iconBg: null },
];

export const NewOnboardingScreen10: React.FC<NewOnboardingScreen10Props> = ({ onNext, onBack }) => {
  const insets = useSafeAreaInsets();
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const handleSelect = (id: string) => {
    setSelectedOption(id);
  };

  const handleContinue = useCallback(() => {
    if (selectedOption) {
      onNext();
    }
  }, [selectedOption, onNext]);

  const isButtonEnabled = selectedOption !== null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header with Progress Bar */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <GlassBackButton onPress={onBack} />

        {/* Progress Bar */}
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBarBackground}>
            <View style={[styles.progressBarFill, { width: '62%' }]} />
          </View>
        </View>
      </View>

      {/* Title */}
      <Text style={styles.title}>How did you hear about us?</Text>

      {/* Options - Glass Cards */}
      <ScrollView
        style={styles.optionsContainer}
        contentContainerStyle={styles.optionsContent}
        showsVerticalScrollIndicator={false}>
        {SOURCE_OPTIONS.map((option) => {
          const { Icon, iconBg } = option;
          const isSelected = selectedOption === option.id;

          return (
            <GlassOptionCard
              key={option.id}
              label={option.label}
              icon={
                <View style={[styles.iconWrapper, iconBg ? { backgroundColor: iconBg } : null]}>
                  <Icon size={24} />
                </View>
              }
              selected={isSelected}
              onSelect={() => handleSelect(option.id)}
              style={styles.optionCard}
            />
          );
        })}
      </ScrollView>

      {/* Continue Button - Glass */}
      <View style={[styles.bottomSection, { paddingBottom: Math.max(insets.bottom + 16, 32) }]}>
        <GlassContinueButton onPress={handleContinue} disabled={!isButtonEnabled} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: OnboardingColors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  progressBarContainer: {
    flex: 1,
    marginLeft: 8,
    marginRight: 16,
  },
  progressBarBackground: {
    height: 4,
    backgroundColor: OnboardingColors.progressBar.background,
    borderRadius: 2,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: OnboardingColors.progressBar.fill,
    borderRadius: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    paddingHorizontal: 24,
    marginTop: 8,
    marginBottom: 24,
    letterSpacing: -0.5,
    lineHeight: 36,
  },
  optionsContainer: {
    flex: 1,
  },
  optionsContent: {
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  optionCard: {
    marginBottom: 12,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  bottomSection: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
});

export default NewOnboardingScreen10;
