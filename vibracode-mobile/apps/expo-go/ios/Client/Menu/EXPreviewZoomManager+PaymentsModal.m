// Copyright 2015-present 650 Industries. All rights reserved.

#import "EXPreviewZoomManager+Private.h"
#import "EXPreviewZoomManager.h"
#import "EXChatBackendService.h"
#import "EXEnvBridge.h"
#import <UIKit/UIKit.h>
#import <AuthenticationServices/AuthenticationServices.h>

// Forward declarations
@class EXPaymentsModalViewController;

// Payments Modal View Controller
@interface EXPaymentsModalViewController : UIViewController <UIAdaptivePresentationControllerDelegate, ASWebAuthenticationPresentationContextProviding>

@property(nonatomic, weak) EXPreviewZoomManager *manager;
@property(nonatomic, strong) UIVisualEffectView *backgroundView;
@property(nonatomic, strong) UIView *headerView;
@property(nonatomic, strong) UILabel *titleLabel;
@property(nonatomic, strong) UIView *contentView;
@property(nonatomic, strong) UIActivityIndicatorView *loadingIndicator;
@property(nonatomic, assign) BOOL isConnected;
@property(nonatomic, assign) BOOL isExpired;
@property(nonatomic, assign) BOOL isLoading;
@property(nonatomic, assign) BOOL isConnecting;
@property(nonatomic, assign) BOOL wasJustConnecting;  // Track if we're checking after a connect attempt
@property(nonatomic, strong) ASWebAuthenticationSession *authSession API_AVAILABLE(ios(12.0));

- (instancetype)initWithManager:(EXPreviewZoomManager *)manager;

@end

// Category implementation
@implementation EXPreviewZoomManager (PaymentsModal)

