// Copyright 2015-present 650 Industries. All rights reserved.

#import "EXAbstractLoader.h"
#import "EXErrorView.h"
#import "EXEnvironment.h"
#import "EXKernel.h"
#import "EXKernelAppRecord.h"
#import "EXManifestResource.h"
#import "EXUtil.h"
#import "Expo_Go-Swift.h"

@import EXManifests;

@interface EXErrorView ()

@property (nonatomic, strong) IBOutlet UILabel *lblError;
@property (nonatomic, strong) IBOutlet UIButton *btnRetry;
@property (nonatomic, strong) IBOutlet UIButton *btnBack;
@property (nonatomic, strong) IBOutlet UIStackView *btnStack;
@property (nonatomic, strong) IBOutlet UIView *btnStackContainer;
@property (nonatomic, strong) IBOutlet UILabel *lblUrl;
@property (nonatomic, strong) IBOutlet UITextView *txtErrorDetail;
@property (nonatomic, strong) IBOutlet UIScrollView *vContainer;
@property (nonatomic, strong) IBOutlet UILabel *lblFixHeader;
@property (nonatomic, strong) IBOutlet UITextView *txtFixDetail;
@property (nonatomic, strong) IBOutlet UILabel *lblHumorMessage;
@property (nonatomic, strong) IBOutlet UIView *humorCardContainer;
@property (nonatomic, strong) IBOutlet UIView *tipsCardContainer;
@property (nonatomic, strong) IBOutlet UILabel *lblTipsHeader;
@property (nonatomic, strong) IBOutlet UILabel *lblTipsContent;

// Copy Error button (created programmatically)
@property (nonatomic, strong) UIButton *btnCopyError;
@property (nonatomic, strong) UILabel *lblCopyHint;

// Store formatted error text for copying
@property (nonatomic, strong) NSString *cachedErrorText;

- (void)_onTapRetry;
- (void)_onTapCopyError;
- (NSString *)_getRandomHumorMessage;
- (NSString *)_getRandomTipsMessage;

@end

