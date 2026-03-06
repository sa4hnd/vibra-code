// Copyright 2015-present 650 Industries. All rights reserved.

#import "EXPreviewZoomManager+Private.h"
#import "EXPreviewZoomManager.h"
#import "EXChatBackendService.h"
#import <UIKit/UIKit.h>

// Forward declarations
@class EXENVModalViewController;

// ENV Variable Model
@interface EXENVVariable : NSObject
@property(nonatomic, strong) NSString *key;
@property(nonatomic, strong) NSString *value;
@property(nonatomic, assign, getter=isEditing) BOOL editing;
@property(nonatomic, assign) BOOL isValueVisible;
@end

@implementation EXENVVariable
@end

// ENV Modal View Controller
@interface EXENVModalViewController
    : UIViewController <UITableViewDataSource, UITableViewDelegate,
                        UIAdaptivePresentationControllerDelegate, UITextFieldDelegate>

@property(nonatomic, weak) EXPreviewZoomManager *manager;
@property(nonatomic, strong) UITableView *envsTableView;
@property(nonatomic, strong) UIButton *syncButton;
@property(nonatomic, strong) UIButton *addButton;
@property(nonatomic, strong) NSMutableArray<EXENVVariable *> *envVariables;
@property(nonatomic, strong) UIVisualEffectView *glassBackgroundView;
@property(nonatomic, strong) UIActivityIndicatorView *loadingIndicator;
@property(nonatomic, strong) UILabel *titleLabel;
@property(nonatomic, strong) UIButton *closeButton;
@property(nonatomic, strong) UILabel *emptyStateLabel;
@property(nonatomic, assign) BOOL isLoading;

// Add form
@property(nonatomic, strong) UIView *addFormContainer;
@property(nonatomic, strong) UITextField *keyInputField;
@property(nonatomic, strong) UITextField *valueInputField;
@property(nonatomic, assign) BOOL isAddFormVisible;

- (instancetype)initWithManager:(EXPreviewZoomManager *)manager;

@end

// Category implementation
@implementation EXPreviewZoomManager (ENVModal)

