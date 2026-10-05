import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { type Href, Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Camera, IdCard } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AccessibilityInfo,
  ActivityIndicator,
  AppState,
  findNodeHandle,
  Image,
  Linking,
  Pressable,
  Text,
  View,
} from 'react-native';

import type { PhotoFile } from '../../api/verification';
import { Button } from '../../components/Button';
import { Header } from '../../components/Header';
import { Icon } from '../../components/Icon';
import { Notification } from '../../components/Notification';
import { TextLink } from '../../components/TextLink';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { colorValue } from '../../theme/colors';
import { FormScreen } from '../auth/layouts';
import { useBack } from '../auth/useBack';
import { hasBackSide, type PhotoSlot, useVerificationFlow } from './flow';
import { deletePhoto, preparePhoto, type RawPhoto } from './photos';

const SHUTTER_SIZE = 64;

/** V2 route: `/verify/capture?side=front|back` (`retake=1` when coming back from V4). */
export function DocumentCaptureRoute() {
  const { side, retake } = useLocalSearchParams<{ side?: string; retake?: string }>();
  return <CaptureScreen slot={side === 'back' ? 'back' : 'front'} retake={retake === '1'} />;
}

/** V3 route: `/verify/selfie` (`retake=1` when coming back from V4). */
export function SelfieCaptureRoute() {
  const { retake } = useLocalSearchParams<{ retake?: string }>();
  return <CaptureScreen slot="selfie" retake={retake === '1'} />;
}

/**
 * V2 Document photo and V3 Selfie (mockup `verify-capture`, AC-7.3, 7.4). Our own capture
 * frame with the dashed guide, tips and the 64 px shutter, then a check step ("Is everything
 * readable?") so blurry photos don't cost a 48-hour round trip. Photos go to the app's cache
 * only, never the camera roll, and are shrunk before they are kept (M-25).
 */
