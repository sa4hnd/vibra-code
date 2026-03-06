// Copyright 2015-present 650 Industries. All rights reserved.

#import "EXWebPreviewView.h"
#import "EXPreviewZoomManager.h"
#import "EXPreviewZoomManager+Private.h"

static void *EXWebPreviewProgressContext = &EXWebPreviewProgressContext;
static void *EXWebPreviewCanGoBackContext = &EXWebPreviewCanGoBackContext;
static void *EXWebPreviewCanGoForwardContext = &EXWebPreviewCanGoForwardContext;

@interface EXWebPreviewView ()

@property (nonatomic, strong, readwrite) WKWebView *webView;
@property (nonatomic, strong, readwrite) UIView *navigationBar;
@property (nonatomic, strong, readwrite) UITextField *urlTextField;
@property (nonatomic, strong, readwrite) UIButton *backButton;
@property (nonatomic, strong, readwrite) UIButton *forwardButton;
@property (nonatomic, strong, readwrite) UIButton *refreshButton;
@property (nonatomic, strong, readwrite) UIProgressView *progressView;

@end

@implementation EXWebPreviewView

#pragma mark - Initialization

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    [self setupView];
  }
  return self;
}

- (instancetype)initWithCoder:(NSCoder *)coder
{
  if (self = [super initWithCoder:coder]) {
    [self setupView];
  }
  return self;
}

- (void)dealloc
{
  // Remove KVO observers
  @try {
    [_webView removeObserver:self forKeyPath:@"estimatedProgress" context:EXWebPreviewProgressContext];
    [_webView removeObserver:self forKeyPath:@"canGoBack" context:EXWebPreviewCanGoBackContext];
    [_webView removeObserver:self forKeyPath:@"canGoForward" context:EXWebPreviewCanGoForwardContext];
  } @catch (NSException *exception) {
    // Observer may not have been added yet
  }

  // Stop loading if in progress
  [self.webView stopLoading];
}

#pragma mark - Setup

- (void)setupView
{
  self.backgroundColor = [UIColor colorWithRed:0.12 green:0.12 blue:0.12 alpha:1.0];
  self.clipsToBounds = YES;

  // Create navigation bar
  [self createNavigationBar];

  // Create WebView
  [self createWebView];

  // Create progress view
  [self createProgressView];

  // Setup constraints
  [self setupConstraints];

  // Setup KVO for navigation state
  [self setupObservers];
}

