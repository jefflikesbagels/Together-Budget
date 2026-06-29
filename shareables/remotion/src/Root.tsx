import { Composition } from 'remotion';
import { DemoVideo, fps, height, totalFrames, width } from './DemoVideo';

export const RemotionRoot = () => (
  <Composition
    id="DemoVideo"
    component={DemoVideo}
    durationInFrames={totalFrames}
    fps={fps}
    width={width}
    height={height}
  />
);
