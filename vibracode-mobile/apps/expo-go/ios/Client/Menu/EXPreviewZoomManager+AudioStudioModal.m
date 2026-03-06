// Copyright 2015-present 650 Industries. All rights reserved.

#import "EXPreviewZoomManager+Private.h"
#import "EXPreviewZoomManager.h"
#import "EXEnvBridge.h"
#import "EXChatBackendService.h"
#import "Chat/EXChatMessageCache.h"
#import "EXAudioRecorderService.h"
#import "EXAssemblyAIService.h"
#import "EXAudioWaveformView.h"
#import <UIKit/UIKit.h>
#import <AVFoundation/AVFoundation.h>
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>
#import <SDWebImage/SDWebImage.h>

// Forward declarations
@class EXAudioStudioModalViewController;

// Audio cache for preventing reload flickering
static NSCache<NSString *, NSData *> *_audioCache = nil;

// Audio type options
typedef NS_ENUM(NSInteger, EXAudioType) {
  EXAudioTypeSoundEffect = 0,
  EXAudioTypeMusic,
  EXAudioTypeVoiceover,
  EXAudioTypeAmbient
};

// Accent color for Audio Studio - Purple
static UIColor *AudioStudioAccentColor(void) {
  return [UIColor colorWithRed:0.6 green:0.4 blue:0.9 alpha:1.0];
}

#pragma mark - Custom Cell Classes for Proper Reuse

// Custom audio cell class - matches Image Studio cell design exactly
@interface EXAudioStudioCell : UICollectionViewCell
@property (nonatomic, strong) UIView *iconContainer;
@property (nonatomic, strong) UIImageView *iconView;
@property (nonatomic, strong) UILabel *nameLabel;
@property (nonatomic, strong) UIView *badgeView;
@property (nonatomic, strong) UILabel *badgeLabel;
@property (nonatomic, strong) UIView *shimmerView;
@property (nonatomic, strong) CAGradientLayer *shimmerGradient;
@property (nonatomic, strong) UILabel *statusLabel;
@property (nonatomic, strong) UIImageView *statusIcon;
@property (nonatomic, strong) NSString *currentAudioId;
@property (nonatomic, strong) UIButton *playButton;
@property (nonatomic, assign) BOOL isPlaying;
@end

@implementation EXAudioStudioCell

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

  // Icon container (centered)
  self.iconContainer = [[UIView alloc] init];
  self.iconContainer.translatesAutoresizingMaskIntoConstraints = NO;
  self.iconContainer.backgroundColor = [UIColor colorWithWhite:0.18 alpha:1.0];
  self.iconContainer.layer.cornerRadius = 24;
  self.iconContainer.hidden = YES;
  [self.contentView addSubview:self.iconContainer];

  // Waveform icon
  UIImageSymbolConfiguration *iconConfig = [UIImageSymbolConfiguration configurationWithPointSize:28 weight:UIImageSymbolWeightMedium];
  self.iconView = [[UIImageView alloc] initWithImage:[UIImage systemImageNamed:@"waveform" withConfiguration:iconConfig]];
  self.iconView.translatesAutoresizingMaskIntoConstraints = NO;
  self.iconView.tintColor = AudioStudioAccentColor();
  self.iconView.contentMode = UIViewContentModeScaleAspectFit;
  [self.iconContainer addSubview:self.iconView];

  // Name label at bottom
  self.nameLabel = [[UILabel alloc] init];
  self.nameLabel.translatesAutoresizingMaskIntoConstraints = NO;
  self.nameLabel.textColor = [UIColor colorWithWhite:0.7 alpha:1.0];
  self.nameLabel.font = [UIFont systemFontOfSize:11 weight:UIFontWeightMedium];
  self.nameLabel.textAlignment = NSTextAlignmentCenter;
  self.nameLabel.numberOfLines = 2;
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

  // Status label
  self.statusLabel = [[UILabel alloc] init];
  self.statusLabel.translatesAutoresizingMaskIntoConstraints = NO;
  self.statusLabel.textColor = [UIColor colorWithWhite:0.6 alpha:1.0];
  self.statusLabel.font = [UIFont systemFontOfSize:12];
  self.statusLabel.hidden = YES;
  [self.contentView addSubview:self.statusLabel];

  // Status icon
  UIImageSymbolConfiguration *statusIconConfig = [UIImageSymbolConfiguration configurationWithPointSize:24 weight:UIImageSymbolWeightMedium];
  self.statusIcon = [[UIImageView alloc] initWithImage:[UIImage systemImageNamed:@"sparkles" withConfiguration:statusIconConfig]];
  self.statusIcon.translatesAutoresizingMaskIntoConstraints = NO;
  self.statusIcon.tintColor = [UIColor colorWithRed:0.9 green:0.6 blue:0.2 alpha:1.0];
  self.statusIcon.hidden = YES;
  [self.contentView addSubview:self.statusIcon];

  // Selection badge
  self.badgeView = [[UIView alloc] init];
  self.badgeView.translatesAutoresizingMaskIntoConstraints = NO;
  self.badgeView.backgroundColor = AudioStudioAccentColor();
  self.badgeView.layer.cornerRadius = 12;
  self.badgeView.hidden = YES;
  [self.contentView addSubview:self.badgeView];

  self.badgeLabel = [[UILabel alloc] init];
  self.badgeLabel.translatesAutoresizingMaskIntoConstraints = NO;
  self.badgeLabel.textColor = [UIColor whiteColor];
  self.badgeLabel.font = [UIFont boldSystemFontOfSize:12];
  self.badgeLabel.textAlignment = NSTextAlignmentCenter;
  [self.badgeView addSubview:self.badgeLabel];

  // Play button (top-left corner)
  self.playButton = [UIButton buttonWithType:UIButtonTypeSystem];
  self.playButton.translatesAutoresizingMaskIntoConstraints = NO;
  UIImageSymbolConfiguration *playConfig = [UIImageSymbolConfiguration configurationWithPointSize:14 weight:UIImageSymbolWeightSemibold];
  [self.playButton setImage:[UIImage systemImageNamed:@"play.fill" withConfiguration:playConfig] forState:UIControlStateNormal];
  self.playButton.tintColor = [UIColor whiteColor];
  self.playButton.backgroundColor = [UIColor colorWithWhite:0.0 alpha:0.5];
  self.playButton.layer.cornerRadius = 14;
  self.playButton.hidden = YES;
  self.playButton.accessibilityLabel = @"Play audio";
  [self.contentView addSubview:self.playButton];

  // Constraints
  [NSLayoutConstraint activateConstraints:@[
    [self.iconContainer.centerXAnchor constraintEqualToAnchor:self.contentView.centerXAnchor],
    [self.iconContainer.centerYAnchor constraintEqualToAnchor:self.contentView.centerYAnchor constant:-10],
    [self.iconContainer.widthAnchor constraintEqualToConstant:48],
    [self.iconContainer.heightAnchor constraintEqualToConstant:48],

    [self.iconView.centerXAnchor constraintEqualToAnchor:self.iconContainer.centerXAnchor],
    [self.iconView.centerYAnchor constraintEqualToAnchor:self.iconContainer.centerYAnchor],

    [self.nameLabel.leadingAnchor constraintEqualToAnchor:self.contentView.leadingAnchor constant:8],
    [self.nameLabel.trailingAnchor constraintEqualToAnchor:self.contentView.trailingAnchor constant:-8],
    [self.nameLabel.bottomAnchor constraintEqualToAnchor:self.contentView.bottomAnchor constant:-8],

    [self.shimmerView.topAnchor constraintEqualToAnchor:self.contentView.topAnchor],
    [self.shimmerView.leadingAnchor constraintEqualToAnchor:self.contentView.leadingAnchor],
    [self.shimmerView.trailingAnchor constraintEqualToAnchor:self.contentView.trailingAnchor],
    [self.shimmerView.bottomAnchor constraintEqualToAnchor:self.contentView.bottomAnchor],

    [self.statusIcon.centerXAnchor constraintEqualToAnchor:self.contentView.centerXAnchor],
    [self.statusIcon.centerYAnchor constraintEqualToAnchor:self.contentView.centerYAnchor constant:-10],

    [self.statusLabel.centerXAnchor constraintEqualToAnchor:self.contentView.centerXAnchor],
    [self.statusLabel.topAnchor constraintEqualToAnchor:self.statusIcon.bottomAnchor constant:8],

    [self.badgeView.topAnchor constraintEqualToAnchor:self.contentView.topAnchor constant:8],
    [self.badgeView.trailingAnchor constraintEqualToAnchor:self.contentView.trailingAnchor constant:-8],
    [self.badgeView.widthAnchor constraintEqualToConstant:24],
    [self.badgeView.heightAnchor constraintEqualToConstant:24],

    [self.badgeLabel.centerXAnchor constraintEqualToAnchor:self.badgeView.centerXAnchor],
    [self.badgeLabel.centerYAnchor constraintEqualToAnchor:self.badgeView.centerYAnchor],

    [self.playButton.topAnchor constraintEqualToAnchor:self.contentView.topAnchor constant:8],
    [self.playButton.leadingAnchor constraintEqualToAnchor:self.contentView.leadingAnchor constant:8],
    [self.playButton.widthAnchor constraintEqualToConstant:28],
    [self.playButton.heightAnchor constraintEqualToConstant:28]
  ]];
}

