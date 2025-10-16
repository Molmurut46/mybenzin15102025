import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mybenzin.app',
  appName: 'Mybenzin',
  webDir: 'out',
  server: {
    // В production используем развернутый сайт
    url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    cleartext: true
  },
  android: {
    backgroundColor: '#ffffff',
    allowMixedContent: true,
    captureInput: true
  }
};

export default config;