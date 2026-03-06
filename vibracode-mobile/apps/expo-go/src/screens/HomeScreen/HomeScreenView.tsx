import { StackScreenProps } from '@react-navigation/stack';
import { View } from 'expo-dev-client-components';
import { isDevice } from 'expo-device';
import { LinearGradient } from 'expo-linear-gradient';
import * as React from 'react';
import {
  Alert,
  AppState,
  NativeEventSubscription,
  Platform,
  StyleSheet,
  TouchableOpacity,
  Text,
} from 'react-native';

import { APIV2Client } from '../../api/APIV2Client';
import ApolloClient from '../../api/ApolloClient';
import Connectivity from '../../api/Connectivity';
import ThemedStatusBar from '../../components/ThemedStatusBar';
import { VibraHeader, VibraProjectsList, VibraSearchBar } from '../../components/vibra';
import { VibraCosmicBackground } from '../../components/vibra/VibraCosmicBackground';
import { VibraOnboardingFlow } from '../../components/vibra/VibraOnboardingFlow';
import { VibraSortModal } from '../../components/vibra/VibraSortModal';
import { VibraColors } from '../../constants/VibraColors';
import {
  AppPlatform,
  HomeScreenDataDocument,
  HomeScreenDataQuery,
  HomeScreenDataQueryVariables,
} from '../../graphql/types';
import { HomeStackRoutes } from '../../navigation/Navigation.types';
import HistoryActions from '../../redux/HistoryActions';
import { DevSession, HistoryList } from '../../types';
import addListenerWithNativeCallback from '../../utils/addListenerWithNativeCallback';
import { shouldShowOnboarding, markOnboardingCompleted } from '../../utils/onboardingState';

const PROJECT_UPDATE_INTERVAL = 10000;

type Props = NavigationProps & {
  dispatch: (data: any) => any;
  isFocused: boolean;
  recentHistory: HistoryList;
  allHistory: HistoryList;
  isAuthenticated: boolean;
  theme: string;
  accountName?: string;
  initialData?: HomeScreenDataQuery;
};

type State = {
  projects: DevSession[];
  isNetworkAvailable: boolean;
  isRefreshing: boolean;
  data?: Exclude<HomeScreenDataQuery['account']['byName'], null>;
  searchQuery: string;
  sortBy: 'newest' | 'oldest' | 'name' | 'status';
  showOnboarding: boolean;
  showSortModal: boolean;
  isCheckingOnboarding: boolean;
};

type NavigationProps = StackScreenProps<HomeStackRoutes, 'Home'>;

export class HomeScreenView extends React.Component<Props, State> {
  private _projectPolling?: ReturnType<typeof setInterval>;
  private _changeEventListener?: NativeEventSubscription;

  state: State = {
    projects: [],
    isNetworkAvailable: Connectivity.isAvailable(),
    isRefreshing: false,
    data: this.props.initialData?.account.byName,
    searchQuery: '',
    sortBy: 'newest',
    showOnboarding: false,
    showSortModal: false,
    isCheckingOnboarding: true,
  };

  componentDidMount() {
    AppState.addEventListener('change', this._maybeResumePollingFromAppState);
    Connectivity.addListener(this._updateConnectivity);

    // @evanbacon: Without this setTimeout, the state doesn't update correctly and the "Recently in Development" items don't load for 10 seconds.
    setTimeout(() => {
      if (this.props.isAuthenticated) this._startPollingForProjects();
    }, 1);

    // Check if user should see onboarding
    this._checkOnboardingStatus();

    // NOTE(brentvatne): if we add QR code button to the menu again, we'll need to
    // find a way to move this listener up to the root of the app in order to ensure
    // that it has been registered regardless of whether we have been on the project
    // screen in the home app
    addListenerWithNativeCallback('ExponentKernel.showQRReader', async () => {
      // @ts-ignore
      this.props.navigation.navigate('QRCode');
      return { success: true };
    });
  }

  componentWillUnmount() {
    this._stopPollingForProjects();
    this._changeEventListener?.remove();
    Connectivity.removeListener(this._updateConnectivity);
  }

