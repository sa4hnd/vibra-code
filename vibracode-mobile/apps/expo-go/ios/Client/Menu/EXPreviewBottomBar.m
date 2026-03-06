// Copyright 2015-present 650 Industries. All rights reserved.

#import "EXPreviewBottomBar.h"

@interface EXPreviewBottomBar () <UITextFieldDelegate>
@property (nonatomic, strong) UIView *bottomBarView;
@property (nonatomic, strong) UITextField *textField;
@property (nonatomic, strong) NSLayoutConstraint *bottomBarBottomConstraint;
@property (nonatomic, strong) UIButton *micButton;
@property (nonatomic, strong) UIButton *sendButton;
@property (nonatomic, strong) UIButton *settingsButton;
@property (nonatomic, strong) UIButton *imageButton;
@end

@implementation EXPreviewBottomBar

#pragma mark - Device Detection

- (BOOL)isIPad
{
  return UI_USER_INTERFACE_IDIOM() == UIUserInterfaceIdiomPad;
}

- (instancetype)initWithSuperview:(UIView *)superview
{
  if (self = [super init]) {
    [self createBottomBarInSuperview:superview];
  }
  // Add keyboard observers
  [[NSNotificationCenter defaultCenter] addObserver:self
                                           selector:@selector(keyboardWillShow:)
                                               name:UIKeyboardWillShowNotification
                                             object:nil];
  [[NSNotificationCenter defaultCenter] addObserver:self
                                           selector:@selector(keyboardWillHide:)
                                               name:UIKeyboardWillHideNotification
                                             object:nil];
  return self;
}

- (void)dealloc
{
  [[NSNotificationCenter defaultCenter] removeObserver:self];
}

- (void)keyboardWillShow:(NSNotification *)notification
{
  [self updateForKeyboardVisible:YES];
}

- (void)keyboardWillHide:(NSNotification *)notification
{
  [self updateForKeyboardVisible:NO];
}

