// Copyright 2015-present 650 Industries. All rights reserved.

#import "EXPreviewZoomManager+Private.h"
#import "EXPreviewZoomManager.h"
#import "EXChatBackendService.h"
#import <UIKit/UIKit.h>
#import <WebKit/WebKit.h>

// Forward declarations
@class EXDatabaseModalViewController;

// Database Modal View Controller
@interface EXDatabaseModalViewController : UIViewController <UIAdaptivePresentationControllerDelegate, WKNavigationDelegate, UITableViewDataSource, UITableViewDelegate>

@property(nonatomic, weak) EXPreviewZoomManager *manager;
@property(nonatomic, strong) UIVisualEffectView *backgroundView;
@property(nonatomic, strong) UIView *headerView;
@property(nonatomic, strong) UILabel *titleLabel;
@property(nonatomic, strong) UISegmentedControl *dbTypeSelector;
@property(nonatomic, strong) WKWebView *webView;
@property(nonatomic, strong) UIActivityIndicatorView *loadingIndicator;
@property(nonatomic, strong) UIView *selectionView;
@property(nonatomic, strong) UIView *infoView;
@property(nonatomic, strong) UITableView *faqTableView;
@property(nonatomic, strong) NSString *selectedDbType; // "prisma" or "convex"
@property(nonatomic, strong) UILabel *emptyStateLabel;
@property(nonatomic, strong) NSArray<NSDictionary *> *faqItems;
@property(nonatomic, strong) NSMutableSet<NSNumber *> *expandedFAQs;

- (instancetype)initWithManager:(EXPreviewZoomManager *)manager;

@end

// Category implementation
@implementation EXPreviewZoomManager (DatabaseModal)

- (void)showDatabaseModal {
  if (self.databaseModalPresented) {
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

  EXDatabaseModalViewController *modalVC = [[EXDatabaseModalViewController alloc] initWithManager:self];

  UINavigationController *navController = [[UINavigationController alloc] initWithRootViewController:modalVC];
  navController.view.backgroundColor = [UIColor clearColor];
  navController.navigationBarHidden = YES;

  self.databaseModalViewController = navController;

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
  self.databaseModalPresented = YES;
}

@end

// MARK: - EXDatabaseModalViewController Implementation

@implementation EXDatabaseModalViewController

- (instancetype)initWithManager:(EXPreviewZoomManager *)manager {
  self = [super init];
  if (self) {
    _manager = manager;
    _selectedDbType = manager.selectedDatabaseType;
    _expandedFAQs = [NSMutableSet set];
    _faqItems = @[
      @{@"question": @"What is a backend/database?", @"answer": @"A backend stores data that needs to persist or be shared between users. For example, user accounts, posts, messages, or any data that multiple users need to access."},
      @{@"question": @"When do I need one?", @"answer": @"You need a backend if your app requires: user authentication, storing user data, real-time features (chat, live updates), or sharing data between users."},
      @{@"question": @"What if I don't add one?", @"answer": @"Your app will work fine for single-user experiences! Data will be stored locally on the device. Many apps work great without a backend."},
      @{@"question": @"What's the difference between Prisma and Convex?", @"answer": @"Prisma is a traditional database with a SQL backend - great for complex queries. Convex is a real-time database - perfect for chat apps, live collaboration, and instant updates."},
      @{@"question": @"Can I add one later?", @"answer": @"Yes! You can always add a backend later. It's easier to add from the start, but it's definitely possible to migrate your app., you can ask chat to change it later"}
    ];
  }
  return self;
}

- (void)viewDidLoad {
  [super viewDidLoad];

  self.view.backgroundColor = [UIColor clearColor];

  [self setupBackground];
  [self setupHeader];

  if (self.selectedDbType) {
    [self setupWebView];
    [self loadDatabaseDashboard];
  } else {
    [self setupInfoView]; // Show info screen first
  }
}

- (void)viewWillAppear:(BOOL)animated {
  [super viewWillAppear:animated];
  [self.navigationController setNavigationBarHidden:YES animated:animated];
}

- (void)presentationControllerDidDismiss:(UIPresentationController *)presentationController {
  self.manager.databaseModalPresented = NO;
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

  // Title with database icon
  UIImageSymbolConfiguration *dbConfig = [UIImageSymbolConfiguration configurationWithPointSize:22 weight:UIImageSymbolWeightBold];
  UIImage *dbImage = [UIImage systemImageNamed:@"cylinder.split.1x2.fill" withConfiguration:dbConfig];
  UIImageView *dbIcon = [[UIImageView alloc] initWithImage:dbImage];
  dbIcon.tintColor = [UIColor colorWithRed:0.4 green:0.6 blue:0.9 alpha:1.0]; // Blue color
  dbIcon.translatesAutoresizingMaskIntoConstraints = NO;
  [self.headerView addSubview:dbIcon];

  self.titleLabel = [[UILabel alloc] init];
  self.titleLabel.text = @"Database";
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

    [dbIcon.leadingAnchor constraintEqualToAnchor:self.headerView.leadingAnchor constant:20],
    [dbIcon.centerYAnchor constraintEqualToAnchor:self.headerView.centerYAnchor],
    [dbIcon.widthAnchor constraintEqualToConstant:28],
    [dbIcon.heightAnchor constraintEqualToConstant:28],

    [self.titleLabel.leadingAnchor constraintEqualToAnchor:dbIcon.trailingAnchor constant:10],
    [self.titleLabel.centerYAnchor constraintEqualToAnchor:self.headerView.centerYAnchor],

    [closeButton.trailingAnchor constraintEqualToAnchor:self.headerView.trailingAnchor constant:-20],
    [closeButton.centerYAnchor constraintEqualToAnchor:self.headerView.centerYAnchor],
    [closeButton.widthAnchor constraintEqualToConstant:32],
    [closeButton.heightAnchor constraintEqualToConstant:32]
  ]];
}

