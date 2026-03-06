// Copyright 2015-present 650 Industries. All rights reserved.

#import "EXChatGroupNode.h"
#import "Expo_Go-Swift.h"

// Colors matching EXPreviewZoomManager+ChatView.m exactly
static UIColor *ColorWhite60(void) {
  return [UIColor colorWithWhite:1.0 alpha:0.6];
}

static UIColor *ColorWhite50(void) {
  return [UIColor colorWithWhite:1.0 alpha:0.5];
}

static UIColor *ColorWhite40(void) {
  return [UIColor colorWithWhite:1.0 alpha:0.4];
}

static UIColor *ColorWhite35(void) {
  return [UIColor colorWithWhite:1.0 alpha:0.35];
}

static UIColor *ColorWhite20(void) {
  return [UIColor colorWithWhite:1.0 alpha:0.2];
}

// Tool type indicator colors - distinct for each type
static UIColor *ColorReadTool(void) {
  // Blue tint for read operations
  return [UIColor colorWithRed:0.4 green:0.6 blue:1.0 alpha:0.9];
}

static UIColor *ColorEditTool(void) {
  // Orange/amber tint for edit operations
  return [UIColor colorWithRed:1.0 green:0.7 blue:0.3 alpha:0.9];
}

static UIColor *ColorBashTool(void) {
  // Green tint for bash/command operations
  return [UIColor colorWithRed:0.4 green:0.85 blue:0.5 alpha:0.9];
}

@interface EXChatGroupNode ()

// Header elements
@property (nonatomic, strong) ASTextNode *starNode;
@property (nonatomic, strong) ASTextNode *labelNode;
@property (nonatomic, strong) ASTextNode *metaNode;
@property (nonatomic, strong) ASImageNode *chevronNode;

// L-shape expanded list
@property (nonatomic, strong) ASDisplayNode *lShapeLine;
@property (nonatomic, strong) NSArray<ASTextNode *> *itemNodes;
@property (nonatomic, strong) ASTextNode *moreNode;

// State
@property (nonatomic, assign) EXChatGroupType groupType;
@property (nonatomic, assign) BOOL isLatest;
@property (nonatomic, assign) BOOL isExpanded;
@property (nonatomic, assign) BOOL isHeaderCell;
@property (nonatomic, assign) CGFloat containerWidth;
@property (nonatomic, copy) NSArray<NSString *> *items;

@end

@implementation EXChatGroupNode

#pragma mark - Class Methods

+ (EXChatGroupType)groupTypeFromString:(NSString *)typeString {
  if ([typeString isEqualToString:@"read"]) {
    return EXChatGroupTypeRead;
  } else if ([typeString isEqualToString:@"edit"]) {
    return EXChatGroupTypeEdit;
  } else if ([typeString isEqualToString:@"bash"]) {
    return EXChatGroupTypeBash;
  }
  return EXChatGroupTypeDefault;
}

#pragma mark - Initializers

- (instancetype)initAsHeaderWithType:(NSString *)type
                           itemCount:(NSInteger)itemCount
                          isExpanded:(BOOL)isExpanded
                            isLatest:(BOOL)isLatest
                               width:(CGFloat)width {
  return [self initAsHeaderWithType:type
                          itemCount:itemCount
                         isExpanded:isExpanded
                           isLatest:isLatest
                              width:width
                              items:@[]];
}