- (void)createBottomBarInSuperview:(UIView *)superview
{
  UIWindow *window = [UIApplication sharedApplication].keyWindow;
  CGFloat safeAreaBottom = 0;
  if (@available(iOS 11.0, *)) {
    safeAreaBottom = window.safeAreaInsets.bottom;
  }

  // Responsive dimensions
  CGFloat cornerRadius = [self isIPad] ? 28.0 : 20.0;
  CGFloat sidePadding = [self isIPad] ? 24 : 16;
  CGFloat inputHeight = [self isIPad] ? 48 : 36;
  CGFloat inputCornerRadius = [self isIPad] ? 16 : 12;
  CGFloat buttonSize = [self isIPad] ? 48 : 36;
  CGFloat iconSize = [self isIPad] ? 24 : 20;
  CGFloat smallIconSize = [self isIPad] ? 20 : 16;
  CGFloat chevronSize = [self isIPad] ? 44 : 36;
  CGFloat chevronCornerRadius = [self isIPad] ? 22 : 18;
  CGFloat actionIconSize = [self isIPad] ? 30 : 24;
  CGFloat actionFontSize = [self isIPad] ? 14 : 12;
  CGFloat inputFontSize = [self isIPad] ? 18 : 16;
  CGFloat buttonSpacing = [self isIPad] ? 6 : 4;
  CGFloat actionSpacing = [self isIPad] ? 20 : 16;
  CGFloat chevronTopSpacing = [self isIPad] ? 10 : 8;
  CGFloat topPadding = [self isIPad] ? 6 : 4;
  CGFloat bottomPadding = [self isIPad] ? 20 : 16;
  CGFloat inputPadding = [self isIPad] ? 16 : 12;

  UIView *bottomBar = [[UIView alloc] init];
  bottomBar.backgroundColor = [UIColor colorWithRed:0.12 green:0.12 blue:0.12 alpha:1.0];
  bottomBar.layer.cornerRadius = cornerRadius;
  bottomBar.layer.maskedCorners = kCALayerMinXMinYCorner | kCALayerMaxXMinYCorner;
  bottomBar.translatesAutoresizingMaskIntoConstraints = NO;

  // Floating chevron up button in circle - positioned above input (part of bottomBar but floats above inputContainer)
  UIImageSymbolConfiguration *chevronConfig = [UIImageSymbolConfiguration configurationWithPointSize:smallIconSize weight:UIImageSymbolWeightRegular];
  UIImage *chevronImage = [UIImage systemImageNamed:@"chevron.up" withConfiguration:chevronConfig];
  UIButton *chevronButton = [UIButton buttonWithType:UIButtonTypeCustom];
  [chevronButton setImage:chevronImage forState:UIControlStateNormal];
  chevronButton.tintColor = [UIColor whiteColor];
  chevronButton.backgroundColor = [UIColor colorWithRed:0.25 green:0.25 blue:0.25 alpha:1.0];
  chevronButton.layer.cornerRadius = chevronCornerRadius;
  chevronButton.layer.borderWidth = 1;
  chevronButton.layer.borderColor = [UIColor colorWithRed:0.3 green:0.3 blue:0.3 alpha:1.0].CGColor;
  chevronButton.translatesAutoresizingMaskIntoConstraints = NO;
  [chevronButton addTarget:self action:@selector(chevronButtonTapped) forControlEvents:UIControlEventTouchUpInside];
  // Add to bottomBar so it's part of the view hierarchy but floats above inputContainer
  [bottomBar addSubview:chevronButton];

  UIView *inputContainer = [[UIView alloc] init];
  inputContainer.backgroundColor = [UIColor colorWithRed:0.25 green:0.25 blue:0.25 alpha:1.0];
  inputContainer.layer.cornerRadius = inputCornerRadius;
  inputContainer.translatesAutoresizingMaskIntoConstraints = NO;
  [bottomBar addSubview:inputContainer];

  // Settings icon (left side of input) - hidden by default, shown when keyboard is open
  UIImageSymbolConfiguration *settingsConfig = [UIImageSymbolConfiguration configurationWithPointSize:iconSize weight:UIImageSymbolWeightRegular];
  UIImage *settingsImage = [UIImage systemImageNamed:@"gearshape.fill" withConfiguration:settingsConfig];
  UIButton *settingsButton = [UIButton buttonWithType:UIButtonTypeCustom];
  [settingsButton setImage:settingsImage forState:UIControlStateNormal];
  settingsButton.tintColor = [UIColor whiteColor];
  settingsButton.translatesAutoresizingMaskIntoConstraints = NO;
  settingsButton.hidden = YES; // Hidden by default, shown when keyboard is open
  [inputContainer addSubview:settingsButton];
  _settingsButton = settingsButton;

  // Image icon (next to settings, disabled - coming soon) - hidden by default, shown when keyboard is open
  UIImageSymbolConfiguration *imageConfig = [UIImageSymbolConfiguration configurationWithPointSize:iconSize weight:UIImageSymbolWeightRegular];
  UIImage *imageIconImage = [UIImage systemImageNamed:@"photo.fill" withConfiguration:imageConfig];
  UIButton *imageButton = [UIButton buttonWithType:UIButtonTypeCustom];
  [imageButton setImage:imageIconImage forState:UIControlStateNormal];
  imageButton.tintColor = [UIColor lightGrayColor];
  imageButton.alpha = 0.5;
  imageButton.enabled = NO;
  imageButton.translatesAutoresizingMaskIntoConstraints = NO;
  imageButton.hidden = YES; // Hidden by default, shown when keyboard is open
  [inputContainer addSubview:imageButton];
  _imageButton = imageButton;

  UITextField *inputField = [[UITextField alloc] init];
  inputField.placeholder = @"Start typing";
  inputField.textColor = [UIColor whiteColor];
  inputField.font = [UIFont systemFontOfSize:inputFontSize];
  inputField.backgroundColor = [UIColor clearColor];
  inputField.translatesAutoresizingMaskIntoConstraints = NO;
  inputField.enabled = YES;
  inputField.userInteractionEnabled = YES;
  inputField.returnKeyType = UIReturnKeySend;
  inputField.autocorrectionType = UITextAutocorrectionTypeNo;
  inputField.autocapitalizationType = UITextAutocapitalizationTypeNone;
  NSAttributedString *placeholder = [[NSAttributedString alloc] initWithString:@"Start typing" attributes:@{NSForegroundColorAttributeName: [UIColor lightGrayColor]}];
  inputField.attributedPlaceholder = placeholder;
  inputField.delegate = self;
  [inputContainer addSubview:inputField];
  _textField = inputField;

  // Mic button (right side, shows when no text) - hidden by default, shown when keyboard is open
  UIImageSymbolConfiguration *micConfig = [UIImageSymbolConfiguration configurationWithPointSize:iconSize weight:UIImageSymbolWeightRegular];
  UIImage *micImage = [UIImage systemImageNamed:@"mic.fill" withConfiguration:micConfig];
  UIButton *micButton = [UIButton buttonWithType:UIButtonTypeCustom];
  [micButton setImage:micImage forState:UIControlStateNormal];
  micButton.tintColor = [UIColor whiteColor];
  micButton.translatesAutoresizingMaskIntoConstraints = NO;
  micButton.hidden = YES; // Hidden by default, shown when keyboard is open
  [inputContainer addSubview:micButton];
  _micButton = micButton;

  // Send button (replaces mic when text is entered) - hidden by default
  UIImageSymbolConfiguration *sendConfig = [UIImageSymbolConfiguration configurationWithPointSize:iconSize weight:UIImageSymbolWeightRegular];
  UIImage *sendImage = [UIImage systemImageNamed:@"arrow.up" withConfiguration:sendConfig];
  UIButton *sendButton = [UIButton buttonWithType:UIButtonTypeCustom];
  [sendButton setImage:sendImage forState:UIControlStateNormal];
  sendButton.tintColor = [UIColor whiteColor];
  sendButton.translatesAutoresizingMaskIntoConstraints = NO;
  sendButton.hidden = YES; // Hidden by default, shown when keyboard is open and text is entered
  [inputContainer addSubview:sendButton];
  _sendButton = sendButton;

  // Store references for dynamic showing/hiding
  _micButton = micButton;
  _sendButton = sendButton;

  // Add text change observer
  [inputField addTarget:self action:@selector(inputFieldDidChange:) forControlEvents:UIControlEventEditingChanged];

  UIView *actionsContainer = [[UIView alloc] init];
  actionsContainer.translatesAutoresizingMaskIntoConstraints = NO;
  [bottomBar addSubview:actionsContainer];

  NSArray *buttonConfigs = @[@{@"icon": @"cursorarrow.click", @"label": @"Select"},@{@"icon": @"photo.fill", @"label": @"Image"},@{@"icon": @"waveform", @"label": @"Audio"},@{@"icon": @"hand.tap.fill", @"label": @"Haptic"},@{@"icon": @"bolt.fill", @"label": @"API"},@{@"icon": @"cloud.fill", @"label": @"Clo"}];

  NSMutableArray *actionButtons = [NSMutableArray array];
  for (NSDictionary *config in buttonConfigs) {
    UIView *buttonContainer = [[UIView alloc] init];
    buttonContainer.translatesAutoresizingMaskIntoConstraints = NO;
    UIImageSymbolConfiguration *iconConfig = [UIImageSymbolConfiguration configurationWithPointSize:actionIconSize weight:UIImageSymbolWeightRegular];
    UIImage *iconImage = [UIImage systemImageNamed:config[@"icon"] withConfiguration:iconConfig];
    UIImageView *iconView = [[UIImageView alloc] initWithImage:iconImage];
    iconView.tintColor = [UIColor whiteColor];
    iconView.translatesAutoresizingMaskIntoConstraints = NO;
    [buttonContainer addSubview:iconView];
    UILabel *label = [[UILabel alloc] init];
    label.text = config[@"label"];
    label.textColor = [UIColor whiteColor];
    label.font = [UIFont systemFontOfSize:actionFontSize];
    label.textAlignment = NSTextAlignmentCenter;
    label.translatesAutoresizingMaskIntoConstraints = NO;
    [buttonContainer addSubview:label];
    UIButton *button = [UIButton buttonWithType:UIButtonTypeCustom];
    button.translatesAutoresizingMaskIntoConstraints = NO;
    [buttonContainer addSubview:button];
    [buttonContainer bringSubviewToFront:button];
    [actionsContainer addSubview:buttonContainer];
    [actionButtons addObject:buttonContainer];
    CGFloat labelSpacing = [self isIPad] ? 6 : 4;
    [NSLayoutConstraint activateConstraints:@[[iconView.topAnchor constraintEqualToAnchor:buttonContainer.topAnchor],[iconView.centerXAnchor constraintEqualToAnchor:buttonContainer.centerXAnchor],[iconView.widthAnchor constraintEqualToConstant:actionIconSize],[iconView.heightAnchor constraintEqualToConstant:actionIconSize],[label.topAnchor constraintEqualToAnchor:iconView.bottomAnchor constant:labelSpacing],[label.centerXAnchor constraintEqualToAnchor:buttonContainer.centerXAnchor],[label.bottomAnchor constraintEqualToAnchor:buttonContainer.bottomAnchor],[button.topAnchor constraintEqualToAnchor:buttonContainer.topAnchor],[button.leadingAnchor constraintEqualToAnchor:buttonContainer.leadingAnchor],[button.trailingAnchor constraintEqualToAnchor:buttonContainer.trailingAnchor],[button.bottomAnchor constraintEqualToAnchor:buttonContainer.bottomAnchor]]];
  }

  // Constraints - chevron floating above input, input reduced height, with settings/image icons
  [NSLayoutConstraint activateConstraints:@[
    // Input container - reduced height, positioned at top with minimal spacing (chevron floats above it)
    [inputContainer.topAnchor constraintEqualToAnchor:bottomBar.topAnchor constant:topPadding],
    [inputContainer.leadingAnchor constraintEqualToAnchor:bottomBar.leadingAnchor constant:sidePadding],
    [inputContainer.trailingAnchor constraintEqualToAnchor:bottomBar.trailingAnchor constant:-sidePadding],
    [inputContainer.heightAnchor constraintEqualToConstant:inputHeight],

    // Settings button (left side)
    [settingsButton.leadingAnchor constraintEqualToAnchor:inputContainer.leadingAnchor constant:8],
    [settingsButton.centerYAnchor constraintEqualToAnchor:inputContainer.centerYAnchor],
    [settingsButton.widthAnchor constraintEqualToConstant:buttonSize],
    [settingsButton.heightAnchor constraintEqualToConstant:buttonSize],

    // Image button (next to settings)
    [imageButton.leadingAnchor constraintEqualToAnchor:settingsButton.trailingAnchor constant:buttonSpacing],
    [imageButton.centerYAnchor constraintEqualToAnchor:inputContainer.centerYAnchor],
    [imageButton.widthAnchor constraintEqualToConstant:buttonSize],
    [imageButton.heightAnchor constraintEqualToConstant:buttonSize],

    // Input field - full width by default (will be updated when keyboard shows)
    [inputField.leadingAnchor constraintEqualToAnchor:inputContainer.leadingAnchor constant:inputPadding],
    [inputField.trailingAnchor constraintEqualToAnchor:inputContainer.trailingAnchor constant:-inputPadding],
    [inputField.centerYAnchor constraintEqualToAnchor:inputContainer.centerYAnchor],

    // Mic button (right side, always visible when keyboard is open)
    [micButton.trailingAnchor constraintEqualToAnchor:inputContainer.trailingAnchor constant:-8],
    [micButton.centerYAnchor constraintEqualToAnchor:inputContainer.centerYAnchor],
    [micButton.widthAnchor constraintEqualToConstant:buttonSize],
    [micButton.heightAnchor constraintEqualToConstant:buttonSize],

    // Send button (appears to the right of mic when text is entered)
    [sendButton.trailingAnchor constraintEqualToAnchor:micButton.leadingAnchor constant:-8],
    [sendButton.centerYAnchor constraintEqualToAnchor:inputContainer.centerYAnchor],
    [sendButton.widthAnchor constraintEqualToConstant:buttonSize],
    [sendButton.heightAnchor constraintEqualToConstant:buttonSize],

    // Actions container
    [actionsContainer.topAnchor constraintEqualToAnchor:inputContainer.bottomAnchor constant:actionSpacing],
    [actionsContainer.leadingAnchor constraintEqualToAnchor:bottomBar.leadingAnchor],
    [actionsContainer.trailingAnchor constraintEqualToAnchor:bottomBar.trailingAnchor],
    [actionsContainer.bottomAnchor constraintEqualToAnchor:bottomBar.bottomAnchor constant:-(safeAreaBottom + bottomPadding)],

    // Chevron button - floating circle above input (positioned relative to bottomBar, above inputContainer)
    [chevronButton.centerXAnchor constraintEqualToAnchor:bottomBar.centerXAnchor],
    [chevronButton.bottomAnchor constraintEqualToAnchor:inputContainer.topAnchor constant:-chevronTopSpacing],
    [chevronButton.widthAnchor constraintEqualToConstant:chevronSize],
    [chevronButton.heightAnchor constraintEqualToConstant:chevronSize]
  ]];
  
  UIView *previousButton = nil;
  for (UIView *buttonContainer in actionButtons) {
    [NSLayoutConstraint activateConstraints:@[[buttonContainer.topAnchor constraintEqualToAnchor:actionsContainer.topAnchor],[buttonContainer.bottomAnchor constraintEqualToAnchor:actionsContainer.bottomAnchor],[buttonContainer.widthAnchor constraintEqualToAnchor:actionsContainer.widthAnchor multiplier:1.0/6.0]]];
    if (previousButton) {
      [NSLayoutConstraint activateConstraints:@[[buttonContainer.leadingAnchor constraintEqualToAnchor:previousButton.trailingAnchor]]];
    } else {
      [NSLayoutConstraint activateConstraints:@[[buttonContainer.leadingAnchor constraintEqualToAnchor:actionsContainer.leadingAnchor]]];
    }
    previousButton = buttonContainer;
  }
  
  [superview addSubview:bottomBar];
  NSLayoutConstraint *bottomConstraint = [bottomBar.bottomAnchor constraintEqualToAnchor:superview.bottomAnchor];
  [NSLayoutConstraint activateConstraints:@[[bottomBar.leadingAnchor constraintEqualToAnchor:superview.leadingAnchor],[bottomBar.trailingAnchor constraintEqualToAnchor:superview.trailingAnchor],bottomConstraint]];
  _bottomBarView = bottomBar;
  _bottomBarBottomConstraint = bottomConstraint;
}

