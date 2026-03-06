// Copyright 2015-present 650 Industries. All rights reserved.

#import "EXAudioRecorderService.h"

@interface EXAudioRecorderService () <AVAudioRecorderDelegate>

@property (nonatomic, strong) AVAudioRecorder *audioRecorder;
@property (nonatomic, strong) AVAudioSession *audioSession;
@property (nonatomic, strong) NSURL *recordingURL;
@property (nonatomic, assign) BOOL isRecording;
@property (nonatomic, strong) NSTimer *meteringTimer;
@property (nonatomic, copy) void (^meteringCallback)(float level);
@property (nonatomic, copy) void (^stopCompletion)(NSURL * _Nullable audioURL, NSError * _Nullable error);

@end

@implementation EXAudioRecorderService

#pragma mark - Singleton

+ (instancetype)sharedInstance {
  static EXAudioRecorderService *sharedInstance = nil;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    sharedInstance = [[EXAudioRecorderService alloc] init];
  });
  return sharedInstance;
}

- (instancetype)init {
  self = [super init];
  if (self) {
    _isRecording = NO;
    _audioSession = [AVAudioSession sharedInstance];
  }
  return self;
}

#pragma mark - Recording

- (void)startRecordingWithMeteringCallback:(void (^)(float level))meteringCallback
                                completion:(void (^)(NSError * _Nullable error))completion {
  if (self.isRecording) {
    if (completion) {
      NSError *error = [NSError errorWithDomain:@"EXAudioRecorderService"
                                           code:1
                                       userInfo:@{NSLocalizedDescriptionKey: @"Already recording"}];
      completion(error);
    }
    return;
  }

  self.meteringCallback = meteringCallback;

  // Request microphone permission
  [self.audioSession requestRecordPermission:^(BOOL granted) {
    dispatch_async(dispatch_get_main_queue(), ^{
      if (!granted) {
        if (completion) {
          NSError *error = [NSError errorWithDomain:@"EXAudioRecorderService"
                                               code:2
                                           userInfo:@{NSLocalizedDescriptionKey: @"Microphone permission denied"}];
          completion(error);
        }
        return;
      }

      [self setupAndStartRecordingWithCompletion:completion];
    });
  }];
}

- (void)setupAndStartRecordingWithCompletion:(void (^)(NSError * _Nullable error))completion {
  NSError *sessionError = nil;

  // Configure audio session for recording
  [self.audioSession setCategory:AVAudioSessionCategoryPlayAndRecord
                     withOptions:AVAudioSessionCategoryOptionDefaultToSpeaker
                           error:&sessionError];
  if (sessionError) {
    NSLog(@"[AudioRecorder] Failed to set audio session category: %@", sessionError);
    if (completion) {
      completion(sessionError);
    }
    return;
  }

  [self.audioSession setActive:YES error:&sessionError];
  if (sessionError) {
    NSLog(@"[AudioRecorder] Failed to activate audio session: %@", sessionError);
    if (completion) {
      completion(sessionError);
    }
    return;
  }

  // Create temp file URL for recording
  NSString *tempDir = NSTemporaryDirectory();
  NSString *fileName = [NSString stringWithFormat:@"voice_recording_%@.wav", [[NSUUID UUID] UUIDString]];
  self.recordingURL = [NSURL fileURLWithPath:[tempDir stringByAppendingPathComponent:fileName]];

  // Audio settings optimized for AssemblyAI (16kHz, mono, 16-bit PCM)
  NSDictionary *recordSettings = @{
    AVFormatIDKey: @(kAudioFormatLinearPCM),
    AVSampleRateKey: @16000.0,
    AVNumberOfChannelsKey: @1,
    AVLinearPCMBitDepthKey: @16,
    AVLinearPCMIsFloatKey: @NO,
    AVLinearPCMIsBigEndianKey: @NO,
    AVEncoderAudioQualityKey: @(AVAudioQualityHigh)
  };

  NSError *recorderError = nil;
  self.audioRecorder = [[AVAudioRecorder alloc] initWithURL:self.recordingURL
                                                   settings:recordSettings
                                                      error:&recorderError];

  if (recorderError || !self.audioRecorder) {
    NSLog(@"[AudioRecorder] Failed to create recorder: %@", recorderError);
    if (completion) {
      completion(recorderError ?: [NSError errorWithDomain:@"EXAudioRecorderService"
                                                      code:3
                                                  userInfo:@{NSLocalizedDescriptionKey: @"Failed to create audio recorder"}]);
    }
    return;
  }

  self.audioRecorder.delegate = self;
  self.audioRecorder.meteringEnabled = YES;

  if ([self.audioRecorder prepareToRecord] && [self.audioRecorder record]) {
    self.isRecording = YES;
    NSLog(@"[AudioRecorder] Recording started");

    // Start metering timer for waveform updates (60 FPS)
    self.meteringTimer = [NSTimer scheduledTimerWithTimeInterval:1.0/60.0
                                                          target:self
                                                        selector:@selector(updateMetering)
                                                        userInfo:nil
                                                         repeats:YES];

    if (completion) {
      completion(nil);
    }
  } else {
    NSLog(@"[AudioRecorder] Failed to start recording");
    if (completion) {
      NSError *error = [NSError errorWithDomain:@"EXAudioRecorderService"
                                           code:4
                                       userInfo:@{NSLocalizedDescriptionKey: @"Failed to start recording"}];
      completion(error);
    }
  }
}

