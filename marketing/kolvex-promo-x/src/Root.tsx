import React from 'react';
import { Composition } from 'remotion';
import { Main, MainProps } from './Main';
import { FPS, SHOTS, TOTAL } from './timeline';
import { S1Open } from './shots/S1Open';
import { S2Creators } from './shots/S2Creators';
import { S3aCompare } from './shots/S3aCompare';
import { S3bResearch } from './shots/S3bResearch';
import { S4Brand } from './shots/S4Brand';

const defaults: MainProps = { bgm: true };

export const Root: React.FC = () => (
  <>
    <Composition id="KolvexPromo" component={Main} durationInFrames={TOTAL} fps={FPS} width={1920} height={1080} defaultProps={defaults} />
    {/* per-shot compositions for still QA */}
    <Composition id="S1Open" component={S1Open} durationInFrames={SHOTS.open.duration} fps={FPS} width={1920} height={1080} />
    <Composition id="S2Creators" component={S2Creators} durationInFrames={SHOTS.creators.duration} fps={FPS} width={1920} height={1080} />
    <Composition id="S3aCompare" component={S3aCompare} durationInFrames={SHOTS.compare.duration} fps={FPS} width={1920} height={1080} />
    <Composition id="S3bResearch" component={S3bResearch} durationInFrames={SHOTS.research.duration} fps={FPS} width={1920} height={1080} />
    <Composition id="S4Brand" component={S4Brand} durationInFrames={SHOTS.brand.duration} fps={FPS} width={1920} height={1080} />
  </>
);