- (void)setupInfoView {
  self.infoView = [[UIView alloc] init];
  self.infoView.translatesAutoresizingMaskIntoConstraints = NO;
  [self.view addSubview:self.infoView];

  // Main container for centered content
  UIView *contentContainer = [[UIView alloc] init];
  contentContainer.translatesAutoresizingMaskIntoConstraints = NO;
  [self.infoView addSubview:contentContainer];

  // Cloud icon with question mark
  UIImageSymbolConfiguration *iconConfig = [UIImageSymbolConfiguration configurationWithPointSize:56 weight:UIImageSymbolWeightMedium];
  UIImageView *iconView = [[UIImageView alloc] initWithImage:[UIImage systemImageNamed:@"icloud.and.arrow.up" withConfiguration:iconConfig]];
  iconView.tintColor = [UIColor colorWithRed:0.4 green:0.6 blue:0.9 alpha:1.0];
  iconView.translatesAutoresizingMaskIntoConstraints = NO;
  [contentContainer addSubview:iconView];

  // Title
  UILabel *titleLabel = [[UILabel alloc] init];
  titleLabel.text = @"Does your app need a backend?";
  titleLabel.textColor = [UIColor whiteColor];
  titleLabel.font = [UIFont systemFontOfSize:22 weight:UIFontWeightBold];
  titleLabel.textAlignment = NSTextAlignmentCenter;
  titleLabel.translatesAutoresizingMaskIntoConstraints = NO;
  [contentContainer addSubview:titleLabel];

  // Subtitle
  UILabel *subtitleLabel = [[UILabel alloc] init];
  subtitleLabel.text = @"Most apps don't need one! A backend is only required for user accounts, cloud storage, or real-time features.";
  subtitleLabel.textColor = [UIColor colorWithWhite:0.6 alpha:1.0];
  subtitleLabel.font = [UIFont systemFontOfSize:15];
  subtitleLabel.textAlignment = NSTextAlignmentCenter;
  subtitleLabel.numberOfLines = 0;
  subtitleLabel.translatesAutoresizingMaskIntoConstraints = NO;
  [contentContainer addSubview:subtitleLabel];

  // FAQ TableView
  self.faqTableView = [[UITableView alloc] initWithFrame:CGRectZero style:UITableViewStylePlain];
  self.faqTableView.translatesAutoresizingMaskIntoConstraints = NO;
  self.faqTableView.backgroundColor = [UIColor clearColor];
  self.faqTableView.separatorStyle = UITableViewCellSeparatorStyleNone;
  self.faqTableView.delegate = self;
  self.faqTableView.dataSource = self;
  self.faqTableView.showsVerticalScrollIndicator = NO;
  self.faqTableView.scrollEnabled = YES;
  [self.faqTableView registerClass:[UITableViewCell class] forCellReuseIdentifier:@"FAQCell"];
  [contentContainer addSubview:self.faqTableView];

  // Button container for bottom
  UIView *buttonContainer = [[UIView alloc] init];
  buttonContainer.translatesAutoresizingMaskIntoConstraints = NO;
  [self.infoView addSubview:buttonContainer];

  // Skip button (secondary)
  UIButton *skipButton = [UIButton buttonWithType:UIButtonTypeSystem];
  skipButton.translatesAutoresizingMaskIntoConstraints = NO;
  [skipButton setTitle:@"Skip - I don't need one" forState:UIControlStateNormal];
  [skipButton setTitleColor:[UIColor colorWithWhite:0.6 alpha:1.0] forState:UIControlStateNormal];
  skipButton.titleLabel.font = [UIFont systemFontOfSize:15 weight:UIFontWeightMedium];
  [skipButton addTarget:self action:@selector(skipBackend) forControlEvents:UIControlEventTouchUpInside];
  [buttonContainer addSubview:skipButton];

  // Continue button (primary)
  UIButton *continueButton = [UIButton buttonWithType:UIButtonTypeSystem];
  continueButton.translatesAutoresizingMaskIntoConstraints = NO;
  [continueButton setTitle:@"Choose a Backend" forState:UIControlStateNormal];
  [continueButton setTitleColor:[UIColor whiteColor] forState:UIControlStateNormal];
  continueButton.titleLabel.font = [UIFont systemFontOfSize:16 weight:UIFontWeightSemibold];
  continueButton.backgroundColor = [UIColor colorWithRed:0.4 green:0.6 blue:0.9 alpha:1.0];
  continueButton.layer.cornerRadius = 12;
  [continueButton addTarget:self action:@selector(showSelectionView) forControlEvents:UIControlEventTouchUpInside];
  [buttonContainer addSubview:continueButton];

  [NSLayoutConstraint activateConstraints:@[
    [self.infoView.topAnchor constraintEqualToAnchor:self.headerView.bottomAnchor constant:16],
    [self.infoView.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor],
    [self.infoView.trailingAnchor constraintEqualToAnchor:self.view.trailingAnchor],
    [self.infoView.bottomAnchor constraintEqualToAnchor:self.view.safeAreaLayoutGuide.bottomAnchor],

    // Content container
    [contentContainer.topAnchor constraintEqualToAnchor:self.infoView.topAnchor],
    [contentContainer.leadingAnchor constraintEqualToAnchor:self.infoView.leadingAnchor constant:24],
    [contentContainer.trailingAnchor constraintEqualToAnchor:self.infoView.trailingAnchor constant:-24],
    [contentContainer.bottomAnchor constraintEqualToAnchor:buttonContainer.topAnchor constant:-16],

    // Icon
    [iconView.topAnchor constraintEqualToAnchor:contentContainer.topAnchor constant:20],
    [iconView.centerXAnchor constraintEqualToAnchor:contentContainer.centerXAnchor],

    // Title
    [titleLabel.topAnchor constraintEqualToAnchor:iconView.bottomAnchor constant:20],
    [titleLabel.leadingAnchor constraintEqualToAnchor:contentContainer.leadingAnchor],
    [titleLabel.trailingAnchor constraintEqualToAnchor:contentContainer.trailingAnchor],

    // Subtitle
    [subtitleLabel.topAnchor constraintEqualToAnchor:titleLabel.bottomAnchor constant:12],
    [subtitleLabel.leadingAnchor constraintEqualToAnchor:contentContainer.leadingAnchor],
    [subtitleLabel.trailingAnchor constraintEqualToAnchor:contentContainer.trailingAnchor],

    // FAQ TableView
    [self.faqTableView.topAnchor constraintEqualToAnchor:subtitleLabel.bottomAnchor constant:24],
    [self.faqTableView.leadingAnchor constraintEqualToAnchor:contentContainer.leadingAnchor],
    [self.faqTableView.trailingAnchor constraintEqualToAnchor:contentContainer.trailingAnchor],
    [self.faqTableView.bottomAnchor constraintEqualToAnchor:contentContainer.bottomAnchor],

    // Button container
    [buttonContainer.leadingAnchor constraintEqualToAnchor:self.infoView.leadingAnchor constant:24],
    [buttonContainer.trailingAnchor constraintEqualToAnchor:self.infoView.trailingAnchor constant:-24],
    [buttonContainer.bottomAnchor constraintEqualToAnchor:self.infoView.bottomAnchor constant:-16],
    [buttonContainer.heightAnchor constraintEqualToConstant:100],

    // Skip button
    [skipButton.topAnchor constraintEqualToAnchor:buttonContainer.topAnchor],
    [skipButton.centerXAnchor constraintEqualToAnchor:buttonContainer.centerXAnchor],

    // Continue button
    [continueButton.topAnchor constraintEqualToAnchor:skipButton.bottomAnchor constant:12],
    [continueButton.leadingAnchor constraintEqualToAnchor:buttonContainer.leadingAnchor],
    [continueButton.trailingAnchor constraintEqualToAnchor:buttonContainer.trailingAnchor],
    [continueButton.heightAnchor constraintEqualToConstant:50]
  ]];
}

