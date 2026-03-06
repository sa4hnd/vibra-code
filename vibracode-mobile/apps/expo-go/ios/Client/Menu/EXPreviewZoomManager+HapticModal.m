// Copyright 2015-present 650 Industries. All rights reserved.

#import "EXPreviewZoomManager+Private.h"
#import "EXPreviewZoomManager.h"
#import <UIKit/UIKit.h>

// Forward declarations
@class EXHapticModalViewController;

// Haptic Modal View Controller
@interface EXHapticModalViewController
    : UIViewController <UITableViewDataSource, UITableViewDelegate,
                        UIAdaptivePresentationControllerDelegate>

@property(nonatomic, weak) EXPreviewZoomManager *manager;
@property(nonatomic, strong) UITableView *hapticsTableView;
@property(nonatomic, strong) UIButton *addToPromptButton;
@property(nonatomic, strong) UILabel *selectionCountLabel;
@property(nonatomic, strong) NSArray<NSDictionary *> *haptics;
@property(nonatomic, strong) NSMutableSet<NSString *> *selectedHapticIds;
@property(nonatomic, strong) UIVisualEffectView *glassBackgroundView;

- (instancetype)initWithManager:(EXPreviewZoomManager *)manager;

@end

// Category implementation
@implementation EXPreviewZoomManager (HapticModal)

- (void)showHapticModal {
  if (self.hapticModalPresented) {
    return; // Already shown
  }

  UIWindow *window = [UIApplication sharedApplication].keyWindow;
  if (!window || !window.rootViewController) {
    return;
  }

  // Find topmost view controller
  UIViewController *topVC = window.rootViewController;
  while (topVC.presentedViewController) {
    topVC = topVC.presentedViewController;
  }

  // Initialize selected haptics array if needed
  if (!self.selectedHaptics) {
    self.selectedHaptics = [NSMutableArray array];
  }

  // Initialize tag ranges if needed
  if (!self.hapticTagRanges) {
    self.hapticTagRanges = [NSMutableArray array];
  }

  EXHapticModalViewController *modalVC =
      [[EXHapticModalViewController alloc] initWithManager:self];

  // Make navigation controller view transparent for glass effect
  UINavigationController *navController =
      [[UINavigationController alloc] initWithRootViewController:modalVC];
  navController.view.backgroundColor = [UIColor clearColor];

  self.hapticModalViewController = navController;

  // Configure as bottom sheet with medium and large detents, default to large
  navController.modalPresentationStyle = UIModalPresentationPageSheet;
  if (@available(iOS 15.0, *)) {
    UISheetPresentationController *sheet =
        navController.sheetPresentationController;
    if (sheet) {
      sheet.detents = @[
        [UISheetPresentationControllerDetent mediumDetent],
        [UISheetPresentationControllerDetent largeDetent]
      ];
      sheet.selectedDetentIdentifier =
          UISheetPresentationControllerDetentIdentifierLarge;
      sheet.preferredCornerRadius = 24.0;
      sheet.prefersGrabberVisible = YES;
      sheet.prefersEdgeAttachedInCompactHeight = YES;
      sheet.widthFollowsPreferredContentSizeWhenEdgeAttached = YES;
      sheet.largestUndimmedDetentIdentifier = nil;
    }
  }

  // Set delegate to handle dismissal
  navController.presentationController.delegate = modalVC;

  // Present modal
  [topVC presentViewController:navController animated:YES completion:nil];
  self.hapticModalPresented = YES;
}