- (void)showENVModal {
  if (self.envModalPresented) {
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

  if (!self.selectedEnvKeys) {
    self.selectedEnvKeys = [NSMutableArray array];
  }

  if (!self.envTagRanges) {
    self.envTagRanges = [NSMutableArray array];
  }

  EXENVModalViewController *modalVC =
      [[EXENVModalViewController alloc] initWithManager:self];

  UINavigationController *navController =
      [[UINavigationController alloc] initWithRootViewController:modalVC];
  navController.view.backgroundColor = [UIColor clearColor];

  self.envModalViewController = navController;

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

  navController.presentationController.delegate = modalVC;

  [topVC presentViewController:navController animated:YES completion:nil];
  self.envModalPresented = YES;
}

- (void)insertENVTag:(NSString *)envKey {
  UITextView *inputTextView = self.inputTextView;
  if (!inputTextView) {
    return;
  }

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

  NSString *tagString = [NSString stringWithFormat:@"$%@ ", envKey];

  NSString *newText =
      [currentText stringByReplacingCharactersInRange:selectedRange
                                           withString:tagString];

  NSRange tagRange = NSMakeRange(selectedRange.location, tagString.length);

  [self updateTextInputWithAttributedStringAndENVTag:newText tagRange:tagRange];

  inputTextView.selectedRange =
      NSMakeRange(selectedRange.location + tagString.length, 0);
}

- (void)updateTextInputWithAttributedStringAndENVTag:(NSString *)text
                                            tagRange:(NSRange)tagRange {
  UITextView *inputTextView = self.inputTextView;
  if (!inputTextView) {
    return;
  }

  NSMutableAttributedString *attributedString =
      [[NSMutableAttributedString alloc] initWithString:text];

  UIFont *font = [UIFont systemFontOfSize:17 weight:UIFontWeightRegular];
  UIColor *textColor = [UIColor whiteColor];
  [attributedString addAttributes:@{
    NSFontAttributeName : font,
    NSForegroundColorAttributeName : textColor
  }
                            range:NSMakeRange(0, attributedString.length)];

  UIColor *tagColor = [UIColor colorWithRed:0.0
                                      green:0.7
                                       blue:0.8
                                      alpha:1.0];
  [attributedString addAttribute:NSBackgroundColorAttributeName
                           value:tagColor
                           range:tagRange];

  // Store as dictionary with type info for color differentiation
  NSDictionary *tagInfo = @{
    @"range": [NSValue valueWithRange:tagRange],
    @"type": @"env",
    @"color": tagColor
  };
  [self.envTagRanges addObject:tagInfo];

  inputTextView.attributedText = attributedString;

  [[NSNotificationCenter defaultCenter]
      postNotificationName:UITextViewTextDidChangeNotification
                    object:inputTextView];
}

@end

// MARK: - EXENVModalViewController Implementation

@implementation EXENVModalViewController

- (instancetype)initWithManager:(EXPreviewZoomManager *)manager {
  self = [super init];
  if (self) {
    _manager = manager;
    _envVariables = [NSMutableArray array];
    _isAddFormVisible = NO;
    _isLoading = NO;
  }
  return self;
}

- (void)viewDidLoad {
  [super viewDidLoad];

  self.view.backgroundColor = [UIColor clearColor];

  // Glass effect background
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
        NSInteger style = 0;
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

  [self setupHeader];
  [self setupAddForm];
  [self setupTableView];
  [self setupEmptyState];
  [self setupLoadingIndicator];
  [self setupConstraints];

  // Load ENVs
  [self loadENVs];
}

- (void)viewWillAppear:(BOOL)animated {
  [super viewWillAppear:animated];
  [self.navigationController setNavigationBarHidden:YES animated:animated];
}

- (void)presentationControllerDidDismiss:
    (UIPresentationController *)presentationController {
  self.manager.envModalPresented = NO;
}

- (void)setupHeader {
  // Title
  self.titleLabel = [[UILabel alloc] init];
  self.titleLabel.text = @"Environment Variables";
  self.titleLabel.textColor = [UIColor whiteColor];
  self.titleLabel.font = [UIFont systemFontOfSize:18 weight:UIFontWeightSemibold];
  self.titleLabel.translatesAutoresizingMaskIntoConstraints = NO;
  [self.view addSubview:self.titleLabel];

  // Close button
  self.closeButton = [UIButton buttonWithType:UIButtonTypeSystem];
  self.closeButton.translatesAutoresizingMaskIntoConstraints = NO;
  UIImageSymbolConfiguration *closeConfig = [UIImageSymbolConfiguration
      configurationWithPointSize:16
                          weight:UIImageSymbolWeightMedium];
  UIImage *closeImage = [UIImage systemImageNamed:@"xmark"
                                 withConfiguration:closeConfig];
  [self.closeButton setImage:closeImage forState:UIControlStateNormal];
  self.closeButton.tintColor = [UIColor whiteColor];
  self.closeButton.backgroundColor = [UIColor colorWithWhite:0.2 alpha:0.6];
  self.closeButton.layer.cornerRadius = 14;
  [self.closeButton addTarget:self
                       action:@selector(closeTapped:)
             forControlEvents:UIControlEventTouchUpInside];
  [self.view addSubview:self.closeButton];

  // Sync button
  self.syncButton = [UIButton buttonWithType:UIButtonTypeSystem];
  self.syncButton.translatesAutoresizingMaskIntoConstraints = NO;
  if (@available(iOS 15.0, *)) {
    UIButtonConfiguration *config = [UIButtonConfiguration tintedButtonConfiguration];
    config.title = @"Sync";
    config.image = [UIImage systemImageNamed:@"arrow.triangle.2.circlepath"
                           withConfiguration:[UIImageSymbolConfiguration
                               configurationWithPointSize:12
                                                   weight:UIImageSymbolWeightMedium]];
    config.imagePadding = 6;
    config.baseBackgroundColor = [UIColor colorWithWhite:0.3 alpha:0.5];
    config.baseForegroundColor = [UIColor whiteColor];
    config.cornerStyle = UIButtonConfigurationCornerStyleCapsule;
    self.syncButton.configuration = config;
  } else {
    [self.syncButton setTitle:@"Sync" forState:UIControlStateNormal];
    self.syncButton.tintColor = [UIColor whiteColor];
    self.syncButton.backgroundColor = [UIColor colorWithWhite:0.3 alpha:0.5];
    self.syncButton.layer.cornerRadius = 14;
  }
  [self.syncButton addTarget:self
                      action:@selector(syncTapped:)
            forControlEvents:UIControlEventTouchUpInside];
  [self.view addSubview:self.syncButton];

  // Add button
  self.addButton = [UIButton buttonWithType:UIButtonTypeSystem];
  self.addButton.translatesAutoresizingMaskIntoConstraints = NO;
  if (@available(iOS 15.0, *)) {
    UIButtonConfiguration *config = [UIButtonConfiguration filledButtonConfiguration];
    config.title = @"Add";
    config.image = [UIImage systemImageNamed:@"plus"
                           withConfiguration:[UIImageSymbolConfiguration
                               configurationWithPointSize:12
                                                   weight:UIImageSymbolWeightMedium]];
    config.imagePadding = 6;
    config.baseBackgroundColor = [UIColor systemBlueColor];
    config.baseForegroundColor = [UIColor whiteColor];
    config.cornerStyle = UIButtonConfigurationCornerStyleCapsule;
    self.addButton.configuration = config;
  } else {
    [self.addButton setTitle:@"Add" forState:UIControlStateNormal];
    self.addButton.tintColor = [UIColor whiteColor];
    self.addButton.backgroundColor = [UIColor systemBlueColor];
    self.addButton.layer.cornerRadius = 14;
  }
  [self.addButton addTarget:self
                     action:@selector(addTapped:)
           forControlEvents:UIControlEventTouchUpInside];
  [self.view addSubview:self.addButton];
}

- (void)setupAddForm {
  self.addFormContainer = [[UIView alloc] init];
  self.addFormContainer.translatesAutoresizingMaskIntoConstraints = NO;
  self.addFormContainer.backgroundColor = [UIColor colorWithWhite:0.15 alpha:0.8];
  self.addFormContainer.layer.cornerRadius = 12;
  self.addFormContainer.hidden = YES;
  [self.view addSubview:self.addFormContainer];

  // Key field
  self.keyInputField = [[UITextField alloc] init];
  self.keyInputField.translatesAutoresizingMaskIntoConstraints = NO;
  self.keyInputField.placeholder = @"KEY (e.g., API_KEY)";
  self.keyInputField.textColor = [UIColor whiteColor];
  self.keyInputField.font = [UIFont monospacedSystemFontOfSize:14 weight:UIFontWeightMedium];
  self.keyInputField.backgroundColor = [UIColor colorWithWhite:0.1 alpha:1.0];
  self.keyInputField.layer.cornerRadius = 8;
  self.keyInputField.autocapitalizationType = UITextAutocapitalizationTypeAllCharacters;
  self.keyInputField.autocorrectionType = UITextAutocorrectionTypeNo;
  self.keyInputField.leftView = [[UIView alloc] initWithFrame:CGRectMake(0, 0, 12, 0)];
  self.keyInputField.leftViewMode = UITextFieldViewModeAlways;
  self.keyInputField.rightView = [[UIView alloc] initWithFrame:CGRectMake(0, 0, 12, 0)];
  self.keyInputField.rightViewMode = UITextFieldViewModeAlways;
  self.keyInputField.delegate = self;
  [self.keyInputField setAttributedPlaceholder:[[NSAttributedString alloc]
      initWithString:@"KEY (e.g., API_KEY)"
          attributes:@{NSForegroundColorAttributeName: [UIColor colorWithWhite:0.5 alpha:1.0]}]];
  [self.addFormContainer addSubview:self.keyInputField];

  // Value field
  self.valueInputField = [[UITextField alloc] init];
  self.valueInputField.translatesAutoresizingMaskIntoConstraints = NO;
  self.valueInputField.placeholder = @"Value";
  self.valueInputField.textColor = [UIColor whiteColor];
  self.valueInputField.font = [UIFont monospacedSystemFontOfSize:14 weight:UIFontWeightRegular];
  self.valueInputField.backgroundColor = [UIColor colorWithWhite:0.1 alpha:1.0];
  self.valueInputField.layer.cornerRadius = 8;
  self.valueInputField.autocorrectionType = UITextAutocorrectionTypeNo;
  self.valueInputField.secureTextEntry = YES;
  self.valueInputField.leftView = [[UIView alloc] initWithFrame:CGRectMake(0, 0, 12, 0)];
  self.valueInputField.leftViewMode = UITextFieldViewModeAlways;
  self.valueInputField.rightView = [[UIView alloc] initWithFrame:CGRectMake(0, 0, 12, 0)];
  self.valueInputField.rightViewMode = UITextFieldViewModeAlways;
  self.valueInputField.delegate = self;
  [self.valueInputField setAttributedPlaceholder:[[NSAttributedString alloc]
      initWithString:@"Value"
          attributes:@{NSForegroundColorAttributeName: [UIColor colorWithWhite:0.5 alpha:1.0]}]];
  [self.addFormContainer addSubview:self.valueInputField];

  // Buttons container
  UIStackView *buttonsStack = [[UIStackView alloc] init];
  buttonsStack.translatesAutoresizingMaskIntoConstraints = NO;
  buttonsStack.axis = UILayoutConstraintAxisHorizontal;
  buttonsStack.spacing = 8;
  buttonsStack.distribution = UIStackViewDistributionFillEqually;
  [self.addFormContainer addSubview:buttonsStack];

  // Cancel button
  UIButton *cancelBtn = [UIButton buttonWithType:UIButtonTypeSystem];
  [cancelBtn setTitle:@"Cancel" forState:UIControlStateNormal];
  cancelBtn.tintColor = [UIColor colorWithWhite:0.7 alpha:1.0];
  cancelBtn.backgroundColor = [UIColor colorWithWhite:0.2 alpha:1.0];
  cancelBtn.layer.cornerRadius = 8;
  [cancelBtn addTarget:self action:@selector(cancelAddTapped:) forControlEvents:UIControlEventTouchUpInside];
  [buttonsStack addArrangedSubview:cancelBtn];

  // Save button
  UIButton *saveBtn = [UIButton buttonWithType:UIButtonTypeSystem];
  [saveBtn setTitle:@"Save" forState:UIControlStateNormal];
  saveBtn.tintColor = [UIColor whiteColor];
  saveBtn.backgroundColor = [UIColor systemGreenColor];
  saveBtn.layer.cornerRadius = 8;
  [saveBtn addTarget:self action:@selector(saveNewEnvTapped:) forControlEvents:UIControlEventTouchUpInside];
  [buttonsStack addArrangedSubview:saveBtn];

  [NSLayoutConstraint activateConstraints:@[
    [self.keyInputField.topAnchor constraintEqualToAnchor:self.addFormContainer.topAnchor constant:12],
    [self.keyInputField.leadingAnchor constraintEqualToAnchor:self.addFormContainer.leadingAnchor constant:12],
    [self.keyInputField.trailingAnchor constraintEqualToAnchor:self.addFormContainer.trailingAnchor constant:-12],
    [self.keyInputField.heightAnchor constraintEqualToConstant:40],

    [self.valueInputField.topAnchor constraintEqualToAnchor:self.keyInputField.bottomAnchor constant:8],
    [self.valueInputField.leadingAnchor constraintEqualToAnchor:self.addFormContainer.leadingAnchor constant:12],
    [self.valueInputField.trailingAnchor constraintEqualToAnchor:self.addFormContainer.trailingAnchor constant:-12],
    [self.valueInputField.heightAnchor constraintEqualToConstant:40],

    [buttonsStack.topAnchor constraintEqualToAnchor:self.valueInputField.bottomAnchor constant:12],
    [buttonsStack.leadingAnchor constraintEqualToAnchor:self.addFormContainer.leadingAnchor constant:12],
    [buttonsStack.trailingAnchor constraintEqualToAnchor:self.addFormContainer.trailingAnchor constant:-12],
    [buttonsStack.heightAnchor constraintEqualToConstant:36],
    [buttonsStack.bottomAnchor constraintEqualToAnchor:self.addFormContainer.bottomAnchor constant:-12]
  ]];
}

- (void)setupTableView {
  self.envsTableView = [[UITableView alloc] initWithFrame:CGRectZero style:UITableViewStylePlain];
  self.envsTableView.translatesAutoresizingMaskIntoConstraints = NO;
  self.envsTableView.backgroundColor = [UIColor clearColor];
  self.envsTableView.separatorStyle = UITableViewCellSeparatorStyleNone;
  self.envsTableView.dataSource = self;
  self.envsTableView.delegate = self;
  self.envsTableView.contentInset = UIEdgeInsetsMake(8, 0, 100, 0);
  [self.envsTableView registerClass:[UITableViewCell class] forCellReuseIdentifier:@"ENVCell"];
  [self.view addSubview:self.envsTableView];
}

- (void)setupEmptyState {
  self.emptyStateLabel = [[UILabel alloc] init];
  self.emptyStateLabel.translatesAutoresizingMaskIntoConstraints = NO;
  self.emptyStateLabel.text = @"No environment variables\n\nTap \"Add\" to create your first variable\nor \"Sync\" to pull from sandbox";
  self.emptyStateLabel.textColor = [UIColor colorWithWhite:0.5 alpha:1.0];
  self.emptyStateLabel.font = [UIFont systemFontOfSize:15 weight:UIFontWeightMedium];
  self.emptyStateLabel.textAlignment = NSTextAlignmentCenter;
  self.emptyStateLabel.numberOfLines = 0;
  self.emptyStateLabel.hidden = YES;
  [self.view addSubview:self.emptyStateLabel];
}

- (void)setupLoadingIndicator {
  self.loadingIndicator = [[UIActivityIndicatorView alloc]
      initWithActivityIndicatorStyle:UIActivityIndicatorViewStyleLarge];
  self.loadingIndicator.translatesAutoresizingMaskIntoConstraints = NO;
  self.loadingIndicator.color = [UIColor whiteColor];
  self.loadingIndicator.hidesWhenStopped = YES;
  [self.view addSubview:self.loadingIndicator];

  [NSLayoutConstraint activateConstraints:@[
    [self.loadingIndicator.centerXAnchor constraintEqualToAnchor:self.view.centerXAnchor],
    [self.loadingIndicator.centerYAnchor constraintEqualToAnchor:self.view.centerYAnchor]
  ]];
}

- (void)setupConstraints {
  UIWindow *window = [UIApplication sharedApplication].keyWindow;
  CGFloat safeAreaBottom = 0;
  if (@available(iOS 11.0, *)) {
    safeAreaBottom = window.safeAreaInsets.bottom;
  }

  [NSLayoutConstraint activateConstraints:@[
    // Title
    [self.titleLabel.topAnchor constraintEqualToAnchor:self.view.safeAreaLayoutGuide.topAnchor constant:16],
    [self.titleLabel.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor constant:20],

    // Close button
    [self.closeButton.centerYAnchor constraintEqualToAnchor:self.titleLabel.centerYAnchor],
    [self.closeButton.trailingAnchor constraintEqualToAnchor:self.view.trailingAnchor constant:-20],
    [self.closeButton.widthAnchor constraintEqualToConstant:28],
    [self.closeButton.heightAnchor constraintEqualToConstant:28],

    // Sync button
    [self.syncButton.topAnchor constraintEqualToAnchor:self.titleLabel.bottomAnchor constant:16],
    [self.syncButton.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor constant:20],
    [self.syncButton.heightAnchor constraintEqualToConstant:32],

    // Add button
    [self.addButton.centerYAnchor constraintEqualToAnchor:self.syncButton.centerYAnchor],
    [self.addButton.leadingAnchor constraintEqualToAnchor:self.syncButton.trailingAnchor constant:8],
    [self.addButton.heightAnchor constraintEqualToConstant:32],

    // Add form container
    [self.addFormContainer.topAnchor constraintEqualToAnchor:self.syncButton.bottomAnchor constant:12],
    [self.addFormContainer.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor constant:20],
    [self.addFormContainer.trailingAnchor constraintEqualToAnchor:self.view.trailingAnchor constant:-20],

    // Table view
    [self.envsTableView.topAnchor constraintEqualToAnchor:self.addFormContainer.bottomAnchor constant:8],
    [self.envsTableView.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor],
    [self.envsTableView.trailingAnchor constraintEqualToAnchor:self.view.trailingAnchor],
    [self.envsTableView.bottomAnchor constraintEqualToAnchor:self.view.bottomAnchor],

    // Empty state
    [self.emptyStateLabel.centerXAnchor constraintEqualToAnchor:self.view.centerXAnchor],
    [self.emptyStateLabel.centerYAnchor constraintEqualToAnchor:self.view.centerYAnchor],
    [self.emptyStateLabel.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor constant:40],
    [self.emptyStateLabel.trailingAnchor constraintEqualToAnchor:self.view.trailingAnchor constant:-40]
  ]];
}

#pragma mark - Actions

- (void)closeTapped:(UIButton *)sender {
  if (self.navigationController) {
    [self.navigationController dismissViewControllerAnimated:YES completion:^{
      self.manager.envModalPresented = NO;
    }];
  } else {
    [self dismissViewControllerAnimated:YES completion:^{
      self.manager.envModalPresented = NO;
    }];
  }
}

- (void)syncTapped:(UIButton *)sender {
  [self syncENVsBidirectional];
}

- (void)addTapped:(UIButton *)sender {
  self.isAddFormVisible = !self.isAddFormVisible;
  [UIView animateWithDuration:0.25 animations:^{
    self.addFormContainer.hidden = !self.isAddFormVisible;
    if (self.isAddFormVisible) {
      [self.keyInputField becomeFirstResponder];
    } else {
      [self.view endEditing:YES];
    }
  }];
}

- (void)cancelAddTapped:(UIButton *)sender {
  self.keyInputField.text = @"";
  self.valueInputField.text = @"";
  self.isAddFormVisible = NO;
  [UIView animateWithDuration:0.25 animations:^{
    self.addFormContainer.hidden = YES;
  }];
  [self.view endEditing:YES];
}

- (void)saveNewEnvTapped:(UIButton *)sender {
  NSString *key = [self.keyInputField.text stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
  NSString *value = [self.valueInputField.text stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];

  if (key.length == 0 || value.length == 0) {
    return;
  }

  [self addEnvWithKey:key value:value];

  self.keyInputField.text = @"";
  self.valueInputField.text = @"";
  self.isAddFormVisible = NO;
  self.addFormContainer.hidden = YES;
  [self.view endEditing:YES];
}

#pragma mark - Data Loading

- (void)loadENVs {
  NSString *sandboxId = self.manager.sandboxId;
  if (!sandboxId || sandboxId.length == 0) {
    // Try to get sandbox ID from session
    NSString *convexId = self.manager.chatSessionId;
    if (!convexId || convexId.length == 0) {
      NSLog(@"❌ [ENVModal] No session ID available");
      [self updateEmptyState];
      return;
    }

    self.isLoading = YES;
    [self.loadingIndicator startAnimating];

    [[EXChatBackendService sharedInstance] getSessionById:convexId
                                               completion:^(NSDictionary *session, NSError *error) {
      dispatch_async(dispatch_get_main_queue(), ^{
        if (error || !session) {
          [self.loadingIndicator stopAnimating];
          self.isLoading = NO;
          NSLog(@"❌ [ENVModal] Error fetching session: %@", error);
          [self updateEmptyState];
          return;
        }

        NSString *sessionSandboxId = session[@"sessionId"];
        if ([sessionSandboxId isKindOfClass:[NSString class]] && sessionSandboxId.length > 0) {
          self.manager.sandboxId = sessionSandboxId;
          NSLog(@"✅ [ENVModal] Got sandbox ID: %@", sessionSandboxId);
          [self loadENVsWithSandboxId:sessionSandboxId];
        } else {
          [self.loadingIndicator stopAnimating];
          self.isLoading = NO;
          [self updateEmptyState];
        }
      });
    }];
    return;
  }

  [self loadENVsWithSandboxId:sandboxId];
}

- (void)loadENVsWithSandboxId:(NSString *)sandboxId {
  self.isLoading = YES;
  [self.loadingIndicator startAnimating];

  [[EXChatBackendService sharedInstance] getEnvsForSession:sandboxId
                                                completion:^(NSDictionary *envs, NSError *error) {
    dispatch_async(dispatch_get_main_queue(), ^{
      [self.loadingIndicator stopAnimating];
      self.isLoading = NO;

      if (error) {
        NSLog(@"❌ [ENVModal] Error loading ENVs: %@", error);
        [self updateEmptyState];
        return;
      }

      [self.envVariables removeAllObjects];

      if (envs && envs.count > 0) {
        NSArray *sortedKeys = [[envs allKeys] sortedArrayUsingSelector:@selector(compare:)];
        for (NSString *key in sortedKeys) {
          EXENVVariable *envVar = [[EXENVVariable alloc] init];
          envVar.key = key;
          envVar.value = envs[key];
          envVar.editing = NO;
          [self.envVariables addObject:envVar];
        }
        NSLog(@"✅ [ENVModal] Loaded %lu ENVs", (unsigned long)self.envVariables.count);
      }

      [self.envsTableView reloadData];
      [self updateEmptyState];
    });
  }];
}

- (void)syncENVsBidirectional {
  NSString *sandboxId = self.manager.sandboxId;
  if (!sandboxId || sandboxId.length == 0) {
    NSLog(@"❌ [ENVModal] No sandbox ID for sync");
    return;
  }

  self.isLoading = YES;
  [self.loadingIndicator startAnimating];

  // Animate sync button
  if (@available(iOS 15.0, *)) {
    UIButtonConfiguration *config = self.syncButton.configuration;
    config.showsActivityIndicator = YES;
    self.syncButton.configuration = config;
  }

  [[EXChatBackendService sharedInstance] syncEnvsBidirectionalWithSessionId:sandboxId
                                                                 completion:^(NSDictionary *result, NSError *error) {
    dispatch_async(dispatch_get_main_queue(), ^{
      if (@available(iOS 15.0, *)) {
        UIButtonConfiguration *config = self.syncButton.configuration;
        config.showsActivityIndicator = NO;
        self.syncButton.configuration = config;
      }

      if (error) {
        [self.loadingIndicator stopAnimating];
        self.isLoading = NO;
        NSLog(@"❌ [ENVModal] Error syncing ENVs: %@", error);
        return;
      }

      NSLog(@"✅ [ENVModal] ENVs synced: %@", result[@"stats"]);
      // Reload ENVs after sync
      [self loadENVsWithSandboxId:sandboxId];
    });
  }];
}

- (void)addEnvWithKey:(NSString *)key value:(NSString *)value {
  NSString *sandboxId = self.manager.sandboxId;
  if (!sandboxId || sandboxId.length == 0) {
    NSLog(@"❌ [ENVModal] No sandbox ID for adding ENV");
    return;
  }

  self.isLoading = YES;
  [self.loadingIndicator startAnimating];

  [[EXChatBackendService sharedInstance] addEnvWithSessionId:sandboxId
                                                         key:key
                                                       value:value
                                                  completion:^(NSError *error) {
    dispatch_async(dispatch_get_main_queue(), ^{
      [self.loadingIndicator stopAnimating];
      self.isLoading = NO;

      if (error) {
        NSLog(@"❌ [ENVModal] Error adding ENV: %@", error);
        return;
      }

      NSLog(@"✅ [ENVModal] Added ENV: %@", key);

      // Add to local array
      EXENVVariable *newVar = [[EXENVVariable alloc] init];
      newVar.key = key;
      newVar.value = value;
      newVar.editing = NO;
      [self.envVariables addObject:newVar];

      // Sort
      [self.envVariables sortUsingComparator:^NSComparisonResult(EXENVVariable *a, EXENVVariable *b) {
        return [a.key compare:b.key];
      }];

      [self.envsTableView reloadData];
      [self updateEmptyState];
    });
  }];
}

- (void)deleteEnvAtIndex:(NSInteger)index {
  if (index < 0 || index >= self.envVariables.count) {
    return;
  }

  EXENVVariable *envVar = self.envVariables[index];
  NSString *sandboxId = self.manager.sandboxId;
  if (!sandboxId || sandboxId.length == 0) {
    NSLog(@"❌ [ENVModal] No sandbox ID for deleting ENV");
    return;
  }

  [[EXChatBackendService sharedInstance] removeEnvWithSessionId:sandboxId
                                                            key:envVar.key
                                                     completion:^(NSError *error) {
    dispatch_async(dispatch_get_main_queue(), ^{
      if (error) {
        NSLog(@"❌ [ENVModal] Error deleting ENV: %@", error);
        return;
      }

      NSLog(@"✅ [ENVModal] Deleted ENV: %@", envVar.key);
      [self.envVariables removeObjectAtIndex:index];
      [self.envsTableView reloadData];
      [self updateEmptyState];
    });
  }];
}

- (void)updateEmptyState {
  BOOL isEmpty = self.envVariables.count == 0 && !self.isLoading;
  self.emptyStateLabel.hidden = !isEmpty;
  self.envsTableView.hidden = isEmpty;
}

#pragma mark - UITableViewDataSource

- (NSInteger)tableView:(UITableView *)tableView numberOfRowsInSection:(NSInteger)section {
  return self.envVariables.count;
}

- (UITableViewCell *)tableView:(UITableView *)tableView cellForRowAtIndexPath:(NSIndexPath *)indexPath {
  UITableViewCell *cell = [tableView dequeueReusableCellWithIdentifier:@"ENVCell"];
  if (!cell) {
    cell = [[UITableViewCell alloc] initWithStyle:UITableViewCellStyleDefault reuseIdentifier:@"ENVCell"];
  }

  for (UIView *subview in cell.contentView.subviews) {
    [subview removeFromSuperview];
  }

  EXENVVariable *envVar = self.envVariables[indexPath.row];

  cell.backgroundColor = [UIColor clearColor];
  cell.selectionStyle = UITableViewCellSelectionStyleNone;

  // Card container
  UIView *cardView = [[UIView alloc] init];
  cardView.translatesAutoresizingMaskIntoConstraints = NO;
  cardView.backgroundColor = [UIColor colorWithWhite:0.12 alpha:0.9];
  cardView.layer.cornerRadius = 12;
  [cell.contentView addSubview:cardView];

  // Key icon
  UIImageSymbolConfiguration *keyConfig = [UIImageSymbolConfiguration
      configurationWithPointSize:14
                          weight:UIImageSymbolWeightMedium];
  UIImage *keyImage = [UIImage systemImageNamed:@"key.fill" withConfiguration:keyConfig];
  UIImageView *keyIcon = [[UIImageView alloc] initWithImage:keyImage];
  keyIcon.translatesAutoresizingMaskIntoConstraints = NO;
  keyIcon.tintColor = [UIColor colorWithRed:0.0 green:0.7 blue:0.8 alpha:1.0];
  [cardView addSubview:keyIcon];

  // Key label
  UILabel *keyLabel = [[UILabel alloc] init];
  keyLabel.translatesAutoresizingMaskIntoConstraints = NO;
  keyLabel.text = envVar.key;
  keyLabel.textColor = [UIColor whiteColor];
  keyLabel.font = [UIFont monospacedSystemFontOfSize:14 weight:UIFontWeightSemibold];
  [cardView addSubview:keyLabel];

  // Value label - show actual value or masked
  UILabel *valueLabel = [[UILabel alloc] init];
  valueLabel.translatesAutoresizingMaskIntoConstraints = NO;
  valueLabel.tag = 100; // Tag for updating later
  if (envVar.isValueVisible) {
    valueLabel.text = envVar.value;
    valueLabel.textColor = [UIColor colorWithRed:0.4 green:0.8 blue:0.4 alpha:1.0];
  } else {
    // Show masked value with bullet points
    NSString *maskedValue = [@"" stringByPaddingToLength:MIN(16, envVar.value.length) withString:@"•" startingAtIndex:0];
    valueLabel.text = maskedValue;
    valueLabel.textColor = [UIColor colorWithWhite:0.5 alpha:1.0];
  }
  valueLabel.font = [UIFont monospacedSystemFontOfSize:12 weight:UIFontWeightRegular];
  valueLabel.lineBreakMode = NSLineBreakByTruncatingTail;
  [cardView addSubview:valueLabel];

  // Eye button (show/hide toggle)
  UIButton *eyeBtn = [UIButton buttonWithType:UIButtonTypeSystem];
  eyeBtn.translatesAutoresizingMaskIntoConstraints = NO;
  eyeBtn.tag = indexPath.row;
  NSString *eyeIconName = envVar.isValueVisible ? @"eye.slash" : @"eye";
  UIImage *eyeImage = [UIImage systemImageNamed:eyeIconName
                                 withConfiguration:[UIImageSymbolConfiguration
                                     configurationWithPointSize:14
                                                         weight:UIImageSymbolWeightMedium]];
  [eyeBtn setImage:eyeImage forState:UIControlStateNormal];
  eyeBtn.tintColor = [UIColor colorWithWhite:0.6 alpha:1.0];
  [eyeBtn addTarget:self action:@selector(toggleValueVisibility:) forControlEvents:UIControlEventTouchUpInside];
  [cardView addSubview:eyeBtn];

  // Copy button
  UIButton *copyBtn = [UIButton buttonWithType:UIButtonTypeSystem];
  copyBtn.translatesAutoresizingMaskIntoConstraints = NO;
  copyBtn.tag = indexPath.row;
  UIImage *copyImage = [UIImage systemImageNamed:@"doc.on.doc"
                                 withConfiguration:[UIImageSymbolConfiguration
                                     configurationWithPointSize:14
                                                         weight:UIImageSymbolWeightMedium]];
  [copyBtn setImage:copyImage forState:UIControlStateNormal];
  copyBtn.tintColor = [UIColor colorWithWhite:0.6 alpha:1.0];
  [copyBtn addTarget:self action:@selector(copyValueTapped:) forControlEvents:UIControlEventTouchUpInside];
  [cardView addSubview:copyBtn];

  // Delete button
  UIButton *deleteBtn = [UIButton buttonWithType:UIButtonTypeSystem];
  deleteBtn.translatesAutoresizingMaskIntoConstraints = NO;
  deleteBtn.tag = indexPath.row;
  UIImage *trashImage = [UIImage systemImageNamed:@"trash"
                                 withConfiguration:[UIImageSymbolConfiguration
                                     configurationWithPointSize:14
                                                         weight:UIImageSymbolWeightMedium]];
  [deleteBtn setImage:trashImage forState:UIControlStateNormal];
  deleteBtn.tintColor = [UIColor colorWithRed:0.9 green:0.3 blue:0.3 alpha:1.0];
  [deleteBtn addTarget:self action:@selector(deleteTapped:) forControlEvents:UIControlEventTouchUpInside];
  [cardView addSubview:deleteBtn];

  [NSLayoutConstraint activateConstraints:@[
    [cardView.topAnchor constraintEqualToAnchor:cell.contentView.topAnchor constant:4],
    [cardView.leadingAnchor constraintEqualToAnchor:cell.contentView.leadingAnchor constant:20],
    [cardView.trailingAnchor constraintEqualToAnchor:cell.contentView.trailingAnchor constant:-20],
    [cardView.bottomAnchor constraintEqualToAnchor:cell.contentView.bottomAnchor constant:-4],

    [keyIcon.leadingAnchor constraintEqualToAnchor:cardView.leadingAnchor constant:16],
    [keyIcon.centerYAnchor constraintEqualToAnchor:cardView.centerYAnchor],
    [keyIcon.widthAnchor constraintEqualToConstant:18],
    [keyIcon.heightAnchor constraintEqualToConstant:18],

    [keyLabel.leadingAnchor constraintEqualToAnchor:keyIcon.trailingAnchor constant:12],
    [keyLabel.topAnchor constraintEqualToAnchor:cardView.topAnchor constant:12],
    [keyLabel.trailingAnchor constraintLessThanOrEqualToAnchor:eyeBtn.leadingAnchor constant:-8],

    [valueLabel.leadingAnchor constraintEqualToAnchor:keyLabel.leadingAnchor],
    [valueLabel.topAnchor constraintEqualToAnchor:keyLabel.bottomAnchor constant:4],
    [valueLabel.trailingAnchor constraintLessThanOrEqualToAnchor:eyeBtn.leadingAnchor constant:-8],
    [valueLabel.bottomAnchor constraintEqualToAnchor:cardView.bottomAnchor constant:-12],

    [eyeBtn.trailingAnchor constraintEqualToAnchor:copyBtn.leadingAnchor constant:-4],
    [eyeBtn.centerYAnchor constraintEqualToAnchor:cardView.centerYAnchor],
    [eyeBtn.widthAnchor constraintEqualToConstant:32],
    [eyeBtn.heightAnchor constraintEqualToConstant:32],

    [copyBtn.trailingAnchor constraintEqualToAnchor:deleteBtn.leadingAnchor constant:-4],
    [copyBtn.centerYAnchor constraintEqualToAnchor:cardView.centerYAnchor],
    [copyBtn.widthAnchor constraintEqualToConstant:32],
    [copyBtn.heightAnchor constraintEqualToConstant:32],

    [deleteBtn.trailingAnchor constraintEqualToAnchor:cardView.trailingAnchor constant:-8],
    [deleteBtn.centerYAnchor constraintEqualToAnchor:cardView.centerYAnchor],
    [deleteBtn.widthAnchor constraintEqualToConstant:32],
    [deleteBtn.heightAnchor constraintEqualToConstant:32]
  ]];

  return cell;
}

- (void)toggleValueVisibility:(UIButton *)sender {
  NSInteger index = sender.tag;
  if (index < 0 || index >= self.envVariables.count) return;

  EXENVVariable *envVar = self.envVariables[index];
  envVar.isValueVisible = !envVar.isValueVisible;

  NSIndexPath *indexPath = [NSIndexPath indexPathForRow:index inSection:0];
  [self.envsTableView reloadRowsAtIndexPaths:@[indexPath] withRowAnimation:UITableViewRowAnimationNone];

  UIImpactFeedbackGenerator *feedback = [[UIImpactFeedbackGenerator alloc] initWithStyle:UIImpactFeedbackStyleLight];
  [feedback impactOccurred];
}

- (void)copyValueTapped:(UIButton *)sender {
  NSInteger index = sender.tag;
  if (index < 0 || index >= self.envVariables.count) return;

  EXENVVariable *envVar = self.envVariables[index];
  UIPasteboard *pasteboard = [UIPasteboard generalPasteboard];
  pasteboard.string = envVar.value;

  UIImpactFeedbackGenerator *feedback = [[UIImpactFeedbackGenerator alloc] initWithStyle:UIImpactFeedbackStyleMedium];
  [feedback impactOccurred];

  // Brief visual feedback - change button tint temporarily
  sender.tintColor = [UIColor systemGreenColor];
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.5 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
    sender.tintColor = [UIColor colorWithWhite:0.6 alpha:1.0];
  });
}

