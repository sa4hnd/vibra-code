// Copyright 2015-present 650 Industries. All rights reserved.

#import "EXPreviewZoomManager+Private.h"
#import "EXPreviewZoomManager.h"
#import "EXChatBackendService.h"
#import <UIKit/UIKit.h>

// Forward declarations
@class EXPublishModalViewController;

// Publish Modal View Controller - Clean, simple design following Apple HIG
@interface EXPublishModalViewController : UIViewController <UIAdaptivePresentationControllerDelegate>

@property(nonatomic, weak) EXPreviewZoomManager *manager;
@property(nonatomic, strong) UIVisualEffectView *backgroundView;
@property(nonatomic, assign) BOOL isGitHubConnected;
@property(nonatomic, strong) NSString *githubUsername;
@property(nonatomic, strong) NSString *repositoryUrl;

- (instancetype)initWithManager:(EXPreviewZoomManager *)manager;

@end

// Category implementation
@implementation EXPreviewZoomManager (PublishModal)

- (void)showPublishModal {
  if (self.publishModalPresented) {
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

  EXPublishModalViewController *modalVC = [[EXPublishModalViewController alloc] initWithManager:self];

  UINavigationController *navController = [[UINavigationController alloc] initWithRootViewController:modalVC];
  navController.view.backgroundColor = [UIColor clearColor];
  navController.navigationBarHidden = YES;

  self.publishModalViewController = navController;

  navController.modalPresentationStyle = UIModalPresentationPageSheet;
  if (@available(iOS 15.0, *)) {
    UISheetPresentationController *sheet = navController.sheetPresentationController;
    if (sheet) {
      // Use medium detent for a cleaner, less overwhelming presentation
      sheet.detents = @[
        [UISheetPresentationControllerDetent mediumDetent],
        [UISheetPresentationControllerDetent largeDetent]
      ];
      sheet.selectedDetentIdentifier = UISheetPresentationControllerDetentIdentifierMedium;
      sheet.preferredCornerRadius = 20.0;
      sheet.prefersGrabberVisible = YES;
      sheet.prefersEdgeAttachedInCompactHeight = YES;
      sheet.widthFollowsPreferredContentSizeWhenEdgeAttached = YES;
    }
  }

  navController.presentationController.delegate = modalVC;

  [topVC presentViewController:navController animated:YES completion:nil];
  self.publishModalPresented = YES;
}

@end

// MARK: - EXPublishModalViewController Implementation

@implementation EXPublishModalViewController

- (instancetype)initWithManager:(EXPreviewZoomManager *)manager {
  self = [super init];
  if (self) {
    _manager = manager;
    _isGitHubConnected = manager.isGitHubConnected;
    _githubUsername = manager.githubUsername;
    _repositoryUrl = manager.githubRepositoryUrl;
  }
  return self;
}

- (void)viewDidLoad {
  [super viewDidLoad];

  // Force dark mode for this modal
  if (@available(iOS 13.0, *)) {
    self.overrideUserInterfaceStyle = UIUserInterfaceStyleDark;
  }

  self.view.backgroundColor = [UIColor clearColor];

  [self setupBackground];
  [self setupContent];
}

- (void)viewWillAppear:(BOOL)animated {
  [super viewWillAppear:animated];
  [self.navigationController setNavigationBarHidden:YES animated:animated];

  // Refresh GitHub status
  self.isGitHubConnected = self.manager.isGitHubConnected;
  self.githubUsername = self.manager.githubUsername;
  self.repositoryUrl = self.manager.githubRepositoryUrl;
}

- (void)presentationControllerDidDismiss:(UIPresentationController *)presentationController {
  self.manager.publishModalPresented = NO;
}

#pragma mark - Setup Methods

- (void)setupBackground {
  // Use Liquid Glass on iOS 26+, fall back to blur
  UIVisualEffect *effect = nil;
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
        effect = (__bridge id)tempResult;
      }
    }
  }

  if (!effect) {
    if (@available(iOS 13.0, *)) {
      effect = [UIBlurEffect effectWithStyle:UIBlurEffectStyleSystemChromeMaterialDark];
    } else {
      effect = [UIBlurEffect effectWithStyle:UIBlurEffectStyleDark];
    }
  }

  self.backgroundView = [[UIVisualEffectView alloc] initWithEffect:effect];
  self.backgroundView.translatesAutoresizingMaskIntoConstraints = NO;
  [self.view insertSubview:self.backgroundView atIndex:0];

  [NSLayoutConstraint activateConstraints:@[
    [self.backgroundView.topAnchor constraintEqualToAnchor:self.view.topAnchor],
    [self.backgroundView.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor],
    [self.backgroundView.trailingAnchor constraintEqualToAnchor:self.view.trailingAnchor],
    [self.backgroundView.bottomAnchor constraintEqualToAnchor:self.view.bottomAnchor]
  ]];
}

