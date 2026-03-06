// Copyright 2015-present 650 Industries. All rights reserved.

#import "EXPreviewZoomManager+Private.h"
#import "EXPreviewZoomManager.h"
#import "EXChatBackendService.h"
#import "EXEnvBridge.h"
#import "EXAudioRecorderService.h"
#import "EXAssemblyAIService.h"
#import "EXAudioWaveformView.h"
#import <UIKit/UIKit.h>
#import <AVFoundation/AVFoundation.h>
#import <AVKit/AVKit.h>
#import <PhotosUI/PhotosUI.h>
#import <Photos/Photos.h>
#import <SDWebImage/SDWebImage.h>

// Forward declarations
@class EXVideoStudioModalViewController;

// Video accent color - coral/orange (distinct from image blue and audio purple)
static inline UIColor *VideoStudioAccentColor(void) {
  return [UIColor colorWithRed:0.95 green:0.5 blue:0.3 alpha:1.0];
}

// Video type options
typedef NS_ENUM(NSInteger, EXVideoType) {
  EXVideoTypeClip = 0,
  EXVideoTypeCinematic,
  EXVideoTypeAnimation,
  EXVideoTypeMotion
};

#pragma mark - Custom Cell Classes for Proper Reuse

// Custom video cell class - matches Image Studio cell design exactly
@interface EXVideoStudioCell : UICollectionViewCell
@property (nonatomic, strong) UIView *iconContainerView;
@property (nonatomic, strong) UIImageView *videoIconView;
@property (nonatomic, strong) UILabel *nameLabel;
@property (nonatomic, strong) UIView *badgeView;
@property (nonatomic, strong) UILabel *badgeLabel;
@property (nonatomic, strong) UIView *shimmerView;
@property (nonatomic, strong) CAGradientLayer *shimmerGradient;
@property (nonatomic, strong) UILabel *statusLabel;
@property (nonatomic, strong) UIImageView *statusIcon;
@property (nonatomic, strong) NSString *currentVideoId;
@end

@implementation EXVideoStudioCell

- (instancetype)initWithFrame:(CGRect)frame {
  self = [super initWithFrame:frame];
  if (self) {
    [self setupViews];
  }
  return self;
}

- (void)setupViews {
  self.contentView.backgroundColor = [UIColor colorWithWhite:0.12 alpha:1.0];
  self.contentView.layer.cornerRadius = 16;
  self.contentView.clipsToBounds = YES;

  // Icon container (centered, shows video icon for completed videos)
  self.iconContainerView = [[UIView alloc] init];
  self.iconContainerView.translatesAutoresizingMaskIntoConstraints = NO;
  self.iconContainerView.backgroundColor = [UIColor colorWithRed:0.95 green:0.5 blue:0.3 alpha:0.15];
  self.iconContainerView.layer.cornerRadius = 28;
  self.iconContainerView.hidden = YES;
  [self.contentView addSubview:self.iconContainerView];

  // Video icon (waveform style)
  UIImageSymbolConfiguration *iconConfig = [UIImageSymbolConfiguration configurationWithPointSize:28 weight:UIImageSymbolWeightMedium];
  self.videoIconView = [[UIImageView alloc] initWithImage:[UIImage systemImageNamed:@"video.fill" withConfiguration:iconConfig]];
  self.videoIconView.translatesAutoresizingMaskIntoConstraints = NO;
  self.videoIconView.tintColor = VideoStudioAccentColor();
  self.videoIconView.hidden = YES;
  [self.iconContainerView addSubview:self.videoIconView];

  // Name label at bottom
  self.nameLabel = [[UILabel alloc] init];
  self.nameLabel.translatesAutoresizingMaskIntoConstraints = NO;
  self.nameLabel.textColor = [UIColor colorWithWhite:0.7 alpha:1.0];
  self.nameLabel.font = [UIFont monospacedSystemFontOfSize:10 weight:UIFontWeightMedium];
  self.nameLabel.textAlignment = NSTextAlignmentCenter;
  self.nameLabel.hidden = YES;
  [self.contentView addSubview:self.nameLabel];

  // Shimmer view (for loading state)
  self.shimmerView = [[UIView alloc] init];
  self.shimmerView.translatesAutoresizingMaskIntoConstraints = NO;
  self.shimmerView.backgroundColor = [UIColor colorWithWhite:0.2 alpha:1.0];
  self.shimmerView.clipsToBounds = YES;
  self.shimmerView.hidden = YES;
  [self.contentView addSubview:self.shimmerView];

  self.shimmerGradient = [CAGradientLayer layer];
  self.shimmerGradient.colors = @[
    (id)[UIColor colorWithWhite:0.2 alpha:1.0].CGColor,
    (id)[UIColor colorWithWhite:0.3 alpha:1.0].CGColor,
    (id)[UIColor colorWithWhite:0.2 alpha:1.0].CGColor
  ];
  self.shimmerGradient.locations = @[@0.0, @0.5, @1.0];
  self.shimmerGradient.startPoint = CGPointMake(0, 0.5);
  self.shimmerGradient.endPoint = CGPointMake(1, 0.5);
  [self.shimmerView.layer addSublayer:self.shimmerGradient];

  // Status icon (shown during generation)
  UIImageSymbolConfiguration *statusIconConfig = [UIImageSymbolConfiguration configurationWithPointSize:24 weight:UIImageSymbolWeightMedium];
  self.statusIcon = [[UIImageView alloc] initWithImage:[UIImage systemImageNamed:@"video.fill" withConfiguration:statusIconConfig]];
  self.statusIcon.translatesAutoresizingMaskIntoConstraints = NO;
  self.statusIcon.tintColor = VideoStudioAccentColor();
  self.statusIcon.hidden = YES;
  [self.contentView addSubview:self.statusIcon];

  // Status label
  self.statusLabel = [[UILabel alloc] init];
  self.statusLabel.translatesAutoresizingMaskIntoConstraints = NO;
  self.statusLabel.textColor = [UIColor colorWithWhite:0.6 alpha:1.0];
  self.statusLabel.font = [UIFont systemFontOfSize:12];
  self.statusLabel.hidden = YES;
  [self.contentView addSubview:self.statusLabel];

  // Selection badge
  self.badgeView = [[UIView alloc] init];
  self.badgeView.translatesAutoresizingMaskIntoConstraints = NO;
  self.badgeView.backgroundColor = VideoStudioAccentColor();
  self.badgeView.layer.cornerRadius = 12;
  self.badgeView.hidden = YES;
  [self.contentView addSubview:self.badgeView];

  self.badgeLabel = [[UILabel alloc] init];
  self.badgeLabel.translatesAutoresizingMaskIntoConstraints = NO;
  self.badgeLabel.textColor = [UIColor whiteColor];
  self.badgeLabel.font = [UIFont boldSystemFontOfSize:12];
  self.badgeLabel.textAlignment = NSTextAlignmentCenter;
  [self.badgeView addSubview:self.badgeLabel];

  // Constraints
  [NSLayoutConstraint activateConstraints:@[
    // Icon container centered
    [self.iconContainerView.centerXAnchor constraintEqualToAnchor:self.contentView.centerXAnchor],
    [self.iconContainerView.centerYAnchor constraintEqualToAnchor:self.contentView.centerYAnchor constant:-10],
    [self.iconContainerView.widthAnchor constraintEqualToConstant:56],
    [self.iconContainerView.heightAnchor constraintEqualToConstant:56],

    // Video icon centered in container
    [self.videoIconView.centerXAnchor constraintEqualToAnchor:self.iconContainerView.centerXAnchor],
    [self.videoIconView.centerYAnchor constraintEqualToAnchor:self.iconContainerView.centerYAnchor],

    // Name label at bottom
    [self.nameLabel.bottomAnchor constraintEqualToAnchor:self.contentView.bottomAnchor constant:-10],
    [self.nameLabel.leadingAnchor constraintEqualToAnchor:self.contentView.leadingAnchor constant:8],
    [self.nameLabel.trailingAnchor constraintEqualToAnchor:self.contentView.trailingAnchor constant:-8],

    // Shimmer fills cell
    [self.shimmerView.topAnchor constraintEqualToAnchor:self.contentView.topAnchor],
    [self.shimmerView.leadingAnchor constraintEqualToAnchor:self.contentView.leadingAnchor],
    [self.shimmerView.trailingAnchor constraintEqualToAnchor:self.contentView.trailingAnchor],
    [self.shimmerView.bottomAnchor constraintEqualToAnchor:self.contentView.bottomAnchor],

    // Status icon centered
    [self.statusIcon.centerXAnchor constraintEqualToAnchor:self.contentView.centerXAnchor],
    [self.statusIcon.centerYAnchor constraintEqualToAnchor:self.contentView.centerYAnchor constant:-10],

    // Status label below icon
    [self.statusLabel.centerXAnchor constraintEqualToAnchor:self.contentView.centerXAnchor],
    [self.statusLabel.topAnchor constraintEqualToAnchor:self.statusIcon.bottomAnchor constant:8],

    // Selection badge top-right
    [self.badgeView.topAnchor constraintEqualToAnchor:self.contentView.topAnchor constant:8],
    [self.badgeView.trailingAnchor constraintEqualToAnchor:self.contentView.trailingAnchor constant:-8],
    [self.badgeView.widthAnchor constraintEqualToConstant:24],
    [self.badgeView.heightAnchor constraintEqualToConstant:24],

    [self.badgeLabel.centerXAnchor constraintEqualToAnchor:self.badgeView.centerXAnchor],
    [self.badgeLabel.centerYAnchor constraintEqualToAnchor:self.badgeView.centerYAnchor]
  ]];
}

- (void)layoutSubviews {
  [super layoutSubviews];
  self.shimmerGradient.frame = CGRectMake(-200, 0, self.bounds.size.width + 400, self.bounds.size.height);
}

- (void)prepareForReuse {
  [super prepareForReuse];

  // Reset to hidden state
  self.iconContainerView.hidden = YES;
  self.videoIconView.hidden = YES;
  self.nameLabel.hidden = YES;
  self.shimmerView.hidden = YES;
  self.statusLabel.hidden = YES;
  self.statusIcon.hidden = YES;
  self.badgeView.hidden = YES;
  self.currentVideoId = nil;

  // Stop shimmer animation
  [self.shimmerGradient removeAnimationForKey:@"shimmer"];

  // Reset border
  self.contentView.layer.borderWidth = 0;
  self.contentView.layer.borderColor = [UIColor clearColor].CGColor;
}

