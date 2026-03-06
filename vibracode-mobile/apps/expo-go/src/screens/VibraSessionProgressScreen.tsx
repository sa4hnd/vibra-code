import { useQuery } from 'convex/react';
import React, { useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';

import { api } from '../../convex/_generated/api';
import { Ionicons } from '../components/Icons';
import { VibraActionButtons } from '../components/vibra/VibraActionButtons';
import { VibraChatMessage } from '../components/vibra/VibraChatMessage';
import { VibraStatusDisplay } from '../components/vibra/VibraStatusDisplay';
import { useVibraAuth } from '../contexts/VibraAuthContext';
import { safeOpenProject } from '../utils/SafeProjectOpener';

interface VibraSessionProgressScreenProps {
  route: {
    params: {
      sessionId: string;
      prompt: string;
    };
  };
  navigation: any;
}

export const VibraSessionProgressScreen: React.FC<VibraSessionProgressScreenProps> = ({
  route,
  navigation,
}) => {
  const { sessionId, prompt } = route.params;
  const { user } = useVibraAuth();
  // SECURITY: Pass createdBy for ownership verification
  const session = useQuery(api.sessions.getById, user?.id ? { id: sessionId as any, createdBy: user.id } : 'skip');
  const messages = useQuery(api.messages.getBySession, { sessionId: sessionId as any });

  // Debug logging
  useEffect(() => {
    console.log('📱 Session Progress Debug:', {
      sessionId,
      sessionStatus: session?.status,
      messagesCount: messages?.length || 0,
      user: user?.id,
    });
  }, [session, messages, sessionId, user]);

  const handleBack = () => {
    navigation.goBack();
  };

  const handleOpenProject = async () => {
    if (!session?.tunnelUrl) {
      Alert.alert('Error', 'No tunnel URL available');
      return;
    }

    try {
      console.log('🚀 Opening project from progress screen:', session.tunnelUrl);
      await safeOpenProject(session.tunnelUrl, sessionId);
    } catch (error) {
      console.error('Error opening project:', error);
      Alert.alert('Error', 'Could not open project in Expo Go');
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <ChevronLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={styles.headerTitle}>Building your app</Text>
          <Text style={styles.headerSubtitle}>This might take a few moments</Text>
        </View>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Your Prompt */}
        <View style={styles.promptSection}>
          <Text style={styles.promptLabel}>Your Prompt:</Text>
          <Text style={styles.promptText}>"{prompt}"</Text>
        </View>

        {/* Chat Interface */}
        <View style={styles.chatSection}>
          <Text style={styles.chatTitle}>Building Your App</Text>

          {messages && messages.length > 0 ? (
            <View style={styles.messagesContainer}>
              {messages.map((message, index) => (
                <VibraChatMessage key={message._id || index} message={message} />
              ))}
            </View>
          ) : (
            <VibraStatusDisplay session={session || null} />
          )}
        </View>

        {/* Action Buttons */}
        <VibraActionButtons session={session || null} onOpenProject={handleOpenProject} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  backButton: {
    marginRight: 16,
  },
  titleContainer: {
    flex: 1,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    color: '#CCCCCC',
    fontSize: 16,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  promptSection: {
    marginBottom: 24,
  },
  promptLabel: {
    color: '#FF6B35',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  promptText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontStyle: 'italic',
    backgroundColor: '#1A1A1A',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333333',
  },
  chatSection: {
    flex: 1,
  },
  chatTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  messagesContainer: {
    flex: 1,
  },
});