- (void)setupContent {
  // Main container with proper padding
  UIView *contentContainer = [[UIView alloc] init];
  contentContainer.translatesAutoresizingMaskIntoConstraints = NO;
  [self.view addSubview:contentContainer];

  // === Header Section ===
  // Large App Store icon
  UIImageSymbolConfiguration *iconConfig = [UIImageSymbolConfiguration configurationWithPointSize:56 weight:UIImageSymbolWeightMedium];
  UIImageView *appStoreIcon = [[UIImageView alloc] initWithImage:[UIImage systemImageNamed:@"apple.logo" withConfiguration:iconConfig]];
  appStoreIcon.tintColor = [UIColor whiteColor];
  appStoreIcon.translatesAutoresizingMaskIntoConstraints = NO;
  [contentContainer addSubview:appStoreIcon];

  // Title
  UILabel *titleLabel = [[UILabel alloc] init];
  titleLabel.text = @"Publish Your App";
  titleLabel.textColor = [UIColor whiteColor];
  titleLabel.font = [UIFont systemFontOfSize:28 weight:UIFontWeightBold];
  titleLabel.textAlignment = NSTextAlignmentCenter;
  titleLabel.translatesAutoresizingMaskIntoConstraints = NO;
  [contentContainer addSubview:titleLabel];

  // Subtitle
  UILabel *subtitleLabel = [[UILabel alloc] init];
  subtitleLabel.text = @"Get your app on the App Store and Google Play";
  subtitleLabel.textColor = [UIColor colorWithWhite:0.6 alpha:1.0];
  subtitleLabel.font = [UIFont systemFontOfSize:15];
  subtitleLabel.textAlignment = NSTextAlignmentCenter;
  subtitleLabel.translatesAutoresizingMaskIntoConstraints = NO;
  [contentContainer addSubview:subtitleLabel];

  // === GitHub Status Card ===
  UIView *githubCard = [self createGitHubCard];
  githubCard.translatesAutoresizingMaskIntoConstraints = NO;
  [contentContainer addSubview:githubCard];

  // === Steps Info (simple list) ===
  UIView *stepsInfo = [self createStepsInfo];
  stepsInfo.translatesAutoresizingMaskIntoConstraints = NO;
  [contentContainer addSubview:stepsInfo];

  // === Primary CTA Button ===
  UIButton *ctaButton = [self createCTAButton];
  ctaButton.translatesAutoresizingMaskIntoConstraints = NO;
  [contentContainer addSubview:ctaButton];

  // === Learn More Link ===
  UIButton *learnMoreButton = [UIButton buttonWithType:UIButtonTypeSystem];
  [learnMoreButton setTitle:@"Learn more about EAS Submit" forState:UIControlStateNormal];
  [learnMoreButton setTitleColor:[UIColor colorWithRed:0.4 green:0.6 blue:1.0 alpha:1.0] forState:UIControlStateNormal];
  learnMoreButton.titleLabel.font = [UIFont systemFontOfSize:14];
  learnMoreButton.translatesAutoresizingMaskIntoConstraints = NO;
  [learnMoreButton addTarget:self action:@selector(openEASDocs) forControlEvents:UIControlEventTouchUpInside];
  [contentContainer addSubview:learnMoreButton];

  // Constraints
  [NSLayoutConstraint activateConstraints:@[
    [contentContainer.topAnchor constraintEqualToAnchor:self.view.safeAreaLayoutGuide.topAnchor constant:24],
    [contentContainer.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor constant:24],
    [contentContainer.trailingAnchor constraintEqualToAnchor:self.view.trailingAnchor constant:-24],
    [contentContainer.bottomAnchor constraintEqualToAnchor:self.view.safeAreaLayoutGuide.bottomAnchor constant:-16],

    // App Store icon
    [appStoreIcon.centerXAnchor constraintEqualToAnchor:contentContainer.centerXAnchor],
    [appStoreIcon.topAnchor constraintEqualToAnchor:contentContainer.topAnchor constant:8],

    // Title
    [titleLabel.centerXAnchor constraintEqualToAnchor:contentContainer.centerXAnchor],
    [titleLabel.topAnchor constraintEqualToAnchor:appStoreIcon.bottomAnchor constant:16],
    [titleLabel.leadingAnchor constraintEqualToAnchor:contentContainer.leadingAnchor],
    [titleLabel.trailingAnchor constraintEqualToAnchor:contentContainer.trailingAnchor],

    // Subtitle
    [subtitleLabel.centerXAnchor constraintEqualToAnchor:contentContainer.centerXAnchor],
    [subtitleLabel.topAnchor constraintEqualToAnchor:titleLabel.bottomAnchor constant:6],
    [subtitleLabel.leadingAnchor constraintEqualToAnchor:contentContainer.leadingAnchor],
    [subtitleLabel.trailingAnchor constraintEqualToAnchor:contentContainer.trailingAnchor],

    // GitHub card
    [githubCard.topAnchor constraintEqualToAnchor:subtitleLabel.bottomAnchor constant:28],
    [githubCard.leadingAnchor constraintEqualToAnchor:contentContainer.leadingAnchor],
    [githubCard.trailingAnchor constraintEqualToAnchor:contentContainer.trailingAnchor],

    // Steps info
    [stepsInfo.topAnchor constraintEqualToAnchor:githubCard.bottomAnchor constant:20],
    [stepsInfo.leadingAnchor constraintEqualToAnchor:contentContainer.leadingAnchor],
    [stepsInfo.trailingAnchor constraintEqualToAnchor:contentContainer.trailingAnchor],

    // CTA Button
    [ctaButton.topAnchor constraintEqualToAnchor:stepsInfo.bottomAnchor constant:24],
    [ctaButton.leadingAnchor constraintEqualToAnchor:contentContainer.leadingAnchor],
    [ctaButton.trailingAnchor constraintEqualToAnchor:contentContainer.trailingAnchor],
    [ctaButton.heightAnchor constraintEqualToConstant:52],

    // Learn more
    [learnMoreButton.centerXAnchor constraintEqualToAnchor:contentContainer.centerXAnchor],
    [learnMoreButton.topAnchor constraintEqualToAnchor:ctaButton.bottomAnchor constant:12]
  ]];
}

