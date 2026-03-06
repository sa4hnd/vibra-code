// Copyright 2015-present 650 Industries. All rights reserved.

#import "EXPreviewZoomManager+Private.h"
#import "EXPreviewZoomManager.h"
#import "EXChatBackendService.h"
#import <UIKit/UIKit.h>

// Forward declarations
@class EXLogsModalViewController;

// Logs Modal View Controller
@interface EXLogsModalViewController : UIViewController <UIAdaptivePresentationControllerDelegate>

@property(nonatomic, weak) EXPreviewZoomManager *manager;
@property(nonatomic, strong) UITextView *logsTextView;
@property(nonatomic, strong) UILabel *titleLabel;
@property(nonatomic, strong) UILabel *updatedLabel;
@property(nonatomic, strong) UIButton *closeButton;
@property(nonatomic, strong) UIButton *refreshButton;
@property(nonatomic, strong) UIButton *addToPromptButton;
@property(nonatomic, strong) UIActivityIndicatorView *loadingIndicator;
@property(nonatomic, strong) UIVisualEffectView *backgroundView;
@property(nonatomic, strong) UIView *headerView;
@property(nonatomic, strong) UIView *footerView;
@property(nonatomic, strong) NSDate *lastUpdated;
@property(nonatomic, strong) NSString *logsContent;

- (instancetype)initWithManager:(EXPreviewZoomManager *)manager;

@end

// Category implementation
@implementation EXPreviewZoomManager (LogsModal)

- (void)showLogsModal {
  if (self.logsModalPresented) {
    return;
  }

  UIWindow *window = [UIApplication sharedApplication].keyWindow;
  if (!window || !window.rootViewController) {
    return;
  }

  UIViewController *topVC = window.rootViewController;
  while (topVC.presentedViewController) {
    topVC = topVC.presentedViewController;
  }

  EXLogsModalViewController *modalVC = [[EXLogsModalViewController alloc] initWithManager:self];

  UINavigationController *navController = [[UINavigationController alloc] initWithRootViewController:modalVC];
  navController.view.backgroundColor = [UIColor clearColor];
  navController.navigationBarHidden = YES;

  self.logsModalViewController = navController;

  navController.modalPresentationStyle = UIModalPresentationPageSheet;
  if (@available(iOS 15.0, *)) {
    UISheetPresentationController *sheet = navController.sheetPresentationController;
    if (sheet) {
      sheet.detents = @[[UISheetPresentationControllerDetent largeDetent]];
      sheet.selectedDetentIdentifier = UISheetPresentationControllerDetentIdentifierLarge;
      sheet.preferredCornerRadius = 28.0;
      sheet.prefersGrabberVisible = YES;
      sheet.prefersEdgeAttachedInCompactHeight = YES;
      sheet.widthFollowsPreferredContentSizeWhenEdgeAttached = YES;
    }
  }

  navController.presentationController.delegate = modalVC;

  [topVC presentViewController:navController animated:YES completion:nil];
  self.logsModalPresented = YES;
}

@end

// MARK: - EXLogsModalViewController Implementation

@implementation EXLogsModalViewController

- (instancetype)initWithManager:(EXPreviewZoomManager *)manager {
  self = [super init];
  if (self) {
    _manager = manager;
    _logsContent = @"";
    _lastUpdated = nil;
  }
  return self;
}

- (void)viewDidLoad {
  [super viewDidLoad];

  self.view.backgroundColor = [UIColor clearColor];

  [self setupBackground];
  [self setupHeader];
  [self setupLogsView];
  [self setupFooter];
  [self setupConstraints];

  [self loadLogs];
}

- (void)viewWillAppear:(BOOL)animated {
  [super viewWillAppear:animated];
  [self.navigationController setNavigationBarHidden:YES animated:animated];
}

- (void)presentationControllerDidDismiss:(UIPresentationController *)presentationController {
  self.manager.logsModalPresented = NO;
}