- (void)configureForGeneratingState {
  self.shimmerView.hidden = NO;
  self.statusLabel.hidden = NO;
  self.statusIcon.hidden = NO;
  self.statusLabel.text = @"Generating...";

  // Reset icon to video icon
  UIImageSymbolConfiguration *iconConfig = [UIImageSymbolConfiguration configurationWithPointSize:24 weight:UIImageSymbolWeightMedium];
  self.statusIcon.image = [UIImage systemImageNamed:@"video.fill" withConfiguration:iconConfig];
  self.statusIcon.tintColor = VideoStudioAccentColor();

  // Start shimmer animation
  CABasicAnimation *shimmerAnimation = [CABasicAnimation animationWithKeyPath:@"transform.translation.x"];
  shimmerAnimation.fromValue = @(-200);
  shimmerAnimation.toValue = @(self.bounds.size.width + 200);
  shimmerAnimation.duration = 1.5;
  shimmerAnimation.repeatCount = HUGE_VALF;
  [self.shimmerGradient addAnimation:shimmerAnimation forKey:@"shimmer"];
}

- (void)configureForErrorState {
  self.statusLabel.hidden = NO;
  self.statusIcon.hidden = NO;
  self.statusLabel.text = @"Failed";
  self.statusIcon.image = [UIImage systemImageNamed:@"exclamationmark.triangle.fill"
    withConfiguration:[UIImageSymbolConfiguration configurationWithPointSize:24 weight:UIImageSymbolWeightMedium]];
  self.statusIcon.tintColor = [UIColor colorWithRed:0.9 green:0.3 blue:0.3 alpha:1.0];
}

- (void)configureForCompletedStateWithName:(NSString *)name isSelected:(BOOL)isSelected selectionIndex:(NSInteger)selectionIndex {
  self.iconContainerView.hidden = NO;
  self.videoIconView.hidden = NO;
  self.nameLabel.hidden = NO;
  self.nameLabel.text = [NSString stringWithFormat:@"@%@", name];

  // Selection badge
  if (isSelected) {
    self.badgeView.hidden = NO;
    self.badgeLabel.text = [NSString stringWithFormat:@"%ld", (long)selectionIndex];
    self.contentView.layer.borderWidth = 3.0;
    self.contentView.layer.borderColor = VideoStudioAccentColor().CGColor;
  }
}

@end

// Custom add cell class - matches Image Studio add cell exactly
@interface EXVideoStudioAddCell : UICollectionViewCell
@property (nonatomic, strong) UIImageView *plusIcon;
@property (nonatomic, strong) CAShapeLayer *dashLayer;
@end

@implementation EXVideoStudioAddCell

- (instancetype)initWithFrame:(CGRect)frame {
  self = [super initWithFrame:frame];
  if (self) {
    [self setupViews];
  }
  return self;
}

- (void)setupViews {
  self.contentView.backgroundColor = [UIColor colorWithWhite:0.1 alpha:1.0];
  self.contentView.layer.cornerRadius = 16;
  self.contentView.clipsToBounds = YES;
  self.contentView.layer.borderWidth = 2.0;
  self.contentView.layer.borderColor = [UIColor colorWithWhite:0.25 alpha:1.0].CGColor;

  // Dashed border
  self.dashLayer = [CAShapeLayer layer];
  self.dashLayer.strokeColor = [UIColor colorWithWhite:0.35 alpha:1.0].CGColor;
  self.dashLayer.fillColor = nil;
  self.dashLayer.lineDashPattern = @[@8, @4];
  self.dashLayer.lineWidth = 2.0;
  [self.contentView.layer addSublayer:self.dashLayer];

  // Plus icon with video badge
  UIImageSymbolConfiguration *plusConfig = [UIImageSymbolConfiguration configurationWithPointSize:28 weight:UIImageSymbolWeightMedium];
  self.plusIcon = [[UIImageView alloc] initWithImage:[UIImage systemImageNamed:@"video.badge.plus" withConfiguration:plusConfig]];
  self.plusIcon.tintColor = [UIColor colorWithWhite:0.5 alpha:1.0];
  self.plusIcon.translatesAutoresizingMaskIntoConstraints = NO;
  [self.contentView addSubview:self.plusIcon];

  [NSLayoutConstraint activateConstraints:@[
    [self.plusIcon.centerXAnchor constraintEqualToAnchor:self.contentView.centerXAnchor],
    [self.plusIcon.centerYAnchor constraintEqualToAnchor:self.contentView.centerYAnchor]
  ]];
}

- (void)layoutSubviews {
  [super layoutSubviews];
  self.dashLayer.frame = self.contentView.bounds;
  self.dashLayer.path = [UIBezierPath bezierPathWithRoundedRect:CGRectInset(self.contentView.bounds, 1, 1) cornerRadius:15].CGPath;
}

- (void)prepareForReuse {
  [super prepareForReuse];
  // Add cell doesn't need content reset
}

@end

// Video Studio Modal View Controller
@interface EXVideoStudioModalViewController : UIViewController <UIAdaptivePresentationControllerDelegate, UICollectionViewDataSource, UICollectionViewDelegate, UICollectionViewDelegateFlowLayout, UITextViewDelegate, PHPickerViewControllerDelegate>

@property(nonatomic, weak) EXPreviewZoomManager *manager;
@property(nonatomic, strong) UITextView *promptTextView;
@property(nonatomic, strong) UIButton *micButton;
@property(nonatomic, strong) UIButton *sendButton;
@property(nonatomic, strong) UICollectionView *videoCollectionView;
@property(nonatomic, strong) NSMutableArray<NSDictionary *> *videos;
@property(nonatomic, strong) UIActivityIndicatorView *loadingIndicator;
@property(nonatomic, strong) UIVisualEffectView *backgroundView;
@property(nonatomic, strong) UILabel *emptyStateLabel;
@property(nonatomic, assign) BOOL isGenerating;
@property(nonatomic, strong) NSTimer *refreshTimer;
@property(nonatomic, strong) UIView *inputContainer;
@property(nonatomic, strong) NSLayoutConstraint *inputContainerBottomConstraint;
@property(nonatomic, strong) NSLayoutConstraint *inputContainerHeightConstraint;
@property(nonatomic, strong) NSMutableSet<NSString *> *selectedVideoIds;
@property(nonatomic, strong) UIButton *addToPromptButton;
@property(nonatomic, strong) UILabel *selectionCountLabel;
@property(nonatomic, strong) UIView *bottomActionContainer;
@property(nonatomic, strong) NSLayoutConstraint *bottomActionBottomConstraint;
@property(nonatomic, strong) UIButton *videoTypeButton;
@property(nonatomic, assign) EXVideoType selectedVideoType;
@property(nonatomic, assign) BOOL isRecording;
@property(nonatomic, assign) BOOL isTranscribing;
@property(nonatomic, strong) UIView *recordingOverlay;
@property(nonatomic, strong) UILabel *recordingLabel;
@property(nonatomic, strong) EXAudioWaveformView *waveformView;
@property(nonatomic, strong) NSString *lastVideosHash;

- (instancetype)initWithManager:(EXPreviewZoomManager *)manager;

@end

// Category implementation
@implementation EXPreviewZoomManager (VideoStudioModal)