- (UIView *)createGitHubCard {
  UIView *card = [[UIView alloc] init];
  card.backgroundColor = [UIColor colorWithWhite:0.12 alpha:1.0];
  card.layer.cornerRadius = 14;

  // Status indicator color
  UIColor *statusColor = self.isGitHubConnected ?
    [UIColor colorWithRed:0.3 green:0.85 blue:0.5 alpha:1.0] :
    [UIColor colorWithRed:1.0 green:0.6 blue:0.2 alpha:1.0];

  // Left side: Icon + status dot
  UIView *iconContainer = [[UIView alloc] init];
  iconContainer.translatesAutoresizingMaskIntoConstraints = NO;
  [card addSubview:iconContainer];

  UIImageSymbolConfiguration *iconConfig = [UIImageSymbolConfiguration configurationWithPointSize:24 weight:UIImageSymbolWeightMedium];
  UIImageView *githubIcon = [[UIImageView alloc] initWithImage:[UIImage systemImageNamed:@"chevron.left.forwardslash.chevron.right" withConfiguration:iconConfig]];
  githubIcon.tintColor = [UIColor whiteColor];
  githubIcon.translatesAutoresizingMaskIntoConstraints = NO;
  [iconContainer addSubview:githubIcon];

  UIView *statusDot = [[UIView alloc] init];
  statusDot.backgroundColor = statusColor;
  statusDot.layer.cornerRadius = 5;
  statusDot.translatesAutoresizingMaskIntoConstraints = NO;
  [iconContainer addSubview:statusDot];

  // Text
  UILabel *statusLabel = [[UILabel alloc] init];
  statusLabel.text = self.isGitHubConnected ? @"GitHub Connected" : @"Connect GitHub";
  statusLabel.textColor = [UIColor whiteColor];
  statusLabel.font = [UIFont systemFontOfSize:16 weight:UIFontWeightSemibold];
  statusLabel.translatesAutoresizingMaskIntoConstraints = NO;
  [card addSubview:statusLabel];

  UILabel *detailLabel = [[UILabel alloc] init];
  if (self.isGitHubConnected && self.githubUsername) {
    detailLabel.text = [NSString stringWithFormat:@"@%@", self.githubUsername];
  } else if (self.isGitHubConnected) {
    detailLabel.text = @"Ready to push";
  } else {
    detailLabel.text = @"Required for publishing";
  }
  detailLabel.textColor = [UIColor colorWithWhite:0.5 alpha:1.0];
  detailLabel.font = [UIFont systemFontOfSize:13];
  detailLabel.translatesAutoresizingMaskIntoConstraints = NO;
  [card addSubview:detailLabel];

  // Chevron
  UIImageSymbolConfiguration *chevronConfig = [UIImageSymbolConfiguration configurationWithPointSize:14 weight:UIImageSymbolWeightMedium];
  UIImageView *chevron = [[UIImageView alloc] initWithImage:[UIImage systemImageNamed:@"chevron.right" withConfiguration:chevronConfig]];
  chevron.tintColor = [UIColor colorWithWhite:0.4 alpha:1.0];
  chevron.translatesAutoresizingMaskIntoConstraints = NO;
  [card addSubview:chevron];

  // Tap gesture
  UITapGestureRecognizer *tap = [[UITapGestureRecognizer alloc] initWithTarget:self action:@selector(handleGitHubCardTap)];
  [card addGestureRecognizer:tap];

  [NSLayoutConstraint activateConstraints:@[
    [iconContainer.leadingAnchor constraintEqualToAnchor:card.leadingAnchor constant:16],
    [iconContainer.centerYAnchor constraintEqualToAnchor:card.centerYAnchor],
    [iconContainer.widthAnchor constraintEqualToConstant:32],
    [iconContainer.heightAnchor constraintEqualToConstant:32],

    [githubIcon.centerXAnchor constraintEqualToAnchor:iconContainer.centerXAnchor],
    [githubIcon.centerYAnchor constraintEqualToAnchor:iconContainer.centerYAnchor],

    [statusDot.trailingAnchor constraintEqualToAnchor:iconContainer.trailingAnchor constant:4],
    [statusDot.bottomAnchor constraintEqualToAnchor:iconContainer.bottomAnchor constant:4],
    [statusDot.widthAnchor constraintEqualToConstant:10],
    [statusDot.heightAnchor constraintEqualToConstant:10],

    [statusLabel.leadingAnchor constraintEqualToAnchor:iconContainer.trailingAnchor constant:14],
    [statusLabel.topAnchor constraintEqualToAnchor:card.topAnchor constant:14],

    [detailLabel.leadingAnchor constraintEqualToAnchor:statusLabel.leadingAnchor],
    [detailLabel.topAnchor constraintEqualToAnchor:statusLabel.bottomAnchor constant:2],

    [chevron.trailingAnchor constraintEqualToAnchor:card.trailingAnchor constant:-16],
    [chevron.centerYAnchor constraintEqualToAnchor:card.centerYAnchor],

    [card.heightAnchor constraintEqualToConstant:64]
  ]];

  return card;
}

