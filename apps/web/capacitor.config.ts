import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cofarmz.com',
  appName: 'CoFarmz',

  webDir: 'out', // keep for fallback (not primary)

server: {
  url: 'https://cofarmz-backend-866114557322.asia-south1.run.app',
  cleartext: true,
  androidScheme: 'http',
},

  overrideUserAgent:
    "Mozilla/5.0 (Linux; Android 10; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Mobile Safari/537.36",

  plugins: {
    CapacitorHttp: {
      enabled: true
    },
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '866114557322-neeln0vj5sa2rslac9h8dvfvvceaoina.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
  }
};

export default config;