- (void)showSelectionView {
  // Animate transition from info view to selection view
  [UIView animateWithDuration:0.3 animations:^{
    self.infoView.alpha = 0;
  } completion:^(BOOL finished) {
    [self.infoView removeFromSuperview];
    self.infoView = nil;
    [self setupSelectionView];
    self.selectionView.alpha = 0;
    [UIView animateWithDuration:0.3 animations:^{
      self.selectionView.alpha = 1;
    }];
  }];
}

- (void)skipBackend {
  // Close modal without selecting a database
  UINotificationFeedbackGenerator *feedback = [[UINotificationFeedbackGenerator alloc] init];
  [feedback notificationOccurred:UINotificationFeedbackTypeSuccess];
  [self closeModal];
}

#pragma mark - UITableViewDataSource

- (NSInteger)tableView:(UITableView *)tableView numberOfRowsInSection:(NSInteger)section {
  return self.faqItems.count;
}

- (UITableViewCell *)tableView:(UITableView *)tableView cellForRowAtIndexPath:(NSIndexPath *)indexPath {
  UITableViewCell *cell = [tableView dequeueReusableCellWithIdentifier:@"FAQCell" forIndexPath:indexPath];

  // Clear existing content
  for (UIView *subview in cell.contentView.subviews) {
    [subview removeFromSuperview];
  }

  cell.backgroundColor = [UIColor clearColor];
  cell.selectionStyle = UITableViewCellSelectionStyleNone;

  NSDictionary *faqItem = self.faqItems[indexPath.row];
  BOOL isExpanded = [self.expandedFAQs containsObject:@(indexPath.row)];

  // Container view with background
  UIView *containerView = [[UIView alloc] init];
  containerView.translatesAutoresizingMaskIntoConstraints = NO;
  containerView.backgroundColor = [UIColor colorWithWhite:0.15 alpha:1.0];
  containerView.layer.cornerRadius = 12;
  [cell.contentView addSubview:containerView];

  // Chevron icon
  UIImageSymbolConfiguration *chevronConfig = [UIImageSymbolConfiguration configurationWithPointSize:14 weight:UIImageSymbolWeightMedium];
  NSString *chevronName = isExpanded ? @"chevron.up" : @"chevron.down";
  UIImageView *chevronView = [[UIImageView alloc] initWithImage:[UIImage systemImageNamed:chevronName withConfiguration:chevronConfig]];
  chevronView.tintColor = [UIColor colorWithWhite:0.5 alpha:1.0];
  chevronView.translatesAutoresizingMaskIntoConstraints = NO;
  [containerView addSubview:chevronView];

  // Question label
  UILabel *questionLabel = [[UILabel alloc] init];
  questionLabel.text = faqItem[@"question"];
  questionLabel.textColor = [UIColor whiteColor];
  questionLabel.font = [UIFont systemFontOfSize:15 weight:UIFontWeightMedium];
  questionLabel.numberOfLines = 0;
  questionLabel.translatesAutoresizingMaskIntoConstraints = NO;
  [containerView addSubview:questionLabel];

  // Answer label (only if expanded)
  UILabel *answerLabel = nil;
  if (isExpanded) {
    answerLabel = [[UILabel alloc] init];
    answerLabel.text = faqItem[@"answer"];
    answerLabel.textColor = [UIColor colorWithWhite:0.7 alpha:1.0];
    answerLabel.font = [UIFont systemFontOfSize:14];
    answerLabel.numberOfLines = 0;
    answerLabel.translatesAutoresizingMaskIntoConstraints = NO;
    [containerView addSubview:answerLabel];
  }

  [NSLayoutConstraint activateConstraints:@[
    [containerView.topAnchor constraintEqualToAnchor:cell.contentView.topAnchor constant:4],
    [containerView.leadingAnchor constraintEqualToAnchor:cell.contentView.leadingAnchor],
    [containerView.trailingAnchor constraintEqualToAnchor:cell.contentView.trailingAnchor],
    [containerView.bottomAnchor constraintEqualToAnchor:cell.contentView.bottomAnchor constant:-4],

    [chevronView.trailingAnchor constraintEqualToAnchor:containerView.trailingAnchor constant:-16],
    [chevronView.topAnchor constraintEqualToAnchor:containerView.topAnchor constant:16],

    [questionLabel.topAnchor constraintEqualToAnchor:containerView.topAnchor constant:14],
    [questionLabel.leadingAnchor constraintEqualToAnchor:containerView.leadingAnchor constant:16],
    [questionLabel.trailingAnchor constraintEqualToAnchor:chevronView.leadingAnchor constant:-12]
  ]];

  if (answerLabel) {
    [NSLayoutConstraint activateConstraints:@[
      [answerLabel.topAnchor constraintEqualToAnchor:questionLabel.bottomAnchor constant:10],
      [answerLabel.leadingAnchor constraintEqualToAnchor:containerView.leadingAnchor constant:16],
      [answerLabel.trailingAnchor constraintEqualToAnchor:containerView.trailingAnchor constant:-16],
      [answerLabel.bottomAnchor constraintEqualToAnchor:containerView.bottomAnchor constant:-14]
    ]];
  } else {
    [NSLayoutConstraint activateConstraints:@[
      [questionLabel.bottomAnchor constraintEqualToAnchor:containerView.bottomAnchor constant:-14]
    ]];
  }

  return cell;
}