- (void)createNavigationBar
{
  EXPreviewZoomManager *manager = [EXPreviewZoomManager sharedInstance];

  // Navigation bar container
  CGFloat barHeight = [manager responsiveBarHeight:44.0];
  _navigationBar = [[UIView alloc] init];
  _navigationBar.backgroundColor = [UIColor colorWithRed:0.08 green:0.08 blue:0.08 alpha:0.95];
  _navigationBar.translatesAutoresizingMaskIntoConstraints = NO;
  [self addSubview:_navigationBar];

  // Button styling
  UIColor *buttonColor = [UIColor colorWithRed:0.6 green:0.6 blue:0.6 alpha:1.0];
  UIColor *disabledColor = [UIColor colorWithRed:0.3 green:0.3 blue:0.3 alpha:1.0];
  CGFloat iconSize = [manager responsiveIconSize:20.0];
  CGFloat buttonSize = [manager responsiveButtonSize:36.0];

  // Back button
  _backButton = [UIButton buttonWithType:UIButtonTypeSystem];
  _backButton.translatesAutoresizingMaskIntoConstraints = NO;
  [_backButton setImage:[self chevronLeftImage:iconSize] forState:UIControlStateNormal];
  _backButton.tintColor = buttonColor;
  [_backButton addTarget:self action:@selector(goBack) forControlEvents:UIControlEventTouchUpInside];
  _backButton.enabled = NO;
  [_navigationBar addSubview:_backButton];

  // Forward button
  _forwardButton = [UIButton buttonWithType:UIButtonTypeSystem];
  _forwardButton.translatesAutoresizingMaskIntoConstraints = NO;
  [_forwardButton setImage:[self chevronRightImage:iconSize] forState:UIControlStateNormal];
  _forwardButton.tintColor = buttonColor;
  [_forwardButton addTarget:self action:@selector(goForward) forControlEvents:UIControlEventTouchUpInside];
  _forwardButton.enabled = NO;
  [_navigationBar addSubview:_forwardButton];

  // URL text field
  _urlTextField = [[UITextField alloc] init];
  _urlTextField.translatesAutoresizingMaskIntoConstraints = NO;
  _urlTextField.backgroundColor = [UIColor colorWithRed:0.15 green:0.15 blue:0.15 alpha:1.0];
  _urlTextField.textColor = [UIColor colorWithRed:0.7 green:0.7 blue:0.7 alpha:1.0];
  _urlTextField.font = [UIFont systemFontOfSize:[manager responsiveFontSize:13.0]];
  _urlTextField.borderStyle = UITextBorderStyleNone;
  _urlTextField.layer.cornerRadius = [manager responsiveCornerRadius:8.0];
  _urlTextField.layer.masksToBounds = YES;
  _urlTextField.textAlignment = NSTextAlignmentCenter;
  _urlTextField.autocapitalizationType = UITextAutocapitalizationTypeNone;
  _urlTextField.autocorrectionType = UITextAutocorrectionTypeNo;
  _urlTextField.keyboardType = UIKeyboardTypeURL;
  _urlTextField.returnKeyType = UIReturnKeyGo;
  _urlTextField.clearButtonMode = UITextFieldViewModeWhileEditing;
  _urlTextField.delegate = (id<UITextFieldDelegate>)self;

  // Add padding to text field
  UIView *leftPadding = [[UIView alloc] initWithFrame:CGRectMake(0, 0, 12, 0)];
  _urlTextField.leftView = leftPadding;
  _urlTextField.leftViewMode = UITextFieldViewModeAlways;
  UIView *rightPadding = [[UIView alloc] initWithFrame:CGRectMake(0, 0, 12, 0)];
  _urlTextField.rightView = rightPadding;
  _urlTextField.rightViewMode = UITextFieldViewModeAlways;

  [_navigationBar addSubview:_urlTextField];

  // Refresh button
  _refreshButton = [UIButton buttonWithType:UIButtonTypeSystem];
  _refreshButton.translatesAutoresizingMaskIntoConstraints = NO;
  [_refreshButton setImage:[self refreshImage:iconSize] forState:UIControlStateNormal];
  _refreshButton.tintColor = buttonColor;
  [_refreshButton addTarget:self action:@selector(handleRefreshTap) forControlEvents:UIControlEventTouchUpInside];
  [_navigationBar addSubview:_refreshButton];
}

- (void)createWebView
{
  WKWebViewConfiguration *config = [[WKWebViewConfiguration alloc] init];
  config.allowsInlineMediaPlayback = YES;
  config.mediaTypesRequiringUserActionForPlayback = WKAudiovisualMediaTypeNone;

  // Enable dev tools inspection
  if (@available(iOS 16.4, *)) {
    config.preferences.inactiveSchedulingPolicy = WKInactiveSchedulingPolicyNone;
  }

  _webView = [[WKWebView alloc] initWithFrame:CGRectZero configuration:config];
  _webView.translatesAutoresizingMaskIntoConstraints = NO;
  _webView.navigationDelegate = self;
  _webView.UIDelegate = self;
  _webView.backgroundColor = [UIColor colorWithRed:0.12 green:0.12 blue:0.12 alpha:1.0];
  _webView.scrollView.backgroundColor = [UIColor colorWithRed:0.12 green:0.12 blue:0.12 alpha:1.0];
  _webView.opaque = NO;

  // Allow inspection in Safari developer tools
  if (@available(iOS 16.4, *)) {
    _webView.inspectable = YES;
  }

  [self addSubview:_webView];
}

