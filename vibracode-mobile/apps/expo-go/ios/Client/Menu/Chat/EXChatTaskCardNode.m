// Copyright 2015-present 650 Industries. All rights reserved.

#import "EXChatTaskCardNode.h"
#import "Expo_Go-Swift.h"
#import <objc/runtime.h>

// Colors matching EXPreviewZoomManager+ChatView.m exactly
static UIColor *TaskCardWhite60(void) {
  return [UIColor colorWithWhite:1.0 alpha:0.6];
}

static UIColor *TaskCardWhite50(void) {
  return [UIColor colorWithWhite:1.0 alpha:0.5];
}

static UIColor *TaskCardWhite40(void) {
  return [UIColor colorWithWhite:1.0 alpha:0.4];
}

static UIColor *TaskCardWhite35(void) {
  return [UIColor colorWithWhite:1.0 alpha:0.35];
}

static UIColor *TaskCardWhite20(void) {
  return [UIColor colorWithWhite:1.0 alpha:0.2];
}

static UIColor *TaskCardWhite15(void) {
  return [UIColor colorWithWhite:1.0 alpha:0.15];
}

static UIColor *TaskCardGreen(void) {
  return [UIColor colorWithRed:0.204 green:0.78 blue:0.349 alpha:1.0]; // #34C759
}

static UIColor *TaskCardBgColor(void) {
  return [UIColor colorWithWhite:0.08 alpha:0.95]; // Darker card background
}

static UIColor *TaskCardHeaderBg(void) {
  return [UIColor colorWithWhite:1.0 alpha:0.05]; // Slightly darker header
}

static UIColor *TaskCardBorderColor(void) {
  return [UIColor colorWithWhite:0.3 alpha:0.5];
}

@interface EXChatTaskCardNode ()

// Header elements
@property (nonatomic, strong) ASTextNode *headerTitleNode;
@property (nonatomic, strong) ASDisplayNode *statusDotNode;
@property (nonatomic, strong) ASTextNode *countNode;

// Glass/Blur background
@property (nonatomic, strong) ASDisplayNode *backgroundNode;

// Task items
@property (nonatomic, strong) NSArray<ASDisplayNode *> *taskItemNodes;

// State
@property (nonatomic, assign) BOOL isLatest;
@property (nonatomic, assign) CGFloat containerWidth;
@property (nonatomic, copy) NSArray<NSDictionary *> *todos;

@end

@implementation EXChatTaskCardNode

- (instancetype)initWithTodos:(NSArray<NSDictionary *> *)todos
                     isLatest:(BOOL)isLatest
                        width:(CGFloat)width {
  self = [super init];
  if (self) {
    self.automaticallyManagesSubnodes = YES;
    self.backgroundColor = [UIColor clearColor];

    _todos = todos ?: @[];
    _isLatest = isLatest;
    _containerWidth = width;

    // HIG: Accessibility - make the card accessible as a group
    self.isAccessibilityElement = NO; // Container, not element
    self.accessibilityTraits = UIAccessibilityTraitNone;

    // Setup glass/blur background
    [self setupBackgroundNode];

    // Header: "TASKS" label
    _headerTitleNode = [[ASTextNode alloc] init];
    _headerTitleNode.attributedText = [[NSAttributedString alloc]
                                       initWithString:@"TASKS"
                                       attributes:@{
      NSFontAttributeName: [UIFont systemFontOfSize:11 weight:UIFontWeightSemibold],
      NSForegroundColorAttributeName: [UIColor whiteColor],
      NSKernAttributeName: @0.5
    }];

    // Status dot (green) - hidden from VoiceOver (decorative)
    __weak typeof(self) weakSelf = self;
    _statusDotNode = [[ASDisplayNode alloc] initWithViewBlock:^UIView * _Nonnull{
      UIView *dotView = [[UIView alloc] initWithFrame:CGRectMake(0, 0, 6, 6)];
      dotView.layer.cornerRadius = 3;
      dotView.backgroundColor = TaskCardGreen();
      dotView.layer.shadowColor = TaskCardGreen().CGColor;
      dotView.layer.shadowOpacity = 0.6;
      dotView.layer.shadowRadius = 4;
      dotView.layer.shadowOffset = CGSizeZero;
      dotView.isAccessibilityElement = NO; // HIG: Decorative element
      return dotView;
    }];

    // Count text - accessible
    _countNode = [[ASTextNode alloc] init];
    _countNode.attributedText = [[NSAttributedString alloc]
                                 initWithString:[NSString stringWithFormat:@"%ld", (long)todos.count]
                                 attributes:@{
      NSFontAttributeName: [UIFont systemFontOfSize:11 weight:UIFontWeightMedium],
      NSForegroundColorAttributeName: TaskCardWhite50()
    }];

    // HIG: Accessibility label for the header group
    NSInteger completed = 0;
    NSInteger inProgress = 0;
    for (NSDictionary *todo in todos) {
      NSString *status = todo[@"status"] ?: @"pending";
      if ([status isEqualToString:@"completed"]) completed++;
      else if ([status isEqualToString:@"in_progress"]) inProgress++;
    }
    _headerTitleNode.accessibilityLabel = [NSString stringWithFormat:@"Tasks: %ld total, %ld completed, %ld in progress",
                                           (long)todos.count, (long)completed, (long)inProgress];

    // Create task item nodes
    [self setupTaskItemNodes:todos isLatest:isLatest];
  }
  return self;
}

