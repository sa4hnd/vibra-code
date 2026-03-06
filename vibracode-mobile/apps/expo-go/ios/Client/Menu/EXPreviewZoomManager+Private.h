// Copyright 2015-present 650 Industries. All rights reserved.

#import "EXPreviewZoomManager.h"
#import <AuthenticationServices/AuthenticationServices.h>

@class EXChatListAdapter;

// Private interface for EXPreviewZoomManager - shared between main
// implementation and categories
@interface EXPreviewZoomManager ()

@property(nonatomic, assign) BOOL isZoomed;
@property(nonatomic, assign) BOOL isChatMode;
@property(nonatomic, assign) BOOL isAnimating; // Prevents rapid toggle during animation
@property(nonatomic, strong) UIView *previewContainerView;
@property(nonatomic, strong) UITapGestureRecognizer *tapGestureRecognizer;
@property(nonatomic, strong) UIColor *originalSuperviewBackgroundColor;
@property(nonatomic, strong) UIView *bottomBarView;
@property(nonatomic, strong) UIView *topBarView;
@property(nonatomic, strong) UIView *chatView;
@property(nonatomic, strong) UIButton *bottomBarChevronButton;
@property(nonatomic, strong) NSString *appNameFromConvex;
@property(nonatomic, strong) UILabel *appNameLabel;
@property(nonatomic, strong) UIButton *threeDotsButton;
@property(nonatomic, strong) UIButton *refreshButton;
@property(nonatomic, strong) UIButton *chevronDownButton;
@property(nonatomic, strong) UIButton *clearHistoryButton;
@property(nonatomic, weak) UIView *observedContentView;
@property(nonatomic, strong) UIView *storedSuperview;
@property(nonatomic, assign) BOOL needsZoomAfterReload;
@property(nonatomic, strong) UITextField *chatInputField;
@property(nonatomic, strong) NSLayoutConstraint *bottomBarBottomConstraint;
@property(nonatomic, strong) NSLayoutConstraint *chatScrollViewBottomConstraint;
@property(nonatomic, strong) UIScrollView *chatScrollView;
@property(nonatomic, strong) EXChatListAdapter *chatListAdapter; // IGListKit-based chat list
@property(nonatomic, assign) CATransform3D originalPreviewTransform;
@property(nonatomic, assign) BOOL isKeyboardVisible;
@property(nonatomic, strong) UITapGestureRecognizer *chatScrollViewTapGesture;
@property(nonatomic, strong) UITapGestureRecognizer *superviewTapGesture;
@property(nonatomic, strong) NSString *chatSessionId; // Convex document _id
@property(nonatomic, strong) NSString *sandboxId; // E2B sandbox ID (from session.sessionId)
@property(nonatomic, strong) NSString *tunnelUrl; // Tunnel URL for sharing project
@property(nonatomic, strong) NSArray<NSDictionary *> *chatMessages;
@property(nonatomic, strong) NSTimer *chatPollingTimer;
@property(nonatomic, assign) BOOL isSendingMessage;
@property(nonatomic, strong) NSDictionary *chatSession;
@property(nonatomic, strong) UIView *statusContainer;
@property(nonatomic, strong) CABasicAnimation *statusPulseAnimation;
@property(nonatomic, assign)
    NSInteger displayedMessageCount; // Track how many messages are displayed
@property(nonatomic, strong) NSLayoutConstraint
    *micToSendConstraint; // Constraint: mic trailing to send leading
@property(nonatomic, strong) NSLayoutConstraint
    *micToContainerConstraint; // Constraint: mic trailing to container trailing
@property(nonatomic, strong) NSLayoutConstraint
    *inputFieldLeadingToImageConstraint; // Input field leading to image button
@property(nonatomic, strong) NSLayoutConstraint
    *inputFieldLeadingToContainerConstraint; // Input field leading to container
                                             // (when buttons hidden)
@property(nonatomic, strong) NSLayoutConstraint
    *imageButtonLeadingToModelConstraint; // Image button leading to model selector
@property(nonatomic, strong) NSLayoutConstraint
    *imageButtonLeadingToContainerConstraint; // Image button leading to container (when model selector hidden)