- (void)showPaymentsModal {
  if (self.paymentsModalPresented) {
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

  EXPaymentsModalViewController *modalVC = [[EXPaymentsModalViewController alloc] initWithManager:self];

  UINavigationController *navController = [[UINavigationController alloc] initWithRootViewController:modalVC];
  navController.view.backgroundColor = [UIColor clearColor];
  navController.navigationBarHidden = YES;

  self.paymentsModalViewController = navController;

  navController.modalPresentationStyle = UIModalPresentationPageSheet;
  if (@available(iOS 15.0, *)) {
    UISheetPresentationController *sheet = navController.sheetPresentationController;
    if (sheet) {
      sheet.detents = @[
        [UISheetPresentationControllerDetent mediumDetent],
        [UISheetPresentationControllerDetent largeDetent]
      ];
      sheet.selectedDetentIdentifier = UISheetPresentationControllerDetentIdentifierMedium;
      sheet.preferredCornerRadius = 28.0;
      sheet.prefersGrabberVisible = YES;
      sheet.prefersEdgeAttachedInCompactHeight = YES;
      sheet.widthFollowsPreferredContentSizeWhenEdgeAttached = YES;
    }
  }

  navController.presentationController.delegate = modalVC;

  [topVC presentViewController:navController animated:YES completion:nil];
  self.paymentsModalPresented = YES;
}

@end

// MARK: - EXPaymentsModalViewController Implementation

@implementation EXPaymentsModalViewController

- (instancetype)initWithManager:(EXPreviewZoomManager *)manager {
  self = [super init];
  if (self) {
    _manager = manager;
    _isConnected = manager.isRevenueCatConnected;
    _isExpired = manager.isRevenueCatExpired;
    _isLoading = YES;
    _isConnecting = NO;
    _wasJustConnecting = NO;
  }
  return self;
}

- (void)viewDidLoad {
  [super viewDidLoad];

  self.view.backgroundColor = [UIColor clearColor];

  [self setupBackground];
  [self setupHeader];
  [self setupContentView];

  [self checkConnectionStatus];
}

- (void)viewWillAppear:(BOOL)animated {
  [super viewWillAppear:animated];
  [self.navigationController setNavigationBarHidden:YES animated:animated];
}

- (void)presentationControllerDidDismiss:(UIPresentationController *)presentationController {
  self.manager.paymentsModalPresented = NO;
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

  // Title with dollar icon
  UIImageSymbolConfiguration *dollarConfig = [UIImageSymbolConfiguration configurationWithPointSize:22 weight:UIImageSymbolWeightBold];
  UIImage *dollarImage = [UIImage systemImageNamed:@"dollarsign.circle.fill" withConfiguration:dollarConfig];
  UIImageView *dollarIcon = [[UIImageView alloc] initWithImage:dollarImage];
  dollarIcon.tintColor = [UIColor colorWithRed:0.3 green:0.8 blue:0.5 alpha:1.0]; // Green color
  dollarIcon.translatesAutoresizingMaskIntoConstraints = NO;
  [self.headerView addSubview:dollarIcon];

  self.titleLabel = [[UILabel alloc] init];
  self.titleLabel.text = @"Payments";
  self.titleLabel.textColor = [UIColor whiteColor];
  self.titleLabel.font = [UIFont systemFontOfSize:22 weight:UIFontWeightBold];
  self.titleLabel.translatesAutoresizingMaskIntoConstraints = NO;
  [self.headerView addSubview:self.titleLabel];

  // Close button
  UIButton *closeButton = [UIButton buttonWithType:UIButtonTypeSystem];
  closeButton.translatesAutoresizingMaskIntoConstraints = NO;
  UIImageSymbolConfiguration *closeConfig = [UIImageSymbolConfiguration configurationWithPointSize:18 weight:UIImageSymbolWeightMedium];
  [closeButton setImage:[UIImage systemImageNamed:@"xmark.circle.fill" withConfiguration:closeConfig] forState:UIControlStateNormal];
  closeButton.tintColor = [UIColor colorWithWhite:0.6 alpha:1.0];
  [closeButton addTarget:self action:@selector(closeModal) forControlEvents:UIControlEventTouchUpInside];
  [self.headerView addSubview:closeButton];

  [NSLayoutConstraint activateConstraints:@[
    [self.headerView.topAnchor constraintEqualToAnchor:self.view.safeAreaLayoutGuide.topAnchor constant:16],
    [self.headerView.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor],
    [self.headerView.trailingAnchor constraintEqualToAnchor:self.view.trailingAnchor],
    [self.headerView.heightAnchor constraintEqualToConstant:44],

    [dollarIcon.leadingAnchor constraintEqualToAnchor:self.headerView.leadingAnchor constant:20],
    [dollarIcon.centerYAnchor constraintEqualToAnchor:self.headerView.centerYAnchor],
    [dollarIcon.widthAnchor constraintEqualToConstant:28],
    [dollarIcon.heightAnchor constraintEqualToConstant:28],

    [self.titleLabel.leadingAnchor constraintEqualToAnchor:dollarIcon.trailingAnchor constant:10],
    [self.titleLabel.centerYAnchor constraintEqualToAnchor:self.headerView.centerYAnchor],

    [closeButton.trailingAnchor constraintEqualToAnchor:self.headerView.trailingAnchor constant:-20],
    [closeButton.centerYAnchor constraintEqualToAnchor:self.headerView.centerYAnchor],
    [closeButton.widthAnchor constraintEqualToConstant:32],
    [closeButton.heightAnchor constraintEqualToConstant:32]
  ]];
}

- (void)setupContentView {
  self.contentView = [[UIView alloc] init];
  self.contentView.translatesAutoresizingMaskIntoConstraints = NO;
  [self.view addSubview:self.contentView];

  // Loading indicator
  self.loadingIndicator = [[UIActivityIndicatorView alloc] initWithActivityIndicatorStyle:UIActivityIndicatorViewStyleLarge];
  self.loadingIndicator.translatesAutoresizingMaskIntoConstraints = NO;
  self.loadingIndicator.hidesWhenStopped = YES;
  self.loadingIndicator.color = [UIColor colorWithRed:0.3 green:0.8 blue:0.5 alpha:1.0];
  [self.contentView addSubview:self.loadingIndicator];
  [self.loadingIndicator startAnimating];

  [NSLayoutConstraint activateConstraints:@[
    [self.contentView.topAnchor constraintEqualToAnchor:self.headerView.bottomAnchor constant:20],
    [self.contentView.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor constant:20],
    [self.contentView.trailingAnchor constraintEqualToAnchor:self.view.trailingAnchor constant:-20],
    [self.contentView.bottomAnchor constraintEqualToAnchor:self.view.safeAreaLayoutGuide.bottomAnchor constant:-20],

    [self.loadingIndicator.centerXAnchor constraintEqualToAnchor:self.contentView.centerXAnchor],
    [self.loadingIndicator.centerYAnchor constraintEqualToAnchor:self.contentView.centerYAnchor]
  ]];
}

- (void)updateContentView {
  // Clear existing content
  for (UIView *subview in self.contentView.subviews) {
    if (subview != self.loadingIndicator) {
      [subview removeFromSuperview];
    }
  }

  if (self.isLoading) {
    [self.loadingIndicator startAnimating];
    return;
  }

  [self.loadingIndicator stopAnimating];

  if (self.isConnected && !self.isExpired) {
    [self showConnectedState];
  } else {
    [self showDisconnectedState];
  }
}

- (void)showConnectedState {
  // Connected icon
  UIView *iconContainer = [[UIView alloc] init];
  iconContainer.translatesAutoresizingMaskIntoConstraints = NO;
  iconContainer.backgroundColor = [UIColor colorWithRed:0.2 green:0.7 blue:0.4 alpha:0.2];
  iconContainer.layer.cornerRadius = 32;
  [self.contentView addSubview:iconContainer];

  UIImageSymbolConfiguration *checkConfig = [UIImageSymbolConfiguration configurationWithPointSize:32 weight:UIImageSymbolWeightBold];
  UIImageView *checkIcon = [[UIImageView alloc] initWithImage:[UIImage systemImageNamed:@"checkmark.circle.fill" withConfiguration:checkConfig]];
  checkIcon.tintColor = [UIColor colorWithRed:0.3 green:0.8 blue:0.5 alpha:1.0];
  checkIcon.translatesAutoresizingMaskIntoConstraints = NO;
  [iconContainer addSubview:checkIcon];

  // Title
  UILabel *titleLabel = [[UILabel alloc] init];
  titleLabel.text = @"RevenueCat Connected";
  titleLabel.textColor = [UIColor whiteColor];
  titleLabel.font = [UIFont systemFontOfSize:20 weight:UIFontWeightBold];
  titleLabel.translatesAutoresizingMaskIntoConstraints = NO;
  [self.contentView addSubview:titleLabel];

  // Description
  UILabel *descLabel = [[UILabel alloc] init];
  descLabel.text = @"Your RevenueCat account is connected. The AI can now help you set up in-app purchases and subscriptions.";
  descLabel.textColor = [UIColor colorWithWhite:0.6 alpha:1.0];
  descLabel.font = [UIFont systemFontOfSize:14];
  descLabel.numberOfLines = 0;
  descLabel.textAlignment = NSTextAlignmentCenter;
  descLabel.translatesAutoresizingMaskIntoConstraints = NO;
  [self.contentView addSubview:descLabel];

  // Setup MCP button
  UIButton *setupButton = [UIButton buttonWithType:UIButtonTypeSystem];
  setupButton.translatesAutoresizingMaskIntoConstraints = NO;
  setupButton.backgroundColor = [UIColor colorWithRed:0.3 green:0.8 blue:0.5 alpha:1.0];
  setupButton.layer.cornerRadius = 12;
  [setupButton setTitle:@"Enable for AI" forState:UIControlStateNormal];
  [setupButton setTitleColor:[UIColor whiteColor] forState:UIControlStateNormal];
  setupButton.titleLabel.font = [UIFont systemFontOfSize:16 weight:UIFontWeightSemibold];
  [setupButton addTarget:self action:@selector(setupMcp) forControlEvents:UIControlEventTouchUpInside];
  [self.contentView addSubview:setupButton];

  // Disconnect button
  UIButton *disconnectButton = [UIButton buttonWithType:UIButtonTypeSystem];
  disconnectButton.translatesAutoresizingMaskIntoConstraints = NO;
  [disconnectButton setTitle:@"Disconnect" forState:UIControlStateNormal];
  [disconnectButton setTitleColor:[UIColor colorWithRed:1.0 green:0.4 blue:0.4 alpha:1.0] forState:UIControlStateNormal];
  disconnectButton.titleLabel.font = [UIFont systemFontOfSize:14 weight:UIFontWeightMedium];
  [disconnectButton addTarget:self action:@selector(disconnectRevenueCat) forControlEvents:UIControlEventTouchUpInside];
  [self.contentView addSubview:disconnectButton];

  [NSLayoutConstraint activateConstraints:@[
    [iconContainer.topAnchor constraintEqualToAnchor:self.contentView.topAnchor constant:40],
    [iconContainer.centerXAnchor constraintEqualToAnchor:self.contentView.centerXAnchor],
    [iconContainer.widthAnchor constraintEqualToConstant:64],
    [iconContainer.heightAnchor constraintEqualToConstant:64],

    [checkIcon.centerXAnchor constraintEqualToAnchor:iconContainer.centerXAnchor],
    [checkIcon.centerYAnchor constraintEqualToAnchor:iconContainer.centerYAnchor],

    [titleLabel.topAnchor constraintEqualToAnchor:iconContainer.bottomAnchor constant:20],
    [titleLabel.centerXAnchor constraintEqualToAnchor:self.contentView.centerXAnchor],

    [descLabel.topAnchor constraintEqualToAnchor:titleLabel.bottomAnchor constant:12],
    [descLabel.leadingAnchor constraintEqualToAnchor:self.contentView.leadingAnchor constant:20],
    [descLabel.trailingAnchor constraintEqualToAnchor:self.contentView.trailingAnchor constant:-20],

    [setupButton.topAnchor constraintEqualToAnchor:descLabel.bottomAnchor constant:24],
    [setupButton.leadingAnchor constraintEqualToAnchor:self.contentView.leadingAnchor],
    [setupButton.trailingAnchor constraintEqualToAnchor:self.contentView.trailingAnchor],
    [setupButton.heightAnchor constraintEqualToConstant:50],

    [disconnectButton.topAnchor constraintEqualToAnchor:setupButton.bottomAnchor constant:16],
    [disconnectButton.centerXAnchor constraintEqualToAnchor:self.contentView.centerXAnchor]
  ]];
}

- (void)showDisconnectedState {
  // RevenueCat logo placeholder
  UIView *iconContainer = [[UIView alloc] init];
  iconContainer.translatesAutoresizingMaskIntoConstraints = NO;
  iconContainer.backgroundColor = [UIColor colorWithRed:0.9 green:0.3 blue:0.3 alpha:0.2];
  iconContainer.layer.cornerRadius = 32;
  [self.contentView addSubview:iconContainer];

  UIImageSymbolConfiguration *catConfig = [UIImageSymbolConfiguration configurationWithPointSize:32 weight:UIImageSymbolWeightBold];
  UIImageView *catIcon = [[UIImageView alloc] initWithImage:[UIImage systemImageNamed:@"dollarsign.circle" withConfiguration:catConfig]];
  catIcon.tintColor = [UIColor colorWithRed:0.9 green:0.3 blue:0.3 alpha:1.0];
  catIcon.translatesAutoresizingMaskIntoConstraints = NO;
  [iconContainer addSubview:catIcon];

  // Title
  UILabel *titleLabel = [[UILabel alloc] init];
  titleLabel.text = self.isExpired ? @"Session Expired" : @"Connect RevenueCat";
  titleLabel.textColor = [UIColor whiteColor];
  titleLabel.font = [UIFont systemFontOfSize:20 weight:UIFontWeightBold];
  titleLabel.translatesAutoresizingMaskIntoConstraints = NO;
  [self.contentView addSubview:titleLabel];

  // Description
  UILabel *descLabel = [[UILabel alloc] init];
  descLabel.text = self.isExpired
    ? @"Your RevenueCat session has expired. Please reconnect to continue using payment features."
    : @"Connect your RevenueCat account to enable in-app purchases and subscriptions in your app.";
  descLabel.textColor = [UIColor colorWithWhite:0.6 alpha:1.0];
  descLabel.font = [UIFont systemFontOfSize:14];
  descLabel.numberOfLines = 0;
  descLabel.textAlignment = NSTextAlignmentCenter;
  descLabel.translatesAutoresizingMaskIntoConstraints = NO;
  [self.contentView addSubview:descLabel];

  // Connect button
  UIButton *connectButton = [UIButton buttonWithType:UIButtonTypeSystem];
  connectButton.translatesAutoresizingMaskIntoConstraints = NO;
  connectButton.backgroundColor = [UIColor colorWithRed:0.9 green:0.3 blue:0.3 alpha:1.0];
  connectButton.layer.cornerRadius = 12;
  [connectButton setTitle:self.isConnecting ? @"Connecting..." : @"Connect RevenueCat" forState:UIControlStateNormal];
  [connectButton setTitleColor:[UIColor whiteColor] forState:UIControlStateNormal];
  connectButton.titleLabel.font = [UIFont systemFontOfSize:16 weight:UIFontWeightSemibold];
  connectButton.enabled = !self.isConnecting;
  [connectButton addTarget:self action:@selector(connectRevenueCat) forControlEvents:UIControlEventTouchUpInside];
  [self.contentView addSubview:connectButton];

  // Features list
  UILabel *featuresTitle = [[UILabel alloc] init];
  featuresTitle.text = @"Features:";
  featuresTitle.textColor = [UIColor colorWithWhite:0.7 alpha:1.0];
  featuresTitle.font = [UIFont systemFontOfSize:12 weight:UIFontWeightSemibold];
  featuresTitle.translatesAutoresizingMaskIntoConstraints = NO;
  [self.contentView addSubview:featuresTitle];

  NSArray *features = @[@"In-app purchases", @"Subscriptions", @"Paywalls", @"Analytics"];
  UIStackView *featuresStack = [[UIStackView alloc] init];
  featuresStack.axis = UILayoutConstraintAxisVertical;
  featuresStack.spacing = 6;
  featuresStack.translatesAutoresizingMaskIntoConstraints = NO;
  [self.contentView addSubview:featuresStack];

  for (NSString *feature in features) {
    UILabel *featureLabel = [[UILabel alloc] init];
    featureLabel.text = [NSString stringWithFormat:@"• %@", feature];
    featureLabel.textColor = [UIColor colorWithWhite:0.5 alpha:1.0];
    featureLabel.font = [UIFont systemFontOfSize:12];
    [featuresStack addArrangedSubview:featureLabel];
  }

  [NSLayoutConstraint activateConstraints:@[
    [iconContainer.topAnchor constraintEqualToAnchor:self.contentView.topAnchor constant:40],
    [iconContainer.centerXAnchor constraintEqualToAnchor:self.contentView.centerXAnchor],
    [iconContainer.widthAnchor constraintEqualToConstant:64],
    [iconContainer.heightAnchor constraintEqualToConstant:64],

    [catIcon.centerXAnchor constraintEqualToAnchor:iconContainer.centerXAnchor],
    [catIcon.centerYAnchor constraintEqualToAnchor:iconContainer.centerYAnchor],

    [titleLabel.topAnchor constraintEqualToAnchor:iconContainer.bottomAnchor constant:20],
    [titleLabel.centerXAnchor constraintEqualToAnchor:self.contentView.centerXAnchor],

    [descLabel.topAnchor constraintEqualToAnchor:titleLabel.bottomAnchor constant:12],
    [descLabel.leadingAnchor constraintEqualToAnchor:self.contentView.leadingAnchor constant:20],
    [descLabel.trailingAnchor constraintEqualToAnchor:self.contentView.trailingAnchor constant:-20],

    [connectButton.topAnchor constraintEqualToAnchor:descLabel.bottomAnchor constant:24],
    [connectButton.leadingAnchor constraintEqualToAnchor:self.contentView.leadingAnchor],
    [connectButton.trailingAnchor constraintEqualToAnchor:self.contentView.trailingAnchor],
    [connectButton.heightAnchor constraintEqualToConstant:50],

    [featuresTitle.topAnchor constraintEqualToAnchor:connectButton.bottomAnchor constant:24],
    [featuresTitle.leadingAnchor constraintEqualToAnchor:self.contentView.leadingAnchor],

    [featuresStack.topAnchor constraintEqualToAnchor:featuresTitle.bottomAnchor constant:8],
    [featuresStack.leadingAnchor constraintEqualToAnchor:self.contentView.leadingAnchor]
  ]];
}

#pragma mark - Actions

- (void)closeModal {
  self.manager.paymentsModalPresented = NO;
  [self dismissViewControllerAnimated:YES completion:nil];
}

- (void)checkConnectionStatus {
  // Read clerkId from NSUserDefaults (saved by React Native AsyncStorage)
  NSString *clerkId = [[NSUserDefaults standardUserDefaults] stringForKey:@"CLERK_USER_ID"];

  if (!clerkId) {
    self.isLoading = NO;
    self.isConnected = NO;
    [self updateContentView];
    return;
  }

  NSString *checkURL = [NSString stringWithFormat:@"%@/api/oauth/revenuecat?clerkId=%@", [EXEnvBridge v0ApiUrl], clerkId];

  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:[NSURL URLWithString:checkURL]];
  request.HTTPMethod = @"GET";

  __weak typeof(self) weakSelf = self;

  NSURLSessionDataTask *task = [[NSURLSession sharedSession] dataTaskWithRequest:request completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
    dispatch_async(dispatch_get_main_queue(), ^{
      __strong typeof(weakSelf) strongSelf = weakSelf;
      if (!strongSelf) return;

      strongSelf.isLoading = NO;

      if (error || !data) {
        strongSelf.isConnected = NO;
        [strongSelf updateContentView];
        return;
      }

      NSError *parseError;
      NSDictionary *result = [NSJSONSerialization JSONObjectWithData:data options:0 error:&parseError];

      if (parseError) {
        strongSelf.isConnected = NO;
        [strongSelf updateContentView];
        return;
      }

      strongSelf.isConnected = [result[@"connected"] boolValue];
      strongSelf.isExpired = [result[@"isExpired"] boolValue];
      strongSelf.manager.isRevenueCatConnected = strongSelf.isConnected;
      strongSelf.manager.isRevenueCatExpired = strongSelf.isExpired;

      // If we just connected successfully, add message to chat and close modal
      if (strongSelf.wasJustConnecting && strongSelf.isConnected) {
        strongSelf.wasJustConnecting = NO;  // Reset flag

        // Add message to chat input
        if ([strongSelf.manager respondsToSelector:@selector(appendToInput:)]) {
          NSString *message = @"RevenueCat is now connected! You can enable in-app purchases and subscriptions for this app. ";
          [strongSelf.manager performSelector:@selector(appendToInput:) withObject:message];
        }

        // Show success feedback and close modal
        UINotificationFeedbackGenerator *feedback = [[UINotificationFeedbackGenerator alloc] init];
        [feedback notificationOccurred:UINotificationFeedbackTypeSuccess];

        [strongSelf closeModal];
        return;
      }

      strongSelf.wasJustConnecting = NO;  // Reset flag even if not connected
      [strongSelf updateContentView];
    });
  }];

  [task resume];
}

