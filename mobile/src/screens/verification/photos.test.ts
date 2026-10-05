import { Directory, File } from 'expo-file-system';
import { ImageManipulator } from 'expo-image-manipulator';

import { deletePhoto, preparePhoto, resizeFor, sweepLeftoverPhotos } from './photos';

const mockDeleted: string[] = [];
const mockFolder = { exists: true, created: 0, deleted: 0 };
jest.mock('expo-file-system', () => ({
  Paths: { cache: { uri: 'file:///var/app/Caches/' } },
  Directory: jest.fn().mockImplementation((parent: { uri: string }, name: string) => ({
    uri: `${parent.uri}${name}/`,
    get exists() {
      return mockFolder.exists;
    },
    create: () => (mockFolder.created += 1),
    delete: () => (mockFolder.deleted += 1),
  })),
  File: jest.fn().mockImplementation((uri: string) => {
    const file = {
      uri,
      exists: true,
      delete: () => mockDeleted.push(file.uri),
      moveSync: (folder: { uri: string }) => {
        file.uri = `${folder.uri}${uri.split('/').pop()}`;
      },
    };
    return file;
  }),
}));
const mockResize = jest.fn();
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: jest.fn(() => {
      const context = {
        resize: (size: object) => {
          mockResize(size);
          return context;
        },
        renderAsync: async () => ({
          saveAsync: async (options: object) => ({
            uri: 'file:///var/app/Caches/ImageManipulator/out.jpg',
            options,
          }),
        }),
        release: jest.fn(),
      };
      return context;
    }),
  },
}));

beforeEach(() => {
  mockDeleted.length = 0;
  mockResize.mockClear();
  Object.assign(mockFolder, { exists: true, created: 0, deleted: 0 });
  jest.mocked(File).mockClear();
});

describe('verification photos (M-25)', () => {
  it('shrinks the long side to 2,000 px and leaves small photos alone', () => {
    expect(resizeFor(4032, 3024)).toEqual({ width: 2000 });
    expect(resizeFor(3024, 4032)).toEqual({ height: 2000 });
    expect(resizeFor(1600, 1200)).toBeNull();
  });

  it('saves a JPEG in our cache folder and erases the original copy', async () => {
    const photo = await preparePhoto({
      uri: 'file:///private/var/app/Caches/Camera/raw.jpg',
      width: 4032,
      height: 3024,
    });
    expect(photo.uri).toBe('file:///var/app/Caches/verification-photos/out.jpg');
    expect(mockFolder.created).toBe(1);
    expect(mockResize).toHaveBeenCalledWith({ width: 2000 });
    expect(ImageManipulator.manipulate).toHaveBeenCalledWith(
      'file:///private/var/app/Caches/Camera/raw.jpg',
    );
    expect(mockDeleted).toEqual(['file:///private/var/app/Caches/Camera/raw.jpg']);
  });

  it('never deletes a file outside the app cache (the parent’s own photos)', () => {
    deletePhoto('file:///var/mobile/Media/DCIM/IMG_0001.jpg');
    deletePhoto(undefined);
    expect(File).not.toHaveBeenCalled();
    expect(mockDeleted).toEqual([]);
  });

  it('QA-V6: sweeps photos a killed app left behind, only in our own folder', () => {
    sweepLeftoverPhotos();
    expect(mockFolder.deleted).toBe(1);
    expect(jest.mocked(Directory)).toHaveBeenCalledWith(
      { uri: 'file:///var/app/Caches/' },
      'verification-photos',
    );
    mockFolder.exists = false;
    sweepLeftoverPhotos();
    expect(mockFolder.deleted).toBe(1);
  });
});