- (void)createProgressView
{
  _progressView = [[UIProgressView alloc] initWithProgressViewStyle:UIProgressViewStyleDefault];
  _progressView.translatesAutoresizingMaskIntoConstraints = NO;
  _progressView.progressTintColor = [UIColor colorWithRed:0.12 green:0.24 blue:0.74 alpha:1.0]; // #1f3dbc
  _progressView.trackTintColor = [UIColor clearColor];
  _progressView.hidden = YES;
  [self addSubview:_progressView];
}

- (void)setupConstraints
{
  EXPreviewZoomManager *manager = [EXPreviewZoomManager sharedInstance];
  CGFloat barHeight = [manager responsiveBarHeight:44.0];
  CGFloat buttonSize = [manager responsiveButtonSize:36.0];
  CGFloat padding = [manager responsivePadding:8.0];

  // Navigation bar
  [NSLayoutConstraint activateConstraints:@[
    [_navigationBar.topAnchor constraintEqualToAnchor:self.topAnchor],
    [_navigationBar.leadingAnchor constraintEqualToAnchor:self.leadingAnchor],
    [_navigationBar.trailingAnchor constraintEqualToAnchor:self.trailingAnchor],
    [_navigationBar.heightAnchor constraintEqualToConstant:barHeight],
  ]];

  // Back button
  [NSLayoutConstraint activateConstraints:@[
    [_backButton.leadingAnchor constraintEqualToAnchor:_navigationBar.leadingAnchor constant:padding],
    [_backButton.centerYAnchor constraintEqualToAnchor:_navigationBar.centerYAnchor],
    [_backButton.widthAnchor constraintEqualToConstant:buttonSize],
    [_backButton.heightAnchor constraintEqualToConstant:buttonSize],
  ]];

  // Forward button
  [NSLayoutConstraint activateConstraints:@[
    [_forwardButton.leadingAnchor constraintEqualToAnchor:_backButton.trailingAnchor constant:padding / 2],
    [_forwardButton.centerYAnchor constraintEqualToAnchor:_navigationBar.centerYAnchor],
    [_forwardButton.widthAnchor constraintEqualToConstant:buttonSize],
    [_forwardButton.heightAnchor constraintEqualToConstant:buttonSize],
  ]];

  // Refresh button
  [NSLayoutConstraint activateConstraints:@[
    [_refreshButton.trailingAnchor constraintEqualToAnchor:_navigationBar.trailingAnchor constant:-padding],
    [_refreshButton.centerYAnchor constraintEqualToAnchor:_navigationBar.centerYAnchor],
    [_refreshButton.widthAnchor constraintEqualToConstant:buttonSize],
    [_refreshButton.heightAnchor constraintEqualToConstant:buttonSize],
  ]];

  // URL text field
  [NSLayoutConstraint activateConstraints:@[
    [_urlTextField.leadingAnchor constraintEqualToAnchor:_forwardButton.trailingAnchor constant:padding],
    [_urlTextField.trailingAnchor constraintEqualToAnchor:_refreshButton.leadingAnchor constant:-padding],
    [_urlTextField.centerYAnchor constraintEqualToAnchor:_navigationBar.centerYAnchor],
    [_urlTextField.heightAnchor constraintEqualToConstant:barHeight - 12],
  ]];

  // Progress view
  [NSLayoutConstraint activateConstraints:@[
    [_progressView.topAnchor constraintEqualToAnchor:_navigationBar.bottomAnchor],
    [_progressView.leadingAnchor constraintEqualToAnchor:self.leadingAnchor],
    [_progressView.trailingAnchor constraintEqualToAnchor:self.trailingAnchor],
    [_progressView.heightAnchor constraintEqualToConstant:2],
  ]];

  // WebView
  [NSLayoutConstraint activateConstraints:@[
    [_webView.topAnchor constraintEqualToAnchor:_progressView.bottomAnchor],
    [_webView.leadingAnchor constraintEqualToAnchor:self.leadingAnchor],
    [_webView.trailingAnchor constraintEqualToAnchor:self.trailingAnchor],
    [_webView.bottomAnchor constraintEqualToAnchor:self.bottomAnchor],
  ]];
}