- (void)showVideoStudioModal {
  if (self.videoStudioModalPresented) {
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

  EXVideoStudioModalViewController *modalVC = [[EXVideoStudioModalViewController alloc] initWithManager:self];

  UINavigationController *navController = [[UINavigationController alloc] initWithRootViewController:modalVC];
  navController.view.backgroundColor = [UIColor clearColor];
  navController.navigationBarHidden = YES;

  self.videoStudioModalViewController = navController;

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
  self.videoStudioModalPresented = YES;
}

- (void)insertVideoTag:(NSString *)tagName withPath:(NSString *)path {
  NSLog(@"🎬 [VideoStudio] insertVideoTag called: tagName=%@, path=%@", tagName, path);

  // IMPORTANT: Store the path mapping FIRST, before any early returns
  if (!self.videoPathMappings) {
    self.videoPathMappings = [NSMutableDictionary dictionary];
  }
  if (path && path.length > 0) {
    self.videoPathMappings[tagName] = path;
    NSLog(@"🎬 [VideoStudio] Stored path mapping: %@ -> %@", tagName, path);
  }

  UITextView *inputTextView = self.inputTextView;
  if (!inputTextView) {
    NSLog(@"⚠️ [VideoStudio] insertVideoTag: inputTextView is nil! Path stored but tag not visible.");
    return;
  }

  NSLog(@"🎬 [VideoStudio] inputTextView found, proceeding with tag insertion");

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

  // Create tag string
  NSString *tagString = [NSString stringWithFormat:@"@%@ ", tagName];

  // Insert tag at cursor position or append
  NSString *newText = [currentText stringByReplacingCharactersInRange:selectedRange withString:tagString];

  // Calculate tag range
  NSRange tagRange = NSMakeRange(selectedRange.location, tagString.length);

  // Update text with attributed string and highlighting
  [self updateTextInputWithAttributedStringAndVideoTag:newText tagRange:tagRange];

  // Update cursor position
  inputTextView.selectedRange = NSMakeRange(selectedRange.location + tagString.length, 0);
}

- (void)updateTextInputWithAttributedStringAndVideoTag:(NSString *)text tagRange:(NSRange)tagRange {
  UITextView *inputTextView = self.inputTextView;
  if (!inputTextView) {
    return;
  }

  // Preserve existing attributed text or create new one
  NSMutableAttributedString *attributedString;
  if (inputTextView.attributedText && inputTextView.attributedText.length > 0 &&
      ![inputTextView.attributedText.string isEqualToString:@"Message"]) {
    attributedString = [[NSMutableAttributedString alloc] initWithAttributedString:inputTextView.attributedText];

    if (![attributedString.string isEqualToString:text]) {
      attributedString = [[NSMutableAttributedString alloc] initWithString:text];

      UIFont *font = [UIFont systemFontOfSize:17 weight:UIFontWeightRegular];
      UIColor *textColor = [UIColor whiteColor];
      [attributedString addAttributes:@{
        NSFontAttributeName : font,
        NSForegroundColorAttributeName : textColor
      }
                                range:NSMakeRange(0, attributedString.length)];

      [self reapplyAllTagHighlightsToAttributedString:attributedString excludingRange:tagRange];
    }
  } else {
    attributedString = [[NSMutableAttributedString alloc] initWithString:text];

    UIFont *font = [UIFont systemFontOfSize:17 weight:UIFontWeightRegular];
    UIColor *textColor = [UIColor whiteColor];
    [attributedString addAttributes:@{
      NSFontAttributeName : font,
      NSForegroundColorAttributeName : textColor
    }
                              range:NSMakeRange(0, attributedString.length)];
  }

  // Apply coral/orange background to video tag
  UIColor *tagColor = VideoStudioAccentColor();
  [attributedString addAttribute:NSBackgroundColorAttributeName
                           value:tagColor
                           range:tagRange];

  // Store tag range with type info in apiTagRanges
  if (!self.apiTagRanges) {
    self.apiTagRanges = [NSMutableArray array];
  }

  NSDictionary *tagInfo = @{
    @"range": [NSValue valueWithRange:tagRange],
    @"type": @"video",
    @"color": tagColor
  };
  [self.apiTagRanges addObject:tagInfo];

  inputTextView.attributedText = attributedString;

  [[NSNotificationCenter defaultCenter] postNotificationName:UITextViewTextDidChangeNotification object:inputTextView];
}

- (void)reapplyAllTagHighlightsToAttributedString:(NSMutableAttributedString *)attributedString excludingRange:(NSRange)excludeRange {
  if (!self.apiTagRanges) return;

  for (id tagData in self.apiTagRanges) {
    NSRange tagRange;
    UIColor *tagColor = nil;

    if ([tagData isKindOfClass:[NSDictionary class]]) {
      NSDictionary *tagInfo = (NSDictionary *)tagData;
      tagRange = [tagInfo[@"range"] rangeValue];
      tagColor = tagInfo[@"color"];
    } else if ([tagData isKindOfClass:[NSValue class]]) {
      tagRange = [(NSValue *)tagData rangeValue];
      tagColor = VideoStudioAccentColor();
    } else {
      continue;
    }

    if (NSEqualRanges(tagRange, excludeRange)) continue;

    if (tagRange.location + tagRange.length <= attributedString.length) {
      [attributedString addAttribute:NSBackgroundColorAttributeName
                               value:tagColor
                               range:tagRange];
    }
  }
}

@end

// MARK: - EXVideoStudioModalViewController Implementation

@implementation EXVideoStudioModalViewController

- (instancetype)initWithManager:(EXPreviewZoomManager *)manager {
  self = [super init];
  if (self) {
    _manager = manager;
    _videos = [NSMutableArray array];
    _isGenerating = NO;
    _selectedVideoIds = [NSMutableSet set];
    _selectedVideoType = EXVideoTypeClip;
    _isRecording = NO;
    _isTranscribing = NO;
  }
  return self;
}

- (void)viewDidLoad {
  [super viewDidLoad];

  self.view.backgroundColor = [UIColor clearColor];

  [self setupBackground];
  [self setupCollectionView];
  [self setupPromptInput];
  [self setupBottomActionButton];
  [self setupEmptyState];
  [self setupConstraints];
  [self setupKeyboardObservers];

  // Add tap gesture to dismiss keyboard
  UITapGestureRecognizer *tapGesture = [[UITapGestureRecognizer alloc] initWithTarget:self action:@selector(dismissKeyboard)];
  tapGesture.cancelsTouchesInView = NO;
  [self.view addGestureRecognizer:tapGesture];

  [self loadVideos];

  // Start polling for updates
  self.refreshTimer = [NSTimer scheduledTimerWithTimeInterval:3.0
                                                       target:self
                                                     selector:@selector(pollForUpdates)
                                                     userInfo:nil
                                                      repeats:YES];
}

- (void)viewWillDisappear:(BOOL)animated {
  [super viewWillDisappear:animated];
  [self.refreshTimer invalidate];
  self.refreshTimer = nil;
  [[NSNotificationCenter defaultCenter] removeObserver:self];
}

- (void)viewWillAppear:(BOOL)animated {
  [super viewWillAppear:animated];
  [self.navigationController setNavigationBarHidden:YES animated:animated];
}

- (void)presentationControllerDidDismiss:(UIPresentationController *)presentationController {
  self.manager.videoStudioModalPresented = NO;
  [self.refreshTimer invalidate];
  self.refreshTimer = nil;
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

- (void)setupPromptInput {
  // Container for prompt input at bottom
  self.inputContainer = [[UIView alloc] init];
  self.inputContainer.translatesAutoresizingMaskIntoConstraints = NO;
  self.inputContainer.backgroundColor = [UIColor colorWithWhite:0.12 alpha:1.0];
  self.inputContainer.layer.cornerRadius = 24;
  self.inputContainer.layer.borderWidth = 1.0;
  self.inputContainer.layer.borderColor = [UIColor colorWithWhite:0.2 alpha:1.0].CGColor;
  [self.view addSubview:self.inputContainer];

  // Video type dropdown button
  self.videoTypeButton = [UIButton buttonWithType:UIButtonTypeSystem];
  self.videoTypeButton.translatesAutoresizingMaskIntoConstraints = NO;
  self.videoTypeButton.titleLabel.font = [UIFont systemFontOfSize:13 weight:UIFontWeightMedium];
  [self.videoTypeButton setTitleColor:[UIColor whiteColor] forState:UIControlStateNormal];
  self.videoTypeButton.backgroundColor = [UIColor colorWithWhite:0.22 alpha:1.0];
  self.videoTypeButton.layer.cornerRadius = 18;
  self.videoTypeButton.contentEdgeInsets = UIEdgeInsetsMake(8, 12, 8, 12);
  self.videoTypeButton.accessibilityLabel = @"Video type selector";
  self.videoTypeButton.accessibilityHint = @"Tap to change video type";
  [self.inputContainer addSubview:self.videoTypeButton];

  [self setupVideoTypeMenu];
  [self updateVideoTypeButtonTitle];

  // Prompt text view
  self.promptTextView = [[UITextView alloc] init];
  self.promptTextView.translatesAutoresizingMaskIntoConstraints = NO;
  self.promptTextView.backgroundColor = [UIColor clearColor];
  self.promptTextView.textColor = [UIColor whiteColor];
  self.promptTextView.font = [UIFont systemFontOfSize:17];
  self.promptTextView.delegate = self;
  self.promptTextView.scrollEnabled = YES;
  self.promptTextView.textContainerInset = UIEdgeInsetsMake(8, 0, 8, 0);
  self.promptTextView.textContainer.lineFragmentPadding = 0;
  self.promptTextView.textAlignment = NSTextAlignmentCenter;
  [self.inputContainer addSubview:self.promptTextView];

  // Placeholder label
  UILabel *placeholderLabel = [[UILabel alloc] init];
  placeholderLabel.translatesAutoresizingMaskIntoConstraints = NO;
  placeholderLabel.text = @"Describe your video...";
  placeholderLabel.textColor = [UIColor colorWithWhite:0.45 alpha:1.0];
  placeholderLabel.font = [UIFont systemFontOfSize:17];
  placeholderLabel.textAlignment = NSTextAlignmentCenter;
  placeholderLabel.tag = 999;
  [self.promptTextView addSubview:placeholderLabel];

  [NSLayoutConstraint activateConstraints:@[
    [placeholderLabel.centerXAnchor constraintEqualToAnchor:self.promptTextView.centerXAnchor],
    [placeholderLabel.centerYAnchor constraintEqualToAnchor:self.promptTextView.centerYAnchor]
  ]];

  // Send button
  self.sendButton = [UIButton buttonWithType:UIButtonTypeSystem];
  self.sendButton.translatesAutoresizingMaskIntoConstraints = NO;
  UIImageSymbolConfiguration *sendConfig = [UIImageSymbolConfiguration configurationWithPointSize:18 weight:UIImageSymbolWeightSemibold];
  [self.sendButton setImage:[UIImage systemImageNamed:@"arrow.up.circle.fill" withConfiguration:sendConfig] forState:UIControlStateNormal];
  self.sendButton.tintColor = [UIColor whiteColor];
  self.sendButton.backgroundColor = VideoStudioAccentColor();
  self.sendButton.layer.cornerRadius = 18;
  self.sendButton.accessibilityLabel = @"Generate video";
  self.sendButton.alpha = 0;
  [self.sendButton addTarget:self action:@selector(generateVideo) forControlEvents:UIControlEventTouchUpInside];
  [self.inputContainer addSubview:self.sendButton];

  // Microphone button
  self.micButton = [UIButton buttonWithType:UIButtonTypeSystem];
  self.micButton.translatesAutoresizingMaskIntoConstraints = NO;
  UIImageSymbolConfiguration *micConfig = [UIImageSymbolConfiguration configurationWithPointSize:20 weight:UIImageSymbolWeightMedium];
  [self.micButton setImage:[UIImage systemImageNamed:@"mic.fill" withConfiguration:micConfig] forState:UIControlStateNormal];
  self.micButton.tintColor = [UIColor whiteColor];
  self.micButton.backgroundColor = [UIColor colorWithWhite:0.25 alpha:1.0];
  self.micButton.layer.cornerRadius = 18;
  self.micButton.accessibilityLabel = @"Voice input";
  self.micButton.accessibilityHint = @"Tap to start voice recording";
  [self.micButton addTarget:self action:@selector(startVoiceInput) forControlEvents:UIControlEventTouchUpInside];
  [self.inputContainer addSubview:self.micButton];

  // Loading indicator
  self.loadingIndicator = [[UIActivityIndicatorView alloc] initWithActivityIndicatorStyle:UIActivityIndicatorViewStyleMedium];
  self.loadingIndicator.translatesAutoresizingMaskIntoConstraints = NO;
  self.loadingIndicator.hidesWhenStopped = YES;
  self.loadingIndicator.color = [UIColor whiteColor];
  [self.inputContainer addSubview:self.loadingIndicator];

  [NSLayoutConstraint activateConstraints:@[
    [self.videoTypeButton.leadingAnchor constraintEqualToAnchor:self.inputContainer.leadingAnchor constant:10],
    [self.videoTypeButton.centerYAnchor constraintEqualToAnchor:self.micButton.centerYAnchor],
    [self.videoTypeButton.heightAnchor constraintEqualToConstant:36],

    [self.promptTextView.leadingAnchor constraintEqualToAnchor:self.videoTypeButton.trailingAnchor constant:10],
    [self.promptTextView.trailingAnchor constraintEqualToAnchor:self.micButton.leadingAnchor constant:-8],
    [self.promptTextView.topAnchor constraintEqualToAnchor:self.inputContainer.topAnchor constant:4],
    [self.promptTextView.bottomAnchor constraintEqualToAnchor:self.inputContainer.bottomAnchor constant:-4],

    [self.micButton.trailingAnchor constraintEqualToAnchor:self.inputContainer.trailingAnchor constant:-10],
    [self.micButton.bottomAnchor constraintEqualToAnchor:self.inputContainer.bottomAnchor constant:-10],
    [self.micButton.widthAnchor constraintEqualToConstant:36],
    [self.micButton.heightAnchor constraintEqualToConstant:36],

    [self.sendButton.trailingAnchor constraintEqualToAnchor:self.inputContainer.trailingAnchor constant:-10],
    [self.sendButton.bottomAnchor constraintEqualToAnchor:self.inputContainer.bottomAnchor constant:-10],
    [self.sendButton.widthAnchor constraintEqualToConstant:36],
    [self.sendButton.heightAnchor constraintEqualToConstant:36],

    [self.loadingIndicator.centerXAnchor constraintEqualToAnchor:self.sendButton.centerXAnchor],
    [self.loadingIndicator.centerYAnchor constraintEqualToAnchor:self.sendButton.centerYAnchor]
  ]];
}

- (void)setupVideoTypeMenu {
  if (@available(iOS 14.0, *)) {
    __weak typeof(self) weakSelf = self;

    UIAction *clipAction = [UIAction actionWithTitle:@"Clip"
                                               image:[UIImage systemImageNamed:@"scissors"]
                                          identifier:nil
                                             handler:^(__kindof UIAction *action) {
                                               weakSelf.selectedVideoType = EXVideoTypeClip;
                                               [weakSelf updateVideoTypeButtonTitle];
                                             }];

    UIAction *cinematicAction = [UIAction actionWithTitle:@"Cinematic"
                                                    image:[UIImage systemImageNamed:@"film.stack"]
                                               identifier:nil
                                                  handler:^(__kindof UIAction *action) {
                                                    weakSelf.selectedVideoType = EXVideoTypeCinematic;
                                                    [weakSelf updateVideoTypeButtonTitle];
                                                  }];

    UIAction *animationAction = [UIAction actionWithTitle:@"Animation"
                                                    image:[UIImage systemImageNamed:@"wand.and.stars"]
                                               identifier:nil
                                                  handler:^(__kindof UIAction *action) {
                                                    weakSelf.selectedVideoType = EXVideoTypeAnimation;
                                                    [weakSelf updateVideoTypeButtonTitle];
                                                  }];

    UIAction *motionAction = [UIAction actionWithTitle:@"Motion"
                                                 image:[UIImage systemImageNamed:@"figure.run"]
                                            identifier:nil
                                               handler:^(__kindof UIAction *action) {
                                                 weakSelf.selectedVideoType = EXVideoTypeMotion;
                                                 [weakSelf updateVideoTypeButtonTitle];
                                               }];

    UIMenu *menu = [UIMenu menuWithTitle:@"" children:@[clipAction, cinematicAction, animationAction, motionAction]];

    if (@available(iOS 16.0, *)) {
      menu.preferredElementSize = UIMenuElementSizeLarge;
    }

    self.videoTypeButton.menu = menu;
    self.videoTypeButton.showsMenuAsPrimaryAction = YES;
  }
}

- (void)setupBottomActionButton {
  self.bottomActionContainer = [[UIView alloc] init];
  self.bottomActionContainer.translatesAutoresizingMaskIntoConstraints = NO;
  self.bottomActionContainer.alpha = 0;
  [self.view addSubview:self.bottomActionContainer];

  self.addToPromptButton = [UIButton buttonWithType:UIButtonTypeSystem];
  self.addToPromptButton.translatesAutoresizingMaskIntoConstraints = NO;
  [self.addToPromptButton setTitle:@"Add to prompt" forState:UIControlStateNormal];
  self.addToPromptButton.titleLabel.font = [UIFont preferredFontForTextStyle:UIFontTextStyleHeadline];
  self.addToPromptButton.titleLabel.adjustsFontForContentSizeCategory = YES;
  [self.addToPromptButton setTitleColor:[UIColor blackColor] forState:UIControlStateNormal];
  self.addToPromptButton.backgroundColor = [UIColor whiteColor];
  self.addToPromptButton.layer.cornerRadius = 26;
  self.addToPromptButton.accessibilityLabel = @"Add selected videos to prompt";
  [self.addToPromptButton addTarget:self action:@selector(addSelectedToPrompt) forControlEvents:UIControlEventTouchUpInside];
  [self.bottomActionContainer addSubview:self.addToPromptButton];

  self.selectionCountLabel = [[UILabel alloc] init];
  self.selectionCountLabel.translatesAutoresizingMaskIntoConstraints = NO;
  self.selectionCountLabel.textColor = [UIColor colorWithWhite:0.5 alpha:1.0];
  self.selectionCountLabel.font = [UIFont preferredFontForTextStyle:UIFontTextStyleSubheadline];
  self.selectionCountLabel.adjustsFontForContentSizeCategory = YES;
  self.selectionCountLabel.textAlignment = NSTextAlignmentCenter;
  [self.bottomActionContainer addSubview:self.selectionCountLabel];

  [NSLayoutConstraint activateConstraints:@[
    [self.addToPromptButton.topAnchor constraintEqualToAnchor:self.bottomActionContainer.topAnchor],
    [self.addToPromptButton.leadingAnchor constraintEqualToAnchor:self.bottomActionContainer.leadingAnchor constant:20],
    [self.addToPromptButton.trailingAnchor constraintEqualToAnchor:self.bottomActionContainer.trailingAnchor constant:-20],
    [self.addToPromptButton.heightAnchor constraintEqualToConstant:52],

    [self.selectionCountLabel.topAnchor constraintEqualToAnchor:self.addToPromptButton.bottomAnchor constant:8],
    [self.selectionCountLabel.centerXAnchor constraintEqualToAnchor:self.bottomActionContainer.centerXAnchor],
    [self.selectionCountLabel.bottomAnchor constraintEqualToAnchor:self.bottomActionContainer.bottomAnchor]
  ]];
}

- (void)setupCollectionView {
  UICollectionViewFlowLayout *layout = [[UICollectionViewFlowLayout alloc] init];
  layout.scrollDirection = UICollectionViewScrollDirectionVertical;
  layout.minimumInteritemSpacing = 12;
  layout.minimumLineSpacing = 12;
  layout.sectionInset = UIEdgeInsetsMake(20, 20, 20, 20);

  self.videoCollectionView = [[UICollectionView alloc] initWithFrame:CGRectZero collectionViewLayout:layout];
  self.videoCollectionView.translatesAutoresizingMaskIntoConstraints = NO;
  self.videoCollectionView.backgroundColor = [UIColor clearColor];
  self.videoCollectionView.dataSource = self;
  self.videoCollectionView.delegate = self;
  self.videoCollectionView.showsHorizontalScrollIndicator = NO;
  self.videoCollectionView.showsVerticalScrollIndicator = YES;
  self.videoCollectionView.alwaysBounceVertical = YES;
  self.videoCollectionView.clipsToBounds = NO;
  [self.videoCollectionView registerClass:[EXVideoStudioCell class] forCellWithReuseIdentifier:@"VideoCell"];
  [self.videoCollectionView registerClass:[EXVideoStudioAddCell class] forCellWithReuseIdentifier:@"AddCell"];
  [self.view addSubview:self.videoCollectionView];
}

- (void)setupEmptyState {
  self.emptyStateLabel = [[UILabel alloc] init];
  self.emptyStateLabel.text = @"No videos yet.\nGenerate or upload your first video!";
  self.emptyStateLabel.textColor = [UIColor colorWithWhite:0.5 alpha:1.0];
  self.emptyStateLabel.font = [UIFont systemFontOfSize:16];
  self.emptyStateLabel.textAlignment = NSTextAlignmentCenter;
  self.emptyStateLabel.numberOfLines = 0;
  self.emptyStateLabel.translatesAutoresizingMaskIntoConstraints = NO;
  self.emptyStateLabel.hidden = YES;
  [self.view addSubview:self.emptyStateLabel];
}

- (void)setupConstraints {
  self.inputContainerBottomConstraint = [self.inputContainer.bottomAnchor constraintEqualToAnchor:self.view.safeAreaLayoutGuide.bottomAnchor constant:-20];
  self.bottomActionBottomConstraint = [self.bottomActionContainer.bottomAnchor constraintEqualToAnchor:self.view.safeAreaLayoutGuide.bottomAnchor constant:-20];
  self.inputContainerHeightConstraint = [self.inputContainer.heightAnchor constraintEqualToConstant:56];

  [NSLayoutConstraint activateConstraints:@[
    [self.videoCollectionView.topAnchor constraintEqualToAnchor:self.view.safeAreaLayoutGuide.topAnchor],
    [self.videoCollectionView.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor],
    [self.videoCollectionView.trailingAnchor constraintEqualToAnchor:self.view.trailingAnchor],
    [self.videoCollectionView.bottomAnchor constraintEqualToAnchor:self.inputContainer.topAnchor constant:-12],

    [self.inputContainer.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor constant:20],
    [self.inputContainer.trailingAnchor constraintEqualToAnchor:self.view.trailingAnchor constant:-20],
    self.inputContainerBottomConstraint,
    self.inputContainerHeightConstraint,

    [self.bottomActionContainer.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor],
    [self.bottomActionContainer.trailingAnchor constraintEqualToAnchor:self.view.trailingAnchor],
    self.bottomActionBottomConstraint,

    [self.emptyStateLabel.centerXAnchor constraintEqualToAnchor:self.view.centerXAnchor],
    [self.emptyStateLabel.centerYAnchor constraintEqualToAnchor:self.view.centerYAnchor constant:-50],
    [self.emptyStateLabel.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor constant:40],
    [self.emptyStateLabel.trailingAnchor constraintEqualToAnchor:self.view.trailingAnchor constant:-40]
  ]];
}

- (void)setupKeyboardObservers {
  [[NSNotificationCenter defaultCenter] addObserver:self
                                           selector:@selector(keyboardWillShow:)
                                               name:UIKeyboardWillShowNotification
                                             object:nil];
  [[NSNotificationCenter defaultCenter] addObserver:self
                                           selector:@selector(keyboardWillHide:)
                                               name:UIKeyboardWillHideNotification
                                             object:nil];
}

- (void)keyboardWillShow:(NSNotification *)notification {
  NSDictionary *userInfo = notification.userInfo;
  CGRect keyboardFrame = [userInfo[UIKeyboardFrameEndUserInfoKey] CGRectValue];
  NSTimeInterval duration = [userInfo[UIKeyboardAnimationDurationUserInfoKey] doubleValue];
  UIViewAnimationCurve curve = [userInfo[UIKeyboardAnimationCurveUserInfoKey] integerValue];

  CGFloat keyboardHeight = keyboardFrame.size.height;
  CGFloat safeAreaBottom = self.view.safeAreaInsets.bottom;
  CGFloat bottomOffset = -(keyboardHeight - safeAreaBottom + 8);

  self.inputContainerBottomConstraint.constant = bottomOffset;
  self.bottomActionBottomConstraint.constant = bottomOffset;

  [UIView animateWithDuration:duration delay:0 options:(curve << 16) animations:^{
    [self.view layoutIfNeeded];
  } completion:nil];
}

- (void)keyboardWillHide:(NSNotification *)notification {
  NSDictionary *userInfo = notification.userInfo;
  NSTimeInterval duration = [userInfo[UIKeyboardAnimationDurationUserInfoKey] doubleValue];
  UIViewAnimationCurve curve = [userInfo[UIKeyboardAnimationCurveUserInfoKey] integerValue];

  self.inputContainerBottomConstraint.constant = -20;
  self.bottomActionBottomConstraint.constant = -20;

  [UIView animateWithDuration:duration delay:0 options:(curve << 16) animations:^{
    [self.view layoutIfNeeded];
  } completion:nil];
}

#pragma mark - Actions

- (void)dismissKeyboard {
  [self.view endEditing:YES];
}

- (void)closeModal {
  [self.refreshTimer invalidate];
  self.refreshTimer = nil;
  self.manager.videoStudioModalPresented = NO;
  [self dismissViewControllerAnimated:YES completion:nil];
}

- (void)updateVideoTypeButtonTitle {
  NSString *title;
  switch (self.selectedVideoType) {
    case EXVideoTypeClip:
      title = @"Clip";
      break;
    case EXVideoTypeCinematic:
      title = @"Cine";
      break;
    case EXVideoTypeAnimation:
      title = @"Anim";
      break;
    case EXVideoTypeMotion:
      title = @"Motion";
      break;
  }
  [self.videoTypeButton setTitle:[NSString stringWithFormat:@"%@ ▾", title] forState:UIControlStateNormal];
}

- (void)pollForUpdates {
  BOOL hasGeneratingVideos = NO;
  for (NSDictionary *video in self.videos) {
    if ([video[@"status"] isEqualToString:@"generating"]) {
      hasGeneratingVideos = YES;
      break;
    }
  }

  if (hasGeneratingVideos) {
    [self loadVideos];
  }
}

#pragma mark - UITextViewDelegate

- (void)textViewDidChange:(UITextView *)textView {
  UILabel *placeholder = [textView viewWithTag:999];
  placeholder.hidden = textView.text.length > 0;

  BOOL hasText = textView.text.length > 0;
  [UIView animateWithDuration:0.2 animations:^{
    self.sendButton.alpha = hasText ? 1.0 : 0.0;
    self.micButton.alpha = hasText ? 0.0 : 1.0;
  }];

  CGSize sizeThatFits = [textView sizeThatFits:CGSizeMake(textView.frame.size.width, CGFLOAT_MAX)];
  CGFloat newHeight = MAX(56, MIN(120, sizeThatFits.height + 16));

  if (self.inputContainerHeightConstraint.constant != newHeight) {
    self.inputContainerHeightConstraint.constant = newHeight;
    [UIView animateWithDuration:0.15 animations:^{
      [self.view layoutIfNeeded];
    }];
  }
}

#pragma mark - Voice Input

- (void)startVoiceInput {
  if (self.isRecording || self.isTranscribing) {
    [self stopVoiceRecording];
    return;
  }

  AVAudioSession *audioSession = [AVAudioSession sharedInstance];
  AVAudioSessionRecordPermission permission = [audioSession recordPermission];

  if (permission == AVAudioSessionRecordPermissionDenied) {
    [self showMicrophonePermissionAlert];
    return;
  }

  __weak typeof(self) weakSelf = self;

  [[EXAudioRecorderService sharedInstance]
      startRecordingWithMeteringCallback:^(float level) {
        dispatch_async(dispatch_get_main_queue(), ^{
          [weakSelf updateWaveformWithLevel:level];
        });
      }
      completion:^(NSError * _Nullable error) {
        dispatch_async(dispatch_get_main_queue(), ^{
          if (error) {
            NSLog(@"❌ [VideoStudio] Recording failed to start: %@", error);
            if ([error.localizedDescription containsString:@"permission"]) {
              [weakSelf showMicrophonePermissionAlert];
            }
            return;
          }

          weakSelf.isRecording = YES;
          [weakSelf showRecordingUI];
        });
      }];
}

- (void)stopVoiceRecording {
  if (!self.isRecording) {
    return;
  }

  NSLog(@"🎤 [VideoStudio] Stopping voice recording");

  self.isRecording = NO;
  self.isTranscribing = YES;
  [self showTranscribingUI];

  __weak typeof(self) weakSelf = self;

  [[EXAudioRecorderService sharedInstance]
      stopRecordingWithCompletion:^(NSURL * _Nullable audioURL, NSError * _Nullable error) {
        if (error || !audioURL) {
          NSLog(@"❌ [VideoStudio] Recording stop failed: %@", error);
          dispatch_async(dispatch_get_main_queue(), ^{
            weakSelf.isTranscribing = NO;
            [weakSelf hideRecordingUI];
          });
          return;
        }

        NSLog(@"✅ [VideoStudio] Recording saved: %@", audioURL);

        [[EXAssemblyAIService sharedInstance]
            transcribeAudioFile:audioURL
            completion:^(NSString * _Nullable transcribedText, NSError * _Nullable transcribeError) {
              dispatch_async(dispatch_get_main_queue(), ^{
                weakSelf.isTranscribing = NO;
                [weakSelf hideRecordingUI];

                if (transcribeError) {
                  NSLog(@"❌ [VideoStudio] Transcription failed: %@", transcribeError);
                  return;
                }

                if (transcribedText && transcribedText.length > 0) {
                  NSLog(@"✅ [VideoStudio] Transcription: %@", transcribedText);
                  NSString *currentText = weakSelf.promptTextView.text ?: @"";
                  if (currentText.length > 0 && ![currentText hasSuffix:@" "]) {
                    currentText = [currentText stringByAppendingString:@" "];
                  }
                  weakSelf.promptTextView.text = [currentText stringByAppendingString:transcribedText];

                  [weakSelf textViewDidChange:weakSelf.promptTextView];

                  UINotificationFeedbackGenerator *feedback = [[UINotificationFeedbackGenerator alloc] init];
                  [feedback notificationOccurred:UINotificationFeedbackTypeSuccess];
                }

                [[NSFileManager defaultManager] removeItemAtURL:audioURL error:nil];
              });
            }];
      }];
}

- (void)showRecordingUI {
  self.micButton.backgroundColor = [UIColor colorWithRed:0.9 green:0.3 blue:0.3 alpha:1.0];
  UIImageSymbolConfiguration *micConfig = [UIImageSymbolConfiguration configurationWithPointSize:20 weight:UIImageSymbolWeightMedium];
  [self.micButton setImage:[UIImage systemImageNamed:@"stop.fill" withConfiguration:micConfig] forState:UIControlStateNormal];
  self.micButton.alpha = 1.0;

  if (!self.recordingOverlay) {
    self.recordingOverlay = [[UIView alloc] init];
    self.recordingOverlay.translatesAutoresizingMaskIntoConstraints = NO;
    self.recordingOverlay.backgroundColor = [UIColor colorWithRed:0.15 green:0.15 blue:0.18 alpha:0.98];
    self.recordingOverlay.layer.cornerRadius = 20;
    [self.inputContainer addSubview:self.recordingOverlay];

    UIView *redDot = [[UIView alloc] init];
    redDot.translatesAutoresizingMaskIntoConstraints = NO;
    redDot.backgroundColor = [UIColor colorWithRed:0.9 green:0.3 blue:0.3 alpha:1.0];
    redDot.layer.cornerRadius = 5;
    redDot.tag = 100;
    [self.recordingOverlay addSubview:redDot];

    self.recordingLabel = [[UILabel alloc] init];
    self.recordingLabel.translatesAutoresizingMaskIntoConstraints = NO;
    self.recordingLabel.text = @"Recording...";
    self.recordingLabel.textColor = [UIColor whiteColor];
    self.recordingLabel.font = [UIFont systemFontOfSize:14 weight:UIFontWeightMedium];
    [self.recordingOverlay addSubview:self.recordingLabel];

    self.waveformView = [[EXAudioWaveformView alloc] init];
    self.waveformView.translatesAutoresizingMaskIntoConstraints = NO;
    self.waveformView.barColor = [UIColor colorWithRed:0.9 green:0.3 blue:0.3 alpha:1.0];
    self.waveformView.numberOfBars = 16;
    self.waveformView.barWidth = 2.5;
    self.waveformView.barSpacing = 2.5;
    self.waveformView.minimumBarHeightRatio = 0.15;
    [self.recordingOverlay addSubview:self.waveformView];

    [NSLayoutConstraint activateConstraints:@[
      [self.recordingOverlay.leadingAnchor constraintEqualToAnchor:self.inputContainer.leadingAnchor constant:8],
      [self.recordingOverlay.trailingAnchor constraintEqualToAnchor:self.micButton.leadingAnchor constant:-8],
      [self.recordingOverlay.topAnchor constraintEqualToAnchor:self.inputContainer.topAnchor constant:8],
      [self.recordingOverlay.bottomAnchor constraintEqualToAnchor:self.inputContainer.bottomAnchor constant:-8],

      [redDot.leadingAnchor constraintEqualToAnchor:self.recordingOverlay.leadingAnchor constant:14],
      [redDot.centerYAnchor constraintEqualToAnchor:self.recordingOverlay.centerYAnchor],
      [redDot.widthAnchor constraintEqualToConstant:10],
      [redDot.heightAnchor constraintEqualToConstant:10],

      [self.recordingLabel.leadingAnchor constraintEqualToAnchor:redDot.trailingAnchor constant:8],
      [self.recordingLabel.centerYAnchor constraintEqualToAnchor:self.recordingOverlay.centerYAnchor],

      [self.waveformView.leadingAnchor constraintEqualToAnchor:self.recordingLabel.trailingAnchor constant:12],
      [self.waveformView.trailingAnchor constraintEqualToAnchor:self.recordingOverlay.trailingAnchor constant:-12],
      [self.waveformView.centerYAnchor constraintEqualToAnchor:self.recordingOverlay.centerYAnchor],
      [self.waveformView.heightAnchor constraintEqualToConstant:28]
    ]];
  }

  self.recordingOverlay.alpha = 0;
  self.recordingOverlay.hidden = NO;
  self.promptTextView.hidden = YES;
  self.videoTypeButton.hidden = YES;
  self.sendButton.hidden = YES;

  [self.waveformView startAnimating];

  [UIView animateWithDuration:0.2 animations:^{
    self.recordingOverlay.alpha = 1;
  }];

  UIView *redDot = [self.recordingOverlay viewWithTag:100];
  [UIView animateWithDuration:0.5 delay:0 options:UIViewAnimationOptionRepeat | UIViewAnimationOptionAutoreverse animations:^{
    redDot.alpha = 0.3;
  } completion:nil];
}

- (void)showTranscribingUI {
  self.recordingLabel.text = @"Transcribing...";

  [self.waveformView stopAnimating];
  self.waveformView.barColor = VideoStudioAccentColor();
  [self.waveformView reset];

  UIView *redDot = [self.recordingOverlay viewWithTag:100];
  [redDot.layer removeAllAnimations];
  redDot.alpha = 1.0;
  redDot.backgroundColor = VideoStudioAccentColor();
}

- (void)hideRecordingUI {
  self.micButton.backgroundColor = [UIColor colorWithWhite:0.25 alpha:1.0];
  UIImageSymbolConfiguration *micConfig = [UIImageSymbolConfiguration configurationWithPointSize:20 weight:UIImageSymbolWeightMedium];
  [self.micButton setImage:[UIImage systemImageNamed:@"mic.fill" withConfiguration:micConfig] forState:UIControlStateNormal];

  [self.waveformView stopAnimating];
  [self.waveformView reset];

  [UIView animateWithDuration:0.2 animations:^{
    self.recordingOverlay.alpha = 0;
  } completion:^(BOOL finished) {
    self.recordingOverlay.hidden = YES;
    self.promptTextView.hidden = NO;
    self.videoTypeButton.hidden = NO;
    self.sendButton.hidden = NO;

    BOOL hasText = self.promptTextView.text.length > 0;
    self.sendButton.alpha = hasText ? 1.0 : 0.0;
    self.micButton.alpha = hasText ? 0.0 : 1.0;

    self.recordingLabel.text = @"Recording...";
    UIView *redDot = [self.recordingOverlay viewWithTag:100];
    redDot.backgroundColor = [UIColor colorWithRed:0.9 green:0.3 blue:0.3 alpha:1.0];
    self.waveformView.barColor = [UIColor colorWithRed:0.9 green:0.3 blue:0.3 alpha:1.0];
  }];
}

- (void)updateWaveformWithLevel:(float)level {
  [self.waveformView updateWithLevel:level];
}

- (void)showMicrophonePermissionAlert {
  UIAlertController *alert = [UIAlertController alertControllerWithTitle:@"Microphone Access"
                                                                 message:@"Please enable microphone access in Settings to use voice input."
                                                          preferredStyle:UIAlertControllerStyleAlert];

  [alert addAction:[UIAlertAction actionWithTitle:@"Cancel" style:UIAlertActionStyleCancel handler:nil]];
  [alert addAction:[UIAlertAction actionWithTitle:@"Settings" style:UIAlertActionStyleDefault handler:^(UIAlertAction *action) {
    NSURL *settingsURL = [NSURL URLWithString:UIApplicationOpenSettingsURLString];
    if ([[UIApplication sharedApplication] canOpenURL:settingsURL]) {
      [[UIApplication sharedApplication] openURL:settingsURL options:@{} completionHandler:nil];
    }
  }]];

  [self presentViewController:alert animated:YES completion:nil];
}

#pragma mark - Selection

- (void)updateSelectionUI {
  NSUInteger count = self.selectedVideoIds.count;
  BOOL hasSelection = count > 0;

  if (hasSelection) {
    self.selectionCountLabel.text = [NSString stringWithFormat:@"%lu selected", (unsigned long)count];
  }

  [UIView animateWithDuration:0.3 delay:0 usingSpringWithDamping:0.8 initialSpringVelocity:0.5 options:UIViewAnimationOptionCurveEaseInOut animations:^{
    self.bottomActionContainer.alpha = hasSelection ? 1 : 0;
    self.inputContainer.alpha = hasSelection ? 0 : 1;
  } completion:nil];

  [self.videoCollectionView reloadData];
}

- (void)addSelectedToPrompt {
  // NEW IMPLEMENTATION: Add as pending attachment, defer upload to send time
  // This matches the pattern used by Image Studio and Audio Studio

  NSArray *selectedIds = [self.selectedVideoIds allObjects];
  if (selectedIds.count == 0) {
    [self closeModal];
    return;
  }

  // Show loading indicator while downloading video data
  UIAlertController *loadingAlert = [UIAlertController alertControllerWithTitle:nil message:@"Adding videos..." preferredStyle:UIAlertControllerStyleAlert];
  [self presentViewController:loadingAlert animated:YES completion:nil];

  __block NSInteger processedCount = 0;
  NSInteger totalCount = selectedIds.count;
  __weak typeof(self) weakSelf = self;

  for (NSString *videoId in selectedIds) {
    NSDictionary *foundVideoData = nil;
    for (NSDictionary *videoData in self.videos) {
      if ([videoData[@"_id"] isEqualToString:videoId]) {
        foundVideoData = videoData;
        break;
      }
    }

    if (!foundVideoData) {
      processedCount++;
      if (processedCount >= totalCount) {
        dispatch_async(dispatch_get_main_queue(), ^{
          [loadingAlert dismissViewControllerAnimated:YES completion:^{
            [weakSelf.selectedVideoIds removeAllObjects];
            [weakSelf closeModal];
          }];
        });
      }
      continue;
    }

    NSString *videoUrl = foundVideoData[@"url"];
    NSString *videoName = foundVideoData[@"name"] ?: [NSString stringWithFormat:@"video-%@", videoId];

    if (!videoUrl) {
      processedCount++;
      if (processedCount >= totalCount) {
        dispatch_async(dispatch_get_main_queue(), ^{
          [loadingAlert dismissViewControllerAnimated:YES completion:^{
            [weakSelf.selectedVideoIds removeAllObjects];
            [weakSelf closeModal];
          }];
        });
      }
      continue;
    }

    // Download video data (but do NOT upload yet - that happens at send time)
    NSURL *url = [NSURL URLWithString:videoUrl];
    NSURLSessionDataTask *task = [[NSURLSession sharedSession] dataTaskWithURL:url completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
      __strong typeof(weakSelf) strongSelf = weakSelf;
      if (!strongSelf) return;

      dispatch_async(dispatch_get_main_queue(), ^{
        if (!error && data) {
          // Add as pending attachment - NO UPLOAD
          // Upload will happen when user clicks Send
          [strongSelf.manager addVideoAttachment:data fileName:videoName];
          NSLog(@"🎬 [VideoStudio] Added video as pending attachment: %@", videoName);
        } else {
          NSLog(@"🎬 [VideoStudio] Failed to download video %@: %@", videoName, error.localizedDescription);
        }

        processedCount++;
        if (processedCount >= totalCount) {
          [loadingAlert dismissViewControllerAnimated:YES completion:^{
            [strongSelf.selectedVideoIds removeAllObjects];

            // Haptic feedback for success
            UINotificationFeedbackGenerator *feedback = [[UINotificationFeedbackGenerator alloc] init];
            [feedback notificationOccurred:UINotificationFeedbackTypeSuccess];

            [strongSelf closeModal];
          }];
        }
      });
    }];
    [task resume];
  }
}

#pragma mark - Video Generation & Loading

- (void)generateVideo {
  NSString *prompt = [self.promptTextView.text stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];

  if (prompt.length == 0) {
    return;
  }

  self.sendButton.hidden = YES;
  [self.loadingIndicator startAnimating];

  NSString *clerkId = [[NSUserDefaults standardUserDefaults] stringForKey:@"CLERK_USER_ID"];

  if (!clerkId) {
    [self showError:@"Please sign in to generate videos"];
    self.sendButton.hidden = NO;
    [self.loadingIndicator stopAnimating];
    return;
  }

  NSString *videoTypeString;
  switch (self.selectedVideoType) {
    case EXVideoTypeClip:
      videoTypeString = @"clip";
      break;
    case EXVideoTypeCinematic:
      videoTypeString = @"cinematic";
      break;
    case EXVideoTypeAnimation:
      videoTypeString = @"animation";
      break;
    case EXVideoTypeMotion:
      videoTypeString = @"motion";
      break;
  }

  NSString *videoName = [NSString stringWithFormat:@"%@-%ld", videoTypeString, (long)[[NSDate date] timeIntervalSince1970]];

  NSString *startGenerationURL = [NSString stringWithFormat:@"%@/api/videos/start-generation", [EXEnvBridge v0ApiUrl]];

  NSMutableURLRequest *startRequest = [NSMutableURLRequest requestWithURL:[NSURL URLWithString:startGenerationURL]];
  startRequest.HTTPMethod = @"POST";
  [startRequest setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];

  NSDictionary *startBody = @{
    @"clerkId": clerkId,
    @"name": videoName,
    @"prompt": prompt,
    @"videoType": videoTypeString
  };

  startRequest.HTTPBody = [NSJSONSerialization dataWithJSONObject:startBody options:0 error:nil];

  __weak typeof(self) weakSelf = self;
  NSString *capturedVideoType = [videoTypeString copy];

  NSURLSessionDataTask *startTask = [[NSURLSession sharedSession] dataTaskWithRequest:startRequest completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
    dispatch_async(dispatch_get_main_queue(), ^{
      __strong typeof(weakSelf) strongSelf = weakSelf;
      if (!strongSelf) return;

      strongSelf.sendButton.hidden = NO;
      [strongSelf.loadingIndicator stopAnimating];
      strongSelf.promptTextView.text = @"";
      [strongSelf textViewDidChange:strongSelf.promptTextView];

      if (error) {
        [strongSelf showError:@"Failed to start video generation"];
        return;
      }

      NSError *parseError;
      NSDictionary *result = [NSJSONSerialization JSONObjectWithData:data options:0 error:&parseError];

      if (parseError || !result[@"videoId"]) {
        [strongSelf showError:@"Failed to create video record"];
        return;
      }

      NSString *videoId = result[@"videoId"];
      [strongSelf triggerBackgroundGeneration:videoId prompt:prompt videoType:capturedVideoType];

      [strongSelf loadVideos];

      UIImpactFeedbackGenerator *feedback = [[UIImpactFeedbackGenerator alloc] initWithStyle:UIImpactFeedbackStyleMedium];
      [feedback impactOccurred];
    });
  }];

  [startTask resume];
}

