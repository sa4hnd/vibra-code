// Copyright 2015-present 650 Industries. All rights reserved.

#import "EXChatMessageNode.h"
#import <SDWebImage/SDWebImage.h>
#import "Expo_Go-Swift.h"

// Markdown cache for avoiding redundant parsing (thread-safe)
static NSCache<NSString *, NSAttributedString *> *_markdownCache = nil;
static dispatch_queue_t _markdownQueue = nil;

// Colors matching EXPreviewZoomManager+ChatView.m exactly
static UIColor *NodeColorWhite60(void) {
  return [UIColor colorWithWhite:1.0 alpha:0.6];
}

static UIColor *NodeColorWhite80(void) {
  return [UIColor colorWithWhite:1.0 alpha:0.8];
}

static UIColor *NodeColorWhite50(void) {
  return [UIColor colorWithWhite:1.0 alpha:0.5];
}

static UIColor *NodeColorWhite15(void) {
  return [UIColor colorWithWhite:1.0 alpha:0.15];
}

@interface EXChatMessageNode ()

@property (nonatomic, strong) ASTextNode *textNode;
@property (nonatomic, strong) ASDisplayNode *bubbleNode;
@property (nonatomic, strong) ASNetworkImageNode *imageNode;
@property (nonatomic, strong) ASDisplayNode *shimmerNode;
@property (nonatomic, strong) UIView *shimmerLottie;
@property (nonatomic, assign) BOOL isUserMessage;
@property (nonatomic, assign) BOOL isLatest;
@property (nonatomic, assign) CGFloat containerWidth;
@property (nonatomic, copy) NSString *contentHash;

@end

@implementation EXChatMessageNode

+ (void)initialize {
  // CRITICAL: Must call super for Texture/ASCellNode static initialization
  [super initialize];

  if (self == [EXChatMessageNode class]) {
    // Initialize markdown cache (100 items max, auto-evicts oldest)
    _markdownCache = [[NSCache alloc] init];
    _markdownCache.countLimit = 100;

    // Background queue for markdown parsing
    _markdownQueue = dispatch_queue_create("com.expo.markdown", DISPATCH_QUEUE_CONCURRENT);
  }
}