- (void)chevronButtonTapped
{
  if ([self.delegate respondsToSelector:@selector(bottomBarChevronTapped)]) {
    [self.delegate bottomBarChevronTapped];
  }
}

- (UIView *)view { return _bottomBarView; }
- (UITextField *)inputField { return _textField; }
- (NSLayoutConstraint *)bottomConstraint { return _bottomBarBottomConstraint; }

- (BOOL)textFieldShouldReturn:(UITextField *)textField
{
  if ([self.textFieldDelegate respondsToSelector:@selector(textFieldShouldReturn:)]) {
    return [self.textFieldDelegate textFieldShouldReturn:textField];
  }
  [textField resignFirstResponder];
  return YES;
}

- (void)inputFieldDidChange:(UITextField *)textField
{
  BOOL hasText = textField.text.length > 0;
  // Only update send button visibility if keyboard is visible (mic stays visible)
  if (!_micButton.hidden && _settingsButton.hidden == NO) {
    // Mic always visible, send appears/disappears based on text
    _sendButton.hidden = !hasText;
  }
}

- (void)updateForKeyboardVisible:(BOOL)isVisible
{
  NSLog(@"🔧 updateForKeyboardVisible: %@", isVisible ? @"YES" : @"NO");

  CGFloat inputPadding = [self isIPad] ? 16 : 12;

  // Remove existing leading/trailing constraints on input field
  NSMutableArray *constraintsToRemove = [NSMutableArray array];
  for (NSLayoutConstraint *constraint in _textField.superview.constraints) {
    if ((constraint.firstItem == _textField && (constraint.firstAttribute == NSLayoutAttributeLeading || constraint.firstAttribute == NSLayoutAttributeTrailing)) ||
        (constraint.secondItem == _textField && (constraint.secondAttribute == NSLayoutAttributeLeading || constraint.secondAttribute == NSLayoutAttributeTrailing))) {
      [constraintsToRemove addObject:constraint];
    }
  }
  [NSLayoutConstraint deactivateConstraints:constraintsToRemove];

  if (isVisible) {
    NSLog(@"🔧 Showing keyboard icons");
    // Show settings, image, and mic icons (mic always visible)
    _settingsButton.hidden = NO;
    _imageButton.hidden = NO;
    _micButton.hidden = NO; // Mic always visible when keyboard is open

    // Show/hide send button based on text, positioned to right of mic
    BOOL hasText = _textField.text.length > 0;
    _sendButton.hidden = !hasText;

    // Add new constraints: input field between image button and mic button
    [NSLayoutConstraint activateConstraints:@[
      [_textField.leadingAnchor constraintEqualToAnchor:_imageButton.trailingAnchor constant:8],
      [_textField.trailingAnchor constraintEqualToAnchor:_micButton.leadingAnchor constant:-8]
    ]];
  } else {
    NSLog(@"🔧 Hiding keyboard icons");
    // Hide settings, image, mic, and send icons
    _settingsButton.hidden = YES;
    _imageButton.hidden = YES;
    _micButton.hidden = YES;
    _sendButton.hidden = YES;

    // Add new constraints: input field full width
    [NSLayoutConstraint activateConstraints:@[
      [_textField.leadingAnchor constraintEqualToAnchor:_textField.superview.leadingAnchor constant:inputPadding],
      [_textField.trailingAnchor constraintEqualToAnchor:_textField.superview.trailingAnchor constant:-inputPadding]
    ]];
  }

  [UIView animateWithDuration:0.25 animations:^{
    [_bottomBarView layoutIfNeeded];
  }];
}

@end
