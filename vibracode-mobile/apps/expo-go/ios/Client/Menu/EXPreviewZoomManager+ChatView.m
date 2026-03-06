// Copyright 2015-present 650 Industries. All rights reserved.

#import "EXAbstractLoader.h"
#import "EXAppViewController.h"
#import "EXChatBackendService.h"
#import "EXEnvBridge.h"
#import "EXKernel.h"
#import "EXKernelAppRecord.h"
#import "EXPreviewZoomManager+Private.h"
#import "EXPreviewZoomManager.h"
#import "Chat/EXChatMessageCache.h"
#import "Chat/EXChatListAdapter.h"
#import "Expo_Go-Swift.h" // For EXCellAnimationHelper
#import <objc/runtime.h>

@interface EXPreviewZoomManager (ChatView) <UIScrollViewDelegate, EXChatListAdapterDelegate>
@end

// ============================================================================
// MARK: - Color Constants (matching NewOnboardingScreen15.tsx)
// ============================================================================
// Star/label: rgba(255,255,255,0.6), Task active: #FFFFFF, Task completed: rgba(255,255,255,0.4)
// Task pending: rgba(255,255,255,0.5), Status green: #34C759, L-shape line: rgba(255,255,255,0.2)
// Card header bg: rgba(255,255,255,0.08), Card border: rgba(255,255,255,0.3) alpha 0.5

static UIColor *ChatColorWhite60(void) { return [UIColor colorWithWhite:1.0 alpha:0.6]; }
static UIColor *ChatColorWhite50(void) { return [UIColor colorWithWhite:1.0 alpha:0.5]; }
static UIColor *ChatColorWhite40(void) { return [UIColor colorWithWhite:1.0 alpha:0.4]; }
static UIColor *ChatColorWhite35(void) { return [UIColor colorWithWhite:1.0 alpha:0.35]; }
static UIColor *ChatColorWhite20(void) { return [UIColor colorWithWhite:1.0 alpha:0.2]; }
static UIColor *ChatColorCardBg(void) { return [UIColor colorWithWhite:0.08 alpha:0.95]; } // Darker card background
static UIColor *ChatColorHeaderBg(void) { return [UIColor colorWithWhite:1.0 alpha:0.05]; } // Slightly darker header
static UIColor *ChatColorStatusGreen(void) { return [UIColor colorWithRed:0.204 green:0.78 blue:0.349 alpha:1.0]; }
static UIColor *ChatColorCardBorder(void) { return [UIColor colorWithWhite:0.3 alpha:0.5]; }
static UIColor *ChatColorHeaderBorder(void) { return [UIColor colorWithWhite:1.0 alpha:0.15]; }

@implementation EXPreviewZoomManager (ChatView)

#pragma mark - Message Grouping (like NewOnboardingScreen15.tsx)

// Group types: read, edit, bash, tool, tasks, text
- (NSArray *)processMessagesIntoGroups:(NSArray *)messages {
  NSMutableArray *groups = [NSMutableArray array];

  for (NSDictionary *message in messages) {
    NSDictionary *lastGroup = groups.lastObject;
    NSString *lastType = lastGroup[@"type"];

    // Check for file read operations
    if (message[@"read"]) {
      NSString *filePath = message[@"read"][@"filePath"] ?: @"Unknown";
      if ([lastType isEqualToString:@"read"]) {
        NSMutableArray *files = [lastGroup[@"files"] mutableCopy];
        [files addObject:filePath];
        NSMutableDictionary *updated = [lastGroup mutableCopy];
        updated[@"files"] = files;
        [groups removeLastObject];
        [groups addObject:updated];
      } else {
        [groups addObject:@{
          @"type": @"read",
          @"files": @[filePath],
          @"id": [self messageIdFromMessage:message]
        }];
      }
      continue;
    }

    // Check for file edit operations
    if (message[@"edits"]) {
      NSString *filePath = message[@"edits"][@"filePath"] ?: message[@"edits"][@"fileName"] ?: @"Unknown";
      if ([lastType isEqualToString:@"edit"]) {
        NSMutableArray *files = [lastGroup[@"files"] mutableCopy];
        [files addObject:filePath];
        NSMutableDictionary *updated = [lastGroup mutableCopy];
        updated[@"files"] = files;
        [groups removeLastObject];
        [groups addObject:updated];
      } else {
        [groups addObject:@{
          @"type": @"edit",
          @"files": @[filePath],
          @"id": [self messageIdFromMessage:message]
        }];
      }
      continue;
    }

    // Check for bash/terminal commands
    if (message[@"bash"]) {
      NSString *command = message[@"bash"][@"command"] ?: @"Unknown";
      if ([lastType isEqualToString:@"bash"]) {
        NSMutableArray *commands = [lastGroup[@"commands"] mutableCopy];
        [commands addObject:command];
        NSMutableDictionary *updated = [lastGroup mutableCopy];
        updated[@"commands"] = commands;
        [groups removeLastObject];
        [groups addObject:updated];
      } else {
        [groups addObject:@{
          @"type": @"bash",
          @"commands": @[command],
          @"id": [self messageIdFromMessage:message]
        }];
      }
      continue;
    }

    // Check for MCP tool calls
    if (message[@"mcpTool"]) {
      NSString *toolName = message[@"mcpTool"][@"toolName"] ?: @"Tool";
      // Store messages for showing results when expanded
      if ([lastType isEqualToString:@"tool"] && [lastGroup[@"toolName"] isEqualToString:toolName]) {
        NSMutableDictionary *updated = [lastGroup mutableCopy];
        updated[@"count"] = @([lastGroup[@"count"] integerValue] + 1);
        NSMutableArray *msgs = [lastGroup[@"messages"] mutableCopy] ?: [NSMutableArray array];
        [msgs addObject:message];
        updated[@"messages"] = msgs;
        [groups removeLastObject];
        [groups addObject:updated];
      } else {
        [groups addObject:@{
          @"type": @"tool",
          @"toolName": toolName,
          @"count": @1,
          @"messages": @[message],
          @"id": [self messageIdFromMessage:message]
        }];
      }
      continue;
    }

    // Check for generic tool calls (separate from mcpTool)
    if (message[@"tool"]) {
      NSString *toolName = message[@"tool"][@"toolName"] ?: @"Tool";
      // Store messages for showing results when expanded
      if ([lastType isEqualToString:@"tool"] && [lastGroup[@"toolName"] isEqualToString:toolName]) {
        NSMutableDictionary *updated = [lastGroup mutableCopy];
        updated[@"count"] = @([lastGroup[@"count"] integerValue] + 1);
        NSMutableArray *msgs = [lastGroup[@"messages"] mutableCopy] ?: [NSMutableArray array];
        [msgs addObject:message];
        updated[@"messages"] = msgs;
        [groups removeLastObject];
        [groups addObject:updated];
      } else {
        [groups addObject:@{
          @"type": @"tool",
          @"toolName": toolName,
          @"count": @1,
          @"messages": @[message],
          @"id": [self messageIdFromMessage:message]
        }];
      }
      continue;
    }

    // Check for web search
    if (message[@"webSearch"]) {
      NSString *query = message[@"webSearch"][@"query"] ?: @"Unknown";
      NSString *results = message[@"webSearch"][@"results"];
      NSMutableDictionary *searchGroup = [@{
        @"type": @"search",
        @"query": query,
        @"message": message,
        @"id": [self messageIdFromMessage:message]
      } mutableCopy];
      if (results) {
        searchGroup[@"results"] = results;
      }
      [groups addObject:searchGroup];
      continue;
    }

    // Check for codebase search (Glob, Grep, etc.)
    if (message[@"codebaseSearch"]) {
      NSString *query = message[@"codebaseSearch"][@"query"] ?: @"Unknown";
      NSString *results = message[@"codebaseSearch"][@"results"];
      NSMutableDictionary *searchGroup = [@{
        @"type": @"search",
        @"query": query,
        @"message": message,
        @"id": [self messageIdFromMessage:message]
      } mutableCopy];
      if (results) {
        searchGroup[@"results"] = results;
      }
      [groups addObject:searchGroup];
      continue;
    }

    // Check for todo list
    if (message[@"todos"]) {
      [groups addObject:@{
        @"type": @"tasks",
        @"todos": message[@"todos"],
        @"message": message,
        @"id": [self messageIdFromMessage:message]
      }];
      continue;
    }

    // Check for text messages (assistant only, with content)
    NSString *role = message[@"role"];
    NSString *content = message[@"content"];
    if (content && content.length > 0) {
      if ([role isEqualToString:@"assistant"]) {
        // Skip if it's a tool message disguised as text
        if (!message[@"read"] && !message[@"edits"] && !message[@"bash"] && !message[@"mcpTool"]) {
          [groups addObject:@{
            @"type": @"text",
            @"content": content,
            @"role": @"assistant",
            @"message": message,
            @"id": [self messageIdFromMessage:message]
          }];
        }
      } else if ([role isEqualToString:@"user"]) {
        // User messages with optional image(s), audio(s), video(s)
        NSMutableDictionary *userMsg = [@{
          @"type": @"user",
          @"content": content,
          @"role": @"user",
          @"message": message,
          @"id": [self messageIdFromMessage:message]
        } mutableCopy];
        // Support single image (legacy)
        if (message[@"image"]) {
          userMsg[@"image"] = message[@"image"];
        }
        // Support images array (new format from Image Studio)
        if (message[@"images"] && [message[@"images"] isKindOfClass:[NSArray class]]) {
          userMsg[@"images"] = message[@"images"];
        }
        // Support audios array (from Audio Studio)
        if (message[@"audios"] && [message[@"audios"] isKindOfClass:[NSArray class]]) {
          userMsg[@"audios"] = message[@"audios"];
        }
        // Support videos array (from Video Studio)
        if (message[@"videos"] && [message[@"videos"] isKindOfClass:[NSArray class]]) {
          userMsg[@"videos"] = message[@"videos"];
        }
        [groups addObject:userMsg];
      }
      continue;
    }

    // Standalone image message
    if (message[@"image"] && !content) {
      [groups addObject:@{
        @"type": @"image",
        @"image": message[@"image"],
        @"message": message,
        @"id": [self messageIdFromMessage:message]
      }];
    }
  }

  return groups;
}

// Find the latest expandable group ID (read, edit, bash)
- (NSString *)findLatestExpandableGroupId:(NSArray *)groups {
  for (NSInteger i = groups.count - 1; i >= 0; i--) {
    NSDictionary *group = groups[i];
    NSString *type = group[@"type"];
    if ([type isEqualToString:@"read"] || [type isEqualToString:@"edit"] || [type isEqualToString:@"bash"]) {
      return group[@"id"];
    }
  }
  return nil;
}

// Find the latest tasks card ID
- (NSString *)findLatestTasksGroupId:(NSArray *)groups {
  for (NSInteger i = groups.count - 1; i >= 0; i--) {
    if ([groups[i][@"type"] isEqualToString:@"tasks"]) {
      return groups[i][@"id"];
    }
  }
  return nil;
}

// Get filename from path
- (NSString *)getFileNameFromPath:(NSString *)path {
  return [path lastPathComponent] ?: path;
}

#pragma mark - Chat View Creation

- (UIView *)createChatMessagesView:(UIView *)superview {
  UIWindow *window = [UIApplication sharedApplication].keyWindow;
  if (!window) {
    return nil;
  }

  // Force layout to ensure safe area insets are calculated correctly
  [window layoutIfNeeded];
  if (window.rootViewController && window.rootViewController.view) {
    [window.rootViewController.view layoutIfNeeded];
  }

  CGRect screenBounds = window.bounds;
  CGFloat safeAreaTop = 0;
  CGFloat safeAreaBottom = 0;
  if (@available(iOS 11.0, *)) {
    safeAreaTop = window.safeAreaInsets.top;
    safeAreaBottom = window.safeAreaInsets.bottom;
  }

  // Calculate available height (between top bar and bottom bar)
  // Match the top bar height calculation from EXPreviewZoomManager+TopBar.m:
  // topBarTopPadding = safeAreaTop + 10, topBar height = 44 + topBarTopPadding
  // So total = 44 + safeAreaTop + 10 = 54 + safeAreaTop
  CGFloat topBarContentHeight = [self isIPad] ? 56 : 44;
  CGFloat topBarPaddingBelowSafeArea = 10; // Extra padding below status bar
  CGFloat topBarHeight = topBarContentHeight + safeAreaTop + topBarPaddingBelowSafeArea;

  CGFloat bottomBarTopPadding = [self isIPad] ? 20 : 16;
  CGFloat bottomBarInputHeight = [self isIPad] ? 52 : 40;
  CGFloat bottomBarActionsHeight = 70; // Actual actionsScrollView height (same for iPhone/iPad)
  CGFloat bottomBarFloatingGap = 12; // Bottom bar floats 12pt above screen bottom
  CGFloat bottomBarHeight = bottomBarTopPadding + bottomBarInputHeight + bottomBarTopPadding + bottomBarActionsHeight + bottomBarFloatingGap + safeAreaBottom;

  // Create container view for IGListKit collection view
  UIView *containerView = [[UIView alloc] init];
  containerView.backgroundColor = [UIColor clearColor];
  containerView.translatesAutoresizingMaskIntoConstraints = NO;
  [superview addSubview:containerView];

  // Container constraints - position below top bar and above bottom bar
  NSLayoutConstraint *containerBottomConstraint = [containerView.bottomAnchor
      constraintEqualToAnchor:superview.bottomAnchor
                     constant:-bottomBarHeight];
  [NSLayoutConstraint activateConstraints:@[
    [containerView.leadingAnchor constraintEqualToAnchor:superview.leadingAnchor],
    [containerView.trailingAnchor constraintEqualToAnchor:superview.trailingAnchor],
    [containerView.topAnchor constraintEqualToAnchor:superview.topAnchor constant:topBarHeight],
    containerBottomConstraint
  ]];
  self.chatScrollViewBottomConstraint = containerBottomConstraint;

  // Force layout
  [superview layoutIfNeeded];
  [containerView layoutIfNeeded];

  // Get the view controller for IGListKit
  UIViewController *viewController = window.rootViewController;

  // Create IGListKit adapter for efficient diffing and cell reuse
  self.chatListAdapter = [[EXChatListAdapter alloc] initWithViewController:viewController
                                                             containerView:containerView];
  self.chatListAdapter.delegate = self;

  // Store reference to the collection view as chatScrollView for compatibility
  self.chatScrollView = (UIScrollView *)self.chatListAdapter.collectionView;

  // Add tap gesture to dismiss keyboard when tapping on collection view
  UITapGestureRecognizer *tapGesture = [[UITapGestureRecognizer alloc]
      initWithTarget:self
              action:@selector(handleChatScrollViewTap:)];
  tapGesture.cancelsTouchesInView = NO;
  [self.chatScrollView addGestureRecognizer:tapGesture];
  self.chatScrollViewTapGesture = tapGesture;

  return containerView;
}

// Old hardcoded message creation code removed - messages are now loaded
// dynamically

- (UIView *)createChatView:(UIView *)superview {
  // Create main chat container
  // Create main chat container - Native iOS Glass Effect
  // Use UIGlassEffect for native Liquid Glass (iOS 26.0+)
  UIVisualEffect *glassEffect = nil;
  if (@available(iOS 26.0, *)) {
    // Try to use UIGlassEffect if available
    Class glassEffectClass = NSClassFromString(@"UIGlassEffect");
    if (glassEffectClass) {
      SEL effectSelector = NSSelectorFromString(@"effectWithStyle:");
      if ([glassEffectClass respondsToSelector:effectSelector]) {
        // UIGlassEffectStyleRegular = 0
        NSMethodSignature *signature =
            [glassEffectClass methodSignatureForSelector:effectSelector];
        NSInvocation *invocation =
            [NSInvocation invocationWithMethodSignature:signature];
        [invocation setSelector:effectSelector];
        [invocation setTarget:glassEffectClass];
        NSInteger style = 0; // UIGlassEffectStyleRegular
        [invocation setArgument:&style atIndex:2];
        [invocation invoke];
        void *tempResult;
        [invocation getReturnValue:&tempResult];
        glassEffect = (__bridge id)tempResult;

        // Set interactive property to NO (non-interactive glass)
        if (glassEffect &&
            [glassEffect respondsToSelector:@selector(setInteractive:)]) {
          SEL setInteractiveSelector = @selector(setInteractive:);
          NSMethodSignature *setSig =
              [glassEffect methodSignatureForSelector:setInteractiveSelector];
          NSInvocation *setInvocation =
              [NSInvocation invocationWithMethodSignature:setSig];
          [setInvocation setSelector:setInteractiveSelector];
          [setInvocation setTarget:glassEffect];
          BOOL interactive = NO; // Non-interactive glass
          [setInvocation setArgument:&interactive atIndex:2];
          [setInvocation invoke];
        }

        // Set tint color to match bottom/top bars
        if (glassEffect &&
            [glassEffect respondsToSelector:@selector(setTintColor:)]) {
          // Very dark tint color: Almost black
          UIColor *darkTint = [UIColor colorWithRed:0.05
                                              green:0.05
                                               blue:0.05
                                              alpha:1.0];
          [glassEffect setValue:darkTint forKey:@"tintColor"];
        }
      }
    }
    // Fallback if UIGlassEffect not available
    if (!glassEffect) {
      if (@available(iOS 13.0, *)) {
        glassEffect =
            [UIBlurEffect effectWithStyle:UIBlurEffectStyleSystemMaterialDark];
      } else {
        glassEffect = [UIBlurEffect effectWithStyle:UIBlurEffectStyleDark];
      }
    }
  } else if (@available(iOS 13.0, *)) {
    // Fallback to SystemMaterialDark for iOS < 26.0
    glassEffect =
        [UIBlurEffect effectWithStyle:UIBlurEffectStyleSystemMaterialDark];
  } else {
    glassEffect = [UIBlurEffect effectWithStyle:UIBlurEffectStyleDark];
  }

  UIVisualEffectView *chatContainer =
      [[UIVisualEffectView alloc] initWithEffect:glassEffect];
  chatContainer.translatesAutoresizingMaskIntoConstraints = NO;

  // Add to superview
  [superview addSubview:chatContainer];

  // Create chat messages view (sets self.chatScrollView internally to the collection view)
  // Note: chatScrollView is set inside createChatMessagesView: to the IGListKit collection view,
  // which IS a UIScrollView. Do NOT overwrite it with the returned containerView.
  [self createChatMessagesView:chatContainer.contentView];

  // Bottom bar is already created and will be reused

  // Chat container constraints
  [NSLayoutConstraint activateConstraints:@[
    [chatContainer.leadingAnchor
        constraintEqualToAnchor:superview.leadingAnchor],
    [chatContainer.trailingAnchor
        constraintEqualToAnchor:superview.trailingAnchor],
    [chatContainer.topAnchor constraintEqualToAnchor:superview.topAnchor],
    [chatContainer.bottomAnchor constraintEqualToAnchor:superview.bottomAnchor]
  ]];

  return chatContainer;
}

#pragma mark - Chat Mode Management

- (void)toggleChat {
  // Defensive check: ensure we're in a valid zoomed state with valid views
  if (!self.isZoomed || !self.previewContainerView || !self.previewContainerView.superview) {
    return; // Can only show chat when zoomed out with valid view hierarchy
  }

  // Prevent rapid toggling - check if we're already in the desired state
  // or if animation is in progress
  if (self.isChatMode && self.chatView && self.chatView.alpha == 1.0) {
    // Chat is fully visible, hide it
    [self hideChat];
  } else if (!self.isChatMode &&
             (!self.chatView || self.chatView.alpha == 0.0)) {
    // Chat is not visible, show it
    [self showChat];
  }
  // If chat is animating (alpha between 0 and 1), ignore the toggle
}

- (void)showChat {
  if (!self.isZoomed || self.isChatMode) {
    return;
  }

  UIView *superview =
      self.previewContainerView ? self.previewContainerView.superview : nil;
  if (!superview) {
    return;
  }

  UIWindow *window = [UIApplication sharedApplication].keyWindow;
  if (!window) {
    return;
  }

  self.isChatMode = YES;

  // Reset loading flag when showing chat
  self.isLoadingMoreMessages = NO;

  // ========================================================================
  // INSTANT CACHE LOAD: Try to load from cache IMMEDIATELY before any network
  // This provides instant chat display while we verify with the server
  // ========================================================================
  EXKernel *kernel = [EXKernel sharedInstance];
  EXKernelAppRecord *visibleApp = kernel.visibleApp;
  if (visibleApp) {
    NSURL *manifestUrl = visibleApp.appLoader.manifestUrl;
    if (manifestUrl) {
      NSString *manifestUrlString = manifestUrl.absoluteString;
      EXChatMessageCache *cache = [EXChatMessageCache sharedInstance];

      // Check if we have a cached sessionId for this manifest URL
      NSString *cachedSessionId = [cache cachedSessionIdForManifestUrl:manifestUrlString];
      if (cachedSessionId && [cache hasCacheForSession:cachedSessionId]) {
        NSArray *cachedMessages = [cache cachedMessagesForSession:cachedSessionId];
        if (cachedMessages.count > 0) {
          NSLog(@"⚡️ INSTANT LOAD: %lu messages from cache for session %@",
                (unsigned long)cachedMessages.count, cachedSessionId);

          // Set session ID early so other methods can use it
          self.chatSessionId = cachedSessionId;
          self.chatMessages = cachedMessages;
          self.displayedMessageCount = 0;

          // Load cached session data too
          NSDictionary *cachedSession = [cache cachedSessionForSessionId:cachedSessionId];
          if (cachedSession) {
            self.chatSession = cachedSession;
            NSString *sessionName = cachedSession[@"name"];
            if (sessionName && [sessionName isKindOfClass:[NSString class]] && sessionName.length > 0) {
              [self setAppName:sessionName];
            }
          }
        }
      }
    }
  }

  // Create chat view FIRST (before network requests) for instant feedback
  if (!self.chatView) {
    self.chatView = [self createChatView:superview];
    [superview layoutIfNeeded];
  }

  // If we have cached messages, load them and set scroll position BEFORE animation
  // This prevents the visible scroll from top to bottom during animation
  if (self.chatMessages.count > 0) {
    // Disable cell appearance animations during initial load
    // This prevents the "animate in from nothing" effect that looks like scrolling
    [EXCellAnimationHelper setAnimationsEnabled:NO];

    // Temporarily mark animation complete to allow refreshChatMessagesView to work
    // but skip its scrolling logic (we handle scroll manually below)
    BOOL wasAnimationComplete = self.isChatAnimationComplete;
    self.isChatAnimationComplete = YES;
    self.hasSetInitialScrollPosition = YES; // Prevent refreshChatMessagesView from scrolling

    // Process messages into groups (same logic as refreshChatMessagesView but inline)
    NSInteger totalMessages = self.chatMessages.count;
    NSInteger messagesToShow = self.displayedMessageCount > 0
                                 ? self.displayedMessageCount
                                 : MIN(50, totalMessages);
    NSInteger startIndex = MAX(0, totalMessages - messagesToShow);
    NSArray *visibleMessages = [self.chatMessages
        subarrayWithRange:NSMakeRange(startIndex, totalMessages - startIndex)];

    self.displayedMessageCount = messagesToShow;

    NSArray *groups = [self processMessagesIntoGroups:visibleMessages];
    self.groupedMessages = groups;

    NSString *latestExpandableGroupId = [self findLatestExpandableGroupId:groups];
    if (!self.expandedGroups) {
      self.expandedGroups = [NSMutableDictionary dictionary];
    }
    self.latestExpandableGroupId = latestExpandableGroupId;

    // CRITICAL FIX: Use completion-based update to set scroll position
    // AFTER Texture's async layout completes. This prevents the "scroll from top to bottom" issue.
    __weak typeof(self) weakSelf = self;
    [self.chatListAdapter updateWithMessages:visibleMessages
                             groupedMessages:groups
                             expandedGroups:self.expandedGroups
                        latestExpandableGroupId:latestExpandableGroupId
                                    animated:NO
                                  completion:^{
      // Set scroll position to bottom AFTER layout completes
      [CATransaction begin];
      [CATransaction setDisableActions:YES];
      [weakSelf.chatListAdapter scrollToBottomImmediate];
      [CATransaction commit];

      // Re-enable cell appearance animations for subsequent updates
      [EXCellAnimationHelper setAnimationsEnabled:YES];

      // Restore animation state (it will be set to YES after animation completes)
      weakSelf.isChatAnimationComplete = wasAnimationComplete;
      // Keep hasSetInitialScrollPosition = YES so we don't re-scroll after animation
    }];
  }

  // Restore status animation if it was stopped
  if (self.statusContainer && self.statusPulseAnimation) {
    [self.statusContainer.layer addAnimation:self.statusPulseAnimation forKey:@"pulse"];
  }

  // Ensure proper z-ordering: top bar above chat view, bottom bar above
  // everything
  [superview bringSubviewToFront:self.chatView];
  self.chatView.layer.zPosition = 500.0;  // Above preview (0) but below bars (900-1000)
  if (self.topBarView) {
    [superview bringSubviewToFront:self.topBarView];
  }
  [superview bringSubviewToFront:self.bottomBarView];

  // Hide splash screen when showing chat - it should not be visible above chat
  if (self.splashScreenView) {
    [superview sendSubviewToBack:self.splashScreenView];
    self.splashScreenView.hidden = YES;
  }

  // Update top bar to show chat mode elements
  [self updateTopBarForChatMode:YES];

  // Hide chevron up button when chat is shown
  if (self.bottomBarChevronButton) {
    self.bottomBarChevronButton.hidden = YES;
  }

  // Set initial state for animations
  self.chatView.alpha = 0.0;
  CGRect screenBounds = window.bounds;
  // Chat starts below screen
  self.chatView.transform =
      CGAffineTransformMakeTranslation(0, screenBounds.size.height * 0.7);

  if (self.previewContainerView) {
    // Store original transform for the zoomed state
    CATransform3D originalTransform = self.previewContainerView.layer.transform;

    // Move preview COMPLETELY off screen - like the old implementation
    // Preview should be pushed up and out of view entirely when chat is open
    CATransform3D upTransform = CATransform3DTranslate(originalTransform, 0, -screenBounds.size.height, 0);

    // Use UIViewPropertyAnimator with spring for smooth 60fps animation
    UISpringTimingParameters *springParams;
    if (@available(iOS 17.0, *)) {
      // iOS 17+ bounce API for natural feel
      springParams = [[UISpringTimingParameters alloc]
          initWithDuration:0.35
          bounce:0.0];  // No bounce for cleaner push
    } else {
      // Fallback for iOS 16 and earlier
      springParams = [[UISpringTimingParameters alloc]
          initWithDampingRatio:0.85
          initialVelocity:CGVectorMake(0, 0.8)];
    }

    UIViewPropertyAnimator *animator = [[UIViewPropertyAnimator alloc]
        initWithDuration:0.35
        timingParameters:springParams];

    __weak typeof(self) weakSelf = self;

    [animator addAnimations:^{
      // Preview moves completely off screen - NOT visible when chat is open
      weakSelf.previewContainerView.layer.transform = upTransform;
      weakSelf.previewContainerView.alpha = 0.0;  // Completely hidden

      // Also animate splash screen with preview
      if (weakSelf.splashScreenView) {
        weakSelf.splashScreenView.layer.transform = upTransform;
        weakSelf.splashScreenView.alpha = 0.0;
      }

      // Chat slides up from bottom
      weakSelf.chatView.alpha = 1.0;
      weakSelf.chatView.transform = CGAffineTransformIdentity;
    }];

    [animator addCompletion:^(UIViewAnimatingPosition finalPosition) {
      // Mark animation as complete
      weakSelf.isChatAnimationComplete = YES;

      // Stop chat button loading indicator
      if ([weakSelf respondsToSelector:@selector(stopChatButtonLoading)]) {
        [weakSelf performSelector:@selector(stopChatButtonLoading)];
      }

      // After animation completes, set initial scroll position without animation
      // This ensures the chat appears at the bottom when the slide-up animation finishes
      if (weakSelf.chatListAdapter && !weakSelf.hasSetInitialScrollPosition) {
        [weakSelf.chatListAdapter setInitialScrollPosition];
        weakSelf.hasSetInitialScrollPosition = YES;
      }
    }];

    [animator startAnimation];
  }

  // Load session and messages IN THE BACKGROUND (after UI is shown)
  // This prevents the 4-5 second delay when opening chat
  dispatch_async(dispatch_get_main_queue(), ^{
    [self lookupSessionAndLoadMessagesWithErrorHandler:^(NSError *error) {
      // Show error in chat view (only if we don't have cached data)
      if (self.chatMessages.count > 0) {
        // We have cached data, don't show error - just log it
        NSLog(@"⚠️ Network error but using cached data: %@", error.localizedDescription);
        return;
      }
      if (self.chatScrollView) {
        UIView *contentView = self.chatScrollView.subviews.firstObject;
        if (contentView) {
          for (UIView *subview in contentView.subviews) {
            [subview removeFromSuperview];
          }

          UILabel *errorLabel = [[UILabel alloc] init];
          errorLabel.text = @"Unable to load chat. Please check your connection.";
          errorLabel.textColor = [UIColor lightGrayColor];
          errorLabel.font = [UIFont systemFontOfSize:14];
          errorLabel.textAlignment = NSTextAlignmentCenter;
          errorLabel.numberOfLines = 0;
          errorLabel.translatesAutoresizingMaskIntoConstraints = NO;
          [contentView addSubview:errorLabel];

          [NSLayoutConstraint activateConstraints:@[
            [errorLabel.centerXAnchor
                constraintEqualToAnchor:contentView.centerXAnchor],
            [errorLabel.centerYAnchor
                constraintEqualToAnchor:contentView.centerYAnchor],
            [errorLabel.leadingAnchor
                constraintEqualToAnchor:contentView.leadingAnchor
                               constant:40],
            [errorLabel.trailingAnchor
                constraintEqualToAnchor:contentView.trailingAnchor
                               constant:-40]
          ]];
        }
      }
    }];
  });
}