- (void)layoutSubviews {
  [super layoutSubviews];
  self.shimmerGradient.frame = CGRectMake(-200, 0, self.bounds.size.width + 400, self.bounds.size.height);
}

- (void)prepareForReuse {
  [super prepareForReuse];

  // Reset to hidden state
  self.iconContainer.hidden = YES;
  self.nameLabel.hidden = YES;
  self.shimmerView.hidden = YES;
  self.statusLabel.hidden = YES;
  self.statusIcon.hidden = YES;
  self.badgeView.hidden = YES;
  self.playButton.hidden = YES;
  self.currentAudioId = nil;
  self.isPlaying = NO;

  // Reset play button icon
  UIImageSymbolConfiguration *playConfig = [UIImageSymbolConfiguration configurationWithPointSize:14 weight:UIImageSymbolWeightSemibold];
  [self.playButton setImage:[UIImage systemImageNamed:@"play.fill" withConfiguration:playConfig] forState:UIControlStateNormal];

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
  self.iconContainer.hidden = NO;
  self.nameLabel.hidden = NO;
  self.playButton.hidden = NO;
  self.nameLabel.text = name;

  // Selection badge
  if (isSelected) {
    self.badgeView.hidden = NO;
    self.badgeLabel.text = [NSString stringWithFormat:@"%ld", (long)selectionIndex];
    self.contentView.layer.borderWidth = 3.0;
    self.contentView.layer.borderColor = AudioStudioAccentColor().CGColor;
  }
}

- (void)setPlayingState:(BOOL)playing {
  self.isPlaying = playing;
  UIImageSymbolConfiguration *config = [UIImageSymbolConfiguration configurationWithPointSize:14 weight:UIImageSymbolWeightSemibold];
  if (playing) {
    [self.playButton setImage:[UIImage systemImageNamed:@"stop.fill" withConfiguration:config] forState:UIControlStateNormal];
    self.playButton.backgroundColor = AudioStudioAccentColor();
  } else {
    [self.playButton setImage:[UIImage systemImageNamed:@"play.fill" withConfiguration:config] forState:UIControlStateNormal];
    self.playButton.backgroundColor = [UIColor colorWithWhite:0.0 alpha:0.5];
  }
}

@end

// Custom add cell class - matches Image Studio exactly
@interface EXAudioStudioAddCell : UICollectionViewCell
@property (nonatomic, strong) UIImageView *plusIcon;
@property (nonatomic, strong) CAShapeLayer *dashLayer;
@end

@implementation EXAudioStudioAddCell

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

  // Plus icon with waveform
  UIImageSymbolConfiguration *plusConfig = [UIImageSymbolConfiguration configurationWithPointSize:28 weight:UIImageSymbolWeightMedium];
  self.plusIcon = [[UIImageView alloc] initWithImage:[UIImage systemImageNamed:@"waveform.badge.plus" withConfiguration:plusConfig]];
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
}

@end

// Audio Studio Modal View Controller - matches Image Studio design exactly
@interface EXAudioStudioModalViewController : UIViewController <UIAdaptivePresentationControllerDelegate, UICollectionViewDataSource, UICollectionViewDelegate, UICollectionViewDelegateFlowLayout, UITextViewDelegate, UIDocumentPickerDelegate, AVAudioPlayerDelegate>

@property(nonatomic, weak) EXPreviewZoomManager *manager;
@property(nonatomic, strong) UITextView *promptTextView;
@property(nonatomic, strong) UIButton *generateButton;
@property(nonatomic, strong) UIButton *micButton;
@property(nonatomic, strong) UIButton *sendButton;
@property(nonatomic, strong) UICollectionView *audioCollectionView;
@property(nonatomic, strong) NSMutableArray<NSDictionary *> *audios;
@property(nonatomic, strong) UIActivityIndicatorView *loadingIndicator;
@property(nonatomic, strong) UIVisualEffectView *backgroundView;
@property(nonatomic, strong) UILabel *emptyStateLabel;
@property(nonatomic, assign) BOOL isGenerating;
@property(nonatomic, strong) NSTimer *refreshTimer;
@property(nonatomic, strong) UIView *inputContainer;
@property(nonatomic, strong) NSLayoutConstraint *inputContainerBottomConstraint;
@property(nonatomic, strong) NSLayoutConstraint *inputContainerHeightConstraint;
@property(nonatomic, strong) NSMutableSet<NSString *> *selectedAudioIds;
@property(nonatomic, strong) UIButton *addToPromptButton;
@property(nonatomic, strong) UILabel *selectionCountLabel;
@property(nonatomic, strong) UIView *bottomActionContainer;
@property(nonatomic, strong) NSLayoutConstraint *bottomActionBottomConstraint;
@property(nonatomic, strong) UIButton *audioTypeButton;
@property(nonatomic, assign) EXAudioType selectedAudioType;
@property(nonatomic, assign) BOOL isRecording;
@property(nonatomic, assign) BOOL isTranscribing;
@property(nonatomic, strong) UIView *recordingOverlay;
@property(nonatomic, strong) UILabel *recordingLabel;
@property(nonatomic, strong) EXAudioWaveformView *waveformView;
@property(nonatomic, strong) NSString *lastAudiosHash;
@property(nonatomic, strong) AVAudioPlayer *audioPlayer;
@property(nonatomic, strong) NSString *currentlyPlayingId;
@property(nonatomic, strong) UIView *headerView;
@property(nonatomic, strong) UIButton *clearAllButton;

- (instancetype)initWithManager:(EXPreviewZoomManager *)manager;

@end

// Category implementation
@implementation EXPreviewZoomManager (AudioStudioModal)

- (void)showAudioStudioModal {
  if (self.audioStudioModalPresented) {
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

  EXAudioStudioModalViewController *modalVC = [[EXAudioStudioModalViewController alloc] initWithManager:self];

  UINavigationController *navController = [[UINavigationController alloc] initWithRootViewController:modalVC];
  navController.view.backgroundColor = [UIColor clearColor];
  navController.navigationBarHidden = YES;

  self.audioStudioModalViewController = navController;

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
  self.audioStudioModalPresented = YES;
}

- (void)insertAudioTag:(NSString *)tagName withPath:(NSString *)path {
  NSLog(@"🎵 [AudioStudio] insertAudioTag called: tagName=%@, path=%@", tagName, path);

  // IMPORTANT: Store the path mapping FIRST, before any early returns
  if (!self.audioPathMappings) {
    self.audioPathMappings = [NSMutableDictionary dictionary];
  }
  if (path && path.length > 0) {
    self.audioPathMappings[tagName] = path;
    NSLog(@"🎵 [AudioStudio] Stored path mapping: %@ -> %@", tagName, path);
  }

  UITextView *inputTextView = self.inputTextView;
  if (!inputTextView) {
    NSLog(@"⚠️ [AudioStudio] insertAudioTag: inputTextView is nil! Path stored but tag not visible.");
    return;
  }

  NSLog(@"🎵 [AudioStudio] inputTextView found, proceeding with tag insertion");
  NSString *currentText = @"";
  NSRange selectedRange = inputTextView.selectedRange;

  if (inputTextView.attributedText) {
    currentText = inputTextView.attributedText.string ?: @"";
  } else {
    currentText = inputTextView.text ?: @"";
  }

  if ([currentText isEqualToString:@"Message"]) {
    currentText = @"";
    selectedRange = NSMakeRange(0, 0);
    inputTextView.textColor = [UIColor whiteColor];
  }

  NSString *tagString = [NSString stringWithFormat:@"@%@ ", tagName];
  NSString *newText = [currentText stringByReplacingCharactersInRange:selectedRange withString:tagString];
  NSRange tagRange = NSMakeRange(selectedRange.location, tagString.length);

  [self updateTextInputWithAttributedStringAndAudioTag:newText tagRange:tagRange];
  inputTextView.selectedRange = NSMakeRange(selectedRange.location + tagString.length, 0);
}

- (void)updateTextInputWithAttributedStringAndAudioTag:(NSString *)text tagRange:(NSRange)tagRange {
  UITextView *inputTextView = self.inputTextView;
  if (!inputTextView) {
    return;
  }

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

  // Apply purple background to audio tag
  UIColor *tagColor = AudioStudioAccentColor();
  [attributedString addAttribute:NSBackgroundColorAttributeName
                           value:tagColor
                           range:tagRange];

  // Store tag range with type info
  if (!self.apiTagRanges) {
    self.apiTagRanges = [NSMutableArray array];
  }

  NSDictionary *tagInfo = @{
    @"range": [NSValue valueWithRange:tagRange],
    @"type": @"audio",
    @"color": tagColor
  };
  [self.apiTagRanges addObject:tagInfo];

  inputTextView.attributedText = attributedString;

  [[NSNotificationCenter defaultCenter] postNotificationName:UITextViewTextDidChangeNotification object:inputTextView];
}

// Helper method to reapply all tag highlights
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
      // Legacy - use default purple color for audio
      tagColor = AudioStudioAccentColor();
    } else {
      continue;
    }

    // Skip if this is the range we're currently adding (will be added after)
    if (NSEqualRanges(tagRange, excludeRange)) continue;

    // Make sure range is valid
    if (tagRange.location + tagRange.length <= attributedString.length) {
      [attributedString addAttribute:NSBackgroundColorAttributeName
                               value:tagColor
                               range:tagRange];
    }
  }
}