- (void)setupObservers
{
  // Add KVO observers for progress and navigation state
  [_webView addObserver:self
             forKeyPath:@"estimatedProgress"
                options:NSKeyValueObservingOptionNew
                context:EXWebPreviewProgressContext];

  [_webView addObserver:self
             forKeyPath:@"canGoBack"
                options:NSKeyValueObservingOptionNew
                context:EXWebPreviewCanGoBackContext];

  [_webView addObserver:self
             forKeyPath:@"canGoForward"
                options:NSKeyValueObservingOptionNew
                context:EXWebPreviewCanGoForwardContext];
}

#pragma mark - KVO

- (void)observeValueForKeyPath:(NSString *)keyPath
                      ofObject:(id)object
                        change:(NSDictionary<NSKeyValueChangeKey, id> *)change
                       context:(void *)context
{
  if (context == EXWebPreviewProgressContext) {
    dispatch_async(dispatch_get_main_queue(), ^{
      CGFloat progress = self.webView.estimatedProgress;
      self.progressView.progress = progress;
      self.progressView.hidden = (progress >= 1.0);
    });
  } else if (context == EXWebPreviewCanGoBackContext) {
    dispatch_async(dispatch_get_main_queue(), ^{
      BOOL canGoBack = self.webView.canGoBack;
      self.backButton.enabled = canGoBack;
      self.backButton.tintColor = canGoBack
        ? [UIColor colorWithRed:0.6 green:0.6 blue:0.6 alpha:1.0]
        : [UIColor colorWithRed:0.3 green:0.3 blue:0.3 alpha:1.0];
    });
  } else if (context == EXWebPreviewCanGoForwardContext) {
    dispatch_async(dispatch_get_main_queue(), ^{
      BOOL canGoForward = self.webView.canGoForward;
      self.forwardButton.enabled = canGoForward;
      self.forwardButton.tintColor = canGoForward
        ? [UIColor colorWithRed:0.6 green:0.6 blue:0.6 alpha:1.0]
        : [UIColor colorWithRed:0.3 green:0.3 blue:0.3 alpha:1.0];
    });
  } else {
    [super observeValueForKeyPath:keyPath ofObject:object change:change context:context];
  }
}

#pragma mark - Navigation Methods

- (void)loadURL:(NSURL *)url
{
  if (!url) return;

  _currentURL = url;
  [self updateURLDisplay:url];

  NSURLRequest *request = [NSURLRequest requestWithURL:url];
  [_webView loadRequest:request];
}

- (void)goBack
{
  if ([_webView canGoBack]) {
    [_webView goBack];
  }
}

- (void)goForward
{
  if ([_webView canGoForward]) {
    [_webView goForward];
  }
}

- (void)reload
{
  [_webView reload];
}

- (void)stopLoading
{
  [_webView stopLoading];
}

- (void)handleRefreshTap
{
  if ([_webView isLoading]) {
    [self stopLoading];
    [_refreshButton setImage:[self refreshImage:[[EXPreviewZoomManager sharedInstance] responsiveIconSize:20.0]]
                    forState:UIControlStateNormal];
  } else {
    [self reload];
  }
}

#pragma mark - URL Bar Methods

- (void)updateURLDisplay:(NSURL *)url
{
  if (!url) {
    _urlTextField.text = @"";
    return;
  }

  // Display host and path for cleaner look
  NSString *displayURL = url.absoluteString;

  // Remove protocol prefix for display
  if ([displayURL hasPrefix:@"https://"]) {
    displayURL = [displayURL substringFromIndex:8];
  } else if ([displayURL hasPrefix:@"http://"]) {
    displayURL = [displayURL substringFromIndex:7];
  }

  _urlTextField.text = displayURL;
}

- (void)setURLBarEditable:(BOOL)editable
{
  _urlTextField.enabled = editable;
}

#pragma mark - State Queries

- (BOOL)canGoBack
{
  return [_webView canGoBack];
}

- (BOOL)canGoForward
{
  return [_webView canGoForward];
}

- (BOOL)isLoading
{
  return [_webView isLoading];
}

#pragma mark - WKNavigationDelegate