/// Extended initializer with items for L-shape list
- (instancetype)initAsHeaderWithType:(NSString *)type
                           itemCount:(NSInteger)itemCount
                          isExpanded:(BOOL)isExpanded
                            isLatest:(BOOL)isLatest
                               width:(CGFloat)width
                               items:(NSArray<NSString *> *)items {
  self = [super init];
  if (self) {
    self.automaticallyManagesSubnodes = YES;
    self.backgroundColor = [UIColor clearColor];

    _groupType = [EXChatGroupNode groupTypeFromString:type];
    _isLatest = isLatest;
    _isExpanded = isExpanded;
    _isHeaderCell = YES;
    _containerWidth = width;
    _items = items ?: @[];

    // Get tool-specific color
    UIColor *toolColor = [self colorForType:type];

    // Star icon (✱) - colored by tool type
    _starNode = [[ASTextNode alloc] init];
    _starNode.attributedText = [[NSAttributedString alloc]
                                initWithString:@"✱"
                                attributes:@{
      NSFontAttributeName: [UIFont systemFontOfSize:14 weight:UIFontWeightMedium],
      NSForegroundColorAttributeName: toolColor
    }];

    // Label text - colored by tool type
    NSString *label = [self labelForType:type];
    _labelNode = [[ASTextNode alloc] init];
    _labelNode.attributedText = [[NSAttributedString alloc]
                                 initWithString:label
                                 attributes:@{
      NSFontAttributeName: [UIFont systemFontOfSize:15 weight:UIFontWeightSemibold],
      NSForegroundColorAttributeName: toolColor
    }];

    // Meta text (count) - matches commandMeta style
    NSString *unit = [type isEqualToString:@"bash"] ? @"command" : @"file";
    NSString *plural = itemCount == 1 ? unit : [unit stringByAppendingString:@"s"];
    _metaNode = [[ASTextNode alloc] init];
    _metaNode.attributedText = [[NSAttributedString alloc]
                                initWithString:[NSString stringWithFormat:@"(%ld %@)", (long)itemCount, plural]
                                attributes:@{
      NSFontAttributeName: [UIFont systemFontOfSize:15],
      NSForegroundColorAttributeName: ColorWhite50()
    }];

    // Chevron icon - rotates based on expanded state
    _chevronNode = [[ASImageNode alloc] init];
    UIImage *chevronImage = [[UIImage systemImageNamed:@"chevron.down"] imageWithRenderingMode:UIImageRenderingModeAlwaysTemplate];
    _chevronNode.image = chevronImage;
    _chevronNode.tintColor = [UIColor colorWithRed:0.55 green:0.55 blue:0.6 alpha:1.0]; // Soft gray-blue, visible on dark bg
    _chevronNode.contentMode = UIViewContentModeScaleAspectFit;

    // Setup expanded items if expanded
    if (isExpanded && items.count > 0) {
      [self setupExpandedItems:items type:type];
    }
  }
  return self;
}

- (void)setupExpandedItems:(NSArray<NSString *> *)items type:(NSString *)type {
  // L-shape vertical line - colored to match tool type
  _lShapeLine = [[ASDisplayNode alloc] init];
  UIColor *lineColor = [self colorForType:type];
  _lShapeLine.backgroundColor = [lineColor colorWithAlphaComponent:0.4];
  _lShapeLine.cornerRadius = 1;

  // Create item text nodes (show up to 20 items for better visibility)
  NSMutableArray *nodes = [NSMutableArray array];
  NSInteger maxItems = MIN(items.count, 20);

  for (NSInteger i = 0; i < maxItems; i++) {
    NSString *item = items[i];
    // For bash commands, show the full command
    // For files, show a shortened path (last 2-3 components)
    NSString *displayText = item;
    if ([type isEqualToString:@"bash"]) {
      // Show full command, truncate if too long
      if (displayText.length > 60) {
        displayText = [[displayText substringToIndex:57] stringByAppendingString:@"..."];
      }
    } else {
      // For files, show shortened path (e.g., "src/components/Button.tsx")
      NSArray *components = [item pathComponents];
      if (components.count > 3) {
        // Show last 3 path components
        NSArray *lastComponents = [components subarrayWithRange:NSMakeRange(components.count - 3, 3)];
        displayText = [lastComponents componentsJoinedByString:@"/"];
      } else if (components.count > 0) {
        displayText = [components componentsJoinedByString:@"/"];
      }
    }

    if (!displayText || displayText.length == 0) {
      displayText = item;
    }

    ASTextNode *itemNode = [[ASTextNode alloc] init];
    itemNode.maximumNumberOfLines = 1;
    itemNode.truncationMode = NSLineBreakByTruncatingMiddle;
    itemNode.attributedText = [[NSAttributedString alloc]
                               initWithString:displayText
                               attributes:@{
      NSFontAttributeName: [UIFont monospacedSystemFontOfSize:12 weight:UIFontWeightRegular],
      NSForegroundColorAttributeName: ColorWhite60()
    }];
    [nodes addObject:itemNode];
  }
  _itemNodes = nodes;

  // "More" text if items exceed the max
  if (items.count > maxItems) {
    _moreNode = [[ASTextNode alloc] init];
    _moreNode.attributedText = [[NSAttributedString alloc]
                                initWithString:[NSString stringWithFormat:@"+%ld more", (long)(items.count - maxItems)]
                                attributes:@{
      NSFontAttributeName: [UIFont italicSystemFontOfSize:11],
      NSForegroundColorAttributeName: ColorWhite35()
    }];
  }
}

