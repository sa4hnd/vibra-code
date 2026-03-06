// Copyright 2015-present 650 Industries. All rights reserved.

#import "EXPreviewZoomManager+Private.h"
#import "EXPreviewZoomManager.h"
#import "EXChatBackendService.h"
#import <UIKit/UIKit.h>

// Forward declarations
@class EXFilesModalViewController;
@class EXFileNode;

// File Node Model
@interface EXFileNode : NSObject

@property(nonatomic, strong) NSString *name;
@property(nonatomic, strong) NSString *path;
@property(nonatomic, assign) BOOL isDirectory;
@property(nonatomic, assign) NSInteger size;
@property(nonatomic, strong) NSMutableArray<EXFileNode *> *children;
@property(nonatomic, assign) BOOL isExpanded;
@property(nonatomic, assign) NSInteger depth;
@property(nonatomic, weak) EXFileNode *parent;

+ (instancetype)nodeWithDictionary:(NSDictionary *)dict depth:(NSInteger)depth parent:(EXFileNode *)parent;

@end

@implementation EXFileNode

+ (instancetype)nodeWithDictionary:(NSDictionary *)dict depth:(NSInteger)depth parent:(EXFileNode *)parent {
  EXFileNode *node = [[EXFileNode alloc] init];
  node.name = dict[@"name"] ?: @"";
  node.path = dict[@"path"] ?: @"";
  node.isDirectory = [dict[@"type"] isEqualToString:@"dir"];
  node.size = [dict[@"size"] integerValue];
  node.children = [NSMutableArray array];
  node.isExpanded = NO;
  node.depth = depth;
  node.parent = parent;
  return node;
}

@end

// Files Modal View Controller
@interface EXFilesModalViewController : UIViewController <UITableViewDataSource, UITableViewDelegate, UIAdaptivePresentationControllerDelegate, UISearchBarDelegate>

@property(nonatomic, weak) EXPreviewZoomManager *manager;
@property(nonatomic, strong) UITableView *treeTableView;
@property(nonatomic, strong) UITextView *contentTextView;
@property(nonatomic, strong) UIView *contentPanel;
@property(nonatomic, strong) UIView *treePanel;
@property(nonatomic, strong) UILabel *titleLabel;
@property(nonatomic, strong) UIButton *closeButton;
@property(nonatomic, strong) UILabel *filePathLabel;
@property(nonatomic, strong) UILabel *fileStatsLabel;
@property(nonatomic, strong) UILabel *emptyContentLabel;
@property(nonatomic, strong) UIActivityIndicatorView *loadingIndicator;
@property(nonatomic, strong) UIActivityIndicatorView *contentLoadingIndicator;
@property(nonatomic, strong) UIVisualEffectView *backgroundView;
@property(nonatomic, strong) UISearchBar *searchBar;
@property(nonatomic, strong) UIView *headerView;
@property(nonatomic, strong) UIView *breadcrumbView;
@property(nonatomic, strong) UILabel *breadcrumbLabel;
@property(nonatomic, strong) UIScrollView *lineNumberView;
@property(nonatomic, strong) UILabel *lineNumberLabel;

@property(nonatomic, strong) NSMutableArray<EXFileNode *> *visibleNodes;
@property(nonatomic, strong) NSMutableArray<EXFileNode *> *filteredNodes;
@property(nonatomic, strong) NSMutableDictionary<NSString *, NSArray *> *directoryCache;
@property(nonatomic, strong) NSMutableDictionary<NSString *, NSString *> *contentCache;
@property(nonatomic, strong) NSMutableSet<NSString *> *expandedPaths;
@property(nonatomic, strong) NSMutableSet<NSString *> *loadingPaths;
@property(nonatomic, strong) EXFileNode *selectedNode;
@property(nonatomic, strong) NSString *searchText;
@property(nonatomic, assign) BOOL isSearching;

- (instancetype)initWithManager:(EXPreviewZoomManager *)manager;

@end

// Category implementation
@implementation EXPreviewZoomManager (FilesModal)

