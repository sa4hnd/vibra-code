import { CheckCircle, ExternalLink } from 'lucide-react-native';
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Alert } from 'react-native';

interface Session {
  status: string;
  tunnelUrl?: string;
}

interface VibraActionButtonsProps {
  session: Session | null | undefined;
  onOpenProject: () => void;
}

export const VibraActionButtons: React.FC<VibraActionButtonsProps> = ({ session, onOpenProject }) => {
  if (session?.status !== 'RUNNING' || !session.tunnelUrl) {
    return null;
  }

  return (
    <View style={styles.actionSection}>
      <View style={styles.successMessage}>
        <View style={styles.successIcon}>
          <CheckCircle size={24} color="#4CAF50" />
        </View>
        <View style={styles.successContent}>
          <Text style={styles.successTitle}>Your app is ready!</Text>
          <Text style={styles.successSubtitle}>Tap the button below to open it in Expo Go</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.openButton} onPress={onOpenProject} activeOpacity={0.8}>
        <ExternalLink size={20} color="#FFFFFF" />
        <Text style={styles.openButtonText}>Open in Expo Go</Text>
      </TouchableOpacity>

      {__DEV__ && (
        <View style={styles.debugSection}>
          <Text style={styles.debugTitle}>Debug Info:</Text>
          <Text style={styles.debugText}>Status: {session.status}</Text>
          <Text style={styles.debugText}>Tunnel: {session.tunnelUrl}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  actionSection: {
    paddingTop: 16,
  },
  successMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#444444',
  },
  successIcon: {
    marginRight: 16,
  },
  successContent: {
    flex: 1,
  },
  successTitle: {
    color: '#4CAF50',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  successSubtitle: {
    color: '#CCCCCC',
    fontSize: 14,
    lineHeight: 20,
  },
  openButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B35',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  openButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  debugSection: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#444444',
  },
  debugTitle: {
    color: '#FF6B35',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  debugText: {
    color: '#CCCCCC',
    fontSize: 10,
    marginBottom: 2,
  },
});