@implementation EXErrorView

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    [[NSBundle mainBundle] loadNibNamed:@"EXErrorView" owner:self options:nil];
    [self addSubview:_vContainer];
    
    [_btnRetry addTarget:self action:@selector(_onTapRetry) forControlEvents:UIControlEventTouchUpInside];
    [_btnBack addTarget:self action:@selector(_onTapBack) forControlEvents:UIControlEventTouchUpInside];

    // 🎨 Vibra Design: Match HomeScreenView gradient background
    self.backgroundColor = [UIColor clearColor];
    _vContainer.backgroundColor = [UIColor clearColor];
    
    // Add Vibra gradient background
    CAGradientLayer *vibeGradientLayer = [CAGradientLayer layer];
    vibeGradientLayer.frame = self.bounds;
    vibeGradientLayer.colors = @[
      (id)[UIColor colorWithRed:0.039 green:0.039 blue:0.059 alpha:1.0].CGColor, // #0A0A0F
      (id)[UIColor colorWithRed:0.102 green:0.102 blue:0.125 alpha:1.0].CGColor, // #1A1A20
      (id)[UIColor colorWithRed:0.165 green:0.165 blue:0.208 alpha:1.0].CGColor, // #2A2A35
      (id)[UIColor colorWithRed:0.102 green:0.102 blue:0.125 alpha:1.0].CGColor, // #1A1A20
      (id)[UIColor colorWithRed:0.039 green:0.039 blue:0.059 alpha:1.0].CGColor  // #0A0A0F
    ];
    vibeGradientLayer.startPoint = CGPointMake(0, 0);
    vibeGradientLayer.endPoint = CGPointMake(1, 1);
    vibeGradientLayer.locations = @[@0.0, @0.2, @0.5, @0.8, @1.0];
    [self.layer insertSublayer:vibeGradientLayer atIndex:0];
    
    // Add glass morphism overlay
    CALayer *glassOverlay = [CALayer layer];
    glassOverlay.frame = self.bounds;
    glassOverlay.backgroundColor = [UIColor colorWithRed:1.0 green:1.0 blue:1.0 alpha:0.02].CGColor; // White tint
    [self.layer insertSublayer:glassOverlay atIndex:1];

    // 🎨 Vibra Design: Style error title with Vibra typography
    _lblError.textColor = [UIColor colorWithRed:0.961 green:0.961 blue:0.969 alpha:1.0]; // #F5F5F7 (Vibra text)
    _lblError.font = [UIFont systemFontOfSize:28 weight:UIFontWeightBold]; // Vibra typography
    _lblError.textAlignment = NSTextAlignmentCenter;
    _lblError.numberOfLines = 0;
    // Add Vibra text shadow
    _lblError.layer.shadowColor = [UIColor colorWithRed:0.0 green:0.0 blue:0.0 alpha:0.5].CGColor;
    _lblError.layer.shadowOffset = CGSizeMake(0, 2);
    _lblError.layer.shadowRadius = 4;
    _lblError.layer.shadowOpacity = 0.6;

    // 🎨 Vibra Design: Remove container background - seamless design like HomeScreenView
    _humorCardContainer.backgroundColor = [UIColor clearColor]; // Completely transparent
    _humorCardContainer.layer.cornerRadius = 0; // No corner radius
    _humorCardContainer.layer.borderWidth = 0; // No border
    _humorCardContainer.layer.borderColor = [UIColor clearColor].CGColor; // No border color
    _humorCardContainer.layer.shadowColor = [UIColor clearColor].CGColor; // No shadow
    _humorCardContainer.layer.shadowOffset = CGSizeMake(0, 0);
    _humorCardContainer.layer.shadowRadius = 0;
    _humorCardContainer.layer.shadowOpacity = 0;
    
    _lblHumorMessage.textColor = [UIColor colorWithRed:0.961 green:0.961 blue:0.969 alpha:1.0]; // Vibra text
    _lblHumorMessage.font = [UIFont systemFontOfSize:17 weight:UIFontWeightMedium]; // Vibra typography
    _lblHumorMessage.textAlignment = NSTextAlignmentCenter;
    _lblHumorMessage.numberOfLines = 0;
    _lblHumorMessage.text = [self _getRandomHumorMessage];

    // 🎨 Vibra Design: Style URL with neutral accent
    _lblUrl.textColor = [UIColor colorWithRed:0.8 green:0.8 blue:0.8 alpha:1.0]; // Light gray
    _lblUrl.font = [UIFont systemFontOfSize:15 weight:UIFontWeightBold]; // Vibra typography
    _lblUrl.textAlignment = NSTextAlignmentCenter;
    _lblUrl.numberOfLines = 0;

    // 🎨 Vibra Design: Remove error detail container - seamless design
    [_txtErrorDetail setTextContainerInset:UIEdgeInsetsMake(20, 20, 20, 20)]; // Normal spacing
    _txtErrorDetail.textContainer.lineFragmentPadding = 0;
    _txtErrorDetail.backgroundColor = [UIColor clearColor]; // Completely transparent
    _txtErrorDetail.textColor = [UIColor colorWithRed:0.780 green:0.780 blue:0.800 alpha:1.0]; // Vibra secondary text color
    _txtErrorDetail.font = [UIFont systemFontOfSize:14 weight:UIFontWeightRegular]; // Smaller, more subtle
    _txtErrorDetail.layer.cornerRadius = 0; // No corner radius
    _txtErrorDetail.layer.borderWidth = 0; // No border
    _txtErrorDetail.layer.borderColor = [UIColor clearColor].CGColor; // No border color
    // No shadow
    _txtErrorDetail.layer.shadowColor = [UIColor clearColor].CGColor;
    _txtErrorDetail.layer.shadowOffset = CGSizeMake(0, 0);
    _txtErrorDetail.layer.shadowRadius = 0;
    _txtErrorDetail.layer.shadowOpacity = 0;

    // 🎨 Vibra Design: Style fix header with Vibra typography
    _lblFixHeader.textColor = [UIColor colorWithRed:0.961 green:0.961 blue:0.969 alpha:1.0]; // Vibra text
    _lblFixHeader.font = [UIFont systemFontOfSize:20 weight:UIFontWeightBold]; // Vibra typography
    _lblFixHeader.textAlignment = NSTextAlignmentCenter;
    // Add Vibra text shadow
    _lblFixHeader.layer.shadowColor = [UIColor colorWithRed:0.0 green:0.0 blue:0.0 alpha:0.5].CGColor;
    _lblFixHeader.layer.shadowOffset = CGSizeMake(0, 1);
    _lblFixHeader.layer.shadowRadius = 2;
    _lblFixHeader.layer.shadowOpacity = 0.6;

    // 🎨 Vibra Design: Remove fix detail container - seamless design
    [_txtFixDetail setTextContainerInset:UIEdgeInsetsMake(20, 20, 20, 20)]; // Normal spacing
    _txtFixDetail.textContainer.lineFragmentPadding = 0;
    _txtFixDetail.backgroundColor = [UIColor clearColor]; // Completely transparent
    _txtFixDetail.textColor = [UIColor colorWithRed:0.780 green:0.780 blue:0.800 alpha:1.0]; // Vibra secondary text color
    _txtFixDetail.font = [UIFont systemFontOfSize:14 weight:UIFontWeightRegular]; // Smaller, more subtle
    _txtFixDetail.layer.cornerRadius = 0; // No corner radius
    _txtFixDetail.layer.borderWidth = 0; // No border
    _txtFixDetail.layer.borderColor = [UIColor clearColor].CGColor; // No border color
    // No shadow
    _txtFixDetail.layer.shadowColor = [UIColor clearColor].CGColor;
    _txtFixDetail.layer.shadowOffset = CGSizeMake(0, 0);
    _txtFixDetail.layer.shadowRadius = 0;
    _txtFixDetail.layer.shadowOpacity = 0;

    // 🎨 Vibra Design: Retry button with purple-blue gradient
    _btnRetry.backgroundColor = [UIColor clearColor];
    [_btnRetry setTitleColor:[UIColor whiteColor] forState:UIControlStateNormal];
    _btnRetry.titleLabel.font = [UIFont systemFontOfSize:17 weight:UIFontWeightBold]; // Vibra typography
    _btnRetry.layer.cornerRadius = 16.0; // Vibra border radius
    
    // Add Vibra gradient to retry button
    CAGradientLayer *retryGradient = [CAGradientLayer layer];
    retryGradient.colors = @[
      (id)[UIColor colorWithRed:0.541 green:0.169 blue:0.886 alpha:1.0].CGColor, // #8A2BE2 (purple)
      (id)[UIColor colorWithRed:0.118 green:0.565 blue:1.0 alpha:1.0].CGColor    // #1E90FF (blue)
    ];
    retryGradient.startPoint = CGPointMake(0, 0);
    retryGradient.endPoint = CGPointMake(1, 0);
    retryGradient.cornerRadius = 16.0;
    [_btnRetry.layer insertSublayer:retryGradient atIndex:0];
    
    // Vibra shadow and border
    _btnRetry.layer.borderWidth = 1.5;
    _btnRetry.layer.borderColor = [UIColor colorWithWhite:1.0 alpha:0.2].CGColor;
    _btnRetry.layer.shadowColor = [UIColor colorWithRed:0.541 green:0.169 blue:0.886 alpha:0.5].CGColor;
    _btnRetry.layer.shadowOffset = CGSizeMake(0, 8);
    _btnRetry.layer.shadowOpacity = 0.4;
    _btnRetry.layer.shadowRadius = 16;
    _btnRetry.layer.masksToBounds = NO;
    _btnRetry.titleLabel.font = [UIFont systemFontOfSize:16 weight:UIFontWeightSemibold];
    _btnRetry.contentEdgeInsets = UIEdgeInsetsMake(18, 24, 18, 24);
    
    // Enhanced shadow for modern depth
    _btnRetry.layer.shadowColor = [UIColor colorWithRed:1.0 green:0.42 blue:0.21 alpha:1.0].CGColor;
    _btnRetry.layer.shadowOffset = CGSizeMake(0, 4);
    _btnRetry.layer.shadowRadius = 12;
    _btnRetry.layer.shadowOpacity = 0.4;
    
    // Add subtle border for definition
    _btnRetry.layer.borderWidth = 1.0;
    _btnRetry.layer.borderColor = [UIColor colorWithWhite:1.0 alpha:0.1].CGColor;

    // 🎨 Vibra Design: Style secondary button (Go Home)
    _btnBack.backgroundColor = [UIColor clearColor];
    [_btnBack setTitleColor:[UIColor colorWithRed:1.0 green:0.42 blue:0.21 alpha:1.0] forState:UIControlStateNormal];
    _btnBack.titleLabel.font = [UIFont systemFontOfSize:16 weight:UIFontWeightMedium];
    _btnBack.contentEdgeInsets = UIEdgeInsetsMake(12, 24, 12, 24);

    // 🎨 Vibra Design: Remove tips container - seamless design like HomeScreenView
    _tipsCardContainer.backgroundColor = [UIColor clearColor]; // Completely transparent
    _tipsCardContainer.layer.cornerRadius = 0; // No corner radius
    _tipsCardContainer.layer.borderWidth = 0; // No border
    _tipsCardContainer.layer.borderColor = [UIColor clearColor].CGColor; // No border color
    _tipsCardContainer.layer.shadowColor = [UIColor clearColor].CGColor; // No shadow
    _tipsCardContainer.layer.shadowOffset = CGSizeMake(0, 0);
    _tipsCardContainer.layer.shadowRadius = 0;
    _tipsCardContainer.layer.shadowOpacity = 0;
    
    _lblTipsHeader.textColor = [UIColor colorWithRed:0.961 green:0.961 blue:0.969 alpha:1.0]; // Vibra text
    _lblTipsHeader.font = [UIFont systemFontOfSize:18 weight:UIFontWeightBold]; // Vibra typography
    _lblTipsHeader.text = @"💡 Quick Tips";
    // Add subtle text shadow
    _lblTipsHeader.layer.shadowColor = [UIColor colorWithRed:0.541 green:0.169 blue:0.886 alpha:0.2].CGColor;
    _lblTipsHeader.layer.shadowOffset = CGSizeMake(0, 1);
    _lblTipsHeader.layer.shadowRadius = 2;
    _lblTipsHeader.layer.shadowOpacity = 0.3;
    
    _lblTipsContent.textColor = [UIColor colorWithRed:0.780 green:0.780 blue:0.800 alpha:1.0]; // Vibra secondary text
    _lblTipsContent.font = [UIFont systemFontOfSize:15 weight:UIFontWeightRegular]; // Vibra typography
    _lblTipsContent.numberOfLines = 0;
    _lblTipsContent.text = [self _getRandomTipsMessage];

    // 🎨 Vibra Design: Remove button stack container - seamless design
    _btnStackContainer.backgroundColor = [UIColor clearColor]; // Completely transparent
    _btnStackContainer.layer.cornerRadius = 0; // No corner radius
    _btnStackContainer.layer.borderWidth = 0; // No border
    _btnStackContainer.layer.borderColor = [UIColor clearColor].CGColor; // No border color
    _btnStackContainer.layer.shadowColor = [UIColor clearColor].CGColor; // No shadow
    _btnStackContainer.layer.shadowOffset = CGSizeMake(0, 0);
    _btnStackContainer.layer.shadowRadius = 0;
    _btnStackContainer.layer.shadowOpacity = 0;

    // 🎨 Create Copy Error button with modern iOS design
    _btnCopyError = [UIButton buttonWithType:UIButtonTypeSystem];
    _btnCopyError.translatesAutoresizingMaskIntoConstraints = NO;

    // Configure button appearance - Glass morphism style
    UIImage *copyIcon = [UIImage systemImageNamed:@"doc.on.doc.fill"];
    [_btnCopyError setImage:copyIcon forState:UIControlStateNormal];
    [_btnCopyError setTitle:@"  Copy Error to Chat" forState:UIControlStateNormal];
    _btnCopyError.tintColor = [UIColor colorWithRed:0.541 green:0.169 blue:0.886 alpha:1.0]; // Vibra purple
    _btnCopyError.titleLabel.font = [UIFont systemFontOfSize:16 weight:UIFontWeightSemibold];

    // Glass morphism background
    _btnCopyError.backgroundColor = [UIColor colorWithRed:0.541 green:0.169 blue:0.886 alpha:0.15];
    _btnCopyError.layer.cornerRadius = 14;
    _btnCopyError.layer.borderWidth = 1.0;
    _btnCopyError.layer.borderColor = [UIColor colorWithRed:0.541 green:0.169 blue:0.886 alpha:0.3].CGColor;
    _btnCopyError.contentEdgeInsets = UIEdgeInsetsMake(14, 20, 14, 20);

    [_btnCopyError addTarget:self action:@selector(_onTapCopyError) forControlEvents:UIControlEventTouchUpInside];

    // 🎨 Create hint label
    _lblCopyHint = [[UILabel alloc] init];
    _lblCopyHint.translatesAutoresizingMaskIntoConstraints = NO;
    _lblCopyHint.text = @"Paste in chat so VibraAgent can fix it 🤖";
    _lblCopyHint.textColor = [UIColor colorWithRed:0.6 green:0.6 blue:0.65 alpha:1.0];
    _lblCopyHint.font = [UIFont systemFontOfSize:13 weight:UIFontWeightMedium];
    _lblCopyHint.textAlignment = NSTextAlignmentCenter;
    _lblCopyHint.numberOfLines = 1;

    // Add to button stack
    [_btnStack addArrangedSubview:_btnCopyError];
    [_btnStack addArrangedSubview:_lblCopyHint];
  }
  return self;
}

