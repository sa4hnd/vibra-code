// Copyright 2015-present 650 Industries. All rights reserved.

#import "EXPreviewZoomManager+Private.h"
#import "EXPreviewZoomManager.h"
#import "EXChatBackendService.h"
#import "EXEnvBridge.h"
#import "Chat/EXChatMessageCache.h"
#import "EXAudioRecorderService.h"
#import "EXAssemblyAIService.h"
#import "EXAudioWaveformView.h"
#import <UIKit/UIKit.h>
#import <Photos/Photos.h>
#import <PhotosUI/PhotosUI.h>
#import <AVFoundation/AVFoundation.h>
#import <SDWebImage/SDWebImage.h>

// Helper category for creating solid color images
@interface UIImage (SolidColor)
+ (UIImage *)imageWithColor:(UIColor *)color;
@end

@implementation UIImage (SolidColor)
+ (UIImage *)imageWithColor:(UIColor *)color {
  CGRect rect = CGRectMake(0, 0, 1, 1);
  UIGraphicsBeginImageContextWithOptions(rect.size, NO, 0);
  [color setFill];
  UIRectFill(rect);
  UIImage *image = UIGraphicsGetImageFromCurrentImageContext();
  UIGraphicsEndImageContext();
  return image;
}
@end

// Forward declarations
@class EXImageStudioModalViewController;

// Image cache for preventing reload flickering
static NSCache<NSString *, UIImage *> *_imageCache = nil;

// Image type options
typedef NS_ENUM(NSInteger, EXImageType) {
  EXImageTypeIcon = 0,
  EXImageTypeImage,
  EXImageTypeBackground,
  EXImageTypeLogo
};

#pragma mark - Custom Cell Classes for Proper Reuse

// Custom image cell class - prevents flickering by reusing views properly
@interface EXImageStudioCell : UICollectionViewCell
@property (nonatomic, strong) UIView *checkerboardView;
@property (nonatomic, strong) UIImageView *imageView;
@property (nonatomic, strong) UIView *badgeView;
@property (nonatomic, strong) UILabel *badgeLabel;
@property (nonatomic, strong) UIView *shimmerView;
@property (nonatomic, strong) CAGradientLayer *shimmerGradient;
@property (nonatomic, strong) UILabel *statusLabel;
@property (nonatomic, strong) UIImageView *statusIcon;
@property (nonatomic, strong) NSString *currentImageUrl;
@end

@implementation EXImageStudioCell

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

  // Checkerboard background (for transparency)
  self.checkerboardView = [[UIView alloc] init];
  self.checkerboardView.translatesAutoresizingMaskIntoConstraints = NO;
  self.checkerboardView.hidden = YES;
  [self.contentView addSubview:self.checkerboardView];

  // Create checkerboard pattern once
  CGFloat squareSize = 8.0;
  CGFloat patternSize = squareSize * 2;
  UIGraphicsBeginImageContextWithOptions(CGSizeMake(patternSize, patternSize), YES, 0);
  UIColor *darkColor = [UIColor colorWithRed:0.1 green:0.1 blue:0.1 alpha:1.0];
  UIColor *lightColor = [UIColor colorWithRed:0.15 green:0.15 blue:0.15 alpha:1.0];
  [darkColor setFill];
  UIRectFill(CGRectMake(0, 0, squareSize, squareSize));
  UIRectFill(CGRectMake(squareSize, squareSize, squareSize, squareSize));
  [lightColor setFill];
  UIRectFill(CGRectMake(squareSize, 0, squareSize, squareSize));
  UIRectFill(CGRectMake(0, squareSize, squareSize, squareSize));
  UIImage *patternImage = UIGraphicsGetImageFromCurrentImageContext();
  UIGraphicsEndImageContext();
  self.checkerboardView.backgroundColor = [UIColor colorWithPatternImage:patternImage];

  // Image view
  self.imageView = [[UIImageView alloc] init];
  self.imageView.translatesAutoresizingMaskIntoConstraints = NO;
  self.imageView.contentMode = UIViewContentModeScaleAspectFill;
  self.imageView.clipsToBounds = YES;
  self.imageView.hidden = YES;
  [self.contentView addSubview:self.imageView];

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
  UIImageSymbolConfiguration *iconConfig = [UIImageSymbolConfiguration configurationWithPointSize:24 weight:UIImageSymbolWeightMedium];
  self.statusIcon = [[UIImageView alloc] initWithImage:[UIImage systemImageNamed:@"sparkles" withConfiguration:iconConfig]];
  self.statusIcon.translatesAutoresizingMaskIntoConstraints = NO;
  self.statusIcon.tintColor = [UIColor colorWithRed:0.9 green:0.6 blue:0.2 alpha:1.0];
  self.statusIcon.hidden = YES;
  [self.contentView addSubview:self.statusIcon];

  // Selection badge
  self.badgeView = [[UIView alloc] init];
  self.badgeView.translatesAutoresizingMaskIntoConstraints = NO;
  self.badgeView.backgroundColor = [UIColor colorWithRed:0.2 green:0.5 blue:1.0 alpha:1.0];
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
    [self.checkerboardView.topAnchor constraintEqualToAnchor:self.contentView.topAnchor],
    [self.checkerboardView.leadingAnchor constraintEqualToAnchor:self.contentView.leadingAnchor],
    [self.checkerboardView.trailingAnchor constraintEqualToAnchor:self.contentView.trailingAnchor],
    [self.checkerboardView.bottomAnchor constraintEqualToAnchor:self.contentView.bottomAnchor],

    [self.imageView.topAnchor constraintEqualToAnchor:self.contentView.topAnchor],
    [self.imageView.leadingAnchor constraintEqualToAnchor:self.contentView.leadingAnchor],
    [self.imageView.trailingAnchor constraintEqualToAnchor:self.contentView.trailingAnchor],
    [self.imageView.bottomAnchor constraintEqualToAnchor:self.contentView.bottomAnchor],

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
    [self.badgeLabel.centerYAnchor constraintEqualToAnchor:self.badgeView.centerYAnchor]
  ]];
}

- (void)layoutSubviews {
  [super layoutSubviews];
  self.shimmerGradient.frame = CGRectMake(-200, 0, self.bounds.size.width + 400, self.bounds.size.height);
}