- (void)hideChat {
  NSLog(@"🟢 [ChatView] hideChat called - isChatMode: %@", self.isChatMode ? @"YES" : @"NO");

  if (!self.isChatMode) {
    return;
  }

  // IMPORTANT: Dismiss keyboard FIRST before hiding chat
  // This ensures the keyboard hide animation properly restores the preview transform
  // without conflicting with our chat hide animation
  UIWindow *window = [UIApplication sharedApplication].keyWindow;
  [window endEditing:YES];

  self.isChatMode = NO;

  // NOTE: Do NOT stop polling here - we need to continue polling for session status
  // to update isAgentRunning state even when chat is closed (fixes stop button persistence)
  // The pollForNewMessages will skip message loading when isChatMode is false
  // The pollForSessionStatus will continue updating agent running state

  // Stop any running animations on status container to save resources
  if (self.statusContainer) {
    [self.statusContainer.layer removeAllAnimations];
  }

  // Clear UI-related caches but KEEP message data for fast re-open
  // IMPORTANT: Clear these BEFORE any async operations to prevent race conditions
  [self.messageViewCache removeAllObjects];
  [self.visibleMessageIds removeAllObjects];
  // Keep displayedMessageCount - preserves scroll position on reopen
  self.statusContainerTopConstraint = nil; // Will be recreated
  self.contentViewHeightConstraint = nil; // Will be recreated
  self.hasSetInitialScrollPosition = NO; // Reset so next open shows at bottom without animation
  self.isChatAnimationComplete = NO; // Reset so we wait for animation on next open
  // Keep messageHeightCache - heights are stable and useful for next show
  // Keep chatMessages, groupedMessages, expandedGroups - for instant reopen

  // Keep scroll view reference until AFTER animation completes for smooth slide-out
  UIScrollView *chatScrollViewToAnimate = self.chatScrollView;

  // Update top bar to show preview mode elements immediately
  [self updateTopBarForChatMode:NO];

  // Show chevron up button when chat is hidden
  if (self.bottomBarChevronButton) {
    self.bottomBarChevronButton.hidden = NO;
  }

  // Restore splash screen visibility and z-order when hiding chat
  if (self.splashScreenView) {
    self.splashScreenView.hidden = NO;
    // Restore z-order: splash screen should be above preview container
    UIView *superview = self.splashScreenView.superview;
    if (superview && self.previewContainerView) {
      [superview insertSubview:self.splashScreenView aboveSubview:self.previewContainerView];
    }
  }

  // window variable already declared at top of method for keyboard dismissal
  if (!window) {
    self.chatScrollView = nil; // Clean up reference
    return;
  }

  CGRect screenBounds = window.bounds;
  NSLog(@"🟢 [ChatView] hideChat - screenBounds: %@", NSStringFromCGRect(screenBounds));

  // Reset keyboard visible flag since we dismissed it above
  // This prevents keyboardWillHide from trying to animate the preview transform
  // (we'll handle the preview transform in this animation)
  BOOL wasKeyboardVisible = self.isKeyboardVisible;
  self.isKeyboardVisible = NO;

  // Restore original transform for preview (zoomed-out state with perspective)
  CATransform3D transform = CATransform3DIdentity;
  // Apply perspective
  CGFloat perspective = [self isIPad] ? -1.0 / 1200.0 : -1.0 / 1000.0;
  transform.m34 = perspective;
  CGFloat scale = [self isIPad] ? 0.68 : 0.55;
  transform = CATransform3DScale(transform, scale, scale, 1.0);
  // Apply rotation
  CGFloat rotationAngle = [self isIPad] ? 0.08 : 0.1;
  transform = CATransform3DRotate(transform, rotationAngle, 1.0, 0.0, 0.0);
  // Move preview UP to position it higher on screen
  // iPad: -120 (moved higher), iPhone: -60 (added upward translation)
  CGFloat translateY = [self isIPad] ? -120.0 : -60.0;
  transform = CATransform3DTranslate(transform, 0, translateY, 0);

  // Also restore the bottom bar position if keyboard was visible
  if (wasKeyboardVisible && self.bottomBarBottomConstraint) {
    self.bottomBarBottomConstraint.constant = -12; // Floating position
  }

  // Use Apple's latest spring API (iOS 17+) with fallback for hide animation
  // FASTER - reduced from 0.5 to 0.3
  UISpringTimingParameters *springParams;
  if (@available(iOS 17.0, *)) {
    // iOS 17+ bounce API - snappy dismissal
    springParams = [[UISpringTimingParameters alloc]
        initWithDuration:0.3
        bounce:0.0];  // No bounce for dismissal
  } else {
    // Fallback for iOS 16 and earlier
    springParams = [[UISpringTimingParameters alloc]
        initWithMass:1.0
        stiffness:400.0
        damping:35.0
        initialVelocity:CGVectorMake(0, 0.8)];
  }

  UIViewPropertyAnimator *animator = [[UIViewPropertyAnimator alloc]
      initWithDuration:0.3  // Faster dismissal
      timingParameters:springParams];

  __weak typeof(self) weakSelf = self;

  [animator addAnimations:^{
    // Preview pulled back down to zoomed-out position (reverse of push)
    if (weakSelf.previewContainerView) {
      weakSelf.previewContainerView.layer.transform = transform;
      weakSelf.previewContainerView.alpha = 1.0;
    }

    // Apply same transform and restore alpha for splash screen
    if (weakSelf.splashScreenView) {
      weakSelf.splashScreenView.layer.transform = transform;
      weakSelf.splashScreenView.alpha = 1.0;
    }

    // Chat slides down off screen smoothly
    if (weakSelf.chatView) {
      weakSelf.chatView.alpha = 0.0;
      weakSelf.chatView.transform =
          CGAffineTransformMakeTranslation(0, screenBounds.size.height * 0.7);
    }

    // Also slide the chat scroll view content down for smooth close effect
    if (chatScrollViewToAnimate) {
      chatScrollViewToAnimate.alpha = 0.0;
      chatScrollViewToAnimate.transform =
          CGAffineTransformMakeTranslation(0, screenBounds.size.height * 0.3);
    }

    // Animate bottom bar back to floating position if keyboard was visible
    if (weakSelf.bottomBarView && weakSelf.bottomBarView.superview) {
      [weakSelf.bottomBarView.superview layoutIfNeeded];
    }
  }];

  [animator addCompletion:^(UIViewAnimatingPosition finalPosition) {
    NSLog(@"🟢 [ChatView] hideChat animation completed");

    // Clear scroll view reference after animation
    weakSelf.chatScrollView = nil;

    // Remove chat view after animation
    if (weakSelf.chatView) {
      [weakSelf.chatView removeFromSuperview];
      weakSelf.chatView = nil;
    }
  }];

  NSLog(@"🟢 [ChatView] hideChat - starting animation");
  [animator startAnimation];
}

- (void)scrollChatToBottom {
  [self scrollChatToBottomAnimated:YES];
}

- (void)scrollChatToBottomAnimated:(BOOL)animated {
  [self scrollChatToBottomIfNeeded:NO animated:animated];
}

- (void)scrollChatToBottomIfNeeded:(BOOL)onlyIfNearBottom animated:(BOOL)animated {
  // Safety check: exit if chat is closed or scroll view is invalid
  if (!self.isChatMode || !self.chatScrollView || !self.chatScrollView.superview) {
    return;
  }

  // Force layout to ensure content size is calculated
  [self.chatScrollView.superview layoutIfNeeded];
  [self.chatScrollView layoutIfNeeded];

  // Also layout the content view
  UIView *contentView = self.chatScrollView.subviews.firstObject;
  if (contentView) {
    [contentView layoutIfNeeded];
  }

  CGFloat contentHeight = self.chatScrollView.contentSize.height;
  CGFloat scrollViewHeight = self.chatScrollView.bounds.size.height;

  // If content size seems wrong, try to recalculate from content view
  if (contentHeight <= 0 && contentView) {
    contentHeight = contentView.frame.size.height;
    if (contentHeight > 0) {
      self.chatScrollView.contentSize = CGSizeMake(self.chatScrollView.bounds.size.width, contentHeight);
    }
  }

  // Only scroll if content is taller than the scroll view
  // Otherwise, reset to top (no scrolling needed)
  if (contentHeight <= scrollViewHeight) {
    // Content fits in view, ensure we're at the top
    if (self.chatScrollView.contentOffset.y != 0) {
      [self.chatScrollView setContentOffset:CGPointZero animated:NO];
    }
    return;
  }

  CGFloat maxOffsetY = contentHeight - scrollViewHeight;
  CGFloat currentOffsetY = self.chatScrollView.contentOffset.y;

  // If onlyIfNearBottom is true, only scroll if user is within 100px of bottom
  if (onlyIfNearBottom) {
    CGFloat distanceFromBottom = maxOffsetY - currentOffsetY;
    if (distanceFromBottom > 100) {
      // User has scrolled up significantly, don't auto-scroll
      return;
    }
  }

  CGPoint bottomOffset = CGPointMake(0, maxOffsetY);
  [self.chatScrollView setContentOffset:bottomOffset animated:animated];
}

- (void)handleChatScrollViewTap:(UITapGestureRecognizer *)gestureRecognizer {
  // Dismiss keyboard when tapping on chat scroll view
  if ([self respondsToSelector:@selector(inputTextView)]) {
    UITextView *inputTextView = [self performSelector:@selector(inputTextView)];
    if (inputTextView && inputTextView.isFirstResponder) {
      [inputTextView resignFirstResponder];
    }
  }
  // Also check chatInputField for backward compatibility
  if (self.chatInputField && self.chatInputField.isFirstResponder) {
    [self.chatInputField resignFirstResponder];
  }
}

#pragma mark - Session Lookup & Message Loading

- (void)lookupSessionAndLoadMessages {
  [self lookupSessionAndLoadMessagesWithErrorHandler:nil];
}

- (void)lookupSessionAndLoadMessagesWithErrorHandler:
    (void (^)(NSError *error))errorHandler {
  // Get manifest URL from visible app
  EXKernel *kernel = [EXKernel sharedInstance];
  EXKernelAppRecord *visibleApp = kernel.visibleApp;

  if (!visibleApp) {
    NSError *error = [NSError
        errorWithDomain:@"EXPreviewZoomManager"
                   code:404
               userInfo:@{NSLocalizedDescriptionKey : @"No visible app found"}];
    if (errorHandler) {
      errorHandler(error);
    }
    NSLog(@"❌ No visible app found for chat");
    return;
  }

  NSURL *manifestUrl = visibleApp.appLoader.manifestUrl;
  if (!manifestUrl) {
    NSError *error =
        [NSError errorWithDomain:@"EXPreviewZoomManager"
                            code:404
                        userInfo:@{
                          NSLocalizedDescriptionKey : @"No manifest URL found"
                        }];
    if (errorHandler) {
      errorHandler(error);
    }
    NSLog(@"❌ No manifest URL found for chat");
    return;
  }

  NSString *manifestUrlString = manifestUrl.absoluteString;
  NSLog(@"🔍 Looking up session for manifest URL: %@", manifestUrlString);

  // Configure backend service if needed (get URLs from environment or use
  // defaults)
  EXChatBackendService *backendService = [EXChatBackendService sharedInstance];

  // Get URLs from EXEnvBridge (reads from NSUserDefaults synced from .env)
  NSString *convexUrl = [EXEnvBridge convexUrl];
  NSString *v0ApiUrl = [EXEnvBridge v0ApiUrl];

  // Configure backend service with env-based URLs
  [backendService configureWithConvexUrl:convexUrl v0ApiUrl:v0ApiUrl];

  // Find session by manifest URL
  [backendService
      findSessionByManifestUrl:manifestUrlString
                    completion:^(NSDictionary *_Nullable session,
                                 NSError *_Nullable error) {
                      dispatch_async(dispatch_get_main_queue(), ^{
                        if (error) {
                          NSLog(@"❌ Error finding session: %@",
                                error.localizedDescription);
                          if (errorHandler) {
                            errorHandler(error);
                          }
                          return;
                        }

                        if (!session) {
                          NSError *noSessionError = [NSError
                              errorWithDomain:@"EXPreviewZoomManager"
                                         code:404
                                     userInfo:@{
                                       NSLocalizedDescriptionKey :
                                           @"No session found for this project"
                                     }];
                          if (errorHandler) {
                            errorHandler(noSessionError);
                          }
                          NSLog(@"❌ No session found for manifest URL: %@",
                                manifestUrlString);
                          return;
                        }

                        NSString *sessionId = session[@"_id"] ?: session[@"id"];
                        if (!sessionId ||
                            ![sessionId isKindOfClass:[NSString class]]) {
                          NSError *invalidError =
                              [NSError errorWithDomain:@"EXPreviewZoomManager"
                                                  code:500
                                              userInfo:@{
                                                NSLocalizedDescriptionKey :
                                                    @"Invalid session data"
                                              }];
                          if (errorHandler) {
                            errorHandler(invalidError);
                          }
                          NSLog(@"❌ Invalid session ID in session: %@",
                                session);
                          return;
                        }

                        NSLog(@"✅ Found session: %@", sessionId);
                        self.chatSessionId = sessionId;
                        self.chatSession = session;

                        // Cache the manifest URL -> sessionId mapping for instant future loads
                        EXChatMessageCache *cache = [EXChatMessageCache sharedInstance];
                        [cache cacheSessionId:sessionId forManifestUrl:manifestUrlString];
                        [cache cacheSession:session forSessionId:sessionId];

                        // Set app name from session name (from Convex database)
                        NSString *sessionName = session[@"name"];
                        if (sessionName && [sessionName isKindOfClass:[NSString class]] && sessionName.length > 0) {
                          [self setAppName:sessionName];
                          NSLog(@"✅ Set app name from session: %@", sessionName);
                        }

                        // Set sandbox ID from session for stop agent functionality
                        // IMPORTANT: session[@"sessionId"] is the E2B sandbox ID, NOT the Convex document ID
                        // session[@"_id"] is the Convex document ID (chatSessionId)
                        NSString *sandboxSessionId = session[@"sessionId"];
                        NSLog(@"📍 [ChatView] Session IDs - Convex docId: %@, E2B sandboxId: %@", sessionId, sandboxSessionId);
                        if (sandboxSessionId && [sandboxSessionId isKindOfClass:[NSString class]] && sandboxSessionId.length > 0) {
                          self.sandboxId = sandboxSessionId;
                          NSLog(@"✅ Set sandboxId: %@", sandboxSessionId);
                        } else {
                          NSLog(@"⚠️ [ChatView] No sandboxId in session! Session keys: %@", session.allKeys);
                        }

                        // Extract and set project type from session
                        NSString *projectType = session[@"projectType"];
                        if (projectType && [projectType isKindOfClass:[NSString class]] && projectType.length > 0) {
                          [self setProjectType:projectType];
                          NSLog(@"✅ Set projectType: %@", projectType);

                          // If this is a web project and we have a tunnelUrl, load the web preview
                          if ([projectType isEqualToString:@"web"]) {
                            NSString *tunnelUrlString = session[@"tunnelUrl"];
                            if (tunnelUrlString && [tunnelUrlString isKindOfClass:[NSString class]] && tunnelUrlString.length > 0) {
                              NSURL *webUrl = [NSURL URLWithString:tunnelUrlString];
                              if (webUrl) {
                                self.tunnelUrl = tunnelUrlString;
                                [self loadWebProject:webUrl];
                                NSLog(@"✅ Loading web project at: %@", tunnelUrlString);
                              }
                            }
                          }
                        } else {
                          // Default to mobile if not specified
                          [self setProjectType:@"mobile"];
                        }

                        // Check billing status and update UI
                        [self checkBillingStatusWithCompletion:nil];

                        // Load messages for this session
                        [self loadMessagesForSession:sessionId];

                        // Start polling for updates (messages and session
                        // status)
                        [self startMessagePolling];

                        // Update status display
                        [self updateStatusDisplay];
                      });
                    }];
}

- (void)loadMessagesForSession:(NSString *)sessionId {
  if (!sessionId || sessionId.length == 0) {
    return;
  }

  // ========================================================================
  // INSTANT LOAD FROM CACHE FIRST
  // Load cached messages immediately so chat opens instantly
  // ========================================================================
  EXChatMessageCache *cache = [EXChatMessageCache sharedInstance];
  if ([cache hasCacheForSession:sessionId]) {
    NSArray *cachedMessages = [cache cachedMessagesForSession:sessionId];
    if (cachedMessages.count > 0) {
      NSLog(@"⚡️ Loaded %lu messages from cache instantly", (unsigned long)cachedMessages.count);
      self.chatMessages = cachedMessages;
      self.displayedMessageCount = 0;
      [self refreshChatMessagesView];

      // Scroll to bottom immediately for cached content
      dispatch_async(dispatch_get_main_queue(), ^{
        [self scrollChatToBottomAnimated:NO];
      });
    }
  }

  // ========================================================================
  // FETCH FRESH MESSAGES IN BACKGROUND
  // Then fetch from server and update if there are changes
  // ========================================================================
  EXChatBackendService *backendService = [EXChatBackendService sharedInstance];
  [backendService
      fetchMessagesForSession:sessionId
                   completion:^(NSArray<NSDictionary *> *_Nullable messages,
                                NSError *_Nullable error) {
                     dispatch_async(dispatch_get_main_queue(), ^{
                       if (error) {
                         NSLog(@"❌ Error fetching messages: %@",
                               error.localizedDescription);
                         // If we have cached data, don't show error - just use cache
                         if (self.chatMessages.count > 0) {
                           return;
                         }
                         // Show error in UI if chat is visible and no cached data
                         if (self.isChatMode && self.chatScrollView) {
                           UIView *contentView =
                               self.chatScrollView.subviews.firstObject;
                           if (contentView && contentView.subviews.count == 0) {
                             UILabel *errorLabel = [[UILabel alloc] init];
                             errorLabel.text =
                                 @"Failed to load messages. Please try again.";
                             errorLabel.textColor = [UIColor lightGrayColor];
                             errorLabel.font = [UIFont systemFontOfSize:14];
                             errorLabel.textAlignment = NSTextAlignmentCenter;
                             errorLabel.numberOfLines = 0;
                             errorLabel
                                 .translatesAutoresizingMaskIntoConstraints =
                                 NO;
                             [contentView addSubview:errorLabel];

                             [NSLayoutConstraint activateConstraints:@[
                               [errorLabel.centerXAnchor
                                   constraintEqualToAnchor:contentView
                                                               .centerXAnchor],
                               [errorLabel.centerYAnchor
                                   constraintEqualToAnchor:contentView
                                                               .centerYAnchor],
                               [errorLabel.leadingAnchor
                                   constraintEqualToAnchor:contentView
                                                               .leadingAnchor
                                                  constant:40],
                               [errorLabel.trailingAnchor
                                   constraintEqualToAnchor:contentView
                                                               .trailingAnchor
                                                  constant:-40]
                             ]];
                           }
                         }
                         return;
                       }

                       NSArray *newMessages = messages ?: @[];

                       // Only update UI if messages have changed
                       BOOL hasNewMessages = newMessages.count != self.chatMessages.count;
                       if (!hasNewMessages && newMessages.count > 0) {
                         // Check if last message is different
                         NSDictionary *lastNew = newMessages.lastObject;
                         NSDictionary *lastOld = self.chatMessages.lastObject;
                         NSString *newId = lastNew[@"_id"];
                         NSString *oldId = lastOld[@"_id"];
                         hasNewMessages = ![newId isEqualToString:oldId];
                       }

                       if (hasNewMessages || self.chatMessages.count == 0) {
                         self.chatMessages = newMessages;

                         // Save to cache for next time
                         [cache cacheMessages:newMessages forSession:sessionId];
                         NSLog(@"💾 Cached %lu messages for instant loading", (unsigned long)newMessages.count);

                         // Reset displayed count when new messages are loaded
                         self.displayedMessageCount = 0;

                         // Refresh the chat view with new messages
                         [self refreshChatMessagesView];

                         // Force scroll to bottom after initial load with adequate delay for layout
                         // Use animated:NO for instant scroll on initial load (no glitchy animation)
                         dispatch_after(
                             dispatch_time(DISPATCH_TIME_NOW,
                                           (int64_t)(0.25 * NSEC_PER_SEC)),
                             dispatch_get_main_queue(), ^{
                               [self scrollChatToBottomAnimated:NO];
                             });
                       }
                     });
                   }];
}

// Helper method to extract message ID from a message dictionary
- (NSString *)messageIdFromMessage:(NSDictionary *)message {
  // Try _id first (Convex document ID), then fall back to creating a hash
  NSString *messageId = message[@"_id"];
  if (messageId) {
    return messageId;
  }
  // Create a stable ID from content + timestamp if no _id
  NSString *content = message[@"content"] ?: @"";
  NSNumber *timestamp = message[@"_creationTime"] ?: @0;
  return [NSString stringWithFormat:@"%@_%@", @(content.hash), timestamp];
}

// Helper to get estimated height for a message (with caching)
- (CGFloat)estimatedHeightForMessage:(NSDictionary *)message {
  NSString *messageId = [self messageIdFromMessage:message];

  // Check cache first
  NSNumber *cachedHeight = self.messageHeightCache[messageId];
  if (cachedHeight) {
    return cachedHeight.floatValue;
  }

  // Estimate based on content type and length
  CGFloat estimatedHeight = 50; // Default

  // Inline displays (file edit, file read, bash, web search, mcp tool) - compact 24pt
  if (message[@"edits"] || message[@"read"] || message[@"bash"] || message[@"webSearch"] || message[@"mcpTool"]) {
    estimatedHeight = 24;
  } else if (message[@"todos"]) {
    // Todo cards with header (24pt) + spacing (12pt) + items (22pt each with 8pt spacing) + padding (24pt)
    NSArray *todos = message[@"todos"];
    estimatedHeight = 24 + 12 + 24 + (todos.count * 22) + ((todos.count > 1 ? todos.count - 1 : 0) * 8);
  } else if (message[@"content"]) {
    NSString *content = message[@"content"];
    // Rough estimate: ~50 chars per line, 20pt per line
    CGFloat lines = ceil(content.length / 40.0);
    estimatedHeight = MAX(50, MIN(400, 30 + (lines * 20)));
  }

  return estimatedHeight;
}