- (void)setType:(EXFatalErrorType)type
{
  _type = type;
  NSString *appOwnerName = @"the requested app";
  if (_appRecord) {
    if (_appRecord == [EXKernel sharedInstance].appRegistry.homeAppRecord) {
      appOwnerName = @"Expo";
    } else if (_appRecord.appLoader.manifest && _appRecord.appLoader.manifest.name) {
      appOwnerName = [NSString stringWithFormat:@"\"%@\"", _appRecord.appLoader.manifest.name];
    }
  }

  switch (type) {
    case kEXFatalErrorTypeLoading: {
      _lblError.text = [NSString stringWithFormat:@"Unable to load %@", appOwnerName];
      break;
    }
    case kEXFatalErrorTypeException: {
      _lblError.text = [NSString stringWithFormat:@"Something went wrong with %@", appOwnerName];
      break;
    }
  }
  [self _resetUIState];
}

- (void)setError:(NSError *)error
{
  _error = error;
  _cachedErrorText = nil; // Clear cached error text for new error
  NSString *errorHeader = [EXManifestResource formatHeader:error];
  NSString *errorDetail = [error localizedDescription];
  NSString *errorFixInstructions = [error userInfo][EXFixInstructionsKey];
  NSNumber *showTryAgainButtonNumber = [error userInfo][EXShowTryAgainButtonKey];
  Boolean showTryAgainButton = [showTryAgainButtonNumber boolValue];

  if (errorHeader != nil) {
    _lblError.text = errorHeader;
  }

  switch (_type) {
    case kEXFatalErrorTypeLoading: {
      if (_error.code == kCFURLErrorNotConnectedToInternet) {
        errorDetail = [NSString stringWithFormat:@"%@ Make sure you're connected to the internet.", errorDetail];
      } else if (_appRecord.appLoader.manifestUrl) {
        NSString *url = _appRecord.appLoader.manifestUrl.absoluteString;
        if ([self _urlLooksLikeLAN:url]) {
          NSString *extraLANPermissionText = @"";
          if (@available(iOS 14, *)) {
            extraLANPermissionText = @", and that you have granted Expo Go the Local Network permission in the Settings app,";
          }
          errorDetail = [NSString stringWithFormat:
                            @"%@\n\nIt looks like you may be using a LAN URL. "
                            "Make sure your device is on the same network as the server%@ or try using the tunnel connection type.", errorDetail, extraLANPermissionText];
        }
      }
      break;
    }
    case kEXFatalErrorTypeException: {
      break;
    }
  }

  UIFont *font = _txtErrorDetail.font;
  if (errorDetail != nil) {
    NSAttributedString *attributedErrorString =[[NSAttributedString alloc] initWithString:errorDetail];
    attributedErrorString = [EXManifestResource parseUrlsAndBoldInAttributedString:attributedErrorString withFont:font];
    _txtErrorDetail.attributedText = attributedErrorString;
  }
  // 🎨 Vibra Design: Consistent text styling
  _txtErrorDetail.textColor = [UIColor colorWithWhite:0.92 alpha:1.0];
  _txtErrorDetail.backgroundColor = [UIColor clearColor];

  if (errorFixInstructions != nil) {
    NSAttributedString *attributedFixInstructions = [[NSAttributedString alloc] initWithString:errorFixInstructions];
    attributedFixInstructions = [EXManifestResource parseUrlsAndBoldInAttributedString:attributedFixInstructions withFont:font];
    _txtFixDetail.attributedText = attributedFixInstructions;
    // 🎨 Vibra Design: Consistent fix detail styling
    _txtFixDetail.textColor = [UIColor colorWithWhite:0.85 alpha:1.0];
    _txtFixDetail.backgroundColor = [UIColor clearColor];
  } else {
    [_lblFixHeader removeFromSuperview];
    [_txtFixDetail removeFromSuperview];
  }

  if (!showTryAgainButton) {
    [_btnRetry removeFromSuperview];
  }
  
  // Send error to cli/packager
  if (errorHeader != nil && errorDetail != nil) {
    NSString* cleanedDetails = [errorDetail stringByReplacingOccurrencesOfString:@"**" withString:@""];
    if (errorFixInstructions != nil) {
      [EXPackagerLogHelper logError:[NSString stringWithFormat:@"%@\n\n%@\n\nHow to fix this error:\n\n%@", errorHeader, cleanedDetails, errorFixInstructions] withBundleUrl:_appRecord.appLoader.manifestUrl];
    } else {
      [EXPackagerLogHelper logError:[NSString stringWithFormat:@"%@\n\n%@", errorHeader, cleanedDetails] withBundleUrl:_appRecord.appLoader.manifestUrl];
    }
  }

  // 🎨 Vibra Design: Refresh humor message and tips for new errors
  _lblHumorMessage.text = [self _getRandomHumorMessage];
  _lblTipsContent.text = [self _getRandomTipsMessage];
  
  [self _resetUIState];
}

