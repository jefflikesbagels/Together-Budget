import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

export const width = 1920;
export const height = 1080;
export const fps = 30;

const introFrames = 70;
const sceneFrames = 132;
const outroFrames = 80;
export const totalFrames = introFrames + sceneFrames * 4 + outroFrames;

type Scene = {
  id: string;
  title: string;
  subtitle: string;
  accent: string;
  image: string;
  imageWidth: number;
  imageHeight: number;
};

const scenes: Scene[] = [
  {
    id: 'overview',
    title: 'Overview',
    subtitle: 'A clear monthly snapshot: income, 50/30/20 progress, disposable cash, and goals.',
    accent: '#58d6bb',
    image: 'captures/overview.png',
    imageWidth: 1440,
    imageHeight: 1770,
  },
  {
    id: 'income',
    title: 'Income',
    subtitle: 'Partner income cards make salary and side income easy to compare and update.',
    accent: '#7edaf0',
    image: 'captures/income.png',
    imageWidth: 1440,
    imageHeight: 1100,
  },
  {
    id: 'expenses',
    title: 'Expenses',
    subtitle: 'Needs, wants, savings, paid-by splits, and category totals stay organized together.',
    accent: '#ff77b8',
    image: 'captures/expenses.png',
    imageWidth: 1440,
    imageHeight: 2622,
  },
  {
    id: 'goals',
    title: 'Goals',
    subtitle: 'Dedicated goal cards turn shared plans into visible monthly commitments.',
    accent: '#f7c95f',
    image: 'captures/goals.png',
    imageWidth: 1440,
    imageHeight: 1100,
  },
];