- (void)triggerBackgroundGeneration:(NSString *)videoId prompt:(NSString *)prompt videoType:(NSString *)videoType {
  NSString *generateURL = [NSString stringWithFormat:@"%@/api/generate-video", [EXEnvBridge v0ApiUrl]];

  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:[NSURL URLWithString:generateURL]];
  request.HTTPMethod = @"POST";
  [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];

  NSDictionary *body = @{
    @"videoId": videoId,
    @"prompt": prompt,
    @"videoType": videoType ?: @"clip"
  };

  request.HTTPBody = [NSJSONSerialization dataWithJSONObject:body options:0 error:nil];

  NSURLSessionDataTask *task = [[NSURLSession sharedSession] dataTaskWithRequest:request completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
    // Background generation triggered
  }];

  [task resume];
}

- (void)loadVideos {
  NSString *clerkId = [[NSUserDefaults standardUserDefaults] stringForKey:@"CLERK_USER_ID"];

  if (!clerkId) {
    return;
  }

  NSString *videosURL = [NSString stringWithFormat:@"%@/api/videos/list?clerkId=%@", [EXEnvBridge v0ApiUrl], clerkId];

  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:[NSURL URLWithString:videosURL]];
  request.HTTPMethod = @"GET";

  __weak typeof(self) weakSelf = self;

  NSURLSessionDataTask *task = [[NSURLSession sharedSession] dataTaskWithRequest:request completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
    dispatch_async(dispatch_get_main_queue(), ^{
      __strong typeof(weakSelf) strongSelf = weakSelf;
      if (!strongSelf) return;

      if (error || !data) {
        return;
      }

      NSError *parseError;
      NSDictionary *result = [NSJSONSerialization JSONObjectWithData:data options:0 error:&parseError];

      if (parseError) {
        return;
      }

      NSArray *videosArray = result[@"videos"];
      if (videosArray && [videosArray isKindOfClass:[NSArray class]]) {
        BOOL needsReload = (videosArray.count != strongSelf.videos.count);

        if (!needsReload) {
          for (NSUInteger i = 0; i < videosArray.count; i++) {
            NSDictionary *newVideo = videosArray[i];
            NSDictionary *oldVideo = strongSelf.videos[i];
            if (![newVideo[@"_id"] isEqual:oldVideo[@"_id"]] ||
                ![newVideo[@"status"] isEqual:oldVideo[@"status"]] ||
                ![newVideo[@"url"] isEqual:oldVideo[@"url"]]) {
              needsReload = YES;
              break;
            }
          }
        }

        if (needsReload) {
          [strongSelf.videos removeAllObjects];
          [strongSelf.videos addObjectsFromArray:videosArray];
          [strongSelf.videoCollectionView reloadData];
        }

        strongSelf.emptyStateLabel.hidden = YES;
      }
    });
  }];

  [task resume];
}