- (void)setAppRecord:(EXKernelAppRecord *)appRecord
{
  _appRecord = appRecord;
  [self _resetUIState];
}

- (void)layoutSubviews
{
  [super layoutSubviews];

  // 🎨 Vibra Design: Consistent dark theme background
  self.backgroundColor = [UIColor colorWithRed:0.102 green:0.102 blue:0.102 alpha:1.0];
  _vContainer.backgroundColor = [UIColor colorWithRed:0.102 green:0.102 blue:0.102 alpha:1.0];

  _vContainer.translatesAutoresizingMaskIntoConstraints = NO;

  UILayoutGuide *guide = self.safeAreaLayoutGuide;
  [_vContainer.leadingAnchor constraintEqualToAnchor:guide.leadingAnchor constant:20].active = YES;
  [_vContainer.trailingAnchor constraintEqualToAnchor:guide.trailingAnchor constant:-20].active = YES;
  [_vContainer.topAnchor constraintEqualToAnchor:guide.topAnchor constant:20].active = YES;
  [_vContainer.bottomAnchor constraintEqualToAnchor:guide.bottomAnchor constant:-20].active = YES;
  
  // Ensure consistent styling after layout - Vibra design system (seamless containers)
  _txtErrorDetail.layer.cornerRadius = 0; // No containers
  _txtFixDetail.layer.cornerRadius = 0; // No containers
  _humorCardContainer.layer.cornerRadius = 0; // No containers
  _tipsCardContainer.layer.cornerRadius = 0; // No containers
  _btnStackContainer.layer.cornerRadius = 0; // No containers
  _btnRetry.layer.cornerRadius = 16.0; // Keep button styling
}

