// Copyright 2015-present 650 Industries. All rights reserved.

#import "EXChatBackendService.h"
#import "EXEnvBridge.h"

@interface EXChatBackendService ()

@property (nonatomic, strong) NSURLSession *urlSession;

@end

@implementation EXChatBackendService

+ (instancetype)sharedInstance
{
  static EXChatBackendService *instance;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    instance = [[EXChatBackendService alloc] init];
  });
  return instance;
}

- (instancetype)init
{
  if (self = [super init]) {
    NSURLSessionConfiguration *config = [NSURLSessionConfiguration defaultSessionConfiguration];
    config.timeoutIntervalForRequest = 30.0;
    config.timeoutIntervalForResource = 60.0;
    self.urlSession = [NSURLSession sessionWithConfiguration:config];
  }
  return self;
}

// Dynamic getters - always read fresh from NSUserDefaults (synced from .env via JS)
// This ensures EAS updates take effect without app restart
- (NSString *)convexUrl
{
  return [EXEnvBridge convexUrl];
}

- (NSString *)v0ApiUrl
{
  return [EXEnvBridge v0ApiUrl];
}

- (void)configureWithConvexUrl:(NSString *)convexUrl v0ApiUrl:(NSString *)v0ApiUrl
{
  // This method is now a no-op since we always read dynamically from EXEnvBridge
  // Kept for backward compatibility
  NSLog(@"⚠️ [EXChatBackendService] configureWithConvexUrl is deprecated - URLs are now read dynamically from .env");
}

- (void)findSessionByManifestUrl:(NSString *)manifestUrl completion:(EXChatBackendSessionCallback)completion
{
  if (!manifestUrl || manifestUrl.length == 0) {
    if (completion) {
      completion(nil, [NSError errorWithDomain:@"EXChatBackendService" code:400 userInfo:@{NSLocalizedDescriptionKey: @"Manifest URL is required"}]);
    }
    return;
  }

  // SECURITY: Extract sessionId from URL query params - this is the ONLY reliable method
  // URL matching is DISABLED because it can match wrong sessions (even within same user's projects)
  NSURLComponents *components = [NSURLComponents componentsWithString:manifestUrl];
  NSString *sessionIdFromUrl = nil;
  for (NSURLQueryItem *item in components.queryItems) {
    if ([item.name isEqualToString:@"sessionId"]) {
      sessionIdFromUrl = item.value;
      break;
    }
  }

  // SECURITY: sessionId in URL is REQUIRED - URL matching is completely disabled
  // This prevents: 1) Cross-user session leakage, 2) Wrong project within same user
  if (!sessionIdFromUrl || sessionIdFromUrl.length == 0) {
    NSLog(@"🔴 [SECURITY] BLOCKED: No sessionId in manifest URL");
    NSLog(@"   URL: %@", manifestUrl);
    NSLog(@"   URL matching is DISABLED for security. The project must include sessionId in URL.");
    if (completion) {
      // Return nil session (not an error) - the caller should handle gracefully
      completion(nil, nil);
    }
    return;
  }

  NSLog(@"✅ [SECURITY] Found sessionId in URL, using direct lookup: %@", sessionIdFromUrl);
  [self getSessionById:sessionIdFromUrl completion:completion];
}

- (void)listAllSessions:(void (^)(NSArray<NSDictionary *> * _Nullable, NSError * _Nullable))completion
{
  // Call Convex HTTP API: POST to /api/query
  // Convex HTTP API format: https://[deployment].convex.cloud/api/query with {"path": "sessions:list", "args": {}}
  NSString *urlString = [NSString stringWithFormat:@"%@/api/query", self.convexUrl];
  NSLog(@"🌐 Calling Convex API: %@", urlString);
  NSURL *url = [NSURL URLWithString:urlString];
  
  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
  request.HTTPMethod = @"POST";
  [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];
  
  // Convex HTTP API: send path and args in body
  NSDictionary *body = @{
    @"path": @"sessions:list",
    @"args": @{}
  };
  NSError *jsonError;
  NSData *jsonData = [NSJSONSerialization dataWithJSONObject:body options:0 error:&jsonError];
  if (jsonError) {
    if (completion) {
      completion(nil, jsonError);
    }
    return;
  }
  request.HTTPBody = jsonData;
  
  NSURLSessionDataTask *task = [self.urlSession dataTaskWithRequest:request completionHandler:^(NSData * _Nullable data, NSURLResponse * _Nullable response, NSError * _Nullable error) {
    if (error) {
      if (completion) {
        completion(nil, error);
      }
      return;
    }
    
    NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *)response;
    if (httpResponse.statusCode != 200) {
      NSError *httpError = [NSError errorWithDomain:@"EXChatBackendService" 
                                                code:httpResponse.statusCode 
                                            userInfo:@{NSLocalizedDescriptionKey: [NSString stringWithFormat:@"HTTP error: %ld", (long)httpResponse.statusCode]}];
      if (completion) {
        completion(nil, httpError);
      }
      return;
    }
    
    NSError *parseError;
    id jsonObject = [NSJSONSerialization JSONObjectWithData:data options:0 error:&parseError];
    if (parseError) {
      if (completion) {
        completion(nil, parseError);
      }
      return;
    }
    
    // Convex HTTP API returns: {"status": "success", "value": <data>} or {"status": "error", "errorMessage": "..."}
    if ([jsonObject isKindOfClass:[NSDictionary class]]) {
      NSDictionary *response = (NSDictionary *)jsonObject;
      NSString *status = response[@"status"];
      
      if ([status isEqualToString:@"error"]) {
        NSString *errorMessage = response[@"errorMessage"] ?: @"Unknown error";
        NSError *convexError = [NSError errorWithDomain:@"EXChatBackendService" 
                                                    code:500 
                                                userInfo:@{NSLocalizedDescriptionKey: errorMessage}];
        if (completion) {
          completion(nil, convexError);
        }
        return;
      }
      
      id value = response[@"value"];
      if ([value isKindOfClass:[NSArray class]]) {
        if (completion) {
          completion((NSArray *)value, nil);
        }
      } else {
        if (completion) {
          completion(nil, [NSError errorWithDomain:@"EXChatBackendService" code:500 userInfo:@{NSLocalizedDescriptionKey: @"Invalid response format: expected array in value field"}]);
        }
      }
    } else {
      if (completion) {
        completion(nil, [NSError errorWithDomain:@"EXChatBackendService" code:500 userInfo:@{NSLocalizedDescriptionKey: @"Invalid response format: expected dictionary"}]);
      }
    }
  }];
  
  [task resume];
}

- (void)listSessionsForClerkId:(NSString * _Nullable)clerkId
                    completion:(void (^)(NSArray<NSDictionary *> * _Nullable, NSError * _Nullable))completion
{
  // Call Convex HTTP API: POST to /api/query
  // Pass createdBy filter to only get this user's sessions (security: prevents cross-user session leakage)
  NSString *urlString = [NSString stringWithFormat:@"%@/api/query", self.convexUrl];
  NSLog(@"🌐 Calling Convex API with clerkId filter: %@ (clerkId: %@)", urlString, clerkId ?: @"none");
  NSURL *url = [NSURL URLWithString:urlString];

  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
  request.HTTPMethod = @"POST";
  [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];

  // Pass createdBy filter if clerkId available - backend returns empty array if no filter
  NSDictionary *args = clerkId ? @{@"createdBy": clerkId} : @{};
  NSDictionary *body = @{
    @"path": @"sessions:list",
    @"args": args
  };
  NSError *jsonError;
  NSData *jsonData = [NSJSONSerialization dataWithJSONObject:body options:0 error:&jsonError];
  if (jsonError) {
    if (completion) {
      completion(nil, jsonError);
    }
    return;
  }
  request.HTTPBody = jsonData;

  NSURLSessionDataTask *task = [self.urlSession dataTaskWithRequest:request completionHandler:^(NSData * _Nullable data, NSURLResponse * _Nullable response, NSError * _Nullable error) {
    if (error) {
      if (completion) {
        completion(nil, error);
      }
      return;
    }

    NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *)response;
    if (httpResponse.statusCode != 200) {
      NSError *httpError = [NSError errorWithDomain:@"EXChatBackendService"
                                                code:httpResponse.statusCode
                                            userInfo:@{NSLocalizedDescriptionKey: [NSString stringWithFormat:@"HTTP error: %ld", (long)httpResponse.statusCode]}];
      if (completion) {
        completion(nil, httpError);
      }
      return;
    }

    NSError *parseError;
    id jsonObject = [NSJSONSerialization JSONObjectWithData:data options:0 error:&parseError];
    if (parseError) {
      if (completion) {
        completion(nil, parseError);
      }
      return;
    }

    // Convex HTTP API returns: {"status": "success", "value": <data>} or {"status": "error", "errorMessage": "..."}
    if ([jsonObject isKindOfClass:[NSDictionary class]]) {
      NSDictionary *response = (NSDictionary *)jsonObject;
      NSString *status = response[@"status"];

      if ([status isEqualToString:@"error"]) {
        NSString *errorMessage = response[@"errorMessage"] ?: @"Unknown error";
        NSError *convexError = [NSError errorWithDomain:@"EXChatBackendService"
                                                    code:500
                                                userInfo:@{NSLocalizedDescriptionKey: errorMessage}];
        if (completion) {
          completion(nil, convexError);
        }
        return;
      }

      id value = response[@"value"];
      if ([value isKindOfClass:[NSArray class]]) {
        NSLog(@"✅ Received %lu sessions for clerkId: %@", (unsigned long)[(NSArray *)value count], clerkId ?: @"none");
        if (completion) {
          completion((NSArray *)value, nil);
        }
      } else {
        if (completion) {
          completion(nil, [NSError errorWithDomain:@"EXChatBackendService" code:500 userInfo:@{NSLocalizedDescriptionKey: @"Invalid response format: expected array in value field"}]);
        }
      }
    } else {
      if (completion) {
        completion(nil, [NSError errorWithDomain:@"EXChatBackendService" code:500 userInfo:@{NSLocalizedDescriptionKey: @"Invalid response format: expected dictionary"}]);
      }
    }
  }];

  [task resume];
}

- (void)getSessionById:(NSString *)sessionId completion:(EXChatBackendSessionCallback)completion
{
  if (!sessionId || sessionId.length == 0) {
    if (completion) {
      completion(nil, [NSError errorWithDomain:@"EXChatBackendService" code:400 userInfo:@{NSLocalizedDescriptionKey: @"Session ID is required"}]);
    }
    return;
  }

  // SECURITY: clerkId is REQUIRED for ownership verification - no anonymous access
  NSString *clerkId = [[NSUserDefaults standardUserDefaults] stringForKey:@"CLERK_USER_ID"];

  NSLog(@"🔐 [DEBUG] getSessionById checking auth - sessionId: %@, clerkId: %@", sessionId, clerkId ?: @"(nil)");

  if (!clerkId || clerkId.length == 0) {
    NSLog(@"🔴 [SECURITY] BLOCKED: Cannot lookup session without clerkId - user must be authenticated");
    NSLog(@"🔴 [DEBUG] CLERK_USER_ID not found in NSUserDefaults. Ensure VibraAuthContext has saved it.");
    if (completion) {
      completion(nil, [NSError errorWithDomain:@"EXChatBackendService"
                                          code:401
                                      userInfo:@{NSLocalizedDescriptionKey: @"Authentication required. Please sign in to access your projects."}]);
    }
    return;
  }

  NSLog(@"🔐 [SECURITY] getSessionById: %@ with clerkId: %@", sessionId, clerkId);

  // Call Convex query: POST to /api/query
  // SECURITY: ALWAYS pass createdBy to verify ownership on backend
  NSString *urlString = [NSString stringWithFormat:@"%@/api/query", self.convexUrl];
  NSURL *url = [NSURL URLWithString:urlString];

  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
  request.HTTPMethod = @"POST";
  [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];

  // SECURITY: createdBy is REQUIRED - backend will reject if ownership doesn't match
  NSDictionary *args = @{
    @"id": sessionId,
    @"createdBy": clerkId
  };

  NSDictionary *body = @{
    @"path": @"sessions:getById",
    @"args": args
  };
  NSError *jsonError;
  NSData *jsonData = [NSJSONSerialization dataWithJSONObject:body options:0 error:&jsonError];
  if (jsonError) {
    if (completion) {
      completion(nil, jsonError);
    }
    return;
  }
  request.HTTPBody = jsonData;

  NSURLSessionDataTask *task = [self.urlSession dataTaskWithRequest:request completionHandler:^(NSData * _Nullable data, NSURLResponse * _Nullable response, NSError * _Nullable error) {
    if (error) {
      if (completion) {
        completion(nil, error);
      }
      return;
    }

    NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *)response;
    if (httpResponse.statusCode != 200) {
      NSError *httpError = [NSError errorWithDomain:@"EXChatBackendService"
                                                code:httpResponse.statusCode
                                            userInfo:@{NSLocalizedDescriptionKey: [NSString stringWithFormat:@"HTTP error: %ld", (long)httpResponse.statusCode]}];
      if (completion) {
        completion(nil, httpError);
      }
      return;
    }

    NSError *parseError;
    id jsonObject = [NSJSONSerialization JSONObjectWithData:data options:0 error:&parseError];
    if (parseError) {
      if (completion) {
        completion(nil, parseError);
      }
      return;
    }

    // Convex HTTP API returns: {"status": "success", "value": <data>} or {"status": "error", "errorMessage": "..."}
    if ([jsonObject isKindOfClass:[NSDictionary class]]) {
      NSDictionary *response = (NSDictionary *)jsonObject;
      NSString *status = response[@"status"];

      if ([status isEqualToString:@"error"]) {
        NSString *errorMessage = response[@"errorMessage"] ?: @"Unknown error";
        NSError *convexError = [NSError errorWithDomain:@"EXChatBackendService"
                                                    code:500
                                                userInfo:@{NSLocalizedDescriptionKey: errorMessage}];
        if (completion) {
          completion(nil, convexError);
        }
        return;
      }

      id value = response[@"value"];
      if ([value isKindOfClass:[NSDictionary class]]) {
        NSDictionary *session = (NSDictionary *)value;

        // SECURITY: Defense-in-depth - ALWAYS verify ownership client-side too
        // This catches any case where backend verification was bypassed
        NSString *sessionCreatedBy = session[@"createdBy"];
        if (!sessionCreatedBy || ![sessionCreatedBy isEqualToString:clerkId]) {
          NSLog(@"🔴 [SECURITY] BLOCKED: Session ownership mismatch - session belongs to %@, user is %@",
                sessionCreatedBy ?: @"(unknown)", clerkId);
          if (completion) {
            completion(nil, [NSError errorWithDomain:@"EXChatBackendService"
                                                code:403
                                            userInfo:@{NSLocalizedDescriptionKey: @"Access denied: You don't own this project."}]);
          }
          return;
        }

        NSLog(@"✅ [SECURITY] Session ownership verified for: %@ (owner: %@)", sessionId, clerkId);
        if (completion) {
          completion(session, nil);
        }
      } else if (value == nil || [value isKindOfClass:[NSNull class]]) {
        // getById returned null - either session not found OR access denied by backend
        NSLog(@"⚠️ [SECURITY] Session not found or access denied: %@", sessionId);
        if (completion) {
          completion(nil, nil);
        }
      } else {
        if (completion) {
          completion(nil, [NSError errorWithDomain:@"EXChatBackendService" code:500 userInfo:@{NSLocalizedDescriptionKey: @"Invalid response format: expected dictionary in value field"}]);
        }
      }
    } else {
      if (completion) {
        completion(nil, [NSError errorWithDomain:@"EXChatBackendService" code:500 userInfo:@{NSLocalizedDescriptionKey: @"Invalid response format: expected dictionary"}]);
      }
    }
  }];

  [task resume];
}