- (void)uploadFromDevice {
  if (@available(iOS 14.0, *)) {
    PHPickerConfiguration *config = [[PHPickerConfiguration alloc] init];
    config.selectionLimit = 0;
    config.filter = [PHPickerFilter videosFilter];

    PHPickerViewController *picker = [[PHPickerViewController alloc] initWithConfiguration:config];
    picker.delegate = self;
    [self presentViewController:picker animated:YES completion:nil];
  } else {
    UIImagePickerController *picker = [[UIImagePickerController alloc] init];
    picker.sourceType = UIImagePickerControllerSourceTypePhotoLibrary;
    picker.mediaTypes = @[@"public.movie"];
    [self presentViewController:picker animated:YES completion:nil];
  }
}

- (void)playVideo:(NSString *)videoUrl {
  NSURL *url = [NSURL URLWithString:videoUrl];
  AVPlayer *player = [AVPlayer playerWithURL:url];
  AVPlayerViewController *playerVC = [[AVPlayerViewController alloc] init];
  playerVC.player = player;

  [self presentViewController:playerVC animated:YES completion:^{
    [player play];
  }];
}

- (void)showError:(NSString *)message {
  UIAlertController *alert = [UIAlertController alertControllerWithTitle:@"Error"
                                                                 message:message
                                                          preferredStyle:UIAlertControllerStyleAlert];
  [alert addAction:[UIAlertAction actionWithTitle:@"OK" style:UIAlertActionStyleDefault handler:nil]];
  [self presentViewController:alert animated:YES completion:nil];
}

