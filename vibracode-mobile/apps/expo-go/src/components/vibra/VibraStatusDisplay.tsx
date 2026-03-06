import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

interface Session {
  status: string;
  statusMessage?: string;
}

interface VibraStatusDisplayProps {
  session: Session | null | undefined;
}

export const VibraStatusDisplay: React.FC<VibraStatusDisplayProps> = ({ session }) => {
  if (!session) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const getStatusText = () => {
    switch (session.status) {
      case 'IN_PROGRESS':
        return 'Initializing...';
      case 'CLONING_REPO':
        return 'Cloning repository...';
      case 'INSTALLING_DEPENDENCIES':
        return 'Installing dependencies...';
      case 'STARTING_DEV_SERVER':
        return 'Starting development server...';
      case 'CREATING_TUNNEL':
        return 'Creating tunnel...';
      case 'RUNNING':
        return 'Ready!';
      default:
        return 'Processing...';
    }
  };

  return (
    <View style={styles.statusContainer}>
      <View style={styles.statusIconContainer}>
        <ActivityIndicator size="small" color="#FF6B35" />
      </View>
      <View style={styles.statusTextContainer}>
        <Text style={styles.statusText}>{getStatusText()}</Text>
        {session.statusMessage && <Text style={styles.statusSubtext}>{session.statusMessage}</Text>}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    padding: 24,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#333333',
  },
  statusIconContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  statusTextContainer: {
    flex: 1,
  },
  statusText: {
    color: '#FF6B35',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statusSubtext: {
    color: '#CCCCCC',
    fontSize: 14,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    color: '#CCCCCC',
    fontSize: 16,
    marginTop: 16,
  },
});