// Estimated height for grouped messages
- (CGFloat)estimatedHeightForGroup:(NSDictionary *)group {
  NSString *groupId = group[@"id"];

  // Check cache first
  NSNumber *cachedHeight = self.messageHeightCache[groupId];
  if (cachedHeight) {
    return cachedHeight.floatValue;
  }

  NSString *type = group[@"type"];
  CGFloat estimatedHeight = 50; // Default

  // Command log rows (read, edit, bash) - header row + expandable items
  if ([type isEqualToString:@"read"] || [type isEqualToString:@"edit"] || [type isEqualToString:@"bash"]) {
    NSArray *items = group[@"files"] ?: group[@"commands"] ?: @[];
    // Header row: 44pt, each expanded item: ~24pt with spacing
    BOOL isExpanded = [self.expandedGroups[groupId] boolValue] || [groupId isEqualToString:self.latestExpandableGroupId];
    if (isExpanded && items.count > 0) {
      estimatedHeight = 44 + (items.count * 28);
    } else {
      estimatedHeight = 44;
    }
  } else if ([type isEqualToString:@"tasks"]) {
    // Tasks card with TASKS header and items
    NSDictionary *message = group[@"message"];
    NSArray *todos = message[@"todos"];
    // Header (36pt) + items (28pt each with 6pt spacing) + padding
    estimatedHeight = 36 + 16 + (todos.count * 28) + ((todos.count > 1 ? todos.count - 1 : 0) * 6) + 16;
  } else if ([type isEqualToString:@"tool"] || [type isEqualToString:@"search"]) {
    estimatedHeight = 40;
  } else if ([type isEqualToString:@"text"] || [type isEqualToString:@"user"]) {
    NSDictionary *message = group[@"message"];
    NSString *content = message[@"content"];
    CGFloat lines = ceil(content.length / 40.0);
    estimatedHeight = MAX(50, MIN(400, 30 + (lines * 20)));
  } else if ([type isEqualToString:@"image"]) {
    estimatedHeight = 200;
  }

  return estimatedHeight;
}

// Cache the actual rendered height of a message
- (void)cacheHeightForMessage:(NSDictionary *)message height:(CGFloat)height {
  if (!self.messageHeightCache) {
    self.messageHeightCache = [NSMutableDictionary dictionary];
  }
  NSString *messageId = [self messageIdFromMessage:message];
  self.messageHeightCache[messageId] = @(height);
}

// Cache the actual rendered height of a group
- (void)cacheHeightForGroup:(NSDictionary *)group height:(CGFloat)height {
  if (!self.messageHeightCache) {
    self.messageHeightCache = [NSMutableDictionary dictionary];
  }
  NSString *groupId = group[@"id"];
  if (groupId) {
    self.messageHeightCache[groupId] = @(height);
  }
}

- (void)refreshChatMessagesView {
  // Early exit if chat is not in chat mode or view hierarchy is invalid
  // This prevents accessing stale constraints during chat close animation
  if (!self.isChatMode || !self.chatScrollView || !self.chatScrollView.superview || !self.chatMessages) {
    return;
  }

  // Use IGListKit adapter if available (preferred path for performance)
  if (self.chatListAdapter) {
    // Process messages into groups (like NewOnboardingScreen15)
    NSInteger totalMessages = self.chatMessages.count;
    NSInteger messagesToShow = self.displayedMessageCount > 0
                                 ? self.displayedMessageCount
                                 : MIN(50, totalMessages);
    NSInteger startIndex = MAX(0, totalMessages - messagesToShow);
    NSArray *visibleMessages = [self.chatMessages
        subarrayWithRange:NSMakeRange(startIndex, totalMessages - startIndex)];

    self.displayedMessageCount = messagesToShow;

    NSArray *groups = [self processMessagesIntoGroups:visibleMessages];
    self.groupedMessages = groups;

    // Find latest expandable group for auto-expand
    NSString *latestExpandableGroupId = [self findLatestExpandableGroupId:groups];

    // Initialize expanded groups tracking if needed
    if (!self.expandedGroups) {
      self.expandedGroups = [NSMutableDictionary dictionary];
    }

    // Auto-collapse other expandable groups when latest changes
    if (latestExpandableGroupId && ![latestExpandableGroupId isEqualToString:self.latestExpandableGroupId]) {
      for (NSDictionary *group in groups) {
        NSString *type = group[@"type"];
        NSString *groupId = group[@"id"];
        if (([type isEqualToString:@"read"] || [type isEqualToString:@"edit"] || [type isEqualToString:@"bash"]) &&
            ![groupId isEqualToString:latestExpandableGroupId]) {
          self.expandedGroups[groupId] = @NO;
        }
      }
    }
    self.latestExpandableGroupId = latestExpandableGroupId;

    // Update IGListKit adapter with new data
    [self.chatListAdapter updateWithMessages:visibleMessages
                             groupedMessages:groups
                             expandedGroups:self.expandedGroups
                        latestExpandableGroupId:latestExpandableGroupId
                                    animated:YES];

    // Update status in the adapter
    NSString *statusText = self.chatSession[@"statusMessage"];
    BOOL isAgentRunning = self.isAgentRunning;
    [self.chatListAdapter updateStatusMessage:statusText isWorking:isAgentRunning];

    // Handle scrolling: Skip scrolling until chat animation completes
    // The animation completion handler will set initial position
    if (!self.isChatAnimationComplete) {
      // Animation still in progress - don't scroll, let animation completion handle it
      return;
    }

    // After animation is complete, handle scrolling normally
    if (!self.hasSetInitialScrollPosition) {
      // First time after animation - set position immediately without animation
      if (self.chatListAdapter.collectionNode.view.contentSize.height > 0) {
        [self.chatListAdapter setInitialScrollPosition];
        self.hasSetInitialScrollPosition = YES;
      }
    } else {
      // Subsequent updates - only scroll if user is near bottom
      [self.chatListAdapter scrollToBottomIfNeeded:YES animated:YES];
    }
  }
}

- (UIView *)renderMessage:(NSDictionary *)message {
  // Check for special message types FIRST (they may also have role/content)
  // These are tool/operation messages that should be rendered specially

  // Check for file edit operations
  if (message[@"edits"]) {
    return [self renderFileEdit:message];
  }

  // Check for file read operations
  if (message[@"read"]) {
    return [self renderFileRead:message];
  }

  // Check for todo list
  if (message[@"todos"]) {
    return [self renderTodos:message];
  }

  // Check for bash/terminal commands
  if (message[@"bash"]) {
    return [self renderBash:message];
  }

  // Check for web search
  if (message[@"webSearch"]) {
    return [self renderWebSearch:message];
  }

  // Check for MCP tool calls
  if (message[@"mcpTool"]) {
    return [self renderMcpTool:message];
  }

  // Now check for regular chat messages (has role and content)
  NSString *role = message[@"role"];
  NSString *content = message[@"content"];

  if (role && content) {
    return [self renderTextMessage:message];
  }

  // Standalone image message (no role/content, just image data)
  if (message[@"image"]) {
    return [self renderImage:message];
  }

  return nil;
}

// Helper method to parse markdown and return attributed string
// Note: Code blocks (```) are handled separately in renderTextMessage
- (NSAttributedString *)parseMarkdown:(NSString *)text
                         withBaseFont:(UIFont *)font
                            textColor:(UIColor *)textColor {
  if (!text) {
    return [[NSAttributedString alloc] initWithString:@""];
  }

  NSMutableAttributedString *attributedString =
      [[NSMutableAttributedString alloc] initWithString:text];

  // Create paragraph style with line spacing
  NSMutableParagraphStyle *paragraphStyle = [[NSMutableParagraphStyle alloc] init];
  paragraphStyle.lineSpacing = 3; // Reduced line spacing
  paragraphStyle.paragraphSpacing = 6; // Reduced space between paragraphs

  [attributedString addAttributes:@{
    NSFontAttributeName : font,
    NSForegroundColorAttributeName : textColor,
    NSParagraphStyleAttributeName : paragraphStyle
  }
                            range:NSMakeRange(0, attributedString.length)];

  NSError *error = nil;

  // Parse headers # ## ### at start of lines FIRST (before other formatting)
  NSString *headerPattern = @"(?m)^(#{1,3})\\s+(.+)$";
  NSRegularExpression *headerRegex = [NSRegularExpression
      regularExpressionWithPattern:headerPattern
                           options:0
                             error:&error];
  if (!error) {
    NSArray *headerMatches = [headerRegex matchesInString:attributedString.string
                                                  options:0
                                                    range:NSMakeRange(0, attributedString.length)];
    NSArray *reverseHeaderMatches = [[headerMatches reverseObjectEnumerator] allObjects];

    for (NSTextCheckingResult *match in reverseHeaderMatches) {
      NSRange fullRange = match.range;
      NSRange hashRange = [match rangeAtIndex:1];
      NSRange textRange = [match rangeAtIndex:2];

      NSString *headerText = [attributedString.string substringWithRange:textRange];
      NSUInteger level = hashRange.length;

      // Determine font size based on header level - make headers much more prominent
      CGFloat headerSize = font.pointSize;
      if (level == 1) headerSize = font.pointSize + 8;
      else if (level == 2) headerSize = font.pointSize + 5;
      else if (level == 3) headerSize = font.pointSize + 3;

      // Create header with extra spacing
      NSMutableParagraphStyle *headerPara = [[NSMutableParagraphStyle alloc] init];
      headerPara.lineSpacing = 3;
      headerPara.paragraphSpacingBefore = 10; // Reduced space before headers
      headerPara.paragraphSpacing = 4;

      NSMutableAttributedString *headerAttr = [[NSMutableAttributedString alloc] initWithString:[NSString stringWithFormat:@"%@\n", headerText]];
      [headerAttr addAttributes:@{
        NSFontAttributeName: [UIFont systemFontOfSize:headerSize weight:UIFontWeightBold],
        NSForegroundColorAttributeName: [UIColor whiteColor],
        NSParagraphStyleAttributeName: headerPara
      } range:NSMakeRange(0, headerAttr.length)];

      [attributedString replaceCharactersInRange:fullRange withAttributedString:headerAttr];
    }
  }

  // Parse inline code `code` - process before other formatting
  NSString *inlineCodePattern = @"`([^`]+)`";
  NSRegularExpression *inlineCodeRegex = [NSRegularExpression
      regularExpressionWithPattern:inlineCodePattern
                           options:0
                             error:&error];
  if (!error) {
    NSArray *matches = [inlineCodeRegex matchesInString:attributedString.string
                                                options:0
                                                  range:NSMakeRange(0, attributedString.length)];
    NSArray *reverseMatches = [[matches reverseObjectEnumerator] allObjects];

    for (NSTextCheckingResult *match in reverseMatches) {
      NSRange fullRange = match.range;
      NSRange textRange = [match rangeAtIndex:1];
      NSString *codeText = [attributedString.string substringWithRange:textRange];

      // Create code styled text with padding
      NSMutableAttributedString *codeAttr = [[NSMutableAttributedString alloc] initWithString:[NSString stringWithFormat:@" %@ ", codeText]];
      UIFont *monoFont = [UIFont fontWithName:@"Menlo" size:font.pointSize - 1] ?:
                         [UIFont fontWithName:@"Courier" size:font.pointSize - 1] ?:
                         font;
      UIColor *codeColor = [UIColor colorWithRed:1.0 green:0.6 blue:0.4 alpha:1.0]; // Orange for code
      UIColor *codeBg = [UIColor colorWithWhite:1.0 alpha:0.12]; // Slightly more visible background
      [codeAttr addAttributes:@{
        NSFontAttributeName: monoFont,
        NSForegroundColorAttributeName: codeColor,
        NSBackgroundColorAttributeName: codeBg
      } range:NSMakeRange(0, codeAttr.length)];

      [attributedString replaceCharactersInRange:fullRange withAttributedString:codeAttr];
    }
  }

  // Parse bold **text**
  NSString *boldPattern = @"\\*\\*(.+?)\\*\\*";
  NSRegularExpression *boldRegex = [NSRegularExpression
      regularExpressionWithPattern:boldPattern
                           options:NSRegularExpressionCaseInsensitive |
                                   NSRegularExpressionDotMatchesLineSeparators
                             error:&error];
  if (!error) {
    NSArray *boldMatches =
        [boldRegex matchesInString:attributedString.string
                           options:0
                             range:NSMakeRange(0, attributedString.length)];
    NSArray *reverseBoldMatches =
        [[boldMatches reverseObjectEnumerator] allObjects];

    for (NSTextCheckingResult *match in reverseBoldMatches) {
      NSRange fullRange = match.range;
      NSRange textRange = [match rangeAtIndex:1];
      NSString *boldText = [attributedString.string substringWithRange:textRange];

      // Create bold styled text
      NSMutableAttributedString *boldAttr = [[NSMutableAttributedString alloc] initWithString:boldText];
      [boldAttr addAttributes:@{
        NSFontAttributeName : [UIFont boldSystemFontOfSize:font.pointSize],
        NSForegroundColorAttributeName: [UIColor whiteColor] // Make bold text white for emphasis
      }
                        range:NSMakeRange(0, boldAttr.length)];

      [attributedString replaceCharactersInRange:fullRange withAttributedString:boldAttr];
    }
  }

  // Parse italic *text* or _text_
  NSString *italicPattern = @"(?<![\\*_])([\\*_])(?![\\*_])(.+?)(?<![\\*_])\\1(?![\\*_])";
  NSRegularExpression *italicRegex = [NSRegularExpression
      regularExpressionWithPattern:italicPattern
                           options:0
                             error:&error];
  if (!error) {
    NSArray *italicMatches = [italicRegex matchesInString:attributedString.string
                                                  options:0
                                                    range:NSMakeRange(0, attributedString.length)];
    NSArray *reverseItalicMatches = [[italicMatches reverseObjectEnumerator] allObjects];

    for (NSTextCheckingResult *match in reverseItalicMatches) {
      NSRange fullRange = match.range;
      if ([match numberOfRanges] >= 3) {
        NSRange textRange = [match rangeAtIndex:2];

        // Apply italic font
        UIFont *italicFont = [UIFont italicSystemFontOfSize:font.pointSize];
        [attributedString addAttributes:@{NSFontAttributeName: italicFont} range:textRange];

        // Remove markers
        [attributedString deleteCharactersInRange:NSMakeRange(fullRange.location + fullRange.length - 1, 1)];
        [attributedString deleteCharactersInRange:NSMakeRange(fullRange.location, 1)];
      }
    }
  }

  // Parse strikethrough ~~text~~
  NSString *strikePattern = @"~~(.+?)~~";
  NSRegularExpression *strikeRegex = [NSRegularExpression
      regularExpressionWithPattern:strikePattern
                           options:0
                             error:&error];
  if (!error) {
    NSArray *strikeMatches = [strikeRegex matchesInString:attributedString.string
                                                  options:0
                                                    range:NSMakeRange(0, attributedString.length)];
    NSArray *reverseStrikeMatches = [[strikeMatches reverseObjectEnumerator] allObjects];

    for (NSTextCheckingResult *match in reverseStrikeMatches) {
      NSRange fullRange = match.range;
      NSRange textRange = [match rangeAtIndex:1];

      [attributedString addAttributes:@{
        NSStrikethroughStyleAttributeName: @(NSUnderlineStyleSingle),
        NSStrikethroughColorAttributeName: textColor
      } range:textRange];

      // Remove markers
      [attributedString deleteCharactersInRange:NSMakeRange(fullRange.location + fullRange.length - 2, 2)];
      [attributedString deleteCharactersInRange:NSMakeRange(fullRange.location, 2)];
    }
  }

  // Parse links [text](url) - show text in blue
  NSString *linkPattern = @"\\[([^\\]]+)\\]\\(([^\\)]+)\\)";
  NSRegularExpression *linkRegex = [NSRegularExpression
      regularExpressionWithPattern:linkPattern
                           options:0
                             error:&error];
  if (!error) {
    NSArray *linkMatches = [linkRegex matchesInString:attributedString.string
                                              options:0
                                                range:NSMakeRange(0, attributedString.length)];
    NSArray *reverseLinkMatches = [[linkMatches reverseObjectEnumerator] allObjects];

    for (NSTextCheckingResult *match in reverseLinkMatches) {
      NSRange fullRange = match.range;
      NSRange textRange = [match rangeAtIndex:1];
      NSRange urlRange = [match rangeAtIndex:2];

      NSString *linkText = [attributedString.string substringWithRange:textRange];
      NSString *urlString = [attributedString.string substringWithRange:urlRange];

      // Create link styled text
      NSMutableAttributedString *linkAttr = [[NSMutableAttributedString alloc] initWithString:linkText];
      UIColor *linkColor = [UIColor colorWithRed:0.4 green:0.69 blue:1.0 alpha:1.0]; // Blue
      [linkAttr addAttributes:@{
        NSFontAttributeName: font,
        NSForegroundColorAttributeName: linkColor,
        NSUnderlineStyleAttributeName: @(NSUnderlineStyleSingle),
        NSLinkAttributeName: urlString
      } range:NSMakeRange(0, linkAttr.length)];

      [attributedString replaceCharactersInRange:fullRange withAttributedString:linkAttr];
    }
  }

  // Parse bullet points - and * at start of lines - with proper indentation
  NSString *bulletPattern = @"(?m)^(\\s*)[\\-\\*]\\s+";
  NSRegularExpression *bulletRegex = [NSRegularExpression
      regularExpressionWithPattern:bulletPattern
                           options:0
                             error:&error];
  if (!error) {
    NSArray *bulletMatches = [bulletRegex matchesInString:attributedString.string
                                                  options:0
                                                    range:NSMakeRange(0, attributedString.length)];
    NSArray *reverseBulletMatches = [[bulletMatches reverseObjectEnumerator] allObjects];

    for (NSTextCheckingResult *match in reverseBulletMatches) {
      NSRange fullRange = match.range;
      NSRange indentRange = [match rangeAtIndex:1];
      NSString *indent = indentRange.length > 0 ? [attributedString.string substringWithRange:indentRange] : @"";

      // Create bullet with same indentation plus bullet symbol
      NSString *bulletText = [NSString stringWithFormat:@"%@  •  ", indent];
      NSMutableAttributedString *bulletAttr = [[NSMutableAttributedString alloc] initWithString:bulletText];

      // Create paragraph style with proper indentation
      NSMutableParagraphStyle *bulletPara = [[NSMutableParagraphStyle alloc] init];
      bulletPara.lineSpacing = 4;
      bulletPara.paragraphSpacing = 6;
      bulletPara.firstLineHeadIndent = indent.length * 8; // 8pt per indent level
      bulletPara.headIndent = indent.length * 8 + 20; // Hanging indent for wrapped lines

      [bulletAttr addAttributes:@{
        NSFontAttributeName: font,
        NSForegroundColorAttributeName: [UIColor colorWithRed:0.35 green:0.78 blue:0.82 alpha:1.0], // Cyan bullet
        NSParagraphStyleAttributeName: bulletPara
      } range:NSMakeRange(0, bulletAttr.length)];

      [attributedString replaceCharactersInRange:fullRange withAttributedString:bulletAttr];
    }
  }

  // Parse numbered lists 1. 2. etc at start of lines
  NSString *numberPattern = @"(?m)^(\\d+)\\.\\s+";
  NSRegularExpression *numberRegex = [NSRegularExpression
      regularExpressionWithPattern:numberPattern
                           options:0
                             error:&error];
  if (!error) {
    NSArray *numberMatches = [numberRegex matchesInString:attributedString.string
                                                  options:0
                                                    range:NSMakeRange(0, attributedString.length)];
    NSArray *reverseNumberMatches = [[numberMatches reverseObjectEnumerator] allObjects];

    for (NSTextCheckingResult *match in reverseNumberMatches) {
      NSRange fullRange = match.range;
      NSRange numRange = [match rangeAtIndex:1];
      NSString *numStr = [attributedString.string substringWithRange:numRange];

      NSMutableAttributedString *numAttr = [[NSMutableAttributedString alloc]
          initWithString:[NSString stringWithFormat:@"  %@.  ", numStr]];
      [numAttr addAttributes:@{
        NSFontAttributeName: [UIFont monospacedDigitSystemFontOfSize:font.pointSize weight:UIFontWeightSemibold],
        NSForegroundColorAttributeName: [UIColor colorWithRed:0.35 green:0.78 blue:0.82 alpha:1.0] // Cyan numbers
      } range:NSMakeRange(0, numAttr.length)];

      [attributedString replaceCharactersInRange:fullRange withAttributedString:numAttr];
    }
  }

  // Parse file paths (e.g., folder/file.txt, ./src/index.js, /path/to/file)
  NSString *pathPattern = @"(?<![\\w/])(\\.{0,2}/)?([\\w\\-\\.]+/)+[\\w\\-\\.]+(?:\\.[\\w]+)?(?![\\w/])";
  NSRegularExpression *pathRegex = [NSRegularExpression
      regularExpressionWithPattern:pathPattern
                           options:0
                             error:&error];
  if (!error) {
    NSArray *pathMatches = [pathRegex matchesInString:attributedString.string
                                              options:0
                                                range:NSMakeRange(0, attributedString.length)];

    for (NSTextCheckingResult *match in [pathMatches reverseObjectEnumerator]) {
      NSRange fullRange = match.range;

      // Apply file path styling - cyan/teal color like terminal paths
      UIColor *pathColor = [UIColor colorWithRed:0.35 green:0.78 blue:0.82 alpha:1.0]; // Cyan
      [attributedString addAttributes:@{
        NSForegroundColorAttributeName: pathColor,
        NSFontAttributeName: [UIFont fontWithName:@"Menlo" size:font.pointSize - 1] ?:
                             [UIFont fontWithName:@"Courier" size:font.pointSize - 1] ?:
                             font
      } range:fullRange];
    }
  }

  return attributedString;
}

