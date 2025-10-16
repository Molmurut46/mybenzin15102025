import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mybenzin.app',
  appName: 'Mybenzin',
  webDir: 'out',
  android: {
    backgroundColor: '#ffffff',
    allowMixedContent: true,
    captureInput: true
  }
};

export default config;