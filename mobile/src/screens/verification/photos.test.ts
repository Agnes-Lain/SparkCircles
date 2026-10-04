import { File } from 'expo-file-system';
import { ImageManipulator } from 'expo-image-manipulator';

import { deletePhoto, preparePhoto, resizeFor } from './photos';

const mockDeleted: string[] = [];
jest.mock('expo-file-system', () => ({
  Paths: { cache: { uri: 'file:///var/app/Caches/' } },
  File: jest.fn().mockImplementation((uri: string) => ({
    uri,
    exists: true,
    delete: () => mockDeleted.push(uri),
  })),
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
  jest.mocked(File).mockClear();
});

describe('verification photos (M-25)', () => {
  it('shrinks the long side to 2,000 px and leaves small photos alone', () => {
    expect(resizeFor(4032, 3024)).toEqual({ width: 2000 });
    expect(resizeFor(3024, 4032)).toEqual({ height: 2000 });
    expect(resizeFor(1600, 1200)).toBeNull();
  });

  it('saves a JPEG in the cache and erases the original copy', async () => {
    const photo = await preparePhoto({
      uri: 'file:///private/var/app/Caches/Camera/raw.jpg',
      width: 4032,
      height: 3024,
    });
    expect(photo.uri).toBe('file:///var/app/Caches/ImageManipulator/out.jpg');
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
});
