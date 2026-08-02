import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Platform, Keyboard, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useResolveMedia } from '@workspace/api-client-react';
import { useDownloadQueue } from '@/store/downloadQueue';
import { useSettings } from '@/store/settings';
import { DownloadRecord, getDownloads } from '@/services/database';
import { MediaPreviewSheet } from '@/components/MediaPreviewSheet';
import { DownloadProgress } from '@/components/DownloadProgress';
import { HistoryItem } from '@/components/HistoryItem';
import * as Clipboard from 'expo-clipboard';
import { getDownloadMediaUrl } from '@workspace/api-client-react';

export default function Home() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  
  const [url, setUrl] = useState('');
  const [recentHistory, setRecentHistory] = useState<DownloadRecord[]>([]);
  const [isSheetVisible, setIsSheetVisible] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  
  const { queue, addDownload, cancelDownload } = useDownloadQueue();
  const { defaultQuality } = useSettings();
  
  const resolveMedia = useResolveMedia();
  
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'web') {
        const fetchRecent = () => setRecentHistory(getDownloads(5));
        fetchRecent();
      }
    }, [])
  );
  
  const handlePaste = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) {
      setUrl(text);
      setResolveError(null);
    }
  };
  
  const handleClear = () => {
    setUrl('');
    setResolveError(null);
  };
  
  const handleFetch = () => {
    if (!url.trim()) return;
    
    Keyboard.dismiss();
    setResolveError(null);
    
    resolveMedia.mutate(
      { data: { url: url.trim() } },
      {
        onSuccess: () => {
          setIsSheetVisible(true);
        },
        onError: (err: any) => {
          setResolveError(err.message || 'Failed to resolve media');
        }
      }
    );
  };
  
  const handleDownload = (formatId: string, index?: number) => {
    const media = resolveMedia.data;
    if (!media) return;
    
    // Create record stub
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    
    const formats = media.formats || (media.items?.[0]?.formats) || [];
    const selectedFormat = formats.find(f => f.formatId === formatId) || formats[0];
    
    const record: Partial<DownloadRecord> = {
      id,
      url,
      shortcode: media.id,
      mediaType: media.type as any,
      author: media.author || 'unknown',
      authorDisplayName: media.authorDisplayName || media.author || 'Unknown',
      thumbnailUrl: media.thumbnailUrl || '',
      caption: media.caption,
      fileName: `${media.author || 'insta'}_${media.id}_${formatId}.${selectedFormat?.ext || 'mp4'}`,
      fileSize: selectedFormat?.filesize || 0,
      mimeType: media.type === 'video' || media.type === 'reel' ? 'video/mp4' : 'image/jpeg',
      quality: selectedFormat?.label || formatId,
    };
    
    const downloadUrl = getDownloadMediaUrl({ url, formatId, index });
    
    // Add base domain if not full URL
    const fullDownloadUrl = downloadUrl.startsWith('http') 
      ? downloadUrl 
      : `https://${process.env.EXPO_PUBLIC_DOMAIN}${downloadUrl}`;
    
    addDownload(fullDownloadUrl, record);
    setUrl('');
  };
  
  const activeDownloads = Object.values(queue);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView 
        contentContainerStyle={[
          styles.scrollContent, 
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 84 }
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <Text style={[styles.title, { color: colors.foreground }]}>InstaVault</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Download media from Instagram
          </Text>
        </View>

        <View style={styles.inputSection}>
          <View style={[
            styles.inputContainer, 
            { 
              backgroundColor: colors.card,
              borderColor: resolveError ? colors.destructive : colors.border 
            }
          ]}>
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              placeholder="Paste Instagram URL here"
              placeholderTextColor={colors.mutedForeground}
              value={url}
              onChangeText={(text) => {
                setUrl(text);
                setResolveError(null);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="never"
            />
            {url.length > 0 ? (
              <TouchableOpacity onPress={handleClear} style={styles.iconButton}>
                <Feather name="x-circle" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={handlePaste} style={styles.iconButton}>
                <Feather name="clipboard" size={20} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>
          
          {resolveError && (
            <Text style={[styles.errorText, { color: colors.destructive }]}>
              {resolveError}
            </Text>
          )}

          <TouchableOpacity 
            style={[
              styles.fetchButton, 
              { backgroundColor: colors.primary },
              (!url.trim() || resolveMedia.isPending) && { opacity: 0.7 }
            ]}
            onPress={handleFetch}
            disabled={!url.trim() || resolveMedia.isPending}
            activeOpacity={0.8}
          >
            {resolveMedia.isPending ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <>
                <Feather name="search" size={20} color={colors.primaryForeground} />
                <Text style={[styles.fetchButtonText, { color: colors.primaryForeground }]}>
                  Fetch Media
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {activeDownloads.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Active Downloads
            </Text>
            {activeDownloads.map((item) => (
              <DownloadProgress 
                key={item.id}
                progress={item.record.progress || 0}
                status={item.record.status as any}
                fileName={item.record.fileName || 'Download'}
              />
            ))}
          </View>
        )}

        {recentHistory.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                Recent History
              </Text>
            </View>
            {recentHistory.map((item) => (
              <HistoryItem key={item.id} item={item} />
            ))}
          </View>
        )}
      </ScrollView>

      <MediaPreviewSheet
        visible={isSheetVisible}
        onClose={() => setIsSheetVisible(false)}
        media={resolveMedia.data || null}
        onDownload={handleDownload}
        defaultQuality={defaultQuality}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  hero: {
    marginBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 32,
    letterSpacing: -1,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
  },
  inputSection: {
    marginBottom: 32,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 60,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    height: '100%',
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
  },
  iconButton: {
    padding: 8,
  },
  errorText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    marginBottom: 16,
    marginTop: -8,
  },
  fetchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 60,
    borderRadius: 16,
    gap: 12,
  },
  fetchButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    marginBottom: 16,
  },
});