@property(nonatomic, strong) UIButton *imageButton; // Image button reference
@property(nonatomic, strong) UIButton *micButton;   // Mic button reference
@property(nonatomic, strong) UIButton *sendButton;  // Send button reference
@property(nonatomic, strong) UIButton *modelSelectorButton;  // Model selector button reference
@property(nonatomic, strong)
    UIScrollView *actionsScrollView; // Actions scroll view for horizontal buttons
@property(nonatomic, strong)
    UIView *scrollIndicatorView; // Scroll indicator thumb (moves within track)
@property(nonatomic, strong)
    UITextView *inputTextView; // Input text view reference
@property(nonatomic, strong)
    UIViewController *apiModalViewController; // API modal view controller
@property(nonatomic, strong)
    NSMutableArray<NSDictionary *> *selectedAPIModels; // Selected API models
@property(nonatomic, assign)
    BOOL apiModalPresented; // Whether API modal is currently presented
@property(nonatomic, strong) NSMutableArray
    *apiTagRanges; // Track tag ranges in text (NSDictionary or NSValue)
@property(nonatomic, strong) NSMutableDictionary<NSString *, NSString *>
    *imagePathMappings; // Map image tag names to sandbox paths
@property(nonatomic, strong) NSMutableDictionary<NSString *, NSString *>
    *videoPathMappings; // Map video tag names to sandbox paths
@property(nonatomic, strong) NSMutableDictionary<NSString *, NSString *>
    *audioPathMappings; // Map audio tag names to sandbox paths
@property(nonatomic, strong)
    UIVisualEffectView *leftGroupBackground; // Left button group background
@property(nonatomic, strong)
    UIVisualEffectView *rightGroupBackground; // Right button group background
@property(nonatomic, strong) UIVisualEffectView
    *chevronGroupBackground; // Chevron button group background
@property(nonatomic, strong) UIVisualEffectView
    *clearHistoryBackground; // Clear history button background
@property(nonatomic, strong)
    NSLayoutConstraint *appNameCenterConstraint; // App name center constraint
@property(nonatomic, strong) NSLayoutConstraint
    *appNameLeftConstraint; // App name left constraint for chat mode
@property(nonatomic, strong) NSLayoutConstraint
    *appNameTrailingConstraint; // App name trailing constraint to prevent overflow under chevron
@property(nonatomic, strong)
    NSMutableArray<NSDictionary *> *pendingImageAttachments; // Pending image attachments to send
@property(nonatomic, strong)
    NSMutableArray<NSDictionary *> *pendingAudioAttachments; // Pending audio attachments to send
@property(nonatomic, strong)
    NSMutableArray<NSDictionary *> *pendingVideoAttachments; // Pending video attachments to send
@property(nonatomic, strong)
    UIView *imagePreviewContainer; // Container for image previews in input area
@property(nonatomic, strong)
    UIView *audioPreviewContainer; // Container for audio previews in input area
@property(nonatomic, strong)
    UIView *videoPreviewContainer; // Container for video previews in input area
@property(nonatomic, assign)
    BOOL isUploadingImage; // Whether an image upload is in progress
@property(nonatomic, assign)
    BOOL isResettingInput; // Flag to prevent notification handler during reset
@property(nonatomic, strong) NSLayoutConstraint
    *inputContainerHeightConstraint; // Stored height constraint for input container
@property(nonatomic, strong) NSCache
    *imageCache; // Cache for loaded images by storageId
@property(nonatomic, strong) NSString
    *lastSessionStatus; // Track last session status to avoid unnecessary refreshes

// Haptic modal properties
@property(nonatomic, strong)
    UIViewController *hapticModalViewController; // Haptic modal view controller
@property(nonatomic, strong)
    NSMutableArray<NSDictionary *> *selectedHaptics; // Selected haptic types
@property(nonatomic, assign)
    BOOL hapticModalPresented; // Whether haptic modal is currently presented
@property(nonatomic, strong) NSMutableArray<NSDictionary *>
    *hapticTagRanges; // Track haptic tag ranges in text

// ENV modal properties
@property(nonatomic, strong)
    UIViewController *envModalViewController; // ENV modal view controller
@property(nonatomic, strong)
    NSMutableArray<NSString *> *selectedEnvKeys; // Selected ENV keys
@property(nonatomic, assign)
    BOOL envModalPresented; // Whether ENV modal is currently presented