- (void)connectRevenueCat {
  // Read clerkId from NSUserDefaults (saved by React Native AsyncStorage)
  NSString *clerkId = [[NSUserDefaults standardUserDefaults] stringForKey:@"CLERK_USER_ID"];

  if (!clerkId) {
    [self showError:@"Please sign in to connect RevenueCat"];
    return;
  }

  self.isConnecting = YES;
  [self updateContentView];

  // Get OAuth URL from backend
  NSString *oauthURL = [NSString stringWithFormat:@"%@/api/oauth/revenuecat", [EXEnvBridge v0ApiUrl]];

  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:[NSURL URLWithString:oauthURL]];
  request.HTTPMethod = @"POST";
  [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];

  NSDictionary *body = @{@"clerkId": clerkId};
  request.HTTPBody = [NSJSONSerialization dataWithJSONObject:body options:0 error:nil];

  __weak typeof(self) weakSelf = self;

  NSURLSessionDataTask *task = [[NSURLSession sharedSession] dataTaskWithRequest:request completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
    dispatch_async(dispatch_get_main_queue(), ^{
      __strong typeof(weakSelf) strongSelf = weakSelf;
      if (!strongSelf) return;

      if (error || !data) {
        strongSelf.isConnecting = NO;
        [strongSelf updateContentView];
        [strongSelf showError:@"Failed to initiate OAuth"];
        return;
      }

      NSError *parseError;
      NSDictionary *result = [NSJSONSerialization JSONObjectWithData:data options:0 error:&parseError];

      if (parseError || !result[@"authUrl"]) {
        strongSelf.isConnecting = NO;
        [strongSelf updateContentView];
        [strongSelf showError:@"Failed to get OAuth URL"];
        return;
      }

      NSString *authUrlString = result[@"authUrl"];
      [strongSelf startOAuthFlow:authUrlString];
    });
  }];

  [task resume];
}

