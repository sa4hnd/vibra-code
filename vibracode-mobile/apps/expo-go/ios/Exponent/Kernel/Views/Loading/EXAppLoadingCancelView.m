#import "EXAppLoadingCancelView.h"

const NSTimeInterval kEXTimeUntilCancelAppears = 5.0f;

@interface EXAppLoadingCancelView ()

@property (nonatomic, assign) id<EXAppLoadingCancelViewDelegate> delegate;

@property (nonatomic, strong) UIActivityIndicatorView *loadingIndicator;
@property (nonatomic, strong) UILabel *lblStatus;
@property (nonatomic, strong) UILabel *lblAdvice;
@property (nonatomic, strong) UIButton *btnCancel;
@property (nonatomic, strong) NSTimer *tmrShowCancel;
@property (nonatomic, strong) CAGradientLayer *vibeGradientLayer;
@property (nonatomic, strong) CALayer *glassOverlay;

@end

@implementation EXAppLoadingCancelView

- (instancetype)init
{
  if (self = [super init]) {
    [self _setUpViews];
  }
  return self;
}

- (void)dealloc
{
  [self _invalidateTimer];
}

- (void)setDelegate:(id<EXAppLoadingCancelViewDelegate>)delegate
{
  _delegate = delegate;
  if (_delegate) {
    _btnCancel.hidden = NO;
  }
}

- (void)setFrame:(CGRect)frame
{
  [super setFrame:frame];
  
  // Update gradient layers to match new frame
  if (_vibeGradientLayer) {
    _vibeGradientLayer.frame = self.bounds;
  }
  if (_glassOverlay) {
    _glassOverlay.frame = self.bounds;
  }
  
  CGFloat startingY = CGRectGetMidY(frame) - 54.0f;
  
  _lblStatus.frame = CGRectMake(0, 0, self.bounds.size.width - 32.0f, 24.0f);
  [_lblStatus sizeToFit];
  CGFloat statusWidth = _lblStatus.frame.size.width + _loadingIndicator.frame.size.width + 8.0f;
  
  _loadingIndicator.center = CGPointMake(CGRectGetMidX(self.bounds) - (statusWidth * 0.5f) + _loadingIndicator.frame.size.width * 0.5f,
                                         startingY);
  _lblStatus.center = CGPointMake(CGRectGetMaxX(_loadingIndicator.frame) + 8.0f + CGRectGetMidX(_lblStatus.frame),
                                  _loadingIndicator.center.y);

  _btnCancel.frame = CGRectMake(0, 0, 84.0f, 36.0f);
  _btnCancel.center = CGPointMake(CGRectGetMidX(self.bounds), CGRectGetMaxY(_lblStatus.frame) + 48.0f);

  _lblAdvice.frame = CGRectMake(_lblStatus.frame.origin.x, 0, MIN(self.frame.size.width - 32.0f, 300.0f), CGFLOAT_MAX);
  [_lblAdvice sizeToFit];
  _lblAdvice.center = CGPointMake(CGRectGetMidX(self.bounds), CGRectGetMaxY(_btnCancel.frame) + CGRectGetMidY(_lblAdvice.frame) + 24.0f);
}

- (void)layoutSubviews
{
  [super layoutSubviews];
  
  // Ensure gradient layers match current bounds
  if (_vibeGradientLayer) {
    _vibeGradientLayer.frame = self.bounds;
  }
  if (_glassOverlay) {
    _glassOverlay.frame = self.bounds;
  }
}