export function CaptureScreen({ slot, retake = false }: { slot: PhotoSlot; retake?: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const back = useBack('/verify/document');
  const flow = useVerificationFlow();
  const reduceMotion = useReduceMotion();
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [preview, setPreview] = useState<PhotoFile | null>(null);
  const unused = useRef<PhotoFile | null>(null);
  const heading = useRef<Text>(null);

  const selfie = slot === 'selfie';
  const documentType = flow.documentType;

  // First visit: ask for the camera. After "Open settings", read the answer again on return.
  useEffect(() => {
    if (
      permission &&
      !permission.granted &&
      permission.canAskAgain &&
      permission.status === 'undetermined'
    ) {
      void requestPermission();
    }
  }, [permission, requestPermission]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void getPermission();
    });
    return () => subscription.remove();
  }, [getPermission]);

  // A photo taken but not used (back button, leaving the flow) is erased.
  useEffect(() => () => deletePhoto(unused.current?.uri), []);

  // QA-V8: the check step's heading ("Is everything readable?") takes the screen reader's focus.
  useEffect(() => {
    if (!preview) return;
    const tag = heading.current ? findNodeHandle(heading.current) : null;
    if (tag) AccessibilityInfo.setAccessibilityFocus(tag);
  }, [preview]);

  if (!documentType) return <Redirect href="/verify/document" />;

  const title = selfie
    ? t('verify.selfie.title')
    : t(`verify.captureTitle.${documentType}.${slot === 'back' ? 'back' : 'front'}`);
  const tips = selfie
    ? [t('verify.selfie.tipLight'), t('verify.selfie.tipGlasses'), t('verify.selfie.tipNeutral')]
    : [t('verify.capture.tipLight'), t('verify.capture.tipCorners'), t('verify.capture.tipGlare')];
  const denied = permission?.status === 'denied';
  const granted = permission?.granted === true;

  const keep = async (raw: RawPhoto) => {
    const photo = await preparePhoto(raw);
    unused.current = photo;
    setPreview(photo);
    // The heading is read when it takes the focus: only confirm the shot here.
    AccessibilityInfo.announceForAccessibility(t('verify.capture.taken'));
  };

  const run = async (capture: () => Promise<RawPhoto | null>) => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const raw = await capture();
      if (raw) await keep(raw);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const takePhoto = () =>
    run(async () => {
      if (!camera.current) return null;
      const picture = await camera.current.takePictureAsync({ quality: 1, exif: false });
      return picture ?? null;
    });

  // The system photo picker: no access to the whole library is needed (M-25).
  const choosePhoto = () =>
    run(async () => {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
        exif: false,
        allowsEditing: false,
      });
      const asset = result.canceled ? undefined : result.assets[0];
      return asset ? { uri: asset.uri, width: asset.width, height: asset.height } : null;
    });

  const takeAgain = () => {
    deletePhoto(preview?.uri);
    unused.current = null;
    setPreview(null);
  };

  const usePhoto = () => {
    if (!preview) return;
    flow.setPhoto(slot, preview);
    unused.current = null;
    setPreview(null);
    if (retake) {
      router.back();
      return;
    }
    const next: Href =
      slot === 'front' && hasBackSide(documentType)
        ? { pathname: '/verify/capture', params: { side: 'back' } }
        : slot === 'selfie'
          ? '/verify/review'
          : '/verify/selfie';
    router.push(next);
  };

  return (
    <FormScreen testID={`verify-capture-${slot}`}>
      <Header
        small
        title={preview ? t('verify.capture.checkTitle') : title}
        titleRef={heading}
        onBack={back}
        step={t('verify.step', { step: selfie ? 3 : 2 })}
        intro={preview || selfie ? undefined : t('verify.capture.intro')}
      />

      {denied && !preview ? (
        <Notification
          level="reminder"
          title={t('verify.capture.cameraDenied')}
          testID="camera-denied"
          action={
            <Button
              variant="secondary"
              size="small"
              label={t('verify.capture.openSettings')}
              onPress={() => void Linking.openSettings()}
              testID="open-settings"
            />
          }
        />
      ) : null}

      <View
        className="min-h-[300px] items-center justify-center overflow-hidden rounded-lg border-[0.5px] border-border-soft bg-surface px-lg py-xl"
        accessibilityLabel={preview ? undefined : t('verify.capture.cameraView')}
        accessible={!preview}
      >
        {preview ? (
          <Image
            source={{ uri: preview.uri }}
            accessible
            accessibilityRole="image"
            accessibilityLabel={t('verify.capture.photo')}
            resizeMode="contain"
            className="w-full rounded-lg"
            style={{ aspectRatio: selfie ? 0.75 : 1.586 }}
            testID="capture-preview"
          />
        ) : (
          <>
            {granted ? (
              <CameraView
                ref={camera}
                facing={selfie ? 'front' : 'back'}
                animateShutter={reduceMotion === false}
                onCameraReady={() => setCameraReady(true)}
                style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
                testID="camera"
              />
            ) : null}
            {selfie ? (
              <View
                className="w-3/5 rounded-full border-[1.5px] border-dashed border-ink-3"
                style={{ aspectRatio: 0.75 }}
              />
            ) : (
              <View
                className="w-full items-center justify-center gap-sm rounded-lg border-[1.5px] border-dashed border-ink-3"
                style={{ aspectRatio: 1.586 }}
              >
                {granted ? null : (
                  <>
                    <Icon icon={IdCard} size={32} color="ink-3" />
                    <Text className="text-caption text-ink-3">{t('verify.capture.guide')}</Text>
                  </>
                )}
              </View>
            )}
          </>
        )}
      </View>

      {failed ? (
        <Notification
          level="error"
          title={t('verify.capture.failedTitle')}
          caption={t('verify.capture.failedCaption')}
          testID="capture-failed"
        />
      ) : null}

      {preview ? (
        <View className="gap-md">
          <Button
            size="large"
            label={t('verify.capture.use')}
            onPress={usePhoto}
            testID="use-photo"
          />
          <Button
            variant="ghost"
            size="large"
            label={t('verify.capture.retake')}
            onPress={takeAgain}
            testID="take-again"
          />
        </View>
      ) : (
        <>
          <View
            accessible
            accessibilityLabel={`${t('verify.capture.tips')}: ${tips.join(', ')}`}
            className="flex-row flex-wrap gap-sm"
          >
            {tips.map((tip) => (
              <View
                key={tip}
                className="rounded-sm border-[0.5px] border-border-soft bg-shell px-2.5 py-1.5"
              >
                <Text className="text-caption text-ink-2">{tip}</Text>
              </View>
            ))}
          </View>

          <View className="items-center gap-sm">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('verify.capture.shutter')}
              accessibilityState={{ disabled: !cameraReady || busy, busy }}
              disabled={!cameraReady || busy}
              onPress={() => void takePhoto()}
              className={`items-center justify-center rounded-full bg-green ${cameraReady ? '' : 'opacity-40'}`}
              style={{ width: SHUTTER_SIZE, height: SHUTTER_SIZE }}
              testID="shutter"
            >
              {busy ? (
                <ActivityIndicator color={colorValue('ink')} />
              ) : (
                <Icon icon={Camera} size={28} color="ink" />
              )}
            </Pressable>
            <TextLink
              label={t('verify.capture.fromPhotos')}
              onPress={() => void choosePhoto()}
              disabled={busy}
              testID="choose-photo"
            />
          </View>
        </>
      )}
    </FormScreen>
  );
}
