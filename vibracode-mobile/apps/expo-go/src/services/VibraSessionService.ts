import { useUser } from '@clerk/clerk-expo';
import { useMutation, useQuery } from 'convex/react';

import { api } from '../../convex/_generated/api';
import { ENV } from '../config/env';
import { useUsage } from '../hooks/useUsage';

export interface ImageUpload {
  fileName: string;
  uri: string;
  storageId?: string;
}

export interface CreateSessionParams {
  message: string;
  template?: string;
  repository?: string;
  images?: ImageUpload[];
}

export interface SessionProgress {
  sessionId: string;
  status:
    | 'IN_PROGRESS'
    | 'CLONING_REPO'
    | 'INSTALLING_DEPENDENCIES'
    | 'STARTING_DEV_SERVER'
    | 'CREATING_TUNNEL'
    | 'RUNNING'
    | 'ERROR';
  statusMessage?: string;
  name?: string;
  tunnelUrl?: string;
  repository?: string;
}

// Hook for creating sessions - exactly like v0-clone
export const useCreateSession = () => {
  const createSession = useMutation(api.sessions.create);
  const addMessage = useMutation(api.messages.add);
  const generateUploadUrl = useMutation(api.messages.generateUploadUrl);
  const { user } = useUser();
  const { canSendMessage, sendMessage } = useUsage();

  // Upload a single image to Convex storage
  const uploadImage = async (imageUri: string, fileName: string): Promise<string> => {
    // Get upload URL from Convex
    const uploadUrl = await generateUploadUrl();

    // Fetch the image data
    const response = await fetch(imageUri);
    const blob = await response.blob();

    // Upload to Convex storage
    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': blob.type || 'image/jpeg',
      },
      body: blob,
    });

    const { storageId } = await uploadResponse.json();
    return storageId;
  };

  // Upload multiple images
  const uploadImages = async (
    images: ImageUpload[]
  ): Promise<{ fileName: string; path: string; storageId: string }[]> => {
    const uploadedImages = await Promise.all(
      images.map(async (image) => {
        const storageId = await uploadImage(image.uri, image.fileName);
        return {
          fileName: image.fileName,
          path: image.uri,
          storageId,
        };
      })
    );
    return uploadedImages;
  };

  return {
    createSession: async (params: CreateSessionParams) => {
      try {
        if (!user?.id) {
          throw new Error('User must be authenticated to create a session');
        }

        // Check if user has tokens before proceeding
        if (!canSendMessage) {
          throw new Error('No tokens remaining. Please upgrade to Pro or wait for monthly reset.');
        }

        // Consume a token before creating the session
        await sendMessage();

        // Step 1: Create session in Convex database (same as v0-clone)
        console.log('🚀 Creating session with user ID:', user.id);
        const sessionId = await createSession({
          name: 'Untitled session',
          status: 'IN_PROGRESS',
          templateId: params.template || 'expo',
          createdBy: user.id, // Add the user ID so it shows up in the project list
        });
        console.log('✅ Session created with ID:', sessionId);

        // Step 1.5: Upload images if provided
        let uploadedImages: { fileName: string; path: string; storageId: string }[] = [];
        if (params.images && params.images.length > 0) {
          console.log('📷 Uploading', params.images.length, 'images...');
          uploadedImages = await uploadImages(params.images);
          console.log('✅ Images uploaded:', uploadedImages.length);
        }

        // Build message content - append image references like native bottom bar does
        let messageContent = params.message;
        if (uploadedImages.length > 0) {
          // Append image info to message text so AI knows about the images
          // Format: [Image: fileName at storageId]
          for (const img of uploadedImages) {
            messageContent += `\n\n[Image: ${img.fileName} at ${img.storageId}]`;
          }
        }

        // Step 1.6: Add user message to the session (like v0-clone does)
        // Include image if one was uploaded
        const messagePayload: any = {
          sessionId: sessionId as any,
          role: 'user',
          content: messageContent,
        };

        if (uploadedImages.length > 0) {
          // Attach the first image to the message (Convex schema supports one image per message)
          messagePayload.image = uploadedImages[0];
        }

        await addMessage(messagePayload);
        console.log('✅ User message added to session');

        // Step 2: Check if v0-clone backend is running
        const isBackendHealthy = await checkV0BackendHealth();
        if (!isBackendHealthy) {
          console.warn(
            '⚠️ v0-clone backend is not running. Session created in Convex but action will not be triggered.'
          );
          // Still return the session ID so user can see it in the list
          return sessionId;
        }

        // Step 3: Trigger the create session action (same as v0-clone)
        await triggerCreateSessionAction({
          sessionId,
          message: messageContent,
          templateId: params.template || 'expo',
          repository: params.repository,
          userId: user.id,
          images: uploadedImages,
        });

        console.log('Session created and action triggered:', sessionId);
        return sessionId;
      } catch (error) {
        console.error('Error creating session:', error);
        throw error;
      }
    },
    uploadImages, // Export for external use if needed
  };
};

