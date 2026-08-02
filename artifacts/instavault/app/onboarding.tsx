import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useSettings } from '@/store/settings';
import Animated, { FadeIn, FadeOut, SlideInRight, SlideOutLeft } from 'react-native-reanimated';
import { requestGalleryPermissions } from '@/services/gallery';
import { requestNotificationPermissions } from '@/services/notifications';

const { width } = Dimensions.get('window');

const CARDS = [
  {
    id: '1',
    title: 'Paste Link',
    description: 'Find any post, reel, or story on Instagram. Copy the link and paste it here.',
    icon: 'link' as const,
  },
  {
    id: '2',
    title: 'Choose Quality',
    description: 'Download in up to 1080p, or extract just the audio from videos.',
    icon: 'sliders' as const,
  },
  {
    id: '3',
    title: 'Save to Gallery',
    description: 'Media is saved directly to your device. Everything happens locally and fast.',
    icon: 'download-cloud' as const,
  }
];

export default function Onboarding() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { setHasSeenOnboarding } = useSettings();
  
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleNext = async () => {
    if (currentIndex < CARDS.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // Last step: request permissions and finish
      await requestGalleryPermissions();
      await requestNotificationPermissions();
      
      setHasSeenOnboarding(true);
      router.replace('/(tabs)');
    }
  };

  const card = CARDS[currentIndex];

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        {currentIndex < CARDS.length - 1 && (
          <TouchableOpacity 
            onPress={() => {
              setHasSeenOnboarding(true);
              router.replace('/(tabs)');
            }}
            style={styles.skipButton}
          >
            <Text style={[styles.skipText, { color: colors.mutedForeground }]}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.content}>
        <Animated.View 
          key={card.id}
          entering={SlideInRight.duration(400)}
          exiting={SlideOutLeft.duration(400)}
          style={styles.card}
        >
          <View style={[styles.iconContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name={card.icon} size={48} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>{card.title}</Text>
          <Text style={[styles.description, { color: colors.mutedForeground }]}>{card.description}</Text>
        </Animated.View>
      </View>

      <View style={styles.footer}>
        <View style={styles.pagination}>
          {CARDS.map((_, index) => (
            <View 
              key={index} 
              style={[
                styles.dot, 
                { backgroundColor: currentIndex === index ? colors.primary : colors.border },
                currentIndex === index && styles.dotActive
              ]} 
            />
          ))}
        </View>

        <TouchableOpacity 
          style={[styles.button, { backgroundColor: colors.primary }]} 
          onPress={handleNext}
          activeOpacity={0.8}
        >
          <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>
            {currentIndex === CARDS.length - 1 ? 'Get Started' : 'Next'}
          </Text>
          <Feather 
            name={currentIndex === CARDS.length - 1 ? 'check' : 'arrow-right'} 
            size={20} 
            color={colors.primaryForeground} 
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: 24,
  },
  skipButton: {
    padding: 8,
  },
  skipText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    alignItems: 'center',
    paddingHorizontal: 32,
    width: width,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 40,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 32,
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    padding: 24,
    paddingBottom: 40,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 24,
  },
  button: {
    flexDirection: 'row',
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
  },
});
