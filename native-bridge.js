// native-bridge.js — bundled into www/vendor/native-bridge.js (IIFE)
import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

window.Capacitor = Capacitor;
window.DSA = {
  isNative: Capacitor.isNativePlatform(),
  platform: Capacitor.getPlatform(),
  SpeechRecognition,
  Filesystem,
  Directory,
  Encoding,
  Share,
};