- (instancetype)initWithData:(NSDictionary *)data
                    isLatest:(BOOL)isLatest
                       width:(CGFloat)width {
  self = [super init];
  if (self) {
    // Configure node for async layout
    self.automaticallyManagesSubnodes = YES;
    self.backgroundColor = [UIColor clearColor];

    _containerWidth = width;
    _isLatest = isLatest;
    NSString *content = data[@"content"] ?: @"";
    NSString *role = data[@"role"] ?: @"assistant";
    NSString *imageUrl = data[@"imageUrl"];
    NSArray *imagesArray = data[@"images"];
    NSArray *audiosArray = data[@"audios"];
    NSArray *videosArray = data[@"videos"];
    _isUserMessage = [role isEqualToString:@"user"];

    // For user messages with media arrays, append indicators to content
    if (_isUserMessage) {
      // Images indicator - styled as [🖼️ N attached]
      if (imagesArray && [imagesArray isKindOfClass:[NSArray class]] && imagesArray.count > 0) {
        NSUInteger imageCount = imagesArray.count;
        NSString *imageIndicator = imageCount == 1
          ? @"\n[🖼️ 1 image]"
          : [NSString stringWithFormat:@"\n[🖼️ %lu images]", (unsigned long)imageCount];
        content = [content stringByAppendingString:imageIndicator];
        NSLog(@"🖼️ [ChatMessageNode] User message has %lu image(s), added indicator", (unsigned long)imageCount);
      }

      // Audio indicator - styled as [🎵 N attached]
      if (audiosArray && [audiosArray isKindOfClass:[NSArray class]] && audiosArray.count > 0) {
        NSUInteger audioCount = audiosArray.count;
        NSString *audioIndicator = audioCount == 1
          ? @"\n[🎵 1 audio]"
          : [NSString stringWithFormat:@"\n[🎵 %lu audios]", (unsigned long)audioCount];
        content = [content stringByAppendingString:audioIndicator];
        NSLog(@"🎵 [ChatMessageNode] User message has %lu audio(s), added indicator", (unsigned long)audioCount);
      }

      // Video indicator - styled as [🎬 N attached]
      if (videosArray && [videosArray isKindOfClass:[NSArray class]] && videosArray.count > 0) {
        NSUInteger videoCount = videosArray.count;
        NSString *videoIndicator = videoCount == 1
          ? @"\n[🎬 1 video]"
          : [NSString stringWithFormat:@"\n[🎬 %lu videos]", (unsigned long)videoCount];
        content = [content stringByAppendingString:videoIndicator];
        NSLog(@"🎬 [ChatMessageNode] User message has %lu video(s), added indicator", (unsigned long)videoCount);
      }
    }

    // Create cache key based on content + role
    _contentHash = [NSString stringWithFormat:@"%@_%@", content, role];

    // Configure text node (async text rendering)
    _textNode = [[ASTextNode alloc] init];
    _textNode.maximumNumberOfLines = 0;
    _textNode.truncationMode = NSLineBreakByWordWrapping;

    // Check cache first (fast path - no parsing needed)
    NSAttributedString *cachedResult = [_markdownCache objectForKey:_contentHash];
    if (cachedResult) {
      _textNode.attributedText = cachedResult;
    } else if (content.length < 100) {
      // Short content: parse synchronously (fast enough for 60fps)
      // Threshold lowered from 500 to 100 for consistent performance
      NSAttributedString *attributedContent = [self parseMarkdownContent:content isUser:_isUserMessage];
      _textNode.attributedText = attributedContent;
      [_markdownCache setObject:attributedContent forKey:_contentHash];
    } else {
      // Long content: show placeholder, parse async
      _textNode.attributedText = [self placeholderAttributedString:_isUserMessage];

      // Parse markdown on background queue
      __weak typeof(self) weakSelf = self;
      dispatch_async(_markdownQueue, ^{
        NSAttributedString *attributedContent = [weakSelf parseMarkdownContent:content isUser:_isUserMessage];

        // Cache and update UI on main thread
        dispatch_async(dispatch_get_main_queue(), ^{
          __strong typeof(weakSelf) strongSelf = weakSelf;
          if (strongSelf && attributedContent) {
            [_markdownCache setObject:attributedContent forKey:strongSelf.contentHash];
            strongSelf.textNode.attributedText = attributedContent;
            [strongSelf setNeedsLayout];
          }
        });
      });
    }

    // Bubble for user messages - BLUE background, right-aligned
    if (_isUserMessage) {
      _bubbleNode = [[ASDisplayNode alloc] init];
      // iOS system blue matching Messages app
      _bubbleNode.backgroundColor = [UIColor colorWithRed:0.0 green:0.478 blue:1.0 alpha:1.0];
      _bubbleNode.cornerRadius = 18;
      _bubbleNode.clipsToBounds = YES;
    }

    // SDWebImage network image node for images
    if (imageUrl && imageUrl.length > 0) {
      _imageNode = [[ASNetworkImageNode alloc] init];
      _imageNode.URL = [NSURL URLWithString:imageUrl];
      _imageNode.contentMode = UIViewContentModeScaleAspectFit;
      _imageNode.cornerRadius = 16; // Matches ImageStudioModal corner radius
      _imageNode.clipsToBounds = YES;

      // Configure SDWebImage for caching
      _imageNode.shouldCacheImage = YES;
    }

    // Lottie shimmer for latest assistant message
    if (isLatest && !_isUserMessage) {
      [self setupShimmerNode];
    }
  }
  return self;
}

- (NSAttributedString *)placeholderAttributedString:(BOOL)isUser {
  UIColor *textColor = isUser ? [UIColor whiteColor] : NodeColorWhite80();
  NSMutableParagraphStyle *paragraphStyle = [[NSMutableParagraphStyle alloc] init];
  paragraphStyle.lineSpacing = 4;

  NSDictionary *attributes = @{
    NSFontAttributeName: [UIFont systemFontOfSize:15],
    NSForegroundColorAttributeName: [textColor colorWithAlphaComponent:0.5],
    NSParagraphStyleAttributeName: paragraphStyle
  };

  return [[NSAttributedString alloc] initWithString:@"..." attributes:attributes];
}