- (void)insertHapticTag:(NSString *)tagName {
  UITextView *inputTextView = self.inputTextView;
  if (!inputTextView) {
    return;
  }

  // Get current text or attributed text
  NSString *currentText = @"";
  NSRange selectedRange = inputTextView.selectedRange;

  if (inputTextView.attributedText) {
    currentText = inputTextView.attributedText.string ?: @"";
  } else {
    currentText = inputTextView.text ?: @"";
  }

  // Clear placeholder text if present
  if ([currentText isEqualToString:@"Message"]) {
    currentText = @"";
    selectedRange = NSMakeRange(0, 0);
    inputTextView.textColor = [UIColor whiteColor];
  }

  // Insert tag at cursor position or append
  NSString *tagString = [NSString stringWithFormat:@"@%@ ", tagName];

  // Insert tag
  NSString *newText =
      [currentText stringByReplacingCharactersInRange:selectedRange
                                           withString:tagString];

  // Calculate tag range
  NSRange tagRange = NSMakeRange(selectedRange.location, tagString.length);

  // Update text with attributed string
  [self updateTextInputWithAttributedStringAndHapticTag:newText tagRange:tagRange];

  // Update cursor position
  inputTextView.selectedRange =
      NSMakeRange(selectedRange.location + tagString.length, 0);
}

- (void)updateTextInputWithAttributedStringAndHapticTag:(NSString *)text
                                               tagRange:(NSRange)tagRange {
  UITextView *inputTextView = self.inputTextView;
  if (!inputTextView) {
    return;
  }

  NSMutableAttributedString *attributedString =
      [[NSMutableAttributedString alloc] initWithString:text];

  // Apply default attributes
  UIFont *font = [UIFont systemFontOfSize:17 weight:UIFontWeightRegular];
  UIColor *textColor = [UIColor whiteColor];
  [attributedString addAttributes:@{
    NSFontAttributeName : font,
    NSForegroundColorAttributeName : textColor
  }
                            range:NSMakeRange(0, attributedString.length)];

  // Apply orange background to haptic tag
  UIColor *tagColor = [UIColor colorWithRed:0.85
                                      green:0.45
                                       blue:0.2
                                      alpha:1.0]; // Orange color
  [attributedString addAttribute:NSBackgroundColorAttributeName
                           value:tagColor
                           range:tagRange];

  // Store tag range with type info for color differentiation
  NSDictionary *tagInfo = @{
    @"range": [NSValue valueWithRange:tagRange],
    @"type": @"haptic",
    @"color": tagColor
  };
  [self.hapticTagRanges addObject:tagInfo];

  inputTextView.attributedText = attributedString;

  // Trigger text change notification
  [[NSNotificationCenter defaultCenter]
      postNotificationName:UITextViewTextDidChangeNotification
                    object:inputTextView];
}

@end

// MARK: - EXHapticModalViewController Implementation

@implementation EXHapticModalViewController

- (instancetype)initWithManager:(EXPreviewZoomManager *)manager {
  self = [super init];
  if (self) {
    _manager = manager;
    _selectedHapticIds = [NSMutableSet set];

    // Initialize with haptic types
    _haptics = [self loadHaptics];
  }
  return self;
}

- (NSArray<NSDictionary *> *)loadHaptics {
  return @[
    @{
      @"id" : @"error",
      @"name" : @"Error Notification",
      @"type" : @"notification",
      @"style" : @"error"
    },
    @{
      @"id" : @"heavy",
      @"name" : @"Heavy Impact",
      @"type" : @"impact",
      @"style" : @"heavy"
    },
    @{
      @"id" : @"light",
      @"name" : @"Light Impact",
      @"type" : @"impact",
      @"style" : @"light"
    },
    @{
      @"id" : @"medium",
      @"name" : @"Medium Impact",
      @"type" : @"impact",
      @"style" : @"medium"
    },
    @{
      @"id" : @"rigid",
      @"name" : @"Rigid Impact",
      @"type" : @"impact",
      @"style" : @"rigid"
    },
    @{
      @"id" : @"selection",
      @"name" : @"Selection Change",
      @"type" : @"selection",
      @"style" : @""
    },
    @{
      @"id" : @"soft",
      @"name" : @"Soft Impact",
      @"type" : @"impact",
      @"style" : @"soft"
    },
    @{
      @"id" : @"success",
      @"name" : @"Success Notification",
      @"type" : @"notification",
      @"style" : @"success"
    },
    @{
      @"id" : @"warning",
      @"name" : @"Warning Notification",
      @"type" : @"notification",
      @"style" : @"warning"
    }
  ];
}

