// Copyright 2015-present 650 Industries. All rights reserved.

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@class EXChatBackendService;

// Callback types
typedef void (^EXChatBackendSessionCallback)(NSDictionary * _Nullable session, NSError * _Nullable error);
typedef void (^EXChatBackendMessagesCallback)(NSArray<NSDictionary *> * _Nullable messages, NSError * _Nullable error);
typedef void (^EXChatBackendMessageCallback)(NSString * _Nullable messageId, NSError * _Nullable error);
typedef void (^EXChatBackendVoidCallback)(NSError * _Nullable error);
typedef void (^EXChatBackendImageUploadCallback)(NSDictionary * _Nullable result, NSError * _Nullable error);
typedef void (^EXChatBackendStorageUrlCallback)(NSURL * _Nullable url, NSError * _Nullable error);

/**
 * Backend service for chat functionality
 * Handles Convex API calls and v0-clone API integration
 */
@interface EXChatBackendService : NSObject

/**
 * Singleton instance
 */
+ (instancetype)sharedInstance;

/**
 * Configure the service with API URLs
 * @param convexUrl The Convex API URL (e.g., https://xxx.convex.cloud)
 * @param v0ApiUrl The v0-clone API URL (e.g., https://your-app.example.com)
 */
- (void)configureWithConvexUrl:(NSString *)convexUrl v0ApiUrl:(NSString *)v0ApiUrl;

/**
 * Find session by manifest URL
 * @param manifestUrl The manifest URL to match (e.g., exp://192.168.1.100:8081)
 * @param completion Callback with session dictionary or error
 */
- (void)findSessionByManifestUrl:(NSString *)manifestUrl completion:(EXChatBackendSessionCallback)completion;

/**
 * List sessions filtered by user
 * @param clerkId The user's Clerk ID (optional - returns empty if nil due to backend security)
 * @param completion Callback with array of session dictionaries or error
 */
- (void)listSessionsForClerkId:(NSString * _Nullable)clerkId
                    completion:(void (^)(NSArray<NSDictionary *> * _Nullable, NSError * _Nullable))completion;

/**
 * Fetch messages for a session
 * @param sessionId The Convex session ID
 * @param completion Callback with array of message dictionaries or error
 */
- (void)fetchMessagesForSession:(NSString *)sessionId completion:(EXChatBackendMessagesCallback)completion;

/**
 * Send a message
 * @param sessionId The Convex session ID
 * @param role Message role ("user" or "assistant")
 * @param content Message content
 * @param completion Callback with message ID or error
 */
- (void)sendMessageWithSessionId:(NSString *)sessionId
                             role:(NSString *)role
                          content:(NSString *)content
                       completion:(EXChatBackendMessageCallback)completion;

/**
 * Send a message with image attachment
 * @param sessionId The Convex session ID
 * @param role Message role ("user" or "assistant")
 * @param content Message content
 * @param image Image data dictionary with fileName, path, storageId
 * @param completion Callback with message ID or error
 */
- (void)sendMessageWithSessionId:(NSString *)sessionId
                             role:(NSString *)role
                          content:(NSString *)content
                            image:(NSDictionary * _Nullable)image
                       completion:(EXChatBackendMessageCallback)completion;

/**
 * Send a message with multiple image attachments
 * Stores paths in separate 'images' field so they are not visible to users
 * @param sessionId The Convex session ID
 * @param role Message role ("user" or "assistant")
 * @param content Message content (clean, no embedded paths)
 * @param images Array of image data dictionaries with fileName, path, storageId
 * @param completion Callback with message ID or error
 */
- (void)sendMessageWithSessionId:(NSString *)sessionId
                             role:(NSString *)role
                          content:(NSString *)content
                           images:(NSArray<NSDictionary *> * _Nullable)images
                       completion:(EXChatBackendMessageCallback)completion;

/**
 * Send a message with multiple media attachments (images, audios, videos)
 * Stores paths in separate fields so they are not visible to users
 * @param sessionId The Convex session ID
 * @param role Message role ("user" or "assistant")
 * @param content Message content (clean, no embedded paths)
 * @param images Array of image data dictionaries with fileName, path, storageId
 * @param audios Array of audio data dictionaries with fileName, path
 * @param videos Array of video data dictionaries with fileName, path
 * @param completion Callback with message ID or error
 */
- (void)sendMessageWithSessionId:(NSString *)sessionId
                             role:(NSString *)role
                          content:(NSString *)content
                           images:(NSArray<NSDictionary *> * _Nullable)images
                           audios:(NSArray<NSDictionary *> * _Nullable)audios
                           videos:(NSArray<NSDictionary *> * _Nullable)videos
                       completion:(EXChatBackendMessageCallback)completion;

