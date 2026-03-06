import { Tablet, Globe } from 'lucide-react-native';
import * as React from 'react';
import { Platform, View, StyleSheet } from 'react-native';

import { Ionicons } from './Icons'; // Keep for brand logos (logo-android, logo-apple)

type Props = {
  platform: 'native' | 'web';
};

const style = Platform.select({
  android: { marginTop: 3 },
  default: {},
});

export default function PlatformIcon(props: Props) {
  const { platform } = props;
  let icon: React.ReactNode = null;
  if (platform === 'native') {
    icon = Platform.select({
      android: <Ionicons name="logo-android" size={17} lightColor="#000" style={style} />,
      ios: <Ionicons name="logo-apple" size={17} lightColor="#000" style={style} />,
      default: <Tablet size={15} color="#000" style={style} />,
    });
  } else if (platform === 'web') {
    icon = <Globe size={15} color="#000" style={style} />;
  }

  return <View style={styles.container}>{icon}</View>;
}

const styles = StyleSheet.create({
  container: {
    width: 17,
  },
});