- (instancetype)initAsItemWithText:(NSString *)text
                              type:(NSString *)type
                             width:(CGFloat)width {
  self = [super init];
  if (self) {
    self.automaticallyManagesSubnodes = YES;
    self.backgroundColor = [UIColor clearColor];

    _groupType = [EXChatGroupNode groupTypeFromString:type];
    _isHeaderCell = NO;
    _containerWidth = width;

    // Single item text node (used when items rendered separately)
    // Show shortened path (last 3 components) for better context
    NSString *displayText = text;
    if ([type isEqualToString:@"bash"]) {
      // Show full command for bash
      if (displayText.length > 60) {
        displayText = [[displayText substringToIndex:57] stringByAppendingString:@"..."];
      }
    } else {
      NSArray *components = [text pathComponents];
      if (components.count > 3) {
        NSArray *lastComponents = [components subarrayWithRange:NSMakeRange(components.count - 3, 3)];
        displayText = [lastComponents componentsJoinedByString:@"/"];
      } else if (components.count > 0) {
        displayText = [components componentsJoinedByString:@"/"];
      }
    }
    if (!displayText || displayText.length == 0) {
      displayText = text;
    }

    _labelNode = [[ASTextNode alloc] init];
    _labelNode.maximumNumberOfLines = 1;
    _labelNode.truncationMode = NSLineBreakByTruncatingMiddle;
    _labelNode.attributedText = [[NSAttributedString alloc]
                                 initWithString:displayText
                                 attributes:@{
      NSFontAttributeName: [UIFont systemFontOfSize:13],
      NSForegroundColorAttributeName: ColorWhite60()
    }];
  }
  return self;
}

#pragma mark - Helpers

- (UIColor *)colorForType:(NSString *)type {
  if ([type isEqualToString:@"read"]) {
    return ColorReadTool();
  } else if ([type isEqualToString:@"edit"]) {
    return ColorEditTool();
  } else if ([type isEqualToString:@"bash"]) {
    return ColorBashTool();
  }
  return ColorWhite60();
}

- (NSString *)labelForType:(NSString *)type {
  if ([type isEqualToString:@"read"]) {
    return @"Read file";
  } else if ([type isEqualToString:@"edit"]) {
    return @"Edit file";
  } else if ([type isEqualToString:@"bash"]) {
    return @"Ran command";
  }
  return @"";
}

- (void)dealloc {
  // No Lottie animations to clean up anymore
}

#pragma mark - View Lifecycle

- (void)didLoad {
  [super didLoad];

  // Add tap gesture for header cells
  if (self.isHeaderCell) {
    UITapGestureRecognizer *tapGesture = [[UITapGestureRecognizer alloc]
        initWithTarget:self action:@selector(handleHeaderTap:)];
    [self.view addGestureRecognizer:tapGesture];
    self.view.userInteractionEnabled = YES;
  }
}

- (void)handleHeaderTap:(UITapGestureRecognizer *)gesture {
  NSLog(@"📱 EXChatGroupNode headerTapped! onHeaderTapped callback: %@", self.onHeaderTapped ? @"set" : @"nil");

  // Immediate visual feedback - quick scale animation
  if (self.view) {
    [UIView animateWithDuration:0.1 animations:^{
      self.view.transform = CGAffineTransformMakeScale(0.97, 0.97);
    } completion:^(BOOL finished) {
      [UIView animateWithDuration:0.1 animations:^{
        self.view.transform = CGAffineTransformIdentity;
      }];
    }];
  }

  if (self.onHeaderTapped) {
    self.onHeaderTapped();
  }
}

#pragma mark - Visible State Animations

- (void)didEnterVisibleState {
  [super didEnterVisibleState];

  // Animate ALL group headers with spring animation for smooth scrolling experience
  // HIG: Uses spring animation matching task cards for visual consistency
  if (self.view) {
    [EXCellAnimationHelper prepareForAppearAnimation:self.view style:EXCellAnimationStyleSpringIn];
    [EXCellAnimationHelper animateAppearance:self.view style:EXCellAnimationStyleSpringIn delay:0 completion:nil];
  }
}

#pragma mark - ASDisplayNode Layout

- (ASLayoutSpec *)layoutSpecThatFits:(ASSizeRange)constrainedSize {
  if (self.isHeaderCell) {
    return [self headerLayoutSpecThatFits:constrainedSize];
  } else {
    return [self itemLayoutSpecThatFits:constrainedSize];
  }
}