#pragma mark - UITableViewDelegate

- (void)tableView:(UITableView *)tableView didSelectRowAtIndexPath:(NSIndexPath *)indexPath {
  UIImpactFeedbackGenerator *feedback = [[UIImpactFeedbackGenerator alloc] initWithStyle:UIImpactFeedbackStyleLight];
  [feedback impactOccurred];

  NSNumber *indexNumber = @(indexPath.row);
  if ([self.expandedFAQs containsObject:indexNumber]) {
    [self.expandedFAQs removeObject:indexNumber];
  } else {
    [self.expandedFAQs addObject:indexNumber];
  }

  [tableView reloadRowsAtIndexPaths:@[indexPath] withRowAnimation:UITableViewRowAnimationAutomatic];
}

- (CGFloat)tableView:(UITableView *)tableView heightForRowAtIndexPath:(NSIndexPath *)indexPath {
  return UITableViewAutomaticDimension;
}

- (CGFloat)tableView:(UITableView *)tableView estimatedHeightForRowAtIndexPath:(NSIndexPath *)indexPath {
  BOOL isExpanded = [self.expandedFAQs containsObject:@(indexPath.row)];
  return isExpanded ? 120 : 56;
}

#pragma mark - Selection View

- (void)setupSelectionView {
  self.selectionView = [[UIView alloc] init];
  self.selectionView.translatesAutoresizingMaskIntoConstraints = NO;
  [self.view addSubview:self.selectionView];

  // Database icon
  UIImageSymbolConfiguration *iconConfig = [UIImageSymbolConfiguration configurationWithPointSize:48 weight:UIImageSymbolWeightMedium];
  UIImageView *iconView = [[UIImageView alloc] initWithImage:[UIImage systemImageNamed:@"cylinder.split.1x2.fill" withConfiguration:iconConfig]];
  iconView.tintColor = [UIColor colorWithRed:0.4 green:0.6 blue:0.9 alpha:1.0];
  iconView.translatesAutoresizingMaskIntoConstraints = NO;
  [self.selectionView addSubview:iconView];

  // Title
  UILabel *titleLabel = [[UILabel alloc] init];
  titleLabel.text = @"Choose Your Database";
  titleLabel.textColor = [UIColor whiteColor];
  titleLabel.font = [UIFont systemFontOfSize:20 weight:UIFontWeightBold];
  titleLabel.translatesAutoresizingMaskIntoConstraints = NO;
  [self.selectionView addSubview:titleLabel];

  // Subtitle
  UILabel *subtitleLabel = [[UILabel alloc] init];
  subtitleLabel.text = @"Select a database solution for your app";
  subtitleLabel.textColor = [UIColor colorWithWhite:0.6 alpha:1.0];
  subtitleLabel.font = [UIFont systemFontOfSize:14];
  subtitleLabel.translatesAutoresizingMaskIntoConstraints = NO;
  [self.selectionView addSubview:subtitleLabel];

  // Prisma button
  UIButton *prismaButton = [self createDatabaseOptionButton:@"Prisma + PostgreSQL"
                                                description:@"Type-safe ORM with Prisma Studio"
                                                      color:[UIColor colorWithRed:0.3 green:0.5 blue:0.9 alpha:1.0]
                                                     action:@selector(selectPrisma)];
  prismaButton.translatesAutoresizingMaskIntoConstraints = NO;
  [self.selectionView addSubview:prismaButton];

  // Convex button
  UIButton *convexButton = [self createDatabaseOptionButton:@"Convex"
                                                description:@"Real-time database with live queries"
                                                      color:[UIColor colorWithRed:0.9 green:0.5 blue:0.3 alpha:1.0]
                                                     action:@selector(selectConvex)];
  convexButton.translatesAutoresizingMaskIntoConstraints = NO;
  [self.selectionView addSubview:convexButton];

  [NSLayoutConstraint activateConstraints:@[
    [self.selectionView.topAnchor constraintEqualToAnchor:self.headerView.bottomAnchor constant:60],
    [self.selectionView.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor constant:32],
    [self.selectionView.trailingAnchor constraintEqualToAnchor:self.view.trailingAnchor constant:-32],
    [self.selectionView.bottomAnchor constraintEqualToAnchor:self.view.safeAreaLayoutGuide.bottomAnchor],

    [iconView.topAnchor constraintEqualToAnchor:self.selectionView.topAnchor],
    [iconView.centerXAnchor constraintEqualToAnchor:self.selectionView.centerXAnchor],

    [titleLabel.topAnchor constraintEqualToAnchor:iconView.bottomAnchor constant:20],
    [titleLabel.centerXAnchor constraintEqualToAnchor:self.selectionView.centerXAnchor],

    [subtitleLabel.topAnchor constraintEqualToAnchor:titleLabel.bottomAnchor constant:8],
    [subtitleLabel.centerXAnchor constraintEqualToAnchor:self.selectionView.centerXAnchor],

    [prismaButton.topAnchor constraintEqualToAnchor:subtitleLabel.bottomAnchor constant:32],
    [prismaButton.leadingAnchor constraintEqualToAnchor:self.selectionView.leadingAnchor],
    [prismaButton.trailingAnchor constraintEqualToAnchor:self.selectionView.trailingAnchor],
    [prismaButton.heightAnchor constraintEqualToConstant:80],

    [convexButton.topAnchor constraintEqualToAnchor:prismaButton.bottomAnchor constant:16],
    [convexButton.leadingAnchor constraintEqualToAnchor:self.selectionView.leadingAnchor],
    [convexButton.trailingAnchor constraintEqualToAnchor:self.selectionView.trailingAnchor],
    [convexButton.heightAnchor constraintEqualToConstant:80]
  ]];
}

