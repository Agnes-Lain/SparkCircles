import * as WebBrowser from 'expo-web-browser';
import { Linking, Platform } from 'react-native';

/**
 * "Open my mail app" (S3, S7). iOS opens Mail's inbox with the `message:` scheme; Android has
 * no inbox link without another package, so it opens the mail app chooser (`mailto:`).
 * Fails silently: the person can still open their mail app themselves.
 */
export async function openMailApp(): Promise<void> {
  try {
    await Linking.openURL(Platform.OS === 'ios' ? 'message:' : 'mailto:');
  } catch {
    // No mail app configured.
  }
}

/**
 * Terms of use and privacy policy in an in-app browser sheet, so the sign-up form stays as
 * it was underneath (design S2, expo-web-browser approved for this).
 */
export async function openLegalDocument(url: string): Promise<void> {
  await WebBrowser.openBrowserAsync(url, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
  });
}