- (void)setupBackgroundNode {
  __weak typeof(self) weakSelf = self;
  _backgroundNode = [[ASDisplayNode alloc] initWithViewBlock:^UIView * _Nonnull{
    UIView *container = [[UIView alloc] init];
    container.clipsToBounds = YES;
    container.layer.cornerRadius = 16;

    // Check for iOS 26 Liquid Glass
    if ([EXGlassEffectHelper isLiquidGlassAvailable]) {
      [EXGlassEffectHelper applyGlassEffectToView:container cornerRadius:16 isInteractive:YES];
    } else {
      // Fallback: UIVisualEffectView blur
      UIBlurEffect *blurEffect = [UIBlurEffect effectWithStyle:UIBlurEffectStyleDark];
      UIVisualEffectView *blurView = [[UIVisualEffectView alloc] initWithEffect:blurEffect];
      blurView.frame = container.bounds;
      blurView.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
      [container addSubview:blurView];
    }

    return container;
  }];
  _backgroundNode.cornerRadius = 16;
  _backgroundNode.clipsToBounds = YES;
  _backgroundNode.shadowColor = [[UIColor blackColor] colorWithAlphaComponent:0.3].CGColor;
  _backgroundNode.shadowOpacity = 1.0;
  _backgroundNode.shadowRadius = 12;
  _backgroundNode.shadowOffset = CGSizeMake(0, 4);
}

