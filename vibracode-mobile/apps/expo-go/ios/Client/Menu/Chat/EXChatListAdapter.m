// Copyright 2015-present 650 Industries. All rights reserved.

#import "EXChatListAdapter.h"
#import "EXChatMessageNode.h"
#import "EXChatStatusNode.h"
#import "EXChatGroupNode.h"
#import "EXChatTaskCardNode.h"
#import <SDWebImage/SDWebImage.h>

// Chat message model for IGListKit diffing
@interface EXChatMessageModel : NSObject <IGListDiffable>
@property (nonatomic, copy) NSString *identifier;
@property (nonatomic, copy) NSString *type; // "message", "group", "status"
@property (nonatomic, strong) NSDictionary *data;
@property (nonatomic, assign) BOOL isLatest;
@property (nonatomic, assign) BOOL isExpanded;
@end

@implementation EXChatMessageModel

- (nonnull id<NSObject>)diffIdentifier {
  return self.identifier;
}

- (BOOL)isEqualToDiffableObject:(nullable id<IGListDiffable>)object {
  if (self == object) return YES;
  if (![(id)object isKindOfClass:[EXChatMessageModel class]]) return NO;

  EXChatMessageModel *other = (EXChatMessageModel *)object;
  return [self.identifier isEqualToString:other.identifier] &&
         [self.type isEqualToString:other.type] &&
         self.isLatest == other.isLatest &&
         self.isExpanded == other.isExpanded &&
         [self.data isEqualToDictionary:other.data];
}

@end

// Status model for IGListKit
@interface EXChatStatusModel : NSObject <IGListDiffable>
@property (nonatomic, copy) NSString *statusMessage;
@property (nonatomic, assign) BOOL isWorking;
@end

@implementation EXChatStatusModel

- (nonnull id<NSObject>)diffIdentifier {
  return @"__status__";
}

- (BOOL)isEqualToDiffableObject:(nullable id<IGListDiffable>)object {
  if (self == object) return YES;
  if (![(id)object isKindOfClass:[EXChatStatusModel class]]) return NO;

  EXChatStatusModel *other = (EXChatStatusModel *)object;
  return [self.statusMessage isEqualToString:other.statusMessage ?: @""] &&
         self.isWorking == other.isWorking;
}

@end

@interface EXChatListAdapter () <ASCollectionDelegate, ASCollectionDataSource>

@property (nonatomic, strong) ASCollectionNode *internalCollectionNode;
@property (nonatomic, strong) IGListAdapter *adapter;
@property (nonatomic, strong) NSArray<id<IGListDiffable>> *models;
@property (nonatomic, weak) UIViewController *viewController;
@property (nonatomic, strong) EXChatStatusModel *statusModel;
@property (nonatomic, strong) NSDictionary<NSString *, NSNumber *> *expandedGroups;
@property (nonatomic, copy) NSString *latestExpandableGroupId;
@property (nonatomic, strong) SDWebImagePrefetcher *imagePrefetcher;
@property (nonatomic, assign) NSUInteger lastDataHash; // Track content hash to avoid unnecessary reloads
@property (nonatomic, assign) BOOL wasAtBottom; // Track if user was at bottom before update
@property (nonatomic, assign) NSUInteger lastModelCount; // Track model count to detect new content
@property (nonatomic, assign) BOOL isBatchUpdateInProgress; // Prevent concurrent batch updates
@property (nonatomic, strong) dispatch_queue_t updateQueue; // Serial queue for thread-safe updates
@property (nonatomic, assign) NSUInteger updateSequence; // Monotonically increasing sequence number

@end

@implementation EXChatListAdapter

@synthesize cellAppearanceAnimationsEnabled = _cellAppearanceAnimationsEnabled;