/**
 * Trigger AI response via v0-clone API
 * @param sessionId The session ID string (not Convex ID)
 * @param convexSessionId The Convex session ID
 * @param message The user message
 * @param repository Optional repository name
 * @param model Optional Claude model identifier (e.g., "claude-sonnet-4-5")
 * @param completion Callback with error if any
 */
- (void)triggerAIResponseWithSessionId:(NSString *)sessionId
                       convexSessionId:(NSString *)convexSessionId
                               message:(NSString *)message
                            repository:(NSString * _Nullable)repository
                                 model:(NSString * _Nullable)model
                            completion:(EXChatBackendVoidCallback)completion;

/**
 * Get session by ID
 * @param sessionId The Convex session ID
 * @param completion Callback with session dictionary or error
 */
- (void)getSessionById:(NSString *)sessionId completion:(EXChatBackendSessionCallback)completion;

/**
 * Upload an image to the sandbox
 * @param imageData The image data (PNG/JPEG)
 * @param fileName The original file name
 * @param mimeType The MIME type of the image (e.g., image/jpeg, image/png)
 * @param sessionId The sandbox session ID
 * @param completion Callback with result dictionary containing path, fileName, size, storageId or error
 */
- (void)uploadImageWithData:(NSData *)imageData
                   fileName:(NSString *)fileName
                   mimeType:(NSString *)mimeType
                  sessionId:(NSString *)sessionId
                 completion:(EXChatBackendImageUploadCallback)completion;

/**
 * Upload an audio file to the sandbox
 * @param audioData The audio data
 * @param fileName The original file name
 * @param sessionId The sandbox session ID
 * @param completion Callback with result dictionary containing path, fileName, size or error
 */
- (void)uploadAudioWithData:(NSData *)audioData
                   fileName:(NSString *)fileName
                  sessionId:(NSString *)sessionId
                 completion:(EXChatBackendImageUploadCallback)completion;

/**
 * Upload a video file to the sandbox
 * @param videoData The video data
 * @param fileName The original file name
 * @param sessionId The sandbox session ID
 * @param completion Callback with result dictionary containing path, fileName, size or error
 */
- (void)uploadVideoWithData:(NSData *)videoData
                   fileName:(NSString *)fileName
                  sessionId:(NSString *)sessionId
                 completion:(EXChatBackendImageUploadCallback)completion;

/**
 * Get storage URL for a Convex storage ID
 * @param storageId The Convex storage ID
 * @param completion Callback with the signed URL or error
 */
- (void)getStorageUrlForId:(NSString *)storageId
                completion:(EXChatBackendStorageUrlCallback)completion;

/**
 * Add environment variable to session
 * @param sessionId The session ID string
 * @param key The ENV key name
 * @param value The ENV value
 * @param completion Callback with error if any
 */
- (void)addEnvWithSessionId:(NSString *)sessionId
                        key:(NSString *)key
                      value:(NSString *)value
                 completion:(EXChatBackendVoidCallback)completion;

/**
 * Remove environment variable from session
 * @param sessionId The session ID string
 * @param key The ENV key name to remove
 * @param completion Callback with error if any
 */
- (void)removeEnvWithSessionId:(NSString *)sessionId
                           key:(NSString *)key
                    completion:(EXChatBackendVoidCallback)completion;

/**
 * List files in sandbox directory
 * @param path The directory path (e.g., "/vibe0")
 * @param sessionId The sandbox session ID
 * @param completion Callback with array of file entries or error
 */
- (void)listFilesAtPath:(NSString *)path
              sessionId:(NSString *)sessionId
             completion:(void (^)(NSArray<NSDictionary *> * _Nullable entries, NSError * _Nullable error))completion;

/**
 * Read file content from sandbox
 * @param path The file path (e.g., "/vibe0/App.tsx")
 * @param sessionId The sandbox session ID
 * @param completion Callback with file content string or error
 */
- (void)readFileAtPath:(NSString *)path
             sessionId:(NSString *)sessionId
            completion:(void (^)(NSString * _Nullable content, NSError * _Nullable error))completion;

/**
 * Get environment variables for a session
 * @param sessionId The session ID string
 * @param completion Callback with envs dictionary or error
 */
- (void)getEnvsForSession:(NSString *)sessionId
               completion:(void (^)(NSDictionary * _Nullable envs, NSError * _Nullable error))completion;

/**
 * Sync environment variables bidirectionally between sandbox and database
 * @param sessionId The session ID string
 * @param completion Callback with sync result or error
 */