- (UIButton *)createDatabaseOptionButton:(NSString *)title description:(NSString *)description color:(UIColor *)color action:(SEL)action {
  UIButton *button = [UIButton buttonWithType:UIButtonTypeCustom];
  button.backgroundColor = [UIColor colorWithWhite:0.15 alpha:1.0];
  button.layer.cornerRadius = 12;
  button.layer.borderWidth = 1;
  button.layer.borderColor = [UIColor colorWithWhite:0.25 alpha:1.0].CGColor;
  [button addTarget:self action:action forControlEvents:UIControlEventTouchUpInside];

  // Icon container
  UIView *iconContainer = [[UIView alloc] init];
  iconContainer.translatesAutoresizingMaskIntoConstraints = NO;
  iconContainer.backgroundColor = color;
  iconContainer.layer.cornerRadius = 8;
  iconContainer.userInteractionEnabled = NO;
  [button addSubview:iconContainer];

  UIImageSymbolConfiguration *iconConfig = [UIImageSymbolConfiguration configurationWithPointSize:18 weight:UIImageSymbolWeightMedium];
  UIImageView *iconView = [[UIImageView alloc] initWithImage:[UIImage systemImageNamed:@"cylinder.split.1x2" withConfiguration:iconConfig]];
  iconView.tintColor = [UIColor whiteColor];
  iconView.translatesAutoresizingMaskIntoConstraints = NO;
  [iconContainer addSubview:iconView];

  // Title label
  UILabel *titleLabel = [[UILabel alloc] init];
  titleLabel.text = title;
  titleLabel.textColor = [UIColor whiteColor];
  titleLabel.font = [UIFont systemFontOfSize:16 weight:UIFontWeightSemibold];
  titleLabel.translatesAutoresizingMaskIntoConstraints = NO;
  titleLabel.userInteractionEnabled = NO;
  [button addSubview:titleLabel];

  // Description label
  UILabel *descLabel = [[UILabel alloc] init];
  descLabel.text = description;
  descLabel.textColor = [UIColor colorWithWhite:0.6 alpha:1.0];
  descLabel.font = [UIFont systemFontOfSize:13];
  descLabel.translatesAutoresizingMaskIntoConstraints = NO;
  descLabel.userInteractionEnabled = NO;
  [button addSubview:descLabel];

  [NSLayoutConstraint activateConstraints:@[
    [iconContainer.leadingAnchor constraintEqualToAnchor:button.leadingAnchor constant:16],
    [iconContainer.centerYAnchor constraintEqualToAnchor:button.centerYAnchor],
    [iconContainer.widthAnchor constraintEqualToConstant:40],
    [iconContainer.heightAnchor constraintEqualToConstant:40],

    [iconView.centerXAnchor constraintEqualToAnchor:iconContainer.centerXAnchor],
    [iconView.centerYAnchor constraintEqualToAnchor:iconContainer.centerYAnchor],

    [titleLabel.leadingAnchor constraintEqualToAnchor:iconContainer.trailingAnchor constant:16],
    [titleLabel.topAnchor constraintEqualToAnchor:button.topAnchor constant:18],

    [descLabel.leadingAnchor constraintEqualToAnchor:titleLabel.leadingAnchor],
    [descLabel.topAnchor constraintEqualToAnchor:titleLabel.bottomAnchor constant:4]
  ]];

  return button;
}

