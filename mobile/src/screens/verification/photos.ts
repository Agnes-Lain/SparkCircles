import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import type { PhotoFile } from '../../api/verification';

/** Long side of the photos we send (M-25): sharp enough for the admin, light on mobile data. */
export const MAX_LONG_SIDE = 2000;
const JPEG_QUALITY = 0.85;

/** A photo straight from the camera or the system photo picker. */
export type RawPhoto = { uri: string; width: number; height: number };

/** The resize that brings the long side down to MAX_LONG_SIDE, or null when already small. */
export function resizeFor(
  width: number,
  height: number,
): { width: number } | { height: number } | null {
  if (Math.max(width, height) <= MAX_LONG_SIDE) return null;
  return width >= height ? { width: MAX_LONG_SIDE } : { height: MAX_LONG_SIDE };
}

const local = (uri: string) => uri.replace(/^file:\/\//, '').replace(/^\/private\//, '/');

/** True for files in the app's private cache (camera shots, picker copies, resized photos). */
export function inAppCache(uri: string): boolean {
  return local(uri).startsWith(local(Paths.cache.uri));
}

/**
 * Erases a photo from the device. Only files in the app's cache: never the parent's own
 * photo library. Never throws (a photo already gone is fine).
 */
export function deletePhoto(uri: string | undefined): void {
  if (!uri || !inAppCache(uri)) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Already gone, or the cache was cleared: nothing to erase.
  }
}

/** Our own folder in the app's cache: every photo the flow keeps lives here (M-25). */
export const PHOTO_FOLDER = 'verification-photos';
const photoFolder = () => new Directory(Paths.cache, PHOTO_FOLDER);

/**
 * QA-V6: erases the photos a previous run left behind (the app was killed mid-flow). Called
 * when the flow opens, before any new photo is taken. Only our own folder, never throws.
 */
export function sweepLeftoverPhotos(): void {
  try {
    const folder = photoFolder();
    if (folder.exists) folder.delete();
  } catch {
    // Nothing left, or the OS cleared the cache already.
  }
}

/** Moves a resized photo into our folder so the next sweep can find it. */
function moveToPhotoFolder(uri: string): string {
  const folder = photoFolder();
  folder.create({ idempotent: true, intermediates: true });
  const file = new File(uri);
  try {
    file.moveSync(folder);
  } catch (error) {
    deletePhoto(uri);
    throw error;
  }
  return file.uri;
}

/**
 * Shrinks a photo to about 2,000 px on the long side as JPEG, in our cache folder, then erases
 * the original copy (M-25). The server strips metadata again on its side.
 */
export async function preparePhoto(raw: RawPhoto): Promise<PhotoFile> {
  const context = ImageManipulator.manipulate(raw.uri);
  try {
    const size = resizeFor(raw.width, raw.height);
    if (size) context.resize(size);
    const image = await context.renderAsync();
    const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY });
    return { uri: moveToPhotoFolder(result.uri) };
  } finally {
    context.release();
    deletePhoto(raw.uri);
  }
}
