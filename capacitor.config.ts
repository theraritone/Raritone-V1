import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.raritone.app',
  appName: 'Raritone',
  webDir: 'dist',
  backgroundColor: '#07070b',
  android: {
    // The API origin is https (LAN cert pinned in-app for test builds), so
    // cleartext must stay off and mixed content must stay blocked.
    allowMixedContent: false,
  },
  ios: {
    // Camera-first app: no reason to ever limit the WebView viewport or
    // bounce the shell.
    limitsNavigationsToAppBoundDomains: false,
  },
};

export default config;