- (UIView *)createStepsInfo {
  UIView *container = [[UIView alloc] init];

  // Simple numbered list
  NSArray *steps = @[
    @"Push your code to GitHub",
    @"Visit launch.expo.dev",
    @"Build and submit with EAS"
  ];

  UIStackView *stack = [[UIStackView alloc] init];
  stack.axis = UILayoutConstraintAxisVertical;
  stack.spacing = 10;
  stack.translatesAutoresizingMaskIntoConstraints = NO;
  [container addSubview:stack];

  for (NSUInteger i = 0; i < steps.count; i++) {
    UIView *row = [[UIView alloc] init];

    // Number circle
    UILabel *numLabel = [[UILabel alloc] init];
    numLabel.text = [NSString stringWithFormat:@"%lu", (unsigned long)(i + 1)];
    numLabel.textColor = [UIColor colorWithRed:0.4 green:0.6 blue:1.0 alpha:1.0];
    numLabel.font = [UIFont systemFontOfSize:13 weight:UIFontWeightBold];
    numLabel.textAlignment = NSTextAlignmentCenter;
    numLabel.backgroundColor = [UIColor colorWithRed:0.2 green:0.4 blue:0.8 alpha:0.2];
    numLabel.layer.cornerRadius = 12;
    numLabel.clipsToBounds = YES;
    numLabel.translatesAutoresizingMaskIntoConstraints = NO;
    [row addSubview:numLabel];

    // Text
    UILabel *textLabel = [[UILabel alloc] init];
    textLabel.text = steps[i];
    textLabel.textColor = [UIColor colorWithWhite:0.75 alpha:1.0];
    textLabel.font = [UIFont systemFontOfSize:15];
    textLabel.translatesAutoresizingMaskIntoConstraints = NO;
    [row addSubview:textLabel];

    [NSLayoutConstraint activateConstraints:@[
      [numLabel.leadingAnchor constraintEqualToAnchor:row.leadingAnchor],
      [numLabel.centerYAnchor constraintEqualToAnchor:row.centerYAnchor],
      [numLabel.widthAnchor constraintEqualToConstant:24],
      [numLabel.heightAnchor constraintEqualToConstant:24],

      [textLabel.leadingAnchor constraintEqualToAnchor:numLabel.trailingAnchor constant:12],
      [textLabel.centerYAnchor constraintEqualToAnchor:row.centerYAnchor],
      [textLabel.trailingAnchor constraintEqualToAnchor:row.trailingAnchor],

      [row.heightAnchor constraintEqualToConstant:32]
    ]];

    [stack addArrangedSubview:row];
  }

  [NSLayoutConstraint activateConstraints:@[
    [stack.topAnchor constraintEqualToAnchor:container.topAnchor],
    [stack.leadingAnchor constraintEqualToAnchor:container.leadingAnchor],
    [stack.trailingAnchor constraintEqualToAnchor:container.trailingAnchor],
    [stack.bottomAnchor constraintEqualToAnchor:container.bottomAnchor]
  ]];

  return container;
}

