// Copyright 2015-present 650 Industries. All rights reserved.

#import "EXAssemblyAIService.h"

static NSString *const kAssemblyAIAPIKey = @""; // Set your AssemblyAI API key here, or load from environment
static NSString *const kAssemblyAIBaseURL = @"https://api.assemblyai.com";
static NSTimeInterval const kPollingInterval = 1.0; // Poll every 1 second
static NSTimeInterval const kMaxPollingTime = 120.0; // Max 2 minutes

@interface EXAssemblyAIService ()

@property (nonatomic, strong) NSURLSession *urlSession;
@property (nonatomic, strong) NSURLSessionDataTask *currentTask;
@property (nonatomic, strong) NSTimer *pollingTimer;
@property (nonatomic, assign) BOOL isCancelled;
@property (nonatomic, assign) NSTimeInterval pollingStartTime;

@end

@implementation EXAssemblyAIService

#pragma mark - Singleton

+ (instancetype)sharedInstance {
  static EXAssemblyAIService *sharedInstance = nil;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    sharedInstance = [[EXAssemblyAIService alloc] init];
  });
  return sharedInstance;
}

- (instancetype)init {
  self = [super init];
  if (self) {
    NSURLSessionConfiguration *config = [NSURLSessionConfiguration defaultSessionConfiguration];
    config.timeoutIntervalForRequest = 60.0;
    config.timeoutIntervalForResource = 180.0;
    _urlSession = [NSURLSession sessionWithConfiguration:config];
    _isCancelled = NO;
  }
  return self;
}

#pragma mark - Public API

- (void)transcribeAudioFile:(NSURL *)fileURL
                 completion:(void (^)(NSString * _Nullable transcribedText, NSError * _Nullable error))completion {
  self.isCancelled = NO;

  NSLog(@"[AssemblyAI] Starting transcription for: %@", fileURL.lastPathComponent);

  // Step 1: Upload audio file
  [self uploadAudioFile:fileURL completion:^(NSString * _Nullable uploadURL, NSError * _Nullable uploadError) {
    if (self.isCancelled) {
      return;
    }

    if (uploadError || !uploadURL) {
      NSLog(@"[AssemblyAI] Upload failed: %@", uploadError);
      if (completion) {
        dispatch_async(dispatch_get_main_queue(), ^{
          completion(nil, uploadError ?: [self errorWithCode:1 message:@"Failed to upload audio"]);
        });
      }
      return;
    }

    NSLog(@"[AssemblyAI] Upload successful: %@", uploadURL);

    // Step 2: Request transcription
    [self requestTranscriptionForURL:uploadURL completion:^(NSString * _Nullable transcriptId, NSError * _Nullable requestError) {
      if (self.isCancelled) {
        return;
      }

      if (requestError || !transcriptId) {
        NSLog(@"[AssemblyAI] Transcription request failed: %@", requestError);
        if (completion) {
          dispatch_async(dispatch_get_main_queue(), ^{
            completion(nil, requestError ?: [self errorWithCode:2 message:@"Failed to request transcription"]);
          });
        }
        return;
      }

      NSLog(@"[AssemblyAI] Transcription requested, ID: %@", transcriptId);

      // Step 3: Poll for result
      [self pollForTranscriptResult:transcriptId completion:completion];
    }];
  }];
}

- (void)cancelTranscription {
  self.isCancelled = YES;

  [self.currentTask cancel];
  self.currentTask = nil;

  [self.pollingTimer invalidate];
  self.pollingTimer = nil;

  NSLog(@"[AssemblyAI] Transcription cancelled");
}

#pragma mark - Upload

- (void)uploadAudioFile:(NSURL *)fileURL
             completion:(void (^)(NSString * _Nullable uploadURL, NSError * _Nullable error))completion {
  NSData *audioData = [NSData dataWithContentsOfURL:fileURL];
  if (!audioData) {
    if (completion) {
      completion(nil, [self errorWithCode:10 message:@"Failed to read audio file"]);
    }
    return;
  }

  NSLog(@"[AssemblyAI] Uploading audio file (%lu bytes)", (unsigned long)audioData.length);

  NSString *uploadURLString = [NSString stringWithFormat:@"%@/v2/upload", kAssemblyAIBaseURL];
  NSURL *url = [NSURL URLWithString:uploadURLString];

  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
  request.HTTPMethod = @"POST";
  [request setValue:kAssemblyAIAPIKey forHTTPHeaderField:@"authorization"];
  [request setValue:@"application/octet-stream" forHTTPHeaderField:@"Content-Type"];
  request.HTTPBody = audioData;

  self.currentTask = [self.urlSession dataTaskWithRequest:request
                                        completionHandler:^(NSData * _Nullable data,
                                                            NSURLResponse * _Nullable response,
                                                            NSError * _Nullable error) {
    if (error) {
      if (completion) {
        completion(nil, error);
      }
      return;
    }

    NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *)response;
    if (httpResponse.statusCode != 200) {
      NSString *message = [NSString stringWithFormat:@"Upload failed with status %ld", (long)httpResponse.statusCode];
      if (completion) {
        completion(nil, [self errorWithCode:11 message:message]);
      }
      return;
    }

    NSError *jsonError = nil;
    NSDictionary *json = [NSJSONSerialization JSONObjectWithData:data options:0 error:&jsonError];
    if (jsonError || !json[@"upload_url"]) {
      if (completion) {
        completion(nil, jsonError ?: [self errorWithCode:12 message:@"Invalid upload response"]);
      }
      return;
    }

    if (completion) {
      completion(json[@"upload_url"], nil);
    }
  }];

  [self.currentTask resume];
}

#pragma mark - Transcription Request