- (void)fetchMessagesForSession:(NSString *)sessionId completion:(EXChatBackendMessagesCallback)completion
{
  if (!sessionId || sessionId.length == 0) {
    if (completion) {
      completion(nil, [NSError errorWithDomain:@"EXChatBackendService" code:400 userInfo:@{NSLocalizedDescriptionKey: @"Session ID is required"}]);
    }
    return;
  }
  
  // Call Convex query: POST to /api/query
  // Convex HTTP API format: https://[deployment].convex.cloud/api/query with {"path": "messages:getBySession", "args": {"sessionId": sessionId}}
  NSString *urlString = [NSString stringWithFormat:@"%@/api/query", self.convexUrl];
  NSURL *url = [NSURL URLWithString:urlString];
  
  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
  request.HTTPMethod = @"POST";
  [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];
  
  // Convex HTTP API: send path and args in body
  NSDictionary *body = @{
    @"path": @"messages:getBySession",
    @"args": @{@"sessionId": sessionId}
  };
  NSError *jsonError;
  NSData *jsonData = [NSJSONSerialization dataWithJSONObject:body options:0 error:&jsonError];
  if (jsonError) {
    if (completion) {
      completion(nil, jsonError);
    }
    return;
  }
  request.HTTPBody = jsonData;
  
  NSURLSessionDataTask *task = [self.urlSession dataTaskWithRequest:request completionHandler:^(NSData * _Nullable data, NSURLResponse * _Nullable response, NSError * _Nullable error) {
    if (error) {
      if (completion) {
        completion(nil, error);
      }
      return;
    }
    
    NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *)response;
    if (httpResponse.statusCode != 200) {
      NSError *httpError = [NSError errorWithDomain:@"EXChatBackendService" 
                                                code:httpResponse.statusCode 
                                            userInfo:@{NSLocalizedDescriptionKey: [NSString stringWithFormat:@"HTTP error: %ld", (long)httpResponse.statusCode]}];
      if (completion) {
        completion(nil, httpError);
      }
      return;
    }
    
    NSError *parseError;
    id jsonObject = [NSJSONSerialization JSONObjectWithData:data options:0 error:&parseError];
    if (parseError) {
      if (completion) {
        completion(nil, parseError);
      }
      return;
    }
    
    // Convex HTTP API returns: {"status": "success", "value": <data>} or {"status": "error", "errorMessage": "..."}
    if ([jsonObject isKindOfClass:[NSDictionary class]]) {
      NSDictionary *response = (NSDictionary *)jsonObject;
      NSString *status = response[@"status"];
      
      if ([status isEqualToString:@"error"]) {
        NSString *errorMessage = response[@"errorMessage"] ?: @"Unknown error";
        NSError *convexError = [NSError errorWithDomain:@"EXChatBackendService" 
                                                    code:500 
                                                userInfo:@{NSLocalizedDescriptionKey: errorMessage}];
        if (completion) {
          completion(nil, convexError);
        }
        return;
      }
      
      id value = response[@"value"];
      if ([value isKindOfClass:[NSArray class]]) {
        if (completion) {
          completion((NSArray *)value, nil);
        }
      } else {
        if (completion) {
          completion(nil, [NSError errorWithDomain:@"EXChatBackendService" code:500 userInfo:@{NSLocalizedDescriptionKey: @"Invalid response format: expected array in value field"}]);
        }
      }
    } else {
      if (completion) {
        completion(nil, [NSError errorWithDomain:@"EXChatBackendService" code:500 userInfo:@{NSLocalizedDescriptionKey: @"Invalid response format: expected dictionary"}]);
      }
    }
  }];
  
  [task resume];
}

- (void)sendMessageWithSessionId:(NSString *)sessionId
                             role:(NSString *)role
                          content:(NSString *)content
                       completion:(EXChatBackendMessageCallback)completion
{
  // Delegate to the version with image parameter
  [self sendMessageWithSessionId:sessionId role:role content:content image:nil completion:completion];
}

- (void)sendMessageWithSessionId:(NSString *)sessionId
                             role:(NSString *)role
                          content:(NSString *)content
                            image:(NSDictionary *)image
                       completion:(EXChatBackendMessageCallback)completion
{
  if (!sessionId || sessionId.length == 0) {
    if (completion) {
      completion(nil, [NSError errorWithDomain:@"EXChatBackendService" code:400 userInfo:@{NSLocalizedDescriptionKey: @"Session ID is required"}]);
    }
    return;
  }

  if (!role || !content) {
    if (completion) {
      completion(nil, [NSError errorWithDomain:@"EXChatBackendService" code:400 userInfo:@{NSLocalizedDescriptionKey: @"Role and content are required"}]);
    }
    return;
  }

  // Call Convex mutation: POST to /api/mutation
  // Convex HTTP API format: https://[deployment].convex.cloud/api/mutation with {"path": "messages:add", "args": {...}}
  NSString *urlString = [NSString stringWithFormat:@"%@/api/mutation", self.convexUrl];
  NSURL *url = [NSURL URLWithString:urlString];

  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
  request.HTTPMethod = @"POST";
  [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];

  // Build args dictionary
  NSMutableDictionary *args = [NSMutableDictionary dictionaryWithDictionary:@{
    @"sessionId": sessionId,
    @"role": role,
    @"content": content
  }];

  // Add image data if provided
  if (image) {
    // Validate image dictionary has required fields
    NSString *storageId = image[@"storageId"];
    NSString *fileName = image[@"fileName"];
    NSString *path = image[@"path"];

    NSLog(@"📤 [EXChatBackendService] Adding image to message:");
    NSLog(@"   - storageId: %@", storageId ?: @"(nil)");
    NSLog(@"   - fileName: %@", fileName ?: @"(nil)");
    NSLog(@"   - path: %@", path ?: @"(nil)");

    // Only add image if storageId is valid
    if (storageId && storageId.length > 0) {
      args[@"image"] = @{
        @"storageId": storageId,
        @"fileName": fileName ?: @"image.jpg",
        @"path": path ?: @""
      };
      NSLog(@"📤 [EXChatBackendService] Image data added to args");
    } else {
      NSLog(@"⚠️ [EXChatBackendService] Skipping image - no valid storageId");
    }
  }

  // Convex HTTP API: send path and args in body
  NSDictionary *body = @{
    @"path": @"messages:add",
    @"args": args
  };

  NSLog(@"📤 [EXChatBackendService] Sending message mutation:");
  NSLog(@"   - Full args: %@", args);
  NSError *jsonError;
  NSData *jsonData = [NSJSONSerialization dataWithJSONObject:body options:0 error:&jsonError];
  if (jsonError) {
    if (completion) {
      completion(nil, jsonError);
    }
    return;
  }
  request.HTTPBody = jsonData;

  NSURLSessionDataTask *task = [self.urlSession dataTaskWithRequest:request completionHandler:^(NSData * _Nullable data, NSURLResponse * _Nullable response, NSError * _Nullable error) {
    if (error) {
      if (completion) {
        completion(nil, error);
      }
      return;
    }

    NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *)response;
    if (httpResponse.statusCode != 200) {
      NSError *httpError = [NSError errorWithDomain:@"EXChatBackendService"
                                                code:httpResponse.statusCode
                                            userInfo:@{NSLocalizedDescriptionKey: [NSString stringWithFormat:@"HTTP error: %ld", (long)httpResponse.statusCode]}];
      if (completion) {
        completion(nil, httpError);
      }
      return;
    }

    NSError *parseError;
    id jsonObject = [NSJSONSerialization JSONObjectWithData:data options:0 error:&parseError];
    if (parseError) {
      if (completion) {
        completion(nil, parseError);
      }
      return;
    }

    // Convex HTTP API returns: {"status": "success", "value": <data>} or {"status": "error", "errorMessage": "..."}
    if ([jsonObject isKindOfClass:[NSDictionary class]]) {
      NSDictionary *response = (NSDictionary *)jsonObject;
      NSString *status = response[@"status"];

      if ([status isEqualToString:@"error"]) {
        NSString *errorMessage = response[@"errorMessage"] ?: @"Unknown error";
        NSError *convexError = [NSError errorWithDomain:@"EXChatBackendService"
                                                    code:500
                                                userInfo:@{NSLocalizedDescriptionKey: errorMessage}];
        if (completion) {
          completion(nil, convexError);
        }
        return;
      }

      id value = response[@"value"];
      // Response should be a message ID string
      if ([value isKindOfClass:[NSString class]]) {
        if (completion) {
          completion((NSString *)value, nil);
        }
      } else {
        if (completion) {
          completion(nil, [NSError errorWithDomain:@"EXChatBackendService" code:500 userInfo:@{NSLocalizedDescriptionKey: @"Invalid response format: expected string in value field"}]);
        }
      }
    } else {
      if (completion) {
        completion(nil, [NSError errorWithDomain:@"EXChatBackendService" code:500 userInfo:@{NSLocalizedDescriptionKey: @"Invalid response format: expected dictionary"}]);
      }
    }
  }];

  [task resume];
}

- (void)sendMessageWithSessionId:(NSString *)sessionId
                             role:(NSString *)role
                          content:(NSString *)content
                           images:(NSArray<NSDictionary *> *)images
                       completion:(EXChatBackendMessageCallback)completion
{
  if (!sessionId || sessionId.length == 0) {
    if (completion) {
      completion(nil, [NSError errorWithDomain:@"EXChatBackendService" code:400 userInfo:@{NSLocalizedDescriptionKey: @"Session ID is required"}]);
    }
    return;
  }

  if (!role || !content) {
    if (completion) {
      completion(nil, [NSError errorWithDomain:@"EXChatBackendService" code:400 userInfo:@{NSLocalizedDescriptionKey: @"Role and content are required"}]);
    }
    return;
  }

  // Call Convex mutation: POST to /api/mutation
  NSString *urlString = [NSString stringWithFormat:@"%@/api/mutation", self.convexUrl];
  NSURL *url = [NSURL URLWithString:urlString];

  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
  request.HTTPMethod = @"POST";
  [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];

  // Build args dictionary - content stays clean (no embedded paths)
  NSMutableDictionary *args = [NSMutableDictionary dictionaryWithDictionary:@{
    @"sessionId": sessionId,
    @"role": role,
    @"content": content
  }];

  // Add images array if provided (stored in separate field, not visible to user)
  if (images && images.count > 0) {
    NSMutableArray *imagesArg = [NSMutableArray array];
    for (NSDictionary *image in images) {
      NSString *storageId = image[@"storageId"];
      NSString *fileName = image[@"fileName"];
      NSString *path = image[@"path"];

      // Only add if path is valid (storageId is optional)
      if (path && path.length > 0) {
        NSMutableDictionary *imageDict = [NSMutableDictionary dictionaryWithDictionary:@{
          @"fileName": fileName ?: @"image.jpg",
          @"path": path
        }];
        // Only include storageId if it's a valid non-empty string
        if (storageId && storageId.length > 0 && ![storageId isEqualToString:@""]) {
          imageDict[@"storageId"] = storageId;
        }
        [imagesArg addObject:imageDict];
      }
    }
    if (imagesArg.count > 0) {
      args[@"images"] = imagesArg;
      NSLog(@"📤 [EXChatBackendService] Adding %lu images to message (stored in images field, not content)", (unsigned long)imagesArg.count);
    }
  }

  // Convex HTTP API: send path and args in body
  NSDictionary *body = @{
    @"path": @"messages:add",
    @"args": args
  };

  NSLog(@"📤 [EXChatBackendService] Sending message with images array:");
  NSLog(@"   - Content: %@", [content substringToIndex:MIN(content.length, 50)]);
  NSLog(@"   - Images count: %lu", (unsigned long)(images.count));

  NSError *jsonError;
  NSData *jsonData = [NSJSONSerialization dataWithJSONObject:body options:0 error:&jsonError];
  if (jsonError) {
    if (completion) {
      completion(nil, jsonError);
    }
    return;
  }
  request.HTTPBody = jsonData;

  NSURLSessionDataTask *task = [self.urlSession dataTaskWithRequest:request completionHandler:^(NSData * _Nullable data, NSURLResponse * _Nullable response, NSError * _Nullable error) {
    if (error) {
      if (completion) {
        completion(nil, error);
      }
      return;
    }

    NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *)response;
    if (httpResponse.statusCode != 200) {
      NSError *httpError = [NSError errorWithDomain:@"EXChatBackendService"
                                                code:httpResponse.statusCode
                                            userInfo:@{NSLocalizedDescriptionKey: [NSString stringWithFormat:@"HTTP error: %ld", (long)httpResponse.statusCode]}];
      if (completion) {
        completion(nil, httpError);
      }
      return;
    }

    NSError *parseError;
    id jsonObject = [NSJSONSerialization JSONObjectWithData:data options:0 error:&parseError];
    if (parseError) {
      if (completion) {
        completion(nil, parseError);
      }
      return;
    }

    if ([jsonObject isKindOfClass:[NSDictionary class]]) {
      NSDictionary *responseDict = (NSDictionary *)jsonObject;
      NSString *status = responseDict[@"status"];

      if ([status isEqualToString:@"error"]) {
        NSString *errorMessage = responseDict[@"errorMessage"] ?: @"Unknown error";
        NSError *convexError = [NSError errorWithDomain:@"EXChatBackendService"
                                                    code:500
                                                userInfo:@{NSLocalizedDescriptionKey: errorMessage}];
        if (completion) {
          completion(nil, convexError);
        }
        return;
      }

      id value = responseDict[@"value"];
      if ([value isKindOfClass:[NSString class]]) {
        if (completion) {
          completion((NSString *)value, nil);
        }
      } else {
        if (completion) {
          completion(nil, [NSError errorWithDomain:@"EXChatBackendService" code:500 userInfo:@{NSLocalizedDescriptionKey: @"Invalid response format: expected string in value field"}]);
        }
      }
    } else {
      if (completion) {
        completion(nil, [NSError errorWithDomain:@"EXChatBackendService" code:500 userInfo:@{NSLocalizedDescriptionKey: @"Invalid response format: expected dictionary"}]);
      }
    }
  }];

  [task resume];
}