#pragma mark - Setup Methods

- (void)setupBackground {
  UIVisualEffect *glassEffect = nil;
  if (@available(iOS 26.0, *)) {
    Class glassEffectClass = NSClassFromString(@"UIGlassEffect");
    if (glassEffectClass) {
      SEL effectSelector = NSSelectorFromString(@"effectWithStyle:");
      if ([glassEffectClass respondsToSelector:effectSelector]) {
        NSMethodSignature *signature = [glassEffectClass methodSignatureForSelector:effectSelector];
        NSInvocation *invocation = [NSInvocation invocationWithMethodSignature:signature];
        [invocation setSelector:effectSelector];
        [invocation setTarget:glassEffectClass];
        NSInteger style = 0;
        [invocation setArgument:&style atIndex:2];
        [invocation invoke];
        void *tempResult;
        [invocation getReturnValue:&tempResult];
        glassEffect = (__bridge id)tempResult;

        if (glassEffect && [glassEffect respondsToSelector:@selector(setInteractive:)]) {
          SEL setInteractiveSelector = @selector(setInteractive:);
          NSMethodSignature *setSig = [glassEffect methodSignatureForSelector:setInteractiveSelector];
          NSInvocation *setInvocation = [NSInvocation invocationWithMethodSignature:setSig];
          [setInvocation setSelector:setInteractiveSelector];
          [setInvocation setTarget:glassEffect];
          BOOL interactive = YES;
          [setInvocation setArgument:&interactive atIndex:2];
          [setInvocation invoke];
        }

        if (glassEffect && [glassEffect respondsToSelector:@selector(setTintColor:)]) {
          UIColor *darkTint = [UIColor colorWithRed:0.06 green:0.06 blue:0.08 alpha:1.0];
          [glassEffect setValue:darkTint forKey:@"tintColor"];
        }
      }
    }
  }

  if (!glassEffect) {
    if (@available(iOS 13.0, *)) {
      glassEffect = [UIBlurEffect effectWithStyle:UIBlurEffectStyleSystemChromeMaterialDark];
    } else {
      glassEffect = [UIBlurEffect effectWithStyle:UIBlurEffectStyleDark];
    }
  }

  self.backgroundView = [[UIVisualEffectView alloc] initWithEffect:glassEffect];
  self.backgroundView.translatesAutoresizingMaskIntoConstraints = NO;
  [self.view insertSubview:self.backgroundView atIndex:0];

  [NSLayoutConstraint activateConstraints:@[
    [self.backgroundView.topAnchor constraintEqualToAnchor:self.view.topAnchor],
    [self.backgroundView.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor],
    [self.backgroundView.trailingAnchor constraintEqualToAnchor:self.view.trailingAnchor],
    [self.backgroundView.bottomAnchor constraintEqualToAnchor:self.view.bottomAnchor]
  ]];
}