- (void)setupTaskItemNodes:(NSArray<NSDictionary *> *)todos isLatest:(BOOL)isLatest {
  NSMutableArray<ASDisplayNode *> *nodes = [NSMutableArray array];

  for (NSDictionary *todo in todos) {
    NSString *content = todo[@"content"] ?: @"";
    NSString *status = todo[@"status"] ?: @"pending";

    BOOL isCompleted = [status isEqualToString:@"completed"];
    BOOL isActive = [status isEqualToString:@"in_progress"];

    // Container for task item
    ASDisplayNode *itemContainer = [[ASDisplayNode alloc] init];
    itemContainer.automaticallyManagesSubnodes = YES;
    itemContainer.backgroundColor = [UIColor clearColor];

    // Status icon and text
    ASTextNode *statusIcon = [[ASTextNode alloc] init];
    ASTextNode *textNode = [[ASTextNode alloc] init];

    // Configure status icon
    if (isCompleted) {
      // Green checkmark
      statusIcon.attributedText = [[NSAttributedString alloc]
                                   initWithString:@"✓"
                                   attributes:@{
        NSFontAttributeName: [UIFont systemFontOfSize:12 weight:UIFontWeightBold],
        NSForegroundColorAttributeName: TaskCardGreen()
      }];
    } else if (isActive) {
      // White spinner-like bullet
      statusIcon.attributedText = [[NSAttributedString alloc]
                                   initWithString:@"●"
                                   attributes:@{
        NSFontAttributeName: [UIFont systemFontOfSize:8],
        NSForegroundColorAttributeName: [UIColor whiteColor]
      }];
    } else {
      // Gray bullet for pending
      statusIcon.attributedText = [[NSAttributedString alloc]
                                   initWithString:@"○"
                                   attributes:@{
        NSFontAttributeName: [UIFont systemFontOfSize:10],
        NSForegroundColorAttributeName: TaskCardWhite50()
      }];
    }

    // Configure text with appropriate opacity (matching old ChatView styling)
    UIColor *textColor;
    if (isCompleted) {
      textColor = TaskCardWhite40(); // Completed: dimmer
    } else if (isActive) {
      textColor = [UIColor whiteColor]; // Active: full white
    } else {
      textColor = TaskCardWhite50(); // Pending: medium opacity
    }

    NSMutableDictionary *textAttributes = [NSMutableDictionary dictionaryWithDictionary:@{
      NSFontAttributeName: [UIFont systemFontOfSize:14],
      NSForegroundColorAttributeName: textColor
    }];

    if (isCompleted) {
      textAttributes[NSStrikethroughStyleAttributeName] = @(NSUnderlineStyleSingle);
    }

    textNode.attributedText = [[NSAttributedString alloc]
                               initWithString:content
                               attributes:textAttributes];
    textNode.maximumNumberOfLines = 1;
    textNode.truncationMode = NSLineBreakByTruncatingTail;

    // HIG: Accessibility - combine icon + text for VoiceOver
    statusIcon.isAccessibilityElement = NO; // Part of group
    textNode.isAccessibilityElement = YES;
    NSString *statusLabel = isCompleted ? @"Completed" : (isActive ? @"In progress" : @"Pending");
    textNode.accessibilityLabel = [NSString stringWithFormat:@"%@, %@", content, statusLabel];
    textNode.accessibilityTraits = isCompleted ? UIAccessibilityTraitStaticText : UIAccessibilityTraitNone;

    // Store references for layout
    itemContainer.style.flexShrink = 1.0;

    // Create combined node
    NSArray *itemParts = @[statusIcon, textNode];
    NSDictionary *userInfo = @{
      @"icon": statusIcon,
      @"text": textNode,
      @"isActive": @(isActive && isLatest)
    };
    objc_setAssociatedObject(itemContainer, "itemParts", userInfo, OBJC_ASSOCIATION_RETAIN_NONATOMIC);

    [nodes addObject:itemContainer];
  }

  _taskItemNodes = nodes;
}

#pragma mark - Visible State

- (void)didEnterVisibleState {
  [super didEnterVisibleState];

  // Animate card appearance with spring animation
  // HIG: Uses iOS 17+ spring animation with Reduce Motion support
  if (self.view) {
    [EXCellAnimationHelper prepareForAppearAnimation:self.view style:EXCellAnimationStyleSpringIn];
    [EXCellAnimationHelper animateAppearance:self.view style:EXCellAnimationStyleSpringIn delay:0 completion:nil];
  }

  // Apply shimmer to active tasks when this is the latest task card
  for (ASDisplayNode *itemContainer in self.taskItemNodes) {
    NSDictionary *userInfo = objc_getAssociatedObject(itemContainer, "itemParts");
    if (userInfo && [userInfo[@"isActive"] boolValue]) {
      ASTextNode *textNode = userInfo[@"text"];
      if (textNode.view) {
        [EXTextShimmerHelper applyShimmerToTextNode:textNode.view duration:1.5];
      }
    }
  }
}

- (void)didExitVisibleState {
  [super didExitVisibleState];

  // Remove shimmer
  for (ASDisplayNode *itemContainer in self.taskItemNodes) {
    NSDictionary *userInfo = objc_getAssociatedObject(itemContainer, "itemParts");
    if (userInfo && [userInfo[@"isActive"] boolValue]) {
      ASTextNode *textNode = userInfo[@"text"];
      if (textNode.view) {
        [EXTextShimmerHelper removeShimmerFromTextNode:textNode.view];
      }
    }
  }
}

- (void)dealloc {
  // Remove shimmer from all active tasks
  for (ASDisplayNode *itemContainer in self.taskItemNodes) {
    NSDictionary *userInfo = objc_getAssociatedObject(itemContainer, "itemParts");
    if (userInfo) {
      ASTextNode *textNode = userInfo[@"text"];
      if (textNode.view) {
        [EXTextShimmerHelper removeShimmerFromTextNode:textNode.view];
      }
    }
  }
}

#pragma mark - ASDisplayNode Layout

