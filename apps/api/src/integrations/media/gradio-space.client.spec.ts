import { describe, expect, it } from 'vitest';
import {
  contentTypeForFile,
  extractFileRef,
  fileRefToUrl,
  parseSseTerminalEvent,
} from './gradio-space.client';

describe('parseSseTerminalEvent', () => {
  it('returns the terminal complete event with its data', () => {
    const stream = [
      'event: heartbeat',
      'data: null',
      '',
      'event: generating',
      'data: [null]',
      '',
      'event: complete',
      'data: [{"path": "/tmp/gradio/x/audio.wav"}]',
      '',
    ].join('\n');
    expect(parseSseTerminalEvent(stream)).toEqual({
      event: 'complete',
      data: '[{"path": "/tmp/gradio/x/audio.wav"}]',
    });
  });

  it('surfaces error events and tolerates empty streams', () => {
    expect(parseSseTerminalEvent('event: error\ndata: "quota exceeded"\n')).toEqual({
      event: 'error',
      data: '"quota exceeded"',
    });
    expect(parseSseTerminalEvent('')).toBeNull();
    expect(parseSseTerminalEvent('event: heartbeat\ndata: {}')).toBeNull();
  });
});

describe('extractFileRef', () => {
  it('finds the first file reference anywhere in the output payload', () => {
    const outputs = [
      null,
      'a log line',
      {
        video: {
          path: '/tmp/gradio/y/clip.mp4',
          url: 'https://space.hf.space/gradio_api/file=/tmp/gradio/y/clip.mp4',
          meta: { _type: 'gradio.FileData' },
        },
      },
      42,
    ];
    expect(extractFileRef(outputs)?.path).toBe('/tmp/gradio/y/clip.mp4');
    expect(extractFileRef([null, 'log', 7])).toBeNull();
  });
});

describe('fileRefToUrl', () => {
  it('prefers the absolute url and falls back to the file proxy path', () => {
    expect(
      fileRefToUrl('https://space.hf.space', {
        url: 'https://space.hf.space/gradio_api/file=/tmp/a.png',
      }),
    ).toBe('https://space.hf.space/gradio_api/file=/tmp/a.png');
    expect(fileRefToUrl('https://space.hf.space', { path: '/tmp/b.wav' })).toBe(
      'https://space.hf.space/gradio_api/file=/tmp/b.wav',
    );
    expect(fileRefToUrl('https://space.hf.space', {})).toBeNull();
  });
});

describe('contentTypeForFile', () => {
  it('maps by extension first, then the response header, then octet-stream', () => {
    expect(contentTypeForFile('audio.wav', 'application/octet-stream')).toBe('audio/wav');
    expect(contentTypeForFile('clip.mp4', null)).toBe('video/mp4');
    expect(contentTypeForFile('image.png?download=1', null)).toBe('image/png');
    expect(contentTypeForFile('mystery.bin', 'audio/flac; charset=binary')).toBe('audio/flac');
    expect(contentTypeForFile('mystery.bin', null)).toBe('application/octet-stream');
  });
});