- (void)setupHeader {
  self.headerView = [[UIView alloc] init];
  self.headerView.translatesAutoresizingMaskIntoConstraints = NO;
  self.headerView.backgroundColor = [UIColor clearColor];
  [self.view addSubview:self.headerView];

  // Title with terminal icon
  UIImageSymbolConfiguration *terminalConfig = [UIImageSymbolConfiguration configurationWithPointSize:22 weight:UIImageSymbolWeightBold];
  UIImage *terminalImage = [UIImage systemImageNamed:@"terminal.fill" withConfiguration:terminalConfig];
  UIImageView *terminalIcon = [[UIImageView alloc] initWithImage:terminalImage];
  terminalIcon.tintColor = [UIColor colorWithRed:0.35 green:0.85 blue:0.55 alpha:1.0];
  terminalIcon.translatesAutoresizingMaskIntoConstraints = NO;
  [self.headerView addSubview:terminalIcon];

  self.titleLabel = [[UILabel alloc] init];
  self.titleLabel.text = @"Expo Logs";
  self.titleLabel.textColor = [UIColor whiteColor];
  self.titleLabel.font = [UIFont systemFontOfSize:22 weight:UIFontWeightBold];
  self.titleLabel.translatesAutoresizingMaskIntoConstraints = NO;
  [self.headerView addSubview:self.titleLabel];

  // Updated label
  self.updatedLabel = [[UILabel alloc] init];
  self.updatedLabel.text = @"Loading...";
  self.updatedLabel.textColor = [UIColor colorWithWhite:0.5 alpha:1.0];
  self.updatedLabel.font = [UIFont systemFontOfSize:12 weight:UIFontWeightMedium];
  self.updatedLabel.translatesAutoresizingMaskIntoConstraints = NO;
  [self.headerView addSubview:self.updatedLabel];

  // Refresh button
  self.refreshButton = [UIButton buttonWithType:UIButtonTypeSystem];
  self.refreshButton.translatesAutoresizingMaskIntoConstraints = NO;
  self.refreshButton.backgroundColor = [UIColor colorWithWhite:0.2 alpha:0.8];
  self.refreshButton.layer.cornerRadius = 16;
  self.refreshButton.clipsToBounds = YES;

  UIImageSymbolConfiguration *refreshConfig = [UIImageSymbolConfiguration configurationWithPointSize:14 weight:UIImageSymbolWeightBold];
  UIImage *refreshImage = [UIImage systemImageNamed:@"arrow.clockwise" withConfiguration:refreshConfig];
  [self.refreshButton setImage:refreshImage forState:UIControlStateNormal];
  self.refreshButton.tintColor = [UIColor colorWithWhite:0.8 alpha:1.0];
  [self.refreshButton addTarget:self action:@selector(refreshTapped:) forControlEvents:UIControlEventTouchUpInside];
  [self.headerView addSubview:self.refreshButton];

  // Close button
  self.closeButton = [UIButton buttonWithType:UIButtonTypeSystem];
  self.closeButton.translatesAutoresizingMaskIntoConstraints = NO;
  self.closeButton.backgroundColor = [UIColor colorWithWhite:0.2 alpha:0.8];
  self.closeButton.layer.cornerRadius = 16;
  self.closeButton.clipsToBounds = YES;

  UIImageSymbolConfiguration *closeConfig = [UIImageSymbolConfiguration configurationWithPointSize:12 weight:UIImageSymbolWeightBold];
  UIImage *closeImage = [UIImage systemImageNamed:@"xmark" withConfiguration:closeConfig];
  [self.closeButton setImage:closeImage forState:UIControlStateNormal];
  self.closeButton.tintColor = [UIColor colorWithWhite:0.7 alpha:1.0];
  [self.closeButton addTarget:self action:@selector(closeTapped:) forControlEvents:UIControlEventTouchUpInside];
  [self.headerView addSubview:self.closeButton];

  [NSLayoutConstraint activateConstraints:@[
    [self.headerView.topAnchor constraintEqualToAnchor:self.view.safeAreaLayoutGuide.topAnchor constant:8],
    [self.headerView.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor],
    [self.headerView.trailingAnchor constraintEqualToAnchor:self.view.trailingAnchor],
    [self.headerView.heightAnchor constraintEqualToConstant:60],

    [terminalIcon.leadingAnchor constraintEqualToAnchor:self.headerView.leadingAnchor constant:20],
    [terminalIcon.topAnchor constraintEqualToAnchor:self.headerView.topAnchor constant:8],
    [terminalIcon.widthAnchor constraintEqualToConstant:26],
    [terminalIcon.heightAnchor constraintEqualToConstant:26],

    [self.titleLabel.leadingAnchor constraintEqualToAnchor:terminalIcon.trailingAnchor constant:12],
    [self.titleLabel.centerYAnchor constraintEqualToAnchor:terminalIcon.centerYAnchor],

    [self.updatedLabel.leadingAnchor constraintEqualToAnchor:self.headerView.leadingAnchor constant:20],
    [self.updatedLabel.topAnchor constraintEqualToAnchor:terminalIcon.bottomAnchor constant:4],

    [self.closeButton.trailingAnchor constraintEqualToAnchor:self.headerView.trailingAnchor constant:-20],
    [self.closeButton.topAnchor constraintEqualToAnchor:self.headerView.topAnchor constant:8],
    [self.closeButton.widthAnchor constraintEqualToConstant:32],
    [self.closeButton.heightAnchor constraintEqualToConstant:32],

    [self.refreshButton.trailingAnchor constraintEqualToAnchor:self.closeButton.leadingAnchor constant:-12],
    [self.refreshButton.centerYAnchor constraintEqualToAnchor:self.closeButton.centerYAnchor],
    [self.refreshButton.widthAnchor constraintEqualToConstant:32],
    [self.refreshButton.heightAnchor constraintEqualToConstant:32]
  ]];
}