- (void)webView:(WKWebView *)webView didStartProvisionalNavigation:(WKNavigation *)navigation
{
  _progressView.hidden = NO;
  _progressView.progress = 0;

  // Update refresh button to stop icon
  [_refreshButton setImage:[self stopImage:[[EXPreviewZoomManager sharedInstance] responsiveIconSize:20.0]]
                  forState:UIControlStateNormal];

  if ([_delegate respondsToSelector:@selector(webPreviewViewDidStartLoading:)]) {
    [_delegate webPreviewViewDidStartLoading:self];
  }
}

- (void)webView:(WKWebView *)webView didFinishNavigation:(WKNavigation *)navigation
{
  _progressView.hidden = YES;
  _progressView.progress = 0;

  // Update refresh button back to refresh icon
  [_refreshButton setImage:[self refreshImage:[[EXPreviewZoomManager sharedInstance] responsiveIconSize:20.0]]
                  forState:UIControlStateNormal];

  // Update URL display
  [self updateURLDisplay:webView.URL];
  _currentURL = webView.URL;

  if ([_delegate respondsToSelector:@selector(webPreviewViewDidFinishLoading:)]) {
    [_delegate webPreviewViewDidFinishLoading:self];
  }

  if ([_delegate respondsToSelector:@selector(webPreviewView:didNavigateToURL:)]) {
    [_delegate webPreviewView:self didNavigateToURL:webView.URL];
  }
}

- (void)webView:(WKWebView *)webView didFailProvisionalNavigation:(WKNavigation *)navigation withError:(NSError *)error
{
  _progressView.hidden = YES;

  // Update refresh button back to refresh icon
  [_refreshButton setImage:[self refreshImage:[[EXPreviewZoomManager sharedInstance] responsiveIconSize:20.0]]
                  forState:UIControlStateNormal];

  // Don't report cancelled errors (user stopped loading)
  if (error.code == NSURLErrorCancelled) {
    return;
  }

  if ([_delegate respondsToSelector:@selector(webPreviewView:didFailWithError:)]) {
    [_delegate webPreviewView:self didFailWithError:error];
  }
}

- (void)webView:(WKWebView *)webView didFailNavigation:(WKNavigation *)navigation withError:(NSError *)error
{
  _progressView.hidden = YES;

  // Update refresh button back to refresh icon
  [_refreshButton setImage:[self refreshImage:[[EXPreviewZoomManager sharedInstance] responsiveIconSize:20.0]]
                  forState:UIControlStateNormal];

  // Don't report cancelled errors
  if (error.code == NSURLErrorCancelled) {
    return;
  }

  if ([_delegate respondsToSelector:@selector(webPreviewView:didFailWithError:)]) {
    [_delegate webPreviewView:self didFailWithError:error];
  }
}

#pragma mark - WKUIDelegate

- (WKWebView *)webView:(WKWebView *)webView createWebViewWithConfiguration:(WKWebViewConfiguration *)configuration
   forNavigationAction:(WKNavigationAction *)navigationAction
        windowFeatures:(WKWindowFeatures *)windowFeatures
{
  // Open new windows in the same web view
  if (!navigationAction.targetFrame.isMainFrame) {
    [webView loadRequest:navigationAction.request];
  }
  return nil;
}

#pragma mark - UITextFieldDelegate

- (BOOL)textFieldShouldReturn:(UITextField *)textField
{
  NSString *urlString = textField.text;

  // Add https:// if no protocol specified
  if (![urlString hasPrefix:@"http://"] && ![urlString hasPrefix:@"https://"]) {
    urlString = [NSString stringWithFormat:@"https://%@", urlString];
  }

  NSURL *url = [NSURL URLWithString:urlString];
  if (url) {
    [self loadURL:url];
  }

  [textField resignFirstResponder];
  return YES;
}

#pragma mark - Icon Helpers