@end

// MARK: - EXAudioStudioModalViewController Implementation

@implementation EXAudioStudioModalViewController

+ (void)initialize {
  if (self == [EXAudioStudioModalViewController class]) {
    _audioCache = [[NSCache alloc] init];
    _audioCache.countLimit = 50;
  }
}

- (instancetype)initWithManager:(EXPreviewZoomManager *)manager {
  self = [super init];
  if (self) {
    _manager = manager;
    _audios = [NSMutableArray array];
    _isGenerating = NO;
    _selectedAudioIds = [NSMutableSet set];
    _selectedAudioType = EXAudioTypeSoundEffect;
    _isRecording = NO;
    _isTranscribing = NO;
  }
  return self;
}

- (void)viewDidLoad {
  [super viewDidLoad];

  self.view.backgroundColor = [UIColor clearColor];

  [self setupBackground];
  [self setupHeader];
  [self setupCollectionView];
  [self setupPromptInput];
  [self setupBottomActionButton];
  [self setupEmptyState];
  [self setupConstraints];
  [self setupKeyboardObservers];

  UITapGestureRecognizer *tapGesture = [[UITapGestureRecognizer alloc] initWithTarget:self action:@selector(dismissKeyboard)];
  tapGesture.cancelsTouchesInView = NO;
  [self.view addGestureRecognizer:tapGesture];

  [self loadAudios];

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
  [self.audioPlayer stop];
  self.audioPlayer = nil;
  [[NSNotificationCenter defaultCenter] removeObserver:self];
}

- (void)viewWillAppear:(BOOL)animated {
  [super viewWillAppear:animated];
  [self.navigationController setNavigationBarHidden:YES animated:animated];
}