- (instancetype)initWithViewController:(UIViewController *)viewController
                         containerView:(UIView *)containerView {
  self = [super init];
  if (self) {
    _viewController = viewController;
    _models = @[];
    _expandedGroups = @{};
    _cellAppearanceAnimationsEnabled = YES; // Enable by default
    _updateQueue = dispatch_queue_create("com.expo.chatlist.update", DISPATCH_QUEUE_SERIAL);
    _updateSequence = 0;

    // Create Texture ASCollectionNode with flow layout
    UICollectionViewFlowLayout *layout = [[UICollectionViewFlowLayout alloc] init];
    layout.minimumLineSpacing = 0;
    layout.minimumInteritemSpacing = 0;
    // Do NOT use automaticSize - let Texture handle sizing via layoutSpecThatFits
    layout.estimatedItemSize = CGSizeZero;

    _internalCollectionNode = [[ASCollectionNode alloc] initWithCollectionViewLayout:layout];
    _internalCollectionNode.backgroundColor = [UIColor clearColor];
    _internalCollectionNode.view.alwaysBounceVertical = YES;
    _internalCollectionNode.view.keyboardDismissMode = UIScrollViewKeyboardDismissModeInteractive;
    _internalCollectionNode.view.contentInsetAdjustmentBehavior = UIScrollViewContentInsetAdjustmentNever;
    _internalCollectionNode.view.showsVerticalScrollIndicator = YES;
    _internalCollectionNode.view.showsHorizontalScrollIndicator = NO;

    // Enable selection for tap handling on group headers
    _internalCollectionNode.view.allowsSelection = YES;

    // Increased bottom padding to ensure latest message can be scrolled fully into view
    // The container is positioned above the bottom bar, but we need extra inset so
    // users can scroll the last message above the visual fold. 180pt provides comfortable
    // spacing for input bar height (~60-80pt) plus breathing room.
    _internalCollectionNode.view.contentInset = UIEdgeInsetsMake(0, 0, 180, 0);
    _internalCollectionNode.view.scrollIndicatorInsets = UIEdgeInsetsMake(0, 0, 180, 0);

    // Set Texture delegates
    _internalCollectionNode.delegate = self;
    _internalCollectionNode.dataSource = self;

    // Enable Texture's intelligent prefetching via range controller
    // prefetchingEnabled=NO for UICollectionView because Texture manages this
    _internalCollectionNode.view.prefetchingEnabled = NO;
    // Configure Texture's range controller for smooth scrolling
    // leadingScreensForBatching: preload cells 2 screens ahead
    _internalCollectionNode.leadingScreensForBatching = 2.0;

    // Add to container
    _internalCollectionNode.view.translatesAutoresizingMaskIntoConstraints = NO;
    [containerView addSubview:_internalCollectionNode.view];

    [NSLayoutConstraint activateConstraints:@[
      [_internalCollectionNode.view.topAnchor constraintEqualToAnchor:containerView.topAnchor],
      [_internalCollectionNode.view.leadingAnchor constraintEqualToAnchor:containerView.leadingAnchor],
      [_internalCollectionNode.view.trailingAnchor constraintEqualToAnchor:containerView.trailingAnchor],
      [_internalCollectionNode.view.bottomAnchor constraintEqualToAnchor:containerView.bottomAnchor]
    ]];

    // Configure SDWebImage for optimal performance
    [self configureImageCache];
  }
  return self;
}

- (ASCollectionNode *)collectionNode {
  return _internalCollectionNode;
}

- (UICollectionView *)collectionView {
  return _internalCollectionNode.view;
}

- (void)configureImageCache {
  // Configure SDWebImage cache
  SDImageCache *cache = [SDImageCache sharedImageCache];
  cache.config.maxMemoryCost = 100 * 1024 * 1024; // 100MB memory cache
  cache.config.maxDiskSize = 500 * 1024 * 1024;   // 500MB disk cache
  cache.config.diskCacheExpireType = SDImageCacheConfigExpireTypeAccessDate;
  cache.config.maxDiskAge = 60 * 60 * 24 * 7;     // 1 week

  // Configure downloader (SDWebImage 5.x API)
  SDWebImageDownloader *downloader = [SDWebImageDownloader sharedDownloader];
  downloader.config.maxConcurrentDownloads = 6;

  // Initialize prefetcher for smooth scrolling
  _imagePrefetcher = [[SDWebImagePrefetcher alloc] init];
  _imagePrefetcher.maxConcurrentPrefetchCount = 3; // Don't overwhelm network
}

#pragma mark - Data Management

- (void)updateWithMessages:(NSArray<NSDictionary *> *)messages
            groupedMessages:(NSArray<NSDictionary *> *)groupedMessages
           expandedGroups:(NSDictionary<NSString *, NSNumber *> *)expandedGroups
         latestExpandableGroupId:(nullable NSString *)latestGroupId
                 animated:(BOOL)animated {
  [self updateWithMessages:messages
           groupedMessages:groupedMessages
            expandedGroups:expandedGroups
    latestExpandableGroupId:latestGroupId
                  animated:animated
                completion:nil];
}