- (void)_setUpViews
{
  // Vibra Design: Match HomeScreenView gradient background
  self.backgroundColor = [UIColor clearColor];
  
  // Add Vibra gradient background
  _vibeGradientLayer = [CAGradientLayer layer];
  _vibeGradientLayer.colors = @[
    (id)[UIColor colorWithRed:0.039 green:0.039 blue:0.059 alpha:1.0].CGColor, // #0A0A0F
    (id)[UIColor colorWithRed:0.102 green:0.102 blue:0.125 alpha:1.0].CGColor, // #1A1A20
    (id)[UIColor colorWithRed:0.165 green:0.165 blue:0.208 alpha:1.0].CGColor, // #2A2A35
    (id)[UIColor colorWithRed:0.102 green:0.102 blue:0.125 alpha:1.0].CGColor, // #1A1A20
    (id)[UIColor colorWithRed:0.039 green:0.039 blue:0.059 alpha:1.0].CGColor  // #0A0A0F
  ];
  _vibeGradientLayer.startPoint = CGPointMake(0, 0);
  _vibeGradientLayer.endPoint = CGPointMake(1, 1);
  _vibeGradientLayer.locations = @[@0.0, @0.2, @0.5, @0.8, @1.0];
  [self.layer insertSublayer:_vibeGradientLayer atIndex:0];
  
  // Add glass morphism overlay
  _glassOverlay = [CALayer layer];
  _glassOverlay.backgroundColor = [UIColor colorWithRed:1.0 green:1.0 blue:1.0 alpha:0.02].CGColor; // White tint
  [self.layer insertSublayer:_glassOverlay atIndex:1];
  
  // Vibra Design: Loading indicator with neutral color
  _loadingIndicator = [[UIActivityIndicatorView alloc] initWithActivityIndicatorStyle:UIActivityIndicatorViewStyleLarge];
  [_loadingIndicator setColor:[UIColor colorWithRed:0.961 green:0.961 blue:0.969 alpha:1.0]]; // #F5F5F7 (Vibra white)
  [self addSubview:_loadingIndicator];
  [_loadingIndicator startAnimating];
  
  _lblStatus = [[UILabel alloc] init];
  _lblStatus.text = @"Opening project...";
  _lblStatus.font = [UIFont systemFontOfSize:18.0f weight:UIFontWeightBold]; // Vibra typography
  _lblStatus.textColor = [UIColor colorWithRed:0.961 green:0.961 blue:0.969 alpha:1.0]; // #F5F5F7 (Vibra text)
  _lblStatus.textAlignment = NSTextAlignmentCenter;
  // Add Vibra text shadow
  _lblStatus.layer.shadowColor = [UIColor colorWithRed:0.0 green:0.0 blue:0.0 alpha:0.5].CGColor;
  _lblStatus.layer.shadowOffset = CGSizeMake(0, 1);
  _lblStatus.layer.shadowRadius = 2;
  _lblStatus.layer.shadowOpacity = 0.6;
  [self addSubview:_lblStatus];
  
  _lblAdvice = [[UILabel alloc] init];
  _lblAdvice.text = @"This is taking longer than usual. Please check your network connection and try again.";
  _lblAdvice.numberOfLines = 0;
  _lblAdvice.font = [UIFont systemFontOfSize:16.0f weight:UIFontWeightMedium]; // Vibra typography
  _lblAdvice.textColor = [UIColor colorWithRed:0.780 green:0.780 blue:0.800 alpha:1.0]; // #C7C7CC (Vibra secondary text)
  _lblAdvice.textAlignment = NSTextAlignmentCenter;
  [self addSubview:_lblAdvice];
  
  // Vibra Design: Button with purple-blue gradient matching brand
  _btnCancel = [UIButton buttonWithType:UIButtonTypeSystem];
  [_btnCancel setTitle:@"Go back" forState:UIControlStateNormal];
  _btnCancel.titleLabel.font = [UIFont systemFontOfSize:17.0f weight:UIFontWeightBold]; // Vibra typography
  [_btnCancel setTitleColor:[UIColor blackColor] forState:UIControlStateNormal];
  _btnCancel.backgroundColor = [UIColor clearColor];
  _btnCancel.layer.cornerRadius = 16.0f; // Vibra border radius
  
  // Vibra gradient matching cosmic design
  CAGradientLayer *vibeGradient = [CAGradientLayer layer];
  vibeGradient.colors = @[
    (id)[UIColor colorWithRed:0.961 green:0.961 blue:0.969 alpha:1.0].CGColor, // #F5F5F7 (white)
    (id)[UIColor colorWithRed:0.8 green:0.8 blue:0.8 alpha:1.0].CGColor        // #CCCCCC (light gray)
  ];
  vibeGradient.startPoint = CGPointMake(0, 0);
  vibeGradient.endPoint = CGPointMake(1, 0);
  vibeGradient.cornerRadius = 16.0f;
  
  // Vibra shadow effect matching cosmic design
  _btnCancel.layer.shadowColor = [UIColor colorWithRed:0.0 green:0.0 blue:0.0 alpha:0.3].CGColor;
  _btnCancel.layer.shadowOffset = CGSizeMake(0, 8);
  _btnCancel.layer.shadowOpacity = 0.4;
  _btnCancel.layer.shadowRadius = 16;
  
  // Add glass border
  _btnCancel.layer.borderWidth = 1.5;
  _btnCancel.layer.borderColor = [UIColor colorWithWhite:1.0 alpha:0.2].CGColor;
  _btnCancel.layer.masksToBounds = NO;
  
  // Store reference to button gradient for frame updates
  vibeGradient.frame = CGRectMake(0, 0, 84, 36); // Button size
  [_btnCancel.layer insertSublayer:vibeGradient atIndex:0];
  
  // Store gradient reference for later frame updates
  _btnCancel.layer.name = @"vibeGradientButton";
  
  [_btnCancel addTarget:self action:@selector(_onTapCancel) forControlEvents:UIControlEventTouchUpInside];
  [self addSubview:_btnCancel];
  
  _btnCancel.hidden = YES;
  _lblAdvice.hidden = YES;
  _tmrShowCancel = [NSTimer scheduledTimerWithTimeInterval:kEXTimeUntilCancelAppears
                                                    target:self
                                                  selector:@selector(_onCancelTimerFinished)
                                                  userInfo:nil repeats:NO];
  
  [self setNeedsLayout];
}

- (void)_onTapCancel
{
  if (_delegate) {
    [_delegate appLoadingCancelViewDidCancel:self];
  }
}

#pragma mark - cancel timer

- (void)_invalidateTimer
{
  if (_tmrShowCancel) {
    [_tmrShowCancel invalidate];
    _tmrShowCancel = nil;
  }
}

- (void)_onCancelTimerFinished
{
  [self _invalidateTimer];
  _lblAdvice.hidden = NO;
}

@end