#pragma mark - PHPickerViewControllerDelegate

- (void)picker:(PHPickerViewController *)picker didFinishPicking:(NSArray<PHPickerResult *> *)results API_AVAILABLE(ios(14.0)) {
  [picker dismissViewControllerAnimated:YES completion:nil];

  if (results.count == 0) return;

  for (PHPickerResult *result in results) {
    if ([result.itemProvider hasItemConformingToTypeIdentifier:@"public.movie"]) {
      __weak typeof(self) weakSelf = self;
      [result.itemProvider loadFileRepresentationForTypeIdentifier:@"public.movie" completionHandler:^(NSURL *url, NSError *error) {
        if (error || !url) {
          return;
        }

        NSData *videoData = [NSData dataWithContentsOfURL:url];
        if (!videoData) {
          return;
        }

        dispatch_async(dispatch_get_main_queue(), ^{
          [weakSelf uploadDeviceVideo:videoData];
        });
      }];
    }
  }
}

- (void)uploadDeviceVideo:(NSData *)videoData {
  NSString *clerkId = [[NSUserDefaults standardUserDefaults] stringForKey:@"CLERK_USER_ID"];

  if (!clerkId) {
    [self showError:@"Please sign in to upload videos"];
    return;
  }

  UIAlertController *loadingAlert = [UIAlertController alertControllerWithTitle:nil message:@"Uploading video..." preferredStyle:UIAlertControllerStyleAlert];
  [self presentViewController:loadingAlert animated:YES completion:nil];

  NSString *videoName = [NSString stringWithFormat:@"uploaded-%ld", (long)[[NSDate date] timeIntervalSince1970]];

  NSString *uploadURL = [NSString stringWithFormat:@"%@/api/videos/upload", [EXEnvBridge v0ApiUrl]];

  NSString *boundary = [[NSUUID UUID] UUIDString];
  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:[NSURL URLWithString:uploadURL]];
  request.HTTPMethod = @"POST";
  [request setValue:[NSString stringWithFormat:@"multipart/form-data; boundary=%@", boundary] forHTTPHeaderField:@"Content-Type"];

  NSMutableData *body = [NSMutableData data];

  [body appendData:[[NSString stringWithFormat:@"--%@\r\n", boundary] dataUsingEncoding:NSUTF8StringEncoding]];
  [body appendData:[@"Content-Disposition: form-data; name=\"clerkId\"\r\n\r\n" dataUsingEncoding:NSUTF8StringEncoding]];
  [body appendData:[clerkId dataUsingEncoding:NSUTF8StringEncoding]];
  [body appendData:[@"\r\n" dataUsingEncoding:NSUTF8StringEncoding]];

  [body appendData:[[NSString stringWithFormat:@"--%@\r\n", boundary] dataUsingEncoding:NSUTF8StringEncoding]];
  [body appendData:[@"Content-Disposition: form-data; name=\"name\"\r\n\r\n" dataUsingEncoding:NSUTF8StringEncoding]];
  [body appendData:[videoName dataUsingEncoding:NSUTF8StringEncoding]];
  [body appendData:[@"\r\n" dataUsingEncoding:NSUTF8StringEncoding]];

  [body appendData:[[NSString stringWithFormat:@"--%@\r\n", boundary] dataUsingEncoding:NSUTF8StringEncoding]];
  [body appendData:[[NSString stringWithFormat:@"Content-Disposition: form-data; name=\"file\"; filename=\"%@.mp4\"\r\n", videoName] dataUsingEncoding:NSUTF8StringEncoding]];
  [body appendData:[@"Content-Type: video/mp4\r\n\r\n" dataUsingEncoding:NSUTF8StringEncoding]];
  [body appendData:videoData];
  [body appendData:[@"\r\n" dataUsingEncoding:NSUTF8StringEncoding]];

  [body appendData:[[NSString stringWithFormat:@"--%@--\r\n", boundary] dataUsingEncoding:NSUTF8StringEncoding]];

  request.HTTPBody = body;

  __weak typeof(self) weakSelf = self;

  NSURLSessionDataTask *task = [[NSURLSession sharedSession] dataTaskWithRequest:request completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
    dispatch_async(dispatch_get_main_queue(), ^{
      [loadingAlert dismissViewControllerAnimated:YES completion:^{
        __strong typeof(weakSelf) strongSelf = weakSelf;
        if (!strongSelf) return;

        if (error) {
          [strongSelf showError:@"Failed to upload video"];
          return;
        }

        UINotificationFeedbackGenerator *feedback = [[UINotificationFeedbackGenerator alloc] init];
        [feedback notificationOccurred:UINotificationFeedbackTypeSuccess];

        [strongSelf loadVideos];
      }];
    });
  }];

  [task resume];
}