// Helper to split content into code blocks and regular text segments
- (NSArray *)splitContentIntoSegments:(NSString *)content {
  NSMutableArray *segments = [NSMutableArray array];

  // Pattern for code blocks: ```language\ncode\n``` or ```\ncode\n```
  NSString *codeBlockPattern = @"```([a-zA-Z]*)\\n([\\s\\S]*?)```";
  NSError *error = nil;
  NSRegularExpression *regex = [NSRegularExpression
      regularExpressionWithPattern:codeBlockPattern
                           options:0
                             error:&error];

  if (error) {
    // If regex fails, return single text segment
    [segments addObject:@{@"type": @"text", @"content": content}];
    return segments;
  }

  NSArray *matches = [regex matchesInString:content options:0 range:NSMakeRange(0, content.length)];

  if (matches.count == 0) {
    // No code blocks, return single text segment
    [segments addObject:@{@"type": @"text", @"content": content}];
    return segments;
  }

  NSInteger lastEnd = 0;
  for (NSTextCheckingResult *match in matches) {
    NSRange fullRange = match.range;

    // Add text before this code block
    if (fullRange.location > lastEnd) {
      NSString *textBefore = [content substringWithRange:NSMakeRange(lastEnd, fullRange.location - lastEnd)];
      NSString *trimmed = [textBefore stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
      if (trimmed.length > 0) {
        [segments addObject:@{@"type": @"text", @"content": textBefore}];
      }
    }

    // Add code block
    NSString *language = @"";
    NSString *code = @"";
    if ([match numberOfRanges] >= 3) {
      NSRange langRange = [match rangeAtIndex:1];
      NSRange codeRange = [match rangeAtIndex:2];
      language = langRange.length > 0 ? [content substringWithRange:langRange] : @"";
      code = [content substringWithRange:codeRange];
    }

    [segments addObject:@{
      @"type": @"code",
      @"content": code,
      @"language": language
    }];

    lastEnd = fullRange.location + fullRange.length;
  }

  // Add remaining text after last code block
  if (lastEnd < content.length) {
    NSString *textAfter = [content substringFromIndex:lastEnd];
    NSString *trimmed = [textAfter stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
    if (trimmed.length > 0) {
      [segments addObject:@{@"type": @"text", @"content": textAfter}];
    }
  }

  return segments;
}

// Create a styled code block view
- (UIView *)createCodeBlockView:(NSString *)code language:(NSString *)language {
  UIView *container = [[UIView alloc] init];
  container.translatesAutoresizingMaskIntoConstraints = NO;
  container.backgroundColor = [UIColor colorWithWhite:0.08 alpha:0.95]; // Dark code background
  container.layer.cornerRadius = 12;
  container.layer.borderWidth = 1;
  container.layer.borderColor = [UIColor colorWithWhite:1.0 alpha:0.1].CGColor;
  container.clipsToBounds = YES;

  CGFloat padding = 14;

  // Optional language label at top
  CGFloat topOffset = padding;
  if (language.length > 0) {
    UILabel *langLabel = [[UILabel alloc] init];
    langLabel.translatesAutoresizingMaskIntoConstraints = NO;
    langLabel.text = language;
    langLabel.textColor = [UIColor colorWithWhite:1.0 alpha:0.5];
    langLabel.font = [UIFont systemFontOfSize:11 weight:UIFontWeightMedium];
    [container addSubview:langLabel];

    [NSLayoutConstraint activateConstraints:@[
      [langLabel.topAnchor constraintEqualToAnchor:container.topAnchor constant:10],
      [langLabel.leadingAnchor constraintEqualToAnchor:container.leadingAnchor constant:padding],
    ]];

    topOffset = 32;
  }

  // Code content label
  UILabel *codeLabel = [[UILabel alloc] init];
  codeLabel.translatesAutoresizingMaskIntoConstraints = NO;
  codeLabel.numberOfLines = 0;

  // Style the code
  UIFont *monoFont = [UIFont fontWithName:@"Menlo" size:12] ?: [UIFont fontWithName:@"Courier" size:12];
  NSMutableParagraphStyle *codePara = [[NSMutableParagraphStyle alloc] init];
  codePara.lineSpacing = 4;

  // Apply syntax highlighting colors
  NSMutableAttributedString *codeAttr = [[NSMutableAttributedString alloc] initWithString:code];
  UIColor *codeColor = [UIColor colorWithWhite:0.9 alpha:1.0]; // Light gray base

  [codeAttr addAttributes:@{
    NSFontAttributeName: monoFont,
    NSForegroundColorAttributeName: codeColor,
    NSParagraphStyleAttributeName: codePara
  } range:NSMakeRange(0, codeAttr.length)];

  // Simple syntax highlighting
  NSError *error = nil;

  // Keywords (blue)
  NSArray *keywords = @[@"const", @"let", @"var", @"function", @"return", @"if", @"else", @"for", @"while",
                        @"import", @"export", @"from", @"class", @"extends", @"new", @"this", @"async", @"await",
                        @"def", @"self", @"True", @"False", @"None", @"struct", @"enum", @"impl"];
  UIColor *keywordColor = [UIColor colorWithRed:0.4 green:0.69 blue:1.0 alpha:1.0];
  for (NSString *keyword in keywords) {
    NSString *pattern = [NSString stringWithFormat:@"\\b%@\\b", keyword];
    NSRegularExpression *kwRegex = [NSRegularExpression regularExpressionWithPattern:pattern options:0 error:&error];
    if (!error) {
      NSArray *matches = [kwRegex matchesInString:code options:0 range:NSMakeRange(0, code.length)];
      for (NSTextCheckingResult *match in matches) {
        [codeAttr addAttribute:NSForegroundColorAttributeName value:keywordColor range:match.range];
      }
    }
  }

  // Strings (green)
  UIColor *stringColor = [UIColor colorWithRed:0.35 green:0.78 blue:0.45 alpha:1.0];
  NSRegularExpression *stringRegex = [NSRegularExpression
      regularExpressionWithPattern:@"(['\"`])(?:[^\\1\\\\]|\\\\.)*?\\1"
                           options:0
                             error:&error];
  if (!error) {
    NSArray *matches = [stringRegex matchesInString:code options:0 range:NSMakeRange(0, code.length)];
    for (NSTextCheckingResult *match in matches) {
      [codeAttr addAttribute:NSForegroundColorAttributeName value:stringColor range:match.range];
    }
  }

  // Comments (gray)
  UIColor *commentColor = [UIColor colorWithWhite:0.5 alpha:1.0];
  NSRegularExpression *commentRegex = [NSRegularExpression
      regularExpressionWithPattern:@"(//.*|#.*)"
                           options:0
                             error:&error];
  if (!error) {
    NSArray *matches = [commentRegex matchesInString:code options:0 range:NSMakeRange(0, code.length)];
    for (NSTextCheckingResult *match in matches) {
      [codeAttr addAttribute:NSForegroundColorAttributeName value:commentColor range:match.range];
    }
  }

  codeLabel.attributedText = codeAttr;
  [container addSubview:codeLabel];

  [NSLayoutConstraint activateConstraints:@[
    [codeLabel.topAnchor constraintEqualToAnchor:container.topAnchor constant:topOffset],
    [codeLabel.leadingAnchor constraintEqualToAnchor:container.leadingAnchor constant:padding],
    [codeLabel.trailingAnchor constraintEqualToAnchor:container.trailingAnchor constant:-padding],
    [codeLabel.bottomAnchor constraintEqualToAnchor:container.bottomAnchor constant:-padding]
  ]];

  return container;
}

- (UIView *)renderTextMessage:(NSDictionary *)message {
  NSString *role = message[@"role"];
  NSString *content = message[@"content"];
  NSDictionary *imageData = message[@"image"]; // Contains storageId, fileName, path

  UIView *container = [[UIView alloc] init];
  container.translatesAutoresizingMaskIntoConstraints = NO;

  // Check if message contains image attachments from text pattern
  NSError *regexError = nil;
  NSRegularExpression *imageRegex = [NSRegularExpression
      regularExpressionWithPattern:@"\\[Image: ([^\\]]+) at ([^\\]]+)\\]"
                           options:0
                             error:&regexError];

  NSArray *imageMatches = regexError ? @[] : [imageRegex matchesInString:content
                                                                 options:0
                                                                   range:NSMakeRange(0, content.length)];

  // Extract text without image references AND extract image paths
  NSString *textContent = content;
  NSMutableArray *imageInfos = [NSMutableArray array];
  if (imageMatches.count > 0) {
    for (NSTextCheckingResult *match in imageMatches) {
      NSRange fileNameRange = [match rangeAtIndex:1];
      NSRange pathRange = [match rangeAtIndex:2];
      NSString *fileName = [content substringWithRange:fileNameRange];
      NSString *path = [content substringWithRange:pathRange];
      // Store both fileName and path for image loading
      [imageInfos addObject:@{@"fileName": fileName, @"path": path}];
    }
    // Remove image references from text
    textContent = [imageRegex stringByReplacingMatchesInString:content
                                                       options:0
                                                         range:NSMakeRange(0, content.length)
                                                  withTemplate:@""];
    // Trim whitespace
    textContent = [textContent stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
  }

  // Check for image data with storageId from message dictionary
  NSString *storageId = imageData[@"storageId"];
  NSString *imagePath = imageData[@"path"];
  BOOL hasStorageImage = (storageId != nil && storageId.length > 0);

  // Also check if we extracted a path from text content
  BOOL hasTextPatternImage = (imageInfos.count > 0);

  if ([role isEqualToString:@"user"]) {
    // User message - right-aligned blue bubble
    UIView *bubbleContainer = [[UIView alloc] init];
    bubbleContainer.translatesAutoresizingMaskIntoConstraints = NO;
    bubbleContainer.backgroundColor = [UIColor colorWithRed:0.0
                                                      green:0.478
                                                       blue:1.0
                                                      alpha:1.0]; // iOS blue
    bubbleContainer.layer.cornerRadius = 18;
    bubbleContainer.layer.maskedCorners = kCALayerMinXMinYCorner |
                                          kCALayerMaxXMinYCorner |
                                          kCALayerMinXMaxYCorner;
    bubbleContainer.layer.masksToBounds = YES;
    [container addSubview:bubbleContainer];

    CGFloat currentY = 12;

    // Add image thumbnails if present (either from storageId or text pattern)
    if (hasStorageImage || hasTextPatternImage) {
      UIView *imageRow = [[UIView alloc] init];
      imageRow.translatesAutoresizingMaskIntoConstraints = NO;
      [bubbleContainer addSubview:imageRow];

      // Create image view container
      UIView *imagePlaceholder = [[UIView alloc] init];
      imagePlaceholder.translatesAutoresizingMaskIntoConstraints = NO;
      imagePlaceholder.backgroundColor = [UIColor colorWithWhite:1.0 alpha:0.2];
      imagePlaceholder.layer.cornerRadius = 8;
      imagePlaceholder.clipsToBounds = YES;
      [imageRow addSubview:imagePlaceholder];

      // Create actual image view for loading from URL
      UIImageView *actualImageView = [[UIImageView alloc] init];
      actualImageView.translatesAutoresizingMaskIntoConstraints = NO;
      actualImageView.contentMode = UIViewContentModeScaleAspectFill;
      actualImageView.clipsToBounds = YES;
      actualImageView.hidden = YES; // Hidden until image loads
      [imagePlaceholder addSubview:actualImageView];

      // Create placeholder icon (shown while loading)
      UIImageSymbolConfiguration *imgConfig = [UIImageSymbolConfiguration
          configurationWithPointSize:24
                              weight:UIImageSymbolWeightMedium];
      UIImage *photoIcon = [UIImage systemImageNamed:@"photo.fill" withConfiguration:imgConfig];
      UIImageView *iconView = [[UIImageView alloc] initWithImage:photoIcon];
      iconView.tintColor = [UIColor whiteColor];
      iconView.translatesAutoresizingMaskIntoConstraints = NO;
      iconView.contentMode = UIViewContentModeScaleAspectFit;
      [imagePlaceholder addSubview:iconView];

      [NSLayoutConstraint activateConstraints:@[
        [imagePlaceholder.widthAnchor constraintEqualToConstant:60],
        [imagePlaceholder.heightAnchor constraintEqualToConstant:60],
        [imagePlaceholder.topAnchor constraintEqualToAnchor:imageRow.topAnchor],
        [imagePlaceholder.bottomAnchor constraintEqualToAnchor:imageRow.bottomAnchor],
        [imagePlaceholder.leadingAnchor constraintEqualToAnchor:imageRow.leadingAnchor],
        [imagePlaceholder.trailingAnchor constraintEqualToAnchor:imageRow.trailingAnchor],
        [iconView.centerXAnchor constraintEqualToAnchor:imagePlaceholder.centerXAnchor],
        [iconView.centerYAnchor constraintEqualToAnchor:imagePlaceholder.centerYAnchor],
        [actualImageView.topAnchor constraintEqualToAnchor:imagePlaceholder.topAnchor],
        [actualImageView.leadingAnchor constraintEqualToAnchor:imagePlaceholder.leadingAnchor],
        [actualImageView.trailingAnchor constraintEqualToAnchor:imagePlaceholder.trailingAnchor],
        [actualImageView.bottomAnchor constraintEqualToAnchor:imagePlaceholder.bottomAnchor]
      ]];

      // Initialize image cache if needed
      if (!self.imageCache) {
        self.imageCache = [[NSCache alloc] init];
        self.imageCache.countLimit = 50; // Cache up to 50 images
      }

      // Try to load the image from available sources
      // Priority: 1. Cache, 2. storageId from image dictionary, 3. path from text pattern
      NSString *cacheKey = storageId ?: (imageInfos.count > 0 ? imageInfos.firstObject[@"path"] : nil);

      // Check cache first
      if (cacheKey) {
        UIImage *cachedImage = [self.imageCache objectForKey:cacheKey];
        if (cachedImage) {
          actualImageView.image = cachedImage;
          actualImageView.hidden = NO;
          iconView.hidden = YES;
        } else {
          // Not in cache - load from network
          if (hasStorageImage) {
            // Use storageId - need to fetch URL from backend
            NSString *storageIdCopy = [storageId copy];
            [[EXChatBackendService sharedInstance] getStorageUrlForId:storageId
                completion:^(NSURL * _Nullable url, NSError * _Nullable error) {
                  if (url && !error) {
                    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
                      NSData *data = [NSData dataWithContentsOfURL:url];
                      if (data) {
                        UIImage *image = [UIImage imageWithData:data];
                        dispatch_async(dispatch_get_main_queue(), ^{
                          if (image) {
                            // Cache the image
                            [self.imageCache setObject:image forKey:storageIdCopy];
                            actualImageView.image = image;
                            actualImageView.hidden = NO;
                            iconView.hidden = YES;
                          }
                        });
                      }
                    });
                  }
                }];
          } else if (hasTextPatternImage) {
            // Use path from text pattern - try to load directly
            NSDictionary *firstImage = imageInfos.firstObject;
            NSString *path = firstImage[@"path"];
            NSString *pathCopy = [path copy];

            // Check if path looks like a full URL or a storage ID
            if ([path hasPrefix:@"http://"] || [path hasPrefix:@"https://"]) {
              // Direct URL - load it
              NSURL *url = [NSURL URLWithString:path];
              if (url) {
                dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
                  NSData *data = [NSData dataWithContentsOfURL:url];
                  if (data) {
                    UIImage *image = [UIImage imageWithData:data];
                    dispatch_async(dispatch_get_main_queue(), ^{
                      if (image) {
                        [self.imageCache setObject:image forKey:pathCopy];
                        actualImageView.image = image;
                        actualImageView.hidden = NO;
                        iconView.hidden = YES;
                      }
                    });
                  }
                });
              }
            } else if ([path hasPrefix:@"k"] && path.length > 10) {
              // Looks like a Convex storage ID (starts with k, e.g., kg1..., k1..., kd7...)
              [[EXChatBackendService sharedInstance] getStorageUrlForId:path
                  completion:^(NSURL * _Nullable url, NSError * _Nullable error) {
                    if (url && !error) {
                      dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
                        NSData *data = [NSData dataWithContentsOfURL:url];
                        if (data) {
                          UIImage *image = [UIImage imageWithData:data];
                          dispatch_async(dispatch_get_main_queue(), ^{
                            if (image) {
                              [self.imageCache setObject:image forKey:pathCopy];
                              actualImageView.image = image;
                              actualImageView.hidden = NO;
                              iconView.hidden = YES;
                            }
                          });
                        }
                      });
                    }
                  }];
            }
            // Skip relative path URLs - they don't work anyway
          }
        }
      }

      [NSLayoutConstraint activateConstraints:@[
        [imageRow.topAnchor constraintEqualToAnchor:bubbleContainer.topAnchor constant:currentY],
        [imageRow.leadingAnchor constraintEqualToAnchor:bubbleContainer.leadingAnchor constant:12],
        [imageRow.trailingAnchor constraintLessThanOrEqualToAnchor:bubbleContainer.trailingAnchor constant:-12],
        [imageRow.heightAnchor constraintEqualToConstant:60]
      ]];

      currentY += 68;
    }

    // Add text label if there's text content
    if (textContent.length > 0) {
      CGFloat userMessageFontSize = [self isIPad] ? 17 : 15;
      UILabel *contentLabel = [[UILabel alloc] init];
      contentLabel.attributedText =
          [self parseMarkdown:textContent
                 withBaseFont:[UIFont systemFontOfSize:userMessageFontSize]
                    textColor:[UIColor whiteColor]];
      contentLabel.numberOfLines = 0;
      contentLabel.translatesAutoresizingMaskIntoConstraints = NO;
      [bubbleContainer addSubview:contentLabel];

      [NSLayoutConstraint activateConstraints:@[
        [contentLabel.topAnchor constraintEqualToAnchor:bubbleContainer.topAnchor constant:currentY],
        [contentLabel.leadingAnchor constraintEqualToAnchor:bubbleContainer.leadingAnchor constant:16],
        [contentLabel.trailingAnchor constraintEqualToAnchor:bubbleContainer.trailingAnchor constant:-16],
        [contentLabel.bottomAnchor constraintEqualToAnchor:bubbleContainer.bottomAnchor constant:-12]
      ]];
    } else if (hasStorageImage || hasTextPatternImage) {
      // Only images, no text - add bottom constraint to image row
      [NSLayoutConstraint activateConstraints:@[
        [bubbleContainer.bottomAnchor constraintEqualToAnchor:bubbleContainer.subviews.firstObject.bottomAnchor constant:12]
      ]];
    }

    CGFloat maxBubbleWidth = [self isIPad] ? 500 : 280; // Wider on iPad for better space utilization
    [NSLayoutConstraint activateConstraints:@[
      [container.heightAnchor constraintGreaterThanOrEqualToConstant:40],
      [bubbleContainer.topAnchor constraintEqualToAnchor:container.topAnchor],
      [bubbleContainer.trailingAnchor constraintEqualToAnchor:container.trailingAnchor],
      [bubbleContainer.widthAnchor constraintLessThanOrEqualToConstant:maxBubbleWidth],
      [bubbleContainer.bottomAnchor constraintEqualToAnchor:container.bottomAnchor]
    ]];
  } else {
    // Assistant message - left-aligned with markdown and code blocks
    CGFloat assistantMessageFontSize = [self isIPad] ? 18 : 16;

    // Split content into segments (text and code blocks)
    NSArray *segments = [self splitContentIntoSegments:content];

    if (segments.count == 1 && [segments[0][@"type"] isEqualToString:@"text"]) {
      // Simple case: no code blocks, just render as before
      UILabel *contentLabel = [[UILabel alloc] init];
      contentLabel.attributedText =
          [self parseMarkdown:content
                 withBaseFont:[UIFont systemFontOfSize:assistantMessageFontSize]
                    textColor:[UIColor colorWithWhite:0.85 alpha:1.0]]; // Slightly dimmer for readability
      contentLabel.numberOfLines = 0;
      contentLabel.translatesAutoresizingMaskIntoConstraints = NO;
      [container addSubview:contentLabel];

      [NSLayoutConstraint activateConstraints:@[
        [contentLabel.topAnchor constraintEqualToAnchor:container.topAnchor],
        [contentLabel.leadingAnchor constraintEqualToAnchor:container.leadingAnchor],
        [contentLabel.trailingAnchor constraintEqualToAnchor:container.trailingAnchor],
        [contentLabel.bottomAnchor constraintEqualToAnchor:container.bottomAnchor]
      ]];
    } else {
      // Complex case: mix of text and code blocks
      UIView *lastView = nil;
      CGFloat spacing = 16;

      for (NSDictionary *segment in segments) {
        NSString *type = segment[@"type"];
        NSString *segmentContent = segment[@"content"];

        UIView *segmentView = nil;

        if ([type isEqualToString:@"code"]) {
          // Render code block with background
          NSString *language = segment[@"language"] ?: @"";
          segmentView = [self createCodeBlockView:segmentContent language:language];
        } else {
          // Render text with markdown
          UILabel *textLabel = [[UILabel alloc] init];
          textLabel.attributedText =
              [self parseMarkdown:segmentContent
                     withBaseFont:[UIFont systemFontOfSize:assistantMessageFontSize]
                        textColor:[UIColor colorWithWhite:0.85 alpha:1.0]];
          textLabel.numberOfLines = 0;
          textLabel.translatesAutoresizingMaskIntoConstraints = NO;
          segmentView = textLabel;
        }

        if (segmentView) {
          segmentView.translatesAutoresizingMaskIntoConstraints = NO;
          [container addSubview:segmentView];

          [NSLayoutConstraint activateConstraints:@[
            [segmentView.leadingAnchor constraintEqualToAnchor:container.leadingAnchor],
            [segmentView.trailingAnchor constraintEqualToAnchor:container.trailingAnchor]
          ]];

          if (lastView) {
            [NSLayoutConstraint activateConstraints:@[
              [segmentView.topAnchor constraintEqualToAnchor:lastView.bottomAnchor constant:spacing]
            ]];
          } else {
            [NSLayoutConstraint activateConstraints:@[
              [segmentView.topAnchor constraintEqualToAnchor:container.topAnchor]
            ]];
          }

          lastView = segmentView;
        }
      }

      // Connect last view to container bottom
      if (lastView) {
        [NSLayoutConstraint activateConstraints:@[
          [lastView.bottomAnchor constraintEqualToAnchor:container.bottomAnchor]
        ]];
      }
    }
  }

  return container;
}

- (UIView *)renderFileEdit:(NSDictionary *)message {
  NSDictionary *edits = message[@"edits"];
  if (!edits) {
    return nil;
  }

  // Inline display like v0-clone - compact with icon + label + filepath
  UIView *container = [[UIView alloc] init];
  container.translatesAutoresizingMaskIntoConstraints = NO;
  container.backgroundColor = [UIColor clearColor];

  // Pen icon
  UIImageSymbolConfiguration *iconConfig = [UIImageSymbolConfiguration
      configurationWithPointSize:12
                          weight:UIImageSymbolWeightMedium];
  UIImage *iconImage = [UIImage systemImageNamed:@"pencil"
                               withConfiguration:iconConfig];
  UIImageView *iconView = [[UIImageView alloc] initWithImage:iconImage];
  iconView.tintColor = [UIColor colorWithWhite:0.6 alpha:1.0];
  iconView.translatesAutoresizingMaskIntoConstraints = NO;
  [container addSubview:iconView];

  // Label
  UILabel *label = [[UILabel alloc] init];
  label.text = @"Updated:";
  label.textColor = [UIColor colorWithWhite:0.6 alpha:1.0];
  label.font = [UIFont systemFontOfSize:12 weight:UIFontWeightMedium];
  label.translatesAutoresizingMaskIntoConstraints = NO;
  [container addSubview:label];

  // File path
  NSString *filePath = edits[@"filePath"] ?: edits[@"fileName"];
  UILabel *fileLabel = [[UILabel alloc] init];
  fileLabel.text = filePath ?: @"Unknown file";
  fileLabel.textColor = [UIColor colorWithWhite:0.6 alpha:1.0];
  fileLabel.font = [UIFont systemFontOfSize:12];
  fileLabel.numberOfLines = 1;
  fileLabel.lineBreakMode = NSLineBreakByTruncatingMiddle;
  fileLabel.translatesAutoresizingMaskIntoConstraints = NO;
  [container addSubview:fileLabel];

  [NSLayoutConstraint activateConstraints:@[
    [container.heightAnchor constraintEqualToConstant:24],

    [iconView.leadingAnchor constraintEqualToAnchor:container.leadingAnchor],
    [iconView.centerYAnchor constraintEqualToAnchor:container.centerYAnchor],
    [iconView.widthAnchor constraintEqualToConstant:12],
    [iconView.heightAnchor constraintEqualToConstant:12],

    [label.leadingAnchor constraintEqualToAnchor:iconView.trailingAnchor
                                        constant:6],
    [label.centerYAnchor constraintEqualToAnchor:container.centerYAnchor],

    [fileLabel.leadingAnchor constraintEqualToAnchor:label.trailingAnchor
                                            constant:6],
    [fileLabel.centerYAnchor constraintEqualToAnchor:container.centerYAnchor],
    [fileLabel.trailingAnchor
        constraintLessThanOrEqualToAnchor:container.trailingAnchor]
  ]];

  return container;
}

- (UIView *)renderFileRead:(NSDictionary *)message {
  NSDictionary *read = message[@"read"];
  if (!read) {
    return nil;
  }

  // Inline display like v0-clone - compact with icon + label + filepath
  UIView *container = [[UIView alloc] init];
  container.translatesAutoresizingMaskIntoConstraints = NO;
  container.backgroundColor = [UIColor clearColor];

  // Eye icon
  UIImageSymbolConfiguration *iconConfig = [UIImageSymbolConfiguration
      configurationWithPointSize:12
                          weight:UIImageSymbolWeightMedium];
  UIImage *iconImage = [UIImage systemImageNamed:@"eye"
                               withConfiguration:iconConfig];
  UIImageView *iconView = [[UIImageView alloc] initWithImage:iconImage];
  iconView.tintColor = [UIColor colorWithWhite:0.6 alpha:1.0];
  iconView.translatesAutoresizingMaskIntoConstraints = NO;
  [container addSubview:iconView];

  // Label
  UILabel *label = [[UILabel alloc] init];
  label.text = @"Read:";
  label.textColor = [UIColor colorWithWhite:0.6 alpha:1.0];
  label.font = [UIFont systemFontOfSize:12 weight:UIFontWeightMedium];
  label.translatesAutoresizingMaskIntoConstraints = NO;
  [container addSubview:label];

  // File path
  NSString *filePath = read[@"filePath"];
  UILabel *fileLabel = [[UILabel alloc] init];
  fileLabel.text = filePath ?: @"Unknown file";
  fileLabel.textColor = [UIColor colorWithWhite:0.6 alpha:1.0];
  fileLabel.font = [UIFont systemFontOfSize:12];
  fileLabel.numberOfLines = 1;
  fileLabel.lineBreakMode = NSLineBreakByTruncatingMiddle;
  fileLabel.translatesAutoresizingMaskIntoConstraints = NO;
  [container addSubview:fileLabel];

  [NSLayoutConstraint activateConstraints:@[
    [container.heightAnchor constraintEqualToConstant:24],

    [iconView.leadingAnchor constraintEqualToAnchor:container.leadingAnchor],
    [iconView.centerYAnchor constraintEqualToAnchor:container.centerYAnchor],
    [iconView.widthAnchor constraintEqualToConstant:12],
    [iconView.heightAnchor constraintEqualToConstant:12],

    [label.leadingAnchor constraintEqualToAnchor:iconView.trailingAnchor
                                        constant:6],
    [label.centerYAnchor constraintEqualToAnchor:container.centerYAnchor],

    [fileLabel.leadingAnchor constraintEqualToAnchor:label.trailingAnchor
                                            constant:6],
    [fileLabel.centerYAnchor constraintEqualToAnchor:container.centerYAnchor],
    [fileLabel.trailingAnchor
        constraintLessThanOrEqualToAnchor:container.trailingAnchor]
  ]];

  return container;
}

- (UIView *)renderImage:(NSDictionary *)message {
  NSDictionary *image = message[@"image"];
  if (!image) {
    return nil;
  }

  UIView *container = [[UIView alloc] init];
  container.translatesAutoresizingMaskIntoConstraints = NO;
  container.backgroundColor = [UIColor colorWithRed:0.12
                                              green:0.12
                                               blue:0.12
                                              alpha:1.0];
  container.layer.cornerRadius = 8;

  // Icon
  UIImageSymbolConfiguration *iconConfig = [UIImageSymbolConfiguration
      configurationWithPointSize:12
                          weight:UIImageSymbolWeightRegular];
  UIImage *iconImage = [UIImage systemImageNamed:@"photo"
                               withConfiguration:iconConfig];
  UIImageView *iconView = [[UIImageView alloc] initWithImage:iconImage];
  iconView.tintColor = [UIColor lightGrayColor];
  iconView.translatesAutoresizingMaskIntoConstraints = NO;
  [container addSubview:iconView];

  // Label
  UILabel *label = [[UILabel alloc] init];
  label.text = @"Image:";
  label.textColor = [UIColor lightGrayColor];
  label.font = [UIFont systemFontOfSize:12 weight:UIFontWeightMedium];
  label.translatesAutoresizingMaskIntoConstraints = NO;
  [container addSubview:label];

  // File name
  NSString *fileName = image[@"fileName"];
  UILabel *fileLabel = [[UILabel alloc] init];
  fileLabel.text = fileName ?: @"Unknown image";
  fileLabel.textColor = [UIColor whiteColor];
  fileLabel.font = [UIFont systemFontOfSize:12];
  fileLabel.numberOfLines = 1;
  fileLabel.translatesAutoresizingMaskIntoConstraints = NO;
  [container addSubview:fileLabel];

  [NSLayoutConstraint activateConstraints:@[
    [container.heightAnchor constraintEqualToConstant:40],

    [iconView.leadingAnchor constraintEqualToAnchor:container.leadingAnchor
                                           constant:14],
    [iconView.centerYAnchor constraintEqualToAnchor:container.centerYAnchor],
    [iconView.widthAnchor constraintEqualToConstant:12],
    [iconView.heightAnchor constraintEqualToConstant:12],

    [label.leadingAnchor constraintEqualToAnchor:iconView.trailingAnchor
                                        constant:10],
    [label.centerYAnchor constraintEqualToAnchor:container.centerYAnchor],

    [fileLabel.leadingAnchor constraintEqualToAnchor:label.trailingAnchor
                                            constant:8],
    [fileLabel.centerYAnchor constraintEqualToAnchor:container.centerYAnchor],
    [fileLabel.trailingAnchor
        constraintLessThanOrEqualToAnchor:container.trailingAnchor
                                 constant:-14]
  ]];

  return container;
}