- (void)triggerAIResponseWithSessionId:(NSString *)sessionId
                       convexSessionId:(NSString *)convexSessionId
                               message:(NSString *)message
                            repository:(NSString *)repository
                                 model:(NSString *)model
                            completion:(EXChatBackendVoidCallback)completion
{
  NSString *apiUrl = [self.v0ApiUrl stringByTrimmingCharactersInSet:[NSCharacterSet characterSetWithCharactersInString:@"/"]];
  NSString *urlString = [NSString stringWithFormat:@"%@/api/run-agent", apiUrl];
  NSURL *url = [NSURL URLWithString:urlString];

  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
  request.HTTPMethod = @"POST";
  [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];

  NSMutableDictionary *body = [NSMutableDictionary dictionaryWithDictionary:@{
    @"sessionId": sessionId ?: @"",
    @"id": convexSessionId ?: @"",
    @"message": message ?: @"",
    @"token": @"" // Token will be retrieved in the backend
  }];

  if (repository) {
    body[@"repository"] = repository;
  }

  // Add model if provided (for Claude agent)
  if (model && model.length > 0) {
    body[@"model"] = model;
    NSLog(@"🧠 [EXChatBackendService] Using Claude model: %@", model);
  }

  NSError *jsonError;
  NSData *jsonData = [NSJSONSerialization dataWithJSONObject:body options:0 error:&jsonError];
  if (jsonError) {
    if (completion) {
      completion(jsonError);
    }
    return;
  }
  request.HTTPBody = jsonData;
  
  NSURLSessionDataTask *task = [self.urlSession dataTaskWithRequest:request completionHandler:^(NSData * _Nullable data, NSURLResponse * _Nullable response, NSError * _Nullable error) {
    if (error) {
      // Don't treat this as a critical error - message was already sent
      if (completion) {
        completion(error);
      }
      return;
    }
    
    NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *)response;
    if (httpResponse.statusCode != 200) {
      NSError *httpError = [NSError errorWithDomain:@"EXChatBackendService" 
                                                code:httpResponse.statusCode 
                                            userInfo:@{NSLocalizedDescriptionKey: [NSString stringWithFormat:@"HTTP error: %ld", (long)httpResponse.statusCode]}];
      // Don't treat this as a critical error
      if (completion) {
        completion(httpError);
      }
      return;
    }
    
    if (completion) {
      completion(nil);
    }
  }];
  
  [task resume];
}

- (void)uploadImageWithData:(NSData *)imageData
                   fileName:(NSString *)fileName
                   mimeType:(NSString *)mimeType
                  sessionId:(NSString *)sessionId
                 completion:(EXChatBackendImageUploadCallback)completion
{
  if (!imageData || imageData.length == 0) {
    if (completion) {
      completion(nil, [NSError errorWithDomain:@"EXChatBackendService" code:400 userInfo:@{NSLocalizedDescriptionKey: @"Image data is required"}]);
    }
    return;
  }
  
  if (!sessionId || sessionId.length == 0) {
    if (completion) {
      completion(nil, [NSError errorWithDomain:@"EXChatBackendService" code:400 userInfo:@{NSLocalizedDescriptionKey: @"Session ID is required"}]);
    }
    return;
  }
  
  NSString *apiUrl = [self.v0ApiUrl stringByTrimmingCharactersInSet:[NSCharacterSet characterSetWithCharactersInString:@"/"]];
  NSString *urlString = [NSString stringWithFormat:@"%@/api/upload-image", apiUrl];
  NSURL *url = [NSURL URLWithString:urlString];
  
  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
  request.HTTPMethod = @"POST";
  
  NSString *boundary = [[NSUUID UUID] UUIDString];
  NSString *contentType = [NSString stringWithFormat:@"multipart/form-data; boundary=%@", boundary];
  [request setValue:contentType forHTTPHeaderField:@"Content-Type"];
  [request setValue:sessionId forHTTPHeaderField:@"x-session-id"];
  
  NSMutableData *body = [NSMutableData data];
  
  [body appendData:[[NSString stringWithFormat:@"--%@\r\n", boundary] dataUsingEncoding:NSUTF8StringEncoding]];
  [body appendData:[[NSString stringWithFormat:@"Content-Disposition: form-data; name=\"file\"; filename=\"%@\"\r\n", fileName ?: @"image.jpg"] dataUsingEncoding:NSUTF8StringEncoding]];
  [body appendData:[[NSString stringWithFormat:@"Content-Type: %@\r\n\r\n", mimeType ?: @"image/jpeg"] dataUsingEncoding:NSUTF8StringEncoding]];
  [body appendData:imageData];
  [body appendData:[@"\r\n" dataUsingEncoding:NSUTF8StringEncoding]];
  [body appendData:[[NSString stringWithFormat:@"--%@--\r\n", boundary] dataUsingEncoding:NSUTF8StringEncoding]];
  
  request.HTTPBody = body;
  
  NSURLSessionDataTask *task = [self.urlSession dataTaskWithRequest:request completionHandler:^(NSData * _Nullable data, NSURLResponse * _Nullable response, NSError * _Nullable error) {
    if (error) {
      if (completion) {
        completion(nil, error);
      }
      return;
    }
    
    NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *)response;
    if (httpResponse.statusCode != 200) {
      NSString *errorMessage = @"Upload failed";
      if (data) {
        NSError *parseError;
        id jsonObject = [NSJSONSerialization JSONObjectWithData:data options:0 error:&parseError];
        if (!parseError && [jsonObject isKindOfClass:[NSDictionary class]]) {
          errorMessage = jsonObject[@"error"] ?: errorMessage;
        }
      }
      NSError *httpError = [NSError errorWithDomain:@"EXChatBackendService" 
                                                code:httpResponse.statusCode 
                                            userInfo:@{NSLocalizedDescriptionKey: errorMessage}];
      if (completion) {
        completion(nil, httpError);
      }
      return;
    }
    
    NSError *parseError;
    id jsonObject = [NSJSONSerialization JSONObjectWithData:data options:0 error:&parseError];
    if (parseError) {
      if (completion) {
        completion(nil, parseError);
      }
      return;
    }
    
    if ([jsonObject isKindOfClass:[NSDictionary class]]) {
      NSDictionary *result = (NSDictionary *)jsonObject;
      NSLog(@"📥 [EXChatBackendService] Image upload response:");
      NSLog(@"   - storageId: %@", result[@"storageId"] ?: @"(nil)");
      NSLog(@"   - fileName: %@", result[@"fileName"] ?: @"(nil)");
      NSLog(@"   - path: %@", result[@"path"] ?: @"(nil)");
      NSLog(@"   - Full response: %@", result);
      if (completion) {
        completion(result, nil);
      }
    } else {
      if (completion) {
        completion(nil, [NSError errorWithDomain:@"EXChatBackendService" code:500 userInfo:@{NSLocalizedDescriptionKey: @"Invalid response format"}]);
      }
    }
  }];
  
  [task resume];
}

- (void)getStorageUrlForId:(NSString *)storageId
                completion:(EXChatBackendStorageUrlCallback)completion
{
  if (!storageId || storageId.length == 0) {
    if (completion) {
      completion(nil, [NSError errorWithDomain:@"EXChatBackendService" code:400 userInfo:@{NSLocalizedDescriptionKey: @"Storage ID is required"}]);
    }
    return;
  }

  NSLog(@"🔗 [EXChatBackendService] Getting storage URL for ID: %@", storageId);

  // Call Convex query to get storage URL
  // The Convex function "storage:getUrl" returns the signed URL for a storage ID
  NSString *convexUrl = [self.convexUrl stringByTrimmingCharactersInSet:[NSCharacterSet characterSetWithCharactersInString:@"/"]];
  NSString *urlString = [NSString stringWithFormat:@"%@/api/query", convexUrl];
  NSURL *url = [NSURL URLWithString:urlString];

  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
  request.HTTPMethod = @"POST";
  [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];
  [request setValue:@"application/json" forHTTPHeaderField:@"Accept"];

  // Convex query format for getting storage URL
  NSDictionary *body = @{
    @"path": @"messages:getStorageUrl",
    @"args": @{@"storageId": storageId}
  };

  NSError *jsonError;
  NSData *bodyData = [NSJSONSerialization dataWithJSONObject:body options:0 error:&jsonError];
  if (jsonError) {
    if (completion) {
      completion(nil, jsonError);
    }
    return;
  }
  request.HTTPBody = bodyData;

  NSLog(@"🔗 [EXChatBackendService] Calling Convex query: %@ with storageId: %@", urlString, storageId);

  NSURLSessionDataTask *task = [self.urlSession dataTaskWithRequest:request completionHandler:^(NSData * _Nullable data, NSURLResponse * _Nullable response, NSError * _Nullable error) {
    if (error) {
      NSLog(@"❌ [EXChatBackendService] Network error getting storage URL: %@", error);
      if (completion) {
        completion(nil, error);
      }
      return;
    }

    NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *)response;
    NSLog(@"🔗 [EXChatBackendService] Storage URL response status: %ld", (long)httpResponse.statusCode);

    if (data) {
      NSString *responseStr = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
      NSLog(@"🔗 [EXChatBackendService] Storage URL response: %@", responseStr);
    }

    if (httpResponse.statusCode != 200) {
      NSError *httpError = [NSError errorWithDomain:@"EXChatBackendService"
                                                code:httpResponse.statusCode
                                            userInfo:@{NSLocalizedDescriptionKey: [NSString stringWithFormat:@"HTTP error: %ld", (long)httpResponse.statusCode]}];
      if (completion) {
        completion(nil, httpError);
      }
      return;
    }

    NSError *parseError;
    id jsonObject = [NSJSONSerialization JSONObjectWithData:data options:0 error:&parseError];
    if (parseError) {
      if (completion) {
        completion(nil, parseError);
      }
      return;
    }

    // Convex returns: {"status": "success", "value": "https://..."} or just the URL string
    NSString *resultUrl = nil;
    if ([jsonObject isKindOfClass:[NSDictionary class]]) {
      NSDictionary *responseDict = (NSDictionary *)jsonObject;
      // Check for Convex response format
      if (responseDict[@"value"]) {
        id value = responseDict[@"value"];
        if ([value isKindOfClass:[NSString class]]) {
          resultUrl = (NSString *)value;
        }
      } else if (responseDict[@"url"]) {
        resultUrl = responseDict[@"url"];
      }
    } else if ([jsonObject isKindOfClass:[NSString class]]) {
      resultUrl = (NSString *)jsonObject;
    }

    if (resultUrl && resultUrl.length > 0) {
      NSLog(@"✅ [EXChatBackendService] Got storage URL: %@", resultUrl);
      NSURL *storageUrl = [NSURL URLWithString:resultUrl];
      if (completion) {
        completion(storageUrl, nil);
      }
    } else {
      NSLog(@"❌ [EXChatBackendService] No URL in response");
      if (completion) {
        completion(nil, [NSError errorWithDomain:@"EXChatBackendService" code:404 userInfo:@{NSLocalizedDescriptionKey: @"Storage URL not found in response"}]);
      }
    }
  }];

  [task resume];
}