  render() {
    // If onboarding should be shown, render it as a fullscreen overlay
    // Using absolute positioning instead of Modal to avoid UIViewControllerHierarchyInconsistency
    // crashes that occur when Modal interacts with React Native Screens tab navigation
    if (this.state.showOnboarding || this.state.isCheckingOnboarding) {
      return (
        <View style={styles.fullscreenOverlay}>
          {this.state.showOnboarding ? (
            <VibraOnboardingFlow onComplete={this._handleOnboardingComplete} />
          ) : (
            <VibraCosmicBackground>
              <ThemedStatusBar />
            </VibraCosmicBackground>
          )}
        </View>
      );
    }

    return (
      <VibraCosmicBackground>
        {/* Main content */}
        <View style={styles.contentWrapper}>
          {/* Combined Header and Search Bar */}
          <View style={styles.headerContainer}>
            <VibraHeader />
            <VibraSearchBar
              onSearchChange={this._handleSearchChange}
              onSortPress={this._handleSortPress}
              sortText={this._getSortDisplayText()}
              searchValue={this.state.searchQuery || ''}
            />
          </View>

          {/* Vibra Home Content */}
          <VibraProjectsList
            searchQuery={this.state.searchQuery}
            sortBy={this.state.sortBy}
            onSearchChange={this._handleSearchChange}
            onSortPress={this._handleSortPress}
            getSortDisplayText={this._getSortDisplayText}
          />
        </View>

        {/* Sort Modal */}
        <VibraSortModal
          visible={this.state.showSortModal}
          onClose={this._handleCloseSortModal}
          currentSort={this.state.sortBy}
          onSortSelect={this._handleSortSelect}
        />

        <ThemedStatusBar />
      </VibraCosmicBackground>
    );
  }

  componentDidUpdate(prevProps: Props) {
    if (!prevProps.isFocused && this.props.isFocused) {
      this._fetchProjectsAsync();
    }

    if (!prevProps.isAuthenticated && this.props.isAuthenticated) {
      this._startPollingForProjects();
    }

    if (prevProps.isAuthenticated && !this.props.isAuthenticated) {
      // User signed out - show onboarding/login screen
      // Remove all projects except Snack, because they are tied to device id
      // Fix this lint warning when converting to hooks
      // eslint-disable-next-line
      this.setState(({ projects }) => ({
        projects: projects.filter((p) => p.source === 'snack'),
        data: undefined,
        isCheckingOnboarding: true,
      }));

      this._stopPollingForProjects();

      // Re-check onboarding status to show login screen
      this._checkOnboardingStatus();
    }
  }

  private _updateConnectivity = (isAvailable: boolean): void => {
    if (isAvailable !== this.state.isNetworkAvailable) {
      this.setState({ isNetworkAvailable: isAvailable });
    }
  };

  private _maybeResumePollingFromAppState = (nextAppState: string): void => {
    if (nextAppState === 'active' && !this._projectPolling) {
      this._startPollingForProjects();
    } else {
      this._stopPollingForProjects();
    }
  };

  private _handlePressClearHistory = () => {
    this.props.dispatch(HistoryActions.clearHistory());
  };

  private _startPollingForProjects = async () => {
    await this._fetchProjectsAsync();
    this._projectPolling = setInterval(this._fetchProjectsAsync, PROJECT_UPDATE_INTERVAL);
  };

  private _stopPollingForProjects = async () => {
    if (this._projectPolling) {
      clearInterval(this._projectPolling);
    }
    this._projectPolling = undefined;
  };

  private _fetchProjectsAsync = async () => {
    if (!this.props.isAuthenticated) return;

    const { accountName } = this.props;

    try {
      const api = new APIV2Client();

      const [projects, graphQLResponse] = await Promise.all([
        api.sendAuthenticatedApiV2Request<DevSession[]>('development-sessions', {
          method: 'GET',
        }),
        accountName
          ? ApolloClient.query<HomeScreenDataQuery, HomeScreenDataQueryVariables>({
              query: HomeScreenDataDocument,
              variables: {
                accountName,
                platform: Platform.OS === 'ios' ? AppPlatform.Ios : AppPlatform.Android,
              },
              fetchPolicy: 'network-only',
            })
          : new Promise<undefined>((resolve) => {
              resolve(undefined);
            }),
      ]);

      this.setState({ projects, data: graphQLResponse?.data.account.byName });
    } catch (e) {
      // this doesn't really matter, we will try again later
      if (__DEV__) {
        console.error(e);
      }
    }
  };

