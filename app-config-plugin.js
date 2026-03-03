const { withAndroidManifest, withProjectBuildGradle, withAppBuildGradle, withGradleProperties } = require('@expo/config-plugins');

module.exports = function withCustomAndroidConfig(config) {
  // Apply Android Manifest changes
  config = withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults.manifest;

    // Ensure tools namespace is declared at manifest level
    if (!androidManifest.$) {
      androidManifest.$ = {};
    }
    androidManifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';

    // Find or create the application tag
    if (!androidManifest.application) {
      androidManifest.application = [{}];
    }

    const application = androidManifest.application[0];

    // Ensure application has the $ property for attributes
    if (!application.$) {
      application.$ = {};
    }

    // Add tools:replace for appComponentFactory
    application.$['android:appComponentFactory'] = 'androidx.core.app.CoreComponentFactory';
    application.$['tools:replace'] = 'android:appComponentFactory';

    // Ensure meta-data array exists
    if (!application['meta-data']) {
      application['meta-data'] = [];
    }

    // Find the DELAY_APP_MEASUREMENT_INIT meta-data
    const metaDataIndex = application['meta-data'].findIndex(
      (item) => item.$['android:name'] === 'com.google.android.gms.ads.DELAY_APP_MEASUREMENT_INIT'
    );

    if (metaDataIndex !== -1) {
      // Update existing meta-data
      application['meta-data'][metaDataIndex].$ = {
        'android:name': 'com.google.android.gms.ads.DELAY_APP_MEASUREMENT_INIT',
        'android:value': 'true',
        'tools:replace': 'android:value'
      };
    } else {
      // Add new meta-data
      application['meta-data'].push({
        $: {
          'android:name': 'com.google.android.gms.ads.DELAY_APP_MEASUREMENT_INIT',
          'android:value': 'true',
          'tools:replace': 'android:value'
        }
      });
    }

    return config;
  });

  // Fix project-level build.gradle for AndroidX conflicts
  config = withProjectBuildGradle(config, (config) => {
    let buildGradle = config.modResults.contents;
    
    // Add AndroidX resolution strategy if not present
    if (!buildGradle.includes('force androidx.core:core:1.16.0')) {
      // Find the allprojects block
      const allProjectsRegex = /(allprojects\s*{[\s\S]*?repositories\s*{[\s\S]*?})/;
      
      if (allProjectsRegex.test(buildGradle)) {
        buildGradle = buildGradle.replace(
          allProjectsRegex,
          `$1
  
  configurations.all {
    resolutionStrategy {
      force 'androidx.core:core:1.16.0'
      force 'androidx.versionedparcelable:versionedparcelable:1.1.1'
      force 'androidx.vectordrawable:vectordrawable:1.2.0'
      force 'androidx.vectordrawable:vectordrawable-animated:1.2.0'
    }
    exclude group: 'com.android.support'
  }`
        );
      }
    }
    
    config.modResults.contents = buildGradle;
    return config;
  });

  // Fix app-level build.gradle
  config = withAppBuildGradle(config, (config) => {
    let buildGradle = config.modResults.contents;
    
    // Add configuration exclusions before dependencies if not present
    if (!buildGradle.includes('configurations.all') && !buildGradle.includes('exclude group: \'com.android.support\'')) {
      buildGradle = buildGradle.replace(
        /(dependencies\s*{)/,
        `configurations.all {
    exclude group: 'com.android.support'
}

$1`
      );
    }
    
    config.modResults.contents = buildGradle;
    return config;
  });

  // Ensure gradle.properties has correct settings
  config = withGradleProperties(config, (config) => {
    // Remove any existing duplicate class check setting
    config.modResults = config.modResults.filter(
      item => item.key !== 'android.enableDuplicateClassesCheck'
    );
    
    // Add it back as false
    config.modResults.push({
      type: 'property',
      key: 'android.enableDuplicateClassesCheck',
      value: 'false',
    });

    // Ensure Jetifier is enabled
    const jetifierIndex = config.modResults.findIndex(item => item.key === 'android.enableJetifier');
    if (jetifierIndex === -1) {
      config.modResults.push({
        type: 'property',
        key: 'android.enableJetifier',
        value: 'true',
      });
    } else {
      config.modResults[jetifierIndex].value = 'true';
    }

    // Ensure AndroidX is enabled
    const androidXIndex = config.modResults.findIndex(item => item.key === 'android.useAndroidX');
    if (androidXIndex === -1) {
      config.modResults.push({
        type: 'property',
        key: 'android.useAndroidX',
        value: 'true',
      });
    } else {
      config.modResults[androidXIndex].value = 'true';
    }

    return config;
  });

  return config;
};