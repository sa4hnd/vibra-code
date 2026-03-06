// Copyright 2015-present 650 Industries. All rights reserved.

#import "EXVoiceRecordingModule.h"
#import "EXAudioRecorderService.h"
#import "EXAssemblyAIService.h"

@implementation EXVoiceRecordingModule

RCT_EXPORT_MODULE(VoiceRecordingModule);

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

- (NSArray<NSString *> *)supportedEvents {
  return @[@"onMeteringUpdate", @"onRecordingStateChange"];
}

#pragma mark - Recording Methods

RCT_EXPORT_METHOD(startRecording:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  __weak typeof(self) weakSelf = self;

  [[EXAudioRecorderService sharedInstance]
      startRecordingWithMeteringCallback:^(float level) {
        __strong typeof(weakSelf) strongSelf = weakSelf;
        if (strongSelf && strongSelf.bridge) {
          [strongSelf sendEventWithName:@"onMeteringUpdate"
                                   body:@{@"level": @(level)}];
        }
      }
      completion:^(NSError * _Nullable error) {
        if (error) {
          reject(@"RECORDING_ERROR", error.localizedDescription, error);
        } else {
          resolve(@YES);
        }
      }];
}

RCT_EXPORT_METHOD(stopRecordingAndTranscribe:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  [[EXAudioRecorderService sharedInstance]
      stopRecordingWithCompletion:^(NSURL * _Nullable audioURL, NSError * _Nullable error) {
        if (error || !audioURL) {
          reject(@"RECORDING_ERROR",
                 error.localizedDescription ?: @"Failed to stop recording",
                 error);
          return;
        }

        // Transcribe the audio file
        [[EXAssemblyAIService sharedInstance]
            transcribeAudioFile:audioURL
            completion:^(NSString * _Nullable text, NSError * _Nullable transcribeError) {
              // Clean up audio file
              [[NSFileManager defaultManager] removeItemAtURL:audioURL error:nil];

              if (transcribeError) {
                if (transcribeError.code == 31) {
                  // No speech detected
                  reject(@"NO_SPEECH", @"No speech detected", transcribeError);
                } else {
                  reject(@"TRANSCRIPTION_ERROR",
                         transcribeError.localizedDescription,
                         transcribeError);
                }
              } else if (text && text.length > 0) {
                resolve(text);
              } else {
                reject(@"NO_SPEECH", @"No speech detected", nil);
              }
            }];
      }];
}

RCT_EXPORT_METHOD(cancelRecording) {
  [[EXAudioRecorderService sharedInstance] cancelRecording];
  [[EXAssemblyAIService sharedInstance] cancelTranscription];
}

RCT_EXPORT_METHOD(isRecording:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  BOOL isRecording = [[EXAudioRecorderService sharedInstance] isRecording];
  resolve(@(isRecording));
}

@end