- (UIView *)renderBash:(NSDictionary *)message {
  NSDictionary *bash = message[@"bash"];
  if (!bash) {
    return nil;
  }

  // Inline display like v0-clone - compact with icon + label + command
  UIView *container = [[UIView alloc] init];
  container.translatesAutoresizingMaskIntoConstraints = NO;
  container.backgroundColor = [UIColor clearColor];

  // Terminal icon
  UIImageSymbolConfiguration *iconConfig = [UIImageSymbolConfiguration
      configurationWithPointSize:12
                          weight:UIImageSymbolWeightMedium];
  UIImage *iconImage = [UIImage systemImageNamed:@"terminal"
                               withConfiguration:iconConfig];
  UIImageView *iconView = [[UIImageView alloc] initWithImage:iconImage];
  iconView.tintColor = [UIColor colorWithWhite:0.6 alpha:1.0];
  iconView.translatesAutoresizingMaskIntoConstraints = NO;
  [container addSubview:iconView];

  // Label
  UILabel *label = [[UILabel alloc] init];
  label.text = @"Terminal:";
  label.textColor = [UIColor colorWithWhite:0.6 alpha:1.0];
  label.font = [UIFont systemFontOfSize:12 weight:UIFontWeightMedium];
  label.translatesAutoresizingMaskIntoConstraints = NO;
  [container addSubview:label];

  // Command
  NSString *command = bash[@"command"];
  UILabel *commandLabel = [[UILabel alloc] init];
  commandLabel.text = command ?: @"Unknown command";
  commandLabel.textColor = [UIColor colorWithWhite:0.6 alpha:1.0];
  commandLabel.font = [UIFont monospacedSystemFontOfSize:12 weight:UIFontWeightRegular];
  commandLabel.numberOfLines = 1;
  commandLabel.lineBreakMode = NSLineBreakByTruncatingTail;
  commandLabel.translatesAutoresizingMaskIntoConstraints = NO;
  [container addSubview:commandLabel];

  [NSLayoutConstraint activateConstraints:@[
    [container.heightAnchor constraintEqualToConstant:24],

    [iconView.leadingAnchor constraintEqualToAnchor:container.leadingAnchor],
    [iconView.centerYAnchor constraintEqualToAnchor:container.centerYAnchor],
    [iconView.widthAnchor constraintEqualToConstant:12],
    [iconView.heightAnchor constraintEqualToConstant:12],

    [label.leadingAnchor constraintEqualToAnchor:iconView.trailingAnchor
                                        constant:6],
    [label.centerYAnchor constraintEqualToAnchor:container.centerYAnchor],

    [commandLabel.leadingAnchor constraintEqualToAnchor:label.trailingAnchor
                                               constant:6],
    [commandLabel.centerYAnchor constraintEqualToAnchor:container.centerYAnchor],
    [commandLabel.trailingAnchor
        constraintLessThanOrEqualToAnchor:container.trailingAnchor]
  ]];

  return container;
}

- (UIView *)renderWebSearch:(NSDictionary *)message {
  NSDictionary *webSearch = message[@"webSearch"];
  if (!webSearch) {
    return nil;
  }

  // Inline display like v0-clone - compact with icon + label + query
  UIView *container = [[UIView alloc] init];
  container.translatesAutoresizingMaskIntoConstraints = NO;
  container.backgroundColor = [UIColor clearColor];

  // Search icon
  UIImageSymbolConfiguration *iconConfig = [UIImageSymbolConfiguration
      configurationWithPointSize:12
                          weight:UIImageSymbolWeightMedium];
  UIImage *iconImage = [UIImage systemImageNamed:@"magnifyingglass"
                               withConfiguration:iconConfig];
  UIImageView *iconView = [[UIImageView alloc] initWithImage:iconImage];
  iconView.tintColor = [UIColor colorWithWhite:0.6 alpha:1.0];
  iconView.translatesAutoresizingMaskIntoConstraints = NO;
  [container addSubview:iconView];

  // Label
  UILabel *label = [[UILabel alloc] init];
  label.text = @"Search:";
  label.textColor = [UIColor colorWithWhite:0.6 alpha:1.0];
  label.font = [UIFont systemFontOfSize:12 weight:UIFontWeightMedium];
  label.translatesAutoresizingMaskIntoConstraints = NO;
  [container addSubview:label];

  // Query
  NSString *query = webSearch[@"query"];
  UILabel *queryLabel = [[UILabel alloc] init];
  queryLabel.text = query ?: @"Unknown query";
  queryLabel.textColor = [UIColor colorWithWhite:0.6 alpha:1.0];
  queryLabel.font = [UIFont systemFontOfSize:12];
  queryLabel.numberOfLines = 1;
  queryLabel.lineBreakMode = NSLineBreakByTruncatingTail;
  queryLabel.translatesAutoresizingMaskIntoConstraints = NO;
  [container addSubview:queryLabel];

  [NSLayoutConstraint activateConstraints:@[
    [container.heightAnchor constraintEqualToConstant:24],

    [iconView.leadingAnchor constraintEqualToAnchor:container.leadingAnchor],
    [iconView.centerYAnchor constraintEqualToAnchor:container.centerYAnchor],
    [iconView.widthAnchor constraintEqualToConstant:12],
    [iconView.heightAnchor constraintEqualToConstant:12],

    [label.leadingAnchor constraintEqualToAnchor:iconView.trailingAnchor
                                        constant:6],
    [label.centerYAnchor constraintEqualToAnchor:container.centerYAnchor],

    [queryLabel.leadingAnchor constraintEqualToAnchor:label.trailingAnchor
                                             constant:6],
    [queryLabel.centerYAnchor constraintEqualToAnchor:container.centerYAnchor],
    [queryLabel.trailingAnchor
        constraintLessThanOrEqualToAnchor:container.trailingAnchor]
  ]];

  return container;
}

- (UIView *)renderMcpTool:(NSDictionary *)message {
  NSDictionary *mcpTool = message[@"mcpTool"];
  if (!mcpTool) {
    return nil;
  }

  // Inline display like v0-clone - compact with icon + label + tool name
  UIView *container = [[UIView alloc] init];
  container.translatesAutoresizingMaskIntoConstraints = NO;
  container.backgroundColor = [UIColor clearColor];

  // Hammer icon
  UIImageSymbolConfiguration *iconConfig = [UIImageSymbolConfiguration
      configurationWithPointSize:12
                          weight:UIImageSymbolWeightMedium];
  UIImage *iconImage = [UIImage systemImageNamed:@"hammer.fill"
                               withConfiguration:iconConfig];
  UIImageView *iconView = [[UIImageView alloc] initWithImage:iconImage];
  iconView.tintColor = [UIColor colorWithWhite:0.6 alpha:1.0];
  iconView.translatesAutoresizingMaskIntoConstraints = NO;
  [container addSubview:iconView];

  // Label
  UILabel *label = [[UILabel alloc] init];
  label.text = @"Tool:";
  label.textColor = [UIColor colorWithWhite:0.6 alpha:1.0];
  label.font = [UIFont systemFontOfSize:12 weight:UIFontWeightMedium];
  label.translatesAutoresizingMaskIntoConstraints = NO;
  [container addSubview:label];

  // Tool name
  NSString *toolName = mcpTool[@"toolName"];
  UILabel *toolLabel = [[UILabel alloc] init];
  toolLabel.text = toolName ?: @"Unknown tool";
  toolLabel.textColor = [UIColor colorWithWhite:0.6 alpha:1.0];
  toolLabel.font = [UIFont systemFontOfSize:12];
  toolLabel.numberOfLines = 1;
  toolLabel.lineBreakMode = NSLineBreakByTruncatingTail;
  toolLabel.translatesAutoresizingMaskIntoConstraints = NO;
  [container addSubview:toolLabel];

  [NSLayoutConstraint activateConstraints:@[
    [container.heightAnchor constraintEqualToConstant:24],

    [iconView.leadingAnchor constraintEqualToAnchor:container.leadingAnchor],
    [iconView.centerYAnchor constraintEqualToAnchor:container.centerYAnchor],
    [iconView.widthAnchor constraintEqualToConstant:12],
    [iconView.heightAnchor constraintEqualToConstant:12],

    [label.leadingAnchor constraintEqualToAnchor:iconView.trailingAnchor
                                        constant:6],
    [label.centerYAnchor constraintEqualToAnchor:container.centerYAnchor],

    [toolLabel.leadingAnchor constraintEqualToAnchor:label.trailingAnchor
                                             constant:6],
    [toolLabel.centerYAnchor constraintEqualToAnchor:container.centerYAnchor],
    [toolLabel.trailingAnchor
        constraintLessThanOrEqualToAnchor:container.trailingAnchor]
  ]];

  return container;
}

- (UIView *)renderTodos:(NSDictionary *)message {
  return [self renderTodosWithLatest:message isLatest:NO];
}

// New method that supports isLatest for shimmer effect on active tasks
- (UIView *)renderTodosWithLatest:(NSDictionary *)message isLatest:(BOOL)isLatest {
  NSArray *todos = message[@"todos"];
  if (!todos || ![todos isKindOfClass:[NSArray class]] || todos.count == 0) {
    return nil;
  }

  CGFloat cornerRadius = [self isIPad] ? 20 : 16;

  // Outer container for shadow (no clipping)
  UIView *shadowContainer = [[UIView alloc] init];
  shadowContainer.translatesAutoresizingMaskIntoConstraints = NO;
  shadowContainer.backgroundColor = [UIColor clearColor];
  shadowContainer.layer.shadowColor = [UIColor blackColor].CGColor;
  shadowContainer.layer.shadowOffset = CGSizeMake(0, 6);
  shadowContainer.layer.shadowOpacity = 0.35;
  shadowContainer.layer.shadowRadius = 12;
  shadowContainer.layer.masksToBounds = NO;

  // Inner card container with corner radius and clipping
  UIView *container = [[UIView alloc] init];
  container.translatesAutoresizingMaskIntoConstraints = NO;
  container.backgroundColor = ChatColorCardBg();
  container.layer.cornerRadius = cornerRadius;
  container.layer.borderWidth = 1;
  container.layer.borderColor = ChatColorCardBorder().CGColor;
  container.clipsToBounds = YES;
  container.layer.masksToBounds = YES;
  [shadowContainer addSubview:container];

  // Pin inner container to shadow container
  [NSLayoutConstraint activateConstraints:@[
    [container.topAnchor constraintEqualToAnchor:shadowContainer.topAnchor],
    [container.leadingAnchor constraintEqualToAnchor:shadowContainer.leadingAnchor],
    [container.trailingAnchor constraintEqualToAnchor:shadowContainer.trailingAnchor],
    [container.bottomAnchor constraintEqualToAnchor:shadowContainer.bottomAnchor]
  ]];

  // Header view with background (like taskCardHeader in React Native)
  UIView *header = [[UIView alloc] init];
  header.translatesAutoresizingMaskIntoConstraints = NO;
  header.backgroundColor = ChatColorHeaderBg();
  [container addSubview:header];

  // Header border at bottom
  UIView *headerBorder = [[UIView alloc] init];
  headerBorder.translatesAutoresizingMaskIntoConstraints = NO;
  headerBorder.backgroundColor = ChatColorHeaderBorder();
  [header addSubview:headerBorder];

  // TASKS title (uppercase, like React Native)
  UILabel *titleLabel = [[UILabel alloc] init];
  titleLabel.text = @"TASKS";
  titleLabel.textColor = [UIColor whiteColor];
  titleLabel.font = [UIFont systemFontOfSize:11 weight:UIFontWeightSemibold];
  titleLabel.translatesAutoresizingMaskIntoConstraints = NO;
  [header addSubview:titleLabel];

  // Green status dot (always visible in header)
  UIView *statusDot = [[UIView alloc] init];
  statusDot.backgroundColor = ChatColorStatusGreen();
  statusDot.layer.cornerRadius = 3;
  statusDot.translatesAutoresizingMaskIntoConstraints = NO;
  // Add glow effect
  statusDot.layer.shadowColor = ChatColorStatusGreen().CGColor;
  statusDot.layer.shadowOffset = CGSizeZero;
  statusDot.layer.shadowOpacity = 0.6;
  statusDot.layer.shadowRadius = 4;
  [header addSubview:statusDot];

  // Count label on right side
  UILabel *countLabel = [[UILabel alloc] init];
  countLabel.text = [NSString stringWithFormat:@"%lu", (unsigned long)todos.count];
  countLabel.textColor = ChatColorWhite50();
  countLabel.font = [UIFont systemFontOfSize:11 weight:UIFontWeightMedium];
  countLabel.translatesAutoresizingMaskIntoConstraints = NO;
  [header addSubview:countLabel];

  // Content view for task items
  UIView *contentView = [[UIView alloc] init];
  contentView.translatesAutoresizingMaskIntoConstraints = NO;
  [container addSubview:contentView];

  // Create task items
  CGFloat itemY = 0;
  CGFloat itemSpacing = 5;
  CGFloat itemHeight = 18;

  for (NSDictionary *todo in todos) {
    NSString *content = todo[@"content"] ?: todo[@"text"] ?: todo[@"description"] ?: @"Unknown task";
    NSString *status = todo[@"status"];
    BOOL isCompleted = [status isEqualToString:@"completed"] || [status isEqualToString:@"done"];
    BOOL isActive = [status isEqualToString:@"in_progress"];

    UIView *itemView = [[UIView alloc] init];
    itemView.translatesAutoresizingMaskIntoConstraints = NO;
    [contentView addSubview:itemView];

    // Icon/indicator based on status
    if (isCompleted) {
      // Checkmark for completed
      UIImageSymbolConfiguration *checkConfig = [UIImageSymbolConfiguration
          configurationWithPointSize:14 weight:UIImageSymbolWeightSemibold];
      UIImage *checkImage = [UIImage systemImageNamed:@"checkmark" withConfiguration:checkConfig];
      UIImageView *checkView = [[UIImageView alloc] initWithImage:checkImage];
      checkView.tintColor = ChatColorWhite35();
      checkView.translatesAutoresizingMaskIntoConstraints = NO;
      [itemView addSubview:checkView];

      [NSLayoutConstraint activateConstraints:@[
        [checkView.leadingAnchor constraintEqualToAnchor:itemView.leadingAnchor],
        [checkView.centerYAnchor constraintEqualToAnchor:itemView.centerYAnchor],
        [checkView.widthAnchor constraintEqualToConstant:14],
        [checkView.heightAnchor constraintEqualToConstant:14]
      ]];
    } else if (isActive) {
      // Green glowing dot for active
      UIView *activeDot = [[UIView alloc] init];
      activeDot.backgroundColor = ChatColorStatusGreen();
      activeDot.layer.cornerRadius = 4;
      activeDot.translatesAutoresizingMaskIntoConstraints = NO;
      activeDot.layer.shadowColor = ChatColorStatusGreen().CGColor;
      activeDot.layer.shadowOffset = CGSizeZero;
      activeDot.layer.shadowOpacity = 0.6;
      activeDot.layer.shadowRadius = 4;
      [itemView addSubview:activeDot];

      [NSLayoutConstraint activateConstraints:@[
        [activeDot.leadingAnchor constraintEqualToAnchor:itemView.leadingAnchor constant:3],
        [activeDot.centerYAnchor constraintEqualToAnchor:itemView.centerYAnchor],
        [activeDot.widthAnchor constraintEqualToConstant:8],
        [activeDot.heightAnchor constraintEqualToConstant:8]
      ]];
    } else {
      // Bullet for pending
      UILabel *bulletLabel = [[UILabel alloc] init];
      bulletLabel.text = @"•";
      bulletLabel.textColor = ChatColorWhite40();
      bulletLabel.font = [UIFont systemFontOfSize:14];
      bulletLabel.translatesAutoresizingMaskIntoConstraints = NO;
      bulletLabel.textAlignment = NSTextAlignmentCenter;
      [itemView addSubview:bulletLabel];

      [NSLayoutConstraint activateConstraints:@[
        [bulletLabel.leadingAnchor constraintEqualToAnchor:itemView.leadingAnchor],
        [bulletLabel.centerYAnchor constraintEqualToAnchor:itemView.centerYAnchor],
        [bulletLabel.widthAnchor constraintEqualToConstant:14]
      ]];
    }

    // Task text
    UILabel *textLabel = [[UILabel alloc] init];
    NSString *displayText = content.length > 40 ? [NSString stringWithFormat:@"%@...", [content substringToIndex:40]] : content;
    textLabel.numberOfLines = 1;
    textLabel.translatesAutoresizingMaskIntoConstraints = NO;

    if (isCompleted) {
      // Strikethrough and dimmed
      NSMutableAttributedString *attrText = [[NSMutableAttributedString alloc]
          initWithString:displayText
              attributes:@{
                NSStrikethroughStyleAttributeName: @(NSUnderlineStyleSingle),
                NSForegroundColorAttributeName: ChatColorWhite40(),
                NSFontAttributeName: [UIFont systemFontOfSize:13]
              }];
      textLabel.attributedText = attrText;
    } else if (isActive) {
      // Bold white for active
      textLabel.text = displayText;
      textLabel.textColor = [UIColor whiteColor];
      textLabel.font = [UIFont systemFontOfSize:13 weight:UIFontWeightSemibold];
    } else {
      // Normal dimmed for pending
      textLabel.text = displayText;
      textLabel.textColor = ChatColorWhite50();
      textLabel.font = [UIFont systemFontOfSize:13];
    }

    [itemView addSubview:textLabel];

    [NSLayoutConstraint activateConstraints:@[
      [textLabel.leadingAnchor constraintEqualToAnchor:itemView.leadingAnchor constant:24],
      [textLabel.trailingAnchor constraintEqualToAnchor:itemView.trailingAnchor],
      [textLabel.centerYAnchor constraintEqualToAnchor:itemView.centerYAnchor]
    ]];

    // Add shimmer effect for active tasks in latest group (after textLabel is in hierarchy)
    if (isActive && isLatest) {
      CAGradientLayer *shimmerLayer = [CAGradientLayer layer];
      shimmerLayer.colors = @[
        (id)[UIColor colorWithWhite:1.0 alpha:0.0].CGColor,
        (id)[UIColor colorWithWhite:1.0 alpha:0.3].CGColor,
        (id)[UIColor colorWithWhite:1.0 alpha:0.8].CGColor,
        (id)[UIColor colorWithWhite:1.0 alpha:0.3].CGColor,
        (id)[UIColor colorWithWhite:1.0 alpha:0.0].CGColor
      ];
      shimmerLayer.locations = @[@0.0, @0.25, @0.5, @0.75, @1.0];
      shimmerLayer.startPoint = CGPointMake(0, 0.5);
      shimmerLayer.endPoint = CGPointMake(1, 0.5);
      shimmerLayer.frame = CGRectMake(0, 0, 80, 20);

      UIView *shimmerView = [[UIView alloc] init];
      shimmerView.translatesAutoresizingMaskIntoConstraints = NO;
      shimmerView.clipsToBounds = YES;
      shimmerView.userInteractionEnabled = NO;
      [shimmerView.layer addSublayer:shimmerLayer];
      [itemView addSubview:shimmerView];

      [NSLayoutConstraint activateConstraints:@[
        [shimmerView.leadingAnchor constraintEqualToAnchor:textLabel.leadingAnchor],
        [shimmerView.trailingAnchor constraintEqualToAnchor:textLabel.trailingAnchor],
        [shimmerView.topAnchor constraintEqualToAnchor:textLabel.topAnchor],
        [shimmerView.bottomAnchor constraintEqualToAnchor:textLabel.bottomAnchor]
      ]];

      // Animate shimmer
      CGFloat textWidth = [displayText sizeWithAttributes:@{NSFontAttributeName: [UIFont systemFontOfSize:13 weight:UIFontWeightSemibold]}].width;
      shimmerLayer.frame = CGRectMake(0, 0, 80, 20);

      CABasicAnimation *shimmerAnimation = [CABasicAnimation animationWithKeyPath:@"position.x"];
      shimmerAnimation.fromValue = @(-40);
      shimmerAnimation.toValue = @(textWidth + 80);
      shimmerAnimation.duration = 1.5;
      shimmerAnimation.repeatCount = HUGE_VALF;
      shimmerAnimation.timingFunction = [CAMediaTimingFunction functionWithName:kCAMediaTimingFunctionLinear];
      [shimmerLayer addAnimation:shimmerAnimation forKey:@"shimmer"];
    }

    // Position item view
    [NSLayoutConstraint activateConstraints:@[
      [itemView.topAnchor constraintEqualToAnchor:contentView.topAnchor constant:itemY],
      [itemView.leadingAnchor constraintEqualToAnchor:contentView.leadingAnchor],
      [itemView.trailingAnchor constraintEqualToAnchor:contentView.trailingAnchor],
      [itemView.heightAnchor constraintEqualToConstant:itemHeight]
    ]];

    itemY += itemHeight + itemSpacing;
  }

  // Layout constraints
  CGFloat headerHeight = [self isIPad] ? 36 : 30;
  CGFloat padding = 14;
  CGFloat contentHeight = itemY > 0 ? itemY - itemSpacing : 0;

  [NSLayoutConstraint activateConstraints:@[
    // Header
    [header.topAnchor constraintEqualToAnchor:container.topAnchor],
    [header.leadingAnchor constraintEqualToAnchor:container.leadingAnchor],
    [header.trailingAnchor constraintEqualToAnchor:container.trailingAnchor],
    [header.heightAnchor constraintEqualToConstant:headerHeight],

    // Header border
    [headerBorder.leadingAnchor constraintEqualToAnchor:header.leadingAnchor],
    [headerBorder.trailingAnchor constraintEqualToAnchor:header.trailingAnchor],
    [headerBorder.bottomAnchor constraintEqualToAnchor:header.bottomAnchor],
    [headerBorder.heightAnchor constraintEqualToConstant:0.5],

    // Title
    [titleLabel.leadingAnchor constraintEqualToAnchor:header.leadingAnchor constant:padding],
    [titleLabel.centerYAnchor constraintEqualToAnchor:header.centerYAnchor],

    // Status dot
    [statusDot.leadingAnchor constraintEqualToAnchor:titleLabel.trailingAnchor constant:6],
    [statusDot.centerYAnchor constraintEqualToAnchor:header.centerYAnchor],
    [statusDot.widthAnchor constraintEqualToConstant:6],
    [statusDot.heightAnchor constraintEqualToConstant:6],

    // Count
    [countLabel.trailingAnchor constraintEqualToAnchor:header.trailingAnchor constant:-padding],
    [countLabel.centerYAnchor constraintEqualToAnchor:header.centerYAnchor],

    // Content
    [contentView.topAnchor constraintEqualToAnchor:header.bottomAnchor constant:8],
    [contentView.leadingAnchor constraintEqualToAnchor:container.leadingAnchor constant:padding],
    [contentView.trailingAnchor constraintEqualToAnchor:container.trailingAnchor constant:-padding],
    [contentView.heightAnchor constraintEqualToConstant:contentHeight],
    [contentView.bottomAnchor constraintEqualToAnchor:container.bottomAnchor constant:-8]
  ]];

  return shadowContainer;
}

#pragma mark - Expandable Command Row (like CommandLogRow in NewOnboardingScreen15)