@property(nonatomic, strong) NSMutableArray<NSDictionary *>
    *envTagRanges; // Track ENV tag ranges in text

// Files modal properties
@property(nonatomic, strong)
    UIViewController *filesModalViewController; // Files modal view controller
@property(nonatomic, assign)
    BOOL filesModalPresented; // Whether files modal is currently presented

// Logs modal properties
@property(nonatomic, strong)
    UIViewController *logsModalViewController; // Logs modal view controller
@property(nonatomic, assign)
    BOOL logsModalPresented; // Whether logs modal is currently presented

// Agent running/stop properties
@property(nonatomic, assign)
    BOOL isAgentRunning; // Whether an agent (Claude, Cursor, Gemini) is currently running
@property(nonatomic, assign)
    BOOL isStoppingAgent; // Whether we're currently stopping the agent

// Voice recording properties
@property(nonatomic, assign)
    BOOL isRecording; // Whether voice recording is in progress
@property(nonatomic, strong)
    UIView *recordingContainerView; // Container for waveform and recording UI
@property(nonatomic, strong)
    UILabel *recordingTimeLabel; // Shows recording duration (00:00)
@property(nonatomic, strong)
    NSTimer *recordingDurationTimer; // Timer for updating duration label
@property(nonatomic, assign)
    NSTimeInterval recordingStartTime; // When recording started
@property(nonatomic, assign)
    BOOL isTranscribing; // Whether transcription is in progress

// Persisted input text (survives zoom in/out)
@property(nonatomic, strong)
    NSString *persistedInputText; // Text to restore when bottom bar is recreated

// Splash screen view reference (for transforming during zoom)
@property(nonatomic, weak)
    UIView *splashScreenView; // Splash screen view to transform with preview

// Error view reference (for handling error states during zoom)
@property(nonatomic, weak)
    UIView *errorView; // Error view to properly position when zoomed

// Performance optimization properties for chat
@property(nonatomic, strong)
    NSMutableDictionary *messageViewCache; // Cache: messageId -> UIView for reuse
@property(nonatomic, strong)
    NSMutableSet *visibleMessageIds; // Set of currently displayed message IDs
@property(nonatomic, assign)
    BOOL isLoadingMoreMessages; // Debounce flag for scroll-triggered loading
@property(nonatomic, strong) NSLayoutConstraint
    *contentViewHeightConstraint; // Cached height constraint for content view
@property(nonatomic, strong) NSLayoutConstraint
    *statusContainerTopConstraint; // Cached top constraint for status container
@property(nonatomic, strong)
    NSMutableDictionary *messageHeightCache; // Cache: messageId -> estimated height

// Message grouping properties (like NewOnboardingScreen15)
@property(nonatomic, strong)
    NSArray *groupedMessages; // Array of grouped message dictionaries
@property(nonatomic, strong)
    NSMutableDictionary *expandedGroups; // Track which groups are expanded (groupId -> BOOL)
@property(nonatomic, strong)
    NSString *latestExpandableGroupId; // ID of the latest expandable group (auto-expanded)
@property(nonatomic, assign)
    BOOL hasSetInitialScrollPosition; // Track if initial scroll to bottom has been done
@property(nonatomic, assign)
    BOOL isChatAnimationComplete; // Track if chat show animation has completed

// Billing enforcement properties
@property(nonatomic, assign)
    BOOL canSendMessage; // Whether user can send messages (has tokens/credits)
@property(nonatomic, strong)
    NSString *billingMode; // Current billing mode: "tokens" or "credits"
@property(nonatomic, strong)
    NSNumber *billingRemaining; // Remaining tokens or credits
@property(nonatomic, strong)
    NSString *billingBlockReason; // Reason why user can't send (if blocked)