- (void)setupWebView {
  // Toolbar with refresh and open in Safari buttons
  UIView *toolbar = [[UIView alloc] init];
  toolbar.translatesAutoresizingMaskIntoConstraints = NO;
  toolbar.backgroundColor = [UIColor colorWithWhite:0.12 alpha:1.0];
  toolbar.tag = 200;
  [self.view addSubview:toolbar];

  // Database type label
  UILabel *dbTypeLabel = [[UILabel alloc] init];
  dbTypeLabel.text = [self.selectedDbType isEqualToString:@"prisma"] ? @"Prisma Studio" : @"Convex Dashboard";
  dbTypeLabel.textColor = [UIColor whiteColor];
  dbTypeLabel.font = [UIFont systemFontOfSize:14 weight:UIFontWeightMedium];
  dbTypeLabel.translatesAutoresizingMaskIntoConstraints = NO;
  [toolbar addSubview:dbTypeLabel];

  // Refresh button
  UIButton *refreshButton = [UIButton buttonWithType:UIButtonTypeSystem];
  refreshButton.translatesAutoresizingMaskIntoConstraints = NO;
  UIImageSymbolConfiguration *refreshConfig = [UIImageSymbolConfiguration configurationWithPointSize:16 weight:UIImageSymbolWeightMedium];
  [refreshButton setImage:[UIImage systemImageNamed:@"arrow.clockwise" withConfiguration:refreshConfig] forState:UIControlStateNormal];
  refreshButton.tintColor = [UIColor colorWithWhite:0.8 alpha:1.0];
  [refreshButton addTarget:self action:@selector(refreshWebView) forControlEvents:UIControlEventTouchUpInside];
  [toolbar addSubview:refreshButton];

  // Open in Safari button
  UIButton *safariButton = [UIButton buttonWithType:UIButtonTypeSystem];
  safariButton.translatesAutoresizingMaskIntoConstraints = NO;
  UIImageSymbolConfiguration *safariConfig = [UIImageSymbolConfiguration configurationWithPointSize:16 weight:UIImageSymbolWeightMedium];
  [safariButton setImage:[UIImage systemImageNamed:@"safari" withConfiguration:safariConfig] forState:UIControlStateNormal];
  safariButton.tintColor = [UIColor colorWithWhite:0.8 alpha:1.0];
  [safariButton addTarget:self action:@selector(openInSafari) forControlEvents:UIControlEventTouchUpInside];
  [toolbar addSubview:safariButton];

  // WebView configuration
  WKWebViewConfiguration *config = [[WKWebViewConfiguration alloc] init];
  config.allowsInlineMediaPlayback = YES;

  self.webView = [[WKWebView alloc] initWithFrame:CGRectZero configuration:config];
  self.webView.translatesAutoresizingMaskIntoConstraints = NO;
  self.webView.navigationDelegate = self;
  self.webView.backgroundColor = [UIColor colorWithWhite:0.1 alpha:1.0];
  self.webView.scrollView.backgroundColor = [UIColor colorWithWhite:0.1 alpha:1.0];
  [self.view addSubview:self.webView];

  // Loading indicator
  self.loadingIndicator = [[UIActivityIndicatorView alloc] initWithActivityIndicatorStyle:UIActivityIndicatorViewStyleLarge];
  self.loadingIndicator.translatesAutoresizingMaskIntoConstraints = NO;
  self.loadingIndicator.hidesWhenStopped = YES;
  self.loadingIndicator.color = [UIColor colorWithRed:0.4 green:0.6 blue:0.9 alpha:1.0];
  [self.view addSubview:self.loadingIndicator];

  [NSLayoutConstraint activateConstraints:@[
    [toolbar.topAnchor constraintEqualToAnchor:self.headerView.bottomAnchor constant:8],
    [toolbar.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor],
    [toolbar.trailingAnchor constraintEqualToAnchor:self.view.trailingAnchor],
    [toolbar.heightAnchor constraintEqualToConstant:44],

    [dbTypeLabel.leadingAnchor constraintEqualToAnchor:toolbar.leadingAnchor constant:16],
    [dbTypeLabel.centerYAnchor constraintEqualToAnchor:toolbar.centerYAnchor],

    [safariButton.trailingAnchor constraintEqualToAnchor:toolbar.trailingAnchor constant:-16],
    [safariButton.centerYAnchor constraintEqualToAnchor:toolbar.centerYAnchor],

    [refreshButton.trailingAnchor constraintEqualToAnchor:safariButton.leadingAnchor constant:-16],
    [refreshButton.centerYAnchor constraintEqualToAnchor:toolbar.centerYAnchor],

    [self.webView.topAnchor constraintEqualToAnchor:toolbar.bottomAnchor],
    [self.webView.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor],
    [self.webView.trailingAnchor constraintEqualToAnchor:self.view.trailingAnchor],
    [self.webView.bottomAnchor constraintEqualToAnchor:self.view.safeAreaLayoutGuide.bottomAnchor],

    [self.loadingIndicator.centerXAnchor constraintEqualToAnchor:self.webView.centerXAnchor],
    [self.loadingIndicator.centerYAnchor constraintEqualToAnchor:self.webView.centerYAnchor]
  ]];
}