- (NSAttributedString *)parseMarkdownContent:(NSString *)content isUser:(BOOL)isUser {
  if (!content || content.length == 0) {
    return [[NSAttributedString alloc] initWithString:@""];
  }

  UIColor *textColor = isUser ? [UIColor whiteColor] : NodeColorWhite80();

  // User messages: Use markdown helper for media tags only
  // This enables [image: tag], [video: tag], [audio: tag] rendering
  if (isUser) {
    UIColor *codeBackgroundColor = [UIColor colorWithRed:0.2 green:0.3 blue:0.5 alpha:0.5];
    UIColor *codeTextColor = [UIColor colorWithRed:0.7 green:0.85 blue:1.0 alpha:1.0];

    NSAttributedString *result = [EXMarkdownHelper parseMarkdown:content
                                                       textColor:textColor
                                             codeBackgroundColor:codeBackgroundColor
                                                   codeTextColor:codeTextColor];
    if (result) {
      return result;
    }

    // Fallback: return plain text with basic styling
    NSMutableParagraphStyle *paragraphStyle = [[NSMutableParagraphStyle alloc] init];
    paragraphStyle.lineSpacing = 4;

    NSDictionary *attributes = @{
      NSFontAttributeName: [UIFont systemFontOfSize:15],
      NSForegroundColorAttributeName: textColor,
      NSParagraphStyleAttributeName: paragraphStyle
    };

    return [[NSAttributedString alloc] initWithString:content attributes:attributes];
  }

  // Assistant messages: use markdown helper for rich formatting
  UIColor *codeBackgroundColor = [UIColor colorWithWhite:0.2 alpha:0.8];
  UIColor *codeTextColor = [UIColor colorWithRed:0.4 green:0.8 blue:0.6 alpha:1.0];

  NSAttributedString *result = [EXMarkdownHelper parseMarkdown:content
                                                     textColor:textColor
                                           codeBackgroundColor:codeBackgroundColor
                                                 codeTextColor:codeTextColor];

  if (result) {
    return result;
  }

  // Fallback: return plain text with basic styling
  NSMutableParagraphStyle *paragraphStyle = [[NSMutableParagraphStyle alloc] init];
  paragraphStyle.lineSpacing = 4;

  NSDictionary *attributes = @{
    NSFontAttributeName: [UIFont systemFontOfSize:15],
    NSForegroundColorAttributeName: textColor,
    NSParagraphStyleAttributeName: paragraphStyle
  };

  return [[NSAttributedString alloc] initWithString:content attributes:attributes];
}

- (void)setupShimmerNode {
  __weak typeof(self) weakSelf = self;
  _shimmerNode = [[ASDisplayNode alloc] initWithViewBlock:^UIView * _Nonnull{
    UIView *container = [[UIView alloc] init];
    container.backgroundColor = [UIColor clearColor];
    container.clipsToBounds = YES;

    // Create shimmer Lottie animation
    UIView *shimmerLottie = [EXLottieAnimationHelper createAnimationViewWithNamed:@"shimmer" contentMode:UIViewContentModeScaleToFill];
    shimmerLottie.translatesAutoresizingMaskIntoConstraints = NO;
    [container addSubview:shimmerLottie];

    [NSLayoutConstraint activateConstraints:@[
      [shimmerLottie.leadingAnchor constraintEqualToAnchor:container.leadingAnchor],
      [shimmerLottie.trailingAnchor constraintEqualToAnchor:container.trailingAnchor],
      [shimmerLottie.topAnchor constraintEqualToAnchor:container.topAnchor],
      [shimmerLottie.bottomAnchor constraintEqualToAnchor:container.bottomAnchor]
    ]];

    weakSelf.shimmerLottie = shimmerLottie;
    [EXLottieAnimationHelper play:shimmerLottie];

    return container;
  }];
  _shimmerNode.backgroundColor = [UIColor clearColor];
}

#pragma mark - Visible State Animations