#pragma mark - UICollectionViewDataSource

- (NSInteger)collectionView:(UICollectionView *)collectionView numberOfItemsInSection:(NSInteger)section {
  return self.videos.count + 1; // +1 for add cell at position 0
}

- (UICollectionViewCell *)collectionView:(UICollectionView *)collectionView cellForItemAtIndexPath:(NSIndexPath *)indexPath {
  // First cell (index 0) is the "Add" cell
  if (indexPath.item == 0) {
    EXVideoStudioAddCell *addCell = [collectionView dequeueReusableCellWithReuseIdentifier:@"AddCell" forIndexPath:indexPath];
    return addCell;
  }

  // Video cells start at index 1
  NSInteger videoIndex = indexPath.item - 1;
  EXVideoStudioCell *cell = [collectionView dequeueReusableCellWithReuseIdentifier:@"VideoCell" forIndexPath:indexPath];

  NSDictionary *videoData = self.videos[videoIndex];
  NSString *status = videoData[@"status"];
  NSString *videoId = videoData[@"_id"];
  NSString *videoName = videoData[@"name"] ?: @"Video";
  cell.currentVideoId = videoId;

  if ([status isEqualToString:@"generating"]) {
    [cell configureForGeneratingState];
  } else if ([status isEqualToString:@"error"]) {
    [cell configureForErrorState];
  } else if ([status isEqualToString:@"completed"]) {
    BOOL isSelected = [self.selectedVideoIds containsObject:videoId];
    NSInteger selectionIndex = isSelected ? [[self.selectedVideoIds allObjects] indexOfObject:videoId] + 1 : 0;
    [cell configureForCompletedStateWithName:videoName isSelected:isSelected selectionIndex:selectionIndex];
  }

  return cell;
}

#pragma mark - UICollectionViewDelegate

- (void)collectionView:(UICollectionView *)collectionView didSelectItemAtIndexPath:(NSIndexPath *)indexPath {
  // Handle add cell tap (position 0)
  if (indexPath.item == 0) {
    [self uploadFromDevice];
    return;
  }

  NSInteger videoIndex = indexPath.item - 1;
  NSDictionary *videoData = self.videos[videoIndex];
  NSString *videoId = videoData[@"_id"];
  NSString *status = videoData[@"status"];

  // Only allow selection of completed videos
  if (![status isEqualToString:@"completed"]) {
    return;
  }

  // Toggle selection
  if ([self.selectedVideoIds containsObject:videoId]) {
    [self.selectedVideoIds removeObject:videoId];
  } else {
    [self.selectedVideoIds addObject:videoId];
  }

  UIImpactFeedbackGenerator *feedback = [[UIImpactFeedbackGenerator alloc] initWithStyle:UIImpactFeedbackStyleLight];
  [feedback impactOccurred];

  [self updateSelectionUI];
}

#pragma mark - UICollectionViewDelegateFlowLayout

- (CGSize)collectionView:(UICollectionView *)collectionView layout:(UICollectionViewLayout *)collectionViewLayout sizeForItemAtIndexPath:(NSIndexPath *)indexPath {
  // 3-column grid on iPhone, 4-column on iPad (matching Image Studio)
  CGFloat padding = 20 * 2;
  CGFloat spacing = 12;
  BOOL isIPad = (UI_USER_INTERFACE_IDIOM() == UIUserInterfaceIdiomPad);
  NSInteger columns = isIPad ? 4 : 3;
  CGFloat totalSpacing = spacing * (columns - 1);
  CGFloat availableWidth = collectionView.bounds.size.width - padding - totalSpacing;
  CGFloat cellWidth = floor(availableWidth / columns);
  CGFloat cellHeight = cellWidth; // Square cells

  return CGSizeMake(cellWidth, cellHeight);
}

#pragma mark - Context Menu (Long Press)

