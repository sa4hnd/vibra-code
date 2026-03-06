import { LinearGradient } from 'expo-linear-gradient';
import { Image as ImageIcon, Settings, Mic, Send } from 'lucide-react-native';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Keyboard,
  TextInput,
  Animated,
} from 'react-native';

import { VibraColors, VibraSpacing } from '../../constants/VibraColors';
import { Ionicons } from '../Icons';

interface ChatInputProps {
  onSendMessage: (message: string) => Promise<void>;
  isSending?: boolean;
  disabled?: boolean;
  placeholder?: string;
  placeholderTextColor?: string;
  maxLength?: number;
  footerText?: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  isSending = false,
  disabled = false,
  placeholder = 'Continue your conversation...',
  placeholderTextColor = 'rgba(255, 255, 255, 0.5)',
  maxLength = 500,
  footerText = 'VibraCoder never makes mistakes. Like the other ones do.',
}) => {
  const [inputText, setInputText] = useState('');
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const animatedBottom = useState(new Animated.Value(0))[0];

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setIsKeyboardVisible(true);
      Animated.timing(animatedBottom, {
        toValue: 125,
        duration: 250,
        useNativeDriver: false,
      }).start();
    });

    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setIsKeyboardVisible(false);
      Animated.timing(animatedBottom, {
        toValue: 0,
        duration: 250,
        useNativeDriver: false,
      }).start();
    });

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, [animatedBottom]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || isSending || disabled) return;

    try {
      await onSendMessage(inputText.trim());
      setInputText(''); // Clear input after successful send
    } catch (error) {
      console.error('❌ Error sending message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    }
  };

  const isInputDisabled = !inputText.trim() || isSending || disabled;
  const hasText = inputText.trim().length > 0;
  const showSendButton = hasText && isKeyboardVisible;

  return (
    <Animated.View style={[styles.inputContainer, { bottom: animatedBottom }]}>
      <View style={[styles.inputWrapper, isKeyboardVisible && styles.inputWrapperKeyboard]}>
        {isKeyboardVisible && (
          <>
            {/* Settings icon on left */}
            <TouchableOpacity style={styles.iconButton} activeOpacity={0.7}>
              <Settings size={20} color={VibraColors.neutral.text} />
            </TouchableOpacity>

            {/* Image icon (disabled, coming soon) */}
            <TouchableOpacity
              style={[styles.iconButton, styles.iconButtonDisabled]}
              activeOpacity={0.5}
              disabled>
              <ImageIcon size={20} color={VibraColors.neutral.textSecondary} />
            </TouchableOpacity>
          </>
        )}

        <View style={styles.textInputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder={placeholder}
            placeholderTextColor={placeholderTextColor}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={maxLength}
            textAlignVertical="center"
            editable={!disabled}
            returnKeyType="send"
            onSubmitEditing={handleSendMessage}
            blurOnSubmit={false}
          />
        </View>

        {isKeyboardVisible ? (
          // When keyboard is open: show send button if text exists, otherwise mic
          showSendButton ? (
            <TouchableOpacity
              style={styles.iconButton}
              onPress={handleSendMessage}
              disabled={isInputDisabled}
              activeOpacity={0.8}>
              <Send
                size={20}
                color={hasText ? VibraColors.neutral.text : VibraColors.neutral.textSecondary}
              />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.iconButton} activeOpacity={0.7}>
              <Mic size={20} color={VibraColors.neutral.text} />
            </TouchableOpacity>
          )
        ) : (
          // When keyboard is closed: show original send button
          <TouchableOpacity
            style={[styles.sendButton, isInputDisabled && styles.sendButtonDisabled]}
            onPress={handleSendMessage}
            disabled={isInputDisabled}
            activeOpacity={0.8}>
            <LinearGradient
              colors={
                isInputDisabled
                  ? ['#666666', '#555555']
                  : [VibraColors.neutral.text, VibraColors.neutral.textSecondary]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.sendButtonGradient}>
              <Ionicons name={isSending ? 'hourglass' : 'send'} size={20} color="#000000" />
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  inputContainer: {
    position: 'absolute',
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    zIndex: 10,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: VibraColors.neutral.backgroundTertiary,
    borderRadius: 20,
    paddingHorizontal: VibraSpacing.lg,
    paddingVertical: VibraSpacing.sm,
    marginBottom: VibraSpacing.sm,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    minHeight: 48,
  },
  inputWrapperKeyboard: {
    paddingHorizontal: VibraSpacing.sm,
    gap: VibraSpacing.xs,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  iconButtonDisabled: {
    opacity: 0.5,
  },
  textInputContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: VibraSpacing.sm,
  },
  textInput: {
    flex: 1,
    color: VibraColors.neutral.text,
    fontSize: 16,
    maxHeight: 60,
    marginRight: VibraSpacing.md,
    textAlign: 'left',
    width: '100%',
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: VibraSpacing.sm,
    lineHeight: 22,
    fontWeight: '400',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
  },
  sendButtonGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
  },
  sendButtonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  footerText: {
    color: VibraColors.neutral.textSecondary,
    fontSize: 11,
    fontWeight: '300',
    textAlign: 'center',
    opacity: 0.7,
    letterSpacing: 0.5,
  },
});

export default ChatInput;