// Hook for getting session by ID
// SECURITY: Requires createdBy for ownership verification
export const useSession = (sessionId: string, createdBy?: string) => {
  return useQuery(api.sessions.getById, createdBy ? { id: sessionId, createdBy } : 'skip');
};

// Hook for getting all user sessions
export const useUserSessions = () => {
  return useQuery(api.sessions.list, {});
};

/**
 * Trigger the create session action in v0-clone backend
 * This calls the same API that the web version uses
 */
async function triggerCreateSessionAction(params: {
  sessionId: string;
  message: string;
  templateId: string;
  repository?: string;
  userId: string;
  images?: { fileName: string; path: string; storageId: string }[];
}): Promise<void> {
  try {
    // Ensure we have a valid API URL (remove trailing slash to avoid double slashes)
    const apiUrl = ENV.V0_API_URL.replace(/\/$/, '');
    console.log('🚀 Calling v0-clone API:', `${apiUrl}/api/create-session`);
    console.log('📦 Request payload:', {
      sessionId: params.sessionId,
      message: params.message,
      templateId: params.templateId,
      repository: params.repository,
      userId: params.userId,
    });

    // Call v0-clone's create session API endpoint
    const response = await fetch(`${apiUrl}/api/create-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: params.sessionId,
        message: params.message,
        templateId: params.templateId,
        repository: params.repository,
        userId: params.userId,
        images: params.images,
      }),
    });

    console.log('📡 API Response status:', response.status);
    console.log('📡 API Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', response.status, errorText);
      console.error('❌ Full response:', response);
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }

    const responseData = await response.json();
    console.log('✅ Create session action triggered successfully:', responseData);

    // Additional logging to help debug
    console.log('🔍 Session creation details:', {
      sessionId: params.sessionId,
      message: params.message,
      templateId: params.templateId,
      userId: params.userId,
      apiUrl,
    });
  } catch (error) {
    console.error('❌ Error triggering create session action:', error);
    console.error('❌ Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    // Don't throw here - let the session be created in Convex even if the action fails
    // The user can still see the session, and we can retry the action later
  }
}

/**
 * Check if v0-clone backend is running
 */
export async function checkV0BackendHealth(): Promise<boolean> {
  try {
    const apiUrl = ENV.V0_API_URL.replace(/\/$/, '');
    console.log('🔍 Checking v0-clone backend health...', apiUrl);
    const response = await fetch(`${apiUrl}/api/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ v0-clone backend is healthy:', data);
      return true;
    } else {
      console.error('❌ v0-clone backend health check failed:', response.status);
      return false;
    }
  } catch (error) {
    console.error('❌ v0-clone backend is not reachable:', error);
    return false;
  }
}

/**
 * Convert tunnel URL to Expo URL
 * @deprecated Use safeOpenProject from SafeProjectOpener instead
 */
export function convertToExpoUrl(tunnelUrl: string): string {
  if (!tunnelUrl) return 'exp://localhost:8081';
  if (tunnelUrl.startsWith('https://')) {
    return tunnelUrl.replace('https://', 'exp://');
  }
  return tunnelUrl;
}