- (void)setupLogsView {
  // Container with rounded corners
  UIView *logsContainer = [[UIView alloc] init];
  logsContainer.translatesAutoresizingMaskIntoConstraints = NO;
  logsContainer.backgroundColor = [UIColor colorWithWhite:0.05 alpha:0.9];
  logsContainer.layer.cornerRadius = 16;
  logsContainer.layer.borderWidth = 1;
  logsContainer.layer.borderColor = [UIColor colorWithWhite:0.15 alpha:0.5].CGColor;
  logsContainer.clipsToBounds = YES;
  logsContainer.tag = 100; // Tag for finding later
  [self.view addSubview:logsContainer];

  // Logs text view
  self.logsTextView = [[UITextView alloc] init];
  self.logsTextView.translatesAutoresizingMaskIntoConstraints = NO;
  self.logsTextView.backgroundColor = [UIColor clearColor];
  self.logsTextView.textColor = [UIColor colorWithWhite:0.88 alpha:1.0];
  self.logsTextView.font = [UIFont monospacedSystemFontOfSize:12 weight:UIFontWeightRegular];
  self.logsTextView.editable = NO;
  self.logsTextView.showsVerticalScrollIndicator = YES;
  self.logsTextView.indicatorStyle = UIScrollViewIndicatorStyleWhite;
  self.logsTextView.textContainerInset = UIEdgeInsetsMake(12, 12, 12, 12);
  [logsContainer addSubview:self.logsTextView];

  // Loading indicator
  self.loadingIndicator = [[UIActivityIndicatorView alloc] initWithActivityIndicatorStyle:UIActivityIndicatorViewStyleMedium];
  self.loadingIndicator.translatesAutoresizingMaskIntoConstraints = NO;
  self.loadingIndicator.color = [UIColor colorWithRed:0.35 green:0.85 blue:0.55 alpha:1.0];
  self.loadingIndicator.hidesWhenStopped = YES;
  [logsContainer addSubview:self.loadingIndicator];

  [NSLayoutConstraint activateConstraints:@[
    [self.logsTextView.topAnchor constraintEqualToAnchor:logsContainer.topAnchor],
    [self.logsTextView.leadingAnchor constraintEqualToAnchor:logsContainer.leadingAnchor],
    [self.logsTextView.trailingAnchor constraintEqualToAnchor:logsContainer.trailingAnchor],
    [self.logsTextView.bottomAnchor constraintEqualToAnchor:logsContainer.bottomAnchor],

    [self.loadingIndicator.centerXAnchor constraintEqualToAnchor:logsContainer.centerXAnchor],
    [self.loadingIndicator.centerYAnchor constraintEqualToAnchor:logsContainer.centerYAnchor]
  ]];
}