- (ASLayoutSpec *)layoutSpecThatFits:(ASSizeRange)constrainedSize {
  // Status dot sizing
  self.statusDotNode.style.preferredSize = CGSizeMake(6, 6);

  // Header: TASKS | dot | flex spacer | count
  ASLayoutSpec *flexSpacer = [[ASLayoutSpec alloc] init];
  flexSpacer.style.flexGrow = 1.0;

  ASStackLayoutSpec *headerStack = [ASStackLayoutSpec
                                    stackLayoutSpecWithDirection:ASStackLayoutDirectionHorizontal
                                    spacing:0
                                    justifyContent:ASStackLayoutJustifyContentStart
                                    alignItems:ASStackLayoutAlignItemsCenter
                                    children:@[
                                      self.headerTitleNode,
                                      [self spacerWithWidth:8],
                                      self.statusDotNode,
                                      flexSpacer,
                                      self.countNode
                                    ]];

  // Header insets
  UIEdgeInsets headerInsets = UIEdgeInsetsMake(12, 14, 10, 14);
  ASInsetLayoutSpec *headerInset = [ASInsetLayoutSpec insetLayoutSpecWithInsets:headerInsets
                                                                          child:headerStack];

  // Build task items vertical stack
  NSMutableArray<ASLayoutSpec *> *taskLayoutSpecs = [NSMutableArray array];

  for (NSInteger i = 0; i < self.taskItemNodes.count; i++) {
    ASDisplayNode *itemContainer = self.taskItemNodes[i];
    NSDictionary *userInfo = objc_getAssociatedObject(itemContainer, "itemParts");

    if (userInfo) {
      ASTextNode *iconNode = userInfo[@"icon"];
      ASTextNode *textNode = userInfo[@"text"];

      textNode.style.flexShrink = 1.0;
      textNode.style.flexGrow = 1.0;

      ASStackLayoutSpec *rowStack = [ASStackLayoutSpec
                                     stackLayoutSpecWithDirection:ASStackLayoutDirectionHorizontal
                                     spacing:10
                                     justifyContent:ASStackLayoutJustifyContentStart
                                     alignItems:ASStackLayoutAlignItemsCenter
                                     children:@[iconNode, textNode]];

      UIEdgeInsets rowInsets = UIEdgeInsetsMake(4, 14, 4, 14);
      ASInsetLayoutSpec *rowInset = [ASInsetLayoutSpec insetLayoutSpecWithInsets:rowInsets
                                                                           child:rowStack];
      [taskLayoutSpecs addObject:rowInset];
    }
  }

  // Tasks vertical stack
  ASStackLayoutSpec *tasksStack = [ASStackLayoutSpec
                                   stackLayoutSpecWithDirection:ASStackLayoutDirectionVertical
                                   spacing:0
                                   justifyContent:ASStackLayoutJustifyContentStart
                                   alignItems:ASStackLayoutAlignItemsStretch
                                   children:taskLayoutSpecs];

  // Bottom padding for tasks
  UIEdgeInsets tasksBottomInsets = UIEdgeInsetsMake(0, 0, 8, 0);
  ASInsetLayoutSpec *tasksInset = [ASInsetLayoutSpec insetLayoutSpecWithInsets:tasksBottomInsets
                                                                         child:tasksStack];

  // Header separator (hairline)
  ASDisplayNode *separatorNode = [[ASDisplayNode alloc] init];
  separatorNode.backgroundColor = TaskCardWhite15();
  separatorNode.style.height = ASDimensionMake(0.5);

  // Combine header + separator + tasks
  ASStackLayoutSpec *contentStack = [ASStackLayoutSpec
                                     stackLayoutSpecWithDirection:ASStackLayoutDirectionVertical
                                     spacing:0
                                     justifyContent:ASStackLayoutJustifyContentStart
                                     alignItems:ASStackLayoutAlignItemsStretch
                                     children:@[headerInset, separatorNode, tasksInset]];

  // Apply glass/blur background
  ASBackgroundLayoutSpec *backgroundSpec = [ASBackgroundLayoutSpec
                                            backgroundLayoutSpecWithChild:contentStack
                                            background:self.backgroundNode];

  // Outer margin - with safe area insets for left/right
  UIEdgeInsets outerInsets = UIEdgeInsetsMake(10, 16, 10, 16);
  return [ASInsetLayoutSpec insetLayoutSpecWithInsets:outerInsets child:backgroundSpec];
}

- (ASLayoutSpec *)spacerWithWidth:(CGFloat)width {
  ASLayoutSpec *spacer = [[ASLayoutSpec alloc] init];
  spacer.style.width = ASDimensionMake(width);
  return spacer;
}

@end
