/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GenAILiveClient } from '../../lib/genai-live-client';
import { LiveConnectConfig } from '@google/genai';
import { AudioStreamer } from '../../lib/audio-streamer';
import { audioContext } from '../../lib/utils';

export type UseLiveApiResults = {
  client: GenAILiveClient;
  connect: (config?: LiveConnectConfig) => Promise<void>;
  setConfig: (config: LiveConnectConfig) => void;
  disconnect: () => Promise<void>;
  connected: boolean;
  audioStreamer: AudioStreamer | null;
};

export function useLiveApi({ apiKey }: { apiKey: string }): UseLiveApiResults {
  const client = useMemo(() => new GenAILiveClient(apiKey), [apiKey]);
  const [audioStreamer, setAudioStreamer] = useState<AudioStreamer | null>(null);
  const [connected, setConnected] = useState(false);
  const [config, setConfig] = useState<LiveConnectConfig | null>(null);
  const disconnectResolver = useRef<(() => void) | null>(null);

  useEffect(() => {
    let isMounted = true;
    audioContext({ id: 'audio-out' }).then((audioCtx: AudioContext) => {
      if (isMounted) {
        setAudioStreamer(new AudioStreamer(audioCtx));
      }
    });
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (!audioStreamer) return;

    const onOpen = () => {
      console.log('Live API connection successful.');
      setConnected(true);
    };
    const onClose = () => {
      console.log('Live API connection closed.');
      setConnected(false);
      if (disconnectResolver.current) {
        disconnectResolver.current();
        disconnectResolver.current = null;
      }
    };
    const stopAudioStreamer = () => audioStreamer.stop();
    const onAudio = (data: ArrayBuffer) => {
      audioStreamer.addPCM16(new Uint8Array(data));
    };

    client.on('open', onOpen);
    client.on('close', onClose);
    client.on('interrupted', stopAudioStreamer);
    client.on('audio', onAudio);

    return () => {
      client.off('open', onOpen);
      client.off('close', onClose);
      client.off('interrupted', stopAudioStreamer);
      client.off('audio', onAudio);
    };
  }, [client, audioStreamer]);

  const connect = useCallback(async (newConfig?: LiveConnectConfig) => {
    const configToUse = newConfig || config;
    if (client.status !== 'disconnected' || !audioStreamer || !configToUse) return;
    try {
      console.log('Attempting to connect to Live API...');
      await audioStreamer.resume();
      await client.connect(configToUse);
    } catch (e) {
      console.error("Failed to connect:", e);
    }
  }, [client, audioStreamer, config]);

  const disconnect = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      if (client.status === 'disconnected') {
        setConnected(false);
        resolve();
        return;
      }
      disconnectResolver.current = resolve;
      client.disconnect();
      audioStreamer?.stop();
    });
  }, [client, audioStreamer]);

  return { client, connect, connected, disconnect, audioStreamer, setConfig };
}