- (UIImage *)chevronLeftImage:(CGFloat)size
{
  UIGraphicsBeginImageContextWithOptions(CGSizeMake(size, size), NO, 0);
  CGContextRef ctx = UIGraphicsGetCurrentContext();

  [[UIColor whiteColor] setStroke];
  CGContextSetLineWidth(ctx, 2.0);
  CGContextSetLineCap(ctx, kCGLineCapRound);
  CGContextSetLineJoin(ctx, kCGLineJoinRound);

  CGFloat padding = size * 0.25;
  CGFloat centerY = size / 2;

  CGContextMoveToPoint(ctx, size - padding, padding);
  CGContextAddLineToPoint(ctx, padding, centerY);
  CGContextAddLineToPoint(ctx, size - padding, size - padding);
  CGContextStrokePath(ctx);

  UIImage *image = UIGraphicsGetImageFromCurrentImageContext();
  UIGraphicsEndImageContext();

  return [image imageWithRenderingMode:UIImageRenderingModeAlwaysTemplate];
}

- (UIImage *)chevronRightImage:(CGFloat)size
{
  UIGraphicsBeginImageContextWithOptions(CGSizeMake(size, size), NO, 0);
  CGContextRef ctx = UIGraphicsGetCurrentContext();

  [[UIColor whiteColor] setStroke];
  CGContextSetLineWidth(ctx, 2.0);
  CGContextSetLineCap(ctx, kCGLineCapRound);
  CGContextSetLineJoin(ctx, kCGLineJoinRound);

  CGFloat padding = size * 0.25;
  CGFloat centerY = size / 2;

  CGContextMoveToPoint(ctx, padding, padding);
  CGContextAddLineToPoint(ctx, size - padding, centerY);
  CGContextAddLineToPoint(ctx, padding, size - padding);
  CGContextStrokePath(ctx);

  UIImage *image = UIGraphicsGetImageFromCurrentImageContext();
  UIGraphicsEndImageContext();

  return [image imageWithRenderingMode:UIImageRenderingModeAlwaysTemplate];
}

- (UIImage *)refreshImage:(CGFloat)size
{
  UIGraphicsBeginImageContextWithOptions(CGSizeMake(size, size), NO, 0);
  CGContextRef ctx = UIGraphicsGetCurrentContext();

  [[UIColor whiteColor] setStroke];
  CGContextSetLineWidth(ctx, 2.0);
  CGContextSetLineCap(ctx, kCGLineCapRound);

  CGFloat center = size / 2;
  CGFloat radius = size * 0.35;

  // Draw circular arrow
  CGContextAddArc(ctx, center, center, radius, -M_PI / 4, M_PI * 1.25, 0);
  CGContextStrokePath(ctx);

  // Draw arrow head
  CGFloat arrowTip = center + radius * cos(-M_PI / 4);
  CGFloat arrowY = center + radius * sin(-M_PI / 4);

  CGContextMoveToPoint(ctx, arrowTip - 4, arrowY - 4);
  CGContextAddLineToPoint(ctx, arrowTip, arrowY);
  CGContextAddLineToPoint(ctx, arrowTip + 4, arrowY - 4);
  CGContextStrokePath(ctx);

  UIImage *image = UIGraphicsGetImageFromCurrentImageContext();
  UIGraphicsEndImageContext();

  return [image imageWithRenderingMode:UIImageRenderingModeAlwaysTemplate];
}

- (UIImage *)stopImage:(CGFloat)size
{
  UIGraphicsBeginImageContextWithOptions(CGSizeMake(size, size), NO, 0);
  CGContextRef ctx = UIGraphicsGetCurrentContext();

  [[UIColor whiteColor] setStroke];
  CGContextSetLineWidth(ctx, 2.0);
  CGContextSetLineCap(ctx, kCGLineCapRound);

  CGFloat padding = size * 0.3;

  // Draw X
  CGContextMoveToPoint(ctx, padding, padding);
  CGContextAddLineToPoint(ctx, size - padding, size - padding);
  CGContextStrokePath(ctx);

  CGContextMoveToPoint(ctx, size - padding, padding);
  CGContextAddLineToPoint(ctx, padding, size - padding);
  CGContextStrokePath(ctx);

  UIImage *image = UIGraphicsGetImageFromCurrentImageContext();
  UIGraphicsEndImageContext();

  return [image imageWithRenderingMode:UIImageRenderingModeAlwaysTemplate];
}

@end