- (void)didEnterVisibleState {
  [super didEnterVisibleState];

  // Animate ALL messages with spring animation for smooth scrolling experience
  // HIG: Use spring animation for consistency with task cards and other chat elements
  if (self.view) {
    [EXCellAnimationHelper prepareForAppearAnimation:self.view style:EXCellAnimationStyleSpringIn];
    [EXCellAnimationHelper animateAppearance:self.view style:EXCellAnimationStyleSpringIn delay:0 completion:nil];
  }
}

#pragma mark - ASDisplayNode Layout

- (void)dealloc {
  // CRITICAL: Stop Lottie animation to prevent memory leak
  // Lottie holds strong reference to CADisplayLink which retains the view
  if (self.shimmerLottie) {
    [EXLottieAnimationHelper stop:self.shimmerLottie];
    self.shimmerLottie = nil;
  }
}

- (ASLayoutSpec *)layoutSpecThatFits:(ASSizeRange)constrainedSize {
  // Text insets - more padding for better readability
  UIEdgeInsets textInsets = UIEdgeInsetsMake(10, 14, 10, 14);
  ASInsetLayoutSpec *textInsetSpec = [ASInsetLayoutSpec insetLayoutSpecWithInsets:textInsets
                                                                            child:self.textNode];

  ASLayoutSpec *contentSpec = textInsetSpec;

  // Add image below text if present
  if (self.imageNode) {
    self.imageNode.style.preferredSize = CGSizeMake(constrainedSize.max.width - 48, 200);

    ASInsetLayoutSpec *imageInsetSpec = [ASInsetLayoutSpec
        insetLayoutSpecWithInsets:UIEdgeInsetsMake(8, 14, 8, 14)
                            child:self.imageNode];

    contentSpec = [ASStackLayoutSpec
                   stackLayoutSpecWithDirection:ASStackLayoutDirectionVertical
                   spacing:0
                   justifyContent:ASStackLayoutJustifyContentStart
                   alignItems:ASStackLayoutAlignItemsStretch
                   children:@[textInsetSpec, imageInsetSpec]];
  }

  if (self.isUserMessage && self.bubbleNode) {
    // User message with bubble background - RIGHT ALIGNED with max width
    ASBackgroundLayoutSpec *backgroundSpec = [ASBackgroundLayoutSpec
                                              backgroundLayoutSpecWithChild:contentSpec
                                              background:self.bubbleNode];

    // Limit bubble width to 85% of container
    backgroundSpec.style.maxWidth = ASDimensionMakeWithFraction(0.85);

    // Right-align user messages using relative position
    ASRelativeLayoutSpec *rightAlignSpec = [ASRelativeLayoutSpec
                                            relativePositionLayoutSpecWithHorizontalPosition:ASRelativeLayoutSpecPositionEnd
                                            verticalPosition:ASRelativeLayoutSpecPositionCenter
                                            sizingOption:ASRelativeLayoutSpecSizingOptionMinimumSize
                                            child:backgroundSpec];

    // Add horizontal margin for user messages
    UIEdgeInsets outerInsets = UIEdgeInsetsMake(4, 24, 4, 16);
    return [ASInsetLayoutSpec insetLayoutSpecWithInsets:outerInsets child:rightAlignSpec];
  }

  if (self.shimmerNode && self.isLatest && !self.isUserMessage) {
    // Overlay Lottie shimmer on text
    ASOverlayLayoutSpec *overlaySpec = [ASOverlayLayoutSpec overlayLayoutSpecWithChild:contentSpec
                                                                               overlay:self.shimmerNode];
    // Assistant messages: left-aligned with margin
    UIEdgeInsets outerInsets = UIEdgeInsetsMake(4, 16, 4, 24);
    return [ASInsetLayoutSpec insetLayoutSpecWithInsets:outerInsets child:overlaySpec];
  }

  // Assistant messages: left-aligned with margin
  UIEdgeInsets outerInsets = UIEdgeInsetsMake(4, 16, 4, 24);
  return [ASInsetLayoutSpec insetLayoutSpecWithInsets:outerInsets child:contentSpec];
}

@end