// Forward declarations for methods used across categories
- (UIView *)createTopBarView:(UIView *)superview;
- (UIView *)createBottomBarView:(UIView *)superview;
- (UIView *)createChatView:(UIView *)superview;
- (UIView *)createChatMessagesView:(UIView *)superview;
- (void)updateTopBarForChatMode:(BOOL)isChatMode;
- (void)showChat;
- (void)hideChat;
- (void)scrollChatToBottom;
- (void)performZoomIn;
- (void)handleTap:(UITapGestureRecognizer *)gestureRecognizer;
- (void)handleSuperviewTap:(UITapGestureRecognizer *)gestureRecognizer;
- (void)handleBottomBarTap:(UITapGestureRecognizer *)gestureRecognizer;
- (void)handleChatScrollViewTap:(UITapGestureRecognizer *)gestureRecognizer;
- (void)sendChatMessage:(NSString *)messageText;
- (void)refreshChatMessagesView;
- (void)updateBottomBarForKeyboardVisible:(BOOL)isVisible;
- (void)handleInputFieldDidChange:(UITextField *)textField;
- (void)showAPIModal;
- (void)insertAPITag:(NSString *)tagName;
- (void)updateTextInputWithAttributedString:
    (NSAttributedString *)attributedString;
- (void)handleImageButtonTapped:(UIButton *)sender;
- (void)showImagePicker;
- (void)addImageAttachment:(UIImage *)image fileName:(NSString *)fileName;
- (void)addImageAttachment:(UIImage *)image fileName:(NSString *)fileName sandboxPath:(NSString *)sandboxPath;
- (void)removeImageAttachment:(NSInteger)index;
- (void)clearAllImageAttachments;
- (void)updateImagePreviewContainer;
- (void)addAudioAttachment:(NSData *)audioData fileName:(NSString *)fileName;
- (void)removeAudioAttachment:(NSInteger)index;
- (void)clearAllAudioAttachments;
- (void)updateAudioPreviewContainer;
- (void)addVideoAttachment:(NSData *)videoData fileName:(NSString *)fileName;
- (void)removeVideoAttachment:(NSInteger)index;
- (void)clearAllVideoAttachments;
- (void)updateVideoPreviewContainer;
- (void)lookupSessionAndLoadMessagesWithErrorHandler:(void (^)(NSError *error))errorHandler;
- (void)showUploadingIndicator;
- (void)hideUploadingIndicator;
- (void)showHapticModal;
- (void)insertHapticTag:(NSString *)tagName;
- (void)showENVModal;
- (void)insertENVTag:(NSString *)envKey;
- (void)showFilesModal;
- (void)showLogsModal;
- (void)handleStopAgentTapped:(UIButton *)sender;
- (void)updateSendButtonForAgentState;
- (void)showImmediateWorkingStatus;

// Voice recording methods
- (void)handleMicButtonTapped:(UIButton *)sender;
- (void)startVoiceRecording;
- (void)stopVoiceRecording;
- (void)cancelVoiceRecording;

// iPad detection utility
- (BOOL)isIPad;

// Responsive layout helpers
- (CGFloat)responsiveValueForPhone:(CGFloat)phoneValue iPad:(CGFloat)iPadValue;
- (CGFloat)responsiveFontSize:(CGFloat)baseSize;
- (CGFloat)responsivePadding:(CGFloat)baseValue;
- (CGFloat)responsiveIconSize:(CGFloat)baseSize;
- (CGFloat)responsiveCornerRadius:(CGFloat)baseValue;
- (CGFloat)responsiveButtonSize:(CGFloat)baseSize;
- (CGFloat)responsiveBarHeight:(CGFloat)baseHeight;

// Billing enforcement methods
- (void)checkBillingStatusWithCompletion:(void (^)(BOOL canSend))completion;
- (void)updateUIForBillingStatus;
- (void)showBillingLimitReachedAlert;

// Chat button loading state methods
- (void)startChatButtonLoading;
- (void)stopChatButtonLoading;

// Web preview properties
@property(nonatomic, assign) BOOL isWebProject; // Whether current project is a website
@property(nonatomic, strong) NSString *projectType; // "mobile" or "web"
@property(nonatomic, strong) NSURL *webPreviewURL; // URL for web preview
@property(nonatomic, strong) UIView *webPreviewView; // EXWebPreviewView instance

// GitHub integration properties
@property(nonatomic, strong)
    UIVisualEffectView *githubGroupBackground; // GitHub button group background
@property(nonatomic, strong)
    UIButton *githubButton; // GitHub button reference
@property(nonatomic, strong)
    NSString *githubUsername; // Connected GitHub username
@property(nonatomic, assign)
    BOOL isGitHubConnected; // Whether GitHub is connected