// Render an expandable command row with star icon, label, count, and chevron
// Matches the CommandLogRow component from React Native
- (UIView *)renderCommandLogRow:(NSDictionary *)group
                         label:(NSString *)label
                         items:(NSArray *)items
                      isLatest:(BOOL)isLatest {

  NSString *groupId = group[@"id"];
  NSString *groupType = group[@"type"]; // "read", "edit", "bash"
  NSInteger count = items.count;

  // Initialize expanded groups tracking if needed
  if (!self.expandedGroups) {
    self.expandedGroups = [NSMutableDictionary dictionary];
  }

  // Latest group is auto-expanded, others follow their stored state
  BOOL isExpanded = isLatest;
  if (!isLatest && self.expandedGroups[groupId]) {
    isExpanded = [self.expandedGroups[groupId] boolValue];
  }

  // Get color for this group type
  UIColor *typeColor = [self colorForGroupType:groupType];

  // Main container
  UIView *container = [[UIView alloc] init];
  container.translatesAutoresizingMaskIntoConstraints = NO;
  container.tag = [groupId hash]; // Tag for identification

  // Header row (always visible) - make it tappable
  UIView *headerRow = [[UIView alloc] init];
  headerRow.translatesAutoresizingMaskIntoConstraints = NO;
  headerRow.userInteractionEnabled = YES;
  [container addSubview:headerRow];

  // Add tap gesture to header row
  UITapGestureRecognizer *tapGesture = [[UITapGestureRecognizer alloc]
      initWithTarget:self
              action:@selector(handleCommandRowTap:)];
  [headerRow addGestureRecognizer:tapGesture];

  // Store groupId in headerRow for tap handling using associated object
  objc_setAssociatedObject(headerRow, "groupId", groupId, OBJC_ASSOCIATION_RETAIN_NONATOMIC);

  // Star icon (✱) with color
  UILabel *starLabel = [[UILabel alloc] init];
  starLabel.text = @"✱";
  starLabel.textColor = typeColor;
  starLabel.font = [UIFont systemFontOfSize:14];
  starLabel.translatesAutoresizingMaskIntoConstraints = NO;
  [headerRow addSubview:starLabel];

  // Label text with color
  UILabel *labelText = [[UILabel alloc] init];
  labelText.text = label;
  labelText.textColor = typeColor;
  labelText.font = [UIFont systemFontOfSize:15 weight:UIFontWeightSemibold];
  labelText.translatesAutoresizingMaskIntoConstraints = NO;
  [headerRow addSubview:labelText];

  // Count meta text
  UILabel *metaLabel = [[UILabel alloc] init];
  metaLabel.text = [NSString stringWithFormat:@"(%ld %@)", (long)count, count == 1 ? @"file" : @"files"];
  metaLabel.textColor = ChatColorWhite50();
  metaLabel.font = [UIFont systemFontOfSize:15];
  metaLabel.translatesAutoresizingMaskIntoConstraints = NO;
  [headerRow addSubview:metaLabel];

  // Chevron icon
  UIImageSymbolConfiguration *chevronConfig = [UIImageSymbolConfiguration
      configurationWithPointSize:16 weight:UIImageSymbolWeightMedium];
  UIImage *chevronImage = [UIImage systemImageNamed:@"chevron.down" withConfiguration:chevronConfig];
  UIImageView *chevronView = [[UIImageView alloc] initWithImage:chevronImage];
  chevronView.tintColor = [UIColor colorWithRed:0.56 green:0.56 blue:0.58 alpha:1.0]; // #8E8E93
  chevronView.translatesAutoresizingMaskIntoConstraints = NO;
  chevronView.contentMode = UIViewContentModeScaleAspectFit;
  // Rotate if expanded
  if (isExpanded) {
    chevronView.transform = CGAffineTransformMakeRotation(M_PI);
  }
  [headerRow addSubview:chevronView];

  // Header row constraints
  [NSLayoutConstraint activateConstraints:@[
    [headerRow.topAnchor constraintEqualToAnchor:container.topAnchor],
    [headerRow.leadingAnchor constraintEqualToAnchor:container.leadingAnchor],
    [headerRow.trailingAnchor constraintEqualToAnchor:container.trailingAnchor],
    [headerRow.heightAnchor constraintEqualToConstant:34],

    [starLabel.leadingAnchor constraintEqualToAnchor:headerRow.leadingAnchor],
    [starLabel.centerYAnchor constraintEqualToAnchor:headerRow.centerYAnchor],

    [labelText.leadingAnchor constraintEqualToAnchor:starLabel.trailingAnchor constant:10],
    [labelText.centerYAnchor constraintEqualToAnchor:headerRow.centerYAnchor],

    [metaLabel.leadingAnchor constraintEqualToAnchor:labelText.trailingAnchor constant:8],
    [metaLabel.centerYAnchor constraintEqualToAnchor:headerRow.centerYAnchor],

    [chevronView.trailingAnchor constraintEqualToAnchor:headerRow.trailingAnchor],
    [chevronView.centerYAnchor constraintEqualToAnchor:headerRow.centerYAnchor],
    [chevronView.widthAnchor constraintEqualToConstant:16],
    [chevronView.heightAnchor constraintEqualToConstant:16]
  ]];

  // Force layout before adding shimmer
  [headerRow layoutIfNeeded];

  // Add shimmer effect to label text for latest (active) command row
  if (isLatest) {
    UIView *shimmerContainer = [[UIView alloc] init];
    shimmerContainer.translatesAutoresizingMaskIntoConstraints = NO;
    shimmerContainer.clipsToBounds = YES;
    shimmerContainer.userInteractionEnabled = NO;
    [headerRow addSubview:shimmerContainer];

    [NSLayoutConstraint activateConstraints:@[
      [shimmerContainer.leadingAnchor constraintEqualToAnchor:labelText.leadingAnchor],
      [shimmerContainer.trailingAnchor constraintEqualToAnchor:metaLabel.trailingAnchor],
      [shimmerContainer.topAnchor constraintEqualToAnchor:labelText.topAnchor],
      [shimmerContainer.bottomAnchor constraintEqualToAnchor:labelText.bottomAnchor]
    ]];

    CAGradientLayer *shimmerLayer = [CAGradientLayer layer];
    shimmerLayer.colors = @[
      (id)[typeColor colorWithAlphaComponent:0.0].CGColor,
      (id)[typeColor colorWithAlphaComponent:0.3].CGColor,
      (id)[typeColor colorWithAlphaComponent:0.7].CGColor,
      (id)[typeColor colorWithAlphaComponent:0.3].CGColor,
      (id)[typeColor colorWithAlphaComponent:0.0].CGColor
    ];
    shimmerLayer.startPoint = CGPointMake(0, 0.5);
    shimmerLayer.endPoint = CGPointMake(1, 0.5);
    shimmerLayer.frame = CGRectMake(-80, 0, 80, 20);
    [shimmerContainer.layer addSublayer:shimmerLayer];

    CABasicAnimation *shimmerAnimation = [CABasicAnimation animationWithKeyPath:@"position.x"];
    shimmerAnimation.fromValue = @(-40);
    shimmerAnimation.toValue = @(250);
    shimmerAnimation.duration = 1.5;
    shimmerAnimation.repeatCount = HUGE_VALF;
    shimmerAnimation.timingFunction = [CAMediaTimingFunction functionWithName:kCAMediaTimingFunctionLinear];
    [shimmerLayer addAnimation:shimmerAnimation forKey:@"shimmer"];
  }

  // Expanded list with L-shape (only if expanded)
  CGFloat totalHeight = 34; // Header height

  if (isExpanded && items.count > 0) {
    UIView *expandedContainer = [[UIView alloc] init];
    expandedContainer.translatesAutoresizingMaskIntoConstraints = NO;
    [container addSubview:expandedContainer];

    // L-shape vertical line with color
    UIView *verticalLine = [[UIView alloc] init];
    verticalLine.translatesAutoresizingMaskIntoConstraints = NO;
    verticalLine.backgroundColor = [typeColor colorWithAlphaComponent:0.3];
    verticalLine.layer.cornerRadius = 0.5;
    [expandedContainer addSubview:verticalLine];

    // Items container
    UIView *itemsContainer = [[UIView alloc] init];
    itemsContainer.translatesAutoresizingMaskIntoConstraints = NO;
    [expandedContainer addSubview:itemsContainer];

    // Add items (max 8) with simple fade-in animation
    NSInteger maxItems = MIN(8, items.count);
    CGFloat itemY = 0;
    CGFloat itemHeight = 22;
    CGFloat itemSpacing = 5;

    for (NSInteger i = 0; i < maxItems; i++) {
      NSString *item = items[i];
      NSString *fileName = [self getFileNameFromPath:item];

      UILabel *itemLabel = [[UILabel alloc] init];
      itemLabel.text = fileName;
      itemLabel.textColor = ChatColorWhite60();
      itemLabel.font = [UIFont systemFontOfSize:13];
      itemLabel.numberOfLines = 1;
      itemLabel.translatesAutoresizingMaskIntoConstraints = NO;
      itemLabel.alpha = 0;
      [itemsContainer addSubview:itemLabel];

      [NSLayoutConstraint activateConstraints:@[
        [itemLabel.topAnchor constraintEqualToAnchor:itemsContainer.topAnchor constant:itemY],
        [itemLabel.leadingAnchor constraintEqualToAnchor:itemsContainer.leadingAnchor],
        [itemLabel.trailingAnchor constraintEqualToAnchor:itemsContainer.trailingAnchor],
        [itemLabel.heightAnchor constraintEqualToConstant:itemHeight]
      ]];

      // Simple fade-in with easeIn
      [UIView animateWithDuration:0.2
                            delay:(i * 0.03)
                          options:UIViewAnimationOptionCurveEaseIn
                       animations:^{
        itemLabel.alpha = 1;
      } completion:nil];

      itemY += itemHeight + itemSpacing;
    }

    // "+N more" label if there are more items
    if (items.count > 8) {
      UILabel *moreLabel = [[UILabel alloc] init];
      moreLabel.text = [NSString stringWithFormat:@"+%ld more", (long)(items.count - 8)];
      moreLabel.textColor = ChatColorWhite35();
      moreLabel.font = [UIFont italicSystemFontOfSize:12];
      moreLabel.translatesAutoresizingMaskIntoConstraints = NO;
      // Start with alpha 0 for fade-in animation
      moreLabel.alpha = 0;
      [itemsContainer addSubview:moreLabel];

      [NSLayoutConstraint activateConstraints:@[
        [moreLabel.topAnchor constraintEqualToAnchor:itemsContainer.topAnchor constant:itemY],
        [moreLabel.leadingAnchor constraintEqualToAnchor:itemsContainer.leadingAnchor],
        [moreLabel.heightAnchor constraintEqualToConstant:itemHeight]
      ]];

      // Staggered fade-in for more label (after all items)
      [UIView animateWithDuration:0.2
                            delay:(maxItems * 0.03)
                          options:UIViewAnimationOptionCurveEaseOut
                       animations:^{
        moreLabel.alpha = 1;
      } completion:nil];

      itemY += itemHeight;
    }

    CGFloat itemsHeight = itemY > 0 ? itemY - itemSpacing : 0;

    // Expanded container constraints
    [NSLayoutConstraint activateConstraints:@[
      [expandedContainer.topAnchor constraintEqualToAnchor:headerRow.bottomAnchor constant:4],
      [expandedContainer.leadingAnchor constraintEqualToAnchor:container.leadingAnchor constant:6],
      [expandedContainer.trailingAnchor constraintEqualToAnchor:container.trailingAnchor],
      [expandedContainer.heightAnchor constraintEqualToConstant:itemsHeight + 4],

      // Vertical line
      [verticalLine.leadingAnchor constraintEqualToAnchor:expandedContainer.leadingAnchor],
      [verticalLine.topAnchor constraintEqualToAnchor:expandedContainer.topAnchor],
      [verticalLine.bottomAnchor constraintEqualToAnchor:expandedContainer.bottomAnchor],
      [verticalLine.widthAnchor constraintEqualToConstant:1],

      // Items container
      [itemsContainer.leadingAnchor constraintEqualToAnchor:verticalLine.trailingAnchor constant:12],
      [itemsContainer.trailingAnchor constraintEqualToAnchor:expandedContainer.trailingAnchor],
      [itemsContainer.topAnchor constraintEqualToAnchor:expandedContainer.topAnchor],
      [itemsContainer.bottomAnchor constraintEqualToAnchor:expandedContainer.bottomAnchor]
    ]];

    totalHeight += itemsHeight + 8;
  }

  // Container height
  [NSLayoutConstraint activateConstraints:@[
    [container.heightAnchor constraintEqualToConstant:totalHeight]
  ]];

  return container;
}

// Color for each group type
- (UIColor *)colorForGroupType:(NSString *)type {
  if ([type isEqualToString:@"read"]) {
    // Blue for reading files
    return [UIColor colorWithRed:0.4 green:0.69 blue:1.0 alpha:1.0]; // #66B0FF
  } else if ([type isEqualToString:@"edit"]) {
    // Green for editing files
    return [UIColor colorWithRed:0.2 green:0.78 blue:0.35 alpha:1.0]; // #34C759
  } else if ([type isEqualToString:@"bash"]) {
    // Orange for commands
    return [UIColor colorWithRed:1.0 green:0.62 blue:0.04 alpha:1.0]; // #FF9E0A
  } else if ([type isEqualToString:@"tool"]) {
    // Purple for tools
    return [UIColor colorWithRed:0.69 green:0.42 blue:1.0 alpha:1.0]; // #B06BFF
  } else if ([type isEqualToString:@"search"]) {
    // Cyan for search
    return [UIColor colorWithRed:0.35 green:0.78 blue:0.98 alpha:1.0]; // #5AC8FA
  }
  return ChatColorWhite60(); // Default
}

// Handle tap on command row header to toggle expand/collapse with animation
- (void)handleCommandRowTap:(UITapGestureRecognizer *)gesture {
  NSString *groupId = objc_getAssociatedObject(gesture.view, "groupId");
  if (!groupId) return;

  // Toggle expanded state
  BOOL currentState = [self.expandedGroups[groupId] boolValue];
  BOOL willExpand = !currentState;
  self.expandedGroups[groupId] = @(willExpand);

  // Remove cached view immediately so refresh rebuilds it
  UIView *oldView = self.messageViewCache[groupId];
  if (oldView) {
    [oldView removeFromSuperview];
  }
  [self.messageViewCache removeObjectForKey:groupId];
  [self.messageHeightCache removeObjectForKey:groupId];

  // Refresh and animate layout change together (no delay)
  [UIView animateWithDuration:0.25
                        delay:0
                      options:UIViewAnimationOptionCurveEaseInOut
                   animations:^{
    [self refreshChatMessagesView];
    [self.chatScrollView layoutIfNeeded];
  } completion:nil];
}

// Render a tool execution row (expandable to show output)
- (UIView *)renderToolRow:(NSDictionary *)group {
  NSString *groupId = group[@"id"];
  NSString *toolName = group[@"toolName"] ?: @"Tool";
  NSInteger count = [group[@"count"] integerValue];
  NSArray *messages = group[@"messages"] ?: @[];
  UIColor *typeColor = [self colorForGroupType:@"tool"]; // Purple

  // Check if this tool group is expanded
  if (!self.expandedGroups) {
    self.expandedGroups = [NSMutableDictionary dictionary];
  }
  BOOL isExpanded = [self.expandedGroups[groupId] boolValue];

  UIView *container = [[UIView alloc] init];
  container.translatesAutoresizingMaskIntoConstraints = NO;

  // Header row (tappable)
  UIView *headerRow = [[UIView alloc] init];
  headerRow.translatesAutoresizingMaskIntoConstraints = NO;
  headerRow.userInteractionEnabled = YES;
  [container addSubview:headerRow];

  // Add tap gesture to header row
  UITapGestureRecognizer *tapGesture = [[UITapGestureRecognizer alloc]
      initWithTarget:self
              action:@selector(handleCommandRowTap:)];
  [headerRow addGestureRecognizer:tapGesture];
  objc_setAssociatedObject(headerRow, "groupId", groupId, OBJC_ASSOCIATION_RETAIN_NONATOMIC);

  // Star icon with color
  UILabel *starLabel = [[UILabel alloc] init];
  starLabel.text = @"✱";
  starLabel.textColor = typeColor;
  starLabel.font = [UIFont systemFontOfSize:14];
  starLabel.translatesAutoresizingMaskIntoConstraints = NO;
  [headerRow addSubview:starLabel];

  // Label with color
  UILabel *labelText = [[UILabel alloc] init];
  labelText.text = [NSString stringWithFormat:@"Tool: %@", toolName];
  labelText.textColor = typeColor;
  labelText.font = [UIFont systemFontOfSize:15 weight:UIFontWeightSemibold];
  labelText.translatesAutoresizingMaskIntoConstraints = NO;
  [headerRow addSubview:labelText];

  // Count meta
  UILabel *metaLabel = [[UILabel alloc] init];
  metaLabel.text = [NSString stringWithFormat:@"(%ld %@)", (long)count, count == 1 ? @"call" : @"calls"];
  metaLabel.textColor = ChatColorWhite50();
  metaLabel.font = [UIFont systemFontOfSize:15];
  metaLabel.translatesAutoresizingMaskIntoConstraints = NO;
  [headerRow addSubview:metaLabel];

  // Chevron icon
  UIImageSymbolConfiguration *chevronConfig = [UIImageSymbolConfiguration
      configurationWithPointSize:16 weight:UIImageSymbolWeightMedium];
  UIImage *chevronImage = [UIImage systemImageNamed:@"chevron.down" withConfiguration:chevronConfig];
  UIImageView *chevronView = [[UIImageView alloc] initWithImage:chevronImage];
  chevronView.tintColor = [UIColor colorWithRed:0.56 green:0.56 blue:0.58 alpha:1.0];
  chevronView.translatesAutoresizingMaskIntoConstraints = NO;
  chevronView.contentMode = UIViewContentModeScaleAspectFit;
  if (isExpanded) {
    chevronView.transform = CGAffineTransformMakeRotation(M_PI);
  }
  [headerRow addSubview:chevronView];

  [NSLayoutConstraint activateConstraints:@[
    [headerRow.topAnchor constraintEqualToAnchor:container.topAnchor],
    [headerRow.leadingAnchor constraintEqualToAnchor:container.leadingAnchor],
    [headerRow.trailingAnchor constraintEqualToAnchor:container.trailingAnchor],
    [headerRow.heightAnchor constraintEqualToConstant:34],

    [starLabel.leadingAnchor constraintEqualToAnchor:headerRow.leadingAnchor],
    [starLabel.centerYAnchor constraintEqualToAnchor:headerRow.centerYAnchor],

    [labelText.leadingAnchor constraintEqualToAnchor:starLabel.trailingAnchor constant:10],
    [labelText.centerYAnchor constraintEqualToAnchor:headerRow.centerYAnchor],

    [metaLabel.leadingAnchor constraintEqualToAnchor:labelText.trailingAnchor constant:8],
    [metaLabel.centerYAnchor constraintEqualToAnchor:headerRow.centerYAnchor],

    [chevronView.trailingAnchor constraintEqualToAnchor:headerRow.trailingAnchor],
    [chevronView.centerYAnchor constraintEqualToAnchor:headerRow.centerYAnchor],
    [chevronView.widthAnchor constraintEqualToConstant:16],
    [chevronView.heightAnchor constraintEqualToConstant:16]
  ]];

  CGFloat totalHeight = 34;

  // Expanded content showing tool output
  if (isExpanded && messages.count > 0) {
    UIView *expandedContainer = [[UIView alloc] init];
    expandedContainer.translatesAutoresizingMaskIntoConstraints = NO;
    [container addSubview:expandedContainer];

    // L-shape vertical line
    UIView *verticalLine = [[UIView alloc] init];
    verticalLine.translatesAutoresizingMaskIntoConstraints = NO;
    verticalLine.backgroundColor = [typeColor colorWithAlphaComponent:0.3];
    verticalLine.layer.cornerRadius = 0.5;
    [expandedContainer addSubview:verticalLine];

    // Items container
    UIView *itemsContainer = [[UIView alloc] init];
    itemsContainer.translatesAutoresizingMaskIntoConstraints = NO;
    [expandedContainer addSubview:itemsContainer];

    CGFloat itemY = 0;
    CGFloat itemHeight = 22;
    CGFloat itemSpacing = 5;

    for (NSInteger i = 0; i < MIN(4, messages.count); i++) {
      NSDictionary *msg = messages[i];
      // Get output from mcpTool or tool - check for NSNull
      id rawOutput = msg[@"mcpTool"][@"output"] ?: msg[@"tool"][@"output"];
      NSString *output = @"";
      if (rawOutput && ![rawOutput isKindOfClass:[NSNull class]]) {
        if ([rawOutput isKindOfClass:[NSString class]]) {
          output = rawOutput;
        } else if ([rawOutput isKindOfClass:[NSDictionary class]] || [rawOutput isKindOfClass:[NSArray class]]) {
          // Convert JSON to string
          NSData *jsonData = [NSJSONSerialization dataWithJSONObject:rawOutput options:0 error:nil];
          output = [[NSString alloc] initWithData:jsonData encoding:NSUTF8StringEncoding] ?: @"";
        }
      }
      // Truncate long output
      NSString *displayText = output.length > 50 ? [NSString stringWithFormat:@"%@...", [output substringToIndex:50]] : output;
      if (displayText.length == 0) displayText = @"(no output)";

      UILabel *itemLabel = [[UILabel alloc] init];
      itemLabel.text = displayText;
      itemLabel.textColor = ChatColorWhite60();
      itemLabel.font = [UIFont systemFontOfSize:13];
      itemLabel.numberOfLines = 1;
      itemLabel.translatesAutoresizingMaskIntoConstraints = NO;
      itemLabel.alpha = 0;
      [itemsContainer addSubview:itemLabel];

      [NSLayoutConstraint activateConstraints:@[
        [itemLabel.topAnchor constraintEqualToAnchor:itemsContainer.topAnchor constant:itemY],
        [itemLabel.leadingAnchor constraintEqualToAnchor:itemsContainer.leadingAnchor],
        [itemLabel.trailingAnchor constraintEqualToAnchor:itemsContainer.trailingAnchor],
        [itemLabel.heightAnchor constraintEqualToConstant:itemHeight]
      ]];

      // Simple fade-in with easeIn
      [UIView animateWithDuration:0.2
                            delay:(i * 0.03)
                          options:UIViewAnimationOptionCurveEaseIn
                       animations:^{
        itemLabel.alpha = 1;
      } completion:nil];

      itemY += itemHeight + itemSpacing;
    }

    if (messages.count > 4) {
      UILabel *moreLabel = [[UILabel alloc] init];
      moreLabel.text = [NSString stringWithFormat:@"+%ld more", (long)(messages.count - 4)];
      moreLabel.textColor = ChatColorWhite35();
      moreLabel.font = [UIFont italicSystemFontOfSize:12];
      moreLabel.translatesAutoresizingMaskIntoConstraints = NO;
      moreLabel.alpha = 0;
      [itemsContainer addSubview:moreLabel];

      [NSLayoutConstraint activateConstraints:@[
        [moreLabel.topAnchor constraintEqualToAnchor:itemsContainer.topAnchor constant:itemY],
        [moreLabel.leadingAnchor constraintEqualToAnchor:itemsContainer.leadingAnchor],
        [moreLabel.heightAnchor constraintEqualToConstant:itemHeight]
      ]];

      [UIView animateWithDuration:0.2
                            delay:(4 * 0.03)
                          options:UIViewAnimationOptionCurveEaseOut
                       animations:^{
        moreLabel.alpha = 1;
      } completion:nil];

      itemY += itemHeight;
    }

    CGFloat itemsHeight = itemY > 0 ? itemY - itemSpacing : 0;

    [NSLayoutConstraint activateConstraints:@[
      [expandedContainer.topAnchor constraintEqualToAnchor:headerRow.bottomAnchor constant:4],
      [expandedContainer.leadingAnchor constraintEqualToAnchor:container.leadingAnchor constant:6],
      [expandedContainer.trailingAnchor constraintEqualToAnchor:container.trailingAnchor],
      [expandedContainer.heightAnchor constraintEqualToConstant:itemsHeight + 4],

      [verticalLine.leadingAnchor constraintEqualToAnchor:expandedContainer.leadingAnchor],
      [verticalLine.topAnchor constraintEqualToAnchor:expandedContainer.topAnchor],
      [verticalLine.bottomAnchor constraintEqualToAnchor:expandedContainer.bottomAnchor],
      [verticalLine.widthAnchor constraintEqualToConstant:1],

      [itemsContainer.leadingAnchor constraintEqualToAnchor:verticalLine.trailingAnchor constant:12],
      [itemsContainer.trailingAnchor constraintEqualToAnchor:expandedContainer.trailingAnchor],
      [itemsContainer.topAnchor constraintEqualToAnchor:expandedContainer.topAnchor],
      [itemsContainer.bottomAnchor constraintEqualToAnchor:expandedContainer.bottomAnchor]
    ]];

    totalHeight += itemsHeight + 8;
  }

  [NSLayoutConstraint activateConstraints:@[
    [container.heightAnchor constraintEqualToConstant:totalHeight]
  ]];

  return container;
}