- (void)updateWithMessages:(NSArray<NSDictionary *> *)messages
            groupedMessages:(NSArray<NSDictionary *> *)groupedMessages
           expandedGroups:(NSDictionary<NSString *, NSNumber *> *)expandedGroups
         latestExpandableGroupId:(nullable NSString *)latestGroupId
                 animated:(BOOL)animated
               completion:(nullable void (^)(void))completion {

  // CRITICAL: Serialize all updates through the update queue to prevent race conditions
  // Increment sequence number to track which update is "current"
  NSUInteger currentSequence = ++self.updateSequence;

  // If a batch update is already in progress, fall back to reloadData
  // This prevents section count mismatches during rapid updates
  if (self.isBatchUpdateInProgress) {
    NSLog(@"⚠️ [ChatListAdapter] Batch update in progress (seq: %lu), queueing update", (unsigned long)currentSequence);
    __weak typeof(self) weakSelf = self;
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.05 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
      // Check if this update is still relevant
      if (weakSelf.updateSequence != currentSequence) {
        NSLog(@"⚠️ [ChatListAdapter] Skipping stale update (seq: %lu, current: %lu)", (unsigned long)currentSequence, (unsigned long)weakSelf.updateSequence);
        if (completion) completion();
        return;
      }
      [weakSelf updateWithMessages:messages
                   groupedMessages:groupedMessages
                    expandedGroups:expandedGroups
            latestExpandableGroupId:latestGroupId
                          animated:animated
                        completion:completion];
    });
    return;
  }

  // Quick hash check to avoid unnecessary processing
  // Combine count + first/last item IDs + expanded state
  NSUInteger dataHash = groupedMessages.count;
  if (groupedMessages.count > 0) {
    dataHash ^= [groupedMessages.firstObject[@"id"] hash];
    dataHash ^= [groupedMessages.lastObject[@"id"] hash];
    dataHash ^= [groupedMessages.lastObject[@"content"] hash];
  }
  dataHash ^= [latestGroupId hash];
  dataHash ^= [expandedGroups hash];

  // Skip if data hasn't changed
  if (dataHash == self.lastDataHash && self.models.count > 0) {
    if (completion) completion();
    return;
  }
  self.lastDataHash = dataHash;

  self.expandedGroups = expandedGroups ?: @{};
  self.latestExpandableGroupId = latestGroupId;

  NSMutableArray<id<IGListDiffable>> *newModels = [NSMutableArray array];

  // Convert grouped messages to models
  for (NSDictionary *group in groupedMessages) {
    NSString *groupId = group[@"id"];
    NSString *type = group[@"type"];

    BOOL isLatest = [groupId isEqualToString:latestGroupId];
    // Check expanded state from user's toggle; isLatest only determines the initial default
    // If user has explicitly toggled this group, respect their choice
    BOOL hasExplicitState = expandedGroups[groupId] != nil;
    BOOL isExpanded = hasExplicitState ? [expandedGroups[groupId] boolValue] : isLatest;

    EXChatMessageModel *model = [[EXChatMessageModel alloc] init];
    model.identifier = groupId;
    model.type = type;
    model.data = group;
    model.isLatest = isLatest;
    model.isExpanded = isExpanded;

    [newModels addObject:model];
  }

  // ALWAYS add status model (renders as zero-height when not working)
  // This prevents layout shifts when status appears/disappears
  if (!self.statusModel) {
    self.statusModel = [[EXChatStatusModel alloc] init];
    self.statusModel.statusMessage = @"";
    self.statusModel.isWorking = NO;
  }
  [newModels addObject:self.statusModel];

  NSArray<id<IGListDiffable>> *oldModels = self.models;

  // Use IGListKit diffing for efficient batch updates instead of reloadData
  dispatch_async(dispatch_get_main_queue(), ^{
    // Check if this update is still relevant (another update may have superseded it)
    if (self.updateSequence != currentSequence) {
      NSLog(@"⚠️ [ChatListAdapter] Skipping superseded update (seq: %lu, current: %lu)", (unsigned long)currentSequence, (unsigned long)self.updateSequence);
      if (completion) completion();
      return;
    }

    // First update requires full reload with completion handler
    // CRITICAL: Use reloadDataWithCompletion so we can set scroll position
    // AFTER Texture's async layout completes
    if (oldModels.count == 0 && newModels.count > 0) {
      self.models = newModels;
      [self.internalCollectionNode reloadDataWithCompletion:^{
        if (completion) completion();
      }];
      return;
    }

    // Calculate diff using IGListKit's O(N) diffing algorithm
    IGListIndexSetResult *diffResult = IGListDiff(oldModels, newModels, IGListDiffEquality);

    // No changes - skip update
    if (!diffResult.hasChanges) {
      self.models = newModels;
      if (completion) completion();
      return;
    }

    // CRITICAL: Validate the diff result before applying
    // The expected final count should be: oldCount - deletes + inserts
    NSInteger expectedFinalCount = (NSInteger)oldModels.count - (NSInteger)diffResult.deletes.count + (NSInteger)diffResult.inserts.count;

    // If the expected count doesn't match newModels count, use reloadData instead
    // This can happen when multiple updates overlap
    if (expectedFinalCount != (NSInteger)newModels.count) {
      NSLog(@"⚠️ [ChatListAdapter] Section count mismatch detected (expected: %ld, actual: %ld), using reloadData",
            (long)expectedFinalCount, (long)newModels.count);
      self.models = newModels;
      [self.internalCollectionNode reloadDataWithCompletion:^{
        if (completion) completion();
      }];
      return;
    }

    // Double-check: verify the collection node's current section count matches oldModels
    NSInteger currentSectionCount = [self.internalCollectionNode numberOfSections];
    if (currentSectionCount != (NSInteger)oldModels.count) {
      NSLog(@"⚠️ [ChatListAdapter] Section count out of sync (collection: %ld, models: %lu), using reloadData",
            (long)currentSectionCount, (unsigned long)oldModels.count);
      self.models = newModels;
      [self.internalCollectionNode reloadDataWithCompletion:^{
        if (completion) completion();
      }];
      return;
    }

    // SAFETY: For complex diffs (many changes), use reloadData to avoid message disappearing issues
    // This prevents visual glitches when batch updates become too complex
    NSInteger totalChanges = diffResult.deletes.count + diffResult.inserts.count + diffResult.updates.count + diffResult.moves.count;
    if (totalChanges > 5) {
      NSLog(@"⚠️ [ChatListAdapter] Complex diff (%ld changes), using reloadData for stability", (long)totalChanges);
      self.models = newModels;
      [self.internalCollectionNode reloadDataWithCompletion:^{
        if (completion) completion();
      }];
      return;
    }

    // CRITICAL: Update models BEFORE batch update starts
    // The collection node's data source methods read self.models during the update
    self.models = newModels;

    // Mark batch update as in progress
    self.isBatchUpdateInProgress = YES;

    // Apply batch updates for smooth 60fps animations
    // Use completion handler so caller can set scroll position after layout
    [self.internalCollectionNode performBatchAnimated:animated updates:^{
      // Process deletes first (in reverse order to maintain indices)
      if (diffResult.deletes.count > 0) {
        [self.internalCollectionNode deleteSections:diffResult.deletes];
      }

      // Process inserts
      if (diffResult.inserts.count > 0) {
        [self.internalCollectionNode insertSections:diffResult.inserts];
      }

      // Process updates (content changes within same section)
      if (diffResult.updates.count > 0) {
        [self.internalCollectionNode reloadSections:diffResult.updates];
      }

      // Process moves
      for (IGListMoveIndex *move in diffResult.moves) {
        [self.internalCollectionNode moveSection:move.from toSection:move.to];
      }
    } completion:^(BOOL finished) {
      self.isBatchUpdateInProgress = NO;
      if (completion) completion();
    }];
  });
}