- (void)viewDidLoad {
  [super viewDidLoad];

  // Make the view controller's view transparent so the glass effect shows through
  self.view.backgroundColor = [UIColor clearColor];

  // Native iOS Glass Effect background
  UIVisualEffect *glassEffect = nil;
  if (@available(iOS 26.0, *)) {
    Class glassEffectClass = NSClassFromString(@"UIGlassEffect");
    if (glassEffectClass) {
      SEL effectSelector = NSSelectorFromString(@"effectWithStyle:");
      if ([glassEffectClass respondsToSelector:effectSelector]) {
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

        if (glassEffect &&
            [glassEffect respondsToSelector:@selector(setInteractive:)]) {
          SEL setInteractiveSelector = @selector(setInteractive:);
          NSMethodSignature *setSig =
              [glassEffect methodSignatureForSelector:setInteractiveSelector];
          NSInvocation *setInvocation =
              [NSInvocation invocationWithMethodSignature:setSig];
          [setInvocation setSelector:setInteractiveSelector];
          [setInvocation setTarget:glassEffect];
          BOOL interactive = YES;
          [setInvocation setArgument:&interactive atIndex:2];
          [setInvocation invoke];
        }

        if (glassEffect &&
            [glassEffect respondsToSelector:@selector(setTintColor:)]) {
          UIColor *darkTint = [UIColor colorWithRed:0.05
                                              green:0.05
                                               blue:0.05
                                              alpha:1.0];
          [glassEffect setValue:darkTint forKey:@"tintColor"];
        }
      }
    }
    if (!glassEffect) {
      if (@available(iOS 13.0, *)) {
        glassEffect =
            [UIBlurEffect effectWithStyle:UIBlurEffectStyleSystemMaterialDark];
      } else {
        glassEffect = [UIBlurEffect effectWithStyle:UIBlurEffectStyleDark];
      }
    }
  } else if (@available(iOS 13.0, *)) {
    glassEffect =
        [UIBlurEffect effectWithStyle:UIBlurEffectStyleSystemMaterialDark];
  } else {
    glassEffect = [UIBlurEffect effectWithStyle:UIBlurEffectStyleDark];
  }

  UIVisualEffectView *backgroundView =
      [[UIVisualEffectView alloc] initWithEffect:glassEffect];
  backgroundView.translatesAutoresizingMaskIntoConstraints = NO;
  [self.view insertSubview:backgroundView atIndex:0];
  self.glassBackgroundView = backgroundView;

  [NSLayoutConstraint activateConstraints:@[
    [backgroundView.topAnchor constraintEqualToAnchor:self.view.topAnchor],
    [backgroundView.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor],
    [backgroundView.trailingAnchor constraintEqualToAnchor:self.view.trailingAnchor],
    [backgroundView.bottomAnchor constraintEqualToAnchor:self.view.bottomAnchor]
  ]];

  [self setupHapticsTableView];
  [self setupBottomSection];
  [self setupConstraints];

  // Load selected haptics from manager
  if (self.manager.selectedHaptics) {
    for (NSDictionary *haptic in self.manager.selectedHaptics) {
      [self.selectedHapticIds addObject:haptic[@"id"]];
    }
  }
}

- (void)viewWillAppear:(BOOL)animated {
  [super viewWillAppear:animated];
  [self.navigationController setNavigationBarHidden:YES animated:animated];
}

- (void)presentationControllerDidDismiss:
    (UIPresentationController *)presentationController {
  self.manager.hapticModalPresented = NO;
}