const clampFade = (frame: number, duration: number) => {
  const enter = interpolate(frame, [0, 20], [0, 1], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const exit = interpolate(frame, [duration - 22, duration], [1, 0], {
    easing: Easing.in(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return Math.min(enter, exit);
};

const Wordmark = ({ small = false }: { small?: boolean }) => (
  <div
    style={{
      color: '#fff8e8',
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: small ? 28 : 62,
      fontWeight: 800,
      letterSpacing: 0,
      lineHeight: 1,
    }}
  >
    Together Budget
  </div>
);

const BrowserFrame = ({ scene, localFrame }: { scene: Scene; localFrame: number }) => {
  const browser = { width: 1370, height: 790 };
  const imageWidth = browser.width;
  const imageHeight = (scene.imageHeight / scene.imageWidth) * imageWidth;
  const maxPan = Math.min(0, browser.height - imageHeight);
  const panY = interpolate(localFrame, [28, sceneFrames - 30], [0, maxPan], {
    easing: Easing.bezier(0.45, 0, 0.55, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        left: 455,
        top: 132,
        width: browser.width,
        height: browser.height + 46,
        borderRadius: 18,
        background: '#0d141d',
        border: `3px solid ${scene.accent}`,
        boxShadow: `0 34px 90px rgba(0, 0, 0, 0.42), 0 0 42px ${scene.accent}44`,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: 46,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          paddingLeft: 22,
          background: '#fdf8eb',
        }}
      >
        {['#ff6b8a', '#f5c45f', '#58d6bb'].map((color) => (
          <span
            key={color}
            style={{ width: 14, height: 14, borderRadius: 999, background: color }}
          />
        ))}
        <span
          style={{
            marginLeft: 14,
            color: '#59615c',
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: 18,
            fontWeight: 700,
          }}
        >
          localhost:3000/{scene.id}
        </span>
      </div>
      <div style={{ position: 'relative', height: browser.height, overflow: 'hidden' }}>
        <Img
          src={staticFile(scene.image)}
          style={{
            position: 'absolute',
            left: 0,
            top: panY,
            width: imageWidth,
            height: imageHeight,
          }}
        />
      </div>
    </div>
  );
};

const SceneSlide = ({ scene, index }: { scene: Scene; index: number }) => {
  const localFrame = useCurrentFrame();
  const opacity = clampFade(localFrame, sceneFrames);
  const lift = interpolate(opacity, [0, 1], [36, 0], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const progress = interpolate(localFrame, [0, sceneFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ opacity, transform: `translateY(${lift}px)` }}>
      <BrowserFrame scene={scene} localFrame={localFrame} />
      <div
        style={{
          position: 'absolute',
          left: 96,
          top: 152,
          width: 310,
          color: '#fff8e8',
          fontFamily: 'Arial, Helvetica, sans-serif',
        }}
      >
        <Wordmark small />
        <div
          style={{
            width: 86,
            height: 8,
            borderRadius: 999,
            background: scene.accent,
            marginTop: 38,
            boxShadow: `0 0 26px ${scene.accent}`,
          }}
        />
        <div style={{ marginTop: 30, fontSize: 68, lineHeight: 0.94, fontWeight: 900 }}>
          {scene.title}
        </div>
        <div style={{ marginTop: 22, fontSize: 25, lineHeight: 1.33, color: '#d7d1c5', fontWeight: 600 }}>
          {scene.subtitle}
        </div>
        <div
          style={{
            marginTop: 42,
            width: 250,
            height: 10,
            borderRadius: 999,
            background: '#28323d',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${Math.round(progress * 100)}%`,
              height: '100%',
              background: scene.accent,
            }}
          />
        </div>
        <div style={{ marginTop: 14, color: '#958f84', fontSize: 19, fontWeight: 700 }}>
          {index + 1} / {scenes.length}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Intro = () => {
  const frame = useCurrentFrame();
  const { fps: videoFps } = useVideoConfig();
  const opacity = interpolate(frame, [0, 14, introFrames - 16, introFrames], [0, 1, 1, 0], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const scale = interpolate(frame, [0, 1.8 * videoFps], [0.96, 1], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        opacity,
        transform: `scale(${scale})`,
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff8e8',
        fontFamily: 'Arial, Helvetica, sans-serif',
        textAlign: 'center',
      }}
    >
      <Wordmark />
      <div style={{ marginTop: 28, fontSize: 34, color: '#f4cf79', fontWeight: 700 }}>
        Four-tab walkthrough of the finished couples budget planner
      </div>
    </AbsoluteFill>
  );
};

const Outro = () => {
  const localFrame = useCurrentFrame();
  const opacity = interpolate(localFrame, [0, 24], [0, 1], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        opacity,
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff8e8',
        fontFamily: 'Arial, Helvetica, sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 70 }}>
        <div style={{ width: 560 }}>
          <Wordmark />
          <div style={{ marginTop: 30, fontSize: 34, lineHeight: 1.2, color: '#f4cf79', fontWeight: 800 }}>
            Demo video and share-ready screenshot report exported.
          </div>
          <div style={{ marginTop: 24, fontSize: 24, lineHeight: 1.4, color: '#d7d1c5', fontWeight: 600 }}>
            Overview, Income, Expenses, and Goals are captured with sample budget data for a clean stakeholder handoff.
          </div>
        </div>
        <Img
          src={staticFile('together-budget-tab-report.png')}
          style={{
            width: 760,
            borderRadius: 22,
            border: '4px solid #fff8e8',
            boxShadow: '0 34px 90px rgba(0, 0, 0, 0.42)',
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

export const DemoVideo = () => {
  return (
    <AbsoluteFill style={{ background: '#101922', overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 18% 20%, rgba(88, 214, 187, 0.20), transparent 30%), radial-gradient(circle at 82% 72%, rgba(255, 119, 184, 0.18), transparent 32%), linear-gradient(135deg, #111d27, #0b1018)',
        }}
      />
      <Sequence durationInFrames={introFrames}>
        <Intro />
      </Sequence>
      {scenes.map((scene, index) => (
        <Sequence key={scene.id} from={introFrames + index * sceneFrames} durationInFrames={sceneFrames}>
          <SceneSlide scene={scene} index={index} />
        </Sequence>
      ))}
      <Sequence from={introFrames + scenes.length * sceneFrames} durationInFrames={outroFrames}>
        <Outro />
      </Sequence>
    </AbsoluteFill>
  );
};