- (void)updateStatusMessage:(nullable NSString *)statusMessage
                  isWorking:(BOOL)isWorking {
  NSLog(@"🔵 [ChatListAdapter] updateStatusMessage: '%@' isWorking: %@", statusMessage, isWorking ? @"YES" : @"NO");

  // Skip if nothing changed - prevents constant reloads
  if (self.statusModel) {
    BOOL messageChanged = ![self.statusModel.statusMessage isEqualToString:statusMessage ?: @""];
    BOOL workingChanged = self.statusModel.isWorking != isWorking;
    if (!messageChanged && !workingChanged) {
      NSLog(@"🔵 [ChatListAdapter] No change, skipping update");
      return; // No change, skip reload
    }
  }

  if (!self.statusModel) {
    self.statusModel = [[EXChatStatusModel alloc] init];
  }

  self.statusModel.statusMessage = statusMessage ?: @"";
  self.statusModel.isWorking = isWorking;
  NSLog(@"🔵 [ChatListAdapter] Updated statusModel - message: '%@' isWorking: %@", self.statusModel.statusMessage, self.statusModel.isWorking ? @"YES" : @"NO");

  // Use batch updates for smooth transitions instead of full reload
  dispatch_async(dispatch_get_main_queue(), ^{
    // CRITICAL: If a batch update is in progress, skip this status update
    // The next full update will include the status correctly
    if (self.isBatchUpdateInProgress) {
      NSLog(@"⚠️ [ChatListAdapter] Batch update in progress, skipping status update");
      return;
    }

    NSMutableArray<id<IGListDiffable>> *newModels = [NSMutableArray array];

    // Copy existing non-status models
    for (id<IGListDiffable> model in self.models) {
      if (![(id)model isKindOfClass:[EXChatStatusModel class]]) {
        [newModels addObject:model];
      }
    }

    // ALWAYS add status model - it will render as zero-height when not working
    // This prevents layout shifts when status appears/disappears
    [newModels addObject:self.statusModel];

    // Check if status was already present
    BOOL hadStatusModel = NO;
    for (id<IGListDiffable> model in self.models) {
      if ([(id)model isKindOfClass:[EXChatStatusModel class]]) {
        hadStatusModel = YES;
        break;
      }
    }

    if (hadStatusModel) {
      // Status already exists - just reload its section (no insert/delete = no layout shift)
      self.models = newModels;
      NSInteger statusIndex = newModels.count - 1;
      if (statusIndex >= 0) {
        self.isBatchUpdateInProgress = YES;
        [self.internalCollectionNode performBatchAnimated:NO updates:^{
          [self.internalCollectionNode reloadSections:[NSIndexSet indexSetWithIndex:statusIndex]];
        } completion:^(BOOL finished) {
          self.isBatchUpdateInProgress = NO;
        }];
      }
      return;
    }

    // First time adding status - use IGListKit diffing
    NSArray<id<IGListDiffable>> *oldModels = self.models;
    IGListIndexSetResult *diffResult = IGListDiff(oldModels, newModels, IGListDiffEquality);

    if (!diffResult.hasChanges) {
      self.models = newModels;
      return;
    }

    // Validate section count before applying batch update
    NSInteger expectedFinalCount = (NSInteger)oldModels.count - (NSInteger)diffResult.deletes.count + (NSInteger)diffResult.inserts.count;
    if (expectedFinalCount != (NSInteger)newModels.count) {
      NSLog(@"⚠️ [ChatListAdapter] Status update section count mismatch, using reloadData");
      self.models = newModels;
      [self.internalCollectionNode reloadData];
      return;
    }

    self.models = newModels;

    self.isBatchUpdateInProgress = YES;
    [self.internalCollectionNode performBatchAnimated:YES updates:^{
      if (diffResult.deletes.count > 0) {
        [self.internalCollectionNode deleteSections:diffResult.deletes];
      }
      if (diffResult.inserts.count > 0) {
        [self.internalCollectionNode insertSections:diffResult.inserts];
      }
      if (diffResult.updates.count > 0) {
        [self.internalCollectionNode reloadSections:diffResult.updates];
      }
    } completion:^(BOOL finished) {
      self.isBatchUpdateInProgress = NO;
    }];
  });
}

