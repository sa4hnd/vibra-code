import { NativeModules, NativeEventEmitter, Platform, EmitterSubscription } from 'react-native';

const { VoiceRecordingModule } = NativeModules;

// Create event emitter only on iOS where the module exists
const voiceEventEmitter =
  Platform.OS === 'ios' && VoiceRecordingModule
    ? new NativeEventEmitter(VoiceRecordingModule)
    : null;

export interface MeteringEvent {
  level: number;
}

/**
 * Voice recording and transcription module interface.
 * Only available on iOS - uses native EXAudioRecorderService and EXAssemblyAIService.
 */
export const VoiceRecording = {
  /**
   * Start audio recording with real-time metering for waveform visualization.
   * @returns Promise that resolves to true when recording starts successfully
   * @throws Error if permission denied or recording fails to start
   */
  startRecording: (): Promise<boolean> => {
    if (Platform.OS !== 'ios') {
      return Promise.reject(new Error('Voice recording is only available on iOS'));
    }
    if (!VoiceRecordingModule) {
      return Promise.reject(new Error('VoiceRecordingModule is not available'));
    }
    return VoiceRecordingModule.startRecording();
  },

  /**
   * Stop recording and transcribe the audio using AssemblyAI.
   * @returns Promise that resolves to the transcribed text
   * @throws Error with code 'NO_SPEECH' if no speech detected
   * @throws Error with code 'TRANSCRIPTION_ERROR' if transcription fails
   */
  stopRecordingAndTranscribe: (): Promise<string> => {
    if (Platform.OS !== 'ios') {
      return Promise.reject(new Error('Voice recording is only available on iOS'));
    }
    if (!VoiceRecordingModule) {
      return Promise.reject(new Error('VoiceRecordingModule is not available'));
    }
    return VoiceRecordingModule.stopRecordingAndTranscribe();
  },

  /**
   * Cancel any ongoing recording and transcription.
   */
  cancelRecording: (): void => {
    if (Platform.OS === 'ios' && VoiceRecordingModule) {
      VoiceRecordingModule.cancelRecording();
    }
  },

  /**
   * Check if currently recording.
   * @returns Promise that resolves to true if recording is in progress
   */
  isRecording: (): Promise<boolean> => {
    if (Platform.OS !== 'ios' || !VoiceRecordingModule) {
      return Promise.resolve(false);
    }
    return VoiceRecordingModule.isRecording();
  },

  /**
   * Add a listener for audio metering updates during recording.
   * Called at ~60fps with normalized audio level (0.0 - 1.0) for waveform visualization.
   * @param callback Function called with metering event containing audio level
   * @returns Subscription that can be removed with .remove()
   */
  addMeteringListener: (
    callback: (event: MeteringEvent) => void
  ): EmitterSubscription | { remove: () => void } => {
    if (!voiceEventEmitter) {
      return { remove: () => {} };
    }
    return voiceEventEmitter.addListener('onMeteringUpdate', callback);
  },

  /**
   * Check if voice recording is supported on this platform.
   */
  isSupported: (): boolean => {
    return Platform.OS === 'ios' && !!VoiceRecordingModule;
  },
};

export default VoiceRecording;