- (void)showFilesModal {
  if (self.filesModalPresented) {
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

  EXFilesModalViewController *modalVC = [[EXFilesModalViewController alloc] initWithManager:self];

  UINavigationController *navController = [[UINavigationController alloc] initWithRootViewController:modalVC];
  navController.view.backgroundColor = [UIColor clearColor];
  navController.navigationBarHidden = YES;

  self.filesModalViewController = navController;

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
  self.filesModalPresented = YES;
}

@end

// MARK: - EXFilesModalViewController Implementation

@implementation EXFilesModalViewController

- (instancetype)initWithManager:(EXPreviewZoomManager *)manager {
  self = [super init];
  if (self) {
    _manager = manager;
    _visibleNodes = [NSMutableArray array];
    _filteredNodes = [NSMutableArray array];
    _directoryCache = [NSMutableDictionary dictionary];
    _contentCache = [NSMutableDictionary dictionary];
    _expandedPaths = [NSMutableSet set];
    _loadingPaths = [NSMutableSet set];
    _selectedNode = nil;
    _searchText = @"";
    _isSearching = NO;
  }
  return self;
}

- (void)viewDidLoad {
  [super viewDidLoad];

  self.view.backgroundColor = [UIColor clearColor];

  [self setupBackground];
  [self setupHeader];
  [self setupSearchBar];
  [self setupPanels];
  [self setupBreadcrumb];
  [self setupLoadingIndicators];
  [self setupConstraints];

  [self loadRootDirectory];
}

- (void)viewWillAppear:(BOOL)animated {
  [super viewWillAppear:animated];
  [self.navigationController setNavigationBarHidden:YES animated:animated];
}

- (void)presentationControllerDidDismiss:(UIPresentationController *)presentationController {
  self.manager.filesModalPresented = NO;
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
  // Header container
  self.headerView = [[UIView alloc] init];
  self.headerView.translatesAutoresizingMaskIntoConstraints = NO;
  self.headerView.backgroundColor = [UIColor clearColor];
  [self.view addSubview:self.headerView];

  // Title with folder icon - more prominent
  UIImageSymbolConfiguration *folderConfig = [UIImageSymbolConfiguration configurationWithPointSize:22 weight:UIImageSymbolWeightBold];
  UIImage *folderImage = [UIImage systemImageNamed:@"folder.fill" withConfiguration:folderConfig];
  UIImageView *folderIcon = [[UIImageView alloc] initWithImage:folderImage];
  folderIcon.tintColor = [UIColor colorWithRed:0.35 green:0.55 blue:0.95 alpha:1.0];
  folderIcon.translatesAutoresizingMaskIntoConstraints = NO;
  [self.headerView addSubview:folderIcon];

  self.titleLabel = [[UILabel alloc] init];
  self.titleLabel.text = @"Project Files";
  self.titleLabel.textColor = [UIColor whiteColor];
  self.titleLabel.font = [UIFont systemFontOfSize:22 weight:UIFontWeightBold];
  self.titleLabel.translatesAutoresizingMaskIntoConstraints = NO;
  [self.headerView addSubview:self.titleLabel];

  // Close button - pill style
  self.closeButton = [UIButton buttonWithType:UIButtonTypeSystem];
  self.closeButton.translatesAutoresizingMaskIntoConstraints = NO;
  self.closeButton.backgroundColor = [UIColor colorWithWhite:0.2 alpha:0.8];
  self.closeButton.layer.cornerRadius = 16;
  self.closeButton.clipsToBounds = YES;

  UIImageSymbolConfiguration *closeConfig = [UIImageSymbolConfiguration configurationWithPointSize:12 weight:UIImageSymbolWeightBold];
  UIImage *closeImage = [UIImage systemImageNamed:@"xmark" withConfiguration:closeConfig];
  [self.closeButton setImage:closeImage forState:UIControlStateNormal];
  self.closeButton.tintColor = [UIColor colorWithWhite:0.7 alpha:1.0];
  [self.closeButton addTarget:self action:@selector(closeTapped:) forControlEvents:UIControlEventTouchUpInside];
  [self.headerView addSubview:self.closeButton];

  [NSLayoutConstraint activateConstraints:@[
    [self.headerView.topAnchor constraintEqualToAnchor:self.view.safeAreaLayoutGuide.topAnchor constant:8],
    [self.headerView.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor],
    [self.headerView.trailingAnchor constraintEqualToAnchor:self.view.trailingAnchor],
    [self.headerView.heightAnchor constraintEqualToConstant:48],

    [folderIcon.leadingAnchor constraintEqualToAnchor:self.headerView.leadingAnchor constant:20],
    [folderIcon.centerYAnchor constraintEqualToAnchor:self.headerView.centerYAnchor],
    [folderIcon.widthAnchor constraintEqualToConstant:26],
    [folderIcon.heightAnchor constraintEqualToConstant:26],

    [self.titleLabel.leadingAnchor constraintEqualToAnchor:folderIcon.trailingAnchor constant:12],
    [self.titleLabel.centerYAnchor constraintEqualToAnchor:folderIcon.centerYAnchor],

    [self.closeButton.trailingAnchor constraintEqualToAnchor:self.headerView.trailingAnchor constant:-20],
    [self.closeButton.centerYAnchor constraintEqualToAnchor:self.headerView.centerYAnchor],
    [self.closeButton.widthAnchor constraintEqualToConstant:32],
    [self.closeButton.heightAnchor constraintEqualToConstant:32]
  ]];
}

- (void)setupSearchBar {
  self.searchBar = [[UISearchBar alloc] init];
  self.searchBar.translatesAutoresizingMaskIntoConstraints = NO;
  self.searchBar.placeholder = @"Search files...";
  self.searchBar.delegate = self;
  self.searchBar.searchBarStyle = UISearchBarStyleMinimal;
  self.searchBar.barTintColor = [UIColor clearColor];
  self.searchBar.backgroundColor = [UIColor clearColor];

  // Style the text field
  if (@available(iOS 13.0, *)) {
    self.searchBar.searchTextField.backgroundColor = [UIColor colorWithWhite:0.12 alpha:0.8];
    self.searchBar.searchTextField.textColor = [UIColor whiteColor];
    self.searchBar.searchTextField.tintColor = [UIColor colorWithRed:0.35 green:0.55 blue:0.95 alpha:1.0];
    self.searchBar.searchTextField.layer.cornerRadius = 12;
    self.searchBar.searchTextField.clipsToBounds = YES;

    UIImageSymbolConfiguration *searchConfig = [UIImageSymbolConfiguration configurationWithPointSize:14 weight:UIImageSymbolWeightMedium];
    UIImage *searchIcon = [UIImage systemImageNamed:@"magnifyingglass" withConfiguration:searchConfig];
    self.searchBar.searchTextField.leftView = [[UIImageView alloc] initWithImage:searchIcon];
    self.searchBar.searchTextField.leftView.tintColor = [UIColor colorWithWhite:0.5 alpha:1.0];
  }

  [self.view addSubview:self.searchBar];
}

- (void)setupBreadcrumb {
  self.breadcrumbView = [[UIView alloc] init];
  self.breadcrumbView.translatesAutoresizingMaskIntoConstraints = NO;
  self.breadcrumbView.backgroundColor = [UIColor colorWithWhite:0.1 alpha:0.6];
  self.breadcrumbView.layer.cornerRadius = 8;
  self.breadcrumbView.hidden = YES;
  [self.contentPanel addSubview:self.breadcrumbView];

  // Breadcrumb icon
  UIImageSymbolConfiguration *pathConfig = [UIImageSymbolConfiguration configurationWithPointSize:11 weight:UIImageSymbolWeightMedium];
  UIImage *pathIcon = [UIImage systemImageNamed:@"chevron.right" withConfiguration:pathConfig];
  UIImageView *pathIconView = [[UIImageView alloc] initWithImage:pathIcon];
  pathIconView.tintColor = [UIColor colorWithWhite:0.4 alpha:1.0];
  pathIconView.translatesAutoresizingMaskIntoConstraints = NO;
  [self.breadcrumbView addSubview:pathIconView];

  self.breadcrumbLabel = [[UILabel alloc] init];
  self.breadcrumbLabel.translatesAutoresizingMaskIntoConstraints = NO;
  self.breadcrumbLabel.textColor = [UIColor colorWithRed:0.5 green:0.75 blue:0.95 alpha:1.0];
  self.breadcrumbLabel.font = [UIFont monospacedSystemFontOfSize:11 weight:UIFontWeightMedium];
  self.breadcrumbLabel.lineBreakMode = NSLineBreakByTruncatingMiddle;
  [self.breadcrumbView addSubview:self.breadcrumbLabel];

  [NSLayoutConstraint activateConstraints:@[
    [self.breadcrumbView.topAnchor constraintEqualToAnchor:self.contentPanel.topAnchor constant:12],
    [self.breadcrumbView.leadingAnchor constraintEqualToAnchor:self.contentPanel.leadingAnchor constant:12],
    [self.breadcrumbView.trailingAnchor constraintLessThanOrEqualToAnchor:self.contentPanel.trailingAnchor constant:-12],
    [self.breadcrumbView.heightAnchor constraintEqualToConstant:28],

    [pathIconView.leadingAnchor constraintEqualToAnchor:self.breadcrumbView.leadingAnchor constant:10],
    [pathIconView.centerYAnchor constraintEqualToAnchor:self.breadcrumbView.centerYAnchor],
    [pathIconView.widthAnchor constraintEqualToConstant:10],

    [self.breadcrumbLabel.leadingAnchor constraintEqualToAnchor:pathIconView.trailingAnchor constant:6],
    [self.breadcrumbLabel.trailingAnchor constraintEqualToAnchor:self.breadcrumbView.trailingAnchor constant:-10],
    [self.breadcrumbLabel.centerYAnchor constraintEqualToAnchor:self.breadcrumbView.centerYAnchor]
  ]];

  // Content panel inner constraints (moved here from setupPanels because they depend on breadcrumbView)
  [NSLayoutConstraint activateConstraints:@[
    [self.contentTextView.topAnchor constraintEqualToAnchor:self.breadcrumbView.bottomAnchor constant:8],
    [self.contentTextView.leadingAnchor constraintEqualToAnchor:self.contentPanel.leadingAnchor constant:4],
    [self.contentTextView.trailingAnchor constraintEqualToAnchor:self.contentPanel.trailingAnchor constant:-4],
    [self.contentTextView.bottomAnchor constraintEqualToAnchor:self.fileStatsLabel.topAnchor constant:-8],

    [self.fileStatsLabel.leadingAnchor constraintEqualToAnchor:self.contentPanel.leadingAnchor constant:16],
    [self.fileStatsLabel.trailingAnchor constraintEqualToAnchor:self.contentPanel.trailingAnchor constant:-16],
    [self.fileStatsLabel.bottomAnchor constraintEqualToAnchor:self.contentPanel.bottomAnchor constant:-12],
    [self.fileStatsLabel.heightAnchor constraintEqualToConstant:16]
  ]];
}

- (void)setupPanels {
  // Tree panel with rounded corners and subtle border
  self.treePanel = [[UIView alloc] init];
  self.treePanel.translatesAutoresizingMaskIntoConstraints = NO;
  self.treePanel.backgroundColor = [UIColor colorWithWhite:0.08 alpha:0.7];
  self.treePanel.layer.cornerRadius = 16;
  self.treePanel.layer.borderWidth = 1;
  self.treePanel.layer.borderColor = [UIColor colorWithWhite:0.15 alpha:0.5].CGColor;
  self.treePanel.clipsToBounds = YES;
  [self.view addSubview:self.treePanel];

  // Tree table view
  self.treeTableView = [[UITableView alloc] initWithFrame:CGRectZero style:UITableViewStylePlain];
  self.treeTableView.translatesAutoresizingMaskIntoConstraints = NO;
  self.treeTableView.backgroundColor = [UIColor clearColor];
  self.treeTableView.separatorStyle = UITableViewCellSeparatorStyleNone;
  self.treeTableView.dataSource = self;
  self.treeTableView.delegate = self;
  self.treeTableView.contentInset = UIEdgeInsetsMake(8, 0, 8, 0);
  self.treeTableView.showsVerticalScrollIndicator = NO;
  [self.treeTableView registerClass:[UITableViewCell class] forCellReuseIdentifier:@"TreeCell"];
  [self.treePanel addSubview:self.treeTableView];

  // Content panel with rounded corners
  self.contentPanel = [[UIView alloc] init];
  self.contentPanel.translatesAutoresizingMaskIntoConstraints = NO;
  self.contentPanel.backgroundColor = [UIColor colorWithWhite:0.05 alpha:0.9];
  self.contentPanel.layer.cornerRadius = 16;
  self.contentPanel.layer.borderWidth = 1;
  self.contentPanel.layer.borderColor = [UIColor colorWithWhite:0.15 alpha:0.5].CGColor;
  self.contentPanel.clipsToBounds = YES;
  [self.view addSubview:self.contentPanel];

  // File path label - moved to breadcrumb
  self.filePathLabel = [[UILabel alloc] init];
  self.filePathLabel.translatesAutoresizingMaskIntoConstraints = NO;
  self.filePathLabel.textColor = [UIColor colorWithRed:0.4 green:0.7 blue:0.9 alpha:1.0];
  self.filePathLabel.font = [UIFont monospacedSystemFontOfSize:12 weight:UIFontWeightMedium];
  self.filePathLabel.hidden = YES;
  [self.contentPanel addSubview:self.filePathLabel];

  // Content text view with better styling
  self.contentTextView = [[UITextView alloc] init];
  self.contentTextView.translatesAutoresizingMaskIntoConstraints = NO;
  self.contentTextView.backgroundColor = [UIColor clearColor];
  self.contentTextView.textColor = [UIColor colorWithWhite:0.88 alpha:1.0];
  self.contentTextView.font = [UIFont monospacedSystemFontOfSize:13 weight:UIFontWeightRegular];
  self.contentTextView.editable = NO;
  self.contentTextView.showsVerticalScrollIndicator = YES;
  self.contentTextView.indicatorStyle = UIScrollViewIndicatorStyleWhite;
  self.contentTextView.textContainerInset = UIEdgeInsetsMake(12, 12, 12, 12);
  self.contentTextView.hidden = YES;
  [self.contentPanel addSubview:self.contentTextView];

  // File stats label - bottom bar style
  self.fileStatsLabel = [[UILabel alloc] init];
  self.fileStatsLabel.translatesAutoresizingMaskIntoConstraints = NO;
  self.fileStatsLabel.textColor = [UIColor colorWithWhite:0.45 alpha:1.0];
  self.fileStatsLabel.font = [UIFont monospacedSystemFontOfSize:11 weight:UIFontWeightMedium];
  self.fileStatsLabel.textAlignment = NSTextAlignmentLeft;
  self.fileStatsLabel.hidden = YES;
  [self.contentPanel addSubview:self.fileStatsLabel];

  // Empty content label with icon
  UIView *emptyStateView = [[UIView alloc] init];
  emptyStateView.translatesAutoresizingMaskIntoConstraints = NO;
  [self.contentPanel addSubview:emptyStateView];

  UIImageSymbolConfiguration *emptyConfig = [UIImageSymbolConfiguration configurationWithPointSize:40 weight:UIImageSymbolWeightLight];
  UIImage *emptyImage = [UIImage systemImageNamed:@"doc.text.magnifyingglass" withConfiguration:emptyConfig];
  UIImageView *emptyIcon = [[UIImageView alloc] initWithImage:emptyImage];
  emptyIcon.tintColor = [UIColor colorWithWhite:0.25 alpha:1.0];
  emptyIcon.translatesAutoresizingMaskIntoConstraints = NO;
  [emptyStateView addSubview:emptyIcon];

  self.emptyContentLabel = [[UILabel alloc] init];
  self.emptyContentLabel.translatesAutoresizingMaskIntoConstraints = NO;
  self.emptyContentLabel.text = @"Select a file to preview";
  self.emptyContentLabel.textColor = [UIColor colorWithWhite:0.35 alpha:1.0];
  self.emptyContentLabel.font = [UIFont systemFontOfSize:15 weight:UIFontWeightMedium];
  self.emptyContentLabel.textAlignment = NSTextAlignmentCenter;
  [emptyStateView addSubview:self.emptyContentLabel];

  [NSLayoutConstraint activateConstraints:@[
    [emptyStateView.centerXAnchor constraintEqualToAnchor:self.contentPanel.centerXAnchor],
    [emptyStateView.centerYAnchor constraintEqualToAnchor:self.contentPanel.centerYAnchor],

    [emptyIcon.centerXAnchor constraintEqualToAnchor:emptyStateView.centerXAnchor],
    [emptyIcon.topAnchor constraintEqualToAnchor:emptyStateView.topAnchor],

    [self.emptyContentLabel.topAnchor constraintEqualToAnchor:emptyIcon.bottomAnchor constant:12],
    [self.emptyContentLabel.centerXAnchor constraintEqualToAnchor:emptyStateView.centerXAnchor],
    [self.emptyContentLabel.bottomAnchor constraintEqualToAnchor:emptyStateView.bottomAnchor]
  ]];

  // Tree table constraints
  [NSLayoutConstraint activateConstraints:@[
    [self.treeTableView.topAnchor constraintEqualToAnchor:self.treePanel.topAnchor],
    [self.treeTableView.leadingAnchor constraintEqualToAnchor:self.treePanel.leadingAnchor],
    [self.treeTableView.trailingAnchor constraintEqualToAnchor:self.treePanel.trailingAnchor],
    [self.treeTableView.bottomAnchor constraintEqualToAnchor:self.treePanel.bottomAnchor]
  ]];

  // NOTE: Content panel inner constraints (contentTextView, fileStatsLabel) are set in setupBreadcrumb
  // because they depend on breadcrumbView which is created there
}

- (void)setupLoadingIndicators {
  self.loadingIndicator = [[UIActivityIndicatorView alloc] initWithActivityIndicatorStyle:UIActivityIndicatorViewStyleMedium];
  self.loadingIndicator.translatesAutoresizingMaskIntoConstraints = NO;
  self.loadingIndicator.color = [UIColor colorWithRed:0.35 green:0.55 blue:0.95 alpha:1.0];
  self.loadingIndicator.hidesWhenStopped = YES;
  [self.treePanel addSubview:self.loadingIndicator];

  self.contentLoadingIndicator = [[UIActivityIndicatorView alloc] initWithActivityIndicatorStyle:UIActivityIndicatorViewStyleMedium];
  self.contentLoadingIndicator.translatesAutoresizingMaskIntoConstraints = NO;
  self.contentLoadingIndicator.color = [UIColor colorWithRed:0.35 green:0.55 blue:0.95 alpha:1.0];
  self.contentLoadingIndicator.hidesWhenStopped = YES;
  [self.contentPanel addSubview:self.contentLoadingIndicator];

  [NSLayoutConstraint activateConstraints:@[
    [self.loadingIndicator.centerXAnchor constraintEqualToAnchor:self.treePanel.centerXAnchor],
    [self.loadingIndicator.centerYAnchor constraintEqualToAnchor:self.treePanel.centerYAnchor],

    [self.contentLoadingIndicator.centerXAnchor constraintEqualToAnchor:self.contentPanel.centerXAnchor],
    [self.contentLoadingIndicator.centerYAnchor constraintEqualToAnchor:self.contentPanel.centerYAnchor]
  ]];
}

- (void)setupConstraints {
  CGFloat panelSpacing = 12;
  CGFloat sidePadding = 16;

  // Responsive layout based on size class
  BOOL isCompact = self.traitCollection.horizontalSizeClass == UIUserInterfaceSizeClassCompact;

  // Search bar constraints
  [NSLayoutConstraint activateConstraints:@[
    [self.searchBar.topAnchor constraintEqualToAnchor:self.headerView.bottomAnchor constant:8],
    [self.searchBar.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor constant:8],
    [self.searchBar.trailingAnchor constraintEqualToAnchor:self.view.trailingAnchor constant:-8],
    [self.searchBar.heightAnchor constraintEqualToConstant:44]
  ]];

  if (isCompact) {
    // Vertical stack for phones - tree on top, content below
    [NSLayoutConstraint activateConstraints:@[
      [self.treePanel.topAnchor constraintEqualToAnchor:self.searchBar.bottomAnchor constant:12],
      [self.treePanel.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor constant:sidePadding],
      [self.treePanel.trailingAnchor constraintEqualToAnchor:self.view.trailingAnchor constant:-sidePadding],
      [self.treePanel.heightAnchor constraintEqualToAnchor:self.view.heightAnchor multiplier:0.32],

      [self.contentPanel.topAnchor constraintEqualToAnchor:self.treePanel.bottomAnchor constant:panelSpacing],
      [self.contentPanel.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor constant:sidePadding],
      [self.contentPanel.trailingAnchor constraintEqualToAnchor:self.view.trailingAnchor constant:-sidePadding],
      [self.contentPanel.bottomAnchor constraintEqualToAnchor:self.view.safeAreaLayoutGuide.bottomAnchor constant:-sidePadding]
    ]];
  } else {
    // Side by side for iPad/large screens
    [NSLayoutConstraint activateConstraints:@[
      [self.treePanel.topAnchor constraintEqualToAnchor:self.searchBar.bottomAnchor constant:12],
      [self.treePanel.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor constant:sidePadding],
      [self.treePanel.widthAnchor constraintEqualToConstant:300],
      [self.treePanel.bottomAnchor constraintEqualToAnchor:self.view.safeAreaLayoutGuide.bottomAnchor constant:-sidePadding],

      [self.contentPanel.topAnchor constraintEqualToAnchor:self.searchBar.bottomAnchor constant:12],
      [self.contentPanel.leadingAnchor constraintEqualToAnchor:self.treePanel.trailingAnchor constant:panelSpacing],
      [self.contentPanel.trailingAnchor constraintEqualToAnchor:self.view.trailingAnchor constant:-sidePadding],
      [self.contentPanel.bottomAnchor constraintEqualToAnchor:self.view.safeAreaLayoutGuide.bottomAnchor constant:-sidePadding]
    ]];
  }
}

#pragma mark - UISearchBarDelegate

- (void)searchBar:(UISearchBar *)searchBar textDidChange:(NSString *)searchText {
  self.searchText = searchText;
  self.isSearching = searchText.length > 0;
  [self filterNodes];
  [self.treeTableView reloadData];
}

- (void)searchBarSearchButtonClicked:(UISearchBar *)searchBar {
  [searchBar resignFirstResponder];
}

- (void)filterNodes {
  [self.filteredNodes removeAllObjects];

  if (!self.isSearching) {
    return;
  }

  NSString *lowercaseSearch = self.searchText.lowercaseString;

  for (EXFileNode *node in self.visibleNodes) {
    if ([node.name.lowercaseString containsString:lowercaseSearch]) {
      [self.filteredNodes addObject:node];
    }
  }
}

#pragma mark - Actions

- (void)closeTapped:(UIButton *)sender {
  [self dismissViewControllerAnimated:YES completion:^{
    self.manager.filesModalPresented = NO;
  }];
}

#pragma mark - Data Loading

- (void)loadRootDirectory {
  NSString *sandboxId = self.manager.sandboxId;
  if (!sandboxId || sandboxId.length == 0) {
    NSString *convexId = self.manager.chatSessionId;
    if (!convexId || convexId.length == 0) {
      NSLog(@"[FilesModal] No session ID available");
      return;
    }

    [self.loadingIndicator startAnimating];

    [[EXChatBackendService sharedInstance] getSessionById:convexId completion:^(NSDictionary *session, NSError *error) {
      dispatch_async(dispatch_get_main_queue(), ^{
        if (error || !session) {
          [self.loadingIndicator stopAnimating];
          NSLog(@"[FilesModal] Error fetching session: %@", error);
          return;
        }

        NSString *sessionSandboxId = session[@"sessionId"];
        if ([sessionSandboxId isKindOfClass:[NSString class]] && sessionSandboxId.length > 0) {
          self.manager.sandboxId = sessionSandboxId;
          [self loadDirectoryAtPath:@"/vibe0"];
        } else {
          [self.loadingIndicator stopAnimating];
        }
      });
    }];
    return;
  }

  [self loadDirectoryAtPath:@"/vibe0"];
}

- (void)loadDirectoryAtPath:(NSString *)path {
  if (self.directoryCache[path] || [self.loadingPaths containsObject:path]) {
    return;
  }

  NSString *sandboxId = self.manager.sandboxId;
  if (!sandboxId) return;

  [self.loadingPaths addObject:path];

  if ([path isEqualToString:@"/vibe0"]) {
    [self.loadingIndicator startAnimating];
  }

  [[EXChatBackendService sharedInstance] listFilesAtPath:path sessionId:sandboxId completion:^(NSArray<NSDictionary *> *entries, NSError *error) {
    dispatch_async(dispatch_get_main_queue(), ^{
      [self.loadingPaths removeObject:path];
      [self.loadingIndicator stopAnimating];

      if (error || !entries) {
        NSLog(@"[FilesModal] Error loading %@: %@", path, error);
        return;
      }

      self.directoryCache[path] = entries;
      [self rebuildVisibleNodes];
      [self.treeTableView reloadData];
    });
  }];
}

- (void)rebuildVisibleNodes {
  [self.visibleNodes removeAllObjects];

  NSArray *rootEntries = self.directoryCache[@"/vibe0"];
  if (!rootEntries) return;

  NSArray *sorted = [self sortEntries:rootEntries];
  for (NSDictionary *entry in sorted) {
    EXFileNode *node = [EXFileNode nodeWithDictionary:entry depth:0 parent:nil];
    [self.visibleNodes addObject:node];

    if (node.isDirectory && [self.expandedPaths containsObject:node.path]) {
      node.isExpanded = YES;
      [self addChildrenForNode:node];
    }
  }

  // Update filtered nodes if searching
  if (self.isSearching) {
    [self filterNodes];
  }
}

- (void)addChildrenForNode:(EXFileNode *)parent {
  NSArray *entries = self.directoryCache[parent.path];
  if (!entries) return;

  NSArray *sorted = [self sortEntries:entries];
  for (NSDictionary *entry in sorted) {
    EXFileNode *node = [EXFileNode nodeWithDictionary:entry depth:parent.depth + 1 parent:parent];
    [self.visibleNodes addObject:node];

    if (node.isDirectory && [self.expandedPaths containsObject:node.path]) {
      node.isExpanded = YES;
      [self addChildrenForNode:node];
    }
  }
}

- (NSArray *)sortEntries:(NSArray *)entries {
  return [entries sortedArrayUsingComparator:^NSComparisonResult(NSDictionary *a, NSDictionary *b) {
    BOOL aIsDir = [a[@"type"] isEqualToString:@"dir"];
    BOOL bIsDir = [b[@"type"] isEqualToString:@"dir"];
    if (aIsDir != bIsDir) {
      return aIsDir ? NSOrderedAscending : NSOrderedDescending;
    }
    return [a[@"name"] compare:b[@"name"] options:NSCaseInsensitiveSearch];
  }];
}

- (void)toggleNode:(EXFileNode *)node {
  if (!node.isDirectory) return;

  if ([self.expandedPaths containsObject:node.path]) {
    [self.expandedPaths removeObject:node.path];
    node.isExpanded = NO;
  } else {
    [self.expandedPaths addObject:node.path];
    node.isExpanded = YES;

    if (!self.directoryCache[node.path]) {
      [self loadDirectoryAtPath:node.path];
      return;
    }
  }

  [self rebuildVisibleNodes];
  [self.treeTableView reloadData];
}

- (void)selectFile:(EXFileNode *)node {
  if (node.isDirectory) return;

  self.selectedNode = node;
  [self.treeTableView reloadData];

  // Show loading state
  self.emptyContentLabel.superview.hidden = YES;
  self.contentTextView.hidden = YES;
  self.breadcrumbView.hidden = YES;
  self.fileStatsLabel.hidden = YES;
  [self.contentLoadingIndicator startAnimating];

  // Check cache
  NSString *cached = self.contentCache[node.path];
  if (cached) {
    [self displayContent:cached forNode:node];
    return;
  }

  NSString *sandboxId = self.manager.sandboxId;
  if (!sandboxId) return;

  [[EXChatBackendService sharedInstance] readFileAtPath:node.path sessionId:sandboxId completion:^(NSString *content, NSError *error) {
    dispatch_async(dispatch_get_main_queue(), ^{
      [self.contentLoadingIndicator stopAnimating];

      if (error) {
        self.contentTextView.text = [NSString stringWithFormat:@"Error: %@", error.localizedDescription];
        self.contentTextView.hidden = NO;
        return;
      }

      if (content) {
        self.contentCache[node.path] = content;
        [self displayContent:content forNode:node];
      }
    });
  }];
}

- (void)displayContent:(NSString *)content forNode:(EXFileNode *)node {
  [self.contentLoadingIndicator stopAnimating];

  // Update breadcrumb
  self.breadcrumbLabel.text = node.path;
  self.breadcrumbView.hidden = NO;

  // Hide empty state
  self.emptyContentLabel.superview.hidden = YES;

  // Apply syntax-aware coloring
  self.contentTextView.attributedText = [self attributedStringForContent:content filename:node.name];
  self.contentTextView.hidden = NO;

  // Format file stats nicely
  NSArray *lines = [content componentsSeparatedByString:@"\n"];
  NSString *ext = [node.name pathExtension].lowercaseString;
  NSString *language = [self languageNameForExtension:ext];

  NSString *sizeStr = [self formatFileSize:content.length];
  self.fileStatsLabel.text = [NSString stringWithFormat:@"%@  •  %lu lines  •  %@", language, (unsigned long)lines.count, sizeStr];
  self.fileStatsLabel.hidden = NO;

  [self.contentTextView setContentOffset:CGPointZero animated:NO];
}

- (NSString *)formatFileSize:(NSUInteger)bytes {
  if (bytes < 1024) {
    return [NSString stringWithFormat:@"%lu B", (unsigned long)bytes];
  } else if (bytes < 1024 * 1024) {
    return [NSString stringWithFormat:@"%.1f KB", bytes / 1024.0];
  } else {
    return [NSString stringWithFormat:@"%.1f MB", bytes / (1024.0 * 1024.0)];
  }
}

- (NSString *)languageNameForExtension:(NSString *)ext {
  NSDictionary *langMap = @{
    @"ts": @"TypeScript",
    @"tsx": @"TypeScript React",
    @"js": @"JavaScript",
    @"jsx": @"JavaScript React",
    @"py": @"Python",
    @"swift": @"Swift",
    @"m": @"Objective-C",
    @"h": @"Header",
    @"c": @"C",
    @"cpp": @"C++",
    @"java": @"Java",
    @"go": @"Go",
    @"rs": @"Rust",
    @"rb": @"Ruby",
    @"php": @"PHP",
    @"json": @"JSON",
    @"yaml": @"YAML",
    @"yml": @"YAML",
    @"xml": @"XML",
    @"html": @"HTML",
    @"css": @"CSS",
    @"scss": @"SCSS",
    @"md": @"Markdown",
    @"txt": @"Plain Text",
    @"sql": @"SQL",
  };
  return langMap[ext] ?: @"File";
}

- (NSAttributedString *)attributedStringForContent:(NSString *)content filename:(NSString *)filename {
  UIFont *font = [UIFont monospacedSystemFontOfSize:13 weight:UIFontWeightRegular];
  UIColor *baseColor = [UIColor colorWithWhite:0.88 alpha:1.0];

  NSMutableAttributedString *attributed = [[NSMutableAttributedString alloc] initWithString:content attributes:@{
    NSFontAttributeName: font,
    NSForegroundColorAttributeName: baseColor
  }];

  NSString *ext = [filename pathExtension].lowercaseString;

  // Code files - add keyword highlighting
  NSSet *codeExts = [NSSet setWithObjects:@"ts", @"tsx", @"js", @"jsx", @"swift", @"m", @"h", @"py", @"go", @"rs", nil];
  if ([codeExts containsObject:ext]) {
    [self applyCodeHighlightingTo:attributed];
  }

  // JSON files
  if ([ext isEqualToString:@"json"]) {
    [self applyJSONHighlightingTo:attributed];
  }

  return attributed;
}

- (void)applyCodeHighlightingTo:(NSMutableAttributedString *)attributed {
  NSString *content = attributed.string;

  // Keywords - purple/pink
  UIColor *keywordColor = [UIColor colorWithRed:0.78 green:0.45 blue:0.85 alpha:1.0];
  NSArray *keywords = @[@"import", @"export", @"from", @"const", @"let", @"var", @"function", @"return", @"if", @"else", @"for", @"while", @"class", @"interface", @"type", @"extends", @"implements", @"new", @"this", @"super", @"async", @"await", @"try", @"catch", @"throw", @"default", @"switch", @"case", @"break", @"continue", @"true", @"false", @"null", @"undefined"];

  for (NSString *keyword in keywords) {
    NSString *pattern = [NSString stringWithFormat:@"\\b%@\\b", keyword];
    NSRegularExpression *regex = [NSRegularExpression regularExpressionWithPattern:pattern options:0 error:nil];
    NSArray *matches = [regex matchesInString:content options:0 range:NSMakeRange(0, content.length)];
    for (NSTextCheckingResult *match in matches) {
      [attributed addAttribute:NSForegroundColorAttributeName value:keywordColor range:match.range];
    }
  }

  // Strings (double and single quoted) - green
  UIColor *stringColor = [UIColor colorWithRed:0.55 green:0.82 blue:0.48 alpha:1.0];
  NSRegularExpression *stringRegex = [NSRegularExpression regularExpressionWithPattern:@"([\"'])(?:\\\\.|[^\"'\\\\])*?\\1" options:0 error:nil];
  NSArray *stringMatches = [stringRegex matchesInString:content options:0 range:NSMakeRange(0, content.length)];
  for (NSTextCheckingResult *match in stringMatches) {
    [attributed addAttribute:NSForegroundColorAttributeName value:stringColor range:match.range];
  }

  // Comments - gray
  UIColor *commentColor = [UIColor colorWithWhite:0.5 alpha:1.0];
  NSRegularExpression *commentRegex = [NSRegularExpression regularExpressionWithPattern:@"//.*$" options:NSRegularExpressionAnchorsMatchLines error:nil];
  NSArray *commentMatches = [commentRegex matchesInString:content options:0 range:NSMakeRange(0, content.length)];
  for (NSTextCheckingResult *match in commentMatches) {
    [attributed addAttribute:NSForegroundColorAttributeName value:commentColor range:match.range];
  }

  // Numbers - orange
  UIColor *numberColor = [UIColor colorWithRed:0.95 green:0.72 blue:0.38 alpha:1.0];
  NSRegularExpression *numberRegex = [NSRegularExpression regularExpressionWithPattern:@"\\b\\d+(\\.\\d+)?\\b" options:0 error:nil];
  NSArray *numberMatches = [numberRegex matchesInString:content options:0 range:NSMakeRange(0, content.length)];
  for (NSTextCheckingResult *match in numberMatches) {
    [attributed addAttribute:NSForegroundColorAttributeName value:numberColor range:match.range];
  }

  // Function calls - blue
  UIColor *functionColor = [UIColor colorWithRed:0.45 green:0.68 blue:0.95 alpha:1.0];
  NSRegularExpression *functionRegex = [NSRegularExpression regularExpressionWithPattern:@"\\b([a-zA-Z_][a-zA-Z0-9_]*)\\s*\\(" options:0 error:nil];
  NSArray *functionMatches = [functionRegex matchesInString:content options:0 range:NSMakeRange(0, content.length)];
  for (NSTextCheckingResult *match in functionMatches) {
    if (match.numberOfRanges > 1) {
      [attributed addAttribute:NSForegroundColorAttributeName value:functionColor range:[match rangeAtIndex:1]];
    }
  }
}

- (void)applyJSONHighlightingTo:(NSMutableAttributedString *)attributed {
  NSString *content = attributed.string;

  // Keys (quoted strings followed by colon) - cyan
  UIColor *keyColor = [UIColor colorWithRed:0.55 green:0.82 blue:0.95 alpha:1.0];
  NSRegularExpression *keyRegex = [NSRegularExpression regularExpressionWithPattern:@"\"([^\"]+)\"\\s*:" options:0 error:nil];
  NSArray *keyMatches = [keyRegex matchesInString:content options:0 range:NSMakeRange(0, content.length)];
  for (NSTextCheckingResult *match in keyMatches) {
    if (match.numberOfRanges > 0) {
      [attributed addAttribute:NSForegroundColorAttributeName value:keyColor range:[match rangeAtIndex:0]];
    }
  }

  // String values - green
  UIColor *stringColor = [UIColor colorWithRed:0.55 green:0.82 blue:0.48 alpha:1.0];
  NSRegularExpression *valueRegex = [NSRegularExpression regularExpressionWithPattern:@":\\s*\"([^\"]*)\"" options:0 error:nil];
  NSArray *valueMatches = [valueRegex matchesInString:content options:0 range:NSMakeRange(0, content.length)];
  for (NSTextCheckingResult *match in valueMatches) {
    [attributed addAttribute:NSForegroundColorAttributeName value:stringColor range:match.range];
  }

  // Numbers and booleans - orange
  UIColor *numberColor = [UIColor colorWithRed:0.95 green:0.72 blue:0.38 alpha:1.0];
  NSRegularExpression *numRegex = [NSRegularExpression regularExpressionWithPattern:@":\\s*(\\d+(\\.\\d+)?|true|false|null)" options:0 error:nil];
  NSArray *numMatches = [numRegex matchesInString:content options:0 range:NSMakeRange(0, content.length)];
  for (NSTextCheckingResult *match in numMatches) {
    if (match.numberOfRanges > 1) {
      [attributed addAttribute:NSForegroundColorAttributeName value:numberColor range:[match rangeAtIndex:1]];
    }
  }
}

#pragma mark - File Icons

- (NSString *)iconNameForNode:(EXFileNode *)node {
  if (node.isDirectory) {
    return node.isExpanded ? @"folder.fill" : @"folder.fill";
  }

  NSString *ext = [node.name pathExtension].lowercaseString;
  NSString *name = node.name.lowercaseString;

  // Special files
  if ([name isEqualToString:@"package.json"]) return @"shippingbox.fill";
  if ([name hasPrefix:@".env"]) return @"key.fill";
  if ([name isEqualToString:@".gitignore"]) return @"eye.slash.fill";
  if ([name hasPrefix:@"readme"]) return @"doc.text.fill";
  if ([name isEqualToString:@"dockerfile"]) return @"shippingbox.fill";

  NSDictionary *iconMap = @{
    // Code files
    @"ts": @"chevron.left.forwardslash.chevron.right",
    @"tsx": @"chevron.left.forwardslash.chevron.right",
    @"js": @"chevron.left.forwardslash.chevron.right",
    @"jsx": @"chevron.left.forwardslash.chevron.right",
    @"py": @"chevron.left.forwardslash.chevron.right",
    @"swift": @"swift",
    @"m": @"chevron.left.forwardslash.chevron.right",
    @"h": @"chevron.left.forwardslash.chevron.right",
    @"c": @"chevron.left.forwardslash.chevron.right",
    @"cpp": @"chevron.left.forwardslash.chevron.right",
    @"java": @"chevron.left.forwardslash.chevron.right",
    @"go": @"chevron.left.forwardslash.chevron.right",
    @"rs": @"chevron.left.forwardslash.chevron.right",
    @"rb": @"chevron.left.forwardslash.chevron.right",
    @"php": @"chevron.left.forwardslash.chevron.right",
    // Config
    @"json": @"curlybraces",
    @"yaml": @"doc.badge.gearshape.fill",
    @"yml": @"doc.badge.gearshape.fill",
    @"toml": @"doc.badge.gearshape.fill",
    @"xml": @"doc.badge.gearshape.fill",
    // Docs
    @"md": @"doc.text.fill",
    @"txt": @"doc.text.fill",
    @"rtf": @"doc.text.fill",
    // Styles
    @"css": @"paintbrush.fill",
    @"scss": @"paintbrush.fill",
    @"sass": @"paintbrush.fill",
    @"less": @"paintbrush.fill",
    // Images
    @"png": @"photo.fill",
    @"jpg": @"photo.fill",
    @"jpeg": @"photo.fill",
    @"gif": @"photo.fill",
    @"svg": @"photo.fill",
    @"webp": @"photo.fill",
    @"ico": @"photo.fill",
    // Web
    @"html": @"globe",
    @"htm": @"globe",
    // Data
    @"csv": @"tablecells.fill",
    @"sql": @"cylinder.fill",
    // Lock files
    @"lock": @"lock.fill",
  };

  return iconMap[ext] ?: @"doc.fill";
}

- (UIColor *)iconColorForNode:(EXFileNode *)node {
  if (node.isDirectory) {
    return node.isExpanded
      ? [UIColor colorWithRed:0.35 green:0.6 blue:0.95 alpha:1.0]
      : [UIColor colorWithRed:0.45 green:0.65 blue:0.95 alpha:1.0];
  }

  NSString *ext = [node.name pathExtension].lowercaseString;
  NSString *name = node.name.lowercaseString;

  // Special files
  if ([name hasPrefix:@".env"]) return [UIColor colorWithRed:0.95 green:0.78 blue:0.28 alpha:1.0];
  if ([name isEqualToString:@"package.json"]) return [UIColor colorWithRed:0.92 green:0.38 blue:0.38 alpha:1.0];

  // Code - green
  NSSet *codeExts = [NSSet setWithObjects:@"ts", @"tsx", @"js", @"jsx", @"py", @"swift", @"m", @"h", @"c", @"cpp", @"java", @"go", @"rs", @"rb", @"php", nil];
  if ([codeExts containsObject:ext]) {
    return [UIColor colorWithRed:0.45 green:0.82 blue:0.52 alpha:1.0];
  }

  // Config - yellow
  NSSet *configExts = [NSSet setWithObjects:@"json", @"yaml", @"yml", @"toml", @"xml", nil];
  if ([configExts containsObject:ext]) {
    return [UIColor colorWithRed:0.98 green:0.82 blue:0.32 alpha:1.0];
  }

  // Styles - pink
  NSSet *styleExts = [NSSet setWithObjects:@"css", @"scss", @"sass", @"less", nil];
  if ([styleExts containsObject:ext]) {
    return [UIColor colorWithRed:0.92 green:0.48 blue:0.68 alpha:1.0];
  }

  // Images - purple
  NSSet *imageExts = [NSSet setWithObjects:@"png", @"jpg", @"jpeg", @"gif", @"svg", @"webp", @"ico", nil];
  if ([imageExts containsObject:ext]) {
    return [UIColor colorWithRed:0.72 green:0.52 blue:0.92 alpha:1.0];
  }

  // Docs - blue
  NSSet *docExts = [NSSet setWithObjects:@"md", @"txt", @"rtf", nil];
  if ([docExts containsObject:ext]) {
    return [UIColor colorWithRed:0.52 green:0.72 blue:0.92 alpha:1.0];
  }

  return [UIColor colorWithWhite:0.58 alpha:1.0];
}

#pragma mark - UITableViewDataSource

- (NSInteger)tableView:(UITableView *)tableView numberOfRowsInSection:(NSInteger)section {
  return self.isSearching ? self.filteredNodes.count : self.visibleNodes.count;
}

- (UITableViewCell *)tableView:(UITableView *)tableView cellForRowAtIndexPath:(NSIndexPath *)indexPath {
  UITableViewCell *cell = [tableView dequeueReusableCellWithIdentifier:@"TreeCell" forIndexPath:indexPath];

  for (UIView *subview in cell.contentView.subviews) {
    [subview removeFromSuperview];
  }

  NSArray *nodes = self.isSearching ? self.filteredNodes : self.visibleNodes;
  if (indexPath.row >= nodes.count) return cell;

  EXFileNode *node = nodes[indexPath.row];
  BOOL isSelected = (self.selectedNode == node && !node.isDirectory);

  cell.backgroundColor = [UIColor clearColor];
  cell.selectionStyle = UITableViewCellSelectionStyleNone;

  // Selection highlight with rounded corners
  if (isSelected) {
    UIView *highlight = [[UIView alloc] init];
    highlight.backgroundColor = [UIColor colorWithRed:0.25 green:0.45 blue:0.65 alpha:0.5];
    highlight.layer.cornerRadius = 8;
    highlight.translatesAutoresizingMaskIntoConstraints = NO;
    [cell.contentView addSubview:highlight];
    [cell.contentView sendSubviewToBack:highlight];

    [NSLayoutConstraint activateConstraints:@[
      [highlight.topAnchor constraintEqualToAnchor:cell.contentView.topAnchor constant:2],
      [highlight.leadingAnchor constraintEqualToAnchor:cell.contentView.leadingAnchor constant:8],
      [highlight.trailingAnchor constraintEqualToAnchor:cell.contentView.trailingAnchor constant:-8],
      [highlight.bottomAnchor constraintEqualToAnchor:cell.contentView.bottomAnchor constant:-2]
    ]];
  }

  CGFloat indent = self.isSearching ? 12 : (12 + (node.depth * 18));

  // Chevron for directories
  UIImageView *chevron = nil;
  if (node.isDirectory && !self.isSearching) {
    UIImageSymbolConfiguration *chevronConfig = [UIImageSymbolConfiguration configurationWithPointSize:10 weight:UIImageSymbolWeightBold];
    NSString *chevronName = node.isExpanded ? @"chevron.down" : @"chevron.right";
    UIImage *chevronImage = [UIImage systemImageNamed:chevronName withConfiguration:chevronConfig];
    chevron = [[UIImageView alloc] initWithImage:chevronImage];
    chevron.tintColor = [UIColor colorWithWhite:0.5 alpha:1.0];
    chevron.translatesAutoresizingMaskIntoConstraints = NO;
    [cell.contentView addSubview:chevron];
  }

  // File icon
  UIImageSymbolConfiguration *iconConfig = [UIImageSymbolConfiguration configurationWithPointSize:14 weight:UIImageSymbolWeightMedium];
  NSString *iconName = [self iconNameForNode:node];
  UIImage *iconImage = [UIImage systemImageNamed:iconName withConfiguration:iconConfig];
  UIImageView *icon = [[UIImageView alloc] initWithImage:iconImage];
  icon.tintColor = [self iconColorForNode:node];
  icon.translatesAutoresizingMaskIntoConstraints = NO;
  [cell.contentView addSubview:icon];

  // Name label
  UILabel *nameLabel = [[UILabel alloc] init];
  nameLabel.text = node.name;
  nameLabel.textColor = isSelected ? [UIColor whiteColor] : [UIColor colorWithWhite:0.92 alpha:1.0];
  nameLabel.font = [UIFont systemFontOfSize:14 weight:isSelected ? UIFontWeightSemibold : UIFontWeightMedium];
  nameLabel.translatesAutoresizingMaskIntoConstraints = NO;
  [cell.contentView addSubview:nameLabel];

  if (chevron) {
    [NSLayoutConstraint activateConstraints:@[
      [chevron.leadingAnchor constraintEqualToAnchor:cell.contentView.leadingAnchor constant:indent],
      [chevron.centerYAnchor constraintEqualToAnchor:cell.contentView.centerYAnchor],
      [chevron.widthAnchor constraintEqualToConstant:12],
      [chevron.heightAnchor constraintEqualToConstant:12],

      [icon.leadingAnchor constraintEqualToAnchor:chevron.trailingAnchor constant:8],
      [icon.centerYAnchor constraintEqualToAnchor:cell.contentView.centerYAnchor],
      [icon.widthAnchor constraintEqualToConstant:18],
      [icon.heightAnchor constraintEqualToConstant:18],

      [nameLabel.leadingAnchor constraintEqualToAnchor:icon.trailingAnchor constant:10],
      [nameLabel.centerYAnchor constraintEqualToAnchor:cell.contentView.centerYAnchor],
      [nameLabel.trailingAnchor constraintLessThanOrEqualToAnchor:cell.contentView.trailingAnchor constant:-12]
    ]];
  } else {
    [NSLayoutConstraint activateConstraints:@[
      [icon.leadingAnchor constraintEqualToAnchor:cell.contentView.leadingAnchor constant:indent + (self.isSearching ? 0 : 20)],
      [icon.centerYAnchor constraintEqualToAnchor:cell.contentView.centerYAnchor],
      [icon.widthAnchor constraintEqualToConstant:18],
      [icon.heightAnchor constraintEqualToConstant:18],

      [nameLabel.leadingAnchor constraintEqualToAnchor:icon.trailingAnchor constant:10],
      [nameLabel.centerYAnchor constraintEqualToAnchor:cell.contentView.centerYAnchor],
      [nameLabel.trailingAnchor constraintLessThanOrEqualToAnchor:cell.contentView.trailingAnchor constant:-12]
    ]];
  }

  return cell;
}

#pragma mark - UITableViewDelegate

- (CGFloat)tableView:(UITableView *)tableView heightForRowAtIndexPath:(NSIndexPath *)indexPath {
  return 40;
}

- (void)tableView:(UITableView *)tableView didSelectRowAtIndexPath:(NSIndexPath *)indexPath {
  NSArray *nodes = self.isSearching ? self.filteredNodes : self.visibleNodes;
  if (indexPath.row >= nodes.count) return;

  EXFileNode *node = nodes[indexPath.row];

  if (node.isDirectory && !self.isSearching) {
    [self toggleNode:node];
  } else {
    [self selectFile:node];
  }
}

@end