#pragma mark - Actions

- (void)closeModal {
  self.manager.databaseModalPresented = NO;
  [self dismissViewControllerAnimated:YES completion:nil];
}

- (void)selectPrisma {
  self.selectedDbType = @"prisma";
  self.manager.selectedDatabaseType = @"prisma";

  // Add message to chat input and close modal
  [self addDatabaseSetupToInputAndClose:@"Enable backend with Prisma database and Hono.ts server with tRPC routes. Start Prisma Studio on port 5555. "];
}

- (void)selectConvex {
  self.selectedDbType = @"convex";
  self.manager.selectedDatabaseType = @"convex";

  // Add message to chat input and close modal
  [self addDatabaseSetupToInputAndClose:@"Enable backend with Convex database. Set up real-time sync, schema definitions, queries, and mutations. "];
}

- (void)addDatabaseSetupToInputAndClose:(NSString *)message {
  // Add message to chat input (not send directly)
  if ([self.manager respondsToSelector:@selector(appendToInput:)]) {
    [self.manager performSelector:@selector(appendToInput:) withObject:message];
  }

  // Show success feedback
  UINotificationFeedbackGenerator *feedback = [[UINotificationFeedbackGenerator alloc] init];
  [feedback notificationOccurred:UINotificationFeedbackTypeSuccess];

  // Close modal
  [self closeModal];
}

- (void)sendDatabaseSetupMessage:(NSString *)message {
  // Use the manager's sendChatMessage method if available
  if ([self.manager respondsToSelector:@selector(sendChatMessage:)]) {
    [self.manager performSelector:@selector(sendChatMessage:) withObject:message];
  }
}