- (void)addEnvWithSessionId:(NSString *)sessionId
                        key:(NSString *)key
                      value:(NSString *)value
                 completion:(EXChatBackendVoidCallback)completion
{
  if (!sessionId || sessionId.length == 0 || !key || key.length == 0) {
    if (completion) {
      completion([NSError errorWithDomain:@"EXChatBackendService" code:400 userInfo:@{NSLocalizedDescriptionKey: @"Session ID and key are required"}]);
    }
    return;
  }

  NSString *apiUrl = [self.v0ApiUrl stringByTrimmingCharactersInSet:[NSCharacterSet characterSetWithCharactersInString:@"/"]];
  NSString *urlString = [NSString stringWithFormat:@"%@/api/session/add-env", apiUrl];
  NSURL *url = [NSURL URLWithString:urlString];

  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
  request.HTTPMethod = @"POST";
  [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];

  NSDictionary *body = @{
    @"sessionId": sessionId,
    @"key": key,
    @"value": value ?: @""
  };

  NSError *jsonError;
  NSData *jsonData = [NSJSONSerialization dataWithJSONObject:body options:0 error:&jsonError];
  if (jsonError) {
    if (completion) {
      completion(jsonError);
    }
    return;
  }
  request.HTTPBody = jsonData;

  NSURLSessionDataTask *task = [self.urlSession dataTaskWithRequest:request completionHandler:^(NSData * _Nullable data, NSURLResponse * _Nullable response, NSError * _Nullable error) {
    if (error) {
      if (completion) {
        completion(error);
      }
      return;
    }

    NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *)response;
    if (httpResponse.statusCode != 200) {
      NSError *httpError = [NSError errorWithDomain:@"EXChatBackendService"
                                                code:httpResponse.statusCode
                                            userInfo:@{NSLocalizedDescriptionKey: [NSString stringWithFormat:@"HTTP error: %ld", (long)httpResponse.statusCode]}];
      if (completion) {
        completion(httpError);
      }
      return;
    }

    if (completion) {
      completion(nil);
    }
  }];

  [task resume];
}

- (void)removeEnvWithSessionId:(NSString *)sessionId
                           key:(NSString *)key
                    completion:(EXChatBackendVoidCallback)completion
{
  if (!sessionId || sessionId.length == 0 || !key || key.length == 0) {
    if (completion) {
      completion([NSError errorWithDomain:@"EXChatBackendService" code:400 userInfo:@{NSLocalizedDescriptionKey: @"Session ID and key are required"}]);
    }
    return;
  }

  NSString *apiUrl = [self.v0ApiUrl stringByTrimmingCharactersInSet:[NSCharacterSet characterSetWithCharactersInString:@"/"]];
  NSString *urlString = [NSString stringWithFormat:@"%@/api/session/remove-env", apiUrl];
  NSURL *url = [NSURL URLWithString:urlString];

  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
  request.HTTPMethod = @"POST";
  [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];

  NSDictionary *body = @{
    @"sessionId": sessionId,
    @"key": key
  };

  NSError *jsonError;
  NSData *jsonData = [NSJSONSerialization dataWithJSONObject:body options:0 error:&jsonError];
  if (jsonError) {
    if (completion) {
      completion(jsonError);
    }
    return;
  }
  request.HTTPBody = jsonData;

  NSURLSessionDataTask *task = [self.urlSession dataTaskWithRequest:request completionHandler:^(NSData * _Nullable data, NSURLResponse * _Nullable response, NSError * _Nullable error) {
    if (error) {
      if (completion) {
        completion(error);
      }
      return;
    }

    NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *)response;
    if (httpResponse.statusCode != 200) {
      NSError *httpError = [NSError errorWithDomain:@"EXChatBackendService"
                                                code:httpResponse.statusCode
                                            userInfo:@{NSLocalizedDescriptionKey: [NSString stringWithFormat:@"HTTP error: %ld", (long)httpResponse.statusCode]}];
      if (completion) {
        completion(httpError);
      }
      return;
    }

    if (completion) {
      completion(nil);
    }
  }];

  [task resume];
}

- (void)listFilesAtPath:(NSString *)path
              sessionId:(NSString *)sessionId
             completion:(void (^)(NSArray<NSDictionary *> * _Nullable entries, NSError * _Nullable error))completion
{
  if (!sessionId || sessionId.length == 0) {
    if (completion) {
      completion(nil, [NSError errorWithDomain:@"EXChatBackendService" code:400 userInfo:@{NSLocalizedDescriptionKey: @"Session ID is required"}]);
    }
    return;
  }

  NSString *apiUrl = [self.v0ApiUrl stringByTrimmingCharactersInSet:[NSCharacterSet characterSetWithCharactersInString:@"/"]];
  NSString *urlString = [NSString stringWithFormat:@"%@/api/filesystem/list", apiUrl];
  NSURL *url = [NSURL URLWithString:urlString];

  NSLog(@"📁 [EXChatBackendService] Listing files at path: %@ sessionId: %@", path ?: @"/vibe0", sessionId);

  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
  request.HTTPMethod = @"POST";
  [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];

  NSDictionary *body = @{
    @"path": path ?: @"/vibe0",
    @"depth": @1,
    @"sessionId": sessionId
  };

  NSError *jsonError;
  NSData *jsonData = [NSJSONSerialization dataWithJSONObject:body options:0 error:&jsonError];
  if (jsonError) {
    if (completion) {
      completion(nil, jsonError);
    }
    return;
  }
  request.HTTPBody = jsonData;

  NSURLSessionDataTask *task = [self.urlSession dataTaskWithRequest:request completionHandler:^(NSData * _Nullable data, NSURLResponse * _Nullable response, NSError * _Nullable error) {
    if (error) {
      NSLog(@"❌ [EXChatBackendService] Network error listing files: %@", error);
      if (completion) {
        completion(nil, error);
      }
      return;
    }

    NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *)response;
    if (httpResponse.statusCode != 200) {
      NSError *httpError = [NSError errorWithDomain:@"EXChatBackendService"
                                                code:httpResponse.statusCode
                                            userInfo:@{NSLocalizedDescriptionKey: [NSString stringWithFormat:@"HTTP error: %ld", (long)httpResponse.statusCode]}];
      if (completion) {
        completion(nil, httpError);
      }
      return;
    }

    NSError *parseError;
    id jsonObject = [NSJSONSerialization JSONObjectWithData:data options:0 error:&parseError];
    if (parseError) {
      if (completion) {
        completion(nil, parseError);
      }
      return;
    }

    if ([jsonObject isKindOfClass:[NSDictionary class]]) {
      NSDictionary *response = (NSDictionary *)jsonObject;
      NSArray *entries = response[@"entries"];
      if ([entries isKindOfClass:[NSArray class]]) {
        NSLog(@"📁 [EXChatBackendService] Found %lu files/directories", (unsigned long)entries.count);
        if (completion) {
          completion(entries, nil);
        }
      } else {
        if (completion) {
          completion(@[], nil);
        }
      }
    } else {
      if (completion) {
        completion(nil, [NSError errorWithDomain:@"EXChatBackendService" code:500 userInfo:@{NSLocalizedDescriptionKey: @"Invalid response format"}]);
      }
    }
  }];

  [task resume];
}

- (void)readFileAtPath:(NSString *)path
             sessionId:(NSString *)sessionId
            completion:(void (^)(NSString * _Nullable content, NSError * _Nullable error))completion
{
  if (!sessionId || sessionId.length == 0 || !path || path.length == 0) {
    if (completion) {
      completion(nil, [NSError errorWithDomain:@"EXChatBackendService" code:400 userInfo:@{NSLocalizedDescriptionKey: @"Session ID and path are required"}]);
    }
    return;
  }

  NSString *apiUrl = [self.v0ApiUrl stringByTrimmingCharactersInSet:[NSCharacterSet characterSetWithCharactersInString:@"/"]];
  NSString *urlString = [NSString stringWithFormat:@"%@/api/filesystem/read", apiUrl];
  NSURL *url = [NSURL URLWithString:urlString];

  NSLog(@"📄 [EXChatBackendService] Reading file at path: %@", path);

  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
  request.HTTPMethod = @"POST";
  [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];

  NSDictionary *body = @{
    @"path": path,
    @"format": @"text",
    @"sessionId": sessionId
  };

  NSError *jsonError;
  NSData *jsonData = [NSJSONSerialization dataWithJSONObject:body options:0 error:&jsonError];
  if (jsonError) {
    if (completion) {
      completion(nil, jsonError);
    }
    return;
  }
  request.HTTPBody = jsonData;

  NSURLSessionDataTask *task = [self.urlSession dataTaskWithRequest:request completionHandler:^(NSData * _Nullable data, NSURLResponse * _Nullable response, NSError * _Nullable error) {
    if (error) {
      NSLog(@"❌ [EXChatBackendService] Network error reading file: %@", error);
      if (completion) {
        completion(nil, error);
      }
      return;
    }

    NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *)response;
    if (httpResponse.statusCode != 200) {
      NSError *httpError = [NSError errorWithDomain:@"EXChatBackendService"
                                                code:httpResponse.statusCode
                                            userInfo:@{NSLocalizedDescriptionKey: [NSString stringWithFormat:@"HTTP error: %ld", (long)httpResponse.statusCode]}];
      if (completion) {
        completion(nil, httpError);
      }
      return;
    }

    NSError *parseError;
    id jsonObject = [NSJSONSerialization JSONObjectWithData:data options:0 error:&parseError];
    if (parseError) {
      if (completion) {
        completion(nil, parseError);
      }
      return;
    }

    if ([jsonObject isKindOfClass:[NSDictionary class]]) {
      NSDictionary *response = (NSDictionary *)jsonObject;
      NSString *content = response[@"content"];
      if ([content isKindOfClass:[NSString class]]) {
        NSLog(@"📄 [EXChatBackendService] Read file content (%lu characters)", (unsigned long)content.length);
        if (completion) {
          completion(content, nil);
        }
      } else {
        if (completion) {
          completion(@"", nil);
        }
      }
    } else {
      if (completion) {
        completion(nil, [NSError errorWithDomain:@"EXChatBackendService" code:500 userInfo:@{NSLocalizedDescriptionKey: @"Invalid response format"}]);
      }
    }
  }];

  [task resume];
}

- (void)getEnvsForSession:(NSString *)sessionId
               completion:(void (^)(NSDictionary * _Nullable envs, NSError * _Nullable error))completion
{
  if (!sessionId || sessionId.length == 0) {
    if (completion) {
      completion(nil, [NSError errorWithDomain:@"EXChatBackendService" code:400 userInfo:@{NSLocalizedDescriptionKey: @"Session ID is required"}]);
    }
    return;
  }

  NSString *apiUrl = [self.v0ApiUrl stringByTrimmingCharactersInSet:[NSCharacterSet characterSetWithCharactersInString:@"/"]];
  NSString *urlString = [NSString stringWithFormat:@"%@/api/session/get-envs?sessionId=%@", apiUrl, sessionId];
  NSURL *url = [NSURL URLWithString:urlString];

  NSLog(@"🔑 [EXChatBackendService] Getting ENVs for session: %@", sessionId);

  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
  request.HTTPMethod = @"GET";
  [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];

  NSURLSessionDataTask *task = [self.urlSession dataTaskWithRequest:request completionHandler:^(NSData * _Nullable data, NSURLResponse * _Nullable response, NSError * _Nullable error) {
    if (error) {
      NSLog(@"❌ [EXChatBackendService] Network error getting ENVs: %@", error);
      if (completion) {
        completion(nil, error);
      }
      return;
    }

    NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *)response;
    if (httpResponse.statusCode != 200) {
      NSError *httpError = [NSError errorWithDomain:@"EXChatBackendService"
                                                code:httpResponse.statusCode
                                            userInfo:@{NSLocalizedDescriptionKey: [NSString stringWithFormat:@"HTTP error: %ld", (long)httpResponse.statusCode]}];
      if (completion) {
        completion(nil, httpError);
      }
      return;
    }

    NSError *parseError;
    id jsonObject = [NSJSONSerialization JSONObjectWithData:data options:0 error:&parseError];
    if (parseError) {
      if (completion) {
        completion(nil, parseError);
      }
      return;
    }

    if ([jsonObject isKindOfClass:[NSDictionary class]]) {
      NSDictionary *response = (NSDictionary *)jsonObject;
      NSDictionary *envs = response[@"envs"];
      if ([envs isKindOfClass:[NSDictionary class]]) {
        NSLog(@"🔑 [EXChatBackendService] Got %lu ENVs", (unsigned long)envs.count);
        if (completion) {
          completion(envs, nil);
        }
      } else {
        if (completion) {
          completion(@{}, nil);
        }
      }
    } else {
      if (completion) {
        completion(nil, [NSError errorWithDomain:@"EXChatBackendService" code:500 userInfo:@{NSLocalizedDescriptionKey: @"Invalid response format"}]);
      }
    }
  }];

  [task resume];
}

