import type { ApiClient } from './client';
import type { Verification } from './types';

// Identity verification (docs/api/accounts-and-verification.md, section 6).

type Client = Pick<ApiClient, 'request'>;

export const VERIFICATION_KEY = ['verification'] as const;

/** §6 `document_type` values; every type but the passport has a back side. */
export type DocumentType =
  'passport' | 'national_id_card' | 'driving_licence' | 'residence_permit' | 'other_residence_card';

/** A photo on the device, ready to send (a shrunk JPEG in the app's cache). */
export type PhotoFile = { uri: string };

export type VerificationSubmission = {
  documentType: DocumentType;
  front: PhotoFile;
  /** Required unless `documentType` is `passport`. */
  back?: PhotoFile;
  selfie: PhotoFile;
  /** YYYY-MM-DD */
  dateOfBirth: string;
};

/** Three photos on mobile data can take a while: more time than the usual 15 s. */
export const UPLOAD_TIMEOUT_MS = 90_000;

// React Native's fetch sends `{ uri, name, type }` parts as files.
function filePart(photo: PhotoFile, name: string): Blob {
  return { uri: photo.uri, name: `${name}.jpg`, type: 'image/jpeg' } as unknown as Blob;
}

export function verificationApi(client: Client) {
  return {
    /** §6 GET /verification: the `verification` object of `me`. */
    get: (signal?: AbortSignal) =>
      client.request<{ verification: Verification }>('/verification', { signal }),

    /** §6 POST /verification, multipart (AC-7.3, 7.5, 7.15). */
    submit: (submission: VerificationSubmission) => {
      const form = new FormData();
      form.append('document_type', submission.documentType);
      form.append('document_front', filePart(submission.front, 'document_front'));
      if (submission.back) form.append('document_back', filePart(submission.back, 'document_back'));
      form.append('selfie', filePart(submission.selfie, 'selfie'));
      form.append('date_of_birth', submission.dateOfBirth);
      return client.request<{ verification: Verification }>('/verification', {
        method: 'POST',
        formData: form,
        timeoutMs: UPLOAD_TIMEOUT_MS,
      });
    },
  };
}

export type VerificationApi = ReturnType<typeof verificationApi>;