#pragma mark - Internal

- (void)_resetUIState
{
  EXKernelAppRecord *homeRecord = [EXKernel sharedInstance].appRegistry.homeAppRecord;
  _btnBack.hidden = (!homeRecord || _appRecord == homeRecord);
  _lblUrl.hidden = !homeRecord;
  _lblUrl.text = _appRecord.appLoader.manifestUrl.absoluteString;
  // TODO: maybe hide retry (see BrowserErrorView)
  [self setNeedsLayout];
}

- (void)_onTapRetry
{
  if (_delegate) {
    [_delegate errorViewDidSelectRetry:self];
  }
}

- (void)_onTapBack
{
  if ([EXKernel sharedInstance].browserController) {
    [[EXKernel sharedInstance].browserController moveHomeToVisible];
  }
}

- (BOOL)_urlLooksLikeLAN:(NSString *)url
{
  return (
    url && (
      [url rangeOfString:@".local"].length > 0 ||
      [url rangeOfString:@"192."].length > 0 ||
      [url rangeOfString:@"10."].length > 0 ||
      [url rangeOfString:@"172."].length > 0
    )
  );
}

- (NSString *)_getRandomHumorMessage
{
  NSArray *humorMessages = @[
    @"🤖 Even VibraCoder has bad WiFi days sometimes...",
    @"💫 It's not a bug, it's a feature! - Every developer ever",
    @"🚀 Houston, we have a problem... but we fix it!",
    @"☕ Error 404: Coffee not found. Please refill and try again.",
    @"🎯 VibraCoder never makes mistakes. The server just had different plans.",
    @"🔥 This error is so rare, you should feel special!",
    @"🐛 The bug is not in the code, it's in the universe's sense of humor.",
    @"⚡ Lightning fast... at crashing! ⚡",
    @"🎭 Plot twist: The error was the friends we made along the way.",
    @"🍕 Pizza delivery error: Code not found. Please add more cheese.",
    @"🎪 Welcome to the error circus! Step right up and see the amazing disappearing app!",
    @"🦄 This is a rare unicorn error. They say if you see one, make a wish!",
    @"🎨 Error 500: Picasso mode activated. The app is now abstract art.",
    @"🏆 Congratulations! You've discovered a new species of bug!",
    @"🎪 The app is taking a coffee break. It'll be back in 5... or 500... years."
  ];
  
  NSUInteger randomIndex = arc4random_uniform((uint32_t)[humorMessages count]);
  return humorMessages[randomIndex];
}