- (void)setupFooter {
  self.footerView = [[UIView alloc] init];
  self.footerView.translatesAutoresizingMaskIntoConstraints = NO;
  self.footerView.backgroundColor = [UIColor clearColor];
  [self.view addSubview:self.footerView];

  // Add to prompt button
  self.addToPromptButton = [UIButton buttonWithType:UIButtonTypeSystem];
  self.addToPromptButton.translatesAutoresizingMaskIntoConstraints = NO;
  self.addToPromptButton.backgroundColor = [UIColor colorWithRed:0.25 green:0.65 blue:0.45 alpha:1.0];
  self.addToPromptButton.layer.cornerRadius = 12;
  self.addToPromptButton.clipsToBounds = YES;

  if (@available(iOS 15.0, *)) {
    UIButtonConfiguration *config = [UIButtonConfiguration filledButtonConfiguration];
    config.title = @"Add to prompt";
    config.image = [UIImage systemImageNamed:@"plus.circle.fill"
                          withConfiguration:[UIImageSymbolConfiguration configurationWithPointSize:16 weight:UIImageSymbolWeightMedium]];
    config.imagePlacement = NSDirectionalRectEdgeLeading;
    config.imagePadding = 8;
    config.baseBackgroundColor = [UIColor colorWithRed:0.25 green:0.65 blue:0.45 alpha:1.0];
    config.baseForegroundColor = [UIColor whiteColor];
    config.cornerStyle = UIButtonConfigurationCornerStyleMedium;
    self.addToPromptButton.configuration = config;
  } else {
    [self.addToPromptButton setTitle:@"Add to prompt" forState:UIControlStateNormal];
    [self.addToPromptButton setImage:[UIImage systemImageNamed:@"plus.circle.fill"] forState:UIControlStateNormal];
    self.addToPromptButton.tintColor = [UIColor whiteColor];
    [self.addToPromptButton setTitleColor:[UIColor whiteColor] forState:UIControlStateNormal];
    self.addToPromptButton.titleLabel.font = [UIFont systemFontOfSize:16 weight:UIFontWeightSemibold];
  }

  [self.addToPromptButton addTarget:self action:@selector(addToPromptTapped:) forControlEvents:UIControlEventTouchUpInside];
  [self.footerView addSubview:self.addToPromptButton];

  [NSLayoutConstraint activateConstraints:@[
    [self.addToPromptButton.topAnchor constraintEqualToAnchor:self.footerView.topAnchor constant:12],
    [self.addToPromptButton.leadingAnchor constraintEqualToAnchor:self.footerView.leadingAnchor constant:16],
    [self.addToPromptButton.trailingAnchor constraintEqualToAnchor:self.footerView.trailingAnchor constant:-16],
    [self.addToPromptButton.heightAnchor constraintEqualToConstant:48]
  ]];
}

- (void)setupConstraints {
  UIView *logsContainer = [self.view viewWithTag:100];

  [NSLayoutConstraint activateConstraints:@[
    [logsContainer.topAnchor constraintEqualToAnchor:self.headerView.bottomAnchor constant:12],
    [logsContainer.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor constant:16],
    [logsContainer.trailingAnchor constraintEqualToAnchor:self.view.trailingAnchor constant:-16],
    [logsContainer.bottomAnchor constraintEqualToAnchor:self.footerView.topAnchor constant:-12],

    [self.footerView.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor],
    [self.footerView.trailingAnchor constraintEqualToAnchor:self.view.trailingAnchor],
    [self.footerView.bottomAnchor constraintEqualToAnchor:self.view.safeAreaLayoutGuide.bottomAnchor constant:-12],
    [self.footerView.heightAnchor constraintEqualToConstant:72]
  ]];
}

#pragma mark - Actions

- (void)closeTapped:(UIButton *)sender {
  [self dismissViewControllerAnimated:YES completion:^{
    self.manager.logsModalPresented = NO;
  }];
}

