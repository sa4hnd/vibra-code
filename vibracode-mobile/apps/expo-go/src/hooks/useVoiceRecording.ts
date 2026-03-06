import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform, Alert, Linking } from 'react-native';

import { VoiceRecording, MeteringEvent } from '../native/VoiceRecordingModule';

interface UseVoiceRecordingReturn {
  /** Whether audio is currently being recorded */
  isRecording: boolean;
  /** Whether recorded audio is being transcribed */
  isTranscribing: boolean;
  /** Current audio level (0.0 - 1.0) for waveform visualization */
  audioLevel: number;
  /** Recording duration in seconds */
  duration: number;
  /** Start voice recording */
  startRecording: () => Promise<void>;
  /** Stop recording and transcribe, returns transcribed text or null */
  stopRecording: () => Promise<string | null>;
  /** Cancel recording without transcribing */
  cancelRecording: () => void;
  /** Whether voice recording is supported on this platform */
  isSupported: boolean;
}

/**
 * Hook for voice recording and transcription functionality.
 * Uses native EXAudioRecorderService and EXAssemblyAIService on iOS.
 */
export function useVoiceRecording(): UseVoiceRecordingReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [duration, setDuration] = useState(0);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // Subscribe to metering events
  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    const subscription = VoiceRecording.addMeteringListener((event: MeteringEvent) => {
      setAudioLevel(event.level);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
      }
      // Cancel any ongoing recording if component unmounts
      VoiceRecording.cancelRecording();
    };
  }, []);

  const startRecording = useCallback(async () => {
    if (!VoiceRecording.isSupported()) {
      Alert.alert('Not Available', 'Voice recording is only available on iOS devices.', [
        { text: 'OK' },
      ]);
      return;
    }

    if (isRecording || isTranscribing) {
      return;
    }

    try {
      await VoiceRecording.startRecording();
      setIsRecording(true);
      setDuration(0);
      startTimeRef.current = Date.now();

      // Start duration timer
      durationTimerRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        setDuration(elapsed);
      }, 100);
    } catch (error: any) {
      if (error.message?.toLowerCase().includes('permission')) {
        Alert.alert(
          'Microphone Access Required',
          'Please enable microphone access in Settings to use voice input.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => Linking.openSettings(),
            },
          ]
        );
      } else {
        Alert.alert(
          'Recording Error',
          error.message || 'Failed to start recording. Please try again.',
          [{ text: 'OK' }]
        );
      }
    }
  }, [isRecording, isTranscribing]);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    if (!isRecording) {
      return null;
    }

    // Stop duration timer
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }

    setIsRecording(false);
    setIsTranscribing(true);
    setAudioLevel(0);

    try {
      const transcribedText = await VoiceRecording.stopRecordingAndTranscribe();
      setDuration(0);
      return transcribedText;
    } catch (error: any) {
      if (error.code === 'NO_SPEECH') {
        Alert.alert(
          'No Speech Detected',
          'Please try speaking louder or closer to the microphone.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Transcription Error',
          error.message || 'Failed to transcribe audio. Please try again.',
          [{ text: 'OK' }]
        );
      }
      return null;
    } finally {
      setIsTranscribing(false);
    }
  }, [isRecording]);

  const cancelRecording = useCallback(() => {
    // Stop duration timer
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }

    VoiceRecording.cancelRecording();
    setIsRecording(false);
    setIsTranscribing(false);
    setAudioLevel(0);
    setDuration(0);
  }, []);

  return {
    isRecording,
    isTranscribing,
    audioLevel,
    duration,
    startRecording,
    stopRecording,
    cancelRecording,
    isSupported: VoiceRecording.isSupported(),
  };
}

export default useVoiceRecording;
