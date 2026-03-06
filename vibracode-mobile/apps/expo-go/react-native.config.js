module.exports = {
  dependencies: {
    // Exclude Stripe to avoid PassKit framework inclusion (App Store rejection)
    '@stripe/stripe-react-native': {
      platforms: {
        ios: null,
        android: null,
      },
    },
  },
};