- (void)syncEnvsBidirectionalWithSessionId:(NSString *)sessionId
                                completion:(void (^)(NSDictionary * _Nullable result, NSError * _Nullable error))completion
{
  if (!sessionId || sessionId.length == 0) {
    if (completion) {
      completion(nil, [NSError errorWithDomain:@"EXChatBackendService" code:400 userInfo:@{NSLocalizedDescriptionKey: @"Session ID is required"}]);
    }
    return;
  }

  NSString *apiUrl = [self.v0ApiUrl stringByTrimmingCharactersInSet:[NSCharacterSet characterSetWithCharactersInString:@"/"]];
  NSString *urlString = [NSString stringWithFormat:@"%@/api/session/sync-envs-bidirectional", apiUrl];
  NSURL *url = [NSURL URLWithString:urlString];

  NSLog(@"🔄 [EXChatBackendService] Syncing ENVs bidirectionally for session: %@", sessionId);

  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
  request.HTTPMethod = @"POST";
  [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];

  NSDictionary *body = @{
    @"sessionId": sessionId
  };

  NSError *jsonError;
  NSData *jsonData = [NSJSONSerialization dataWithJSONObject:body options:0 error:&jsonError];
  if (jsonError) {
    if (completion) {
      completion(nil, jsonError);
    }
    return;
  }
  request.HTTPBody = jsonData;

  NSURLSessionDataTask *task = [self.urlSession dataTaskWithRequest:request completionHandler:^(NSData * _Nullable data, NSURLResponse * _Nullable response, NSError * _Nullable error) {
    if (error) {
      NSLog(@"❌ [EXChatBackendService] Network error syncing ENVs: %@", error);
      if (completion) {
        completion(nil, error);
      }
      return;
    }

    NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *)response;
    if (httpResponse.statusCode != 200) {
      NSError *httpError = [NSError errorWithDomain:@"EXChatBackendService"
                                                code:httpResponse.statusCode
                                            userInfo:@{NSLocalizedDescriptionKey: [NSString stringWithFormat:@"HTTP error: %ld", (long)httpResponse.statusCode]}];
      if (completion) {
        completion(nil, httpError);
      }
      return;
    }

    NSError *parseError;
    id jsonObject = [NSJSONSerialization JSONObjectWithData:data options:0 error:&parseError];
    if (parseError) {
      if (completion) {
        completion(nil, parseError);
      }
      return;
    }

    if ([jsonObject isKindOfClass:[NSDictionary class]]) {
      NSDictionary *result = (NSDictionary *)jsonObject;
      NSLog(@"🔄 [EXChatBackendService] ENVs synced: %@", result[@"stats"]);
      if (completion) {
        completion(result, nil);
      }
    } else {
      if (completion) {
        completion(nil, [NSError errorWithDomain:@"EXChatBackendService" code:500 userInfo:@{NSLocalizedDescriptionKey: @"Invalid response format"}]);
      }
    }
  }];

  [task resume];
}

- (void)stopAgentWithSessionId:(NSString *)sessionId
                    completion:(void (^)(BOOL success, NSError * _Nullable error))completion
{
  if (!sessionId || sessionId.length == 0) {
    if (completion) {
      completion(NO, [NSError errorWithDomain:@"EXChatBackendService" code:400 userInfo:@{NSLocalizedDescriptionKey: @"Session ID is required"}]);
    }
    return;
  }

  NSString *apiUrl = [self.v0ApiUrl stringByTrimmingCharactersInSet:[NSCharacterSet characterSetWithCharactersInString:@"/"]];
  NSString *urlString = [NSString stringWithFormat:@"%@/api/session/stop-agent", apiUrl];
  NSURL *url = [NSURL URLWithString:urlString];

  NSLog(@"🛑 [EXChatBackendService] Stopping agent for session: %@", sessionId);

  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
  request.HTTPMethod = @"POST";
  [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];

  NSDictionary *body = @{
    @"sessionId": sessionId
  };

  NSError *jsonError;
  NSData *jsonData = [NSJSONSerialization dataWithJSONObject:body options:0 error:&jsonError];
  if (jsonError) {
    if (completion) {
      completion(NO, jsonError);
    }
    return;
  }
  request.HTTPBody = jsonData;

  NSURLSessionDataTask *task = [self.urlSession dataTaskWithRequest:request completionHandler:^(NSData * _Nullable data, NSURLResponse * _Nullable response, NSError * _Nullable error) {
    if (error) {
      NSLog(@"❌ [EXChatBackendService] Network error stopping agent: %@", error);
      if (completion) {
        completion(NO, error);
      }
      return;
    }

    NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *)response;
    if (httpResponse.statusCode != 200) {
      NSString *errorMessage = @"Failed to stop agent";
      if (data) {
        NSError *parseError;
        id jsonObject = [NSJSONSerialization JSONObjectWithData:data options:0 error:&parseError];
        if (!parseError && [jsonObject isKindOfClass:[NSDictionary class]]) {
          errorMessage = jsonObject[@"error"] ?: errorMessage;
        }
      }
      NSError *httpError = [NSError errorWithDomain:@"EXChatBackendService"
                                                code:httpResponse.statusCode
                                            userInfo:@{NSLocalizedDescriptionKey: errorMessage}];
      if (completion) {
        completion(NO, httpError);
      }
      return;
    }

    NSLog(@"✅ [EXChatBackendService] Agent stopped successfully");
    if (completion) {
      completion(YES, nil);
    }
  }];

  [task resume];
}

- (void)checkBillingLimitForClerkId:(NSString *)clerkId
                         completion:(void (^)(BOOL canSend, NSString * _Nullable reason, NSString * _Nullable billingMode, NSNumber * _Nullable remaining, NSError * _Nullable error))completion
{
  if (!clerkId || clerkId.length == 0) {
    NSLog(@"⚠️ [EXChatBackendService] checkBillingLimit: No clerkId provided, allowing message (fail-open)");
    if (completion) {
      completion(YES, nil, @"tokens", nil, nil);
    }
    return;
  }

  NSString *apiUrl = [self.v0ApiUrl stringByTrimmingCharactersInSet:[NSCharacterSet characterSetWithCharactersInString:@"/"]];
  NSString *urlString = [NSString stringWithFormat:@"%@/api/billing/check-limit", apiUrl];
  NSURL *url = [NSURL URLWithString:urlString];

  NSLog(@"💳 [EXChatBackendService] Checking billing limit for clerkId: %@", clerkId);

  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
  request.HTTPMethod = @"POST";
  [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];

  NSDictionary *body = @{
    @"clerkId": clerkId
  };

  NSError *jsonError;
  NSData *jsonData = [NSJSONSerialization dataWithJSONObject:body options:0 error:&jsonError];
  if (jsonError) {
    NSLog(@"⚠️ [EXChatBackendService] JSON error, allowing message (fail-open)");
    if (completion) {
      completion(YES, nil, @"tokens", nil, jsonError);
    }
    return;
  }
  request.HTTPBody = jsonData;

  NSURLSessionDataTask *task = [self.urlSession dataTaskWithRequest:request completionHandler:^(NSData * _Nullable data, NSURLResponse * _Nullable response, NSError * _Nullable error) {
    if (error) {
      NSLog(@"⚠️ [EXChatBackendService] Network error checking billing, allowing message (fail-open): %@", error);
      if (completion) {
        completion(YES, nil, @"tokens", nil, error);
      }
      return;
    }

    NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *)response;
    if (httpResponse.statusCode != 200) {
      NSLog(@"⚠️ [EXChatBackendService] HTTP error %ld checking billing, allowing message (fail-open)", (long)httpResponse.statusCode);
      if (completion) {
        completion(YES, nil, @"tokens", nil, nil);
      }
      return;
    }

    if (!data) {
      NSLog(@"⚠️ [EXChatBackendService] No data in billing response, allowing message (fail-open)");
      if (completion) {
        completion(YES, nil, @"tokens", nil, nil);
      }
      return;
    }

    NSError *parseError;
    id jsonObject = [NSJSONSerialization JSONObjectWithData:data options:0 error:&parseError];
    if (parseError || ![jsonObject isKindOfClass:[NSDictionary class]]) {
      NSLog(@"⚠️ [EXChatBackendService] Parse error in billing response, allowing message (fail-open)");
      if (completion) {
        completion(YES, nil, @"tokens", nil, parseError);
      }
      return;
    }

    NSDictionary *result = (NSDictionary *)jsonObject;
    BOOL canSend = [result[@"canSend"] boolValue];
    NSString *reason = result[@"reason"];
    NSString *billingMode = result[@"billingMode"] ?: @"tokens";
    NSNumber *remaining = result[@"remaining"];

    NSLog(@"💳 [EXChatBackendService] Billing check result: canSend=%@, billingMode=%@, remaining=%@, reason=%@",
          canSend ? @"YES" : @"NO", billingMode, remaining, reason ?: @"nil");

    if (completion) {
      completion(canSend, reason, billingMode, remaining, nil);
    }
  }];

  [task resume];
}

- (void)clearMessagesForSession:(NSString *)sessionId
                     completion:(EXChatBackendVoidCallback)completion
{
  if (!sessionId || sessionId.length == 0) {
    if (completion) {
      completion([NSError errorWithDomain:@"EXChatBackendService"
                                     code:400
                                 userInfo:@{NSLocalizedDescriptionKey: @"Session ID is required"}]);
    }
    return;
  }

  // Call Convex mutation: POST to /api/mutation
  NSString *urlString = [NSString stringWithFormat:@"%@/api/mutation", self.convexUrl];
  NSURL *url = [NSURL URLWithString:urlString];

  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
  request.HTTPMethod = @"POST";
  [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];

  // Convex HTTP API: call messages:clearBySession mutation
  NSDictionary *body = @{
    @"path": @"messages:clearBySession",
    @"args": @{@"sessionId": sessionId}
  };

  NSError *jsonError;
  NSData *jsonData = [NSJSONSerialization dataWithJSONObject:body options:0 error:&jsonError];
  if (jsonError) {
    NSLog(@"❌ [EXChatBackendService] JSON serialization error: %@", jsonError);
    if (completion) {
      completion(jsonError);
    }
    return;
  }
  request.HTTPBody = jsonData;

  NSLog(@"🗑️ [EXChatBackendService] Clearing messages for session: %@", sessionId);

  NSURLSessionDataTask *task = [self.urlSession dataTaskWithRequest:request
                                                  completionHandler:^(NSData * _Nullable data,
                                                                      NSURLResponse * _Nullable response,
                                                                      NSError * _Nullable error) {
    if (error) {
      NSLog(@"❌ [EXChatBackendService] Error clearing messages: %@", error);
      if (completion) {
        completion(error);
      }
      return;
    }

    NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *)response;
    if (httpResponse.statusCode != 200) {
      NSError *httpError = [NSError errorWithDomain:@"EXChatBackendService"
                                               code:httpResponse.statusCode
                                           userInfo:@{NSLocalizedDescriptionKey:
                                             [NSString stringWithFormat:@"HTTP error: %ld",
                                               (long)httpResponse.statusCode]}];
      NSLog(@"❌ [EXChatBackendService] HTTP error clearing messages: %ld", (long)httpResponse.statusCode);
      if (completion) {
        completion(httpError);
      }
      return;
    }

    NSLog(@"✅ [EXChatBackendService] Messages cleared successfully for session: %@", sessionId);
    if (completion) {
      completion(nil);
    }
  }];

  [task resume];
}

- (void)getUsageForClerkId:(NSString *)clerkId
                completion:(void (^)(NSDictionary * _Nullable usage, NSError * _Nullable error))completion
{
  if (!clerkId || clerkId.length == 0) {
    if (completion) {
      completion(nil, [NSError errorWithDomain:@"EXChatBackendService" code:400 userInfo:@{NSLocalizedDescriptionKey: @"Clerk ID is required"}]);
    }
    return;
  }

  // Use Convex HTTP API to fetch billing status (includes billing mode and all usage data)
  NSString *apiUrl = [self.convexUrl stringByTrimmingCharactersInSet:[NSCharacterSet characterSetWithCharactersInString:@"/"]];
  NSString *urlString = [NSString stringWithFormat:@"%@/api/query", apiUrl];
  NSURL *url = [NSURL URLWithString:urlString];

  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
  request.HTTPMethod = @"POST";
  [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];

  // Query billingSwitch:getBillingStatus - returns billingMode, tokensRemaining, creditsRemaining, etc.
  NSDictionary *body = @{
    @"path": @"billingSwitch:getBillingStatus",
    @"args": @{@"clerkId": clerkId}
  };

  NSError *jsonError;
  NSData *jsonData = [NSJSONSerialization dataWithJSONObject:body options:0 error:&jsonError];
  if (jsonError) {
    NSLog(@"❌ [EXChatBackendService] JSON serialization error: %@", jsonError);
    if (completion) {
      completion(nil, jsonError);
    }
    return;
  }
  request.HTTPBody = jsonData;

  NSLog(@"📊 [EXChatBackendService] Fetching billing status for clerkId: %@", clerkId);

  NSURLSessionDataTask *task = [self.urlSession dataTaskWithRequest:request
                                                  completionHandler:^(NSData * _Nullable data,
                                                                      NSURLResponse * _Nullable response,
                                                                      NSError * _Nullable error) {
    if (error) {
      NSLog(@"❌ [EXChatBackendService] Error fetching usage: %@", error);
      if (completion) {
        completion(nil, error);
      }
      return;
    }

    NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *)response;
    if (httpResponse.statusCode != 200) {
      NSError *httpError = [NSError errorWithDomain:@"EXChatBackendService"
                                               code:httpResponse.statusCode
                                           userInfo:@{NSLocalizedDescriptionKey:
                                             [NSString stringWithFormat:@"HTTP error: %ld",
                                               (long)httpResponse.statusCode]}];
      NSLog(@"❌ [EXChatBackendService] HTTP error fetching usage: %ld", (long)httpResponse.statusCode);
      if (completion) {
        completion(nil, httpError);
      }
      return;
    }

    NSError *parseError;
    id jsonObject = [NSJSONSerialization JSONObjectWithData:data options:0 error:&parseError];
    if (parseError) {
      NSLog(@"❌ [EXChatBackendService] Parse error: %@", parseError);
      if (completion) {
        completion(nil, parseError);
      }
      return;
    }

    // Parse billingSwitch:getBillingStatus response
    if ([jsonObject isKindOfClass:[NSDictionary class]]) {
      NSDictionary *responseDict = (NSDictionary *)jsonObject;
      NSDictionary *value = responseDict[@"value"];

      if (!value || [value isKindOfClass:[NSNull class]]) {
        // No billing status found - return default values
        NSDictionary *defaultUsage = @{
          @"billingMode": @"tokens",
          @"remaining": @0,
          @"used": @0,
          @"total": @0,
          @"planName": @"Free",
          @"isPro": @NO
        };
        NSLog(@"⚠️ [EXChatBackendService] No billing status found, returning defaults");
        if (completion) {
          completion(defaultUsage, nil);
        }
        return;
      }

      // Extract values from getBillingStatus response
      // Response format: { billingMode, agentType, tokensRemaining, tokensUsed, creditsRemaining, creditsUsed, subscriptionPlan }
      NSString *billingMode = value[@"billingMode"] ?: @"tokens";
      BOOL isCreditsMode = [billingMode isEqualToString:@"credits"];

      double remaining = 0;
      double used = 0;
      double total = 0;
      NSString *planName = @"Free";
      BOOL isPro = NO;

      if (isCreditsMode) {
        // Credits mode - use creditsRemaining and creditsUsed
        NSNumber *creditsRemaining = value[@"creditsRemaining"];
        NSNumber *creditsUsed = value[@"creditsUsed"];

        remaining = creditsRemaining ? [creditsRemaining doubleValue] : 0;
        used = creditsUsed ? [creditsUsed doubleValue] : 0;
        total = remaining + used; // Total is sum of remaining + used
      } else {
        // Tokens mode - use tokensRemaining and tokensUsed
        NSNumber *tokensRemaining = value[@"tokensRemaining"];
        NSNumber *tokensUsed = value[@"tokensUsed"];

        remaining = tokensRemaining ? [tokensRemaining doubleValue] : 0;
        used = tokensUsed ? [tokensUsed doubleValue] : 0;
        total = remaining + used; // Total is sum of remaining + used
      }

      // Determine plan name from subscriptionPlan
      NSString *subscriptionPlan = value[@"subscriptionPlan"];
      if ([subscriptionPlan isKindOfClass:[NSString class]]) {
        NSString *planLower = [subscriptionPlan lowercaseString];
        if ([planLower isEqualToString:@"pro"] || [planLower containsString:@"pro"]) {
          planName = @"Pro";
          isPro = YES;
        } else if ([planLower isEqualToString:@"enterprise"] || [planLower containsString:@"enterprise"]) {
          planName = @"Enterprise";
          isPro = YES;
        } else if ([planLower isEqualToString:@"free"]) {
          planName = @"Free";
        } else {
          // Default to capitalizing the plan name
          planName = [subscriptionPlan capitalizedString];
          // Check if it's a paid plan (not free)
          isPro = ![planLower isEqualToString:@"free"];
        }
      }

      NSDictionary *usage = @{
        @"billingMode": billingMode,
        @"remaining": @(remaining),
        @"used": @(used),
        @"total": @(total),
        @"planName": planName,
        @"isPro": @(isPro)
      };

      NSLog(@"✅ [EXChatBackendService] Usage data: mode=%@, remaining=%.2f, used=%.2f, total=%.2f, plan=%@",
            billingMode, remaining, used, total, planName);

      if (completion) {
        completion(usage, nil);
      }
    } else {
      NSError *formatError = [NSError errorWithDomain:@"EXChatBackendService"
                                                 code:500
                                             userInfo:@{NSLocalizedDescriptionKey: @"Invalid response format"}];
      if (completion) {
        completion(nil, formatError);
      }
    }
  }];

  [task resume];
}