- (void)startOAuthFlow:(NSString *)authUrlString API_AVAILABLE(ios(12.0)) {
  NSURL *authURL = [NSURL URLWithString:authUrlString];

  __weak typeof(self) weakSelf = self;

  self.authSession = [[ASWebAuthenticationSession alloc]
      initWithURL:authURL
      callbackURLScheme:@"vibracodeapp"
      completionHandler:^(NSURL *callbackURL, NSError *error) {
        dispatch_async(dispatch_get_main_queue(), ^{
          __strong typeof(weakSelf) strongSelf = weakSelf;
          if (!strongSelf) return;

          strongSelf.isConnecting = NO;

          if (error) {
            if (error.code != ASWebAuthenticationSessionErrorCodeCanceledLogin) {
              [strongSelf showError:@"OAuth flow failed"];
            }
            [strongSelf updateContentView];
            return;
          }

          // OAuth successful, re-check connection status
          strongSelf.isLoading = YES;
          strongSelf.wasJustConnecting = YES;  // Mark that we just attempted connection
          [strongSelf updateContentView];

          dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(1.0 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
            [strongSelf checkConnectionStatus];
          });
        });
      }];

  if (@available(iOS 13.0, *)) {
    self.authSession.presentationContextProvider = self;
  }

  [self.authSession start];
}