- (UIContextMenuConfiguration *)collectionView:(UICollectionView *)collectionView
    contextMenuConfigurationForItemAtIndexPath:(NSIndexPath *)indexPath
                                         point:(CGPoint)point API_AVAILABLE(ios(13.0)) {

  // Skip the "Add" cell (index 0)
  if (indexPath.item == 0) {
    return nil;
  }

  NSInteger videoIndex = indexPath.item - 1;
  if (videoIndex < 0 || videoIndex >= self.videos.count) {
    return nil;
  }

  NSDictionary *videoData = self.videos[videoIndex];
  NSString *status = videoData[@"status"];

  // Only show menu for completed videos
  if (![status isEqualToString:@"completed"]) {
    return nil;
  }

  __weak typeof(self) weakSelf = self;

  return [UIContextMenuConfiguration configurationWithIdentifier:@(videoIndex)
                                                 previewProvider:nil
                                                  actionProvider:^UIMenu * _Nullable(NSArray<UIMenuElement *> * _Nonnull suggestedActions) {

    // Play action
    UIAction *playAction = [UIAction actionWithTitle:@"Play"
                                               image:[UIImage systemImageNamed:@"play.circle"]
                                          identifier:nil
                                             handler:^(__kindof UIAction * _Nonnull action) {
      [weakSelf playVideoAtIndex:videoIndex];
    }];

    // Copy URL action
    UIAction *copyAction = [UIAction actionWithTitle:@"Copy URL"
                                               image:[UIImage systemImageNamed:@"doc.on.doc"]
                                          identifier:nil
                                             handler:^(__kindof UIAction * _Nonnull action) {
      [weakSelf copyVideoUrlAtIndex:videoIndex];
    }];

    // Share action
    UIAction *shareAction = [UIAction actionWithTitle:@"Share"
                                                image:[UIImage systemImageNamed:@"square.and.arrow.up"]
                                           identifier:nil
                                              handler:^(__kindof UIAction * _Nonnull action) {
      [weakSelf shareVideoAtIndex:videoIndex fromIndexPath:indexPath];
    }];

    // Add to Prompt action
    UIAction *addToPromptAction = [UIAction actionWithTitle:@"Add to Prompt"
                                                      image:[UIImage systemImageNamed:@"text.badge.plus"]
                                                 identifier:nil
                                                    handler:^(__kindof UIAction * _Nonnull action) {
      [weakSelf addVideoToPromptAtIndex:videoIndex];
    }];

    // Delete action (destructive)
    UIAction *deleteAction = [UIAction actionWithTitle:@"Delete"
                                                 image:[UIImage systemImageNamed:@"trash"]
                                            identifier:nil
                                               handler:^(__kindof UIAction * _Nonnull action) {
      [weakSelf confirmDeleteVideoAtIndex:videoIndex];
    }];
    deleteAction.attributes = UIMenuElementAttributesDestructive;

    UIMenu *menu = [UIMenu menuWithTitle:@""
                                children:@[playAction, copyAction, shareAction, addToPromptAction, deleteAction]];

    return menu;
  }];
}

#pragma mark - Context Menu Actions

- (void)playVideoAtIndex:(NSInteger)index {
  if (index < 0 || index >= self.videos.count) return;

  NSDictionary *videoData = self.videos[index];
  NSString *videoUrl = videoData[@"url"];

  if (videoUrl) {
    [self playVideo:videoUrl];
  }
}

- (void)copyVideoUrlAtIndex:(NSInteger)index {
  if (index < 0 || index >= self.videos.count) return;

  NSDictionary *videoData = self.videos[index];
  NSString *videoUrl = videoData[@"url"];

  if (videoUrl) {
    [[UIPasteboard generalPasteboard] setString:videoUrl];

    UINotificationFeedbackGenerator *feedback = [[UINotificationFeedbackGenerator alloc] init];
    [feedback notificationOccurred:UINotificationFeedbackTypeSuccess];
  }
}

- (void)shareVideoAtIndex:(NSInteger)index fromIndexPath:(NSIndexPath *)indexPath {
  if (index < 0 || index >= self.videos.count) return;

  NSDictionary *videoData = self.videos[index];
  NSString *videoUrl = videoData[@"url"];

  if (!videoUrl) return;

  NSURL *url = [NSURL URLWithString:videoUrl];
  UIActivityViewController *activityVC = [[UIActivityViewController alloc] initWithActivityItems:@[url] applicationActivities:nil];

  if (UI_USER_INTERFACE_IDIOM() == UIUserInterfaceIdiomPad) {
    UICollectionViewCell *cell = [self.videoCollectionView cellForItemAtIndexPath:indexPath];
    activityVC.popoverPresentationController.sourceView = cell;
    activityVC.popoverPresentationController.sourceRect = cell.bounds;
  }

  [self presentViewController:activityVC animated:YES completion:nil];
}

- (void)addVideoToPromptAtIndex:(NSInteger)index {
  if (index < 0 || index >= self.videos.count) return;

  NSDictionary *videoData = self.videos[index];
  NSString *videoId = videoData[@"_id"];
  NSString *videoUrl = videoData[@"url"];
  NSString *videoName = videoData[@"name"] ?: [NSString stringWithFormat:@"video-%@", videoId];

  if (!videoUrl) return;

  UIAlertController *loadingAlert = [UIAlertController alertControllerWithTitle:nil message:@"Uploading..." preferredStyle:UIAlertControllerStyleAlert];
  [self presentViewController:loadingAlert animated:YES completion:nil];

  NSString *sandboxId = self.manager.sandboxId;
  if (!sandboxId || sandboxId.length == 0) {
    [loadingAlert dismissViewControllerAnimated:YES completion:^{
      [self showError:@"No active session"];
    }];
    return;
  }

  NSURL *url = [NSURL URLWithString:videoUrl];
  __weak typeof(self) weakSelf = self;

  NSURLSessionDataTask *task = [[NSURLSession sharedSession] dataTaskWithURL:url completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
    if (error || !data) {
      dispatch_async(dispatch_get_main_queue(), ^{
        [loadingAlert dismissViewControllerAnimated:YES completion:^{
          [weakSelf showError:@"Failed to download video"];
        }];
      });
      return;
    }

    [weakSelf uploadVideoToSandbox:data fileName:videoName sandboxId:sandboxId completion:^(NSString *sandboxPath, NSError *uploadError) {
      dispatch_async(dispatch_get_main_queue(), ^{
        [loadingAlert dismissViewControllerAnimated:YES completion:^{
          if (uploadError || !sandboxPath) {
            [weakSelf showError:@"Failed to upload video"];
            return;
          }

          [weakSelf.manager insertVideoTag:videoName withPath:sandboxPath];

          UINotificationFeedbackGenerator *feedback = [[UINotificationFeedbackGenerator alloc] init];
          [feedback notificationOccurred:UINotificationFeedbackTypeSuccess];

          [weakSelf closeModal];
        }];
      });
    }];
  }];

  [task resume];
}

- (void)confirmDeleteVideoAtIndex:(NSInteger)index {
  if (index < 0 || index >= self.videos.count) return;

  NSDictionary *videoData = self.videos[index];
  NSString *videoName = videoData[@"name"] ?: @"this video";

  UIAlertController *alert = [UIAlertController alertControllerWithTitle:@"Delete Video"
                                                                 message:[NSString stringWithFormat:@"Are you sure you want to delete %@?", videoName]
                                                          preferredStyle:UIAlertControllerStyleAlert];

  [alert addAction:[UIAlertAction actionWithTitle:@"Cancel" style:UIAlertActionStyleCancel handler:nil]];

  __weak typeof(self) weakSelf = self;
  [alert addAction:[UIAlertAction actionWithTitle:@"Delete" style:UIAlertActionStyleDestructive handler:^(UIAlertAction *action) {
    [weakSelf deleteVideoAtIndex:index];
  }]];

  [self presentViewController:alert animated:YES completion:nil];
}

- (void)deleteVideoAtIndex:(NSInteger)index {
  if (index < 0 || index >= self.videos.count) return;

  NSDictionary *videoData = self.videos[index];
  NSString *videoId = videoData[@"_id"];

  if (!videoId) return;

  NSString *deleteURL = [NSString stringWithFormat:@"%@/api/videos/delete?videoId=%@", [EXEnvBridge v0ApiUrl], videoId];

  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:[NSURL URLWithString:deleteURL]];
  request.HTTPMethod = @"DELETE";

  __weak typeof(self) weakSelf = self;

  NSURLSessionDataTask *task = [[NSURLSession sharedSession] dataTaskWithRequest:request completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
    dispatch_async(dispatch_get_main_queue(), ^{
      __strong typeof(weakSelf) strongSelf = weakSelf;
      if (!strongSelf) return;

      if (error) {
        [strongSelf showError:@"Failed to delete video"];
        return;
      }

      // Remove from local array and reload
      [strongSelf.videos removeObjectAtIndex:index];
      [strongSelf.selectedVideoIds removeObject:videoId];
      [strongSelf.videoCollectionView reloadData];
      [strongSelf updateSelectionUI];

      UINotificationFeedbackGenerator *feedback = [[UINotificationFeedbackGenerator alloc] init];
      [feedback notificationOccurred:UINotificationFeedbackTypeSuccess];
    });
  }];

  [task resume];
}

#pragma mark - Sandbox Upload

- (void)uploadVideoToSandbox:(NSData *)videoData fileName:(NSString *)fileName sandboxId:(NSString *)sandboxId completion:(void (^)(NSString *sandboxPath, NSError *error))completion {
  NSString *uploadURL = [NSString stringWithFormat:@"%@/api/upload-video", [EXEnvBridge v0ApiUrl]];

  NSString *boundary = [[NSUUID UUID] UUIDString];
  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:[NSURL URLWithString:uploadURL]];
  request.HTTPMethod = @"POST";
  [request setValue:[NSString stringWithFormat:@"multipart/form-data; boundary=%@", boundary] forHTTPHeaderField:@"Content-Type"];
  [request setValue:sandboxId forHTTPHeaderField:@"x-session-id"];

  NSMutableData *body = [NSMutableData data];

  [body appendData:[[NSString stringWithFormat:@"--%@\r\n", boundary] dataUsingEncoding:NSUTF8StringEncoding]];
  [body appendData:[[NSString stringWithFormat:@"Content-Disposition: form-data; name=\"file\"; filename=\"%@.mp4\"\r\n", fileName] dataUsingEncoding:NSUTF8StringEncoding]];
  [body appendData:[@"Content-Type: video/mp4\r\n\r\n" dataUsingEncoding:NSUTF8StringEncoding]];
  [body appendData:videoData];
  [body appendData:[@"\r\n" dataUsingEncoding:NSUTF8StringEncoding]];

  [body appendData:[[NSString stringWithFormat:@"--%@--\r\n", boundary] dataUsingEncoding:NSUTF8StringEncoding]];

  request.HTTPBody = body;

  NSURLSessionDataTask *task = [[NSURLSession sharedSession] dataTaskWithRequest:request completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
    if (error) {
      completion(nil, error);
      return;
    }

    NSError *parseError;
    NSDictionary *result = [NSJSONSerialization JSONObjectWithData:data options:0 error:&parseError];

    if (parseError || !result[@"path"]) {
      completion(nil, parseError ?: [NSError errorWithDomain:@"VideoUploadError" code:500 userInfo:@{NSLocalizedDescriptionKey: @"Failed to upload video"}]);
      return;
    }

    completion(result[@"path"], nil);
  }];

  [task resume];
}

@end