- (void)syncEnvsBidirectionalWithSessionId:(NSString *)sessionId
                                completion:(void (^)(NSDictionary * _Nullable result, NSError * _Nullable error))completion;

/**
 * Stop the running agent in a sandbox
 * Sends SIGINT to terminate Claude Code, Cursor, or Gemini agent processes
 * @param sessionId The sandbox session ID
 * @param completion Callback with success result or error
 */
- (void)stopAgentWithSessionId:(NSString *)sessionId
                    completion:(void (^)(BOOL success, NSError * _Nullable error))completion;

/**
 * Check if user can send messages based on billing status
 * Used to enforce token/credit limits before allowing message sends
 * @param clerkId The user's Clerk ID
 * @param completion Callback with canSend boolean, reason message, and error
 */
- (void)checkBillingLimitForClerkId:(NSString *)clerkId
                         completion:(void (^)(BOOL canSend, NSString * _Nullable reason, NSString * _Nullable billingMode, NSNumber * _Nullable remaining, NSError * _Nullable error))completion;

/**
 * Clear all messages for a session
 * Deletes messages from Convex database to start a fresh chat
 * @param sessionId The Convex session ID
 * @param completion Callback with error if any
 */
- (void)clearMessagesForSession:(NSString *)sessionId
                     completion:(EXChatBackendVoidCallback)completion;

/**
 * Get usage information for a user
 * Returns remaining credits/tokens, used amount, total limit, plan name
 * @param clerkId The user's Clerk ID
 * @param completion Callback with usage dictionary or error
 */
- (void)getUsageForClerkId:(NSString *)clerkId
                completion:(void (^)(NSDictionary * _Nullable usage, NSError * _Nullable error))completion;

#pragma mark - GitHub Integration

/**
 * Check GitHub connection status for a user
 * @param clerkId The user's Clerk ID
 * @param completion Callback with connection status, username, or error
 */
- (void)checkGitHubConnectionForClerkId:(NSString *)clerkId
                             completion:(void (^)(BOOL isConnected, NSString * _Nullable username, NSError * _Nullable error))completion;

/**
 * Exchange GitHub OAuth code for access token and save credentials
 * @param code The OAuth authorization code from GitHub
 * @param clerkId The user's Clerk ID
 * @param completion Callback with success status, username, or error
 */
- (void)exchangeGitHubCode:(NSString *)code
                forClerkId:(NSString *)clerkId
                completion:(void (^)(BOOL success, NSString * _Nullable username, NSError * _Nullable error))completion;

/**
 * Disconnect GitHub (remove credentials)
 * @param clerkId The user's Clerk ID
 * @param completion Callback with error if any
 */
- (void)disconnectGitHubForClerkId:(NSString *)clerkId
                        completion:(EXChatBackendVoidCallback)completion;

/**
 * Create GitHub repository and push code
 * @param sessionId The sandbox session ID
 * @param convexId The Convex session document ID
 * @param repoName The desired repository name
 * @param isPrivate Whether to create a private repository
 * @param clerkId The user's Clerk ID
 * @param completion Callback with repository info or error
 */
- (void)createAndPushToGitHubWithSessionId:(NSString *)sessionId
                                  convexId:(NSString *)convexId
                                  repoName:(NSString *)repoName
                                 isPrivate:(BOOL)isPrivate
                                   clerkId:(NSString *)clerkId
                                completion:(void (^)(BOOL success, NSString * _Nullable repository, NSString * _Nullable repositoryUrl, NSError * _Nullable error))completion;

/**
 * Retry a failed GitHub push
 * @param sessionId The sandbox session ID
 * @param convexId The Convex session document ID
 * @param repository The existing repository name (owner/repo)
 * @param clerkId The user's Clerk ID
 * @param completion Callback with error if any
 */
- (void)retryGitHubPushWithSessionId:(NSString *)sessionId
                            convexId:(NSString *)convexId
                          repository:(NSString *)repository
                             clerkId:(NSString *)clerkId
                          completion:(EXChatBackendVoidCallback)completion;

/**
 * Get GitHub push status for a session
 * @param convexId The Convex session document ID
 * @param completion Callback with status dictionary or error
 */
- (void)getGitHubStatusForSession:(NSString *)convexId
                       completion:(void (^)(NSDictionary * _Nullable status, NSError * _Nullable error))completion;

#pragma mark - Dev Server Management

/**
 * Restart the dev server in a sandbox
 * Useful when the dev server gets killed by mistake
 * @param sessionId The sandbox session ID
 * @param completion Callback with error if any
 */
- (void)restartDevServerForSession:(NSString *)sessionId
                        completion:(EXChatBackendVoidCallback)completion;

NS_ASSUME_NONNULL_END

@end