- (void)presentationControllerDidDismiss:(UIPresentationController *)presentationController {
  self.manager.audioStudioModalPresented = NO;
  [self.refreshTimer invalidate];
  self.refreshTimer = nil;
  [self.audioPlayer stop];
  self.audioPlayer = nil;
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
  // Header view with title and Clear All button
  self.headerView = [[UIView alloc] init];
  self.headerView.translatesAutoresizingMaskIntoConstraints = NO;
  self.headerView.backgroundColor = [UIColor clearColor];
  [self.view addSubview:self.headerView];

  // Title label
  UILabel *titleLabel = [[UILabel alloc] init];
  titleLabel.translatesAutoresizingMaskIntoConstraints = NO;
  titleLabel.text = @"Audio Studio";
  titleLabel.textColor = [UIColor whiteColor];
  titleLabel.font = [UIFont systemFontOfSize:17 weight:UIFontWeightSemibold];
  [self.headerView addSubview:titleLabel];

  // Clear All button
  self.clearAllButton = [UIButton buttonWithType:UIButtonTypeSystem];
  self.clearAllButton.translatesAutoresizingMaskIntoConstraints = NO;
  [self.clearAllButton setTitle:@"Clear All" forState:UIControlStateNormal];
  self.clearAllButton.titleLabel.font = [UIFont systemFontOfSize:15 weight:UIFontWeightMedium];
  [self.clearAllButton setTitleColor:[UIColor colorWithRed:0.9 green:0.3 blue:0.3 alpha:1.0] forState:UIControlStateNormal];
  self.clearAllButton.accessibilityLabel = @"Clear all audio files";
  [self.clearAllButton addTarget:self action:@selector(confirmClearAll) forControlEvents:UIControlEventTouchUpInside];
  [self.headerView addSubview:self.clearAllButton];

  [NSLayoutConstraint activateConstraints:@[
    [self.headerView.topAnchor constraintEqualToAnchor:self.view.safeAreaLayoutGuide.topAnchor],
    [self.headerView.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor],
    [self.headerView.trailingAnchor constraintEqualToAnchor:self.view.trailingAnchor],
    [self.headerView.heightAnchor constraintEqualToConstant:44],

    [titleLabel.centerXAnchor constraintEqualToAnchor:self.headerView.centerXAnchor],
    [titleLabel.centerYAnchor constraintEqualToAnchor:self.headerView.centerYAnchor],

    [self.clearAllButton.trailingAnchor constraintEqualToAnchor:self.headerView.trailingAnchor constant:-20],
    [self.clearAllButton.centerYAnchor constraintEqualToAnchor:self.headerView.centerYAnchor]
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

  // Audio type dropdown button
  self.audioTypeButton = [UIButton buttonWithType:UIButtonTypeSystem];
  self.audioTypeButton.translatesAutoresizingMaskIntoConstraints = NO;
  self.audioTypeButton.titleLabel.font = [UIFont systemFontOfSize:13 weight:UIFontWeightMedium];
  [self.audioTypeButton setTitleColor:[UIColor whiteColor] forState:UIControlStateNormal];
  self.audioTypeButton.backgroundColor = [UIColor colorWithWhite:0.22 alpha:1.0];
  self.audioTypeButton.layer.cornerRadius = 18;
  self.audioTypeButton.contentEdgeInsets = UIEdgeInsetsMake(8, 12, 8, 12);
  self.audioTypeButton.accessibilityLabel = @"Audio type selector";
  [self.inputContainer addSubview:self.audioTypeButton];

  [self setupAudioTypeMenu];
  [self updateAudioTypeButtonTitle];

  // Prompt text view
  self.promptTextView = [[UITextView alloc] init];
  self.promptTextView.translatesAutoresizingMaskIntoConstraints = NO;
  self.promptTextView.backgroundColor = [UIColor clearColor];
  self.promptTextView.textColor = [UIColor whiteColor];
  self.promptTextView.font = [UIFont systemFontOfSize:17];
  self.promptTextView.delegate = self;
  self.promptTextView.scrollEnabled = YES;
  // Vertical centering: minimal top/bottom insets, let constraints handle centering
  self.promptTextView.textContainerInset = UIEdgeInsetsMake(0, 0, 0, 0);
  self.promptTextView.textContainer.lineFragmentPadding = 0;
  self.promptTextView.contentInset = UIEdgeInsetsZero;
  [self.inputContainer addSubview:self.promptTextView];

  // Placeholder label
  UILabel *placeholderLabel = [[UILabel alloc] init];
  placeholderLabel.translatesAutoresizingMaskIntoConstraints = NO;
  placeholderLabel.text = @"Describe your audio...";
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
  self.sendButton.backgroundColor = AudioStudioAccentColor();
  self.sendButton.layer.cornerRadius = 18;
  self.sendButton.accessibilityLabel = @"Generate audio";
  self.sendButton.alpha = 0;
  [self.sendButton addTarget:self action:@selector(generateAudio) forControlEvents:UIControlEventTouchUpInside];
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
  [self.micButton addTarget:self action:@selector(startVoiceInput) forControlEvents:UIControlEventTouchUpInside];
  [self.inputContainer addSubview:self.micButton];

  // Loading indicator
  self.loadingIndicator = [[UIActivityIndicatorView alloc] initWithActivityIndicatorStyle:UIActivityIndicatorViewStyleMedium];
  self.loadingIndicator.translatesAutoresizingMaskIntoConstraints = NO;
  self.loadingIndicator.hidesWhenStopped = YES;
  self.loadingIndicator.color = [UIColor whiteColor];
  [self.inputContainer addSubview:self.loadingIndicator];

  [NSLayoutConstraint activateConstraints:@[
    [self.audioTypeButton.leadingAnchor constraintEqualToAnchor:self.inputContainer.leadingAnchor constant:10],
    [self.audioTypeButton.centerYAnchor constraintEqualToAnchor:self.micButton.centerYAnchor],
    [self.audioTypeButton.heightAnchor constraintEqualToConstant:36],

    [self.promptTextView.leadingAnchor constraintEqualToAnchor:self.audioTypeButton.trailingAnchor constant:10],
    [self.promptTextView.trailingAnchor constraintEqualToAnchor:self.micButton.leadingAnchor constant:-8],
    [self.promptTextView.centerYAnchor constraintEqualToAnchor:self.inputContainer.centerYAnchor],
    [self.promptTextView.heightAnchor constraintGreaterThanOrEqualToConstant:36],

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

- (void)setupAudioTypeMenu {
  if (@available(iOS 14.0, *)) {
    __weak typeof(self) weakSelf = self;

    UIAction *sfxAction = [UIAction actionWithTitle:@"Sound Effect"
                                              image:[UIImage systemImageNamed:@"speaker.wave.3.fill"]
                                         identifier:nil
                                            handler:^(__kindof UIAction *action) {
                                              weakSelf.selectedAudioType = EXAudioTypeSoundEffect;
                                              [weakSelf updateAudioTypeButtonTitle];
                                            }];

    UIAction *musicAction = [UIAction actionWithTitle:@"Music"
                                                image:[UIImage systemImageNamed:@"music.note"]
                                           identifier:nil
                                              handler:^(__kindof UIAction *action) {
                                                weakSelf.selectedAudioType = EXAudioTypeMusic;
                                                [weakSelf updateAudioTypeButtonTitle];
                                              }];

    UIAction *voiceAction = [UIAction actionWithTitle:@"Voiceover"
                                                image:[UIImage systemImageNamed:@"person.wave.2.fill"]
                                           identifier:nil
                                              handler:^(__kindof UIAction *action) {
                                                weakSelf.selectedAudioType = EXAudioTypeVoiceover;
                                                [weakSelf updateAudioTypeButtonTitle];
                                              }];

    UIAction *ambientAction = [UIAction actionWithTitle:@"Ambient"
                                                  image:[UIImage systemImageNamed:@"leaf.fill"]
                                             identifier:nil
                                                handler:^(__kindof UIAction *action) {
                                                  weakSelf.selectedAudioType = EXAudioTypeAmbient;
                                                  [weakSelf updateAudioTypeButtonTitle];
                                                }];

    UIMenu *menu = [UIMenu menuWithTitle:@"" children:@[sfxAction, musicAction, voiceAction, ambientAction]];

    if (@available(iOS 16.0, *)) {
      menu.preferredElementSize = UIMenuElementSizeLarge;
    }

    self.audioTypeButton.menu = menu;
    self.audioTypeButton.showsMenuAsPrimaryAction = YES;
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
  self.addToPromptButton.accessibilityLabel = @"Add selected audio to prompt";
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

  self.audioCollectionView = [[UICollectionView alloc] initWithFrame:CGRectZero collectionViewLayout:layout];
  self.audioCollectionView.translatesAutoresizingMaskIntoConstraints = NO;
  self.audioCollectionView.backgroundColor = [UIColor clearColor];
  self.audioCollectionView.dataSource = self;
  self.audioCollectionView.delegate = self;
  self.audioCollectionView.showsHorizontalScrollIndicator = NO;
  self.audioCollectionView.showsVerticalScrollIndicator = YES;
  self.audioCollectionView.alwaysBounceVertical = YES;
  self.audioCollectionView.clipsToBounds = NO;
  [self.audioCollectionView registerClass:[EXAudioStudioCell class] forCellWithReuseIdentifier:@"AudioCell"];
  [self.audioCollectionView registerClass:[EXAudioStudioAddCell class] forCellWithReuseIdentifier:@"AddCell"];
  [self.view addSubview:self.audioCollectionView];
}

- (void)setupEmptyState {
  self.emptyStateLabel = [[UILabel alloc] init];
  self.emptyStateLabel.text = @"No audio files yet.\nGenerate or upload your first audio!";
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
    [self.audioCollectionView.topAnchor constraintEqualToAnchor:self.headerView.bottomAnchor],
    [self.audioCollectionView.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor],
    [self.audioCollectionView.trailingAnchor constraintEqualToAnchor:self.view.trailingAnchor],
    [self.audioCollectionView.bottomAnchor constraintEqualToAnchor:self.inputContainer.topAnchor constant:-12],

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

  // Convert keyboard frame to view coordinates for accurate calculation
  CGRect keyboardFrameInView = [self.view convertRect:keyboardFrame fromView:nil];
  CGFloat keyboardOverlap = CGRectGetMaxY(self.view.bounds) - CGRectGetMinY(keyboardFrameInView);
  CGFloat bottomOffset = -(keyboardOverlap + 8);

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
  [self.audioPlayer stop];
  self.audioPlayer = nil;
  self.manager.audioStudioModalPresented = NO;
  [self dismissViewControllerAnimated:YES completion:nil];
}

- (void)confirmClearAll {
  if (self.audios.count == 0) {
    return;
  }

  UIAlertController *alert = [UIAlertController alertControllerWithTitle:@"Clear All Audio"
                                                                 message:@"Are you sure you want to delete all audio files? This cannot be undone."
                                                          preferredStyle:UIAlertControllerStyleAlert];

  [alert addAction:[UIAlertAction actionWithTitle:@"Cancel" style:UIAlertActionStyleCancel handler:nil]];

  __weak typeof(self) weakSelf = self;
  [alert addAction:[UIAlertAction actionWithTitle:@"Delete All" style:UIAlertActionStyleDestructive handler:^(UIAlertAction *action) {
    [weakSelf clearAllAudios];
  }]];

  [self presentViewController:alert animated:YES completion:nil];
}

- (void)clearAllAudios {
  // Delete all audio files from backend
  NSArray *audiosToDelete = [self.audios copy];

  if (audiosToDelete.count == 0) {
    return;
  }

  // Stop any playing audio first
  [self.audioPlayer stop];
  self.audioPlayer = nil;
  self.currentlyPlayingId = nil;

  UIAlertController *loadingAlert = [UIAlertController alertControllerWithTitle:nil message:@"Deleting..." preferredStyle:UIAlertControllerStyleAlert];
  [self presentViewController:loadingAlert animated:YES completion:nil];

  __block NSInteger deletedCount = 0;
  NSInteger totalCount = audiosToDelete.count;

  for (NSDictionary *audioData in audiosToDelete) {
    NSString *audioId = audioData[@"_id"];
    if (!audioId) {
      deletedCount++;
      continue;
    }

    NSString *deleteURL = [NSString stringWithFormat:@"%@/api/audios/delete", [EXEnvBridge v0ApiUrl]];

    NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:[NSURL URLWithString:deleteURL]];
    request.HTTPMethod = @"POST";
    [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];

    NSDictionary *body = @{@"id": audioId};
    request.HTTPBody = [NSJSONSerialization dataWithJSONObject:body options:0 error:nil];

    __weak typeof(self) weakSelf = self;

    NSURLSessionDataTask *task = [[NSURLSession sharedSession] dataTaskWithRequest:request completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
      dispatch_async(dispatch_get_main_queue(), ^{
        deletedCount++;

        if (deletedCount >= totalCount) {
          [loadingAlert dismissViewControllerAnimated:YES completion:^{
            __strong typeof(weakSelf) strongSelf = weakSelf;
            if (!strongSelf) return;

            [strongSelf.audios removeAllObjects];
            [strongSelf.selectedAudioIds removeAllObjects];
            [strongSelf.audioCollectionView reloadData];
            strongSelf.emptyStateLabel.hidden = NO;

            UINotificationFeedbackGenerator *feedback = [[UINotificationFeedbackGenerator alloc] init];
            [feedback notificationOccurred:UINotificationFeedbackTypeSuccess];
          }];
        }
      });
    }];

    [task resume];
  }
}

- (void)updateAudioTypeButtonTitle {
  NSString *title;
  switch (self.selectedAudioType) {
    case EXAudioTypeSoundEffect:
      title = @"SFX";
      break;
    case EXAudioTypeMusic:
      title = @"Music";
      break;
    case EXAudioTypeVoiceover:
      title = @"Voice";
      break;
    case EXAudioTypeAmbient:
      title = @"Ambient";
      break;
  }
  [self.audioTypeButton setTitle:[NSString stringWithFormat:@"%@ ▾", title] forState:UIControlStateNormal];
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
            NSLog(@"❌ [AudioStudio] Recording failed to start: %@", error);
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

  self.isRecording = NO;
  self.isTranscribing = YES;
  [self showTranscribingUI];

  __weak typeof(self) weakSelf = self;

  [[EXAudioRecorderService sharedInstance]
      stopRecordingWithCompletion:^(NSURL * _Nullable audioURL, NSError * _Nullable error) {
        if (error || !audioURL) {
          dispatch_async(dispatch_get_main_queue(), ^{
            weakSelf.isTranscribing = NO;
            [weakSelf hideRecordingUI];
          });
          return;
        }

        [[EXAssemblyAIService sharedInstance]
            transcribeAudioFile:audioURL
            completion:^(NSString * _Nullable transcribedText, NSError * _Nullable transcribeError) {
              dispatch_async(dispatch_get_main_queue(), ^{
                weakSelf.isTranscribing = NO;
                [weakSelf hideRecordingUI];

                if (transcribeError) {
                  return;
                }

                if (transcribedText && transcribedText.length > 0) {
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
  self.audioTypeButton.hidden = YES;
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
  self.waveformView.barColor = AudioStudioAccentColor();
  [self.waveformView reset];

  UIView *redDot = [self.recordingOverlay viewWithTag:100];
  [redDot.layer removeAllAnimations];
  redDot.alpha = 1.0;
  redDot.backgroundColor = AudioStudioAccentColor();
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
    self.audioTypeButton.hidden = NO;
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

- (void)updateSelectionUI {
  NSUInteger count = self.selectedAudioIds.count;
  BOOL hasSelection = count > 0;

  if (hasSelection) {
    self.selectionCountLabel.text = [NSString stringWithFormat:@"%lu selected", (unsigned long)count];
  }

  [UIView animateWithDuration:0.3 delay:0 usingSpringWithDamping:0.8 initialSpringVelocity:0.5 options:UIViewAnimationOptionCurveEaseInOut animations:^{
    self.bottomActionContainer.alpha = hasSelection ? 1 : 0;
    self.inputContainer.alpha = hasSelection ? 0 : 1;
  } completion:nil];

  [self.audioCollectionView reloadData];
}

- (void)addSelectedToPrompt {
  // NEW IMPLEMENTATION: Add as pending attachment, defer upload to send time (like Image Studio)
  NSArray *selectedIds = [self.selectedAudioIds allObjects];
  if (selectedIds.count == 0) {
    [self closeModal];
    return;
  }

  __block NSInteger processedCount = 0;
  NSInteger totalCount = selectedIds.count;

  for (NSString *audioId in selectedIds) {
    for (NSDictionary *audioData in self.audios) {
      if ([audioData[@"_id"] isEqualToString:audioId]) {
        NSString *audioUrl = audioData[@"url"];
        NSString *audioName = audioData[@"name"] ?: [NSString stringWithFormat:@"audio-%@", audioId];

        // Ensure filename has extension
        if (![audioName.lowercaseString hasSuffix:@".mp3"] &&
            ![audioName.lowercaseString hasSuffix:@".wav"] &&
            ![audioName.lowercaseString hasSuffix:@".m4a"] &&
            ![audioName.lowercaseString hasSuffix:@".aac"]) {
          audioName = [audioName stringByAppendingString:@".mp3"];
        }

        if (!audioUrl) {
          processedCount++;
          if (processedCount >= totalCount) {
            [self.selectedAudioIds removeAllObjects];
            [self closeModal];
          }
          continue;
        }

        __weak typeof(self) weakSelf = self;

        // Download audio data
        NSURL *url = [NSURL URLWithString:audioUrl];
        NSURLSessionDataTask *task = [[NSURLSession sharedSession] dataTaskWithURL:url completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
          dispatch_async(dispatch_get_main_queue(), ^{
            __strong typeof(weakSelf) strongSelf = weakSelf;
            if (!strongSelf) return;

            if (!error && data) {
              // Add as pending attachment - NO UPLOAD (upload happens at send time)
              [strongSelf.manager addAudioAttachment:data fileName:audioName];
              NSLog(@"🎵 [AudioStudio] Added audio to pending: %@ (%lu bytes)", audioName, (unsigned long)data.length);
            } else {
              NSLog(@"🎵 [AudioStudio] Failed to download audio: %@", error.localizedDescription);
            }

            processedCount++;
            if (processedCount >= totalCount) {
              [strongSelf.selectedAudioIds removeAllObjects];
              [strongSelf closeModal];
            }
          });
        }];
        [task resume];
        break;
      }
    }
  }
}

- (void)uploadFromDevice {
  if (@available(iOS 14.0, *)) {
    UIDocumentPickerViewController *picker = [[UIDocumentPickerViewController alloc] initForOpeningContentTypes:@[UTTypeAudio] asCopy:YES];
    picker.delegate = self;
    picker.allowsMultipleSelection = YES;
    [self presentViewController:picker animated:YES completion:nil];
  }
}

- (void)documentPicker:(UIDocumentPickerViewController *)controller didPickDocumentsAtURLs:(NSArray<NSURL *> *)urls {
  if (urls.count == 0) return;

  for (NSURL *url in urls) {
    [self uploadAudioFileToConvex:url];
  }
}

- (void)uploadAudioFileToConvex:(NSURL *)fileURL {
  NSString *clerkId = [[NSUserDefaults standardUserDefaults] stringForKey:@"CLERK_USER_ID"];
  if (!clerkId) {
    [self showError:@"Please sign in to upload audio"];
    return;
  }

  UIAlertController *loadingAlert = [UIAlertController alertControllerWithTitle:nil message:@"Uploading..." preferredStyle:UIAlertControllerStyleAlert];
  [self presentViewController:loadingAlert animated:YES completion:nil];

  NSData *audioData = [NSData dataWithContentsOfURL:fileURL];
  if (!audioData) {
    [loadingAlert dismissViewControllerAnimated:YES completion:^{
      [self showError:@"Failed to read audio file"];
    }];
    return;
  }

  NSString *audioName = [fileURL lastPathComponent];

  NSString *uploadURL = [NSString stringWithFormat:@"%@/api/audios/upload", [EXEnvBridge v0ApiUrl]];
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
  [body appendData:[audioName dataUsingEncoding:NSUTF8StringEncoding]];
  [body appendData:[@"\r\n" dataUsingEncoding:NSUTF8StringEncoding]];

  [body appendData:[[NSString stringWithFormat:@"--%@\r\n", boundary] dataUsingEncoding:NSUTF8StringEncoding]];
  [body appendData:[[NSString stringWithFormat:@"Content-Disposition: form-data; name=\"file\"; filename=\"%@\"\r\n", audioName] dataUsingEncoding:NSUTF8StringEncoding]];
  [body appendData:[@"Content-Type: audio/mpeg\r\n\r\n" dataUsingEncoding:NSUTF8StringEncoding]];
  [body appendData:audioData];
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
          [strongSelf showError:@"Failed to upload audio"];
          return;
        }

        [strongSelf loadAudios];
      }];
    });
  }];

  [task resume];
}

- (void)generateAudio {
  NSString *prompt = [self.promptTextView.text stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];

  if (prompt.length == 0) {
    return;
  }

  self.micButton.hidden = YES;
  [self.loadingIndicator startAnimating];

  NSString *clerkId = [[NSUserDefaults standardUserDefaults] stringForKey:@"CLERK_USER_ID"];

  if (!clerkId) {
    [self showError:@"Please sign in to generate audio"];
    self.micButton.hidden = NO;
    [self.loadingIndicator stopAnimating];
    return;
  }

  NSString *audioTypeString;
  switch (self.selectedAudioType) {
    case EXAudioTypeSoundEffect:
      audioTypeString = @"sfx";
      break;
    case EXAudioTypeMusic:
      audioTypeString = @"music";
      break;
    case EXAudioTypeVoiceover:
      audioTypeString = @"voiceover";
      break;
    case EXAudioTypeAmbient:
      audioTypeString = @"ambient";
      break;
  }

  // Create audio name from prompt (truncate to 30 chars, sanitize for filename)
  NSString *audioName;
  if (prompt.length > 0) {
    // Take first 30 characters of prompt
    NSString *truncatedPrompt = prompt.length > 30 ? [prompt substringToIndex:30] : prompt;
    // Replace non-alphanumeric characters with dashes
    NSMutableString *sanitized = [NSMutableString string];
    for (NSUInteger i = 0; i < truncatedPrompt.length; i++) {
      unichar c = [truncatedPrompt characterAtIndex:i];
      if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9')) {
        [sanitized appendFormat:@"%C", c];
      } else if (c == ' ' || c == '-' || c == '_') {
        [sanitized appendString:@"-"];
      }
    }
    // Remove leading/trailing dashes and collapse multiple dashes
    NSString *cleanName = [[sanitized stringByTrimmingCharactersInSet:[NSCharacterSet characterSetWithCharactersInString:@"-"]] lowercaseString];
    // Replace multiple dashes with single dash
    while ([cleanName containsString:@"--"]) {
      cleanName = [cleanName stringByReplacingOccurrencesOfString:@"--" withString:@"-"];
    }
    audioName = cleanName.length > 0 ? cleanName : [NSString stringWithFormat:@"%@-%ld", audioTypeString, (long)[[NSDate date] timeIntervalSince1970]];
  } else {
    audioName = [NSString stringWithFormat:@"%@-%ld", audioTypeString, (long)[[NSDate date] timeIntervalSince1970]];
  }

  // Step 1: Generate audio using /api/generate-audio
  // This endpoint generates the audio via ElevenLabs and uploads to Convex storage
  // Returns: { audioUrl, storageId }
  NSString *generateURL = [NSString stringWithFormat:@"%@/api/generate-audio", [EXEnvBridge v0ApiUrl]];

  NSMutableURLRequest *generateRequest = [NSMutableURLRequest requestWithURL:[NSURL URLWithString:generateURL]];
  generateRequest.HTTPMethod = @"POST";
  [generateRequest setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];

  NSDictionary *generateBody = @{
    @"text": prompt,
    @"durationSeconds": @5
  };

  NSError *jsonError;
  generateRequest.HTTPBody = [NSJSONSerialization dataWithJSONObject:generateBody options:0 error:&jsonError];

  __weak typeof(self) weakSelf = self;

  NSURLSessionDataTask *generateTask = [[NSURLSession sharedSession] dataTaskWithRequest:generateRequest completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
    dispatch_async(dispatch_get_main_queue(), ^{
      __strong typeof(weakSelf) strongSelf = weakSelf;
      if (!strongSelf) return;

      if (error) {
        strongSelf.micButton.hidden = NO;
        strongSelf.micButton.alpha = 1.0;
        strongSelf.sendButton.alpha = 0.0;
        [strongSelf.loadingIndicator stopAnimating];
        [strongSelf showError:@"Failed to generate audio"];
        return;
      }

      NSError *parseError;
      NSDictionary *result = [NSJSONSerialization JSONObjectWithData:data options:0 error:&parseError];

      if (parseError) {
        strongSelf.micButton.hidden = NO;
        strongSelf.micButton.alpha = 1.0;
        strongSelf.sendButton.alpha = 0.0;
        [strongSelf.loadingIndicator stopAnimating];
        [strongSelf showError:@"Failed to parse audio response"];
        return;
      }

      // Check for error in response
      if (result[@"error"]) {
        strongSelf.micButton.hidden = NO;
        strongSelf.micButton.alpha = 1.0;
        strongSelf.sendButton.alpha = 0.0;
        [strongSelf.loadingIndicator stopAnimating];
        [strongSelf showError:result[@"error"]];
        return;
      }

      NSString *audioUrl = result[@"audioUrl"];
      NSString *storageId = result[@"storageId"];

      if (!audioUrl || !storageId) {
        strongSelf.micButton.hidden = NO;
        strongSelf.micButton.alpha = 1.0;
        strongSelf.sendButton.alpha = 0.0;
        [strongSelf.loadingIndicator stopAnimating];
        [strongSelf showError:@"Missing audio URL or storage ID"];
        return;
      }

      // Step 2: Save to database using /api/audios/create
      [strongSelf saveAudioToDatabase:storageId url:audioUrl name:audioName text:prompt clerkId:clerkId];
    });
  }];

  [generateTask resume];
}

- (void)saveAudioToDatabase:(NSString *)storageId url:(NSString *)url name:(NSString *)name text:(NSString *)text clerkId:(NSString *)clerkId {
  NSString *createURL = [NSString stringWithFormat:@"%@/api/audios/create", [EXEnvBridge v0ApiUrl]];

  NSMutableURLRequest *createRequest = [NSMutableURLRequest requestWithURL:[NSURL URLWithString:createURL]];
  createRequest.HTTPMethod = @"POST";
  [createRequest setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];

  NSDictionary *createBody = @{
    @"clerkId": clerkId,
    @"name": name,
    @"text": text,
    @"storageId": storageId,
    @"url": url
  };

  NSError *jsonError;
  createRequest.HTTPBody = [NSJSONSerialization dataWithJSONObject:createBody options:0 error:&jsonError];

  __weak typeof(self) weakSelf = self;

  NSURLSessionDataTask *createTask = [[NSURLSession sharedSession] dataTaskWithRequest:createRequest completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
    dispatch_async(dispatch_get_main_queue(), ^{
      __strong typeof(weakSelf) strongSelf = weakSelf;
      if (!strongSelf) return;

      // Reset UI state
      strongSelf.micButton.hidden = NO;
      strongSelf.micButton.alpha = 1.0;
      strongSelf.sendButton.alpha = 0.0;
      [strongSelf.loadingIndicator stopAnimating];
      strongSelf.promptTextView.text = @"";
      [strongSelf textViewDidChange:strongSelf.promptTextView];

      if (error) {
        [strongSelf showError:@"Failed to save audio"];
        return;
      }

      NSError *parseError;
      NSDictionary *result = [NSJSONSerialization JSONObjectWithData:data options:0 error:&parseError];

      if (parseError || !result[@"audioId"]) {
        [strongSelf showError:@"Failed to save audio record"];
        return;
      }

      // Success - reload audios list
      [strongSelf loadAudios];
    });
  }];

  [createTask resume];
}

- (void)pollForUpdates {
  BOOL hasGeneratingAudios = NO;
  for (NSDictionary *audio in self.audios) {
    if ([audio[@"status"] isEqualToString:@"generating"]) {
      hasGeneratingAudios = YES;
      break;
    }
  }

  if (hasGeneratingAudios) {
    [self loadAudios];
  }
}

- (void)loadAudios {
  NSString *clerkId = [[NSUserDefaults standardUserDefaults] stringForKey:@"CLERK_USER_ID"];

  if (!clerkId) {
    return;
  }

  EXChatMessageCache *cache = [EXChatMessageCache sharedInstance];
  NSString *cacheSessionId = [NSString stringWithFormat:@"audio_studio_%@", clerkId];
  NSArray *cachedAudios = [cache cachedAudiosForSession:cacheSessionId];
  if (cachedAudios.count > 0 && self.audios.count == 0) {
    [self.audios removeAllObjects];
    [self.audios addObjectsFromArray:cachedAudios];
    [self.audioCollectionView reloadData];
    self.emptyStateLabel.hidden = self.audios.count > 0;
    self.lastAudiosHash = [self computeAudiosHash:cachedAudios];
  }

  NSString *audiosURL = [NSString stringWithFormat:@"%@/api/audios/list?clerkId=%@", [EXEnvBridge v0ApiUrl], clerkId];

  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:[NSURL URLWithString:audiosURL]];
  request.HTTPMethod = @"GET";
  [request setCachePolicy:NSURLRequestReloadIgnoringLocalCacheData];

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

      NSArray *audiosArray = result[@"audios"];
      if (audiosArray && [audiosArray isKindOfClass:[NSArray class]]) {
        NSString *newHash = [strongSelf computeAudiosHash:audiosArray];

        if ([newHash isEqualToString:strongSelf.lastAudiosHash]) {
          return;
        }

        [cache cacheAudios:audiosArray forSession:cacheSessionId];
        strongSelf.lastAudiosHash = newHash;

        [strongSelf.audios removeAllObjects];
        [strongSelf.audios addObjectsFromArray:audiosArray];
        [strongSelf.audioCollectionView reloadData];

        strongSelf.emptyStateLabel.hidden = strongSelf.audios.count > 0;
      }
    });
  }];

  [task resume];
}

