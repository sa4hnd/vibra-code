// Copyright 2015-present 650 Industries. All rights reserved.

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * React Native bridge module for voice recording and transcription.
 * Exposes EXAudioRecorderService and EXAssemblyAIService to JavaScript.
 */
@interface EXVoiceRecordingModule : RCTEventEmitter <RCTBridgeModule>

@end

NS_ASSUME_NONNULL_END