- (void)refreshTapped:(UIButton *)sender {
  // Animate the refresh button
  [UIView animateWithDuration:0.3 animations:^{
    self.refreshButton.transform = CGAffineTransformMakeRotation(M_PI);
  } completion:^(BOOL finished) {
    [UIView animateWithDuration:0.3 animations:^{
      self.refreshButton.transform = CGAffineTransformIdentity;
    }];
  }];

  [self loadLogs];
}

- (void)addToPromptTapped:(UIButton *)sender {
  // Insert @expo_logs.txt tag into the chat input
  if ([self.manager respondsToSelector:@selector(insertAPITag:)]) {
    [self.manager performSelector:@selector(insertAPITag:) withObject:@"expo_logs.txt"];
  }

  // Dismiss modal
  [self dismissViewControllerAnimated:YES completion:^{
    self.manager.logsModalPresented = NO;
  }];
}

#pragma mark - Data Loading

- (void)loadLogs {
  NSString *sandboxId = self.manager.sandboxId;

  if (!sandboxId || sandboxId.length == 0) {
    // Try to get sandbox ID from session
    NSString *convexId = self.manager.chatSessionId;
    if (!convexId || convexId.length == 0) {
      [self showError:@"No session available"];
      return;
    }

    [self.loadingIndicator startAnimating];
    self.logsTextView.text = @"";
    self.updatedLabel.text = @"Loading...";

    [[EXChatBackendService sharedInstance] getSessionById:convexId completion:^(NSDictionary *session, NSError *error) {
      dispatch_async(dispatch_get_main_queue(), ^{
        if (error || !session) {
          [self.loadingIndicator stopAnimating];
          [self showError:@"Failed to load session"];
          return;
        }

        NSString *sessionSandboxId = session[@"sessionId"];
        if ([sessionSandboxId isKindOfClass:[NSString class]] && sessionSandboxId.length > 0) {
          self.manager.sandboxId = sessionSandboxId;
          [self fetchLogsWithSandboxId:sessionSandboxId];
        } else {
          [self.loadingIndicator stopAnimating];
          [self showError:@"No sandbox ID available"];
        }
      });
    }];
    return;
  }

  [self fetchLogsWithSandboxId:sandboxId];
}

- (void)fetchLogsWithSandboxId:(NSString *)sandboxId {
  [self.loadingIndicator startAnimating];
  self.updatedLabel.text = @"Loading...";

  NSString *logsPath = @"/vibe0/expo_logs.txt";

  [[EXChatBackendService sharedInstance] readFileAtPath:logsPath sessionId:sandboxId completion:^(NSString *content, NSError *error) {
    dispatch_async(dispatch_get_main_queue(), ^{
      [self.loadingIndicator stopAnimating];

      if (error) {
        [self showError:[NSString stringWithFormat:@"Error: %@", error.localizedDescription]];
        return;
      }

      if (!content || content.length == 0) {
        [self showError:@"No logs available yet"];
        return;
      }

      self.logsContent = content;
      self.lastUpdated = [NSDate date];
      [self displayLogs:content];
      [self updateTimestamp];
    });
  }];
}

