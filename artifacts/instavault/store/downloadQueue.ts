import { create } from 'zustand';
import * as FileSystem from 'expo-file-system';
import { DownloadRecord, insertDownload, updateDownloadStatus } from '../services/database';
import { saveToGallery } from '../services/gallery';
import { sendDownloadCompleteNotification, sendDownloadFailedNotification } from '../services/notifications';
import { Platform } from 'react-native';

interface QueueItem {
  id: string;
  record: Partial<DownloadRecord>;
  retryCount: number;
  startedAt: number;
  downloadResumable?: FileSystem.DownloadResumable;
}

interface DownloadQueueState {
  queue: Record<string, QueueItem>;
  addDownload: (downloadUrl: string, record: Partial<DownloadRecord>) => Promise<void>;
  cancelDownload: (id: string) => Promise<void>;
  removeDownload: (id: string) => void;
}

export const useDownloadQueue = create<DownloadQueueState>((set, get) => ({
  queue: {},
  addDownload: async (downloadUrl: string, record: Partial<DownloadRecord>) => {
    const id = record.id!;
    const fileName = record.fileName!;
    
    // Create initial DB entry
    const fullRecord: DownloadRecord = {
      ...record,
      status: 'downloading',
      progress: 0,
      errorMessage: null,
      savedToGallery: false,
    } as DownloadRecord;
    
    if (Platform.OS !== 'web') {
      insertDownload(fullRecord);
    }
    
    const fileUri = `${FileSystem.documentDirectory}${fileName}`;
    
    const downloadResumable = FileSystem.createDownloadResumable(
      downloadUrl,
      fileUri,
      {},
      (downloadProgress) => {
        const progress = (downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite) * 100;
        set((state) => ({
          queue: {
            ...state.queue,
            [id]: {
              ...state.queue[id],
              record: {
                ...state.queue[id].record,
                progress,
              }
            }
          }
        }));
      }
    );

    set((state) => ({
      queue: {
        ...state.queue,
        [id]: {
          id,
          record: { ...fullRecord, filePath: fileUri },
          retryCount: 0,
          startedAt: Date.now(),
          downloadResumable
        }
      }
    }));

    try {
      const result = await downloadResumable.downloadAsync();
      
      if (result) {
        // Download complete
        const saved = await saveToGallery(result.uri);
        if (Platform.OS !== 'web') {
          updateDownloadStatus(id, 'completed', { filePath: result.uri, savedToGallery: saved });
        }
        
        sendDownloadCompleteNotification(
          'Download Complete',
          `${record.authorDisplayName}'s ${record.mediaType} has been downloaded.`,
          { id }
        );
        
        set((state) => {
          const newQueue = { ...state.queue };
          delete newQueue[id];
          return { queue: newQueue };
        });
      }
    } catch (e: any) {
      if (Platform.OS !== 'web') {
        updateDownloadStatus(id, 'failed', { errorMessage: e.message });
      }
      sendDownloadFailedNotification(
        'Download Failed',
        `Failed to download ${record.mediaType} from ${record.authorDisplayName}.`,
        { id }
      );
      
      set((state) => {
        const newQueue = { ...state.queue };
        delete newQueue[id];
        return { queue: newQueue };
      });
    }
  },
  cancelDownload: async (id: string) => {
    const item = get().queue[id];
    if (item?.downloadResumable) {
      await item.downloadResumable.cancelAsync();
      if (Platform.OS !== 'web') {
        updateDownloadStatus(id, 'cancelled');
      }
      set((state) => {
        const newQueue = { ...state.queue };
        delete newQueue[id];
        return { queue: newQueue };
      });
    }
  },
  removeDownload: (id: string) => {
    set((state) => {
      const newQueue = { ...state.queue };
      delete newQueue[id];
      return { queue: newQueue };
    });
  }
}));
