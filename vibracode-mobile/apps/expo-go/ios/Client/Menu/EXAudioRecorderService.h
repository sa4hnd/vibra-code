// Copyright 2015-present 650 Industries. All rights reserved.

#import <Foundation/Foundation.h>
#import <AVFoundation/AVFoundation.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * Audio recording service using AVFoundation.
 * Provides recording functionality with metering for waveform visualization.
 */
@interface EXAudioRecorderService : NSObject

/**
 * Shared singleton instance.
 */
+ (instancetype)sharedInstance;

/**
 * Whether the service is currently recording.
 */
@property (nonatomic, readonly) BOOL isRecording;

/**
 * Start recording audio with metering callback for waveform updates.
 *
 * @param meteringCallback Called periodically with normalized audio level (0.0 - 1.0)
 * @param completion Called when recording starts or fails
 */
- (void)startRecordingWithMeteringCallback:(void (^)(float level))meteringCallback
                                completion:(void (^)(NSError * _Nullable error))completion;

/**
 * Stop recording and return the audio file URL.
 *
 * @param completion Called with the recorded audio file URL or error
 */
- (void)stopRecordingWithCompletion:(void (^)(NSURL * _Nullable audioURL, NSError * _Nullable error))completion;

/**
 * Cancel the current recording without saving.
 */
- (void)cancelRecording;

@end

NS_ASSUME_NONNULL_END
