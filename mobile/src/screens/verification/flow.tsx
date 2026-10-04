import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { DocumentType, PhotoFile } from '../../api/verification';
import { deletePhoto } from './photos';

/** The photos the flow asks for: front, back (two-sided documents only) and the selfie. */
export type PhotoSlot = 'front' | 'back' | 'selfie';

/** V1 rows, in the design's order (AC-7.3). */
export const DOCUMENT_TYPES: readonly DocumentType[] = [
  'passport',
  'national_id_card',
  'driving_licence',
  'residence_permit',
  'other_residence_card',
];

/** Every accepted document but the passport has a back side (contract §6). */
export function hasBackSide(type: DocumentType): boolean {
  return type !== 'passport';
}

export function slotsFor(type: DocumentType): PhotoSlot[] {
  return hasBackSide(type) ? ['front', 'back', 'selfie'] : ['front', 'selfie'];
}

type Photos = Partial<Record<PhotoSlot, PhotoFile>>;

type Flow = {
  documentType: DocumentType | null;
  photos: Photos;
  /** V1: picks the document. Changing it erases the photos of the previous one. */
  chooseDocument: (type: DocumentType) => void;
  /** Keeps a checked photo, erasing the one it replaces. */
  setPhoto: (slot: PhotoSlot, photo: PhotoFile) => void;
  /** Erases every photo of the flow from the device (after sending, or on leaving). */
  clear: () => void;
};

const FlowContext = createContext<Flow | null>(null);

/**
 * Holds the verification in progress (V1–V4) in memory only: the document type and the
 * checked photos, which live in the app's cache. Nothing is persisted; leaving the flow
 * (closing it, or the app dropping it) erases the photos (M-25).
 */
export function VerificationFlowProvider({ children }: { children: ReactNode }) {
  const [documentType, setDocumentType] = useState<DocumentType | null>(null);
  const [photos, setPhotos] = useState<Photos>({});
  const latest = useRef<Photos>({});
  const clear = useCallback(() => {
    Object.values(latest.current).forEach((photo) => deletePhoto(photo?.uri));
    latest.current = {};
    setPhotos({});
  }, []);

  const chooseDocument = useCallback(
    (type: DocumentType) => {
      if (type !== documentType) clear();
      setDocumentType(type);
    },
    [documentType, clear],
  );

  const setPhoto = useCallback((slot: PhotoSlot, photo: PhotoFile) => {
    const previous = latest.current[slot];
    if (previous && previous.uri !== photo.uri) deletePhoto(previous.uri);
    latest.current = { ...latest.current, [slot]: photo };
    setPhotos(latest.current);
  }, []);

  // Leaving the flow without sending ("Not now", back to My account) erases the photos.
  useEffect(() => clear, [clear]);

  const value = useMemo(
    () => ({ documentType, photos, chooseDocument, setPhoto, clear }),
    [documentType, photos, chooseDocument, setPhoto, clear],
  );
  return <FlowContext.Provider value={value}>{children}</FlowContext.Provider>;
}

export function useVerificationFlow(): Flow {
  const flow = useContext(FlowContext);
  if (!flow) throw new Error('useVerificationFlow needs a VerificationFlowProvider.');
  return flow;
}
