import { Platform } from 'react-native';

export async function requestGalleryPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const MediaLibrary = require('expo-media-library') as typeof import('expo-media-library');
  const { status } = await MediaLibrary.requestPermissionsAsync();
  return status === 'granted';
}

export async function saveToGallery(filePath: string): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const MediaLibrary = require('expo-media-library') as typeof import('expo-media-library');
    const asset = await MediaLibrary.createAssetAsync(filePath);
    const album = await MediaLibrary.getAlbumAsync('InstaVault');

    if (album == null) {
      await MediaLibrary.createAlbumAsync('InstaVault', asset, false);
    } else {
      await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
    }

    return true;
  } catch (error) {
    console.error('Failed to save to gallery:', error);
    return false;
  }
}