- (NSString *)computeAudiosHash:(NSArray *)audiosArray {
  NSMutableString *hashInput = [NSMutableString string];
  for (NSDictionary *audio in audiosArray) {
    [hashInput appendFormat:@"%@:%@:%@;",
     audio[@"_id"] ?: @"",
     audio[@"status"] ?: @"",
     audio[@"url"] ?: @""];
  }
  return hashInput;
}

- (void)deleteAudio:(NSString *)audioId atIndex:(NSInteger)index {
  NSString *deleteURL = [NSString stringWithFormat:@"%@/api/audios/delete", [EXEnvBridge v0ApiUrl]];

  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:[NSURL URLWithString:deleteURL]];
  request.HTTPMethod = @"POST";
  [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];

  NSDictionary *body = @{@"id": audioId};
  request.HTTPBody = [NSJSONSerialization dataWithJSONObject:body options:0 error:nil];

  __weak typeof(self) weakSelf = self;

  NSURLSessionDataTask *task = [[NSURLSession sharedSession] dataTaskWithRequest:request completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
    dispatch_async(dispatch_get_main_queue(), ^{
      __strong typeof(weakSelf) strongSelf = weakSelf;
      if (!strongSelf) return;

      if (!error && index < strongSelf.audios.count) {
        [strongSelf.audios removeObjectAtIndex:index];
        [strongSelf.audioCollectionView deleteItemsAtIndexPaths:@[[NSIndexPath indexPathForItem:index + 1 inSection:0]]];
        strongSelf.emptyStateLabel.hidden = strongSelf.audios.count > 0;
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

#pragma mark - UICollectionViewDataSource

- (NSInteger)collectionView:(UICollectionView *)collectionView numberOfItemsInSection:(NSInteger)section {
  return self.audios.count + 1;
}

- (UICollectionViewCell *)collectionView:(UICollectionView *)collectionView cellForItemAtIndexPath:(NSIndexPath *)indexPath {
  // First cell is always the "add" placeholder
  if (indexPath.item == 0) {
    EXAudioStudioAddCell *cell = [collectionView dequeueReusableCellWithReuseIdentifier:@"AddCell" forIndexPath:indexPath];
    return cell;
  }

  EXAudioStudioCell *cell = [collectionView dequeueReusableCellWithReuseIdentifier:@"AudioCell" forIndexPath:indexPath];

  NSInteger audioIndex = indexPath.item - 1;
  NSDictionary *audioData = self.audios[audioIndex];
  NSString *status = audioData[@"status"];
  NSString *audioUrl = audioData[@"url"];
  NSString *audioId = audioData[@"_id"];
  NSString *audioName = audioData[@"name"] ?: @"Audio";

  cell.currentAudioId = audioId;

  if ([status isEqualToString:@"generating"]) {
    [cell configureForGeneratingState];
  } else if ([status isEqualToString:@"error"]) {
    [cell configureForErrorState];
  } else if (audioUrl && [status isEqualToString:@"completed"]) {
    BOOL isSelected = audioId && [self.selectedAudioIds containsObject:audioId];
    NSInteger selectionIndex = 0;
    if (isSelected) {
      NSArray *selectedArray = [self.selectedAudioIds allObjects];
      selectionIndex = [selectedArray indexOfObject:audioId] + 1;
    }
    [cell configureForCompletedStateWithName:audioName isSelected:isSelected selectionIndex:selectionIndex];

    // Update play button state based on currently playing
    BOOL isPlaying = [self.currentlyPlayingId isEqualToString:audioId] && self.audioPlayer.isPlaying;
    [cell setPlayingState:isPlaying];

    // Set up play button action
    cell.playButton.tag = 300 + audioIndex;
    [cell.playButton removeTarget:nil action:NULL forControlEvents:UIControlEventAllEvents];
    [cell.playButton addTarget:self action:@selector(playButtonTapped:) forControlEvents:UIControlEventTouchUpInside];
  }

  return cell;
}

- (void)playButtonTapped:(UIButton *)button {
  NSInteger index = button.tag - 300;
  if (index < 0 || index >= self.audios.count) return;

  UIImpactFeedbackGenerator *feedback = [[UIImpactFeedbackGenerator alloc] initWithStyle:UIImpactFeedbackStyleLight];
  [feedback impactOccurred];

  [self playAudioAtIndex:index];
}

- (void)collectionView:(UICollectionView *)collectionView didSelectItemAtIndexPath:(NSIndexPath *)indexPath {
  if (indexPath.item == 0) {
    [self uploadFromDevice];
    return;
  }

  // Handle selection for audio cells
  NSInteger audioIndex = indexPath.item - 1;
  if (audioIndex < 0 || audioIndex >= self.audios.count) return;

  NSDictionary *audioData = self.audios[audioIndex];
  NSString *audioId = audioData[@"_id"];
  NSString *status = audioData[@"status"];

  // Only allow selection for completed audios
  if (![status isEqualToString:@"completed"]) return;

  if (!audioId) return;

  // Toggle selection
  if ([self.selectedAudioIds containsObject:audioId]) {
    [self.selectedAudioIds removeObject:audioId];
  } else {
    [self.selectedAudioIds addObject:audioId];
  }

  UIImpactFeedbackGenerator *feedback = [[UIImpactFeedbackGenerator alloc] initWithStyle:UIImpactFeedbackStyleLight];
  [feedback impactOccurred];

  [self updateSelectionUI];
}

#pragma mark - Context Menu (Long Press)

- (UIContextMenuConfiguration *)collectionView:(UICollectionView *)collectionView
    contextMenuConfigurationForItemAtIndexPath:(NSIndexPath *)indexPath
                                         point:(CGPoint)point API_AVAILABLE(ios(13.0)) {

  if (indexPath.item == 0) {
    return nil;
  }

  NSInteger audioIndex = indexPath.item - 1;
  if (audioIndex < 0 || audioIndex >= self.audios.count) {
    return nil;
  }

  NSDictionary *audioData = self.audios[audioIndex];
  NSString *status = audioData[@"status"];

  if (![status isEqualToString:@"completed"]) {
    return nil;
  }

  __weak typeof(self) weakSelf = self;

  return [UIContextMenuConfiguration configurationWithIdentifier:@(audioIndex)
                                                 previewProvider:nil
                                                  actionProvider:^UIMenu * _Nullable(NSArray<UIMenuElement *> * _Nonnull suggestedActions) {

    // Play action
    UIAction *playAction = [UIAction actionWithTitle:@"Play"
                                               image:[UIImage systemImageNamed:@"play.fill"]
                                          identifier:nil
                                             handler:^(__kindof UIAction * _Nonnull action) {
      [weakSelf playAudioAtIndex:audioIndex];
    }];

    // Copy URL action
    UIAction *copyAction = [UIAction actionWithTitle:@"Copy URL"
                                               image:[UIImage systemImageNamed:@"doc.on.doc"]
                                          identifier:nil
                                             handler:^(__kindof UIAction * _Nonnull action) {
      [weakSelf copyAudioURLAtIndex:audioIndex];
    }];

    // Share action
    UIAction *shareAction = [UIAction actionWithTitle:@"Share"
                                                image:[UIImage systemImageNamed:@"square.and.arrow.up"]
                                           identifier:nil
                                              handler:^(__kindof UIAction * _Nonnull action) {
      [weakSelf shareAudioAtIndex:audioIndex fromIndexPath:indexPath];
    }];

    // Add to Prompt action
    UIAction *addToPromptAction = [UIAction actionWithTitle:@"Add to Prompt"
                                                      image:[UIImage systemImageNamed:@"text.badge.plus"]
                                                 identifier:nil
                                                    handler:^(__kindof UIAction * _Nonnull action) {
      [weakSelf addAudioToPromptAtIndex:audioIndex];
    }];

    // Delete action (destructive)
    UIAction *deleteAction = [UIAction actionWithTitle:@"Delete"
                                                 image:[UIImage systemImageNamed:@"trash"]
                                            identifier:nil
                                               handler:^(__kindof UIAction * _Nonnull action) {
      [weakSelf confirmDeleteAudioAtIndex:audioIndex];
    }];
    deleteAction.attributes = UIMenuElementAttributesDestructive;

    UIMenu *menu = [UIMenu menuWithTitle:@""
                                children:@[playAction, copyAction, shareAction, addToPromptAction, deleteAction]];

    return menu;
  }];
}

- (UITargetedPreview *)collectionView:(UICollectionView *)collectionView
    previewForHighlightingContextMenuWithConfiguration:(UIContextMenuConfiguration *)configuration API_AVAILABLE(ios(13.0)) {

  NSNumber *identifier = (NSNumber *)configuration.identifier;
  if (!identifier) return nil;

  NSInteger audioIndex = [identifier integerValue];
  NSIndexPath *indexPath = [NSIndexPath indexPathForItem:audioIndex + 1 inSection:0];

  UICollectionViewCell *cell = [collectionView cellForItemAtIndexPath:indexPath];
  if (!cell) return nil;

  UIPreviewParameters *params = [[UIPreviewParameters alloc] init];
  params.backgroundColor = [UIColor clearColor];
  params.visiblePath = [UIBezierPath bezierPathWithRoundedRect:cell.contentView.bounds cornerRadius:16];

  return [[UITargetedPreview alloc] initWithView:cell.contentView parameters:params];
}

- (UITargetedPreview *)collectionView:(UICollectionView *)collectionView
    previewForDismissingContextMenuWithConfiguration:(UIContextMenuConfiguration *)configuration API_AVAILABLE(ios(13.0)) {
  return [self collectionView:collectionView previewForHighlightingContextMenuWithConfiguration:configuration];
}

#pragma mark - Context Menu Actions

- (void)playAudioAtIndex:(NSInteger)index {
  if (index < 0 || index >= self.audios.count) return;

  NSDictionary *audioData = self.audios[index];
  NSString *audioUrl = audioData[@"url"];
  NSString *audioId = audioData[@"_id"];
  if (!audioUrl) {
    NSLog(@"🎵 [AudioStudio] No URL for audio at index %ld", (long)index);
    return;
  }

  NSLog(@"🎵 [AudioStudio] playAudioAtIndex: %ld, id: %@, url: %@", (long)index, audioId, audioUrl);

  // Stop current if playing same audio (toggle behavior)
  if ([self.currentlyPlayingId isEqualToString:audioId] && self.audioPlayer.isPlaying) {
    NSLog(@"🎵 [AudioStudio] Stopping currently playing audio");
    [self.audioPlayer stop];
    self.currentlyPlayingId = nil;
    [self updatePlayStateForAllCells];
    return;
  }

  // Stop any currently playing audio first
  if (self.audioPlayer.isPlaying) {
    [self.audioPlayer stop];
  }
  self.currentlyPlayingId = audioId;

  // Configure audio session for playback
  NSError *sessionError = nil;
  AVAudioSession *session = [AVAudioSession sharedInstance];
  [session setCategory:AVAudioSessionCategoryPlayback error:&sessionError];
  if (sessionError) {
    NSLog(@"🎵 [AudioStudio] Audio session category error: %@", sessionError);
  }
  [session setActive:YES error:&sessionError];
  if (sessionError) {
    NSLog(@"🎵 [AudioStudio] Audio session activation error: %@", sessionError);
  }

  // Update UI to show loading state
  [self updatePlayStateForAllCells];

  NSURL *url = [NSURL URLWithString:audioUrl];
  __weak typeof(self) weakSelf = self;
  NSURLSessionDataTask *task = [[NSURLSession sharedSession] dataTaskWithURL:url completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
    dispatch_async(dispatch_get_main_queue(), ^{
      __strong typeof(weakSelf) strongSelf = weakSelf;
      if (!strongSelf) return;

      if (error) {
        NSLog(@"🎵 [AudioStudio] Download error: %@", error);
        strongSelf.currentlyPlayingId = nil;
        [strongSelf updatePlayStateForAllCells];
        return;
      }

      if (!data || data.length == 0) {
        NSLog(@"🎵 [AudioStudio] No data received");
        strongSelf.currentlyPlayingId = nil;
        [strongSelf updatePlayStateForAllCells];
        return;
      }

      NSLog(@"🎵 [AudioStudio] Downloaded %lu bytes", (unsigned long)data.length);

      NSError *playerError = nil;
      strongSelf.audioPlayer = [[AVAudioPlayer alloc] initWithData:data error:&playerError];

      if (playerError) {
        NSLog(@"🎵 [AudioStudio] Player init error: %@", playerError);
        strongSelf.currentlyPlayingId = nil;
        [strongSelf updatePlayStateForAllCells];
        return;
      }

      strongSelf.audioPlayer.delegate = (id<AVAudioPlayerDelegate>)strongSelf;
      [strongSelf.audioPlayer prepareToPlay];

      if ([strongSelf.audioPlayer play]) {
        NSLog(@"🎵 [AudioStudio] Playing audio successfully");
      } else {
        NSLog(@"🎵 [AudioStudio] Failed to play audio");
        strongSelf.currentlyPlayingId = nil;
      }

      [strongSelf updatePlayStateForAllCells];
    });
  }];
  [task resume];
}

- (void)updatePlayStateForAllCells {
  for (NSInteger i = 0; i < self.audios.count; i++) {
    NSIndexPath *indexPath = [NSIndexPath indexPathForItem:i + 1 inSection:0];
    EXAudioStudioCell *cell = (EXAudioStudioCell *)[self.audioCollectionView cellForItemAtIndexPath:indexPath];
    if (cell && [cell isKindOfClass:[EXAudioStudioCell class]]) {
      NSDictionary *audioData = self.audios[i];
      NSString *audioId = audioData[@"_id"];
      BOOL isPlaying = [self.currentlyPlayingId isEqualToString:audioId] && self.audioPlayer.isPlaying;
      [cell setPlayingState:isPlaying];
    }
  }
}

#pragma mark - AVAudioPlayerDelegate

- (void)audioPlayerDidFinishPlaying:(AVAudioPlayer *)player successfully:(BOOL)flag {
  NSLog(@"🎵 [AudioStudio] Audio finished playing, success: %d", flag);
  self.currentlyPlayingId = nil;
  [self updatePlayStateForAllCells];
}

- (void)audioPlayerDecodeErrorDidOccur:(AVAudioPlayer *)player error:(NSError *)error {
  NSLog(@"🎵 [AudioStudio] Audio decode error: %@", error);
  self.currentlyPlayingId = nil;
  [self updatePlayStateForAllCells];
}

- (void)copyAudioURLAtIndex:(NSInteger)index {
  if (index < 0 || index >= self.audios.count) return;

  NSDictionary *audioData = self.audios[index];
  NSString *audioUrl = audioData[@"url"];
  if (!audioUrl) return;

  [[UIPasteboard generalPasteboard] setString:audioUrl];
  [self showToast:@"URL copied to clipboard"];
  UINotificationFeedbackGenerator *feedback = [[UINotificationFeedbackGenerator alloc] init];
  [feedback notificationOccurred:UINotificationFeedbackTypeSuccess];
}

- (void)shareAudioAtIndex:(NSInteger)index fromIndexPath:(NSIndexPath *)indexPath {
  if (index < 0 || index >= self.audios.count) return;

  NSDictionary *audioData = self.audios[index];
  NSString *audioUrl = audioData[@"url"];
  if (!audioUrl) return;

  NSURL *url = [NSURL URLWithString:audioUrl];
  UIActivityViewController *activityVC = [[UIActivityViewController alloc] initWithActivityItems:@[url] applicationActivities:nil];

  if (UI_USER_INTERFACE_IDIOM() == UIUserInterfaceIdiomPad) {
    UICollectionViewCell *cell = [self.audioCollectionView cellForItemAtIndexPath:indexPath];
    activityVC.popoverPresentationController.sourceView = cell;
    activityVC.popoverPresentationController.sourceRect = cell.bounds;
  }

  [self presentViewController:activityVC animated:YES completion:nil];
}

- (void)addAudioToPromptAtIndex:(NSInteger)index {
  if (index < 0 || index >= self.audios.count) return;

  NSDictionary *audioData = self.audios[index];
  NSString *audioId = audioData[@"_id"];

  if (!audioId) return;

  if (![self.selectedAudioIds containsObject:audioId]) {
    [self.selectedAudioIds addObject:audioId];
    [self updateSelectionUI];
  }

  [self addSelectedToPrompt];
}

- (void)confirmDeleteAudioAtIndex:(NSInteger)index {
  if (index < 0 || index >= self.audios.count) return;

  NSDictionary *audioData = self.audios[index];
  NSString *audioId = audioData[@"_id"];

  if (!audioId) return;

  UIAlertController *alert = [UIAlertController alertControllerWithTitle:@"Delete Audio"
                                                                 message:@"Are you sure you want to delete this audio? This cannot be undone."
                                                          preferredStyle:UIAlertControllerStyleAlert];

  [alert addAction:[UIAlertAction actionWithTitle:@"Cancel" style:UIAlertActionStyleCancel handler:nil]];

  __weak typeof(self) weakSelf = self;
  [alert addAction:[UIAlertAction actionWithTitle:@"Delete" style:UIAlertActionStyleDestructive handler:^(UIAlertAction *action) {
    [weakSelf deleteAudio:audioId atIndex:index];
  }]];

  [self presentViewController:alert animated:YES completion:nil];
}

- (void)showToast:(NSString *)message {
  UILabel *toast = [[UILabel alloc] init];
  toast.text = message;
  toast.textColor = [UIColor whiteColor];
  toast.font = [UIFont systemFontOfSize:14 weight:UIFontWeightMedium];
  toast.textAlignment = NSTextAlignmentCenter;
  toast.backgroundColor = [UIColor colorWithWhite:0.2 alpha:0.95];
  toast.layer.cornerRadius = 20;
  toast.clipsToBounds = YES;
  toast.alpha = 0;
  toast.translatesAutoresizingMaskIntoConstraints = NO;

  [self.view addSubview:toast];

  [NSLayoutConstraint activateConstraints:@[
    [toast.centerXAnchor constraintEqualToAnchor:self.view.centerXAnchor],
    [toast.bottomAnchor constraintEqualToAnchor:self.view.safeAreaLayoutGuide.bottomAnchor constant:-100],
    [toast.widthAnchor constraintGreaterThanOrEqualToConstant:120],
    [toast.heightAnchor constraintEqualToConstant:40]
  ]];

  toast.layoutMargins = UIEdgeInsetsMake(10, 20, 10, 20);

  [UIView animateWithDuration:0.3 animations:^{
    toast.alpha = 1.0;
  } completion:^(BOOL finished) {
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(2.0 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
      [UIView animateWithDuration:0.3 animations:^{
        toast.alpha = 0;
      } completion:^(BOOL finished) {
        [toast removeFromSuperview];
      }];
    });
  }];
}

#pragma mark - UICollectionViewDelegateFlowLayout

- (CGSize)collectionView:(UICollectionView *)collectionView layout:(UICollectionViewLayout *)collectionViewLayout sizeForItemAtIndexPath:(NSIndexPath *)indexPath {
  // Vertical grid - 3 columns on iPhone, 4 on iPad - EXACTLY like Image Studio
  CGFloat availableWidth = collectionView.bounds.size.width - 40 - 24;
  NSInteger columns = [UIDevice currentDevice].userInterfaceIdiom == UIUserInterfaceIdiomPad ? 4 : 3;
  CGFloat cellWidth = floor(availableWidth / columns);

  return CGSizeMake(cellWidth, cellWidth); // Square cells
}

#pragma mark - Sandbox Upload

- (void)uploadAudioToSandbox:(NSData *)audioData fileName:(NSString *)fileName sandboxId:(NSString *)sandboxId completion:(void (^)(NSString *sandboxPath, NSError *error))completion {
  NSString *uploadURL = [NSString stringWithFormat:@"%@/api/upload-audio", [EXEnvBridge v0ApiUrl]];

  NSString *boundary = [[NSUUID UUID] UUIDString];
  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:[NSURL URLWithString:uploadURL]];
  request.HTTPMethod = @"POST";
  [request setValue:[NSString stringWithFormat:@"multipart/form-data; boundary=%@", boundary] forHTTPHeaderField:@"Content-Type"];
  [request setValue:sandboxId forHTTPHeaderField:@"x-session-id"];

  NSMutableData *body = [NSMutableData data];

  [body appendData:[[NSString stringWithFormat:@"--%@\r\n", boundary] dataUsingEncoding:NSUTF8StringEncoding]];
  [body appendData:[[NSString stringWithFormat:@"Content-Disposition: form-data; name=\"file\"; filename=\"%@.mp3\"\r\n", fileName] dataUsingEncoding:NSUTF8StringEncoding]];
  [body appendData:[@"Content-Type: audio/mpeg\r\n\r\n" dataUsingEncoding:NSUTF8StringEncoding]];
  [body appendData:audioData];
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
      completion(nil, parseError ?: [NSError errorWithDomain:@"AudioUploadError" code:500 userInfo:@{NSLocalizedDescriptionKey: @"Failed to upload audio"}]);
      return;
    }

    completion(result[@"path"], nil);
  }];

  [task resume];
}

@end