// Render a search row (expandable to show results)
- (UIView *)renderSearchRow:(NSDictionary *)group {
  NSString *groupId = group[@"id"];
  // Handle NSNull for query and results
  id rawQuery = group[@"query"];
  NSString *query = (rawQuery && ![rawQuery isKindOfClass:[NSNull class]] && [rawQuery isKindOfClass:[NSString class]]) ? rawQuery : @"Unknown";
  id rawResults = group[@"results"];
  NSString *results = (rawResults && ![rawResults isKindOfClass:[NSNull class]] && [rawResults isKindOfClass:[NSString class]]) ? rawResults : @"";
  UIColor *typeColor = [self colorForGroupType:@"search"]; // Cyan

  // Check if this search is expanded
  if (!self.expandedGroups) {
    self.expandedGroups = [NSMutableDictionary dictionary];
  }
  BOOL isExpanded = [self.expandedGroups[groupId] boolValue];

  UIView *container = [[UIView alloc] init];
  container.translatesAutoresizingMaskIntoConstraints = NO;

  // Header row (tappable)
  UIView *headerRow = [[UIView alloc] init];
  headerRow.translatesAutoresizingMaskIntoConstraints = NO;
  headerRow.userInteractionEnabled = YES;
  [container addSubview:headerRow];

  // Add tap gesture to header row
  UITapGestureRecognizer *tapGesture = [[UITapGestureRecognizer alloc]
      initWithTarget:self
              action:@selector(handleCommandRowTap:)];
  [headerRow addGestureRecognizer:tapGesture];
  objc_setAssociatedObject(headerRow, "groupId", groupId, OBJC_ASSOCIATION_RETAIN_NONATOMIC);

  // Star icon with color
  UILabel *starLabel = [[UILabel alloc] init];
  starLabel.text = @"✱";
  starLabel.textColor = typeColor;
  starLabel.font = [UIFont systemFontOfSize:14];
  starLabel.translatesAutoresizingMaskIntoConstraints = NO;
  [headerRow addSubview:starLabel];

  // Label with color
  UILabel *labelText = [[UILabel alloc] init];
  labelText.text = @"Searched:";
  labelText.textColor = typeColor;
  labelText.font = [UIFont systemFontOfSize:15 weight:UIFontWeightSemibold];
  labelText.translatesAutoresizingMaskIntoConstraints = NO;
  [headerRow addSubview:labelText];

  // Query text
  UILabel *queryLabel = [[UILabel alloc] init];
  queryLabel.text = query.length > 25 ? [NSString stringWithFormat:@"%@...", [query substringToIndex:25]] : query;
  queryLabel.textColor = ChatColorWhite50();
  queryLabel.font = [UIFont systemFontOfSize:15];
  queryLabel.numberOfLines = 1;
  queryLabel.translatesAutoresizingMaskIntoConstraints = NO;
  [headerRow addSubview:queryLabel];

  // Chevron icon (only show if there are results)
  UIImageView *chevronView = nil;
  if (results.length > 0) {
    UIImageSymbolConfiguration *chevronConfig = [UIImageSymbolConfiguration
        configurationWithPointSize:16 weight:UIImageSymbolWeightMedium];
    UIImage *chevronImage = [UIImage systemImageNamed:@"chevron.down" withConfiguration:chevronConfig];
    chevronView = [[UIImageView alloc] initWithImage:chevronImage];
    chevronView.tintColor = [UIColor colorWithRed:0.56 green:0.56 blue:0.58 alpha:1.0];
    chevronView.translatesAutoresizingMaskIntoConstraints = NO;
    chevronView.contentMode = UIViewContentModeScaleAspectFit;
    if (isExpanded) {
      chevronView.transform = CGAffineTransformMakeRotation(M_PI);
    }
    [headerRow addSubview:chevronView];
  }

  NSMutableArray *constraints = [NSMutableArray arrayWithArray:@[
    [headerRow.topAnchor constraintEqualToAnchor:container.topAnchor],
    [headerRow.leadingAnchor constraintEqualToAnchor:container.leadingAnchor],
    [headerRow.trailingAnchor constraintEqualToAnchor:container.trailingAnchor],
    [headerRow.heightAnchor constraintEqualToConstant:34],

    [starLabel.leadingAnchor constraintEqualToAnchor:headerRow.leadingAnchor],
    [starLabel.centerYAnchor constraintEqualToAnchor:headerRow.centerYAnchor],

    [labelText.leadingAnchor constraintEqualToAnchor:starLabel.trailingAnchor constant:10],
    [labelText.centerYAnchor constraintEqualToAnchor:headerRow.centerYAnchor],

    [queryLabel.leadingAnchor constraintEqualToAnchor:labelText.trailingAnchor constant:8],
    [queryLabel.centerYAnchor constraintEqualToAnchor:headerRow.centerYAnchor]
  ]];

  if (chevronView) {
    [constraints addObjectsFromArray:@[
      [queryLabel.trailingAnchor constraintLessThanOrEqualToAnchor:chevronView.leadingAnchor constant:-8],
      [chevronView.trailingAnchor constraintEqualToAnchor:headerRow.trailingAnchor],
      [chevronView.centerYAnchor constraintEqualToAnchor:headerRow.centerYAnchor],
      [chevronView.widthAnchor constraintEqualToConstant:16],
      [chevronView.heightAnchor constraintEqualToConstant:16]
    ]];
  } else {
    [constraints addObject:[queryLabel.trailingAnchor constraintLessThanOrEqualToAnchor:headerRow.trailingAnchor]];
  }

  [NSLayoutConstraint activateConstraints:constraints];

  CGFloat totalHeight = 34;

  // Expanded content showing search results
  if (isExpanded && results.length > 0) {
    UIView *expandedContainer = [[UIView alloc] init];
    expandedContainer.translatesAutoresizingMaskIntoConstraints = NO;
    [container addSubview:expandedContainer];

    // L-shape vertical line
    UIView *verticalLine = [[UIView alloc] init];
    verticalLine.translatesAutoresizingMaskIntoConstraints = NO;
    verticalLine.backgroundColor = [typeColor colorWithAlphaComponent:0.3];
    verticalLine.layer.cornerRadius = 0.5;
    [expandedContainer addSubview:verticalLine];

    // Results text view
    UILabel *resultsLabel = [[UILabel alloc] init];
    // Split results into lines and show first few
    NSArray *lines = [results componentsSeparatedByString:@"\n"];
    NSInteger maxLines = MIN(8, lines.count);
    NSMutableArray *displayLines = [NSMutableArray array];
    for (NSInteger i = 0; i < maxLines; i++) {
      NSString *line = lines[i];
      if (line.length > 60) {
        [displayLines addObject:[NSString stringWithFormat:@"%@...", [line substringToIndex:60]]];
      } else {
        [displayLines addObject:line];
      }
    }
    if (lines.count > maxLines) {
      [displayLines addObject:[NSString stringWithFormat:@"... +%ld more lines", (long)(lines.count - maxLines)]];
    }
    resultsLabel.text = [displayLines componentsJoinedByString:@"\n"];
    resultsLabel.textColor = ChatColorWhite60();
    resultsLabel.font = [UIFont fontWithName:@"Menlo" size:11] ?: [UIFont systemFontOfSize:11];
    resultsLabel.numberOfLines = 0;
    resultsLabel.translatesAutoresizingMaskIntoConstraints = NO;
    resultsLabel.alpha = 0;
    [expandedContainer addSubview:resultsLabel];

    [UIView animateWithDuration:0.2
                          delay:0.03
                        options:UIViewAnimationOptionCurveEaseOut
                     animations:^{
      resultsLabel.alpha = 1;
    } completion:nil];

    // Calculate height based on content
    CGSize textSize = [resultsLabel.text boundingRectWithSize:CGSizeMake(250, CGFLOAT_MAX)
                                                      options:NSStringDrawingUsesLineFragmentOrigin
                                                   attributes:@{NSFontAttributeName: resultsLabel.font}
                                                      context:nil].size;
    CGFloat resultsHeight = MIN(200, textSize.height + 16);

    [NSLayoutConstraint activateConstraints:@[
      [expandedContainer.topAnchor constraintEqualToAnchor:headerRow.bottomAnchor constant:4],
      [expandedContainer.leadingAnchor constraintEqualToAnchor:container.leadingAnchor constant:6],
      [expandedContainer.trailingAnchor constraintEqualToAnchor:container.trailingAnchor],
      [expandedContainer.heightAnchor constraintEqualToConstant:resultsHeight],

      [verticalLine.leadingAnchor constraintEqualToAnchor:expandedContainer.leadingAnchor],
      [verticalLine.topAnchor constraintEqualToAnchor:expandedContainer.topAnchor],
      [verticalLine.bottomAnchor constraintEqualToAnchor:expandedContainer.bottomAnchor],
      [verticalLine.widthAnchor constraintEqualToConstant:1],

      [resultsLabel.leadingAnchor constraintEqualToAnchor:verticalLine.trailingAnchor constant:12],
      [resultsLabel.trailingAnchor constraintEqualToAnchor:expandedContainer.trailingAnchor],
      [resultsLabel.topAnchor constraintEqualToAnchor:expandedContainer.topAnchor],
      [resultsLabel.bottomAnchor constraintEqualToAnchor:expandedContainer.bottomAnchor]
    ]];

    totalHeight += resultsHeight + 8;
  }

  [NSLayoutConstraint activateConstraints:@[
    [container.heightAnchor constraintEqualToConstant:totalHeight]
  ]];

  return container;
}

- (void)startMessagePolling {
  // Stop existing timer
  if (self.chatPollingTimer) {
    [self.chatPollingTimer invalidate];
    self.chatPollingTimer = nil;
  }

  // Poll every 2 seconds for new messages and session updates
  self.chatPollingTimer =
      [NSTimer scheduledTimerWithTimeInterval:2.0
                                       target:self
                                     selector:@selector(pollForUpdates)
                                     userInfo:nil
                                      repeats:YES];
}

- (void)pollForUpdates {
  [self pollForNewMessages];
  [self pollForSessionStatus];
}

- (void)stopMessagePolling {
  if (self.chatPollingTimer) {
    [self.chatPollingTimer invalidate];
    self.chatPollingTimer = nil;
  }
}

- (void)pollForNewMessages {
  // Early exit if chat is not active
  if (!self.isChatMode || !self.chatSessionId || self.chatSessionId.length == 0) {
    return;
  }

  EXChatBackendService *backendService = [EXChatBackendService sharedInstance];
  [backendService
      fetchMessagesForSession:self.chatSessionId
                   completion:^(NSArray<NSDictionary *> *_Nullable messages,
                                NSError *_Nullable error) {
                     dispatch_async(dispatch_get_main_queue(), ^{
                       // Safety check: exit if chat was closed during network request
                       if (!self.isChatMode) {
                         return;
                       }

                       if (error) {
                         // Silently fail - don't spam logs
                         return;
                       }

                       // Check if messages changed (count or content)
                       NSInteger oldCount =
                           self.chatMessages ? self.chatMessages.count : 0;
                       NSInteger newCount = messages ? messages.count : 0;

                       BOOL hasChanges = NO;
                       BOOL isNewMessage = NO;

                       if (newCount != oldCount) {
                         hasChanges = YES;
                         isNewMessage = (newCount > oldCount);
                       } else if (newCount > 0) {
                         // Same count - check if content changed (e.g., todo updates)
                         // Compare last few messages for efficiency
                         NSInteger checkCount = MIN(5, newCount);
                         for (NSInteger i = 0; i < checkCount; i++) {
                           NSInteger idx = newCount - 1 - i;
                           NSDictionary *oldMsg = self.chatMessages[idx];
                           NSDictionary *newMsg = messages[idx];

                           // Check for todo changes
                           NSArray *oldTodos = oldMsg[@"todos"];
                           NSArray *newTodos = newMsg[@"todos"];
                           if (oldTodos || newTodos) {
                             if (![oldTodos isEqual:newTodos]) {
                               hasChanges = YES;
                               break;
                             }
                           }

                           // Check for content changes
                           NSString *oldContent = oldMsg[@"content"];
                           NSString *newContent = newMsg[@"content"];
                           if (![oldContent isEqual:newContent]) {
                             hasChanges = YES;
                             break;
                           }

                           // Check for status message changes
                           NSString *oldStatus = oldMsg[@"statusMessage"];
                           NSString *newStatus = newMsg[@"statusMessage"];
                           if (![oldStatus isEqual:newStatus]) {
                             hasChanges = YES;
                             break;
                           }
                         }
                       }

                       if (hasChanges) {
                         self.chatMessages = messages ?: @[];
                         [self refreshChatMessagesView];

                         // Auto-scroll to bottom for new messages or todo updates
                         dispatch_after(
                             dispatch_time(DISPATCH_TIME_NOW,
                                           (int64_t)(0.1 * NSEC_PER_SEC)),
                             dispatch_get_main_queue(), ^{
                               if (isNewMessage) {
                                 // New message - always scroll to bottom
                                 [self scrollChatToBottom];
                               } else {
                                 // Content update (like todos) - scroll if near bottom (animated)
                                 [self scrollChatToBottomIfNeeded:YES animated:YES];
                               }
                             });
                       }
                     });
                   }];
}

#pragma mark - Message Sending

- (void)sendChatMessage:(NSString *)messageText {
  // Check if we have media paths from studio modals
  BOOL hasMediaPaths = (self.imagePathMappings.count > 0) ||
                       (self.videoPathMappings.count > 0) ||
                       (self.audioPathMappings.count > 0);

  // Check for pending attachments (from Add to Prompt flow)
  BOOL hasPendingImages = self.pendingImageAttachments && self.pendingImageAttachments.count > 0;
  BOOL hasPendingAudios = self.pendingAudioAttachments && self.pendingAudioAttachments.count > 0;
  BOOL hasPendingVideos = self.pendingVideoAttachments && self.pendingVideoAttachments.count > 0;

  if ((!messageText || messageText.length == 0) &&
      !hasPendingImages && !hasPendingAudios && !hasPendingVideos &&
      !hasMediaPaths) {
    return;
  }

  if (!self.chatSessionId || self.isSendingMessage) {
    return;
  }

  self.isSendingMessage = YES;

  EXChatBackendService *backendService = [EXChatBackendService sharedInstance];
  // Use sandboxId (E2B sandbox ID from session.sessionId) as primary
  // CRITICAL: This must be the E2B sandbox ID (e.g., "sbx_xxxxx"), NOT the Convex document ID
  NSString *sessionIdForUpload = self.sandboxId;
  NSLog(@"📤 [ChatView] sendMessage - self.sandboxId: '%@', chatSession.sessionId: '%@', chatSessionId: '%@'",
        self.sandboxId ?: @"(nil)",
        self.chatSession[@"sessionId"] ?: @"(nil)",
        self.chatSessionId ?: @"(nil)");
  if (!sessionIdForUpload || sessionIdForUpload.length == 0) {
    // Fallback to chatSession[@"sessionId"] - this should also be the E2B sandbox ID
    sessionIdForUpload = self.chatSession[@"sessionId"];
    NSLog(@"⚠️ [ChatView] sandboxId was empty, falling back to chatSession.sessionId: %@", sessionIdForUpload);
  }
  if (!sessionIdForUpload || sessionIdForUpload.length == 0) {
    // If still empty, the session may not have been fully created (sandbox not yet running)
    NSLog(@"❌ [ChatView] No E2B sandbox ID available! Session may still be starting.");
    self.isSendingMessage = NO;
    return;
  }
  NSLog(@"📤 [ChatView] Using sessionIdForUpload: %@", sessionIdForUpload);
  NSString *processedMessage = [self processMediaTagsInMessage:messageText];

  // Handle pending attachments - upload them at send time
  if (hasPendingImages || hasPendingAudios || hasPendingVideos) {
    [self uploadPendingMediaAndSendMessage:processedMessage
                            backendService:backendService
                        sessionIdForUpload:sessionIdForUpload];
  } else {
    // Collect media paths from studio modals
    NSMutableArray *mediaArray = [NSMutableArray array];

    // Image paths
    if (self.imagePathMappings.count > 0) {
      for (NSString *tagName in self.imagePathMappings) {
        NSString *path = self.imagePathMappings[tagName];
        if (path.length > 0) {
          [mediaArray addObject:@{@"fileName": tagName, @"path": path, @"type": @"image"}];
        }
      }
    }

    // Video paths
    if (self.videoPathMappings.count > 0) {
      for (NSString *tagName in self.videoPathMappings) {
        NSString *path = self.videoPathMappings[tagName];
        if (path.length > 0) {
          [mediaArray addObject:@{@"fileName": tagName, @"path": path, @"type": @"video"}];
        }
      }
    }

    // Audio paths
    if (self.audioPathMappings.count > 0) {
      for (NSString *tagName in self.audioPathMappings) {
        NSString *path = self.audioPathMappings[tagName];
        if (path.length > 0) {
          [mediaArray addObject:@{@"fileName": tagName, @"path": path, @"type": @"audio"}];
        }
      }
    }

    // Send message with media
    [self sendMessageToBackend:processedMessage imagesArray:mediaArray backendService:backendService];

    // Clear path mappings
    [self.imagePathMappings removeAllObjects];
    [self.videoPathMappings removeAllObjects];
    [self.audioPathMappings removeAllObjects];
  }
}

// Convert @tagName references to just the tag name (paths stored separately in images array)
- (NSString *)processMediaTagsInMessage:(NSString *)messageText {
  if (!messageText || messageText.length == 0) {
    return messageText;
  }

  NSMutableString *processedText = [NSMutableString stringWithString:messageText];

  // Process image tags from imagePathMappings - strip @tagName, keep just the tag name
  if (self.imagePathMappings && self.imagePathMappings.count > 0) {
    for (NSString *tagName in self.imagePathMappings) {
      NSString *path = self.imagePathMappings[tagName];
      if (path && path.length > 0) {
        // Replace @tagName with just tagName (no path embedded in message)
        NSString *tagPattern = [NSString stringWithFormat:@"@%@ ", tagName];
        NSString *replacement = [NSString stringWithFormat:@"[image: %@] ", tagName];
        [processedText replaceOccurrencesOfString:tagPattern
                                       withString:replacement
                                          options:0
                                            range:NSMakeRange(0, processedText.length)];
        // Also handle without trailing space (at end of message)
        tagPattern = [NSString stringWithFormat:@"@%@", tagName];
        replacement = [NSString stringWithFormat:@"[image: %@]", tagName];
        // Only replace if the tag is at the end (not followed by alphanumeric)
        NSRange range = [processedText rangeOfString:tagPattern options:NSBackwardsSearch];
        if (range.location != NSNotFound && range.location + range.length == processedText.length) {
          [processedText replaceCharactersInRange:range withString:replacement];
        }
      }
    }
  }

  // Process video tags from videoPathMappings (if available)
  NSDictionary *videoMappings = nil;
  if ([self respondsToSelector:@selector(videoPathMappings)]) {
    videoMappings = [self performSelector:@selector(videoPathMappings)];
  }
  if (videoMappings && videoMappings.count > 0) {
    for (NSString *tagName in videoMappings) {
      NSString *path = videoMappings[tagName];
      if (path && path.length > 0) {
        NSString *tagPattern = [NSString stringWithFormat:@"@%@ ", tagName];
        NSString *replacement = [NSString stringWithFormat:@"[video: %@] ", tagName];
        [processedText replaceOccurrencesOfString:tagPattern
                                       withString:replacement
                                          options:0
                                            range:NSMakeRange(0, processedText.length)];
        // Also handle without trailing space
        tagPattern = [NSString stringWithFormat:@"@%@", tagName];
        replacement = [NSString stringWithFormat:@"[video: %@]", tagName];
        NSRange range = [processedText rangeOfString:tagPattern options:NSBackwardsSearch];
        if (range.location != NSNotFound && range.location + range.length == processedText.length) {
          [processedText replaceCharactersInRange:range withString:replacement];
        }
      }
    }
  }

  // Process audio tags from audioPathMappings (if available)
  NSDictionary *audioMappings = nil;
  if ([self respondsToSelector:@selector(audioPathMappings)]) {
    audioMappings = [self performSelector:@selector(audioPathMappings)];
  }
  if (audioMappings && audioMappings.count > 0) {
    for (NSString *tagName in audioMappings) {
      NSString *path = audioMappings[tagName];
      if (path && path.length > 0) {
        NSString *tagPattern = [NSString stringWithFormat:@"@%@ ", tagName];
        NSString *replacement = [NSString stringWithFormat:@"[audio: %@] ", tagName];
        [processedText replaceOccurrencesOfString:tagPattern
                                       withString:replacement
                                          options:0
                                            range:NSMakeRange(0, processedText.length)];
        // Also handle without trailing space
        tagPattern = [NSString stringWithFormat:@"@%@", tagName];
        replacement = [NSString stringWithFormat:@"[audio: %@]", tagName];
        NSRange range = [processedText rangeOfString:tagPattern options:NSBackwardsSearch];
        if (range.location != NSNotFound && range.location + range.length == processedText.length) {
          [processedText replaceCharactersInRange:range withString:replacement];
        }
      }
    }
  }

  return processedText;
}

- (void)uploadPendingImagesAndSendMessage:(NSString *)messageText
                           backendService:(EXChatBackendService *)backendService
                       sessionIdForUpload:(NSString *)sessionIdForUpload {

  NSLog(@"📤 [ChatView] uploadPendingImages - sessionId: %@, attachments: %lu", sessionIdForUpload, (unsigned long)self.pendingImageAttachments.count);

  // Validate session ID before uploading
  if (!sessionIdForUpload || sessionIdForUpload.length == 0) {
    NSLog(@"❌ [ChatView] uploadPendingImages - No session ID! Cannot upload.");
    self.isSendingMessage = NO;
    return;
  }

  // Set uploading flag to show loading indicator and prevent duplicate sends
  self.isUploadingImage = YES;

  // Show loading indicator on send button
  dispatch_async(dispatch_get_main_queue(), ^{
    [self showUploadingIndicator];
  });

  NSMutableArray *uploadResults = [NSMutableArray array];
  NSMutableString *fullMessage = [NSMutableString stringWithString:messageText ?: @""];

  dispatch_group_t uploadGroup = dispatch_group_create();

  for (NSDictionary *attachment in self.pendingImageAttachments) {
    UIImage *image = attachment[@"image"];
    NSString *fileName = attachment[@"fileName"];
    NSString *sandboxPath = attachment[@"sandboxPath"]; // Pre-uploaded from studio

    if (!image) continue;

    // If already uploaded to sandbox (from studio modal), use existing path
    if (sandboxPath && sandboxPath.length > 0) {
      @synchronized (uploadResults) {
        [uploadResults addObject:@{
          @"path": sandboxPath,
          @"fileName": fileName
        }];
      }
      continue;
    }

    // Otherwise, upload now
    dispatch_group_enter(uploadGroup);

    NSData *imageData = UIImageJPEGRepresentation(image, 0.8);
    if (!imageData) {
      imageData = UIImagePNGRepresentation(image);
    }

    if (!imageData) {
      dispatch_group_leave(uploadGroup);
      continue;
    }

    NSString *mimeType = @"image/jpeg";
    if ([fileName.lowercaseString hasSuffix:@".png"]) {
      mimeType = @"image/png";
    }

    [backendService uploadImageWithData:imageData
                               fileName:fileName
                               mimeType:mimeType
                              sessionId:sessionIdForUpload
                             completion:^(NSDictionary * _Nullable result, NSError * _Nullable error) {
      if (result && !error) {
        NSLog(@"✅ [ChatView] Image uploaded: %@ -> %@", fileName, result[@"path"]);
        @synchronized (uploadResults) {
          [uploadResults addObject:result];
        }
      } else {
        NSLog(@"❌ [ChatView] Image upload failed for %@: %@", fileName, error.localizedDescription);
      }
      dispatch_group_leave(uploadGroup);
    }];
  }

  dispatch_group_notify(uploadGroup, dispatch_get_main_queue(), ^{
    // Hide loading indicator
    self.isUploadingImage = NO;
    [self hideUploadingIndicator];

    // Build images array from upload results (don't embed paths in message content)
    NSMutableArray *imagesArray = [NSMutableArray array];
    for (NSDictionary *result in uploadResults) {
      NSString *path = result[@"path"];
      NSString *uploadedFileName = result[@"fileName"];
      NSString *storageId = result[@"storageId"];
      if (path && uploadedFileName) {
        [imagesArray addObject:@{
          @"fileName": uploadedFileName,
          @"path": path,
          @"storageId": storageId ?: @""
        }];
      }
    }

    [self clearAllImageAttachments];

    NSLog(@"📤 [ChatView] Sending message with %lu images", (unsigned long)imagesArray.count);
    for (NSDictionary *img in imagesArray) {
      NSLog(@"   📷 %@ -> %@", img[@"fileName"], img[@"path"]);
    }

    // Send message with clean content (no embedded paths) and images array
    [self sendMessageToBackend:fullMessage imagesArray:imagesArray backendService:backendService];
  });
}

// Upload all pending media (images, audios, videos) and send message
- (void)uploadPendingMediaAndSendMessage:(NSString *)messageText
                          backendService:(EXChatBackendService *)backendService
                      sessionIdForUpload:(NSString *)sessionIdForUpload {

  NSLog(@"📤 [ChatView] uploadPendingMedia - sessionId: %@, images: %lu, audios: %lu, videos: %lu",
        sessionIdForUpload,
        (unsigned long)self.pendingImageAttachments.count,
        (unsigned long)self.pendingAudioAttachments.count,
        (unsigned long)self.pendingVideoAttachments.count);

  // Validate session ID before uploading
  if (!sessionIdForUpload || sessionIdForUpload.length == 0) {
    NSLog(@"❌ [ChatView] uploadPendingMedia - No session ID! Cannot upload.");
    self.isSendingMessage = NO;
    return;
  }

  // Set uploading flag to show loading indicator and prevent duplicate sends
  self.isUploadingImage = YES;

  // Show loading indicator on send button
  dispatch_async(dispatch_get_main_queue(), ^{
    [self showUploadingIndicator];
  });

  NSMutableArray *imageUploadResults = [NSMutableArray array];
  NSMutableArray *audioUploadResults = [NSMutableArray array];
  NSMutableArray *videoUploadResults = [NSMutableArray array];
  NSMutableString *fullMessage = [NSMutableString stringWithString:messageText ?: @""];

  dispatch_group_t uploadGroup = dispatch_group_create();

  // Upload pending images
  for (NSDictionary *attachment in self.pendingImageAttachments) {
    UIImage *image = attachment[@"image"];
    NSString *fileName = attachment[@"fileName"];
    NSString *sandboxPath = attachment[@"sandboxPath"];

    if (!image) continue;

    // If already uploaded to sandbox (from studio modal), use existing path
    if (sandboxPath && sandboxPath.length > 0) {
      @synchronized (imageUploadResults) {
        [imageUploadResults addObject:@{
          @"path": sandboxPath,
          @"fileName": fileName
        }];
      }
      continue;
    }

    // Otherwise, upload now
    dispatch_group_enter(uploadGroup);

    NSData *imageData = UIImageJPEGRepresentation(image, 0.8);
    if (!imageData) {
      imageData = UIImagePNGRepresentation(image);
    }

    if (!imageData) {
      dispatch_group_leave(uploadGroup);
      continue;
    }

    NSString *mimeType = @"image/jpeg";
    if ([fileName.lowercaseString hasSuffix:@".png"]) {
      mimeType = @"image/png";
    }

    [backendService uploadImageWithData:imageData
                               fileName:fileName
                               mimeType:mimeType
                              sessionId:sessionIdForUpload
                             completion:^(NSDictionary * _Nullable result, NSError * _Nullable error) {
      if (result && !error) {
        NSLog(@"✅ [ChatView] Image uploaded: %@ -> %@", fileName, result[@"path"]);
        @synchronized (imageUploadResults) {
          [imageUploadResults addObject:result];
        }
      } else {
        NSLog(@"❌ [ChatView] Image upload failed for %@: %@", fileName, error.localizedDescription);
      }
      dispatch_group_leave(uploadGroup);
    }];
  }

  // Upload pending audios
  for (NSDictionary *attachment in self.pendingAudioAttachments) {
    NSData *audioData = attachment[@"data"];
    NSString *fileName = attachment[@"fileName"];

    if (!audioData) continue;

    dispatch_group_enter(uploadGroup);

    [backendService uploadAudioWithData:audioData
                               fileName:fileName
                              sessionId:sessionIdForUpload
                             completion:^(NSDictionary * _Nullable result, NSError * _Nullable error) {
      if (result && !error) {
        NSLog(@"✅ [ChatView] Audio uploaded: %@ -> %@", fileName, result[@"path"]);
        @synchronized (audioUploadResults) {
          [audioUploadResults addObject:result];
        }
      } else {
        NSLog(@"❌ [ChatView] Audio upload failed for %@: %@", fileName, error.localizedDescription);
      }
      dispatch_group_leave(uploadGroup);
    }];
  }

  // Upload pending videos
  for (NSDictionary *attachment in self.pendingVideoAttachments) {
    NSData *videoData = attachment[@"data"];
    NSString *fileName = attachment[@"fileName"];

    if (!videoData) continue;

    dispatch_group_enter(uploadGroup);

    [backendService uploadVideoWithData:videoData
                               fileName:fileName
                              sessionId:sessionIdForUpload
                             completion:^(NSDictionary * _Nullable result, NSError * _Nullable error) {
      if (result && !error) {
        NSLog(@"✅ [ChatView] Video uploaded: %@ -> %@", fileName, result[@"path"]);
        @synchronized (videoUploadResults) {
          [videoUploadResults addObject:result];
        }
      } else {
        NSLog(@"❌ [ChatView] Video upload failed for %@: %@", fileName, error.localizedDescription);
      }
      dispatch_group_leave(uploadGroup);
    }];
  }

  dispatch_group_notify(uploadGroup, dispatch_get_main_queue(), ^{
    // Hide loading indicator
    self.isUploadingImage = NO;
    [self hideUploadingIndicator];

    // Build media arrays from upload results
    NSMutableArray *imagesArray = [NSMutableArray array];
    for (NSDictionary *result in imageUploadResults) {
      NSString *path = result[@"path"];
      NSString *uploadedFileName = result[@"fileName"];
      NSString *storageId = result[@"storageId"];
      if (path && uploadedFileName) {
        [imagesArray addObject:@{
          @"fileName": uploadedFileName,
          @"path": path,
          @"storageId": storageId ?: @""
        }];
      }
    }

    NSMutableArray *audiosArray = [NSMutableArray array];
    for (NSDictionary *result in audioUploadResults) {
      NSString *path = result[@"path"];
      NSString *uploadedFileName = result[@"fileName"];
      if (path && uploadedFileName) {
        [audiosArray addObject:@{
          @"fileName": uploadedFileName,
          @"path": path
        }];
      }
    }

    NSMutableArray *videosArray = [NSMutableArray array];
    for (NSDictionary *result in videoUploadResults) {
      NSString *path = result[@"path"];
      NSString *uploadedFileName = result[@"fileName"];
      if (path && uploadedFileName) {
        [videosArray addObject:@{
          @"fileName": uploadedFileName,
          @"path": path
        }];
      }
    }

    // Clear all pending attachments
    [self clearAllImageAttachments];
    [self clearAllAudioAttachments];
    [self clearAllVideoAttachments];

    NSLog(@"📤 [ChatView] Sending message with %lu images, %lu audios, %lu videos",
          (unsigned long)imagesArray.count,
          (unsigned long)audiosArray.count,
          (unsigned long)videosArray.count);

    // Send message with all media arrays
    [self sendMessageToBackendWithAllMedia:fullMessage
                               imagesArray:imagesArray
                               audiosArray:audiosArray
                               videosArray:videosArray
                            backendService:backendService];
  });
}

