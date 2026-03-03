import React, { useState } from 'react';
import { View, Platform, Text, StyleSheet } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';

const AdBanner: React.FC = () => {
  const [adLoaded, setAdLoaded] = useState<boolean>(false);
  const [adError, setAdError] = useState<string | null>(null);

  // ALWAYS use test ads for now until your app is approved
  const adUnitId: string = TestIds.BANNER;

  console.log('🎯 AdBanner rendering with ID:', adUnitId);
  console.log('🎯 Environment:', __DEV__ ? 'Development' : 'Production');

  return (
    <View style={styles.container}>
      <BannerAd
        unitId={adUnitId}
        size={BannerAdSize.BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
        onAdLoaded={() => {
          setAdLoaded(true);
          console.log('✅ Banner Ad loaded successfully');
        }}
        onAdFailedToLoad={(error) => {
          const errorMessage = error?.message || JSON.stringify(error);
          setAdError(errorMessage);
          console.error('❌ Banner Ad failed to load:', error);
        }}
      />
      
      {/* Debug info - shows loading status */}
      {__DEV__ && (
        <Text style={styles.debugText}>
          {adLoaded 
            ? '✅ Test Ad Loaded' 
            : adError 
              ? `❌ Error: ${adError}` 
              : '⏳ Loading ad...'}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingVertical: 10,
    minHeight: 60,
  },
  debugText: {
    fontSize: 10,
    color: '#666',
    marginTop: 5,
    textAlign: 'center',
  },
});

export default AdBanner;