- (NSString *)_getRandomTipsMessage
{
  NSArray *tipsMessages = @[
    @"• Close and reopen VibraCoder\n• Check your internet connection\n• Try refreshing the page\n• Restart your development server",
    @"• Clear your browser cache\n• Check if the URL is correct\n• Verify your network settings\n• Try using a different network",
    @"• Restart your computer\n• Update VibraCoder to latest version\n• Check firewall settings\n• Contact support if issue persists",
    @"• Close other apps using network\n• Check VPN connection\n• Verify DNS settings\n• Try mobile hotspot",
    @"• Restart your router\n• Check cable connections\n• Update network drivers\n• Try different browser",
    @"• Clear app data/cache\n• Reinstall VibraCoder\n• Check system requirements\n• Run as administrator"
  ];

  NSUInteger randomIndex = arc4random_uniform((uint32_t)[tipsMessages count]);
  return tipsMessages[randomIndex];
}

#pragma mark - Public Methods

- (NSString *)formattedErrorText
{
  if (_cachedErrorText) {
    return _cachedErrorText;
  }

  NSMutableString *errorText = [NSMutableString string];

  // Add title
  if (_lblError.text) {
    [errorText appendFormat:@"🔴 %@\n\n", _lblError.text];
  }

  // Add URL
  if (_lblUrl.text && !_lblUrl.hidden) {
    [errorText appendFormat:@"📍 URL: %@\n\n", _lblUrl.text];
  }

  // Add error detail
  if (_txtErrorDetail.text && _txtErrorDetail.text.length > 0) {
    [errorText appendFormat:@"❌ Error:\n%@\n\n", _txtErrorDetail.text];
  }

  // Add fix instructions if present
  if (_txtFixDetail.text && _txtFixDetail.text.length > 0 && _txtFixDetail.superview) {
    [errorText appendFormat:@"🛠 How to fix:\n%@\n", _txtFixDetail.text];
  }

  _cachedErrorText = [errorText copy];
  return _cachedErrorText;
}