#pragma mark - Group Toggle

- (void)toggleGroupExpanded:(NSString *)groupId {
  NSLog(@"🔄 [ChatListAdapter] toggleGroupExpanded: %@", groupId);

  // Find the section index for this group
  NSInteger sectionIndex = -1;
  for (NSInteger i = 0; i < self.models.count; i++) {
    id<IGListDiffable> model = self.models[i];
    if ([(id)model isKindOfClass:[EXChatMessageModel class]]) {
      EXChatMessageModel *messageModel = (EXChatMessageModel *)model;
      if ([messageModel.identifier isEqualToString:groupId]) {
        sectionIndex = i;
        break;
      }
    }
  }

  if (sectionIndex < 0) {
    NSLog(@"⚠️ [ChatListAdapter] Group not found: %@", groupId);
    return;
  }

  // If batch update is in progress, queue this operation
  if (self.isBatchUpdateInProgress) {
    NSLog(@"⚠️ [ChatListAdapter] Batch update in progress, queuing toggle");
    __weak typeof(self) weakSelf = self;
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.1 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
      [weakSelf toggleGroupExpanded:groupId];
    });
    return;
  }

  // Get the current model and toggle its expanded state
  EXChatMessageModel *currentModel = (EXChatMessageModel *)self.models[sectionIndex];
  BOOL newExpandedState = !currentModel.isExpanded;

  // Update the expandedGroups dictionary
  NSMutableDictionary *newExpandedGroups = [self.expandedGroups mutableCopy] ?: [NSMutableDictionary dictionary];
  newExpandedGroups[groupId] = @(newExpandedState);
  self.expandedGroups = newExpandedGroups;

  // Create a new model with the toggled state
  EXChatMessageModel *updatedModel = [[EXChatMessageModel alloc] init];
  updatedModel.identifier = currentModel.identifier;
  updatedModel.type = currentModel.type;
  updatedModel.data = currentModel.data;
  updatedModel.isLatest = currentModel.isLatest;
  updatedModel.isExpanded = newExpandedState;

  // Replace the model in our array
  NSMutableArray *newModels = [self.models mutableCopy];
  newModels[sectionIndex] = updatedModel;
  self.models = newModels;

  // Invalidate the data hash so next full update doesn't skip
  self.lastDataHash = 0;

  // Reload just this section (much faster than full diff)
  self.isBatchUpdateInProgress = YES;
  [self.internalCollectionNode performBatchAnimated:YES updates:^{
    [self.internalCollectionNode reloadSections:[NSIndexSet indexSetWithIndex:sectionIndex]];
  } completion:^(BOOL finished) {
    self.isBatchUpdateInProgress = NO;
    NSLog(@"✅ [ChatListAdapter] Toggle complete for: %@, expanded: %@", groupId, newExpandedState ? @"YES" : @"NO");
  }];
}