- (void)stopRecordingWithCompletion:(void (^)(NSURL * _Nullable audioURL, NSError * _Nullable error))completion {
  if (!self.isRecording) {
    if (completion) {
      NSError *error = [NSError errorWithDomain:@"EXAudioRecorderService"
                                           code:5
                                       userInfo:@{NSLocalizedDescriptionKey: @"Not currently recording"}];
      completion(nil, error);
    }
    return;
  }

  self.stopCompletion = completion;

  // Stop metering timer
  [self.meteringTimer invalidate];
  self.meteringTimer = nil;
  self.meteringCallback = nil;

  // Stop recording
  [self.audioRecorder stop];
  self.isRecording = NO;

  NSLog(@"[AudioRecorder] Recording stopped");
}

- (void)cancelRecording {
  if (!self.isRecording && !self.audioRecorder) {
    return;
  }

  // Stop metering timer
  [self.meteringTimer invalidate];
  self.meteringTimer = nil;
  self.meteringCallback = nil;

  // Stop and delete recording
  [self.audioRecorder stop];
  [self.audioRecorder deleteRecording];

  self.isRecording = NO;
  self.audioRecorder = nil;
  self.recordingURL = nil;
  self.stopCompletion = nil;

  // Deactivate audio session
  NSError *error = nil;
  [self.audioSession setActive:NO withOptions:AVAudioSessionSetActiveOptionNotifyOthersOnDeactivation error:&error];

  NSLog(@"[AudioRecorder] Recording cancelled");
}

#pragma mark - Metering

- (void)updateMetering {
  if (!self.isRecording || !self.audioRecorder) {
    return;
  }

  [self.audioRecorder updateMeters];

  // Get average power for channel 0
  float averagePower = [self.audioRecorder averagePowerForChannel:0];

  // Convert dB to normalized value (0.0 - 1.0)
  // averagePower is typically -160 (silence) to 0 (max)
  // We'll normalize -60 to 0 range for better sensitivity
  float normalizedLevel = (averagePower + 60.0) / 60.0;
  normalizedLevel = MAX(0.0, MIN(1.0, normalizedLevel));

  // Apply some smoothing/scaling for better visual effect
  normalizedLevel = powf(normalizedLevel, 0.5); // Square root for more dynamic range

  if (self.meteringCallback) {
    self.meteringCallback(normalizedLevel);
  }
}

#pragma mark - AVAudioRecorderDelegate

- (void)audioRecorderDidFinishRecording:(AVAudioRecorder *)recorder successfully:(BOOL)flag {
  NSLog(@"[AudioRecorder] Finished recording, success: %@", flag ? @"YES" : @"NO");

  // Deactivate audio session
  NSError *error = nil;
  [self.audioSession setActive:NO withOptions:AVAudioSessionSetActiveOptionNotifyOthersOnDeactivation error:&error];

  if (self.stopCompletion) {
    if (flag && self.recordingURL) {
      self.stopCompletion(self.recordingURL, nil);
    } else {
      NSError *recordError = [NSError errorWithDomain:@"EXAudioRecorderService"
                                                 code:6
                                             userInfo:@{NSLocalizedDescriptionKey: @"Recording failed"}];
      self.stopCompletion(nil, recordError);
    }
    self.stopCompletion = nil;
  }

  self.audioRecorder = nil;
}

- (void)audioRecorderEncodeErrorDidOccur:(AVAudioRecorder *)recorder error:(NSError *)error {
  NSLog(@"[AudioRecorder] Encode error: %@", error);

  self.isRecording = NO;

  // Stop metering timer
  [self.meteringTimer invalidate];
  self.meteringTimer = nil;
  self.meteringCallback = nil;

  if (self.stopCompletion) {
    self.stopCompletion(nil, error);
    self.stopCompletion = nil;
  }

  self.audioRecorder = nil;
}

@end