- (void)_onTapCopyError
{
  NSString *errorText = [self formattedErrorText];

  // Copy to clipboard
  [[UIPasteboard generalPasteboard] setString:errorText];

  // Show success feedback with animation
  NSString *originalTitle = [_btnCopyError titleForState:UIControlStateNormal];
  UIImage *originalImage = [_btnCopyError imageForState:UIControlStateNormal];

  // Update to success state
  UIImage *checkIcon = [UIImage systemImageNamed:@"checkmark.circle.fill"];
  [_btnCopyError setImage:checkIcon forState:UIControlStateNormal];
  [_btnCopyError setTitle:@"  Copied!" forState:UIControlStateNormal];
  _btnCopyError.tintColor = [UIColor colorWithRed:0.2 green:0.8 blue:0.4 alpha:1.0]; // Green success

  // Animate the background color change
  [UIView animateWithDuration:0.2 animations:^{
    self.btnCopyError.backgroundColor = [UIColor colorWithRed:0.2 green:0.8 blue:0.4 alpha:0.15];
    self.btnCopyError.layer.borderColor = [UIColor colorWithRed:0.2 green:0.8 blue:0.4 alpha:0.3].CGColor;
    self.btnCopyError.transform = CGAffineTransformMakeScale(1.05, 1.05);
  } completion:^(BOOL finished) {
    [UIView animateWithDuration:0.15 animations:^{
      self.btnCopyError.transform = CGAffineTransformIdentity;
    }];
  }];

  // Revert after 2 seconds
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(2.0 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
    [UIView animateWithDuration:0.3 animations:^{
      [self.btnCopyError setImage:originalImage forState:UIControlStateNormal];
      [self.btnCopyError setTitle:originalTitle forState:UIControlStateNormal];
      self.btnCopyError.tintColor = [UIColor colorWithRed:0.541 green:0.169 blue:0.886 alpha:1.0];
      self.btnCopyError.backgroundColor = [UIColor colorWithRed:0.541 green:0.169 blue:0.886 alpha:0.15];
      self.btnCopyError.layer.borderColor = [UIColor colorWithRed:0.541 green:0.169 blue:0.886 alpha:0.3].CGColor;
    }];
  });

  // Notify delegate if implemented
  if (_delegate && [_delegate respondsToSelector:@selector(errorViewDidCopyError:errorText:)]) {
    [_delegate errorViewDidCopyError:self errorText:errorText];
  }

  // Haptic feedback
  UIImpactFeedbackGenerator *generator = [[UIImpactFeedbackGenerator alloc] initWithStyle:UIImpactFeedbackStyleMedium];
  [generator impactOccurred];
}

@end

// "Perfection is achieved not when there is nothing more to add, but when there is nothing left to take away." - VibraCoder