// Send message with all media types (images, audios, videos)
- (void)sendMessageToBackendWithAllMedia:(NSString *)messageText
                             imagesArray:(NSArray *)imagesArray
                             audiosArray:(NSArray *)audiosArray
                             videosArray:(NSArray *)videosArray
                          backendService:(EXChatBackendService *)backendService {

  [backendService sendMessageWithSessionId:self.chatSessionId
                                      role:@"user"
                                   content:messageText
                                    images:imagesArray
                                    audios:audiosArray
                                    videos:videosArray
                                completion:^(NSString * _Nullable messageId, NSError * _Nullable error) {
    dispatch_async(dispatch_get_main_queue(), ^{
      self.isSendingMessage = NO;

      if (error) {
        NSLog(@"❌ Error sending message: %@", error.localizedDescription);
        UIAlertController *alert = [UIAlertController
            alertControllerWithTitle:@"Error"
                             message:@"Failed to send message. Please try again."
                      preferredStyle:UIAlertControllerStyleAlert];
        [alert addAction:[UIAlertAction actionWithTitle:@"OK"
                                                  style:UIAlertActionStyleDefault
                                                handler:nil]];
        UIViewController *topVC = [UIApplication sharedApplication].keyWindow.rootViewController;
        while (topVC.presentedViewController) {
          topVC = topVC.presentedViewController;
        }
        [topVC presentViewController:alert animated:YES completion:nil];
        return;
      }

      NSLog(@"✅ Message sent with media (images: %lu, audios: %lu, videos: %lu): %@",
            (unsigned long)imagesArray.count,
            (unsigned long)audiosArray.count,
            (unsigned long)videosArray.count,
            messageId);

      // CRITICAL: Force scroll to bottom IMMEDIATELY after sending user message
      [self.chatListAdapter scrollToBottom:YES];

      // Trigger AI response
      [backendService getSessionById:self.chatSessionId
                          completion:^(NSDictionary * _Nullable session, NSError * _Nullable error) {
        dispatch_async(dispatch_get_main_queue(), ^{
          if (session) {
            NSString *sessionIdString = session[@"sessionId"];
            NSString *repository = session[@"repository"];

            // Get selected Claude model from NSUserDefaults (only used for Claude agent)
            NSString *selectedModel = [[NSUserDefaults standardUserDefaults] stringForKey:@"SELECTED_CLAUDE_MODEL"];

            [backendService
                triggerAIResponseWithSessionId:sessionIdString
                               convexSessionId:self.chatSessionId
                                       message:messageText
                                    repository:repository
                                         model:selectedModel
                                    completion:^(NSError * _Nullable error) {
              if (error) {
                NSLog(@"❌ Error triggering AI: %@", error.localizedDescription);
              } else {
                NSLog(@"✅ AI response triggered");
              }
            }];
          }
        });
      }];
    });
  }];
}

- (void)sendMessageToBackend:(NSString *)messageText
                 imagesArray:(NSArray *)imagesArray
              backendService:(EXChatBackendService *)backendService {

  [backendService
      sendMessageWithSessionId:self.chatSessionId
                          role:@"user"
                       content:messageText
                        images:imagesArray
                    completion:^(NSString *_Nullable messageId,
                                 NSError *_Nullable error) {
                      dispatch_async(dispatch_get_main_queue(), ^{
                        self.isSendingMessage = NO;

                        if (error) {
                          NSLog(@"❌ Error sending message: %@",
                                error.localizedDescription);
                          UIAlertController *alert = [UIAlertController
                              alertControllerWithTitle:@"Error"
                                               message:
                                                   @"Failed to send message. "
                                                   @"Please try again."
                                        preferredStyle:
                                            UIAlertControllerStyleAlert];
                          [alert
                              addAction:
                                  [UIAlertAction
                                      actionWithTitle:@"OK"
                                                style:UIAlertActionStyleDefault
                                              handler:nil]];
                          UIViewController *topVC =
                              [UIApplication sharedApplication]
                                  .keyWindow.rootViewController;
                          while (topVC.presentedViewController) {
                            topVC = topVC.presentedViewController;
                          }
                          [topVC presentViewController:alert
                                              animated:YES
                                            completion:nil];
                          return;
                        }

                        NSLog(@"✅ Message sent with %lu images: %@", (unsigned long)imagesArray.count, messageId);

                        // CRITICAL: Force scroll to bottom IMMEDIATELY after sending user message
                        // This ensures the user sees their message before the AI responds
                        [self.chatListAdapter scrollToBottom:YES];

                        [backendService
                            getSessionById:self.chatSessionId
                                completion:^(NSDictionary *_Nullable session,
                                             NSError *_Nullable error) {
                                  dispatch_async(dispatch_get_main_queue(), ^{
                                    if (session) {
                                      NSString *sessionIdString =
                                          session[@"sessionId"];
                                      NSString *repository =
                                          session[@"repository"];

                                      // Get selected Claude model from NSUserDefaults (only used for Claude agent)
                                      NSString *selectedModel = nil;
                                      if ([self.billingMode isEqualToString:@"credits"]) {
                                        selectedModel = [[NSUserDefaults standardUserDefaults]
                                            stringForKey:@"SelectedClaudeModel"] ?: @"claude-opus-4-5-20251101";
                                        NSLog(@"🧠 [ChatView] Using Claude model: %@", selectedModel);
                                      }

                                      [backendService
                                          triggerAIResponseWithSessionId:
                                              sessionIdString ?: @""
                                                         convexSessionId:
                                                             self.chatSessionId
                                                                 message:
                                                                     messageText
                                                              repository:
                                                                  repository
                                                                   model:
                                                                       selectedModel
                                                              completion:^(
                                                                  NSError
                                                                      *_Nullable error) {
                                                                if (error) {
                                                                  NSLog(
                                                                      @"⚠️ "
                                                                      @"Error "
                                                                      @"trigger"
                                                                      @"ing AI "
                                                                      @"respons"
                                                                      @"e: %@",
                                                                      error
                                                                          .localizedDescription);
                                                                } else {
                                                                  NSLog(
                                                                      @"✅ AI "
                                                                      @"respons"
                                                                      @"e "
                                                                      @"trigger"
                                                                      @"ed");
                                                                  dispatch_async(dispatch_get_main_queue(), ^{
                                                                    self.isAgentRunning = YES;
                                                                    [self updateSendButtonForAgentState];
                                                                    [self showImmediateWorkingStatus];
                                                                  });
                                                                }
                                                              }];
                                    }
                                  });
                                }];

                        [self loadMessagesForSession:self.chatSessionId];
                      });
                    }];
}

#pragma mark - Status Display

- (void)pollForSessionStatus {
  // Only require session ID - continue polling even when chat is closed
  // to ensure isAgentRunning state is updated (fixes stop button persistence)
  if (!self.chatSessionId || self.chatSessionId.length == 0) {
    return;
  }

  EXChatBackendService *backendService = [EXChatBackendService sharedInstance];
  [backendService getSessionById:self.chatSessionId
                      completion:^(NSDictionary *_Nullable session,
                                   NSError *_Nullable error) {
                        dispatch_async(dispatch_get_main_queue(), ^{
                          if (error || !session) {
                            return;
                          }

                          // Check if status actually changed
                          NSString *newStatus = session[@"status"];
                          NSString *newStatusMessage = session[@"statusMessage"];
                          BOOL statusChanged = NO;

                          if (![newStatus isEqualToString:self.lastSessionStatus]) {
                            statusChanged = YES;
                            self.lastSessionStatus = newStatus;
                          }

                          // Update session
                          self.chatSession = session;

                          // Update app name from session if it changed
                          NSString *sessionName = session[@"name"];
                          if (sessionName && [sessionName isKindOfClass:[NSString class]] && sessionName.length > 0) {
                            if (![sessionName isEqualToString:self.appNameFromConvex]) {
                              [self setAppName:sessionName];
                            }
                          }

                          // Update sandbox ID if present
                          NSString *sandboxSessionId = session[@"sessionId"];
                          if (sandboxSessionId && [sandboxSessionId isKindOfClass:[NSString class]] && sandboxSessionId.length > 0) {
                            self.sandboxId = sandboxSessionId;
                          }

                          // Update isAgentRunning based on status
                          // Agent is running when status is "CUSTOM" (working on a task)
                          // This runs regardless of chat mode to fix stop button persistence
                          BOOL wasAgentRunning = self.isAgentRunning;
                          self.isAgentRunning = [newStatus isEqualToString:@"CUSTOM"];

                          // If agent state changed, update the send button
                          if (wasAgentRunning != self.isAgentRunning) {
                            [self updateSendButtonForAgentState];
                          }

                          // Update chat UI elements if chat is visible and status or agent state changed
                          // CRITICAL: Must update when isAgentRunning changes to clear the status indicator
                          if (self.isChatMode && (statusChanged || wasAgentRunning != self.isAgentRunning)) {
                            [self updateStatusDisplay];
                          }
                          // Don't call refreshChatMessagesView here - it destroys loaded images
                        });
                      }];
}

- (void)showImmediateWorkingStatus {
  // Immediately show a "Working..." status via the adapter
  // This provides instant feedback after sending a message
  // NOTE: We no longer use the old statusContainer UIView - the adapter handles this now

  // Update the adapter's status - it will show EXChatStatusNode
  [self.chatListAdapter updateStatusMessage:@"Working on task" isWorking:YES];

  // CRITICAL: Always force scroll to bottom after showing working status
  // This ensures user's message is visible above the status indicator
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.15 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
    [self.chatListAdapter scrollToBottom:YES];
  });
}

- (void)updateStatusDisplay {
  // Status is now handled by EXChatStatusNode in the adapter
  // This method is called during polling but we delegate to the adapter
  if (!self.chatSession) {
    return;
  }

  NSString *status = self.chatSession[@"status"];

  // Determine if agent is actively working
  BOOL isWorking = status && ([status isEqualToString:@"CUSTOM"] ||
                               [status isEqualToString:@"IN_PROGRESS"] ||
                               [status isEqualToString:@"CLONING_REPO"] ||
                               [status isEqualToString:@"INSTALLING_DEPENDENCIES"] ||
                               [status isEqualToString:@"STARTING_DEV_SERVER"] ||
                               [status isEqualToString:@"CREATING_TUNNEL"]);

  // Get status message
  NSString *statusMessage = self.chatSession[@"statusMessage"];
  if (!statusMessage || statusMessage.length == 0) {
    if ([status isEqualToString:@"CUSTOM"]) {
      statusMessage = @"Working on task";
    } else if ([status isEqualToString:@"IN_PROGRESS"]) {
      statusMessage = @"Initializing";
    } else if ([status isEqualToString:@"CLONING_REPO"]) {
      statusMessage = @"Cloning repository";
    } else if ([status isEqualToString:@"INSTALLING_DEPENDENCIES"]) {
      statusMessage = @"Installing dependencies";
    } else if ([status isEqualToString:@"STARTING_DEV_SERVER"]) {
      statusMessage = @"Starting development server";
    } else if ([status isEqualToString:@"CREATING_TUNNEL"]) {
      statusMessage = @"Creating tunnel";
    } else {
      statusMessage = @"Processing";
    }
  }

  // Update the adapter - it will handle showing/hiding the EXChatStatusNode
  [self.chatListAdapter updateStatusMessage:statusMessage isWorking:isWorking];

  // Clean up old statusContainer if it exists (legacy)
  if (self.statusContainer) {
    [self.statusContainer removeFromSuperview];
    self.statusContainer = nil;
  }
}

- (void)positionStatusContainerAfterMessages {
  if (!self.statusContainer || !self.chatScrollView) {
    return;
  }

  UIView *contentView = self.chatScrollView.subviews.firstObject;
  if (!contentView) {
    return;
  }

  // Force layout to get accurate frames
  [contentView layoutIfNeeded];

  // Find the bottom-most subview (excluding status container and system labels)
  CGFloat maxY = 0;
  for (UIView *subview in contentView.subviews) {
    // Skip status container, empty label (9999), and loading label (9998)
    if (subview == self.statusContainer || subview.tag == 9999 || subview.tag == 9998) {
      continue;
    }
    CGFloat bottom = CGRectGetMaxY(subview.frame);
    if (bottom > maxY) {
      maxY = bottom;
    }
  }

  // Ensure status container is in content view
  if (self.statusContainer.superview != contentView) {
    [contentView addSubview:self.statusContainer];
  }
  [contentView bringSubviewToFront:self.statusContainer];

  // Remove any existing position constraints on status container
  NSMutableArray *constraintsToRemove = [NSMutableArray array];
  for (NSLayoutConstraint *constraint in contentView.constraints) {
    if (constraint.firstItem == self.statusContainer || constraint.secondItem == self.statusContainer) {
      if (constraint.firstAttribute == NSLayoutAttributeTop ||
          constraint.firstAttribute == NSLayoutAttributeLeading ||
          constraint.firstAttribute == NSLayoutAttributeTrailing ||
          constraint.firstAttribute == NSLayoutAttributeHeight ||
          constraint.firstAttribute == NSLayoutAttributeWidth) {
        [constraintsToRemove addObject:constraint];
      }
    }
  }
  [NSLayoutConstraint deactivateConstraints:constraintsToRemove];

  // Position status container after last message using maxY
  self.statusContainer.translatesAutoresizingMaskIntoConstraints = NO;

  // Use frame-based positioning for more reliable placement
  CGFloat statusY = maxY > 0 ? maxY + 8 : 28; // 28 is initial padding if no messages
  CGFloat statusHeight = [self isIPad] ? 48 : 40;

  [NSLayoutConstraint activateConstraints:@[
    [self.statusContainer.leadingAnchor constraintEqualToAnchor:contentView.leadingAnchor constant:0],
    [self.statusContainer.trailingAnchor constraintEqualToAnchor:contentView.trailingAnchor constant:0],
    [self.statusContainer.topAnchor constraintEqualToAnchor:contentView.topAnchor constant:statusY],
    [self.statusContainer.heightAnchor constraintEqualToConstant:statusHeight]
  ]];

  [contentView layoutIfNeeded];

  // Update content view height constraint instead of manipulating frames directly
  CGFloat newContentHeight = statusY + statusHeight + 20;
  if (self.contentViewHeightConstraint && self.isChatMode) {
    if (newContentHeight > self.contentViewHeightConstraint.constant) {
      self.contentViewHeightConstraint.constant = newContentHeight;
    }
  }

  [contentView layoutIfNeeded];

  // Scroll to show status (only if user is near bottom, animated)
  [self scrollChatToBottomIfNeeded:YES animated:YES];
}

#pragma mark - UIScrollViewDelegate

- (void)scrollViewDidScroll:(UIScrollView *)scrollView {
  // Check if user scrolled near the top (within 100px) and there are more messages to load
  // Use debounce flag to prevent multiple rapid refreshes
  if (scrollView.contentOffset.y < 100 &&
      self.chatMessages.count > self.displayedMessageCount &&
      !self.isLoadingMoreMessages) {

    // Set debounce flag immediately
    self.isLoadingMoreMessages = YES;

    // Store scroll position before refresh
    CGFloat oldContentHeight = scrollView.contentSize.height;
    CGFloat oldOffsetY = scrollView.contentOffset.y;

    // Delay the load to prevent rapid consecutive calls during scroll
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.15 * NSEC_PER_SEC)),
                   dispatch_get_main_queue(), ^{
      // Double-check we still need to load more
      if (self.chatMessages.count > self.displayedMessageCount) {
        // Load more messages (increase displayed count by 50)
        NSInteger newCount = MIN(self.displayedMessageCount + 50, self.chatMessages.count);

        if (newCount > self.displayedMessageCount) {
          self.displayedMessageCount = newCount;

          // Refresh messages view
          [self refreshChatMessagesView];

          // Restore scroll position after layout
          dispatch_async(dispatch_get_main_queue(), ^{
            CGFloat newContentHeight = scrollView.contentSize.height;
            CGFloat heightDifference = newContentHeight - oldContentHeight;
            if (heightDifference > 0) {
              scrollView.contentOffset = CGPointMake(0, oldOffsetY + heightDifference);
            }

            // Clear debounce flag after a short delay to prevent immediate re-trigger
            dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.3 * NSEC_PER_SEC)),
                           dispatch_get_main_queue(), ^{
              self.isLoadingMoreMessages = NO;
            });
          });
        } else {
          self.isLoadingMoreMessages = NO;
        }
      } else {
        self.isLoadingMoreMessages = NO;
      }
    });
  }
}

#pragma mark - EXChatListAdapterDelegate

- (void)chatListDidRequestRefresh {
  // Refresh messages from backend
  if (self.chatSessionId) {
    [self lookupSessionAndLoadMessagesWithErrorHandler:^(NSError *error) {
      if (error) {
        NSLog(@"❌ [ChatList] Failed to refresh messages: %@", error);
      }
    }];
  }
}

- (void)chatListDidTapGroup:(NSString *)groupId {
  NSLog(@"🔄 [ChatView] chatListDidTapGroup: %@", groupId);

  // Debounce: prevent rapid taps on same group (300ms minimum between taps)
  NSTimeInterval now = [[NSDate date] timeIntervalSince1970];
  if ([self.lastToggledGroupId isEqualToString:groupId] && (now - self.lastGroupToggleTime < 0.3)) {
    NSLog(@"🔄 [ChatView] Group toggle debounced - too fast for same group");
    return;
  }
  self.lastGroupToggleTime = now;
  self.lastToggledGroupId = groupId;

  // Toggle group expansion state locally
  if (!self.expandedGroups) {
    self.expandedGroups = [NSMutableDictionary dictionary];
  }

  // CRITICAL FIX: Determine current expanded state correctly
  // If user has explicitly set a state before, use that.
  // Otherwise, check if this is the latest expandable group (which defaults to expanded).
  BOOL currentlyExpanded;
  if (self.expandedGroups[groupId] != nil) {
    // User has explicitly set this before
    currentlyExpanded = [self.expandedGroups[groupId] boolValue];
  } else {
    // First time toggling - check if it's the latest (which defaults to expanded)
    currentlyExpanded = [groupId isEqualToString:self.latestExpandableGroupId];
  }

  self.expandedGroups[groupId] = @(!currentlyExpanded);

  // Use targeted toggle method instead of full refresh
  // This is much more efficient and avoids race conditions
  [self.chatListAdapter toggleGroupExpanded:groupId];
}

- (void)chatListDidScrollToTop {
  // Load more messages when scrolled to top
  if (self.chatMessages.count > self.displayedMessageCount && !self.isLoadingMoreMessages) {
    self.isLoadingMoreMessages = YES;

    NSInteger newCount = MIN(self.displayedMessageCount + 50, self.chatMessages.count);
    if (newCount > self.displayedMessageCount) {
      self.displayedMessageCount = newCount;
      [self refreshChatMessagesView];
    }

    // Clear debounce flag after a short delay
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.3 * NSEC_PER_SEC)),
                   dispatch_get_main_queue(), ^{
      self.isLoadingMoreMessages = NO;
    });
  }
}

#pragma mark - Billing Enforcement

- (void)checkBillingStatusWithCompletion:(void (^)(BOOL canSend))completion {
  // Get clerkId from session (createdBy field)
  NSString *clerkId = self.chatSession[@"createdBy"];

  if (!clerkId || clerkId.length == 0) {
    NSLog(@"⚠️ [Billing] No clerkId in session, allowing message (fail-open)");
    self.canSendMessage = YES;
    self.billingMode = @"tokens";
    self.billingRemaining = nil;
    self.billingBlockReason = nil;
    if (completion) {
      completion(YES);
    }
    return;
  }

  EXChatBackendService *backendService = [EXChatBackendService sharedInstance];
  [backendService checkBillingLimitForClerkId:clerkId
                                   completion:^(BOOL canSend, NSString * _Nullable reason, NSString * _Nullable billingMode, NSNumber * _Nullable remaining, NSError * _Nullable error) {
    dispatch_async(dispatch_get_main_queue(), ^{
      self.canSendMessage = canSend;
      self.billingMode = billingMode ?: @"tokens";
      self.billingRemaining = remaining;
      self.billingBlockReason = reason;

      NSLog(@"💳 [Billing] Status updated: canSend=%@, mode=%@, remaining=%@, reason=%@",
            canSend ? @"YES" : @"NO", self.billingMode, remaining, reason ?: @"nil");

      // Update UI based on billing status
      [self updateUIForBillingStatus];

      if (completion) {
        completion(canSend);
      }
    });
  }];
}

- (void)updateUIForBillingStatus {
  // Update input field appearance based on billing status
  if (!self.canSendMessage) {
    // User is blocked - show subtle warning with nice styling
    if (self.inputTextView) {
      // Subtle amber/orange gradient border instead of harsh red
      self.inputTextView.layer.borderColor = [UIColor colorWithRed:0.9 green:0.6 blue:0.2 alpha:0.6].CGColor;
      self.inputTextView.layer.borderWidth = 1.5;
      self.inputTextView.layer.cornerRadius = 12;
      self.inputTextView.backgroundColor = [UIColor colorWithRed:0.15 green:0.12 blue:0.1 alpha:0.5];

      // Update placeholder based on billing mode
      NSString *placeholder = [self.billingMode isEqualToString:@"credits"]
        ? @"Out of credits - upgrade to continue"
        : @"Out of tokens - upgrade to continue";

      // If inputTextView is empty, show the placeholder-like text
      if (self.inputTextView.text.length == 0) {
        self.inputTextView.text = @"";
        self.inputTextView.textColor = [UIColor colorWithRed:0.9 green:0.7 blue:0.5 alpha:0.8];
      }
    }

    // Also update the input field if it exists
    if (self.chatInputField) {
      self.chatInputField.layer.borderColor = [UIColor colorWithRed:0.9 green:0.6 blue:0.2 alpha:0.6].CGColor;
      self.chatInputField.layer.borderWidth = 1.5;
      self.chatInputField.layer.cornerRadius = 12;
      self.chatInputField.backgroundColor = [UIColor colorWithRed:0.15 green:0.12 blue:0.1 alpha:0.5];
      self.chatInputField.placeholder = [self.billingMode isEqualToString:@"credits"]
        ? @"Out of credits - upgrade to continue"
        : @"Out of tokens - upgrade to continue";
    }

    // Disable send button with amber color
    if (self.sendButton) {
      self.sendButton.enabled = NO;
      self.sendButton.alpha = 0.6;
      self.sendButton.backgroundColor = [UIColor colorWithRed:0.3 green:0.25 blue:0.2 alpha:1.0];
    }

    NSLog(@"🟠 [Billing] UI updated to blocked state (styled)");
  } else {
    // User can send - restore normal appearance (no border)
    if (self.inputTextView) {
      self.inputTextView.layer.borderColor = [UIColor clearColor].CGColor;
      self.inputTextView.layer.borderWidth = 0;
      self.inputTextView.backgroundColor = [UIColor clearColor];
      self.inputTextView.textColor = [UIColor whiteColor];
    }

    if (self.chatInputField) {
      self.chatInputField.layer.borderColor = [UIColor clearColor].CGColor;
      self.chatInputField.layer.borderWidth = 0;
      self.chatInputField.backgroundColor = [UIColor clearColor];
      self.chatInputField.placeholder = @"Message";
    }

    // Enable send button
    if (self.sendButton) {
      self.sendButton.enabled = YES;
      self.sendButton.alpha = 1.0;
      self.sendButton.backgroundColor = [UIColor whiteColor];
    }

    NSLog(@"🟢 [Billing] UI updated to normal state");
  }

  // Update model selector visibility and position based on billing mode
  [self updateBottomBarForKeyboardVisible:self.isKeyboardVisible];
}

- (void)showBillingLimitReachedAlert {
  NSString *title = @"Message Limit Reached";
  NSString *message = [self.billingMode isEqualToString:@"credits"]
    ? @"You've used all your credits. Upgrade your plan to continue chatting."
    : @"You've used all your tokens. Upgrade your plan to continue chatting.";

  UIAlertController *alert = [UIAlertController alertControllerWithTitle:title
                                                                 message:message
                                                          preferredStyle:UIAlertControllerStyleAlert];

  [alert addAction:[UIAlertAction actionWithTitle:@"Cancel"
                                            style:UIAlertActionStyleCancel
                                          handler:nil]];

  [alert addAction:[UIAlertAction actionWithTitle:@"Upgrade"
                                            style:UIAlertActionStyleDefault
                                          handler:^(UIAlertAction * _Nonnull action) {
    // Post notification to open upgrade screen
    // The React Native side should handle this notification
    [[NSNotificationCenter defaultCenter] postNotificationName:@"OpenUpgradeScreen" object:nil];

    NSLog(@"💰 [Billing] User tapped Upgrade button");
  }]];

  // Present the alert
  UIWindow *window = [UIApplication sharedApplication].keyWindow;
  UIViewController *rootVC = window.rootViewController;
  while (rootVC.presentedViewController) {
    rootVC = rootVC.presentedViewController;
  }
  [rootVC presentViewController:alert animated:YES completion:nil];
}

@end