- (void)prepareForReuse {
  [super prepareForReuse];

  // Cancel any pending image load - CRITICAL for preventing flickering
  [self.imageView sd_cancelCurrentImageLoad];

  // Reset to hidden state (NOT remove subviews!)
  self.imageView.image = nil;
  self.imageView.hidden = YES;
  self.checkerboardView.hidden = YES;
  self.shimmerView.hidden = YES;
  self.statusLabel.hidden = YES;
  self.statusIcon.hidden = YES;
  self.badgeView.hidden = YES;
  self.currentImageUrl = nil;

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

- (void)configureForCompletedStateWithUrl:(NSString *)imageUrl isSelected:(BOOL)isSelected selectionIndex:(NSInteger)selectionIndex {
  self.checkerboardView.hidden = NO;
  self.imageView.hidden = NO;
  self.currentImageUrl = imageUrl;

  // Selection badge
  if (isSelected) {
    self.badgeView.hidden = NO;
    self.badgeLabel.text = [NSString stringWithFormat:@"%ld", (long)selectionIndex];
    self.contentView.layer.borderWidth = 3.0;
    self.contentView.layer.borderColor = [UIColor colorWithRed:0.2 green:0.5 blue:1.0 alpha:1.0].CGColor;
  }

  // Load image with SDWebImage (handles caching automatically)
  NSURL *url = [NSURL URLWithString:imageUrl];
  UIImage *placeholder = [UIImage imageWithColor:[UIColor colorWithWhite:0.2 alpha:1.0]];

  __weak typeof(self) weakSelf = self;
  // Use memory-first caching to prevent flickering on scroll
  SDWebImageOptions options = SDWebImageRetryFailed | SDWebImageScaleDownLargeImages | SDWebImageQueryMemoryData | SDWebImageAvoidAutoSetImage;

  [self.imageView sd_setImageWithURL:url
                    placeholderImage:placeholder
                             options:options
                           completed:^(UIImage *image, NSError *error, SDImageCacheType cacheType, NSURL *imageURL) {
    __strong typeof(weakSelf) strongSelf = weakSelf;
    if (!strongSelf) return;

    // Verify this is still the image we want (prevents wrong image on reused cell)
    if (!error && image && [strongSelf.currentImageUrl isEqualToString:imageUrl]) {
      strongSelf.imageView.image = image;

      // Only animate if not from memory cache
      if (cacheType != SDImageCacheTypeMemory) {
        strongSelf.imageView.alpha = 0;
        [UIView animateWithDuration:0.2 animations:^{
          strongSelf.imageView.alpha = 1.0;
        }];
      } else {
        strongSelf.imageView.alpha = 1.0;
      }
    }
  }];
}

@end

// Custom add cell class
@interface EXImageStudioAddCell : UICollectionViewCell
@property (nonatomic, strong) UIImageView *plusIcon;
@property (nonatomic, strong) CAShapeLayer *dashLayer;
@end

@implementation EXImageStudioAddCell

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

  // Plus icon
  UIImageSymbolConfiguration *plusConfig = [UIImageSymbolConfiguration configurationWithPointSize:28 weight:UIImageSymbolWeightMedium];
  self.plusIcon = [[UIImageView alloc] initWithImage:[UIImage systemImageNamed:@"photo.badge.plus" withConfiguration:plusConfig]];
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

// Image Studio Modal View Controller
@interface EXImageStudioModalViewController : UIViewController <UIAdaptivePresentationControllerDelegate, UICollectionViewDataSource, UICollectionViewDelegate, UICollectionViewDelegateFlowLayout, UITextViewDelegate, PHPickerViewControllerDelegate>

@property(nonatomic, weak) EXPreviewZoomManager *manager;
@property(nonatomic, strong) UITextView *promptTextView;
@property(nonatomic, strong) UIButton *generateButton;
@property(nonatomic, strong) UIButton *micButton;
@property(nonatomic, strong) UIButton *sendButton;
@property(nonatomic, strong) UICollectionView *imageCollectionView;
@property(nonatomic, strong) NSMutableArray<NSDictionary *> *images;
@property(nonatomic, strong) UIActivityIndicatorView *loadingIndicator;
@property(nonatomic, strong) UIVisualEffectView *backgroundView;
@property(nonatomic, strong) UILabel *emptyStateLabel;
@property(nonatomic, assign) BOOL isGenerating;
@property(nonatomic, strong) NSTimer *refreshTimer;
@property(nonatomic, strong) UIView *inputContainer;
@property(nonatomic, strong) NSLayoutConstraint *inputContainerBottomConstraint;
@property(nonatomic, strong) NSLayoutConstraint *inputContainerHeightConstraint;
@property(nonatomic, strong) NSMutableArray<NSString *> *referenceImageIds;
@property(nonatomic, strong) NSMutableSet<NSString *> *selectedImageIds;
@property(nonatomic, strong) UIButton *addToPromptButton;
@property(nonatomic, strong) UILabel *selectionCountLabel;
@property(nonatomic, strong) UIView *bottomActionContainer;
@property(nonatomic, strong) NSLayoutConstraint *bottomActionBottomConstraint;
@property(nonatomic, strong) UIButton *imageTypeButton;
@property(nonatomic, assign) EXImageType selectedImageType;
@property(nonatomic, assign) BOOL isRecording;
@property(nonatomic, assign) BOOL isTranscribing;
@property(nonatomic, strong) UIView *recordingOverlay;
@property(nonatomic, strong) UILabel *recordingLabel;
@property(nonatomic, strong) EXAudioWaveformView *waveformView;
@property(nonatomic, strong) NSString *lastImagesHash;
@property(nonatomic, strong) UIView *headerView;
@property(nonatomic, strong) UIButton *clearAllButton;

- (instancetype)initWithManager:(EXPreviewZoomManager *)manager;

@end

// Category implementation
@implementation EXPreviewZoomManager (ImageStudioModal)

- (void)showImageStudioModal {
  if (self.imageStudioModalPresented) {
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

  EXImageStudioModalViewController *modalVC = [[EXImageStudioModalViewController alloc] initWithManager:self];

  UINavigationController *navController = [[UINavigationController alloc] initWithRootViewController:modalVC];
  navController.view.backgroundColor = [UIColor clearColor];
  navController.navigationBarHidden = YES;

  self.imageStudioModalViewController = navController;

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
  self.imageStudioModalPresented = YES;
}

- (void)insertImageTag:(NSString *)tagName withPath:(NSString *)path {
  NSLog(@"📸 [ImageStudio] insertImageTag called: tagName=%@, path=%@", tagName, path);

  // IMPORTANT: Store the path mapping FIRST, before any early returns
  // This ensures the path is available when sending even if the visual tag can't be inserted
  if (!self.imagePathMappings) {
    self.imagePathMappings = [NSMutableDictionary dictionary];
  }
  if (path && path.length > 0) {
    self.imagePathMappings[tagName] = path;
    NSLog(@"📸 [ImageStudio] Stored path mapping: %@ -> %@", tagName, path);
  }

  UITextView *inputTextView = self.inputTextView;
  if (!inputTextView) {
    NSLog(@"⚠️ [ImageStudio] insertImageTag: inputTextView is nil! Path stored but tag not visible.");
    return;
  }

  NSLog(@"📸 [ImageStudio] inputTextView found, proceeding with tag insertion");

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

  // Create tag string with path as hidden metadata (stored separately)
  NSString *tagString = [NSString stringWithFormat:@"@%@ ", tagName];

  // Path mapping already stored at beginning of method

  // Insert tag at cursor position or append
  NSString *newText = [currentText stringByReplacingCharactersInRange:selectedRange withString:tagString];

  // Calculate tag range
  NSRange tagRange = NSMakeRange(selectedRange.location, tagString.length);

  // Update text with attributed string and highlighting
  [self updateTextInputWithAttributedStringAndImageTag:newText tagRange:tagRange];

  // Update cursor position
  inputTextView.selectedRange = NSMakeRange(selectedRange.location + tagString.length, 0);
}

- (void)updateTextInputWithAttributedStringAndImageTag:(NSString *)text tagRange:(NSRange)tagRange {
  UITextView *inputTextView = self.inputTextView;
  if (!inputTextView) {
    return;
  }

  // Preserve existing attributed text or create new one
  NSMutableAttributedString *attributedString;
  if (inputTextView.attributedText && inputTextView.attributedText.length > 0 &&
      ![inputTextView.attributedText.string isEqualToString:@"Message"]) {
    // Start from existing attributed string to preserve other tag highlights
    attributedString = [[NSMutableAttributedString alloc] initWithAttributedString:inputTextView.attributedText];

    // If text changed (tag was inserted), we need to update the string
    if (![attributedString.string isEqualToString:text]) {
      attributedString = [[NSMutableAttributedString alloc] initWithString:text];

      // Apply default attributes
      UIFont *font = [UIFont systemFontOfSize:17 weight:UIFontWeightRegular];
      UIColor *textColor = [UIColor whiteColor];
      [attributedString addAttributes:@{
        NSFontAttributeName : font,
        NSForegroundColorAttributeName : textColor
      }
                                range:NSMakeRange(0, attributedString.length)];

      // Reapply all existing tag highlights with rounded corners
      [self reapplyAllTagHighlightsToAttributedString:attributedString excludingRange:tagRange];
    }
  } else {
    attributedString = [[NSMutableAttributedString alloc] initWithString:text];

    // Apply default attributes
    UIFont *font = [UIFont systemFontOfSize:17 weight:UIFontWeightRegular];
    UIColor *textColor = [UIColor whiteColor];
    [attributedString addAttributes:@{
      NSFontAttributeName : font,
      NSForegroundColorAttributeName : textColor
    }
                              range:NSMakeRange(0, attributedString.length)];
  }

  // Apply blue background to image tag with rounded corners
  UIColor *tagColor = [UIColor colorWithRed:0.3
                                      green:0.5
                                       blue:0.9
                                      alpha:1.0]; // Blue color for images
  [attributedString addAttribute:NSBackgroundColorAttributeName
                           value:tagColor
                           range:tagRange];

  // Store tag range with type info in apiTagRanges
  if (!self.apiTagRanges) {
    self.apiTagRanges = [NSMutableArray array];
  }

  // Store as dictionary with type info for color differentiation
  NSDictionary *tagInfo = @{
    @"range": [NSValue valueWithRange:tagRange],
    @"type": @"image",
    @"color": tagColor
  };
  [self.apiTagRanges addObject:tagInfo];

  inputTextView.attributedText = attributedString;

  // Trigger text change notification
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
      // Legacy - use default color
      tagColor = [UIColor colorWithRed:0.3 green:0.5 blue:0.9 alpha:1.0];
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

// MARK: - EXImageStudioModalViewController Implementation

@implementation EXImageStudioModalViewController

+ (void)initialize {
  if (self == [EXImageStudioModalViewController class]) {
    _imageCache = [[NSCache alloc] init];
    _imageCache.countLimit = 50;
  }
}

- (instancetype)initWithManager:(EXPreviewZoomManager *)manager {
  self = [super init];
  if (self) {
    _manager = manager;
    _images = [NSMutableArray array];
    _isGenerating = NO;
    _referenceImageIds = [NSMutableArray array];
    _selectedImageIds = [NSMutableSet set];
    _selectedImageType = EXImageTypeIcon;
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

  // Add tap gesture to dismiss keyboard when tapping outside text view
  UITapGestureRecognizer *tapGesture = [[UITapGestureRecognizer alloc] initWithTarget:self action:@selector(dismissKeyboard)];
  tapGesture.cancelsTouchesInView = NO; // Allow other touches to pass through
  [self.view addGestureRecognizer:tapGesture];

  [self loadImages];

  // Start polling for updates (only for generating images)
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
  self.manager.imageStudioModalPresented = NO;
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

- (void)setupHeader {
  // Header view with title and Clear All button
  self.headerView = [[UIView alloc] init];
  self.headerView.translatesAutoresizingMaskIntoConstraints = NO;
  self.headerView.backgroundColor = [UIColor clearColor];
  [self.view addSubview:self.headerView];

  // Title label
  UILabel *titleLabel = [[UILabel alloc] init];
  titleLabel.translatesAutoresizingMaskIntoConstraints = NO;
  titleLabel.text = @"Image Studio";
  titleLabel.textColor = [UIColor whiteColor];
  titleLabel.font = [UIFont systemFontOfSize:17 weight:UIFontWeightSemibold];
  [self.headerView addSubview:titleLabel];

  // Clear All button
  self.clearAllButton = [UIButton buttonWithType:UIButtonTypeSystem];
  self.clearAllButton.translatesAutoresizingMaskIntoConstraints = NO;
  [self.clearAllButton setTitle:@"Clear All" forState:UIControlStateNormal];
  self.clearAllButton.titleLabel.font = [UIFont systemFontOfSize:15 weight:UIFontWeightMedium];
  [self.clearAllButton setTitleColor:[UIColor colorWithRed:0.9 green:0.3 blue:0.3 alpha:1.0] forState:UIControlStateNormal];
  self.clearAllButton.accessibilityLabel = @"Clear all images";
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
  // Container for prompt input at bottom - with expandable height
  self.inputContainer = [[UIView alloc] init];
  self.inputContainer.translatesAutoresizingMaskIntoConstraints = NO;
  self.inputContainer.backgroundColor = [UIColor colorWithWhite:0.12 alpha:1.0];
  self.inputContainer.layer.cornerRadius = 24;
  self.inputContainer.layer.borderWidth = 1.0;
  self.inputContainer.layer.borderColor = [UIColor colorWithWhite:0.2 alpha:1.0].CGColor;
  [self.view addSubview:self.inputContainer];

  // Image type dropdown button using UIMenu (compact, like TopBar pattern)
  self.imageTypeButton = [UIButton buttonWithType:UIButtonTypeSystem];
  self.imageTypeButton.translatesAutoresizingMaskIntoConstraints = NO;
  self.imageTypeButton.titleLabel.font = [UIFont systemFontOfSize:13 weight:UIFontWeightMedium];
  [self.imageTypeButton setTitleColor:[UIColor whiteColor] forState:UIControlStateNormal];
  self.imageTypeButton.backgroundColor = [UIColor colorWithWhite:0.22 alpha:1.0];
  self.imageTypeButton.layer.cornerRadius = 18;
  // Padding for proper sizing
  self.imageTypeButton.contentEdgeInsets = UIEdgeInsetsMake(8, 12, 8, 12);
  self.imageTypeButton.accessibilityLabel = @"Image type selector";
  self.imageTypeButton.accessibilityHint = @"Tap to change image type";
  [self.inputContainer addSubview:self.imageTypeButton];

  // Setup UIMenu for image type picker (native iOS menu, not dialog)
  [self setupImageTypeMenu];
  [self updateImageTypeButtonTitle];

  // Prompt text view (expandable, supports multiline)
  self.promptTextView = [[UITextView alloc] init];
  self.promptTextView.translatesAutoresizingMaskIntoConstraints = NO;
  self.promptTextView.backgroundColor = [UIColor clearColor];
  self.promptTextView.textColor = [UIColor whiteColor];
  self.promptTextView.font = [UIFont systemFontOfSize:17];
  self.promptTextView.delegate = self;
  self.promptTextView.scrollEnabled = YES; // Allow scrolling for long text
  // Vertical centering: minimal top/bottom insets, let constraints handle centering
  self.promptTextView.textContainerInset = UIEdgeInsetsMake(0, 0, 0, 0);
  self.promptTextView.textContainer.lineFragmentPadding = 0;
  self.promptTextView.contentInset = UIEdgeInsetsZero;
  [self.inputContainer addSubview:self.promptTextView];

  // Placeholder label (shown when text view is empty) - centered
  UILabel *placeholderLabel = [[UILabel alloc] init];
  placeholderLabel.translatesAutoresizingMaskIntoConstraints = NO;
  placeholderLabel.text = @"Describe your image...";
  placeholderLabel.textColor = [UIColor colorWithWhite:0.45 alpha:1.0];
  placeholderLabel.font = [UIFont systemFontOfSize:17];
  placeholderLabel.textAlignment = NSTextAlignmentCenter;
  placeholderLabel.tag = 999; // Tag for finding later
  [self.promptTextView addSubview:placeholderLabel];

  [NSLayoutConstraint activateConstraints:@[
    [placeholderLabel.centerXAnchor constraintEqualToAnchor:self.promptTextView.centerXAnchor],
    [placeholderLabel.centerYAnchor constraintEqualToAnchor:self.promptTextView.centerYAnchor]
  ]];

  // Send button (hidden when no text)
  self.sendButton = [UIButton buttonWithType:UIButtonTypeSystem];
  self.sendButton.translatesAutoresizingMaskIntoConstraints = NO;
  UIImageSymbolConfiguration *sendConfig = [UIImageSymbolConfiguration configurationWithPointSize:18 weight:UIImageSymbolWeightSemibold];
  [self.sendButton setImage:[UIImage systemImageNamed:@"arrow.up.circle.fill" withConfiguration:sendConfig] forState:UIControlStateNormal];
  self.sendButton.tintColor = [UIColor whiteColor];
  self.sendButton.backgroundColor = [UIColor colorWithRed:0.3 green:0.5 blue:0.9 alpha:1.0];
  self.sendButton.layer.cornerRadius = 18;
  self.sendButton.accessibilityLabel = @"Generate image";
  self.sendButton.alpha = 0; // Hidden initially
  [self.sendButton addTarget:self action:@selector(generateImage) forControlEvents:UIControlEventTouchUpInside];
  [self.inputContainer addSubview:self.sendButton];

  // Microphone button - HIG compliant (44x44pt minimum touch target)
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

  // Loading indicator (hidden by default)
  self.loadingIndicator = [[UIActivityIndicatorView alloc] initWithActivityIndicatorStyle:UIActivityIndicatorViewStyleMedium];
  self.loadingIndicator.translatesAutoresizingMaskIntoConstraints = NO;
  self.loadingIndicator.hidesWhenStopped = YES;
  self.loadingIndicator.color = [UIColor whiteColor];
  [self.inputContainer addSubview:self.loadingIndicator];

  [NSLayoutConstraint activateConstraints:@[
    // Image type button on left - vertically centered, matching mic button height
    [self.imageTypeButton.leadingAnchor constraintEqualToAnchor:self.inputContainer.leadingAnchor constant:10],
    [self.imageTypeButton.centerYAnchor constraintEqualToAnchor:self.micButton.centerYAnchor],
    [self.imageTypeButton.heightAnchor constraintEqualToConstant:36],

    // Prompt text view fills the middle
    [self.promptTextView.leadingAnchor constraintEqualToAnchor:self.imageTypeButton.trailingAnchor constant:10],
    [self.promptTextView.trailingAnchor constraintEqualToAnchor:self.micButton.leadingAnchor constant:-8],
    [self.promptTextView.centerYAnchor constraintEqualToAnchor:self.inputContainer.centerYAnchor],
    [self.promptTextView.heightAnchor constraintGreaterThanOrEqualToConstant:36],

    // Mic button on right - 36x36 visual, 44x44 touch target
    [self.micButton.trailingAnchor constraintEqualToAnchor:self.inputContainer.trailingAnchor constant:-10],
    [self.micButton.bottomAnchor constraintEqualToAnchor:self.inputContainer.bottomAnchor constant:-10],
    [self.micButton.widthAnchor constraintEqualToConstant:36],
    [self.micButton.heightAnchor constraintEqualToConstant:36],

    // Send button (overlays mic when text present)
    [self.sendButton.trailingAnchor constraintEqualToAnchor:self.inputContainer.trailingAnchor constant:-10],
    [self.sendButton.bottomAnchor constraintEqualToAnchor:self.inputContainer.bottomAnchor constant:-10],
    [self.sendButton.widthAnchor constraintEqualToConstant:36],
    [self.sendButton.heightAnchor constraintEqualToConstant:36],

    // Loading indicator centered on send button
    [self.loadingIndicator.centerXAnchor constraintEqualToAnchor:self.sendButton.centerXAnchor],
    [self.loadingIndicator.centerYAnchor constraintEqualToAnchor:self.sendButton.centerYAnchor]
  ]];
}

// Setup UIMenu for native iOS image type picker (like TopBar pattern)
- (void)setupImageTypeMenu {
  if (@available(iOS 14.0, *)) {
    __weak typeof(self) weakSelf = self;

    UIAction *iconAction = [UIAction actionWithTitle:@"Icon"
                                               image:[UIImage systemImageNamed:@"app.badge.fill"]
                                          identifier:nil
                                             handler:^(__kindof UIAction *action) {
                                               weakSelf.selectedImageType = EXImageTypeIcon;
                                               [weakSelf updateImageTypeButtonTitle];
                                             }];

    UIAction *imageAction = [UIAction actionWithTitle:@"Image"
                                                image:[UIImage systemImageNamed:@"photo.artframe"]
                                           identifier:nil
                                              handler:^(__kindof UIAction *action) {
                                                weakSelf.selectedImageType = EXImageTypeImage;
                                                [weakSelf updateImageTypeButtonTitle];
                                              }];

    UIAction *backgroundAction = [UIAction actionWithTitle:@"Background"
                                                     image:[UIImage systemImageNamed:@"square.stack.3d.up.fill"]
                                                identifier:nil
                                                   handler:^(__kindof UIAction *action) {
                                                     weakSelf.selectedImageType = EXImageTypeBackground;
                                                     [weakSelf updateImageTypeButtonTitle];
                                                   }];

    UIAction *logoAction = [UIAction actionWithTitle:@"Logo"
                                               image:[UIImage systemImageNamed:@"seal.fill"]
                                          identifier:nil
                                             handler:^(__kindof UIAction *action) {
                                               weakSelf.selectedImageType = EXImageTypeLogo;
                                               [weakSelf updateImageTypeButtonTitle];
                                             }];

    UIMenu *menu = [UIMenu menuWithTitle:@"" children:@[iconAction, imageAction, backgroundAction, logoAction]];

    // iOS 16+: Force large element size to ensure vertical (stacked) layout
    if (@available(iOS 16.0, *)) {
      menu.preferredElementSize = UIMenuElementSizeLarge;
    }

    self.imageTypeButton.menu = menu;
    self.imageTypeButton.showsMenuAsPrimaryAction = YES;
  }
}

- (void)setupBottomActionButton {
  // Container for "Add to prompt" button and selection count
  self.bottomActionContainer = [[UIView alloc] init];
  self.bottomActionContainer.translatesAutoresizingMaskIntoConstraints = NO;
  self.bottomActionContainer.alpha = 0; // Hidden initially
  [self.view addSubview:self.bottomActionContainer];

  // Add to prompt button - HIG compliant
  self.addToPromptButton = [UIButton buttonWithType:UIButtonTypeSystem];
  self.addToPromptButton.translatesAutoresizingMaskIntoConstraints = NO;
  [self.addToPromptButton setTitle:@"Add to prompt" forState:UIControlStateNormal];
  self.addToPromptButton.titleLabel.font = [UIFont preferredFontForTextStyle:UIFontTextStyleHeadline];
  self.addToPromptButton.titleLabel.adjustsFontForContentSizeCategory = YES;
  [self.addToPromptButton setTitleColor:[UIColor blackColor] forState:UIControlStateNormal];
  self.addToPromptButton.backgroundColor = [UIColor whiteColor];
  self.addToPromptButton.layer.cornerRadius = 26;
  self.addToPromptButton.accessibilityLabel = @"Add selected images to prompt";
  [self.addToPromptButton addTarget:self action:@selector(addSelectedToPrompt) forControlEvents:UIControlEventTouchUpInside];
  [self.bottomActionContainer addSubview:self.addToPromptButton];

  // Selection count label - supports Dynamic Type
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
  // VERTICAL grid layout (not horizontal scroll)
  layout.scrollDirection = UICollectionViewScrollDirectionVertical;
  layout.minimumInteritemSpacing = 12;
  layout.minimumLineSpacing = 12;
  layout.sectionInset = UIEdgeInsetsMake(20, 20, 20, 20);

  self.imageCollectionView = [[UICollectionView alloc] initWithFrame:CGRectZero collectionViewLayout:layout];
  self.imageCollectionView.translatesAutoresizingMaskIntoConstraints = NO;
  self.imageCollectionView.backgroundColor = [UIColor clearColor];
  self.imageCollectionView.dataSource = self;
  self.imageCollectionView.delegate = self;
  self.imageCollectionView.showsHorizontalScrollIndicator = NO;
  self.imageCollectionView.showsVerticalScrollIndicator = YES;
  self.imageCollectionView.alwaysBounceVertical = YES;
  self.imageCollectionView.clipsToBounds = NO;
  [self.imageCollectionView registerClass:[EXImageStudioCell class] forCellWithReuseIdentifier:@"ImageCell"];
  [self.imageCollectionView registerClass:[EXImageStudioAddCell class] forCellWithReuseIdentifier:@"AddCell"];
  [self.view addSubview:self.imageCollectionView];
}

- (void)setupEmptyState {
  self.emptyStateLabel = [[UILabel alloc] init];
  self.emptyStateLabel.text = @"No images yet.\nGenerate or upload your first image!";
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
  // Fixed height for input container (expandable via textViewDidChange)
  self.inputContainerHeightConstraint = [self.inputContainer.heightAnchor constraintEqualToConstant:56];

  [NSLayoutConstraint activateConstraints:@[
    // Collection view fills most of the screen (vertical grid) - below header
    [self.imageCollectionView.topAnchor constraintEqualToAnchor:self.headerView.bottomAnchor],
    [self.imageCollectionView.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor],
    [self.imageCollectionView.trailingAnchor constraintEqualToAnchor:self.view.trailingAnchor],
    [self.imageCollectionView.bottomAnchor constraintEqualToAnchor:self.inputContainer.topAnchor constant:-12],

    // Input container at bottom (expandable)
    [self.inputContainer.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor constant:20],
    [self.inputContainer.trailingAnchor constraintEqualToAnchor:self.view.trailingAnchor constant:-20],
    self.inputContainerBottomConstraint,
    self.inputContainerHeightConstraint,

    // Bottom action container (Add to prompt button)
    [self.bottomActionContainer.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor],
    [self.bottomActionContainer.trailingAnchor constraintEqualToAnchor:self.view.trailingAnchor],
    self.bottomActionBottomConstraint,

    // Empty state centered
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
  // Also move the "Add to prompt" button above keyboard when visible
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
  // Also reset the "Add to prompt" button position
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
  self.manager.imageStudioModalPresented = NO;
  [self dismissViewControllerAnimated:YES completion:nil];
}

- (void)confirmClearAll {
  if (self.images.count == 0) {
    return;
  }

  UIAlertController *alert = [UIAlertController alertControllerWithTitle:@"Clear All Images"
                                                                 message:@"Are you sure you want to delete all images? This cannot be undone."
                                                          preferredStyle:UIAlertControllerStyleAlert];

  [alert addAction:[UIAlertAction actionWithTitle:@"Cancel" style:UIAlertActionStyleCancel handler:nil]];

  __weak typeof(self) weakSelf = self;
  [alert addAction:[UIAlertAction actionWithTitle:@"Delete All" style:UIAlertActionStyleDestructive handler:^(UIAlertAction *action) {
    [weakSelf clearAllImages];
  }]];

  [self presentViewController:alert animated:YES completion:nil];
}

- (void)clearAllImages {
  // Delete all images from backend
  NSArray *imagesToDelete = [self.images copy];

  if (imagesToDelete.count == 0) {
    return;
  }

  UIAlertController *loadingAlert = [UIAlertController alertControllerWithTitle:nil message:@"Deleting..." preferredStyle:UIAlertControllerStyleAlert];
  [self presentViewController:loadingAlert animated:YES completion:nil];

  __block NSInteger deletedCount = 0;
  NSInteger totalCount = imagesToDelete.count;

  for (NSDictionary *imageData in imagesToDelete) {
    NSString *imageId = imageData[@"_id"];
    if (!imageId) {
      deletedCount++;
      continue;
    }

    NSString *deleteURL = [NSString stringWithFormat:@"%@/api/images/delete", [EXEnvBridge v0ApiUrl]];

    NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:[NSURL URLWithString:deleteURL]];
    request.HTTPMethod = @"POST";
    [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];

    NSDictionary *body = @{@"id": imageId};
    request.HTTPBody = [NSJSONSerialization dataWithJSONObject:body options:0 error:nil];

    __weak typeof(self) weakSelf = self;

    NSURLSessionDataTask *task = [[NSURLSession sharedSession] dataTaskWithRequest:request completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
      dispatch_async(dispatch_get_main_queue(), ^{
        deletedCount++;

        if (deletedCount >= totalCount) {
          [loadingAlert dismissViewControllerAnimated:YES completion:^{
            __strong typeof(weakSelf) strongSelf = weakSelf;
            if (!strongSelf) return;

            [strongSelf.images removeAllObjects];
            [strongSelf.selectedImageIds removeAllObjects];
            [strongSelf.imageCollectionView reloadData];
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

- (void)updateImageTypeButtonTitle {
  NSString *title;
  switch (self.selectedImageType) {
    case EXImageTypeIcon:
      title = @"Icon";
      break;
    case EXImageTypeImage:
      title = @"Image";
      break;
    case EXImageTypeBackground:
      title = @"Bg";
      break;
    case EXImageTypeLogo:
      title = @"Logo";
      break;
  }
  // Compact title with chevron
  [self.imageTypeButton setTitle:[NSString stringWithFormat:@"%@ ▾", title] forState:UIControlStateNormal];
}

#pragma mark - UITextViewDelegate

- (void)textViewDidChange:(UITextView *)textView {
  // Update placeholder visibility
  UILabel *placeholder = [textView viewWithTag:999];
  placeholder.hidden = textView.text.length > 0;

  // Show/hide send button based on text content
  BOOL hasText = textView.text.length > 0;
  [UIView animateWithDuration:0.2 animations:^{
    self.sendButton.alpha = hasText ? 1.0 : 0.0;
    self.micButton.alpha = hasText ? 0.0 : 1.0;
  }];

  // Calculate new height based on text content (max 120pt for ~4 lines)
  CGSize sizeThatFits = [textView sizeThatFits:CGSizeMake(textView.frame.size.width, CGFLOAT_MAX)];
  CGFloat newHeight = MAX(56, MIN(120, sizeThatFits.height + 16)); // 16pt padding

  if (self.inputContainerHeightConstraint.constant != newHeight) {
    self.inputContainerHeightConstraint.constant = newHeight;
    [UIView animateWithDuration:0.15 animations:^{
      [self.view layoutIfNeeded];
    }];
  }
}

- (void)startVoiceInput {
  // Check if already recording or transcribing
  if (self.isRecording || self.isTranscribing) {
    [self stopVoiceRecording];
    return;
  }

  // Check microphone permission
  AVAudioSession *audioSession = [AVAudioSession sharedInstance];
  AVAudioSessionRecordPermission permission = [audioSession recordPermission];

  if (permission == AVAudioSessionRecordPermissionDenied) {
    [self showMicrophonePermissionAlert];
    return;
  }

  __weak typeof(self) weakSelf = self;

  // Start recording with metering callback
  [[EXAudioRecorderService sharedInstance]
      startRecordingWithMeteringCallback:^(float level) {
        dispatch_async(dispatch_get_main_queue(), ^{
          [weakSelf updateWaveformWithLevel:level];
        });
      }
      completion:^(NSError * _Nullable error) {
        dispatch_async(dispatch_get_main_queue(), ^{
          if (error) {
            NSLog(@"❌ [ImageStudio] Recording failed to start: %@", error);
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

  NSLog(@"🎤 [ImageStudio] Stopping voice recording");

  self.isRecording = NO;

  // Show transcribing state
  self.isTranscribing = YES;
  [self showTranscribingUI];

  __weak typeof(self) weakSelf = self;

  // Stop recording and get audio file
  [[EXAudioRecorderService sharedInstance]
      stopRecordingWithCompletion:^(NSURL * _Nullable audioURL, NSError * _Nullable error) {
        if (error || !audioURL) {
          NSLog(@"❌ [ImageStudio] Recording stop failed: %@", error);
          dispatch_async(dispatch_get_main_queue(), ^{
            weakSelf.isTranscribing = NO;
            [weakSelf hideRecordingUI];
          });
          return;
        }

        NSLog(@"✅ [ImageStudio] Recording saved: %@", audioURL);

        // Transcribe the audio
        [[EXAssemblyAIService sharedInstance]
            transcribeAudioFile:audioURL
            completion:^(NSString * _Nullable transcribedText, NSError * _Nullable transcribeError) {
              dispatch_async(dispatch_get_main_queue(), ^{
                weakSelf.isTranscribing = NO;
                [weakSelf hideRecordingUI];

                if (transcribeError) {
                  NSLog(@"❌ [ImageStudio] Transcription failed: %@", transcribeError);
                  return;
                }

                if (transcribedText && transcribedText.length > 0) {
                  NSLog(@"✅ [ImageStudio] Transcription: %@", transcribedText);
                  // Insert transcribed text into prompt field
                  NSString *currentText = weakSelf.promptTextView.text ?: @"";
                  if (currentText.length > 0 && ![currentText hasSuffix:@" "]) {
                    currentText = [currentText stringByAppendingString:@" "];
                  }
                  weakSelf.promptTextView.text = [currentText stringByAppendingString:transcribedText];

                  // Update placeholder and send button
                  [weakSelf textViewDidChange:weakSelf.promptTextView];

                  // Haptic success feedback
                  UINotificationFeedbackGenerator *feedback = [[UINotificationFeedbackGenerator alloc] init];
                  [feedback notificationOccurred:UINotificationFeedbackTypeSuccess];
                }

                // Clean up audio file
                [[NSFileManager defaultManager] removeItemAtURL:audioURL error:nil];
              });
            }];
      }];
}

- (void)showRecordingUI {
  // Update mic button appearance
  self.micButton.backgroundColor = [UIColor colorWithRed:0.9 green:0.3 blue:0.3 alpha:1.0];
  UIImageSymbolConfiguration *micConfig = [UIImageSymbolConfiguration configurationWithPointSize:20 weight:UIImageSymbolWeightMedium];
  [self.micButton setImage:[UIImage systemImageNamed:@"stop.fill" withConfiguration:micConfig] forState:UIControlStateNormal];
  self.micButton.alpha = 1.0;

  // Create recording overlay on input container
  if (!self.recordingOverlay) {
    self.recordingOverlay = [[UIView alloc] init];
    self.recordingOverlay.translatesAutoresizingMaskIntoConstraints = NO;
    self.recordingOverlay.backgroundColor = [UIColor colorWithRed:0.15 green:0.15 blue:0.18 alpha:0.98];
    self.recordingOverlay.layer.cornerRadius = 20;
    [self.inputContainer addSubview:self.recordingOverlay];

    // Recording indicator (pulsing red dot)
    UIView *redDot = [[UIView alloc] init];
    redDot.translatesAutoresizingMaskIntoConstraints = NO;
    redDot.backgroundColor = [UIColor colorWithRed:0.9 green:0.3 blue:0.3 alpha:1.0];
    redDot.layer.cornerRadius = 5;
    redDot.tag = 100;
    [self.recordingOverlay addSubview:redDot];

    // Recording label
    self.recordingLabel = [[UILabel alloc] init];
    self.recordingLabel.translatesAutoresizingMaskIntoConstraints = NO;
    self.recordingLabel.text = @"Recording...";
    self.recordingLabel.textColor = [UIColor whiteColor];
    self.recordingLabel.font = [UIFont systemFontOfSize:14 weight:UIFontWeightMedium];
    [self.recordingOverlay addSubview:self.recordingLabel];

    // Proper waveform view (like BottomBar)
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
  self.imageTypeButton.hidden = YES;
  self.sendButton.hidden = YES;

  // Start waveform animation
  [self.waveformView startAnimating];

  // Animate in
  [UIView animateWithDuration:0.2 animations:^{
    self.recordingOverlay.alpha = 1;
  }];

  // Pulse animation for red dot
  UIView *redDot = [self.recordingOverlay viewWithTag:100];
  [UIView animateWithDuration:0.5 delay:0 options:UIViewAnimationOptionRepeat | UIViewAnimationOptionAutoreverse animations:^{
    redDot.alpha = 0.3;
  } completion:nil];
}

- (void)showTranscribingUI {
  self.recordingLabel.text = @"Transcribing...";

  // Stop waveform animation and show blue color
  [self.waveformView stopAnimating];
  self.waveformView.barColor = [UIColor colorWithRed:0.3 green:0.6 blue:0.9 alpha:1.0];
  [self.waveformView reset];

  // Stop pulsing and show solid blue
  UIView *redDot = [self.recordingOverlay viewWithTag:100];
  [redDot.layer removeAllAnimations];
  redDot.alpha = 1.0;
  redDot.backgroundColor = [UIColor colorWithRed:0.3 green:0.6 blue:0.9 alpha:1.0];
}

- (void)hideRecordingUI {
  // Reset mic button
  self.micButton.backgroundColor = [UIColor colorWithWhite:0.25 alpha:1.0];
  UIImageSymbolConfiguration *micConfig = [UIImageSymbolConfiguration configurationWithPointSize:20 weight:UIImageSymbolWeightMedium];
  [self.micButton setImage:[UIImage systemImageNamed:@"mic.fill" withConfiguration:micConfig] forState:UIControlStateNormal];

  // Stop waveform animation
  [self.waveformView stopAnimating];
  [self.waveformView reset];

  // Animate out
  [UIView animateWithDuration:0.2 animations:^{
    self.recordingOverlay.alpha = 0;
  } completion:^(BOOL finished) {
    self.recordingOverlay.hidden = YES;
    self.promptTextView.hidden = NO;
    self.imageTypeButton.hidden = NO;
    self.sendButton.hidden = NO;

    // Reset mic/send visibility based on text content
    BOOL hasText = self.promptTextView.text.length > 0;
    self.sendButton.alpha = hasText ? 1.0 : 0.0;
    self.micButton.alpha = hasText ? 0.0 : 1.0;

    // Reset recording label and colors
    self.recordingLabel.text = @"Recording...";
    UIView *redDot = [self.recordingOverlay viewWithTag:100];
    redDot.backgroundColor = [UIColor colorWithRed:0.9 green:0.3 blue:0.3 alpha:1.0];
    self.waveformView.barColor = [UIColor colorWithRed:0.9 green:0.3 blue:0.3 alpha:1.0];
  }];
}

- (void)updateWaveformWithLevel:(float)level {
  // Update the waveform view with the audio level (0.0 - 1.0)
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
  NSUInteger count = self.selectedImageIds.count;
  BOOL hasSelection = count > 0;

  // Update selection count label
  if (hasSelection) {
    self.selectionCountLabel.text = [NSString stringWithFormat:@"%lu selected", (unsigned long)count];
  }

  // Animate showing/hiding the Add to prompt button
  [UIView animateWithDuration:0.3 delay:0 usingSpringWithDamping:0.8 initialSpringVelocity:0.5 options:UIViewAnimationOptionCurveEaseInOut animations:^{
    self.bottomActionContainer.alpha = hasSelection ? 1 : 0;
    self.inputContainer.alpha = hasSelection ? 0 : 1;
  } completion:nil];

  // Reload collection view to update selection badges
  [self.imageCollectionView reloadData];
}

- (void)addSelectedToPrompt {
  // Simple: add image as attachment, sandbox upload happens at send time (like bottom bar)

  NSArray *selectedIds = [self.selectedImageIds copy];
  if (selectedIds.count == 0) {
    [self closeModal];
    return;
  }

  __block NSInteger processedCount = 0;
  NSInteger totalCount = selectedIds.count;

  for (NSString *imageId in selectedIds) {
    for (NSDictionary *imageData in self.images) {
      if ([imageData[@"_id"] isEqualToString:imageId]) {
        NSString *imageUrl = imageData[@"url"];
        NSString *imageName = imageData[@"name"] ?: [NSString stringWithFormat:@"image-%@", imageId];

        // Ensure filename has extension (required for upload)
        if (![imageName.lowercaseString hasSuffix:@".jpg"] &&
            ![imageName.lowercaseString hasSuffix:@".jpeg"] &&
            ![imageName.lowercaseString hasSuffix:@".png"]) {
          imageName = [imageName stringByAppendingString:@".jpg"];
        }

        if (!imageUrl) {
          processedCount++;
          if (processedCount >= totalCount) {
            [self.selectedImageIds removeAllObjects];
            [self closeModal];
          }
          continue;
        }

        __weak typeof(self) weakSelf = self;

        // Try cache first
        UIImage *cachedImage = [_imageCache objectForKey:imageUrl];

        if (cachedImage) {
          // Add directly as attachment - upload happens at send time
          [self.manager addImageAttachment:cachedImage fileName:imageName];
          processedCount++;
          if (processedCount >= totalCount) {
            [weakSelf.selectedImageIds removeAllObjects];
            [weakSelf closeModal];
          }
        } else {
          // Download image first, then add as attachment
          NSURL *url = [NSURL URLWithString:imageUrl];
          NSURLSessionDataTask *task = [[NSURLSession sharedSession] dataTaskWithURL:url completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
            dispatch_async(dispatch_get_main_queue(), ^{
              if (!error && data) {
                UIImage *downloadedImage = [UIImage imageWithData:data];
                if (downloadedImage) {
                  [weakSelf.manager addImageAttachment:downloadedImage fileName:imageName];
                }
              }
              processedCount++;
              if (processedCount >= totalCount) {
                [weakSelf.selectedImageIds removeAllObjects];
                [weakSelf closeModal];
              }
            });
          }];
          [task resume];
        }
        break;
      }
    }
  }
}

- (void)uploadFromDevice {
  if (@available(iOS 14.0, *)) {
    PHPickerConfiguration *config = [[PHPickerConfiguration alloc] init];
    config.selectionLimit = 0; // 0 means unlimited selection
    config.filter = [PHPickerFilter imagesFilter];

    PHPickerViewController *picker = [[PHPickerViewController alloc] initWithConfiguration:config];
    picker.delegate = self;
    [self presentViewController:picker animated:YES completion:nil];
  } else {
    UIImagePickerController *picker = [[UIImagePickerController alloc] init];
    picker.sourceType = UIImagePickerControllerSourceTypePhotoLibrary;
    picker.mediaTypes = @[@"public.image"];
    [self presentViewController:picker animated:YES completion:nil];
  }
}

- (void)picker:(PHPickerViewController *)picker didFinishPicking:(NSArray<PHPickerResult *> *)results API_AVAILABLE(ios(14.0)) {
  [picker dismissViewControllerAnimated:YES completion:nil];

  if (results.count == 0) return;

  // Process all selected images
  for (PHPickerResult *result in results) {
    if ([result.itemProvider canLoadObjectOfClass:[UIImage class]]) {
      __weak typeof(self) weakSelf = self;
      [result.itemProvider loadObjectOfClass:[UIImage class] completionHandler:^(id<NSItemProviderReading> object, NSError *error) {
        if ([object isKindOfClass:[UIImage class]]) {
          UIImage *image = (UIImage *)object;
          dispatch_async(dispatch_get_main_queue(), ^{
            [weakSelf uploadImageToConvex:image];
          });
        }
      }];
    }
  }
}

- (void)uploadImageToConvex:(UIImage *)image {
  NSString *clerkId = [[NSUserDefaults standardUserDefaults] stringForKey:@"CLERK_USER_ID"];
  if (!clerkId) {
    [self showError:@"Please sign in to upload images"];
    return;
  }

  // Show loading
  UIAlertController *loadingAlert = [UIAlertController alertControllerWithTitle:nil message:@"Uploading..." preferredStyle:UIAlertControllerStyleAlert];
  [self presentViewController:loadingAlert animated:YES completion:nil];

  // Convert image to data
  NSData *imageData = UIImagePNGRepresentation(image);
  if (!imageData) {
    [loadingAlert dismissViewControllerAnimated:YES completion:^{
      [self showError:@"Failed to process image"];
    }];
    return;
  }

  NSString *imageName = [NSString stringWithFormat:@"upload-%ld", (long)[[NSDate date] timeIntervalSince1970]];

  // Upload to backend
  NSString *uploadURL = [NSString stringWithFormat:@"%@/api/images/upload", [EXEnvBridge v0ApiUrl]];
  NSString *boundary = [[NSUUID UUID] UUIDString];

  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:[NSURL URLWithString:uploadURL]];
  request.HTTPMethod = @"POST";
  [request setValue:[NSString stringWithFormat:@"multipart/form-data; boundary=%@", boundary] forHTTPHeaderField:@"Content-Type"];

  NSMutableData *body = [NSMutableData data];

  // Add clerkId
  [body appendData:[[NSString stringWithFormat:@"--%@\r\n", boundary] dataUsingEncoding:NSUTF8StringEncoding]];
  [body appendData:[@"Content-Disposition: form-data; name=\"clerkId\"\r\n\r\n" dataUsingEncoding:NSUTF8StringEncoding]];
  [body appendData:[clerkId dataUsingEncoding:NSUTF8StringEncoding]];
  [body appendData:[@"\r\n" dataUsingEncoding:NSUTF8StringEncoding]];

  // Add name
  [body appendData:[[NSString stringWithFormat:@"--%@\r\n", boundary] dataUsingEncoding:NSUTF8StringEncoding]];
  [body appendData:[@"Content-Disposition: form-data; name=\"name\"\r\n\r\n" dataUsingEncoding:NSUTF8StringEncoding]];
  [body appendData:[imageName dataUsingEncoding:NSUTF8StringEncoding]];
  [body appendData:[@"\r\n" dataUsingEncoding:NSUTF8StringEncoding]];

  // Add file
  [body appendData:[[NSString stringWithFormat:@"--%@\r\n", boundary] dataUsingEncoding:NSUTF8StringEncoding]];
  [body appendData:[[NSString stringWithFormat:@"Content-Disposition: form-data; name=\"file\"; filename=\"%@.png\"\r\n", imageName] dataUsingEncoding:NSUTF8StringEncoding]];
  [body appendData:[@"Content-Type: image/png\r\n\r\n" dataUsingEncoding:NSUTF8StringEncoding]];
  [body appendData:imageData];
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
          [strongSelf showError:@"Failed to upload image"];
          return;
        }

        // Refresh images
        [strongSelf loadImages];
      }];
    });
  }];

  [task resume];
}

- (void)generateImage {
  NSString *rawPrompt = [self.promptTextView.text stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];

  if (rawPrompt.length == 0 && self.referenceImageIds.count == 0) {
    return;
  }

  // Parse @references from prompt and collect referenceImageIds
  NSMutableArray<NSString *> *collectedReferenceIds = [NSMutableArray arrayWithArray:self.referenceImageIds];
  NSString *cleanPrompt = rawPrompt;

  // Find all @name patterns in prompt
  NSError *regexError;
  NSRegularExpression *regex = [NSRegularExpression regularExpressionWithPattern:@"@([a-zA-Z0-9-_.]+)" options:0 error:&regexError];
  if (!regexError) {
    NSArray *matches = [regex matchesInString:rawPrompt options:0 range:NSMakeRange(0, rawPrompt.length)];

    for (NSTextCheckingResult *match in matches) {
      if (match.numberOfRanges >= 2) {
        NSRange nameRange = [match rangeAtIndex:1];
        NSString *imageName = [rawPrompt substringWithRange:nameRange];

        // Find the image with this name and get its ID
        for (NSDictionary *imageData in self.images) {
          NSString *name = imageData[@"name"];
          if ([name isEqualToString:imageName]) {
            NSString *imageId = imageData[@"_id"];
            if (imageId && ![collectedReferenceIds containsObject:imageId]) {
              [collectedReferenceIds addObject:imageId];
            }
            break;
          }
        }
      }
    }

    // Remove @references from prompt to get clean prompt
    cleanPrompt = [regex stringByReplacingMatchesInString:rawPrompt options:0 range:NSMakeRange(0, rawPrompt.length) withTemplate:@""];
    cleanPrompt = [cleanPrompt stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
  }

  // Don't block - allow multiple prompts while generating
  self.micButton.hidden = YES;
  [self.loadingIndicator startAnimating];

  NSString *clerkId = [[NSUserDefaults standardUserDefaults] stringForKey:@"CLERK_USER_ID"];

  if (!clerkId) {
    [self showError:@"Please sign in to generate images"];
    self.micButton.hidden = NO;
    [self.loadingIndicator stopAnimating];
    return;
  }

  // Get image type string for prompt enhancement
  NSString *imageTypeString;
  switch (self.selectedImageType) {
    case EXImageTypeIcon:
      imageTypeString = @"icon";
      break;
    case EXImageTypeImage:
      imageTypeString = @"image";
      break;
    case EXImageTypeBackground:
      imageTypeString = @"background";
      break;
    case EXImageTypeLogo:
      imageTypeString = @"logo";
      break;
  }

  // Create appropriate name based on whether editing or generating
  NSString *imageName;
  if (collectedReferenceIds.count > 0) {
    imageName = [NSString stringWithFormat:@"edit-%ld", (long)[[NSDate date] timeIntervalSince1970]];
  } else {
    imageName = [NSString stringWithFormat:@"%@-%ld", imageTypeString, (long)[[NSDate date] timeIntervalSince1970]];
  }

  NSString *startGenerationURL = [NSString stringWithFormat:@"%@/api/images/start-generation", [EXEnvBridge v0ApiUrl]];

  NSMutableURLRequest *startRequest = [NSMutableURLRequest requestWithURL:[NSURL URLWithString:startGenerationURL]];
  startRequest.HTTPMethod = @"POST";
  [startRequest setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];

  NSDictionary *startBody = @{
    @"clerkId": clerkId,
    @"name": imageName,
    @"prompt": cleanPrompt.length > 0 ? cleanPrompt : rawPrompt,
    @"imageType": imageTypeString
  };

  NSError *jsonError;
  startRequest.HTTPBody = [NSJSONSerialization dataWithJSONObject:startBody options:0 error:&jsonError];

  __weak typeof(self) weakSelf = self;
  NSArray<NSString *> *referenceIds = [collectedReferenceIds copy];

  NSURLSessionDataTask *startTask = [[NSURLSession sharedSession] dataTaskWithRequest:startRequest completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
    dispatch_async(dispatch_get_main_queue(), ^{
      __strong typeof(weakSelf) strongSelf = weakSelf;
      if (!strongSelf) return;

      // Re-enable immediately so user can send more prompts
      strongSelf.micButton.hidden = NO;
      strongSelf.micButton.alpha = 1.0;
      strongSelf.sendButton.alpha = 0.0;
      [strongSelf.loadingIndicator stopAnimating];
      strongSelf.promptTextView.text = @"";
      // Update placeholder visibility
      [strongSelf textViewDidChange:strongSelf.promptTextView];
      // Clear reference IDs after generating
      [strongSelf.referenceImageIds removeAllObjects];

      if (error) {
        [strongSelf showError:@"Failed to start image generation"];
        return;
      }

      NSError *parseError;
      NSDictionary *result = [NSJSONSerialization JSONObjectWithData:data options:0 error:&parseError];

      if (parseError || !result[@"imageId"]) {
        [strongSelf showError:@"Failed to create image record"];
        return;
      }

      NSString *imageId = result[@"imageId"];

      // Trigger with reference IDs for editing and include image type
      [strongSelf triggerBackgroundGeneration:imageId prompt:(cleanPrompt.length > 0 ? cleanPrompt : rawPrompt) referenceImageIds:referenceIds imageType:imageTypeString];

      // Refresh immediately to show generating placeholder
      [strongSelf loadImages];
    });
  }];

  [startTask resume];
}

- (void)triggerBackgroundGeneration:(NSString *)imageId prompt:(NSString *)prompt {
  [self triggerBackgroundGeneration:imageId prompt:prompt referenceImageIds:@[] imageType:@"image"];
}

- (void)triggerBackgroundGeneration:(NSString *)imageId prompt:(NSString *)prompt referenceImageIds:(NSArray<NSString *> *)referenceImageIds imageType:(NSString *)imageType {
  NSString *generateURL = [NSString stringWithFormat:@"%@/api/generate-image-bg", [EXEnvBridge v0ApiUrl]];

  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:[NSURL URLWithString:generateURL]];
  request.HTTPMethod = @"POST";
  [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];

  NSDictionary *body = @{
    @"imageId": imageId,
    @"prompt": prompt,
    @"referenceImageIds": referenceImageIds ?: @[],
    @"imageType": imageType ?: @"image"
  };

  NSError *jsonError;
  request.HTTPBody = [NSJSONSerialization dataWithJSONObject:body options:0 error:&jsonError];

  NSURLSessionDataTask *task = [[NSURLSession sharedSession] dataTaskWithRequest:request completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
    // Background generation triggered - polling will pick up the result
  }];

  [task resume];
}

- (void)pollForUpdates {
  // Only poll if there are generating images
  BOOL hasGeneratingImages = NO;
  for (NSDictionary *img in self.images) {
    if ([img[@"status"] isEqualToString:@"generating"]) {
      hasGeneratingImages = YES;
      break;
    }
  }

  if (hasGeneratingImages) {
    [self loadImages];
  }
}

- (void)loadImages {
  NSString *clerkId = [[NSUserDefaults standardUserDefaults] stringForKey:@"CLERK_USER_ID"];

  if (!clerkId) {
    return;
  }

  // ========================================================================
  // INSTANT LOAD FROM CACHE FIRST
  // Load cached images immediately so modal opens instantly
  // ========================================================================
  EXChatMessageCache *cache = [EXChatMessageCache sharedInstance];
  NSString *cacheSessionId = [NSString stringWithFormat:@"image_studio_%@", clerkId];
  NSArray *cachedImages = [cache cachedImagesForSession:cacheSessionId];
  if (cachedImages.count > 0 && self.images.count == 0) {
    NSLog(@"⚡️ Loaded %lu images from cache instantly", (unsigned long)cachedImages.count);
    [self.images removeAllObjects];
    [self.images addObjectsFromArray:cachedImages];
    [self.imageCollectionView reloadData];
    self.emptyStateLabel.hidden = self.images.count > 0;

    // Compute initial hash - use this to avoid reloading same data from server
    self.lastImagesHash = [self computeImagesHash:cachedImages];
  }

  // ========================================================================
  // FETCH FRESH IMAGES IN BACKGROUND
  // Then fetch from server and update ONLY if there are actual changes
  // ========================================================================
  NSString *imagesURL = [NSString stringWithFormat:@"%@/api/images/list?clerkId=%@", [EXEnvBridge v0ApiUrl], clerkId];

  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:[NSURL URLWithString:imagesURL]];
  request.HTTPMethod = @"GET";

  // Add cache control to reduce unnecessary network requests
  [request setCachePolicy:NSURLRequestReloadIgnoringLocalCacheData];

  __weak typeof(self) weakSelf = self;

  NSURLSessionDataTask *task = [[NSURLSession sharedSession] dataTaskWithRequest:request completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
    dispatch_async(dispatch_get_main_queue(), ^{
      __strong typeof(weakSelf) strongSelf = weakSelf;
      if (!strongSelf) return;

      if (error || !data) {
        // If we have cached data, don't show error - just use cache
        return;
      }

      NSError *parseError;
      NSDictionary *result = [NSJSONSerialization JSONObjectWithData:data options:0 error:&parseError];

      if (parseError) {
        return;
      }

      NSArray *imagesArray = result[@"images"];
      if (imagesArray && [imagesArray isKindOfClass:[NSArray class]]) {
        // Compute hash to check if data actually changed
        NSString *newHash = [strongSelf computeImagesHash:imagesArray];

        // Skip update if data hasn't changed (prevents flickering/reordering)
        if ([newHash isEqualToString:strongSelf.lastImagesHash]) {
          return;
        }

        // Save to cache for next time
        [cache cacheImages:imagesArray forSession:cacheSessionId];
        strongSelf.lastImagesHash = newHash;

        // Smart update - only update changed items
        NSMutableSet *changedIndexes = [NSMutableSet set];

        // Check for additions or changes
        BOOL needsFullReload = (imagesArray.count != strongSelf.images.count);

        if (!needsFullReload) {
          for (NSUInteger i = 0; i < imagesArray.count; i++) {
            NSDictionary *newImage = imagesArray[i];
            NSDictionary *oldImage = strongSelf.images[i];

            // Compare by ID first
            if (![newImage[@"_id"] isEqual:oldImage[@"_id"]]) {
              needsFullReload = YES;
              break;
            }

            BOOL statusChanged = ![newImage[@"status"] isEqual:oldImage[@"status"]];
            BOOL urlChanged = ![newImage[@"url"] isEqual:oldImage[@"url"]];

            if (statusChanged || urlChanged) {
              [changedIndexes addObject:@(i)];
            }
          }
        }

        if (needsFullReload) {
          [strongSelf.images removeAllObjects];
          [strongSelf.images addObjectsFromArray:imagesArray];
          [strongSelf.imageCollectionView reloadData];
        } else if (changedIndexes.count > 0) {
          // Update only changed items
          for (NSNumber *indexNum in changedIndexes) {
            NSUInteger index = [indexNum unsignedIntegerValue];
            strongSelf.images[index] = imagesArray[index];
          }

          NSMutableArray *indexPaths = [NSMutableArray array];
          for (NSNumber *indexNum in changedIndexes) {
            // +1 because index 0 is the AddCell
            [indexPaths addObject:[NSIndexPath indexPathForItem:[indexNum integerValue] + 1 inSection:0]];
          }
          [strongSelf.imageCollectionView reloadItemsAtIndexPaths:indexPaths];
        }

        strongSelf.emptyStateLabel.hidden = strongSelf.images.count > 0;
      }
    });
  }];

  [task resume];
}

// Helper method to compute a hash of images array for change detection
- (NSString *)computeImagesHash:(NSArray *)imagesArray {
  NSMutableString *hashInput = [NSMutableString string];
  for (NSDictionary *image in imagesArray) {
    [hashInput appendFormat:@"%@:%@:%@;",
     image[@"_id"] ?: @"",
     image[@"status"] ?: @"",
     image[@"url"] ?: @""];
  }
  return hashInput;
}

- (void)deleteImage:(NSString *)imageId atIndex:(NSInteger)index {
  NSString *deleteURL = [NSString stringWithFormat:@"%@/api/images/delete", [EXEnvBridge v0ApiUrl]];

  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:[NSURL URLWithString:deleteURL]];
  request.HTTPMethod = @"POST";
  [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];

  NSDictionary *body = @{@"id": imageId};
  request.HTTPBody = [NSJSONSerialization dataWithJSONObject:body options:0 error:nil];

  __weak typeof(self) weakSelf = self;

  NSURLSessionDataTask *task = [[NSURLSession sharedSession] dataTaskWithRequest:request completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
    dispatch_async(dispatch_get_main_queue(), ^{
      __strong typeof(weakSelf) strongSelf = weakSelf;
      if (!strongSelf) return;

      if (!error && index < strongSelf.images.count) {
        // Clear from cache
        NSDictionary *imageData = strongSelf.images[index];
        NSString *imageUrl = imageData[@"url"];
        if (imageUrl) {
          [_imageCache removeObjectForKey:imageUrl];
        }

        [strongSelf.images removeObjectAtIndex:index];
        [strongSelf.imageCollectionView deleteItemsAtIndexPaths:@[[NSIndexPath indexPathForItem:index inSection:0]]];
        strongSelf.emptyStateLabel.hidden = strongSelf.images.count > 0;
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

#pragma mark - Image Actions

- (void)openImageFullscreen:(NSInteger)index {
  if (index >= self.images.count) return;

  NSDictionary *imageData = self.images[index];
  NSString *imageUrl = imageData[@"url"];
  NSString *imageName = imageData[@"name"] ?: @"Image";

  if (!imageUrl) return;

  // Get cached image or load
  UIImage *cachedImage = [_imageCache objectForKey:imageUrl];

  UIViewController *fullscreenVC = [[UIViewController alloc] init];
  fullscreenVC.view.backgroundColor = [UIColor blackColor];
  fullscreenVC.modalPresentationStyle = UIModalPresentationFullScreen;

  UIScrollView *scrollView = [[UIScrollView alloc] initWithFrame:fullscreenVC.view.bounds];
  scrollView.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
  scrollView.minimumZoomScale = 1.0;
  scrollView.maximumZoomScale = 4.0;
  scrollView.showsHorizontalScrollIndicator = NO;
  scrollView.showsVerticalScrollIndicator = NO;
  [fullscreenVC.view addSubview:scrollView];

  UIImageView *imageView = [[UIImageView alloc] initWithFrame:scrollView.bounds];
  imageView.contentMode = UIViewContentModeScaleAspectFit;
  imageView.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
  imageView.tag = 100;
  [scrollView addSubview:imageView];

  if (cachedImage) {
    imageView.image = cachedImage;
  } else {
    UIActivityIndicatorView *spinner = [[UIActivityIndicatorView alloc] initWithActivityIndicatorStyle:UIActivityIndicatorViewStyleLarge];
    spinner.center = imageView.center;
    spinner.autoresizingMask = UIViewAutoresizingFlexibleLeftMargin | UIViewAutoresizingFlexibleRightMargin | UIViewAutoresizingFlexibleTopMargin | UIViewAutoresizingFlexibleBottomMargin;
    [imageView addSubview:spinner];
    [spinner startAnimating];

    NSURL *url = [NSURL URLWithString:imageUrl];
    NSURLSessionDataTask *task = [[NSURLSession sharedSession] dataTaskWithURL:url completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
      dispatch_async(dispatch_get_main_queue(), ^{
        [spinner removeFromSuperview];
        if (data && !error) {
          UIImage *image = [UIImage imageWithData:data];
          imageView.image = image;
          [_imageCache setObject:image forKey:imageUrl];
        }
      });
    }];
    [task resume];
  }

  // Close button
  UIButton *closeBtn = [UIButton buttonWithType:UIButtonTypeSystem];
  closeBtn.translatesAutoresizingMaskIntoConstraints = NO;
  UIImageSymbolConfiguration *config = [UIImageSymbolConfiguration configurationWithPointSize:24 weight:UIImageSymbolWeightMedium];
  [closeBtn setImage:[UIImage systemImageNamed:@"xmark.circle.fill" withConfiguration:config] forState:UIControlStateNormal];
  closeBtn.tintColor = [UIColor whiteColor];
  [closeBtn addTarget:self action:@selector(dismissFullscreenImage) forControlEvents:UIControlEventTouchUpInside];
  [fullscreenVC.view addSubview:closeBtn];

  // Save button
  UIButton *saveBtn = [UIButton buttonWithType:UIButtonTypeSystem];
  saveBtn.translatesAutoresizingMaskIntoConstraints = NO;
  [saveBtn setImage:[UIImage systemImageNamed:@"square.and.arrow.down" withConfiguration:config] forState:UIControlStateNormal];
  saveBtn.tintColor = [UIColor whiteColor];
  saveBtn.tag = index;
  [saveBtn addTarget:self action:@selector(saveImageToPhotos:) forControlEvents:UIControlEventTouchUpInside];
  [fullscreenVC.view addSubview:saveBtn];

  // Title label
  UILabel *titleLbl = [[UILabel alloc] init];
  titleLbl.translatesAutoresizingMaskIntoConstraints = NO;
  titleLbl.text = imageName;
  titleLbl.textColor = [UIColor whiteColor];
  titleLbl.font = [UIFont systemFontOfSize:16 weight:UIFontWeightSemibold];
  [fullscreenVC.view addSubview:titleLbl];

  [NSLayoutConstraint activateConstraints:@[
    [closeBtn.topAnchor constraintEqualToAnchor:fullscreenVC.view.safeAreaLayoutGuide.topAnchor constant:16],
    [closeBtn.leadingAnchor constraintEqualToAnchor:fullscreenVC.view.leadingAnchor constant:16],
    [closeBtn.widthAnchor constraintEqualToConstant:44],
    [closeBtn.heightAnchor constraintEqualToConstant:44],

    [saveBtn.topAnchor constraintEqualToAnchor:fullscreenVC.view.safeAreaLayoutGuide.topAnchor constant:16],
    [saveBtn.trailingAnchor constraintEqualToAnchor:fullscreenVC.view.trailingAnchor constant:-16],
    [saveBtn.widthAnchor constraintEqualToConstant:44],
    [saveBtn.heightAnchor constraintEqualToConstant:44],

    [titleLbl.centerXAnchor constraintEqualToAnchor:fullscreenVC.view.centerXAnchor],
    [titleLbl.centerYAnchor constraintEqualToAnchor:closeBtn.centerYAnchor]
  ]];

  [self presentViewController:fullscreenVC animated:YES completion:nil];
}

- (void)dismissFullscreenImage {
  [self dismissViewControllerAnimated:YES completion:nil];
}

- (void)saveImageToPhotos:(UIButton *)sender {
  NSInteger index = sender.tag;
  if (index >= self.images.count) return;

  NSDictionary *imageData = self.images[index];
  NSString *imageUrl = imageData[@"url"];

  if (!imageUrl) return;

  UIImage *cachedImage = [_imageCache objectForKey:imageUrl];

  if (cachedImage) {
    UIImageWriteToSavedPhotosAlbum(cachedImage, self, @selector(image:didFinishSavingWithError:contextInfo:), NULL);
  } else {
    // Download and save
    NSURL *url = [NSURL URLWithString:imageUrl];
    __weak typeof(self) weakSelf = self;
    NSURLSessionDataTask *task = [[NSURLSession sharedSession] dataTaskWithURL:url completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
      dispatch_async(dispatch_get_main_queue(), ^{
        if (data && !error) {
          UIImage *image = [UIImage imageWithData:data];
          UIImageWriteToSavedPhotosAlbum(image, weakSelf, @selector(image:didFinishSavingWithError:contextInfo:), NULL);
        } else {
          [weakSelf showError:@"Failed to download image"];
        }
      });
    }];
    [task resume];
  }
}

- (void)image:(UIImage *)image didFinishSavingWithError:(NSError *)error contextInfo:(void *)contextInfo {
  if (error) {
    [self showError:@"Failed to save image. Please allow Photos access in Settings."];
  } else {
    UINotificationFeedbackGenerator *feedback = [[UINotificationFeedbackGenerator alloc] init];
    [feedback notificationOccurred:UINotificationFeedbackTypeSuccess];

    // Show brief success toast
    UILabel *toast = [[UILabel alloc] init];
    toast.text = @"Saved to Photos";
    toast.textColor = [UIColor whiteColor];
    toast.backgroundColor = [UIColor colorWithWhite:0 alpha:0.8];
    toast.textAlignment = NSTextAlignmentCenter;
    toast.font = [UIFont systemFontOfSize:14 weight:UIFontWeightMedium];
    toast.layer.cornerRadius = 8;
    toast.clipsToBounds = YES;
    toast.alpha = 0;
    [toast sizeToFit];
    toast.frame = CGRectMake(0, 0, toast.frame.size.width + 32, 36);
    toast.center = CGPointMake(self.presentedViewController.view.center.x, self.presentedViewController.view.frame.size.height - 100);
    [self.presentedViewController.view addSubview:toast];

    [UIView animateWithDuration:0.3 animations:^{
      toast.alpha = 1;
    } completion:^(BOOL finished) {
      dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(2 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
        [UIView animateWithDuration:0.3 animations:^{
          toast.alpha = 0;
        } completion:^(BOOL finished) {
          [toast removeFromSuperview];
        }];
      });
    }];
  }
}

#pragma mark - UICollectionViewDataSource

- (NSInteger)collectionView:(UICollectionView *)collectionView numberOfItemsInSection:(NSInteger)section {
  // +1 for the "add" placeholder cell
  return self.images.count + 1;
}

- (UICollectionViewCell *)collectionView:(UICollectionView *)collectionView cellForItemAtIndexPath:(NSIndexPath *)indexPath {
  // First cell is always the "add" placeholder
  if (indexPath.item == 0) {
    EXImageStudioAddCell *cell = [collectionView dequeueReusableCellWithReuseIdentifier:@"AddCell" forIndexPath:indexPath];
    // AddCell is self-configured via setupViews, no additional config needed
    return cell;
  }

  EXImageStudioCell *cell = [collectionView dequeueReusableCellWithReuseIdentifier:@"ImageCell" forIndexPath:indexPath];

  // Adjust index for the "add" cell offset
  NSInteger imageIndex = indexPath.item - 1;
  NSDictionary *imageData = self.images[imageIndex];
  NSString *status = imageData[@"status"];
  NSString *imageUrl = imageData[@"url"];
  NSString *imageId = imageData[@"_id"];

  // Configure based on status
  if ([status isEqualToString:@"generating"]) {
    [cell configureForGeneratingState];
  } else if ([status isEqualToString:@"error"]) {
    [cell configureForErrorState];
  } else if (imageUrl && [status isEqualToString:@"completed"]) {
    BOOL isSelected = imageId && [self.selectedImageIds containsObject:imageId];
    NSInteger selectionIndex = 0;
    if (isSelected) {
      // Find selection order
      NSArray *selectedArray = [self.selectedImageIds allObjects];
      selectionIndex = [selectedArray indexOfObject:imageId] + 1;
    }
    [cell configureForCompletedStateWithUrl:imageUrl isSelected:isSelected selectionIndex:selectionIndex];

    // Add tap gesture for selection if not already added
    if (cell.imageView.gestureRecognizers.count == 0) {
      cell.imageView.userInteractionEnabled = YES;
      cell.imageView.tag = 200 + imageIndex;
      UITapGestureRecognizer *tap = [[UITapGestureRecognizer alloc] initWithTarget:self action:@selector(imageCellTapped:)];
      [cell.imageView addGestureRecognizer:tap];
    } else {
      // Update tag for the current index
      cell.imageView.tag = 200 + imageIndex;
    }
  }

  return cell;
}

- (void)imageCellTapped:(UITapGestureRecognizer *)gesture {
  NSInteger index = gesture.view.tag - 200;
  if (index < 0 || index >= self.images.count) return;

  NSDictionary *imageData = self.images[index];
  NSString *imageId = imageData[@"_id"];

  if (!imageId) return;

  // Toggle selection
  if ([self.selectedImageIds containsObject:imageId]) {
    [self.selectedImageIds removeObject:imageId];
  } else {
    [self.selectedImageIds addObject:imageId];
  }

  // Haptic feedback
  UIImpactFeedbackGenerator *feedback = [[UIImpactFeedbackGenerator alloc] initWithStyle:UIImpactFeedbackStyleLight];
  [feedback impactOccurred];

  // Update UI
  [self updateSelectionUI];
}

#pragma mark - Context Menu (Long Press)

- (UIContextMenuConfiguration *)collectionView:(UICollectionView *)collectionView
    contextMenuConfigurationForItemAtIndexPath:(NSIndexPath *)indexPath
                                         point:(CGPoint)point API_AVAILABLE(ios(13.0)) {

  // Skip the "Add" cell (index 0)
  if (indexPath.item == 0) {
    return nil;
  }

  NSInteger imageIndex = indexPath.item - 1;
  if (imageIndex < 0 || imageIndex >= self.images.count) {
    return nil;
  }

  NSDictionary *imageData = self.images[imageIndex];
  NSString *status = imageData[@"status"];

  // Only show menu for completed images
  if (![status isEqualToString:@"completed"]) {
    return nil;
  }

  __weak typeof(self) weakSelf = self;

  return [UIContextMenuConfiguration configurationWithIdentifier:@(imageIndex)
                                                 previewProvider:nil
                                                  actionProvider:^UIMenu * _Nullable(NSArray<UIMenuElement *> * _Nonnull suggestedActions) {

    // Save to Photos action
    UIAction *saveAction = [UIAction actionWithTitle:@"Save to Photos"
                                               image:[UIImage systemImageNamed:@"square.and.arrow.down"]
                                          identifier:nil
                                             handler:^(__kindof UIAction * _Nonnull action) {
      [weakSelf saveImageAtIndex:imageIndex];
    }];

    // Copy action
    UIAction *copyAction = [UIAction actionWithTitle:@"Copy"
                                               image:[UIImage systemImageNamed:@"doc.on.doc"]
                                          identifier:nil
                                             handler:^(__kindof UIAction * _Nonnull action) {
      [weakSelf copyImageAtIndex:imageIndex];
    }];

    // Share action
    UIAction *shareAction = [UIAction actionWithTitle:@"Share"
                                                image:[UIImage systemImageNamed:@"square.and.arrow.up"]
                                           identifier:nil
                                              handler:^(__kindof UIAction * _Nonnull action) {
      [weakSelf shareImageAtIndex:imageIndex fromIndexPath:indexPath];
    }];

    // Add to Prompt action
    UIAction *addToPromptAction = [UIAction actionWithTitle:@"Add to Prompt"
                                                      image:[UIImage systemImageNamed:@"text.badge.plus"]
                                                 identifier:nil
                                                    handler:^(__kindof UIAction * _Nonnull action) {
      [weakSelf addImageToPromptAtIndex:imageIndex];
    }];

    // Delete action (destructive)
    UIAction *deleteAction = [UIAction actionWithTitle:@"Delete"
                                                 image:[UIImage systemImageNamed:@"trash"]
                                            identifier:nil
                                               handler:^(__kindof UIAction * _Nonnull action) {
      [weakSelf confirmDeleteImageAtIndex:imageIndex];
    }];
    deleteAction.attributes = UIMenuElementAttributesDestructive;

    // Group actions
    UIMenu *menu = [UIMenu menuWithTitle:@""
                                children:@[saveAction, copyAction, shareAction, addToPromptAction, deleteAction]];

    return menu;
  }];
}

// Preview for context menu - shows the image larger
- (UITargetedPreview *)collectionView:(UICollectionView *)collectionView
    previewForHighlightingContextMenuWithConfiguration:(UIContextMenuConfiguration *)configuration API_AVAILABLE(ios(13.0)) {

  NSNumber *identifier = (NSNumber *)configuration.identifier;
  if (!identifier) return nil;

  NSInteger imageIndex = [identifier integerValue];
  NSIndexPath *indexPath = [NSIndexPath indexPathForItem:imageIndex + 1 inSection:0];

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

- (void)saveImageAtIndex:(NSInteger)index {
  if (index < 0 || index >= self.images.count) return;

  NSDictionary *imageData = self.images[index];
  NSString *imageUrl = imageData[@"url"];
  if (!imageUrl) return;

  // Load image from SDWebImage cache or download
  [[SDWebImageManager sharedManager] loadImageWithURL:[NSURL URLWithString:imageUrl]
                                              options:SDWebImageRetryFailed
                                             progress:nil
                                            completed:^(UIImage *image, NSData *data, NSError *error, SDImageCacheType cacheType, BOOL finished, NSURL *imageURL) {
    if (image && !error) {
      UIImageWriteToSavedPhotosAlbum(image, self, @selector(image:didFinishSavingWithError:contextInfo:), nil);
    } else {
      dispatch_async(dispatch_get_main_queue(), ^{
        [self showToast:@"Failed to save image"];
      });
    }
  }];
}

- (void)copyImageAtIndex:(NSInteger)index {
  if (index < 0 || index >= self.images.count) return;

  NSDictionary *imageData = self.images[index];
  NSString *imageUrl = imageData[@"url"];
  if (!imageUrl) return;

  [[SDWebImageManager sharedManager] loadImageWithURL:[NSURL URLWithString:imageUrl]
                                              options:SDWebImageRetryFailed
                                             progress:nil
                                            completed:^(UIImage *image, NSData *data, NSError *error, SDImageCacheType cacheType, BOOL finished, NSURL *imageURL) {
    if (image && !error) {
      dispatch_async(dispatch_get_main_queue(), ^{
        [[UIPasteboard generalPasteboard] setImage:image];
        [self showToast:@"Copied to clipboard"];
        UINotificationFeedbackGenerator *feedback = [[UINotificationFeedbackGenerator alloc] init];
        [feedback notificationOccurred:UINotificationFeedbackTypeSuccess];
      });
    }
  }];
}

- (void)shareImageAtIndex:(NSInteger)index fromIndexPath:(NSIndexPath *)indexPath {
  if (index < 0 || index >= self.images.count) return;

  NSDictionary *imageData = self.images[index];
  NSString *imageUrl = imageData[@"url"];
  if (!imageUrl) return;

  [[SDWebImageManager sharedManager] loadImageWithURL:[NSURL URLWithString:imageUrl]
                                              options:SDWebImageRetryFailed
                                             progress:nil
                                            completed:^(UIImage *image, NSData *data, NSError *error, SDImageCacheType cacheType, BOOL finished, NSURL *imageURL) {
    if (image && !error) {
      dispatch_async(dispatch_get_main_queue(), ^{
        UIActivityViewController *activityVC = [[UIActivityViewController alloc] initWithActivityItems:@[image] applicationActivities:nil];

        // For iPad - set source view for popover
        if (UI_USER_INTERFACE_IDIOM() == UIUserInterfaceIdiomPad) {
          UICollectionViewCell *cell = [self.imageCollectionView cellForItemAtIndexPath:indexPath];
          activityVC.popoverPresentationController.sourceView = cell;
          activityVC.popoverPresentationController.sourceRect = cell.bounds;
        }

        [self presentViewController:activityVC animated:YES completion:nil];
      });
    }
  }];
}

- (void)addImageToPromptAtIndex:(NSInteger)index {
  if (index < 0 || index >= self.images.count) return;

  NSDictionary *imageData = self.images[index];
  NSString *imageId = imageData[@"_id"];

  if (!imageId) return;

  // Add to selection if not already selected
  if (![self.selectedImageIds containsObject:imageId]) {
    [self.selectedImageIds addObject:imageId];
    [self updateSelectionUI];
  }

  // Trigger add to prompt action
  [self addSelectedToPrompt];
}

- (void)confirmDeleteImageAtIndex:(NSInteger)index {
  if (index < 0 || index >= self.images.count) return;

  NSDictionary *imageData = self.images[index];
  NSString *imageId = imageData[@"_id"];

  if (!imageId) return;

  UIAlertController *alert = [UIAlertController alertControllerWithTitle:@"Delete Image"
                                                                 message:@"Are you sure you want to delete this image? This cannot be undone."
                                                          preferredStyle:UIAlertControllerStyleAlert];

  [alert addAction:[UIAlertAction actionWithTitle:@"Cancel" style:UIAlertActionStyleCancel handler:nil]];

  __weak typeof(self) weakSelf = self;
  [alert addAction:[UIAlertAction actionWithTitle:@"Delete" style:UIAlertActionStyleDestructive handler:^(UIAlertAction *action) {
    [weakSelf deleteImage:imageId atIndex:index];
  }]];

  [self presentViewController:alert animated:YES completion:nil];
}

- (void)showToast:(NSString *)message {
  // Create toast label
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

  // Add padding
  toast.layoutMargins = UIEdgeInsetsMake(10, 20, 10, 20);

  // Animate in
  [UIView animateWithDuration:0.3 animations:^{
    toast.alpha = 1.0;
  } completion:^(BOOL finished) {
    // Animate out after delay
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(2.0 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
      [UIView animateWithDuration:0.3 animations:^{
        toast.alpha = 0;
      } completion:^(BOOL finished) {
        [toast removeFromSuperview];
      }];
    });
  }];
}

- (UIButton *)createIconOnlyButton:(NSString *)iconName color:(UIColor *)color tag:(NSInteger)tag action:(SEL)action {
  UIButton *button = [UIButton buttonWithType:UIButtonTypeSystem];
  button.translatesAutoresizingMaskIntoConstraints = NO;

  UIImageSymbolConfiguration *config = [UIImageSymbolConfiguration configurationWithPointSize:12 weight:UIImageSymbolWeightMedium];
  UIImage *icon = [UIImage systemImageNamed:iconName withConfiguration:config];

  [button setImage:icon forState:UIControlStateNormal];
  button.tintColor = color;
  button.backgroundColor = [UIColor colorWithWhite:0 alpha:0.6];
  button.layer.cornerRadius = 6;
  button.tag = tag;
  [button addTarget:self action:action forControlEvents:UIControlEventTouchUpInside];

  return button;
}

- (UIButton *)createActionButtonWithIcon:(NSString *)iconName title:(NSString *)title color:(UIColor *)color tag:(NSInteger)tag action:(SEL)action {
  UIButton *button = [UIButton buttonWithType:UIButtonTypeSystem];
  button.translatesAutoresizingMaskIntoConstraints = NO;

  UIImageSymbolConfiguration *config = [UIImageSymbolConfiguration configurationWithPointSize:10 weight:UIImageSymbolWeightSemibold];
  UIImage *icon = [UIImage systemImageNamed:iconName withConfiguration:config];

  [button setImage:icon forState:UIControlStateNormal];
  [button setTitle:[NSString stringWithFormat:@" %@", title] forState:UIControlStateNormal];
  button.tintColor = color;
  [button setTitleColor:color forState:UIControlStateNormal];
  button.titleLabel.font = [UIFont systemFontOfSize:10 weight:UIFontWeightSemibold];
  button.backgroundColor = [UIColor colorWithWhite:0.1 alpha:0.8];
  button.layer.cornerRadius = 6;
  button.contentEdgeInsets = UIEdgeInsetsMake(4, 8, 4, 8);
  button.tag = tag;
  [button addTarget:self action:action forControlEvents:UIControlEventTouchUpInside];

  return button;
}

- (void)imageTapped:(UITapGestureRecognizer *)gesture {
  NSInteger index = gesture.view.tag - 200;
  [self openImageFullscreen:index];
}

#pragma mark - Button Actions

- (void)deleteButtonTapped:(UIButton *)sender {
  NSInteger index = sender.tag;
  if (index < self.images.count) {
    NSDictionary *imageData = self.images[index];
    NSString *imageId = imageData[@"_id"];

    UIAlertController *alert = [UIAlertController alertControllerWithTitle:@"Delete Image"
                                                                   message:@"Are you sure you want to delete this image?"
                                                            preferredStyle:UIAlertControllerStyleAlert];

    [alert addAction:[UIAlertAction actionWithTitle:@"Cancel" style:UIAlertActionStyleCancel handler:nil]];
    [alert addAction:[UIAlertAction actionWithTitle:@"Delete" style:UIAlertActionStyleDestructive handler:^(UIAlertAction *action) {
      [self deleteImage:imageId atIndex:index];
    }]];

    [self presentViewController:alert animated:YES completion:nil];
  }
}

- (void)addToChatButtonTapped:(UIButton *)sender {
  NSInteger index = sender.tag;
  if (index < self.images.count) {
    NSDictionary *imageData = self.images[index];
    NSString *imageUrl = imageData[@"url"];
    NSString *imageName = imageData[@"name"] ?: [NSString stringWithFormat:@"image-%ld", (long)index + 1];

    if (!imageUrl) {
      return;
    }

    NSString *sandboxId = self.manager.sandboxId;
    if (!sandboxId || sandboxId.length == 0) {
      if ([self.manager respondsToSelector:@selector(appendToInput:)]) {
        NSString *imageRef = [NSString stringWithFormat:@"[Image: %@] ", imageName];
        [self.manager performSelector:@selector(appendToInput:) withObject:imageRef];
      }
      [self closeModal];
      return;
    }

    // Show loading
    sender.enabled = NO;
    UIActivityIndicatorView *spinner = [[UIActivityIndicatorView alloc] initWithActivityIndicatorStyle:UIActivityIndicatorViewStyleMedium];
    spinner.center = CGPointMake(sender.bounds.size.width / 2, sender.bounds.size.height / 2);
    spinner.color = [UIColor whiteColor];
    [sender addSubview:spinner];
    [spinner startAnimating];

    __weak typeof(self) weakSelf = self;

    // Check cache first
    UIImage *cachedImage = [_imageCache objectForKey:imageUrl];
    if (cachedImage) {
      NSData *imageData = UIImagePNGRepresentation(cachedImage);
      [self uploadImageToSandbox:imageData fileName:imageName sandboxId:sandboxId completion:^(NSString *sandboxPath, NSError *uploadError) {
        dispatch_async(dispatch_get_main_queue(), ^{
          [spinner removeFromSuperview];
          sender.enabled = YES;
          [weakSelf handleUploadCompletion:sandboxPath imageName:imageName error:uploadError];
        });
      }];
    } else {
      NSURL *url = [NSURL URLWithString:imageUrl];
      NSURLSessionDataTask *downloadTask = [[NSURLSession sharedSession] dataTaskWithURL:url completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
        if (error || !data) {
          dispatch_async(dispatch_get_main_queue(), ^{
            sender.enabled = YES;
            [spinner removeFromSuperview];
            [weakSelf showError:@"Failed to download image"];
          });
          return;
        }

        [weakSelf uploadImageToSandbox:data fileName:imageName sandboxId:sandboxId completion:^(NSString *sandboxPath, NSError *uploadError) {
          dispatch_async(dispatch_get_main_queue(), ^{
            [spinner removeFromSuperview];
            sender.enabled = YES;
            [weakSelf handleUploadCompletion:sandboxPath imageName:imageName error:uploadError];
          });
        }];
      }];
      [downloadTask resume];
    }
  }
}

- (void)handleUploadCompletion:(NSString *)sandboxPath imageName:(NSString *)imageName error:(NSError *)error {
  // Always use @reference format like haptic modal
  if ([self.manager respondsToSelector:@selector(insertImageTag:withPath:)]) {
    [self.manager performSelector:@selector(insertImageTag:withPath:) withObject:imageName withObject:sandboxPath ?: @""];
  } else if ([self.manager respondsToSelector:@selector(appendToInput:)]) {
    // Fallback to @reference format
    NSString *imageRef = [NSString stringWithFormat:@"@%@ ", imageName];
    [self.manager performSelector:@selector(appendToInput:) withObject:imageRef];
  }

  UINotificationFeedbackGenerator *feedback = [[UINotificationFeedbackGenerator alloc] init];
  [feedback notificationOccurred:UINotificationFeedbackTypeSuccess];

  [self closeModal];
}

- (void)uploadImageToSandbox:(NSData *)imageData fileName:(NSString *)fileName sandboxId:(NSString *)sandboxId completion:(void (^)(NSString *sandboxPath, NSError *error))completion {
  NSString *uploadURL = [NSString stringWithFormat:@"%@/api/upload-image", [EXEnvBridge v0ApiUrl]];

  NSString *boundary = [[NSUUID UUID] UUIDString];
  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:[NSURL URLWithString:uploadURL]];
  request.HTTPMethod = @"POST";
  [request setValue:[NSString stringWithFormat:@"multipart/form-data; boundary=%@", boundary] forHTTPHeaderField:@"Content-Type"];
  [request setValue:sandboxId forHTTPHeaderField:@"x-session-id"];

  NSMutableData *body = [NSMutableData data];

  [body appendData:[[NSString stringWithFormat:@"--%@\r\n", boundary] dataUsingEncoding:NSUTF8StringEncoding]];
  [body appendData:[[NSString stringWithFormat:@"Content-Disposition: form-data; name=\"file\"; filename=\"%@.png\"\r\n", fileName] dataUsingEncoding:NSUTF8StringEncoding]];
  [body appendData:[@"Content-Type: image/png\r\n\r\n" dataUsingEncoding:NSUTF8StringEncoding]];
  [body appendData:imageData];
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
      completion(nil, parseError ?: [NSError errorWithDomain:@"ImageUploadError" code:500 userInfo:@{NSLocalizedDescriptionKey: @"Failed to upload image"}]);
      return;
    }

    NSString *path = result[@"path"];
    completion(path, nil);
  }];

  [task resume];
}

- (void)useAsReferenceButtonTapped:(UIButton *)sender {
  NSInteger index = sender.tag;
  if (index < self.images.count) {
    NSDictionary *imageData = self.images[index];
    NSString *imageId = imageData[@"_id"];
    NSString *imageName = imageData[@"name"] ?: [NSString stringWithFormat:@"image-%ld", (long)index + 1];

    NSString *tag = [NSString stringWithFormat:@"@%@ ", imageName];

    // Toggle reference selection
    BOOL isCurrentlySelected = [self.referenceImageIds containsObject:imageId];

    if (isCurrentlySelected) {
      // Remove reference
      [self.referenceImageIds removeObject:imageId];
      // Remove from prompt text
      if (self.promptTextView) {
        NSString *currentText = self.promptTextView.text ?: @"";
        currentText = [currentText stringByReplacingOccurrencesOfString:tag withString:@""];
        currentText = [currentText stringByReplacingOccurrencesOfString:[NSString stringWithFormat:@"@%@", imageName] withString:@""];
        currentText = [currentText stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
        self.promptTextView.text = currentText;
        [self textViewDidChange:self.promptTextView];
      }
      // Update button appearance
      sender.backgroundColor = [UIColor colorWithWhite:0 alpha:0.6];
      sender.tintColor = [UIColor colorWithRed:1.0 green:0.6 blue:0.2 alpha:1.0];
    } else {
      // Add reference
      if (imageId) {
        [self.referenceImageIds addObject:imageId];
      }
      if (self.promptTextView) {
        NSString *currentText = self.promptTextView.text ?: @"";
        // Only add if not already in prompt
        if (![currentText containsString:[NSString stringWithFormat:@"@%@", imageName]]) {
          self.promptTextView.text = [currentText stringByAppendingString:tag];
          [self textViewDidChange:self.promptTextView];
        }
        [self.promptTextView becomeFirstResponder];
      }
      // Update button appearance - highlight when selected
      sender.backgroundColor = [UIColor colorWithRed:1.0 green:0.6 blue:0.2 alpha:1.0];
      sender.tintColor = [UIColor whiteColor];
    }

    // Reload collection to update cell selection state
    [self.imageCollectionView reloadData];

    UINotificationFeedbackGenerator *feedback = [[UINotificationFeedbackGenerator alloc] init];
    [feedback notificationOccurred:UINotificationFeedbackTypeSuccess];
  }
}

#pragma mark - UICollectionViewDelegateFlowLayout

- (CGSize)collectionView:(UICollectionView *)collectionView layout:(UICollectionViewLayout *)collectionViewLayout sizeForItemAtIndexPath:(NSIndexPath *)indexPath {
  // Vertical grid - 3 columns on iPhone, 4 on iPad
  CGFloat availableWidth = collectionView.bounds.size.width - 40 - 24; // 20pt padding on each side, 12pt spacing * 2
  NSInteger columns = [UIDevice currentDevice].userInterfaceIdiom == UIUserInterfaceIdiomPad ? 4 : 3;
  CGFloat cellWidth = floor(availableWidth / columns);

  return CGSizeMake(cellWidth, cellWidth); // Square cells
}

- (void)collectionView:(UICollectionView *)collectionView didSelectItemAtIndexPath:(NSIndexPath *)indexPath {
  // Handle tap on "add" cell (first item)
  if (indexPath.item == 0) {
    [self uploadFromDevice];
  }
}

#pragma mark - UITextFieldDelegate

- (BOOL)textFieldShouldReturn:(UITextField *)textField {
  [self generateImage];
  return YES;
}

@end