#pragma mark - Scrolling

- (void)scrollToBottom:(BOOL)animated {
  ASCollectionNode *cn = self.internalCollectionNode;

  // Use contentInset directly (not adjustedContentInset) since we set
  // contentInsetAdjustmentBehavior = Never. This ensures consistent behavior
  // regardless of safe areas or animation state.
  UIEdgeInsets insets = cn.view.contentInset;
  CGFloat contentHeight = cn.view.contentSize.height;
  CGFloat frameHeight = cn.view.bounds.size.height;

  // Maximum scroll offset: contentHeight + bottom inset - visible frame
  // We only care about bottom inset for scrolling to bottom
  CGFloat maxOffsetY = contentHeight + insets.bottom - frameHeight;

  if (maxOffsetY > 0) {
    CGPoint targetOffset = CGPointMake(0, maxOffsetY);

    if (animated) {
      UISpringTimingParameters *springParams = [[UISpringTimingParameters alloc]
          initWithDampingRatio:0.92];

      UIViewPropertyAnimator *animator = [[UIViewPropertyAnimator alloc]
          initWithDuration:0.35
          timingParameters:springParams];

      [animator addAnimations:^{
        cn.view.contentOffset = targetOffset;
      }];

      [animator startAnimation];
    } else {
      cn.view.contentOffset = targetOffset;
    }
  }
}

- (void)setInitialScrollPosition {
  // This is the synchronous version - only works if content is already laid out
  // For async Texture layouts, use setInitialScrollPositionWithCompletion: instead
  [self scrollToBottomImmediate];
}

- (void)setInitialScrollPositionWithCompletion:(void (^)(void))completion {
  // CRITICAL: Texture performs layout asynchronously.
  // We must wait for layout to complete before setting scroll position.
  // Use reloadDataWithCompletion which fires AFTER async layout is done.

  __weak typeof(self) weakSelf = self;

  // If we have existing models, reload and wait for completion
  if (self.models.count > 0) {
    [self.internalCollectionNode reloadDataWithCompletion:^{
      [weakSelf scrollToBottomImmediate];
      if (completion) {
        completion();
      }
    }];
  } else {
    // No models yet - just call completion
    if (completion) {
      completion();
    }
  }
}

- (void)scrollToBottomImmediate {
  ASCollectionNode *cn = self.internalCollectionNode;

  // Force synchronous layout to get accurate content size
  [cn.view setNeedsLayout];
  [cn.view layoutIfNeeded];

  // Use contentInset directly (not adjustedContentInset) for consistency
  UIEdgeInsets insets = cn.view.contentInset;
  CGFloat contentHeight = cn.view.contentSize.height;
  CGFloat frameHeight = cn.view.bounds.size.height;

  // Skip if no content yet
  if (contentHeight <= 0) {
    return;
  }

  // Maximum scroll offset: contentHeight + bottom inset - visible frame
  CGFloat maxOffsetY = contentHeight + insets.bottom - frameHeight;

  if (maxOffsetY > 0) {
    // Set directly without animation using CATransaction
    [CATransaction begin];
    [CATransaction setDisableActions:YES];
    cn.view.contentOffset = CGPointMake(0, maxOffsetY);
    [CATransaction commit];
  }

  // Initialize tracking state
  self.lastModelCount = self.models.count;
  self.wasAtBottom = YES;
}