- (void)setupHapticsTableView {
  self.hapticsTableView =
      [[UITableView alloc] initWithFrame:CGRectZero
                                   style:UITableViewStylePlain];
  self.hapticsTableView.translatesAutoresizingMaskIntoConstraints = NO;
  self.hapticsTableView.backgroundColor = [UIColor clearColor];
  self.hapticsTableView.separatorStyle = UITableViewCellSeparatorStyleNone;
  self.hapticsTableView.dataSource = self;
  self.hapticsTableView.delegate = self;
  self.hapticsTableView.contentInset = UIEdgeInsetsMake(8, 0, 8, 0);
  [self.hapticsTableView registerClass:[UITableViewCell class]
               forCellReuseIdentifier:@"HapticCell"];
  [self.view addSubview:self.hapticsTableView];
}

- (void)setupBottomSection {
  // Add to prompt button
  self.addToPromptButton = [UIButton buttonWithType:UIButtonTypeSystem];
  self.addToPromptButton.translatesAutoresizingMaskIntoConstraints = NO;

  if (@available(iOS 15.0, *)) {
    UIButtonConfiguration *config =
        [UIButtonConfiguration filledButtonConfiguration];
    config.title = @"Add to prompt";
    config.baseBackgroundColor = [UIColor whiteColor];
    config.baseForegroundColor = [UIColor blackColor];
    config.cornerStyle = UIButtonConfigurationCornerStyleLarge;
    config.buttonSize = UIButtonConfigurationSizeLarge;
    self.addToPromptButton.configuration = config;
  } else {
    [self.addToPromptButton setTitle:@"Add to prompt"
                            forState:UIControlStateNormal];
    [self.addToPromptButton setTitleColor:[UIColor blackColor]
                                 forState:UIControlStateNormal];
    self.addToPromptButton.backgroundColor = [UIColor whiteColor];
    self.addToPromptButton.layer.cornerRadius = 16;
    self.addToPromptButton.layer.masksToBounds = YES;
    self.addToPromptButton.titleLabel.font =
        [UIFont systemFontOfSize:17 weight:UIFontWeightSemibold];
  }

  [self.addToPromptButton addTarget:self
                             action:@selector(addToPromptTapped:)
                   forControlEvents:UIControlEventTouchUpInside];

  [self.view addSubview:self.addToPromptButton];

  // Selection count label
  self.selectionCountLabel = [[UILabel alloc] init];
  self.selectionCountLabel.translatesAutoresizingMaskIntoConstraints = NO;
  self.selectionCountLabel.textColor = [UIColor colorWithWhite:0.6 alpha:1.0];
  self.selectionCountLabel.font = [UIFont systemFontOfSize:13 weight:UIFontWeightMedium];
  self.selectionCountLabel.textAlignment = NSTextAlignmentCenter;
  [self.view addSubview:self.selectionCountLabel];

  [self updateSelectionCount];
}

- (void)setupConstraints {
  UIWindow *window = [UIApplication sharedApplication].keyWindow;
  CGFloat safeAreaBottom = 0;
  if (@available(iOS 11.0, *)) {
    safeAreaBottom = window.safeAreaInsets.bottom;
  }

  [NSLayoutConstraint activateConstraints:@[
    // Haptics table view
    [self.hapticsTableView.topAnchor
        constraintEqualToAnchor:self.view.safeAreaLayoutGuide.topAnchor
                       constant:16],
    [self.hapticsTableView.leadingAnchor
        constraintEqualToAnchor:self.view.leadingAnchor],
    [self.hapticsTableView.trailingAnchor
        constraintEqualToAnchor:self.view.trailingAnchor],
    [self.hapticsTableView.bottomAnchor
        constraintEqualToAnchor:self.addToPromptButton.topAnchor
                       constant:-16],

    // Add to prompt button
    [self.addToPromptButton.leadingAnchor
        constraintEqualToAnchor:self.view.leadingAnchor
                       constant:20],
    [self.addToPromptButton.trailingAnchor
        constraintEqualToAnchor:self.view.trailingAnchor
                       constant:-20],
    [self.addToPromptButton.heightAnchor constraintEqualToConstant:50],
    [self.addToPromptButton.bottomAnchor
        constraintEqualToAnchor:self.selectionCountLabel.topAnchor
                       constant:-8],

    // Selection count label
    [self.selectionCountLabel.centerXAnchor
        constraintEqualToAnchor:self.view.centerXAnchor],
    [self.selectionCountLabel.bottomAnchor
        constraintEqualToAnchor:self.view.safeAreaLayoutGuide.bottomAnchor
                       constant:-(safeAreaBottom + 8)]
  ]];
}