- (void)disconnectRevenueCat {
  // Read clerkId from NSUserDefaults (saved by React Native AsyncStorage)
  NSString *clerkId = [[NSUserDefaults standardUserDefaults] stringForKey:@"CLERK_USER_ID"];

  if (!clerkId) {
    return;
  }

  UIAlertController *alert = [UIAlertController alertControllerWithTitle:@"Disconnect RevenueCat"
                                                                 message:@"Are you sure you want to disconnect your RevenueCat account?"
                                                          preferredStyle:UIAlertControllerStyleAlert];

  [alert addAction:[UIAlertAction actionWithTitle:@"Cancel" style:UIAlertActionStyleCancel handler:nil]];
  [alert addAction:[UIAlertAction actionWithTitle:@"Disconnect" style:UIAlertActionStyleDestructive handler:^(UIAlertAction *action) {
    [self performDisconnect:clerkId];
  }]];

  [self presentViewController:alert animated:YES completion:nil];
}

- (void)performDisconnect:(NSString *)clerkId {
  NSString *disconnectURL = [NSString stringWithFormat:@"%@/api/oauth/revenuecat/disconnect", [EXEnvBridge v0ApiUrl]];

  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:[NSURL URLWithString:disconnectURL]];
  request.HTTPMethod = @"POST";
  [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];

  NSDictionary *body = @{@"clerkId": clerkId};
  request.HTTPBody = [NSJSONSerialization dataWithJSONObject:body options:0 error:nil];

  __weak typeof(self) weakSelf = self;

  NSURLSessionDataTask *task = [[NSURLSession sharedSession] dataTaskWithRequest:request completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
    dispatch_async(dispatch_get_main_queue(), ^{
      __strong typeof(weakSelf) strongSelf = weakSelf;
      if (!strongSelf) return;

      strongSelf.isConnected = NO;
      strongSelf.isExpired = NO;
      strongSelf.manager.isRevenueCatConnected = NO;
      strongSelf.manager.isRevenueCatExpired = NO;
      [strongSelf updateContentView];
    });
  }];

  [task resume];
}

