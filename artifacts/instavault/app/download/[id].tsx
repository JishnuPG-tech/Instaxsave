import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useColors } from '@/hooks/useColors';
import { getDownloadById, DownloadRecord, deleteDownload } from '@/services/database';
import { useDownloadQueue } from '@/store/downloadQueue';
import { saveToGallery } from '@/services/gallery';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export default function DownloadDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  
  const [record, setRecord] = useState<DownloadRecord | null>(null);
  const { queue, cancelDownload } = useDownloadQueue();
  
  // Track queue item if it's currently downloading
  const queueItem = queue[id];
  const isDownloading = queueItem !== undefined;
  
  useEffect(() => {
    if (Platform.OS !== 'web') {
      const rec = getDownloadById(id);
      if (rec) setRecord(rec);
    }
  }, [id, queueItem]); // Re-fetch when queueItem changes (download finishes)

  if (!record) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color={colors.foreground} />
          </TouchableOpacity>
        </View>
        <View style={styles.emptyState}>
          <Text style={{ color: colors.foreground }}>Download not found</Text>
        </View>
      </View>
    );
  }

  const handleCancel = () => {
    cancelDownload(id);
  };
  
  const handleDelete = () => {
    deleteDownload(id);
    router.back();
  };
  
  const handleSaveToGallery = async () => {
    if (record.status === 'completed' && !record.savedToGallery) {
      await saveToGallery(record.filePath);
      setRecord({ ...record, savedToGallery: true });
    }
  };

  const handleShare = async () => {
    if (record.status === 'completed') {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(record.filePath);
      }
    }
  };

  const progress = isDownloading ? (queueItem.record.progress || 0) : record.progress;
  const status = isDownloading ? 'downloading' : record.status;
  
  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.mediaPreview}>
          <Image 
            source={{ uri: record.thumbnailUrl }} 
            style={[styles.thumbnail, { backgroundColor: colors.muted }]} 
            contentFit="cover"
          />
          <View style={styles.typeOverlay}>
            <Feather 
              name={record.mediaType === 'video' || record.mediaType === 'reel' ? 'video' : 'image'} 
              size={16} 
              color="#fff" 
            />
          </View>
        </View>

        <View style={styles.infoSection}>
          <Text style={[styles.author, { color: colors.foreground }]}>{record.authorDisplayName}</Text>
          {record.caption && (
            <Text style={[styles.caption, { color: colors.mutedForeground }]}>{record.caption}</Text>
          )}
        </View>

        <View style={[styles.statusCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.statusRow}>
            <Text style={[styles.statusLabel, { color: colors.mutedForeground }]}>Status</Text>
            <View style={styles.statusBadge}>
              <View style={[styles.statusDot, { 
                backgroundColor: status === 'completed' ? '#10b981' : 
                                 status === 'failed' ? colors.destructive : 
                                 status === 'downloading' ? colors.primary : colors.mutedForeground
              }]} />
              <Text style={[styles.statusText, { color: colors.foreground }]}>
                {status === 'downloading' ? `Downloading ${Math.round(progress)}%` : 
                 status.charAt(0).toUpperCase() + status.slice(1)}
              </Text>
            </View>
          </View>

          {isDownloading && (
            <View style={[styles.progressBar, { backgroundColor: colors.muted }]}>
              <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${progress}%` }]} />
            </View>
          )}
          
          {record.errorMessage && (
            <Text style={[styles.errorText, { color: colors.destructive }]}>{record.errorMessage}</Text>
          )}
        </View>

        <View style={[styles.detailsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>File Information</Text>
          
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>Quality</Text>
            <Text style={[styles.detailValue, { color: colors.foreground }]}>{record.quality}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>Size</Text>
            <Text style={[styles.detailValue, { color: colors.foreground }]}>
              {record.fileSize ? `${(record.fileSize / 1024 / 1024).toFixed(2)} MB` : 'Unknown'}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>Format</Text>
            <Text style={[styles.detailValue, { color: colors.foreground }]}>{record.mimeType}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>Date</Text>
            <Text style={[styles.detailValue, { color: colors.foreground }]}>
              {new Date(record.downloadedAt).toLocaleString()}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>Gallery</Text>
            <Text style={[styles.detailValue, { color: colors.foreground }]}>
              {record.savedToGallery ? 'Saved' : 'Not saved'}
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          {isDownloading ? (
            <TouchableOpacity 
              style={[styles.actionButton, styles.primaryAction, { backgroundColor: colors.destructive }]}
              onPress={handleCancel}
            >
              <Feather name="x-circle" size={20} color="#fff" />
              <Text style={styles.primaryActionText}>Cancel Download</Text>
            </TouchableOpacity>
          ) : (
            <>
              {status === 'completed' && (
                <View style={styles.completedActions}>
                  <TouchableOpacity 
                    style={[styles.actionButton, styles.halfButton, { backgroundColor: colors.primary }]}
                    onPress={handleShare}
                  >
                    <Feather name="share" size={20} color="#fff" />
                    <Text style={styles.primaryActionText}>Share</Text>
                  </TouchableOpacity>
                  
                  {!record.savedToGallery && (
                    <TouchableOpacity 
                      style={[styles.actionButton, styles.halfButton, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}
                      onPress={handleSaveToGallery}
                    >
                      <Feather name="download" size={20} color={colors.foreground} />
                      <Text style={[styles.secondaryActionText, { color: colors.foreground }]}>Save</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              
              <TouchableOpacity 
                style={[styles.actionButton, styles.dangerAction]}
                onPress={handleDelete}
              >
                <Feather name="trash-2" size={20} color={colors.destructive} />
                <Text style={[styles.dangerActionText, { color: colors.destructive }]}>Delete Record</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
  },
  backButton: {
    padding: 8,
    width: 40,
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 20,
  },
  mediaPreview: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 24,
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  typeOverlay: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 8,
    borderRadius: 12,
    backdropFilter: 'blur(10px)',
  },
  infoSection: {
    marginBottom: 24,
  },
  author: {
    fontFamily: 'Inter_700Bold',
    fontSize: 24,
    marginBottom: 8,
  },
  caption: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 22,
  },
  statusCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    marginTop: 16,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  errorText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    marginTop: 12,
  },
  detailsCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  sectionTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  detailLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
  },
  detailValue: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
  },
  actions: {
    gap: 16,
  },
  completedActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 16,
    gap: 8,
  },
  halfButton: {
    flex: 1,
  },
  primaryAction: {
    width: '100%',
  },
  primaryActionText: {
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  },
  secondaryActionText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  },
  dangerAction: {
    backgroundColor: 'transparent',
  },
  dangerActionText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
  },
});