- (void)deleteTapped:(UIButton *)sender {
  [self deleteEnvAtIndex:sender.tag];
}

#pragma mark - UITableViewDelegate

- (CGFloat)tableView:(UITableView *)tableView heightForRowAtIndexPath:(NSIndexPath *)indexPath {
  return 72;
}

- (void)tableView:(UITableView *)tableView didSelectRowAtIndexPath:(NSIndexPath *)indexPath {
  // Could show edit sheet or copy value
  EXENVVariable *envVar = self.envVariables[indexPath.row];

  // Copy key to clipboard
  UIPasteboard *pasteboard = [UIPasteboard generalPasteboard];
  pasteboard.string = envVar.key;

  // Show brief feedback
  UIImpactFeedbackGenerator *feedback = [[UIImpactFeedbackGenerator alloc] initWithStyle:UIImpactFeedbackStyleLight];
  [feedback impactOccurred];
}

- (BOOL)tableView:(UITableView *)tableView canEditRowAtIndexPath:(NSIndexPath *)indexPath {
  return YES;
}

- (void)tableView:(UITableView *)tableView commitEditingStyle:(UITableViewCellEditingStyle)editingStyle forRowAtIndexPath:(NSIndexPath *)indexPath {
  if (editingStyle == UITableViewCellEditingStyleDelete) {
    [self deleteEnvAtIndex:indexPath.row];
  }
}

#pragma mark - UITextFieldDelegate

- (BOOL)textFieldShouldReturn:(UITextField *)textField {
  if (textField == self.keyInputField) {
    [self.valueInputField becomeFirstResponder];
  } else if (textField == self.valueInputField) {
    [self saveNewEnvTapped:nil];
  }
  return YES;
}

@end