- (void)updateSelectionCount {
  NSInteger count = self.selectedHapticIds.count;
  self.selectionCountLabel.text = count > 0 ?
      [NSString stringWithFormat:@"%ld selected", (long)count] : @"";

  self.addToPromptButton.alpha = count > 0 ? 1.0 : 0.6;
  self.addToPromptButton.enabled = count > 0;
}

- (void)addToPromptTapped:(UIButton *)sender {
  if (self.selectedHapticIds.count == 0) {
    return;
  }

  // Insert tags for selected haptics using haptic id (e.g., @error, @heavy)
  for (NSDictionary *haptic in self.haptics) {
    NSString *hapticId = haptic[@"id"];
    if ([self.selectedHapticIds containsObject:hapticId]) {
      [self.manager insertHapticTag:hapticId];
    }
  }

  // Update manager's selected haptics
  NSMutableArray *selectedHaptics = [NSMutableArray array];
  for (NSDictionary *haptic in self.haptics) {
    if ([self.selectedHapticIds containsObject:haptic[@"id"]]) {
      [selectedHaptics addObject:haptic];
    }
  }
  self.manager.selectedHaptics = selectedHaptics;

  // Dismiss modal
  if (self.navigationController) {
    [self.navigationController
        dismissViewControllerAnimated:YES
                           completion:^{
                             self.manager.hapticModalPresented = NO;
                           }];
  } else {
    [self dismissViewControllerAnimated:YES
                             completion:^{
                               self.manager.hapticModalPresented = NO;
                             }];
  }
}

- (void)playHaptic:(NSDictionary *)haptic {
  NSString *type = haptic[@"type"];
  NSString *style = haptic[@"style"];

  if ([type isEqualToString:@"impact"]) {
    UIImpactFeedbackStyle feedbackStyle = UIImpactFeedbackStyleMedium;
    if ([style isEqualToString:@"light"]) {
      feedbackStyle = UIImpactFeedbackStyleLight;
    } else if ([style isEqualToString:@"medium"]) {
      feedbackStyle = UIImpactFeedbackStyleMedium;
    } else if ([style isEqualToString:@"heavy"]) {
      feedbackStyle = UIImpactFeedbackStyleHeavy;
    } else if (@available(iOS 13.0, *)) {
      if ([style isEqualToString:@"soft"]) {
        feedbackStyle = UIImpactFeedbackStyleSoft;
      } else if ([style isEqualToString:@"rigid"]) {
        feedbackStyle = UIImpactFeedbackStyleRigid;
      }
    }

    UIImpactFeedbackGenerator *generator =
        [[UIImpactFeedbackGenerator alloc] initWithStyle:feedbackStyle];
    [generator prepare];
    [generator impactOccurred];
  } else if ([type isEqualToString:@"notification"]) {
    UINotificationFeedbackType feedbackType = UINotificationFeedbackTypeError;
    if ([style isEqualToString:@"success"]) {
      feedbackType = UINotificationFeedbackTypeSuccess;
    } else if ([style isEqualToString:@"warning"]) {
      feedbackType = UINotificationFeedbackTypeWarning;
    } else {
      feedbackType = UINotificationFeedbackTypeError;
    }

    UINotificationFeedbackGenerator *generator =
        [[UINotificationFeedbackGenerator alloc] init];
    [generator prepare];
    [generator notificationOccurred:feedbackType];
  } else if ([type isEqualToString:@"selection"]) {
    UISelectionFeedbackGenerator *generator =
        [[UISelectionFeedbackGenerator alloc] init];
    [generator prepare];
    [generator selectionChanged];
  }
}