- (ASLayoutSpec *)headerLayoutSpecThatFits:(ASSizeRange)constrainedSize {
  // Chevron sizing
  self.chevronNode.style.preferredSize = CGSizeMake(14, 14);

  // Apply rotation transform for chevron based on expanded state
  if (self.isExpanded) {
    self.chevronNode.transform = CATransform3DMakeRotation(M_PI, 0, 0, 1);
  } else {
    self.chevronNode.transform = CATransform3DIdentity;
  }

  // Header row: star + label + meta + flex spacer + chevron
  ASLayoutSpec *flexSpacer = [[ASLayoutSpec alloc] init];
  flexSpacer.style.flexGrow = 1.0;

  ASStackLayoutSpec *headerStack = [ASStackLayoutSpec
                                    stackLayoutSpecWithDirection:ASStackLayoutDirectionHorizontal
                                    spacing:0
                                    justifyContent:ASStackLayoutJustifyContentStart
                                    alignItems:ASStackLayoutAlignItemsCenter
                                    children:@[
                                      self.starNode,
                                      [self spacerWithWidth:8],
                                      self.labelNode,
                                      [self spacerWithWidth:6],
                                      self.metaNode,
                                      flexSpacer,
                                      self.chevronNode
                                    ]];

  // Header insets - matching outer margin
  UIEdgeInsets headerInsets = UIEdgeInsetsMake(10, 16, 10, 16);
  ASInsetLayoutSpec *headerInset = [ASInsetLayoutSpec insetLayoutSpecWithInsets:headerInsets
                                                                          child:headerStack];

  // If not expanded, just return header
  if (!self.isExpanded || self.itemNodes.count == 0) {
    return headerInset;
  }

  // Build L-shape expanded list with proper sizing
  // The vertical line needs explicit height to work properly
  self.lShapeLine.style.width = ASDimensionMake(2);
  // Use auto height based on items

  // Item nodes vertical stack with proper max width
  NSMutableArray *itemChildren = [NSMutableArray array];
  for (ASTextNode *itemNode in self.itemNodes) {
    // Ensure text nodes have proper sizing
    itemNode.style.maxWidth = ASDimensionMake(constrainedSize.max.width - 60);
    itemNode.style.flexShrink = 1.0;
    [itemChildren addObject:itemNode];
  }

  if (self.moreNode) {
    [itemChildren addObject:self.moreNode];
  }

  ASStackLayoutSpec *itemsStack = [ASStackLayoutSpec
                                   stackLayoutSpecWithDirection:ASStackLayoutDirectionVertical
                                   spacing:6
                                   justifyContent:ASStackLayoutJustifyContentStart
                                   alignItems:ASStackLayoutAlignItemsStart
                                   children:itemChildren];

  // L-shape: vertical line alongside items
  ASStackLayoutSpec *lShapeStack = [ASStackLayoutSpec
                                    stackLayoutSpecWithDirection:ASStackLayoutDirectionHorizontal
                                    spacing:10
                                    justifyContent:ASStackLayoutJustifyContentStart
                                    alignItems:ASStackLayoutAlignItemsStretch
                                    children:@[self.lShapeLine, itemsStack]];

  // Inset the L-shape (left margin lines up under star)
  UIEdgeInsets lShapeInsets = UIEdgeInsetsMake(2, 22, 10, 16);
  ASInsetLayoutSpec *lShapeInset = [ASInsetLayoutSpec insetLayoutSpecWithInsets:lShapeInsets
                                                                          child:lShapeStack];

  // Combine header + expanded list
  return [ASStackLayoutSpec
          stackLayoutSpecWithDirection:ASStackLayoutDirectionVertical
          spacing:0
          justifyContent:ASStackLayoutJustifyContentStart
          alignItems:ASStackLayoutAlignItemsStretch
          children:@[headerInset, lShapeInset]];
}

- (ASLayoutSpec *)itemLayoutSpecThatFits:(ASSizeRange)constrainedSize {
  // Single item insets (indented from header, matches NewOnboardingScreen15)
  UIEdgeInsets insets = UIEdgeInsetsMake(5, 18, 5, 0);
  return [ASInsetLayoutSpec insetLayoutSpecWithInsets:insets child:self.labelNode];
}

- (ASLayoutSpec *)spacerWithWidth:(CGFloat)width {
  ASLayoutSpec *spacer = [[ASLayoutSpec alloc] init];
  spacer.style.width = ASDimensionMake(width);
  return spacer;
}

@end