- (UIButton *)createCTAButton {
  UIButton *button = [UIButton buttonWithType:UIButtonTypeSystem];
  button.translatesAutoresizingMaskIntoConstraints = NO;

  NSString *title;
  UIColor *bgColor;

  if (self.repositoryUrl) {
    title = @"Open Repository";
    bgColor = [UIColor colorWithRed:0.2 green:0.5 blue:0.9 alpha:1.0];
  } else if (self.isGitHubConnected) {
    title = @"Push to GitHub";
    bgColor = [UIColor colorWithRed:0.25 green:0.75 blue:0.45 alpha:1.0];
  } else {
    title = @"Connect GitHub";
    bgColor = [UIColor whiteColor];
  }

  [button setTitle:title forState:UIControlStateNormal];
  button.backgroundColor = bgColor;

  if (!self.isGitHubConnected) {
    [button setTitleColor:[UIColor blackColor] forState:UIControlStateNormal];
  } else {
    [button setTitleColor:[UIColor whiteColor] forState:UIControlStateNormal];
  }

  button.titleLabel.font = [UIFont systemFontOfSize:17 weight:UIFontWeightSemibold];
  button.layer.cornerRadius = 14;

  [button addTarget:self action:@selector(handleCTATapped) forControlEvents:UIControlEventTouchUpInside];

  return button;
}