- (void)displayLogs:(NSString *)content {
  // Split content into lines and add line numbers
  NSArray *lines = [content componentsSeparatedByString:@"\n"];
  NSMutableAttributedString *attributed = [[NSMutableAttributedString alloc] init];

  UIFont *lineNumFont = [UIFont monospacedSystemFontOfSize:11 weight:UIFontWeightRegular];
  UIFont *logFont = [UIFont monospacedSystemFontOfSize:12 weight:UIFontWeightRegular];
  UIColor *lineNumColor = [UIColor colorWithWhite:0.4 alpha:1.0];
  UIColor *normalColor = [UIColor colorWithWhite:0.88 alpha:1.0];
  UIColor *errorColor = [UIColor colorWithRed:0.95 green:0.4 blue:0.4 alpha:1.0];
  UIColor *warningColor = [UIColor colorWithRed:0.95 green:0.75 blue:0.3 alpha:1.0];
  UIColor *successColor = [UIColor colorWithRed:0.35 green:0.85 blue:0.55 alpha:1.0];
  UIColor *infoColor = [UIColor colorWithRed:0.45 green:0.7 blue:0.95 alpha:1.0];

  for (NSInteger i = 0; i < lines.count; i++) {
    NSString *line = lines[i];

    // Line number (3 digits, right-aligned)
    NSString *lineNum = [NSString stringWithFormat:@"%03ld  ", (long)(i + 1)];
    NSAttributedString *lineNumAttr = [[NSAttributedString alloc] initWithString:lineNum attributes:@{
      NSFontAttributeName: lineNumFont,
      NSForegroundColorAttributeName: lineNumColor
    }];
    [attributed appendAttributedString:lineNumAttr];

    // Determine line color based on content
    UIColor *lineColor = normalColor;
    NSString *lowerLine = line.lowercaseString;

    if ([lowerLine containsString:@"error"] || [lowerLine containsString:@"failed"] || [lowerLine containsString:@"exception"]) {
      lineColor = errorColor;
    } else if ([lowerLine containsString:@"warn"] || [lowerLine containsString:@"warning"]) {
      lineColor = warningColor;
    } else if ([lowerLine containsString:@"success"] || [lowerLine containsString:@"✓"] || [lowerLine containsString:@"done"] || [lowerLine containsString:@"started"]) {
      lineColor = successColor;
    } else if ([lowerLine containsString:@"info"] || [lowerLine containsString:@"log"]) {
      lineColor = infoColor;
    }

    // Log line
    NSString *logLine = [NSString stringWithFormat:@"%@\n", line];
    NSAttributedString *logAttr = [[NSAttributedString alloc] initWithString:logLine attributes:@{
      NSFontAttributeName: logFont,
      NSForegroundColorAttributeName: lineColor
    }];
    [attributed appendAttributedString:logAttr];
  }

  self.logsTextView.attributedText = attributed;

  // Scroll to bottom to show latest logs
  if (self.logsTextView.contentSize.height > self.logsTextView.bounds.size.height) {
    CGPoint bottomOffset = CGPointMake(0, self.logsTextView.contentSize.height - self.logsTextView.bounds.size.height);
    [self.logsTextView setContentOffset:bottomOffset animated:NO];
  }
}

- (void)showError:(NSString *)message {
  UIFont *font = [UIFont monospacedSystemFontOfSize:13 weight:UIFontWeightRegular];
  UIColor *errorColor = [UIColor colorWithWhite:0.5 alpha:1.0];

  self.logsTextView.attributedText = [[NSAttributedString alloc] initWithString:message attributes:@{
    NSFontAttributeName: font,
    NSForegroundColorAttributeName: errorColor
  }];

  self.updatedLabel.text = @"Unable to load logs";
}

- (void)updateTimestamp {
  if (!self.lastUpdated) {
    self.updatedLabel.text = @"Not loaded";
    return;
  }

  NSTimeInterval seconds = [[NSDate date] timeIntervalSinceDate:self.lastUpdated];

  if (seconds < 5) {
    self.updatedLabel.text = @"Updated just now";
  } else if (seconds < 60) {
    self.updatedLabel.text = [NSString stringWithFormat:@"Updated %.0f seconds ago", seconds];
  } else if (seconds < 3600) {
    NSInteger minutes = (NSInteger)(seconds / 60);
    self.updatedLabel.text = [NSString stringWithFormat:@"Updated %ld minute%@ ago", (long)minutes, minutes == 1 ? @"" : @"s"];
  } else {
    NSDateFormatter *formatter = [[NSDateFormatter alloc] init];
    formatter.dateFormat = @"h:mm a";
    self.updatedLabel.text = [NSString stringWithFormat:@"Updated at %@", [formatter stringFromDate:self.lastUpdated]];
  }
}

@end