@property(nonatomic, strong)
    NSString *githubPushStatus; // "pending", "in_progress", "completed", "failed"
@property(nonatomic, strong)
    NSString *githubRepository; // Repository name (owner/repo)
@property(nonatomic, strong)
    NSString *githubRepositoryUrl; // Full repository URL
@property(nonatomic, strong)
    NSTimer *githubStatusPollingTimer; // Timer for polling push status
@property(nonatomic, assign)
    BOOL isGitHubActionInProgress; // Whether an action is in progress
@property(nonatomic, strong)
    ASWebAuthenticationSession *githubAuthSession API_AVAILABLE(ios(12.0)); // Retain auth session

// Web preview methods
- (void)loadWebProject:(NSURL *)webUrl;
- (void)zoomOutWebPreview;
- (BOOL)isWebPreview;

// GitHub integration methods
- (void)handleGitHubButtonTapped:(UIButton *)sender;
- (void)showGitHubUpgradeRequired;
- (void)checkGitHubConnectionAndShowActionSheet;
- (void)startGitHubOAuth;
- (void)exchangeGitHubCodeForToken:(NSString *)code;
- (void)showGitHubActionSheetForDisconnectedState;
- (void)showGitHubActionSheetForConnectedState:(NSString *)username;
- (void)showGitHubActionSheetForRepoState:(NSString *)username repository:(NSString *)repository repositoryUrl:(NSString *)repositoryUrl pushStatus:(NSString *)pushStatus;
- (void)startGitHubStatusPolling;
- (void)stopGitHubStatusPolling;
- (void)updateGitHubButtonStatusIndicator;

// Image Studio modal properties
@property(nonatomic, strong)
    UIViewController *imageStudioModalViewController;
@property(nonatomic, assign)
    BOOL imageStudioModalPresented;
@property(nonatomic, strong)
    NSMutableArray<NSDictionary *> *generatedImages; // Cached generated images from Convex

// Audio Studio modal properties
@property(nonatomic, strong)
    UIViewController *audioStudioModalViewController;
@property(nonatomic, assign)
    BOOL audioStudioModalPresented;
@property(nonatomic, strong)
    NSMutableArray<NSDictionary *> *generatedAudios; // Cached generated audios from Convex

// Video Studio modal properties
@property(nonatomic, strong)
    UIViewController *videoStudioModalViewController;
@property(nonatomic, assign)
    BOOL videoStudioModalPresented;
@property(nonatomic, strong)
    NSMutableArray<NSDictionary *> *generatedVideos; // Cached generated videos from Convex

// Database modal properties
@property(nonatomic, strong)
    UIViewController *databaseModalViewController;
@property(nonatomic, assign)
    BOOL databaseModalPresented;
@property(nonatomic, strong)
    NSString *selectedDatabaseType; // "prisma" or "convex"

// Payments modal properties
@property(nonatomic, strong)
    UIViewController *paymentsModalViewController;
@property(nonatomic, assign)
    BOOL paymentsModalPresented;
@property(nonatomic, assign)
    BOOL isRevenueCatConnected; // Whether RevenueCat is connected
@property(nonatomic, assign)
    BOOL isRevenueCatExpired; // Whether RevenueCat token is expired

// Chat button loading state
@property(nonatomic, assign)
    BOOL isChatLoading; // Whether chat is loading
@property(nonatomic, strong)
    UIActivityIndicatorView *chatButtonSpinner; // Spinner shown on chat button while loading
@property(nonatomic, assign)
    NSTimeInterval lastChatToggleTime; // Debounce: last time chat was toggled

// Group expansion debounce
@property(nonatomic, assign)
    NSTimeInterval lastGroupToggleTime; // Debounce: last time a group was toggled
@property(nonatomic, strong)
    NSString *lastToggledGroupId; // ID of last toggled group (for double-tap prevention)

// Publish modal properties
@property(nonatomic, strong)
    UIViewController *publishModalViewController;
@property(nonatomic, assign)
    BOOL publishModalPresented;

// New modal methods
- (void)showImageStudioModal;
- (void)showAudioStudioModal;
- (void)showVideoStudioModal;
- (void)showDatabaseModal;
- (void)showPaymentsModal;
- (void)showPublishModal;

@end
