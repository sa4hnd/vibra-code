import * as ImagePicker from 'expo-image-picker';
import { useState, useCallback } from 'react';
import { Alert, Linking } from 'react-native';

export interface ImageAttachment {
  /** Unique identifier for this attachment */
  id: string;
  /** Local file URI */
  uri: string;
  /** Original file name */
  fileName: string;
  /** MIME type (e.g., 'image/jpeg') */
  type: string;
  /** Image width in pixels */
  width: number;
  /** Image height in pixels */
  height: number;
}

interface UseImagePickerReturn {
  /** Currently selected images */
  images: ImageAttachment[];
  /** Open image picker to select images */
  pickImages: () => Promise<void>;
  /** Remove a specific image by ID */
  removeImage: (id: string) => void;
  /** Clear all selected images */
  clearImages: () => void;
  /** Whether image picking is in progress */
  isPicking: boolean;
}

/**
 * Hook for picking and managing image attachments.
 * @param maxImages Maximum number of images allowed (default: 5)
 */
export function useImagePicker(maxImages: number = 5): UseImagePickerReturn {
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [isPicking, setIsPicking] = useState(false);

  const pickImages = useCallback(async () => {
    if (images.length >= maxImages) {
      Alert.alert('Limit Reached', `You can attach up to ${maxImages} images.`, [{ text: 'OK' }]);
      return;
    }

    if (isPicking) {
      return;
    }

    try {
      setIsPicking(true);

      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please enable photo library access in Settings to attach images.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => Linking.openSettings(),
            },
          ]
        );
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: maxImages - images.length,
        quality: 0.8,
        exif: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newImages: ImageAttachment[] = result.assets.map((asset) => ({
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          uri: asset.uri,
          fileName: asset.fileName || `image_${Date.now()}.jpg`,
          type: asset.mimeType || 'image/jpeg',
          width: asset.width,
          height: asset.height,
        }));

        setImages((prev) => {
          const combined = [...prev, ...newImages];
          // Ensure we don't exceed max images
          return combined.slice(0, maxImages);
        });
      }
    } catch (error: any) {
      console.error('Error picking images:', error);
      Alert.alert('Error', 'Failed to pick images. Please try again.', [{ text: 'OK' }]);
    } finally {
      setIsPicking(false);
    }
  }, [images.length, maxImages, isPicking]);

  const removeImage = useCallback((id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  }, []);

  const clearImages = useCallback(() => {
    setImages([]);
  }, []);

  return {
    images,
    pickImages,
    removeImage,
    clearImages,
    isPicking,
  };
}

export default useImagePicker;