#pragma mark - Actions

- (void)handleGitHubCardTap {
  [self dismissViewControllerAnimated:YES completion:^{
    self.manager.publishModalPresented = NO;
    if ([self.manager respondsToSelector:@selector(handleGitHubButtonTapped:)]) {
      [self.manager performSelector:@selector(handleGitHubButtonTapped:) withObject:nil];
    }
  }];
}

- (void)handleCTATapped {
  if (self.repositoryUrl) {
    // Copy URL and show toast
    [[UIPasteboard generalPasteboard] setString:self.repositoryUrl];

    UINotificationFeedbackGenerator *feedback = [[UINotificationFeedbackGenerator alloc] init];
    [feedback notificationOccurred:UINotificationFeedbackTypeSuccess];

    // Show toast
    UILabel *toast = [[UILabel alloc] init];
    toast.text = @"Repository URL copied";
    toast.textColor = [UIColor whiteColor];
    toast.backgroundColor = [UIColor colorWithRed:0.2 green:0.7 blue:0.4 alpha:1.0];
    toast.textAlignment = NSTextAlignmentCenter;
    toast.font = [UIFont systemFontOfSize:14 weight:UIFontWeightMedium];
    toast.layer.cornerRadius = 10;
    toast.clipsToBounds = YES;
    toast.alpha = 0;
    toast.translatesAutoresizingMaskIntoConstraints = NO;
    [self.view addSubview:toast];

    [NSLayoutConstraint activateConstraints:@[
      [toast.centerXAnchor constraintEqualToAnchor:self.view.centerXAnchor],
      [toast.bottomAnchor constraintEqualToAnchor:self.view.safeAreaLayoutGuide.bottomAnchor constant:-20],
      [toast.widthAnchor constraintEqualToConstant:200],
      [toast.heightAnchor constraintEqualToConstant:40]
    ]];

    [UIView animateWithDuration:0.25 animations:^{
      toast.alpha = 1;
    } completion:^(BOOL finished) {
      dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(1.5 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
        [UIView animateWithDuration:0.25 animations:^{
          toast.alpha = 0;
        } completion:^(BOOL finished) {
          [toast removeFromSuperview];
        }];
      });
    }];
  } else {
    // Connect or push to GitHub
    [self dismissViewControllerAnimated:YES completion:^{
      self.manager.publishModalPresented = NO;
      if ([self.manager respondsToSelector:@selector(handleGitHubButtonTapped:)]) {
        [self.manager performSelector:@selector(handleGitHubButtonTapped:) withObject:nil];
      }
    }];
  }
}

- (void)openEASDocs {
  NSURL *docsURL = [NSURL URLWithString:@"https://docs.expo.dev/submit/introduction/"];
  [[UIApplication sharedApplication] openURL:docsURL options:@{} completionHandler:nil];
}

@end
