// Stand-in for expo-camera in Jest (no camera hardware):
//   jest.mock('expo-camera', () => jest.requireActual('../../test/cameraMock').cameraModule);
import { Component } from 'react';
import { View } from 'react-native';

type Permission = {
  status: 'granted' | 'denied' | 'undetermined';
  granted: boolean;
  canAskAgain: boolean;
};

export const cameraState: { permission: Permission } = {
  permission: { status: 'granted', granted: true, canAskAgain: true },
};
export const mockRequestPermission = jest.fn();
export const mockTakePicture = jest.fn();

type Props = { onCameraReady?: () => void; facing?: string; animateShutter?: boolean };

/** Ready as soon as it mounts; takes whatever `mockTakePicture` returns. */
class CameraView extends Component<Props> {
  componentDidMount() {
    this.props.onCameraReady?.();
  }
  takePictureAsync(options: object) {
    return mockTakePicture(options);
  }
  render() {
    return (
      <View
        testID="camera"
        {...({ facing: this.props.facing, animateShutter: this.props.animateShutter } as object)}
      />
    );
  }
}

export const cameraModule = {
  CameraView,
  useCameraPermissions: () => [cameraState.permission, mockRequestPermission, jest.fn()],
};