- (void)requestTranscriptionForURL:(NSString *)audioURL
                        completion:(void (^)(NSString * _Nullable transcriptId, NSError * _Nullable error))completion {
  NSLog(@"[AssemblyAI] Requesting transcription");

  NSString *transcriptURLString = [NSString stringWithFormat:@"%@/v2/transcript", kAssemblyAIBaseURL];
  NSURL *url = [NSURL URLWithString:transcriptURLString];

  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
  request.HTTPMethod = @"POST";
  [request setValue:kAssemblyAIAPIKey forHTTPHeaderField:@"authorization"];
  [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];

  NSDictionary *body = @{@"audio_url": audioURL};
  NSError *jsonError = nil;
  request.HTTPBody = [NSJSONSerialization dataWithJSONObject:body options:0 error:&jsonError];

  if (jsonError) {
    if (completion) {
      completion(nil, jsonError);
    }
    return;
  }

  self.currentTask = [self.urlSession dataTaskWithRequest:request
                                        completionHandler:^(NSData * _Nullable data,
                                                            NSURLResponse * _Nullable response,
                                                            NSError * _Nullable error) {
    if (error) {
      if (completion) {
        completion(nil, error);
      }
      return;
    }

    NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *)response;
    if (httpResponse.statusCode != 200) {
      NSString *message = [NSString stringWithFormat:@"Transcription request failed with status %ld", (long)httpResponse.statusCode];
      if (completion) {
        completion(nil, [self errorWithCode:20 message:message]);
      }
      return;
    }

    NSError *parseError = nil;
    NSDictionary *json = [NSJSONSerialization JSONObjectWithData:data options:0 error:&parseError];
    if (parseError || !json[@"id"]) {
      if (completion) {
        completion(nil, parseError ?: [self errorWithCode:21 message:@"Invalid transcription response"]);
      }
      return;
    }

    if (completion) {
      completion(json[@"id"], nil);
    }
  }];

  [self.currentTask resume];
}

#pragma mark - Polling

- (void)pollForTranscriptResult:(NSString *)transcriptId
                     completion:(void (^)(NSString * _Nullable transcribedText, NSError * _Nullable error))completion {
  self.pollingStartTime = [[NSDate date] timeIntervalSince1970];

  [self checkTranscriptStatus:transcriptId completion:completion];
}

- (void)checkTranscriptStatus:(NSString *)transcriptId
                   completion:(void (^)(NSString * _Nullable transcribedText, NSError * _Nullable error))completion {
  if (self.isCancelled) {
    return;
  }

  // Check for timeout
  NSTimeInterval elapsed = [[NSDate date] timeIntervalSince1970] - self.pollingStartTime;
  if (elapsed > kMaxPollingTime) {
    NSLog(@"[AssemblyAI] Polling timeout after %.0f seconds", elapsed);
    if (completion) {
      dispatch_async(dispatch_get_main_queue(), ^{
        completion(nil, [self errorWithCode:30 message:@"Transcription timed out"]);
      });
    }
    return;
  }

  NSLog(@"[AssemblyAI] Polling for transcript status (%.0f seconds elapsed)", elapsed);

  NSString *statusURLString = [NSString stringWithFormat:@"%@/v2/transcript/%@", kAssemblyAIBaseURL, transcriptId];
  NSURL *url = [NSURL URLWithString:statusURLString];

  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
  request.HTTPMethod = @"GET";
  [request setValue:kAssemblyAIAPIKey forHTTPHeaderField:@"authorization"];

  self.currentTask = [self.urlSession dataTaskWithRequest:request
                                        completionHandler:^(NSData * _Nullable data,
                                                            NSURLResponse * _Nullable response,
                                                            NSError * _Nullable error) {
    if (self.isCancelled) {
      return;
    }

    if (error) {
      if (completion) {
        dispatch_async(dispatch_get_main_queue(), ^{
          completion(nil, error);
        });
      }
      return;
    }

    NSError *parseError = nil;
    NSDictionary *json = [NSJSONSerialization JSONObjectWithData:data options:0 error:&parseError];
    if (parseError) {
      if (completion) {
        dispatch_async(dispatch_get_main_queue(), ^{
          completion(nil, parseError);
        });
      }
      return;
    }

    NSString *status = json[@"status"];
    NSLog(@"[AssemblyAI] Transcript status: %@", status);

    if ([status isEqualToString:@"completed"]) {
      NSString *text = json[@"text"];
      NSLog(@"[AssemblyAI] Transcription completed: %@", text ?: @"(empty)");

      if (completion) {
        dispatch_async(dispatch_get_main_queue(), ^{
          if (text && text.length > 0) {
            completion(text, nil);
          } else {
            completion(nil, [self errorWithCode:31 message:@"No speech detected"]);
          }
        });
      }
    } else if ([status isEqualToString:@"error"]) {
      NSString *errorMessage = json[@"error"] ?: @"Unknown transcription error";
      NSLog(@"[AssemblyAI] Transcription error: %@", errorMessage);

      if (completion) {
        dispatch_async(dispatch_get_main_queue(), ^{
          completion(nil, [self errorWithCode:32 message:errorMessage]);
        });
      }
    } else {
      // Still processing, poll again after delay
      dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(kPollingInterval * NSEC_PER_SEC)),
                     dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
        [self checkTranscriptStatus:transcriptId completion:completion];
      });
    }
  }];

  [self.currentTask resume];
}

#pragma mark - Helpers

- (NSError *)errorWithCode:(NSInteger)code message:(NSString *)message {
  return [NSError errorWithDomain:@"EXAssemblyAIService"
                             code:code
                         userInfo:@{NSLocalizedDescriptionKey: message}];
}

@end