#pragma mark - UITableViewDataSource

- (NSInteger)tableView:(UITableView *)tableView
    numberOfRowsInSection:(NSInteger)section {
  return self.haptics.count;
}

- (UITableViewCell *)tableView:(UITableView *)tableView
         cellForRowAtIndexPath:(NSIndexPath *)indexPath {
  UITableViewCell *cell =
      [tableView dequeueReusableCellWithIdentifier:@"HapticCell"];
  if (!cell) {
    cell = [[UITableViewCell alloc] initWithStyle:UITableViewCellStyleDefault
                                  reuseIdentifier:@"HapticCell"];
  }

  // Clear cell
  for (UIView *subview in cell.contentView.subviews) {
    [subview removeFromSuperview];
  }

  NSDictionary *haptic = self.haptics[indexPath.row];
  NSString *hapticId = haptic[@"id"];
  BOOL isSelected = [self.selectedHapticIds containsObject:hapticId];

  // Cell background
  cell.backgroundColor = [UIColor clearColor];

  // Selected state background - orange/brown color from screenshot
  if (isSelected) {
    UIView *selectionBackground = [[UIView alloc] init];
    selectionBackground.backgroundColor = [UIColor colorWithRed:0.35
                                                          green:0.22
                                                           blue:0.12
                                                          alpha:0.9];
    selectionBackground.layer.cornerRadius = 14;
    selectionBackground.layer.borderWidth = 1.5;
    selectionBackground.layer.borderColor =
        [UIColor colorWithRed:0.55 green:0.35 blue:0.2 alpha:1.0].CGColor;
    selectionBackground.translatesAutoresizingMaskIntoConstraints = NO;
    [cell.contentView addSubview:selectionBackground];
    [cell.contentView sendSubviewToBack:selectionBackground];

    [NSLayoutConstraint activateConstraints:@[
      [selectionBackground.topAnchor
          constraintEqualToAnchor:cell.contentView.topAnchor
                         constant:4],
      [selectionBackground.leadingAnchor
          constraintEqualToAnchor:cell.contentView.leadingAnchor
                         constant:12],
      [selectionBackground.trailingAnchor
          constraintEqualToAnchor:cell.contentView.trailingAnchor
                         constant:-12],
      [selectionBackground.bottomAnchor
          constraintEqualToAnchor:cell.contentView.bottomAnchor
                         constant:-4]
    ]];
  }

  // Haptic name label
  UILabel *nameLabel = [[UILabel alloc] init];
  nameLabel.text = haptic[@"name"];
  nameLabel.textColor = [UIColor whiteColor];
  nameLabel.font = [UIFont systemFontOfSize:17 weight:UIFontWeightSemibold];
  nameLabel.translatesAutoresizingMaskIntoConstraints = NO;
  [cell.contentView addSubview:nameLabel];

  // Waveform icon - orange color
  UIImageSymbolConfiguration *waveformConfig = [UIImageSymbolConfiguration
      configurationWithPointSize:20
                          weight:UIImageSymbolWeightMedium];
  UIImage *waveformImage = [UIImage systemImageNamed:@"waveform"
                                  withConfiguration:waveformConfig];
  UIImageView *waveformView = [[UIImageView alloc] initWithImage:waveformImage];
  waveformView.tintColor = [UIColor colorWithRed:0.85 green:0.45 blue:0.2 alpha:1.0];
  waveformView.translatesAutoresizingMaskIntoConstraints = NO;
  [cell.contentView addSubview:waveformView];

  // Play button - make it clearly tappable
  UIImageSymbolConfiguration *playConfig = [UIImageSymbolConfiguration
      configurationWithPointSize:18
                          weight:UIImageSymbolWeightMedium];
  UIImage *playImage = [UIImage systemImageNamed:@"play.fill"
                                withConfiguration:playConfig];
  UIButton *playButton = [UIButton buttonWithType:UIButtonTypeSystem];
  [playButton setImage:playImage forState:UIControlStateNormal];
  playButton.tintColor = [UIColor colorWithWhite:0.6 alpha:1.0];
  playButton.translatesAutoresizingMaskIntoConstraints = NO;
  playButton.tag = indexPath.row;
  playButton.backgroundColor = [UIColor colorWithWhite:0.2 alpha:0.5];
  playButton.layer.cornerRadius = 22;
  playButton.clipsToBounds = YES;
  playButton.userInteractionEnabled = YES;
  [playButton addTarget:self
                 action:@selector(playButtonTapped:)
       forControlEvents:UIControlEventTouchUpInside];
  [cell.contentView addSubview:playButton];
  [cell.contentView bringSubviewToFront:playButton];

  // Constraints
  [NSLayoutConstraint activateConstraints:@[
    // Name label
    [nameLabel.leadingAnchor constraintEqualToAnchor:cell.contentView.leadingAnchor
                                            constant:24],
    [nameLabel.centerYAnchor constraintEqualToAnchor:cell.contentView.centerYAnchor],
    [nameLabel.trailingAnchor constraintLessThanOrEqualToAnchor:waveformView.leadingAnchor
                                                       constant:-12],

    // Waveform icon
    [waveformView.trailingAnchor constraintEqualToAnchor:playButton.leadingAnchor
                                                constant:-16],
    [waveformView.centerYAnchor constraintEqualToAnchor:cell.contentView.centerYAnchor],
    [waveformView.widthAnchor constraintEqualToConstant:28],
    [waveformView.heightAnchor constraintEqualToConstant:28],

    // Play button
    [playButton.trailingAnchor constraintEqualToAnchor:cell.contentView.trailingAnchor
                                              constant:-24],
    [playButton.centerYAnchor constraintEqualToAnchor:cell.contentView.centerYAnchor],
    [playButton.widthAnchor constraintEqualToConstant:44],
    [playButton.heightAnchor constraintEqualToConstant:44]
  ]];

  cell.selectionStyle = UITableViewCellSelectionStyleNone;

  return cell;
}