- (void)scrollToBottomIfNeeded:(BOOL)onlyIfNearBottom animated:(BOOL)animated {
  ASCollectionNode *cn = self.internalCollectionNode;

  // Don't scroll if user is actively interacting
  if (cn.view.isDragging || cn.view.isDecelerating || cn.view.isTracking) {
    self.wasAtBottom = NO; // User is interacting, they're not "at bottom" anymore
    return;
  }

  UIEdgeInsets insets = cn.view.contentInset;
  CGFloat contentHeight = cn.view.contentSize.height;
  CGFloat frameHeight = cn.view.bounds.size.height;
  CGFloat currentOffsetY = cn.view.contentOffset.y;

  // Simple check: can we scroll at all?
  // Total scrollable content = contentHeight + bottom inset
  CGFloat totalContent = contentHeight + insets.bottom;
  if (totalContent <= frameHeight) {
    return; // All content is visible
  }

  // Maximum scroll offset (same calculation as scrollToBottom)
  CGFloat maxOffsetY = contentHeight + insets.bottom - frameHeight;

  // Distance from maximum scroll position
  CGFloat distanceFromBottom = maxOffsetY - currentOffsetY;

  // Are we at the bottom? (within 50pt tolerance)
  BOOL isAtBottom = distanceFromBottom <= 50;

  // Only auto-scroll if:
  // 1. New content was added (model count increased)
  // 2. AND user was previously at bottom OR onlyIfNearBottom is NO
  BOOL hasNewContent = self.models.count > self.lastModelCount;

  if (hasNewContent && (isAtBottom || !onlyIfNearBottom)) {
    [self scrollToBottom:animated];
  }

  // Update tracking
  self.lastModelCount = self.models.count;
}

#pragma mark - ASCollectionDataSource

- (NSInteger)numberOfSectionsInCollectionNode:(ASCollectionNode *)collectionNode {
  return self.models.count;
}

- (NSInteger)collectionNode:(ASCollectionNode *)collectionNode numberOfItemsInSection:(NSInteger)section {
  // All sections have exactly 1 item
  // Group headers now embed L-shape items internally when expanded
  return 1;
}

- (ASCellNodeBlock)collectionNode:(ASCollectionNode *)collectionNode nodeBlockForItemAtIndexPath:(NSIndexPath *)indexPath {
  // CRITICAL: Bounds check to prevent crash during async batch updates
  NSArray *currentModels = self.models;
  if (indexPath.section >= currentModels.count) {
    // Return empty placeholder node if index out of bounds
    return ^ASCellNode *{
      ASCellNode *placeholder = [[ASCellNode alloc] init];
      placeholder.style.preferredSize = CGSizeMake(1, 0);
      return placeholder;
    };
  }

  id<IGListDiffable> model = currentModels[indexPath.section];
  CGFloat containerWidth = collectionNode.bounds.size.width;

  // Status node
  if ([(id)model isKindOfClass:[EXChatStatusModel class]]) {
    EXChatStatusModel *statusModel = (EXChatStatusModel *)model;
    NSString *statusMessage = statusModel.statusMessage;
    BOOL isWorking = statusModel.isWorking;

    return ^ASCellNode *{
      EXChatStatusNode *node = [[EXChatStatusNode alloc] initWithStatusMessage:statusMessage
                                                                     isWorking:isWorking
                                                                         width:containerWidth];
      return node;
    };
  }

  EXChatMessageModel *messageModel = (EXChatMessageModel *)model;
  NSString *type = messageModel.type;
  NSDictionary *data = messageModel.data;
  BOOL isLatest = messageModel.isLatest;
  BOOL isExpanded = messageModel.isExpanded;
  NSString *groupId = messageModel.identifier;

  // Group types (read/edit/bash) - header with embedded L-shape items
  if ([type isEqualToString:@"read"] ||
      [type isEqualToString:@"edit"] ||
      [type isEqualToString:@"bash"]) {

    NSArray *items = nil;
    if ([type isEqualToString:@"read"] || [type isEqualToString:@"edit"]) {
      items = data[@"files"] ?: @[];
    } else if ([type isEqualToString:@"bash"]) {
      items = data[@"commands"] ?: @[];
    }

    // Capture self and groupId for the tap callback
    __weak typeof(self) weakSelf = self;
    NSString *capturedGroupId = groupId;
    NSString *capturedType = type;

    // Header with embedded L-shape items (when expanded)
    return ^ASCellNode *{
      EXChatGroupNode *node = [[EXChatGroupNode alloc] initAsHeaderWithType:capturedType
                                                                  itemCount:items.count
                                                                 isExpanded:isExpanded
                                                                   isLatest:isLatest
                                                                      width:containerWidth
                                                                      items:items];
      // Set tap callback to notify delegate
      node.onHeaderTapped = ^{
        NSLog(@"🔄 Header tap callback triggered for group: %@", capturedGroupId);
        [weakSelf.delegate chatListDidTapGroup:capturedGroupId];
      };
      return node;
    };
  }

  // Tasks type - Liquid Glass task card
  if ([type isEqualToString:@"tasks"]) {
    NSArray *todos = data[@"todos"] ?: @[];

    return ^ASCellNode *{
      EXChatTaskCardNode *node = [[EXChatTaskCardNode alloc] initWithTodos:todos
                                                                  isLatest:isLatest
                                                                     width:containerWidth];
      return node;
    };
  }

  // Regular message
  return ^ASCellNode *{
    EXChatMessageNode *node = [[EXChatMessageNode alloc] initWithData:data
                                                             isLatest:isLatest
                                                                width:containerWidth];
    return node;
  };
}