#pragma mark - GitHub Integration

- (void)checkGitHubConnectionForClerkId:(NSString *)clerkId
                             completion:(void (^)(BOOL isConnected, NSString * _Nullable username, NSError * _Nullable error))completion
{
  NSLog(@"🔍 [EXChatBackendService] Checking GitHub connection for clerkId: %@", clerkId);

  if (!clerkId || clerkId.length == 0) {
    if (completion) {
      NSError *error = [NSError errorWithDomain:@"EXChatBackendService"
                                           code:400
                                       userInfo:@{NSLocalizedDescriptionKey: @"Missing clerkId"}];
      completion(NO, nil, error);
    }
    return;
  }

  NSString *apiUrl = [self.v0ApiUrl stringByTrimmingCharactersInSet:[NSCharacterSet characterSetWithCharactersInString:@"/"]];
  NSString *urlString = [NSString stringWithFormat:@"%@/api/github/check-connection", apiUrl];
  NSURL *url = [NSURL URLWithString:urlString];

  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
  request.HTTPMethod = @"POST";
  [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];

  NSDictionary *body = @{@"clerkId": clerkId};
  NSError *jsonError;
  NSData *jsonData = [NSJSONSerialization dataWithJSONObject:body options:0 error:&jsonError];
  if (jsonError) {
    if (completion) {
      completion(NO, nil, jsonError);
    }
    return;
  }
  request.HTTPBody = jsonData;

  NSURLSessionDataTask *task = [self.urlSession dataTaskWithRequest:request
                                                  completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
    if (error) {
      NSLog(@"❌ [EXChatBackendService] GitHub connection check error: %@", error);
      if (completion) {
        completion(NO, nil, error);
      }
      return;
    }

    NSError *parseError;
    id jsonObject = [NSJSONSerialization JSONObjectWithData:data options:0 error:&parseError];
    if (parseError) {
      if (completion) {
        completion(NO, nil, parseError);
      }
      return;
    }

    if ([jsonObject isKindOfClass:[NSDictionary class]]) {
      NSDictionary *result = (NSDictionary *)jsonObject;
      BOOL isConnected = [result[@"isConnected"] boolValue];
      // Handle NSNull from JSON - convert to nil
      id usernameValue = result[@"username"];
      NSString *username = (usernameValue && ![usernameValue isKindOfClass:[NSNull class]]) ? usernameValue : nil;

      NSLog(@"✅ [EXChatBackendService] GitHub connection: connected=%@, username=%@", isConnected ? @"YES" : @"NO", username);

      if (completion) {
        completion(isConnected, username, nil);
      }
    } else {
      if (completion) {
        NSError *formatError = [NSError errorWithDomain:@"EXChatBackendService"
                                                   code:500
                                               userInfo:@{NSLocalizedDescriptionKey: @"Invalid response format"}];
        completion(NO, nil, formatError);
      }
    }
  }];

  [task resume];
}

- (void)exchangeGitHubCode:(NSString *)code
                forClerkId:(NSString *)clerkId
                completion:(void (^)(BOOL success, NSString * _Nullable username, NSError * _Nullable error))completion
{
  NSLog(@"🔄 [EXChatBackendService] Exchanging GitHub OAuth code for clerkId: %@", clerkId);

  if (!code || code.length == 0 || !clerkId || clerkId.length == 0) {
    if (completion) {
      NSError *error = [NSError errorWithDomain:@"EXChatBackendService"
                                           code:400
                                       userInfo:@{NSLocalizedDescriptionKey: @"Missing code or clerkId"}];
      completion(NO, nil, error);
    }
    return;
  }

  NSString *apiUrl = [self.v0ApiUrl stringByTrimmingCharactersInSet:[NSCharacterSet characterSetWithCharactersInString:@"/"]];
  NSString *urlString = [NSString stringWithFormat:@"%@/api/github/exchange-token", apiUrl];
  NSURL *url = [NSURL URLWithString:urlString];

  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
  request.HTTPMethod = @"POST";
  [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];

  NSDictionary *body = @{@"code": code, @"clerkId": clerkId, @"source": @"mobile"};
  NSError *jsonError;
  NSData *jsonData = [NSJSONSerialization dataWithJSONObject:body options:0 error:&jsonError];
  if (jsonError) {
    if (completion) {
      completion(NO, nil, jsonError);
    }
    return;
  }
  request.HTTPBody = jsonData;

  NSURLSessionDataTask *task = [self.urlSession dataTaskWithRequest:request
                                                  completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
    if (error) {
      NSLog(@"❌ [EXChatBackendService] GitHub token exchange error: %@", error);
      if (completion) {
        completion(NO, nil, error);
      }
      return;
    }

    NSError *parseError;
    id jsonObject = [NSJSONSerialization JSONObjectWithData:data options:0 error:&parseError];
    if (parseError) {
      if (completion) {
        completion(NO, nil, parseError);
      }
      return;
    }

    if ([jsonObject isKindOfClass:[NSDictionary class]]) {
      NSDictionary *result = (NSDictionary *)jsonObject;
      BOOL success = [result[@"success"] boolValue];
      // Handle NSNull from JSON - convert to nil
      id usernameValue = result[@"username"];
      id errorValue = result[@"error"];
      NSString *username = (usernameValue && ![usernameValue isKindOfClass:[NSNull class]]) ? usernameValue : nil;
      NSString *errorMsg = (errorValue && ![errorValue isKindOfClass:[NSNull class]]) ? errorValue : nil;

      if (!success && errorMsg) {
        NSError *apiError = [NSError errorWithDomain:@"EXChatBackendService"
                                                code:500
                                            userInfo:@{NSLocalizedDescriptionKey: errorMsg}];
        if (completion) {
          completion(NO, nil, apiError);
        }
        return;
      }

      NSLog(@"✅ [EXChatBackendService] GitHub token exchanged successfully: username=%@", username);

      if (completion) {
        completion(success, username, nil);
      }
    } else {
      if (completion) {
        NSError *formatError = [NSError errorWithDomain:@"EXChatBackendService"
                                                   code:500
                                               userInfo:@{NSLocalizedDescriptionKey: @"Invalid response format"}];
        completion(NO, nil, formatError);
      }
    }
  }];

  [task resume];
}

- (void)disconnectGitHubForClerkId:(NSString *)clerkId
                        completion:(EXChatBackendVoidCallback)completion
{
  NSLog(@"🔌 [EXChatBackendService] Disconnecting GitHub for clerkId: %@", clerkId);

  if (!clerkId || clerkId.length == 0) {
    if (completion) {
      NSError *error = [NSError errorWithDomain:@"EXChatBackendService"
                                           code:400
                                       userInfo:@{NSLocalizedDescriptionKey: @"Missing clerkId"}];
      completion(error);
    }
    return;
  }

  NSString *apiUrl = [self.v0ApiUrl stringByTrimmingCharactersInSet:[NSCharacterSet characterSetWithCharactersInString:@"/"]];
  NSString *urlString = [NSString stringWithFormat:@"%@/api/github/disconnect", apiUrl];
  NSURL *url = [NSURL URLWithString:urlString];

  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
  request.HTTPMethod = @"POST";
  [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];

  NSDictionary *body = @{@"clerkId": clerkId};
  NSError *jsonError;
  NSData *jsonData = [NSJSONSerialization dataWithJSONObject:body options:0 error:&jsonError];
  if (jsonError) {
    if (completion) {
      completion(jsonError);
    }
    return;
  }
  request.HTTPBody = jsonData;

  NSURLSessionDataTask *task = [self.urlSession dataTaskWithRequest:request
                                                  completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
    if (error) {
      NSLog(@"❌ [EXChatBackendService] GitHub disconnect error: %@", error);
      if (completion) {
        completion(error);
      }
      return;
    }

    NSError *parseError;
    id jsonObject = [NSJSONSerialization JSONObjectWithData:data options:0 error:&parseError];
    if (parseError) {
      if (completion) {
        completion(parseError);
      }
      return;
    }

    if ([jsonObject isKindOfClass:[NSDictionary class]]) {
      NSDictionary *result = (NSDictionary *)jsonObject;
      BOOL success = [result[@"success"] boolValue];

      if (!success) {
        NSString *errorMsg = result[@"error"] ?: @"Failed to disconnect GitHub";
        NSError *apiError = [NSError errorWithDomain:@"EXChatBackendService"
                                                code:500
                                            userInfo:@{NSLocalizedDescriptionKey: errorMsg}];
        if (completion) {
          completion(apiError);
        }
        return;
      }

      NSLog(@"✅ [EXChatBackendService] GitHub disconnected successfully");

      if (completion) {
        completion(nil);
      }
    } else {
      if (completion) {
        NSError *formatError = [NSError errorWithDomain:@"EXChatBackendService"
                                                   code:500
                                               userInfo:@{NSLocalizedDescriptionKey: @"Invalid response format"}];
        completion(formatError);
      }
    }
  }];

  [task resume];
}