  private _handleRefreshAsync = async () => {
    this.setState({ isRefreshing: true });

    try {
      await Promise.all([
        this._fetchProjectsAsync(),
        new Promise((resolve) => setTimeout(resolve, 1000)),
      ]);
    } catch {
      // not sure what to do here, maybe nothing?
    } finally {
      this.setState({ isRefreshing: false });
    }
  };

  private _handleSearchChange = (text: string) => {
    this.setState({ searchQuery: text });
  };

  private _handleSortPress = () => {
    this.setState({ showSortModal: true });
  };

  private _handleSortSelect = (sortBy: 'newest' | 'oldest' | 'name' | 'status') => {
    this.setState({ sortBy, showSortModal: false });
  };

  private _handleCloseSortModal = () => {
    this.setState({ showSortModal: false });
  };

  private _getSortDisplayText = () => {
    switch (this.state.sortBy) {
      case 'newest':
        return 'Newest';
      case 'oldest':
        return 'Oldest';
      case 'name':
        return 'Name';
      case 'status':
        return 'Status';
      default:
        return 'Newest';
    }
  };

  private _checkOnboardingStatus = async () => {
    try {
      // If user is not authenticated, always show onboarding (which starts with login screen)
      if (!this.props.isAuthenticated) {
        console.log('🚀 User not authenticated, showing onboarding/login screen');
        this.setState({ showOnboarding: true, isCheckingOnboarding: false });
        return;
      }

      // User is authenticated, check if they need to see the rest of onboarding
      const shouldShow = await shouldShowOnboarding();
      console.log('🚀 Onboarding check result:', { shouldShow, isAuthenticated: this.props.isAuthenticated });

      if (shouldShow) {
        console.log('🚀 Showing onboarding for new user');
        // Show onboarding immediately, then mark as done checking
        this.setState({ showOnboarding: true, isCheckingOnboarding: false });
      } else {
        // No onboarding needed, show home content
        this.setState({ isCheckingOnboarding: false });
      }
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      // On error, show home content (don't block user)
      this.setState({ isCheckingOnboarding: false });
    }
  };

  private _handleOnboardingComplete = async () => {
    try {
      await markOnboardingCompleted();
      console.log('✅ Onboarding completed and marked');

      // Simple state update - no Modal dismissal timing issues
      // since we're using a fullscreen overlay instead of Modal
      this.setState({ showOnboarding: false });
    } catch (error) {
      console.error('Error completing onboarding:', error);
      this.setState({ showOnboarding: false });
    }
  };

  private _handlePressHelpProjects = () => {
    if (!this.state.isNetworkAvailable) {
      Alert.alert(
        'No network connection available',
        `You must be connected to the internet to view a list of your projects open in development.`
      );
    }

    const baseMessage = `Make sure you are signed in to the same Expo account on your computer and this app. Also verify that your computer is connected to the internet, and ideally to the same Wi-Fi network as your mobile device. Lastly, ensure that you are using the latest version of Expo CLI. Pull to refresh to update.`;
    const message = Platform.select({
      ios: isDevice
        ? baseMessage
        : `${baseMessage} If this still doesn't work, press the + icon on the header to type the project URL manually.`,
      android: baseMessage,
    });
    Alert.alert('Troubleshooting', message);
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fullscreenOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    flex: 1,
  },
  contentWrapper: {
    flex: 1,
    position: 'relative',
    zIndex: 1,
  },
  headerContainer: {
    backgroundColor: VibraColors.neutral.backgroundSecondary,
    borderTopWidth: 1,
    borderTopColor: VibraColors.neutral.border,
    borderBottomWidth: 1,
    borderBottomColor: VibraColors.neutral.border,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    position: 'relative',
    elevation: 4,
  },
  projectImageStyle: {
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
  },
});
