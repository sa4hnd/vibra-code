// Copyright 2015-present 650 Industries. All rights reserved.

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * AssemblyAI API service for speech-to-text transcription.
 */
@interface EXAssemblyAIService : NSObject

/**
 * Shared singleton instance.
 */
+ (instancetype)sharedInstance;

/**
 * Transcribe an audio file using AssemblyAI.
 *
 * @param fileURL Local URL to the audio file
 * @param completion Called with the transcribed text or error
 */
- (void)transcribeAudioFile:(NSURL *)fileURL
                 completion:(void (^)(NSString * _Nullable transcribedText, NSError * _Nullable error))completion;

/**
 * Cancel any ongoing transcription request.
 */
- (void)cancelTranscription;

@end

NS_ASSUME_NONNULL_END