- (void)createAndPushToGitHubWithSessionId:(NSString *)sessionId
                                  convexId:(NSString *)convexId
                                  repoName:(NSString *)repoName
                                 isPrivate:(BOOL)isPrivate
                                   clerkId:(NSString *)clerkId
                                completion:(void (^)(BOOL success, NSString * _Nullable repository, NSString * _Nullable repositoryUrl, NSError * _Nullable error))completion
{
  NSLog(@"🚀 [EXChatBackendService] Creating GitHub repo and pushing: %@ (private=%@)", repoName, isPrivate ? @"YES" : @"NO");

  if (!sessionId || !convexId || !repoName || !clerkId) {
    if (completion) {
      NSError *error = [NSError errorWithDomain:@"EXChatBackendService"
                                           code:400
                                       userInfo:@{NSLocalizedDescriptionKey: @"Missing required parameters"}];
      completion(NO, nil, nil, error);
    }
    return;
  }

  NSString *apiUrl = [self.v0ApiUrl stringByTrimmingCharactersInSet:[NSCharacterSet characterSetWithCharactersInString:@"/"]];
  NSString *urlString = [NSString stringWithFormat:@"%@/api/github/create-and-push", apiUrl];
  NSURL *url = [NSURL URLWithString:urlString];

  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
  request.HTTPMethod = @"POST";
  [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];

  NSDictionary *body = @{
    @"sessionId": sessionId,
    @"convexId": convexId,
    @"repoName": repoName,
    @"isPrivate": @(isPrivate),
    @"clerkId": clerkId
  };

  NSError *jsonError;
  NSData *jsonData = [NSJSONSerialization dataWithJSONObject:body options:0 error:&jsonError];
  if (jsonError) {
    if (completion) {
      completion(NO, nil, nil, jsonError);
    }
    return;
  }
  request.HTTPBody = jsonData;

  NSURLSessionDataTask *task = [self.urlSession dataTaskWithRequest:request
                                                  completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
    if (error) {
      NSLog(@"❌ [EXChatBackendService] GitHub create-and-push error: %@", error);
      if (completion) {
        completion(NO, nil, nil, error);
      }
      return;
    }

    NSError *parseError;
    id jsonObject = [NSJSONSerialization JSONObjectWithData:data options:0 error:&parseError];
    if (parseError) {
      if (completion) {
        completion(NO, nil, nil, parseError);
      }
      return;
    }

    if ([jsonObject isKindOfClass:[NSDictionary class]]) {
      NSDictionary *result = (NSDictionary *)jsonObject;
      BOOL success = [result[@"success"] boolValue];
      // Handle NSNull from JSON - convert to nil
      id repositoryValue = result[@"repository"];
      id repositoryUrlValue = result[@"repositoryUrl"];
      id errorValue = result[@"error"];
      NSString *repository = (repositoryValue && ![repositoryValue isKindOfClass:[NSNull class]]) ? repositoryValue : nil;
      NSString *repositoryUrl = (repositoryUrlValue && ![repositoryUrlValue isKindOfClass:[NSNull class]]) ? repositoryUrlValue : nil;
      NSString *errorMsg = (errorValue && ![errorValue isKindOfClass:[NSNull class]]) ? errorValue : nil;

      if (!success) {
        NSError *apiError = [NSError errorWithDomain:@"EXChatBackendService"
                                                code:500
                                            userInfo:@{NSLocalizedDescriptionKey: errorMsg ?: @"Failed to create repository"}];
        if (completion) {
          completion(NO, nil, nil, apiError);
        }
        return;
      }

      NSLog(@"✅ [EXChatBackendService] GitHub repo created: %@ -> %@", repository, repositoryUrl);

      if (completion) {
        completion(YES, repository, repositoryUrl, nil);
      }
    } else {
      if (completion) {
        NSError *formatError = [NSError errorWithDomain:@"EXChatBackendService"
                                                   code:500
                                               userInfo:@{NSLocalizedDescriptionKey: @"Invalid response format"}];
        completion(NO, nil, nil, formatError);
      }
    }
  }];

  [task resume];
}

- (void)retryGitHubPushWithSessionId:(NSString *)sessionId
                            convexId:(NSString *)convexId
                          repository:(NSString *)repository
                             clerkId:(NSString *)clerkId
                          completion:(EXChatBackendVoidCallback)completion
{
  NSLog(@"🔄 [EXChatBackendService] Retrying GitHub push for: %@", repository);

  if (!sessionId || !convexId || !repository || !clerkId) {
    if (completion) {
      NSError *error = [NSError errorWithDomain:@"EXChatBackendService"
                                           code:400
                                       userInfo:@{NSLocalizedDescriptionKey: @"Missing required parameters"}];
      completion(error);
    }
    return;
  }

  NSString *apiUrl = [self.v0ApiUrl stringByTrimmingCharactersInSet:[NSCharacterSet characterSetWithCharactersInString:@"/"]];
  NSString *urlString = [NSString stringWithFormat:@"%@/api/github/retry-push", apiUrl];
  NSURL *url = [NSURL URLWithString:urlString];

  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
  request.HTTPMethod = @"POST";
  [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];

  NSDictionary *body = @{
    @"sessionId": sessionId,
    @"convexId": convexId,
    @"repository": repository,
    @"clerkId": clerkId
  };

  NSError *jsonError;
  NSData *jsonData = [NSJSONSerialization dataWithJSONObject:body options:0 error:&jsonError];
  if (jsonError) {
    if (completion) {
      completion(jsonError);
    }
    return;
  }
  request.HTTPBody = jsonData;

  NSURLSessionDataTask *task = [self.urlSession dataTaskWithRequest:request
                                                  completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
    if (error) {
      NSLog(@"❌ [EXChatBackendService] GitHub retry-push error: %@", error);
      if (completion) {
        completion(error);
      }
      return;
    }

    NSError *parseError;
    id jsonObject = [NSJSONSerialization JSONObjectWithData:data options:0 error:&parseError];
    if (parseError) {
      if (completion) {
        completion(parseError);
      }
      return;
    }

    if ([jsonObject isKindOfClass:[NSDictionary class]]) {
      NSDictionary *result = (NSDictionary *)jsonObject;
      BOOL success = [result[@"success"] boolValue];

      if (!success) {
        NSString *errorMsg = result[@"error"] ?: @"Failed to retry push";
        NSError *apiError = [NSError errorWithDomain:@"EXChatBackendService"
                                                code:500
                                            userInfo:@{NSLocalizedDescriptionKey: errorMsg}];
        if (completion) {
          completion(apiError);
        }
        return;
      }

      NSLog(@"✅ [EXChatBackendService] GitHub push retry initiated");

      if (completion) {
        completion(nil);
      }
    } else {
      if (completion) {
        NSError *formatError = [NSError errorWithDomain:@"EXChatBackendService"
                                                   code:500
                                               userInfo:@{NSLocalizedDescriptionKey: @"Invalid response format"}];
        completion(formatError);
      }
    }
  }];

  [task resume];
}

- (void)getGitHubStatusForSession:(NSString *)convexId
                       completion:(void (^)(NSDictionary * _Nullable status, NSError * _Nullable error))completion
{
  NSLog(@"📊 [EXChatBackendService] Getting GitHub status for session: %@", convexId);

  if (!convexId || convexId.length == 0) {
    if (completion) {
      NSError *error = [NSError errorWithDomain:@"EXChatBackendService"
                                           code:400
                                       userInfo:@{NSLocalizedDescriptionKey: @"Missing convexId"}];
      completion(nil, error);
    }
    return;
  }

  NSString *apiUrl = [self.v0ApiUrl stringByTrimmingCharactersInSet:[NSCharacterSet characterSetWithCharactersInString:@"/"]];
  NSString *encodedConvexId = [convexId stringByAddingPercentEncodingWithAllowedCharacters:[NSCharacterSet URLQueryAllowedCharacterSet]];
  NSString *urlString = [NSString stringWithFormat:@"%@/api/github/status?convexId=%@", apiUrl, encodedConvexId];
  NSURL *url = [NSURL URLWithString:urlString];

  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
  request.HTTPMethod = @"GET";

  NSURLSessionDataTask *task = [self.urlSession dataTaskWithRequest:request
                                                  completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
    if (error) {
      NSLog(@"❌ [EXChatBackendService] GitHub status error: %@", error);
      if (completion) {
        completion(nil, error);
      }
      return;
    }

    NSError *parseError;
    id jsonObject = [NSJSONSerialization JSONObjectWithData:data options:0 error:&parseError];
    if (parseError) {
      if (completion) {
        completion(nil, parseError);
      }
      return;
    }

    if ([jsonObject isKindOfClass:[NSDictionary class]]) {
      NSDictionary *status = (NSDictionary *)jsonObject;

      // Check for error in response
      if (status[@"error"]) {
        NSError *apiError = [NSError errorWithDomain:@"EXChatBackendService"
                                                code:500
                                            userInfo:@{NSLocalizedDescriptionKey: status[@"error"]}];
        if (completion) {
          completion(nil, apiError);
        }
        return;
      }

      NSLog(@"✅ [EXChatBackendService] GitHub status: repo=%@, pushStatus=%@",
            status[@"githubRepository"], status[@"githubPushStatus"]);

      if (completion) {
        completion(status, nil);
      }
    } else {
      if (completion) {
        NSError *formatError = [NSError errorWithDomain:@"EXChatBackendService"
                                                   code:500
                                               userInfo:@{NSLocalizedDescriptionKey: @"Invalid response format"}];
        completion(nil, formatError);
      }
    }
  }];

  [task resume];
}

#pragma mark - Dev Server Management

- (void)restartDevServerForSession:(NSString *)sessionId
                        completion:(EXChatBackendVoidCallback)completion
{
  if (!sessionId || sessionId.length == 0) {
    NSLog(@"❌ [EXChatBackendService] Restart dev server error: Session ID is required");
    if (completion) {
      completion([NSError errorWithDomain:@"EXChatBackendService"
                                     code:400
                                 userInfo:@{NSLocalizedDescriptionKey: @"Session ID is required"}]);
    }
    return;
  }

  NSLog(@"🔄 [EXChatBackendService] Restarting dev server for session: %@", sessionId);

  NSString *urlString = [NSString stringWithFormat:@"%@/api/session/restart-dev-server", self.v0ApiUrl];
  NSURL *url = [NSURL URLWithString:urlString];

  NSMutableURLRequest *request = [[NSMutableURLRequest alloc] initWithURL:url];
  request.HTTPMethod = @"POST";
  [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];

  NSDictionary *body = @{@"sessionId": sessionId};
  NSError *jsonError;
  NSData *jsonData = [NSJSONSerialization dataWithJSONObject:body options:0 error:&jsonError];

  if (jsonError) {
    NSLog(@"❌ [EXChatBackendService] JSON serialization error: %@", jsonError);
    if (completion) {
      completion(jsonError);
    }
    return;
  }

  request.HTTPBody = jsonData;

  NSURLSessionDataTask *task = [self.urlSession dataTaskWithRequest:request completionHandler:^(NSData * _Nullable data, NSURLResponse * _Nullable response, NSError * _Nullable error) {
    if (error) {
      NSLog(@"❌ [EXChatBackendService] Network error restarting dev server: %@", error);
      if (completion) {
        completion(error);
      }
      return;
    }

    NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *)response;
    NSLog(@"📡 [EXChatBackendService] Restart dev server response status: %ld", (long)httpResponse.statusCode);

    if (httpResponse.statusCode < 200 || httpResponse.statusCode >= 300) {
      NSString *errorMessage = @"Failed to restart dev server";
      if (data) {
        NSString *responseText = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
        NSLog(@"❌ [EXChatBackendService] Error response: %@", responseText);
        errorMessage = [NSString stringWithFormat:@"Failed to restart dev server: %@", responseText];
      }
      if (completion) {
        completion([NSError errorWithDomain:@"EXChatBackendService"
                                       code:httpResponse.statusCode
                                   userInfo:@{NSLocalizedDescriptionKey: errorMessage}]);
      }
      return;
    }

    if (data) {
      NSError *parseError;
      NSDictionary *result = [NSJSONSerialization JSONObjectWithData:data options:0 error:&parseError];

      if (parseError) {
        NSLog(@"❌ [EXChatBackendService] JSON parse error: %@", parseError);
        if (completion) {
          completion(parseError);
        }
        return;
      }

      if ([result[@"success"] boolValue]) {
        NSLog(@"✅ [EXChatBackendService] Dev server restarted successfully for session: %@", sessionId);
        if (completion) {
          completion(nil);
        }
      } else {
        NSString *errorMsg = result[@"error"] ?: @"Failed to restart dev server";
        NSLog(@"❌ [EXChatBackendService] Restart failed: %@", errorMsg);
        if (completion) {
          completion([NSError errorWithDomain:@"EXChatBackendService"
                                         code:500
                                     userInfo:@{NSLocalizedDescriptionKey: errorMsg}]);
        }
      }
    } else {
      NSLog(@"✅ [EXChatBackendService] Dev server restart completed (no response body)");
      if (completion) {
        completion(nil);
      }
    }
  }];

  [task resume];
}

#pragma mark - Audio/Video Upload