- (void)loadDatabaseDashboard {
  NSString *tunnelUrl = self.manager.tunnelUrl;

  if (!tunnelUrl) {
    // Show empty state
    self.emptyStateLabel = [[UILabel alloc] init];
    self.emptyStateLabel.text = @"No session active.\nStart a build to access the database dashboard.";
    self.emptyStateLabel.textColor = [UIColor colorWithWhite:0.5 alpha:1.0];
    self.emptyStateLabel.font = [UIFont systemFontOfSize:16];
    self.emptyStateLabel.textAlignment = NSTextAlignmentCenter;
    self.emptyStateLabel.numberOfLines = 0;
    self.emptyStateLabel.translatesAutoresizingMaskIntoConstraints = NO;
    [self.webView addSubview:self.emptyStateLabel];

    [NSLayoutConstraint activateConstraints:@[
      [self.emptyStateLabel.centerXAnchor constraintEqualToAnchor:self.webView.centerXAnchor],
      [self.emptyStateLabel.centerYAnchor constraintEqualToAnchor:self.webView.centerYAnchor],
      [self.emptyStateLabel.leadingAnchor constraintEqualToAnchor:self.webView.leadingAnchor constant:40],
      [self.emptyStateLabel.trailingAnchor constraintEqualToAnchor:self.webView.trailingAnchor constant:-40]
    ]];
    return;
  }

  [self.loadingIndicator startAnimating];

  // Build database URL from tunnel URL
  NSString *dbUrl = [self getDatabaseUrlFromTunnel:tunnelUrl];

  if (dbUrl) {
    NSURL *url = [NSURL URLWithString:dbUrl];
    NSURLRequest *request = [NSURLRequest requestWithURL:url];
    [self.webView loadRequest:request];
  }
}

- (NSString *)getDatabaseUrlFromTunnel:(NSString *)tunnelUrl {
  NSURL *url = [NSURL URLWithString:tunnelUrl];
  if (!url) return nil;

  NSString *hostname = url.host;
  NSString *port = [self.selectedDbType isEqualToString:@"convex"] ? @"6790" : @"5555";

  // Replace the port prefix in the hostname
  // e.g., "80-xxx.devtunnels.ms" -> "6790-xxx.devtunnels.ms"
  NSRegularExpression *regex = [NSRegularExpression regularExpressionWithPattern:@"^\\d+-" options:0 error:nil];
  NSString *newHostname = [regex stringByReplacingMatchesInString:hostname
                                                          options:0
                                                            range:NSMakeRange(0, hostname.length)
                                                     withTemplate:[NSString stringWithFormat:@"%@-", port]];

  NSURLComponents *components = [[NSURLComponents alloc] init];
  components.scheme = @"https";
  components.host = newHostname;

  // Add query parameter for Convex dashboard
  if ([self.selectedDbType isEqualToString:@"convex"]) {
    components.queryItems = @[[NSURLQueryItem queryItemWithName:@"d" value:@"anonymous-agent"]];
  }

  return components.URL.absoluteString;
}

- (void)refreshWebView {
  [self.loadingIndicator startAnimating];
  [self.webView reload];
}

- (void)openInSafari {
  NSURL *currentURL = self.webView.URL;
  if (currentURL) {
    [[UIApplication sharedApplication] openURL:currentURL options:@{} completionHandler:nil];
  }
}

#pragma mark - WKNavigationDelegate

- (void)webView:(WKWebView *)webView didFinishNavigation:(WKNavigation *)navigation {
  [self.loadingIndicator stopAnimating];
}

- (void)webView:(WKWebView *)webView didFailNavigation:(WKNavigation *)navigation withError:(NSError *)error {
  [self.loadingIndicator stopAnimating];
}

- (void)webView:(WKWebView *)webView didFailProvisionalNavigation:(WKNavigation *)navigation withError:(NSError *)error {
  [self.loadingIndicator stopAnimating];

  // Show error message
  self.emptyStateLabel = [[UILabel alloc] init];
  self.emptyStateLabel.text = [NSString stringWithFormat:@"Failed to load database dashboard.\n%@", error.localizedDescription];
  self.emptyStateLabel.textColor = [UIColor colorWithWhite:0.5 alpha:1.0];
  self.emptyStateLabel.font = [UIFont systemFontOfSize:14];
  self.emptyStateLabel.textAlignment = NSTextAlignmentCenter;
  self.emptyStateLabel.numberOfLines = 0;
  self.emptyStateLabel.translatesAutoresizingMaskIntoConstraints = NO;
  [self.webView addSubview:self.emptyStateLabel];

  [NSLayoutConstraint activateConstraints:@[
    [self.emptyStateLabel.centerXAnchor constraintEqualToAnchor:self.webView.centerXAnchor],
    [self.emptyStateLabel.centerYAnchor constraintEqualToAnchor:self.webView.centerYAnchor],
    [self.emptyStateLabel.leadingAnchor constraintEqualToAnchor:self.webView.leadingAnchor constant:40],
    [self.emptyStateLabel.trailingAnchor constraintEqualToAnchor:self.webView.trailingAnchor constant:-40]
  ]];
}

@end