#pragma mark - UITableViewDelegate

- (CGFloat)tableView:(UITableView *)tableView
    heightForRowAtIndexPath:(NSIndexPath *)indexPath {
  return 64;
}

- (void)tableView:(UITableView *)tableView
    didSelectRowAtIndexPath:(NSIndexPath *)indexPath {
  NSDictionary *haptic = self.haptics[indexPath.row];
  NSString *hapticId = haptic[@"id"];

  // Toggle selection
  BOOL wasSelected = [self.selectedHapticIds containsObject:hapticId];
  if (wasSelected) {
    [self.selectedHapticIds removeObject:hapticId];
  } else {
    [self.selectedHapticIds addObject:hapticId];
  }

  [self updateSelectionCount];

  // Reload row with animation
  [tableView reloadRowsAtIndexPaths:@[ indexPath ]
                   withRowAnimation:UITableViewRowAnimationFade];
}

- (void)playButtonTapped:(UIButton *)sender {
  NSInteger row = sender.tag;
  if (row >= 0 && row < self.haptics.count) {
    // Visual feedback - animate button
    [UIView animateWithDuration:0.1
        animations:^{
          sender.transform = CGAffineTransformMakeScale(0.9, 0.9);
          sender.alpha = 0.7;
        }
        completion:^(BOOL finished) {
          [UIView animateWithDuration:0.1
              animations:^{
                sender.transform = CGAffineTransformIdentity;
                sender.alpha = 1.0;
              }];
        }];

    NSDictionary *haptic = self.haptics[row];
    [self playHaptic:haptic];
  }
}

@end