- (void)uploadAudioWithData:(NSData *)audioData
                   fileName:(NSString *)fileName
                  sessionId:(NSString *)sessionId
                 completion:(EXChatBackendImageUploadCallback)completion
{
  if (!audioData || audioData.length == 0) {
    if (completion) {
      completion(nil, [NSError errorWithDomain:@"EXChatBackendService" code:400 userInfo:@{NSLocalizedDescriptionKey: @"Audio data is required"}]);
    }
    return;
  }

  if (!sessionId || sessionId.length == 0) {
    if (completion) {
      completion(nil, [NSError errorWithDomain:@"EXChatBackendService" code:400 userInfo:@{NSLocalizedDescriptionKey: @"Session ID is required"}]);
    }
    return;
  }

  // Use the generic upload endpoint that handles audio files
  NSString *apiUrl = [self.v0ApiUrl stringByTrimmingCharactersInSet:[NSCharacterSet characterSetWithCharactersInString:@"/"]];
  NSString *urlString = [NSString stringWithFormat:@"%@/api/upload-audio", apiUrl];
  NSURL *url = [NSURL URLWithString:urlString];

  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
  request.HTTPMethod = @"POST";

  NSString *boundary = [[NSUUID UUID] UUIDString];
  NSString *contentType = [NSString stringWithFormat:@"multipart/form-data; boundary=%@", boundary];
  [request setValue:contentType forHTTPHeaderField:@"Content-Type"];
  [request setValue:sessionId forHTTPHeaderField:@"x-session-id"];

  // Determine MIME type based on file extension
  NSString *mimeType = @"audio/mpeg";
  if ([fileName.lowercaseString hasSuffix:@".wav"]) {
    mimeType = @"audio/wav";
  } else if ([fileName.lowercaseString hasSuffix:@".m4a"]) {
    mimeType = @"audio/m4a";
  } else if ([fileName.lowercaseString hasSuffix:@".aac"]) {
    mimeType = @"audio/aac";
  }

  NSMutableData *body = [NSMutableData data];

  [body appendData:[[NSString stringWithFormat:@"--%@\r\n", boundary] dataUsingEncoding:NSUTF8StringEncoding]];
  [body appendData:[[NSString stringWithFormat:@"Content-Disposition: form-data; name=\"file\"; filename=\"%@\"\r\n", fileName ?: @"audio.mp3"] dataUsingEncoding:NSUTF8StringEncoding]];
  [body appendData:[[NSString stringWithFormat:@"Content-Type: %@\r\n\r\n", mimeType] dataUsingEncoding:NSUTF8StringEncoding]];
  [body appendData:audioData];
  [body appendData:[@"\r\n" dataUsingEncoding:NSUTF8StringEncoding]];
  [body appendData:[[NSString stringWithFormat:@"--%@--\r\n", boundary] dataUsingEncoding:NSUTF8StringEncoding]];

  request.HTTPBody = body;

  NSLog(@"🎵 [EXChatBackendService] Uploading audio %@ to session %@", fileName, sessionId);

  NSURLSessionDataTask *task = [self.urlSession dataTaskWithRequest:request completionHandler:^(NSData * _Nullable data, NSURLResponse * _Nullable response, NSError * _Nullable error) {
    if (error) {
      NSLog(@"❌ [EXChatBackendService] Audio upload error: %@", error.localizedDescription);
      if (completion) {
        completion(nil, error);
      }
      return;
    }

    NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *)response;
    if (httpResponse.statusCode != 200) {
      NSString *errorMessage = @"Upload failed";
      if (data) {
        NSError *parseError;
        id jsonObject = [NSJSONSerialization JSONObjectWithData:data options:0 error:&parseError];
        if (!parseError && [jsonObject isKindOfClass:[NSDictionary class]]) {
          errorMessage = jsonObject[@"error"] ?: errorMessage;
        }
      }
      NSLog(@"❌ [EXChatBackendService] Audio upload HTTP error %ld: %@", (long)httpResponse.statusCode, errorMessage);
      NSError *httpError = [NSError errorWithDomain:@"EXChatBackendService"
                                                code:httpResponse.statusCode
                                            userInfo:@{NSLocalizedDescriptionKey: errorMessage}];
      if (completion) {
        completion(nil, httpError);
      }
      return;
    }

    NSError *parseError;
    id jsonObject = [NSJSONSerialization JSONObjectWithData:data options:0 error:&parseError];
    if (parseError) {
      if (completion) {
        completion(nil, parseError);
      }
      return;
    }

    if ([jsonObject isKindOfClass:[NSDictionary class]]) {
      NSDictionary *result = (NSDictionary *)jsonObject;
      NSLog(@"✅ [EXChatBackendService] Audio uploaded: %@ -> %@", fileName, result[@"path"]);
      if (completion) {
        completion(result, nil);
      }
    } else {
      if (completion) {
        completion(nil, [NSError errorWithDomain:@"EXChatBackendService" code:500 userInfo:@{NSLocalizedDescriptionKey: @"Invalid response format"}]);
      }
    }
  }];

  [task resume];
}

- (void)uploadVideoWithData:(NSData *)videoData
                   fileName:(NSString *)fileName
                  sessionId:(NSString *)sessionId
                 completion:(EXChatBackendImageUploadCallback)completion
{
  if (!videoData || videoData.length == 0) {
    if (completion) {
      completion(nil, [NSError errorWithDomain:@"EXChatBackendService" code:400 userInfo:@{NSLocalizedDescriptionKey: @"Video data is required"}]);
    }
    return;
  }

  if (!sessionId || sessionId.length == 0) {
    if (completion) {
      completion(nil, [NSError errorWithDomain:@"EXChatBackendService" code:400 userInfo:@{NSLocalizedDescriptionKey: @"Session ID is required"}]);
    }
    return;
  }

  // Use the generic upload endpoint that handles video files
  NSString *apiUrl = [self.v0ApiUrl stringByTrimmingCharactersInSet:[NSCharacterSet characterSetWithCharactersInString:@"/"]];
  NSString *urlString = [NSString stringWithFormat:@"%@/api/upload-video", apiUrl];
  NSURL *url = [NSURL URLWithString:urlString];

  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
  request.HTTPMethod = @"POST";

  NSString *boundary = [[NSUUID UUID] UUIDString];
  NSString *contentType = [NSString stringWithFormat:@"multipart/form-data; boundary=%@", boundary];
  [request setValue:contentType forHTTPHeaderField:@"Content-Type"];
  [request setValue:sessionId forHTTPHeaderField:@"x-session-id"];

  // Determine MIME type based on file extension
  NSString *mimeType = @"video/mp4";
  if ([fileName.lowercaseString hasSuffix:@".mov"]) {
    mimeType = @"video/quicktime";
  } else if ([fileName.lowercaseString hasSuffix:@".webm"]) {
    mimeType = @"video/webm";
  } else if ([fileName.lowercaseString hasSuffix:@".avi"]) {
    mimeType = @"video/avi";
  }

  NSMutableData *body = [NSMutableData data];

  [body appendData:[[NSString stringWithFormat:@"--%@\r\n", boundary] dataUsingEncoding:NSUTF8StringEncoding]];
  [body appendData:[[NSString stringWithFormat:@"Content-Disposition: form-data; name=\"file\"; filename=\"%@\"\r\n", fileName ?: @"video.mp4"] dataUsingEncoding:NSUTF8StringEncoding]];
  [body appendData:[[NSString stringWithFormat:@"Content-Type: %@\r\n\r\n", mimeType] dataUsingEncoding:NSUTF8StringEncoding]];
  [body appendData:videoData];
  [body appendData:[@"\r\n" dataUsingEncoding:NSUTF8StringEncoding]];
  [body appendData:[[NSString stringWithFormat:@"--%@--\r\n", boundary] dataUsingEncoding:NSUTF8StringEncoding]];

  request.HTTPBody = body;

  NSLog(@"🎬 [EXChatBackendService] Uploading video %@ to session %@", fileName, sessionId);

  NSURLSessionDataTask *task = [self.urlSession dataTaskWithRequest:request completionHandler:^(NSData * _Nullable data, NSURLResponse * _Nullable response, NSError * _Nullable error) {
    if (error) {
      NSLog(@"❌ [EXChatBackendService] Video upload error: %@", error.localizedDescription);
      if (completion) {
        completion(nil, error);
      }
      return;
    }

    NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *)response;
    if (httpResponse.statusCode != 200) {
      NSString *errorMessage = @"Upload failed";
      if (data) {
        NSError *parseError;
        id jsonObject = [NSJSONSerialization JSONObjectWithData:data options:0 error:&parseError];
        if (!parseError && [jsonObject isKindOfClass:[NSDictionary class]]) {
          errorMessage = jsonObject[@"error"] ?: errorMessage;
        }
      }
      NSLog(@"❌ [EXChatBackendService] Video upload HTTP error %ld: %@", (long)httpResponse.statusCode, errorMessage);
      NSError *httpError = [NSError errorWithDomain:@"EXChatBackendService"
                                                code:httpResponse.statusCode
                                            userInfo:@{NSLocalizedDescriptionKey: errorMessage}];
      if (completion) {
        completion(nil, httpError);
      }
      return;
    }

    NSError *parseError;
    id jsonObject = [NSJSONSerialization JSONObjectWithData:data options:0 error:&parseError];
    if (parseError) {
      if (completion) {
        completion(nil, parseError);
      }
      return;
    }

    if ([jsonObject isKindOfClass:[NSDictionary class]]) {
      NSDictionary *result = (NSDictionary *)jsonObject;
      NSLog(@"✅ [EXChatBackendService] Video uploaded: %@ -> %@", fileName, result[@"path"]);
      if (completion) {
        completion(result, nil);
      }
    } else {
      if (completion) {
        completion(nil, [NSError errorWithDomain:@"EXChatBackendService" code:500 userInfo:@{NSLocalizedDescriptionKey: @"Invalid response format"}]);
      }
    }
  }];

  [task resume];
}

#pragma mark - Send Message with All Media

- (void)sendMessageWithSessionId:(NSString *)sessionId
                             role:(NSString *)role
                          content:(NSString *)content
                           images:(NSArray<NSDictionary *> *)images
                           audios:(NSArray<NSDictionary *> *)audios
                           videos:(NSArray<NSDictionary *> *)videos
                       completion:(EXChatBackendMessageCallback)completion
{
  if (!sessionId || sessionId.length == 0) {
    if (completion) {
      completion(nil, [NSError errorWithDomain:@"EXChatBackendService" code:400 userInfo:@{NSLocalizedDescriptionKey: @"Session ID is required"}]);
    }
    return;
  }

  if (!role || !content) {
    if (completion) {
      completion(nil, [NSError errorWithDomain:@"EXChatBackendService" code:400 userInfo:@{NSLocalizedDescriptionKey: @"Role and content are required"}]);
    }
    return;
  }

  // Call Convex mutation: POST to /api/mutation
  NSString *urlString = [NSString stringWithFormat:@"%@/api/mutation", self.convexUrl];
  NSURL *url = [NSURL URLWithString:urlString];

  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
  request.HTTPMethod = @"POST";
  [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];

  // Build args dictionary - content stays clean (no embedded paths)
  NSMutableDictionary *args = [NSMutableDictionary dictionaryWithDictionary:@{
    @"sessionId": sessionId,
    @"role": role,
    @"content": content
  }];

  // Add images array if provided
  if (images && images.count > 0) {
    NSMutableArray *imagesArg = [NSMutableArray array];
    for (NSDictionary *image in images) {
      NSString *fileName = image[@"fileName"];
      NSString *path = image[@"path"];
      if (path && path.length > 0) {
        NSMutableDictionary *imageDict = [NSMutableDictionary dictionaryWithDictionary:@{
          @"fileName": fileName ?: @"image.jpg",
          @"path": path
        }];
        NSString *storageId = image[@"storageId"];
        if (storageId && storageId.length > 0) {
          imageDict[@"storageId"] = storageId;
        }
        [imagesArg addObject:imageDict];
      }
    }
    if (imagesArg.count > 0) {
      args[@"images"] = imagesArg;
    }
  }

  // Add audios array if provided
  if (audios && audios.count > 0) {
    NSMutableArray *audiosArg = [NSMutableArray array];
    for (NSDictionary *audio in audios) {
      NSString *fileName = audio[@"fileName"];
      NSString *path = audio[@"path"];
      if (path && path.length > 0) {
        [audiosArg addObject:@{
          @"fileName": fileName ?: @"audio.mp3",
          @"path": path
        }];
      }
    }
    if (audiosArg.count > 0) {
      args[@"audios"] = audiosArg;
    }
  }

  // Add videos array if provided
  if (videos && videos.count > 0) {
    NSMutableArray *videosArg = [NSMutableArray array];
    for (NSDictionary *video in videos) {
      NSString *fileName = video[@"fileName"];
      NSString *path = video[@"path"];
      if (path && path.length > 0) {
        [videosArg addObject:@{
          @"fileName": fileName ?: @"video.mp4",
          @"path": path
        }];
      }
    }
    if (videosArg.count > 0) {
      args[@"videos"] = videosArg;
    }
  }

  // Convex HTTP API: send path and args in body
  NSDictionary *body = @{
    @"path": @"messages:add",
    @"args": args
  };

  NSLog(@"📤 [EXChatBackendService] Sending message with media:");
  NSLog(@"   - Content: %@", [content substringToIndex:MIN(content.length, 50)]);
  NSLog(@"   - Images: %lu, Audios: %lu, Videos: %lu", (unsigned long)(images.count), (unsigned long)(audios.count), (unsigned long)(videos.count));

  NSError *jsonError;
  NSData *jsonData = [NSJSONSerialization dataWithJSONObject:body options:0 error:&jsonError];
  if (jsonError) {
    if (completion) {
      completion(nil, jsonError);
    }
    return;
  }
  request.HTTPBody = jsonData;

  NSURLSessionDataTask *task = [self.urlSession dataTaskWithRequest:request completionHandler:^(NSData * _Nullable data, NSURLResponse * _Nullable response, NSError * _Nullable error) {
    if (error) {
      if (completion) {
        completion(nil, error);
      }
      return;
    }

    NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *)response;
    if (httpResponse.statusCode != 200) {
      NSError *httpError = [NSError errorWithDomain:@"EXChatBackendService"
                                                code:httpResponse.statusCode
                                            userInfo:@{NSLocalizedDescriptionKey: [NSString stringWithFormat:@"HTTP error: %ld", (long)httpResponse.statusCode]}];
      if (completion) {
        completion(nil, httpError);
      }
      return;
    }

    NSError *parseError;
    id jsonObject = [NSJSONSerialization JSONObjectWithData:data options:0 error:&parseError];
    if (parseError) {
      if (completion) {
        completion(nil, parseError);
      }
      return;
    }

    if ([jsonObject isKindOfClass:[NSDictionary class]]) {
      NSDictionary *responseDict = (NSDictionary *)jsonObject;
      NSString *status = responseDict[@"status"];

      if ([status isEqualToString:@"error"]) {
        NSString *errorMessage = responseDict[@"errorMessage"] ?: @"Unknown error";
        NSError *convexError = [NSError errorWithDomain:@"EXChatBackendService"
                                                    code:500
                                                userInfo:@{NSLocalizedDescriptionKey: errorMessage}];
        if (completion) {
          completion(nil, convexError);
        }
        return;
      }

      // Success - extract message ID from value
      NSString *messageId = responseDict[@"value"];
      NSLog(@"✅ [EXChatBackendService] Message sent with media, ID: %@", messageId);
      if (completion) {
        completion(messageId, nil);
      }
    } else {
      if (completion) {
        completion(nil, [NSError errorWithDomain:@"EXChatBackendService" code:500 userInfo:@{NSLocalizedDescriptionKey: @"Invalid response format"}]);
      }
    }
  }];

  [task resume];
}

@end