#pragma mark - ASCollectionDelegate

- (ASSizeRange)collectionNode:(ASCollectionNode *)collectionNode constrainedSizeForItemAtIndexPath:(NSIndexPath *)indexPath {
  CGFloat width = collectionNode.bounds.size.width;
  if (width <= 0) {
    width = [UIScreen mainScreen].bounds.size.width;
  }

  // Return width-constrained size range, let Texture calculate height
  return ASSizeRangeMake(CGSizeMake(width, 0), CGSizeMake(width, CGFLOAT_MAX));
}

- (void)collectionNode:(ASCollectionNode *)collectionNode didSelectItemAtIndexPath:(NSIndexPath *)indexPath {
  NSLog(@"🎯 didSelectItemAtIndexPath called: section=%ld item=%ld", (long)indexPath.section, (long)indexPath.item);

  // Deselect immediately to allow re-tapping
  [collectionNode deselectItemAtIndexPath:indexPath animated:NO];

  // NOTE: Group header taps (read/edit/bash) are handled by EXChatGroupNode's
  // own tap gesture via onHeaderTapped callback. We don't handle them here
  // to avoid double-triggering the expand/collapse action.

  // Bounds check to prevent crash
  NSArray *currentModels = self.models;
  if (indexPath.section >= currentModels.count) {
    NSLog(@"⚠️ Section %ld out of bounds (count=%lu)", (long)indexPath.section, (unsigned long)currentModels.count);
    return;
  }

  id<IGListDiffable> model = currentModels[indexPath.section];
  NSLog(@"📦 Model class: %@", NSStringFromClass([(id)model class]));

  // Future: handle taps on other cell types here if needed
}

- (void)scrollViewDidScroll:(UIScrollView *)scrollView {
  // Check if scrolled near top for loading more
  if (scrollView.contentOffset.y < 100) {
    [self.delegate chatListDidScrollToTop];
  }

  // Prefetch images for cells about to appear (2 screens ahead)
  [self prefetchImagesForVisibleRange];
}

- (void)prefetchImagesForVisibleRange {
  NSArray<NSIndexPath *> *visiblePaths = [_internalCollectionNode indexPathsForVisibleItems];
  if (visiblePaths.count == 0) return;

  // Find min/max visible sections
  NSInteger minSection = NSIntegerMax;
  NSInteger maxSection = 0;
  for (NSIndexPath *path in visiblePaths) {
    if (path.section < minSection) minSection = path.section;
    if (path.section > maxSection) maxSection = path.section;
  }

  // Prefetch 5 sections ahead of visible range
  NSInteger prefetchStart = maxSection + 1;
  NSInteger prefetchEnd = MIN(prefetchStart + 5, (NSInteger)self.models.count);

  NSMutableArray<NSURL *> *urlsToPrefetch = [NSMutableArray array];

  for (NSInteger i = prefetchStart; i < prefetchEnd; i++) {
    if (i >= self.models.count) break;

    id<IGListDiffable> model = self.models[i];
    if (![(id)model isKindOfClass:[EXChatMessageModel class]]) continue;

    EXChatMessageModel *messageModel = (EXChatMessageModel *)model;
    NSDictionary *data = messageModel.data;
    NSString *imageUrl = data[@"imageUrl"];

    if (imageUrl && imageUrl.length > 0) {
      NSURL *url = [NSURL URLWithString:imageUrl];
      if (url) {
        [urlsToPrefetch addObject:url];
      }
    }
  }

  if (urlsToPrefetch.count > 0) {
    [_imagePrefetcher prefetchURLs:urlsToPrefetch];
  }
}

#pragma mark - IGListAdapterDataSource (for compatibility)

- (NSArray<id<IGListDiffable>> *)objectsForListAdapter:(IGListAdapter *)listAdapter {
  return self.models;
}

- (IGListSectionController *)listAdapter:(IGListAdapter *)listAdapter
              sectionControllerForObject:(id)object {
  // Not used - we use ASCollectionNode directly
  return [[IGListSectionController alloc] init];
}

- (nullable UIView *)emptyViewForListAdapter:(IGListAdapter *)listAdapter {
  return nil;
}

@end