- (void)setupMcp {
  // Read clerkId from NSUserDefaults (saved by React Native AsyncStorage)
  NSString *clerkId = [[NSUserDefaults standardUserDefaults] stringForKey:@"CLERK_USER_ID"];

  NSString *sessionId = self.manager.chatSessionId;

  if (!clerkId || !sessionId) {
    [self showError:@"No active session. Start a build first."];
    return;
  }

  NSString *setupURL = [NSString stringWithFormat:@"%@/api/oauth/revenuecat/setup-mcp", [EXEnvBridge v0ApiUrl]];

  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:[NSURL URLWithString:setupURL]];
  request.HTTPMethod = @"POST";
  [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];

  NSDictionary *body = @{
    @"clerkId": clerkId,
    @"sessionId": sessionId
  };
  request.HTTPBody = [NSJSONSerialization dataWithJSONObject:body options:0 error:nil];

  __weak typeof(self) weakSelf = self;

  NSURLSessionDataTask *task = [[NSURLSession sharedSession] dataTaskWithRequest:request completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
    dispatch_async(dispatch_get_main_queue(), ^{
      __strong typeof(weakSelf) strongSelf = weakSelf;
      if (!strongSelf) return;

      if (error || !data) {
        [strongSelf showError:@"Failed to enable RevenueCat"];
        return;
      }

      NSError *parseError;
      NSDictionary *result = [NSJSONSerialization JSONObjectWithData:data options:0 error:&parseError];

      if ([result[@"success"] boolValue]) {
        UIAlertController *alert = [UIAlertController alertControllerWithTitle:@"Success"
                                                                       message:@"RevenueCat enabled! Send a message to use payment tools."
                                                                preferredStyle:UIAlertControllerStyleAlert];
        [alert addAction:[UIAlertAction actionWithTitle:@"OK" style:UIAlertActionStyleDefault handler:nil]];
        [strongSelf presentViewController:alert animated:YES completion:nil];
      } else if ([result[@"needsReauth"] boolValue]) {
        strongSelf.isConnected = NO;
        strongSelf.isExpired = YES;
        [strongSelf updateContentView];
        [strongSelf showError:@"Session expired. Please reconnect."];
      } else {
        [strongSelf showError:result[@"error"] ?: @"Failed to enable RevenueCat"];
      }
    });
  }];

  [task resume];
}

- (void)showError:(NSString *)message {
  UIAlertController *alert = [UIAlertController alertControllerWithTitle:@"Error"
                                                                 message:message
                                                          preferredStyle:UIAlertControllerStyleAlert];
  [alert addAction:[UIAlertAction actionWithTitle:@"OK" style:UIAlertActionStyleDefault handler:nil]];
  [self presentViewController:alert animated:YES completion:nil];
}

#pragma mark - ASWebAuthenticationPresentationContextProviding

- (ASPresentationAnchor)presentationAnchorForWebAuthenticationSession:(ASWebAuthenticationSession *)session API_AVAILABLE(ios(12.0)) {
  return self.view.window;
}

@end
