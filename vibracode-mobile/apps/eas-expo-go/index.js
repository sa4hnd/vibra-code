import { registerRootComponent } from 'expo';

// Import the actual Expo Go app with all your changes from the main directory
import App from '../expo-go/App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in the Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
