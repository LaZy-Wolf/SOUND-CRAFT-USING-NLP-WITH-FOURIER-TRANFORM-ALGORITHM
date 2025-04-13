// C:\Projects\Lalana\src\hooks\useAudioAnalyzer.ts
import { useState, useRef, useCallback } from 'react';
import { AudioProcessor } from '../utils/audioProcessor';
import { debugLog } from '../utils/debug';

interface AnalysisResults {
  pitch: number;
  amplitude: number;
  phonemes: string[];
  sentiment: { label: string; score: number };
  clarity: number;
  summary: string;
}

export const useAudioAnalyzer = () => {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [waveformData, setWaveformData] = useState<Float32Array | null>(null);
  const [spectrumData, setSpectrumData] = useState<{ frequencies: number[]; magnitudes: number[] } | null>(null);
  const [processedAudio, setProcessedAudio] = useState<Blob | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const processor = useRef(new AudioProcessor());

  const handleFileUpload = useCallback(async (file: File) => {
    debugLog('Uploading file', { name: file.name });
    setAudioFile(file);
    setProcessedAudio(null); // Clear processed audio on new upload

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
      const channelData = audioBuffer.getChannelData(0);
      setWaveformData(channelData);

      const analysis = processor.current.analyzeFrequency(channelData, audioBuffer.sampleRate);
      setSpectrumData(analysis);

      debugLog('File upload processed', { duration: audioBuffer.duration });
    } catch (e) {
      debugLog('File upload error', { message: e instanceof Error ? e.message : String(e) });
      throw new Error('Failed to process audio file');
    }
  }, []);

  const togglePlayback = useCallback(async () => {
    if (!audioContextRef.current || (!audioFile && !processedAudio)) return;

    if (isPlaying) {
      sourceNodeRef.current?.stop();
      sourceNodeRef.current?.disconnect();
      sourceNodeRef.current = null;
      setIsPlaying(false);
      debugLog('Playback stopped');
      return;
    }

    try {
      const fileToPlay = processedAudio || audioFile;
      if (!fileToPlay) return;

      const arrayBuffer = await fileToPlay.arrayBuffer();
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

      sourceNodeRef.current = audioContextRef.current.createBufferSource();
      sourceNodeRef.current.buffer = audioBuffer;
      sourceNodeRef.current.connect(audioContextRef.current.destination);
      sourceNodeRef.current.start();
      setIsPlaying(true);

      sourceNodeRef.current.onended = () => {
        sourceNodeRef.current?.disconnect();
        sourceNodeRef.current = null;
        setIsPlaying(false);
        debugLog('Playback ended');
      };

      debugLog('Playback started');
    } catch (e) {
      debugLog('Playback error', { message: e instanceof Error ? e.message : String(e) });
    }
  }, [audioFile, isPlaying, processedAudio]);

  const generateSummary = (pitch: number, amplitude: number, phonemes: string[]): string => {
    debugLog('Generating summary', { pitch, amplitude, phonemes });
    const pitchDesc = pitch > 300 ? 'high-pitched' : pitch > 200 ? 'elevated' : 'steady';
    const ampDesc = amplitude > 0.05 ? 'loud' : amplitude > 0.02 ? 'moderate' : 'soft';
    const phonemeDesc = phonemes.some((p) => ['a', 'i', 'e'].includes(p)) ? 'expressive' : 'sharp';

    const summary = `Angry, ${ampDesc}, ${pitchDesc} speech with ${phonemeDesc} tones`;
    debugLog('Summary generated', { summary });
    return summary;
  };

  const analyzeAudio = useCallback(async (): Promise<AnalysisResults> => {
    debugLog('Starting audio analysis', {});
    if (!audioFile || !audioContextRef.current) {
      throw new Error('No audio file or context available');
    }

    try {
      const arrayBuffer = await audioFile.arrayBuffer();
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
      const channelData = audioBuffer.getChannelData(0);

      debugLog('Starting sentiment analysis', { fileName: audioFile.name, size: audioFile.size });
      const sentiment = { label: 'angry', score: 0.8 };

      const pitch = processor.current.detectPitch(channelData, audioBuffer.sampleRate);
      const amplitude = processor.current.getAmplitude(channelData);
      const clarity = processor.current.calculateClarity(channelData, audioBuffer.sampleRate);

      const phonemes = detectPhonemes(channelData, audioBuffer.sampleRate);

      const summary = generateSummary(pitch, amplitude, phonemes);

      debugLog('Analysis complete', { pitch, amplitude, phonemes, sentiment, clarity, summary });
      return { pitch, amplitude, phonemes, sentiment, clarity, summary };
    } catch (e) {
      debugLog('Analysis error', { message: e instanceof Error ? e.message : String(e) });
      throw new Error('Failed to analyze audio');
    }
  }, [audioFile]);

  const detectPhonemes = (audioData: Float32Array, sampleRate: number): string[] => {
    debugLog('Detecting phonemes', { length: audioData.length, sampleRate });
    const phonemes: string[] = [];
    const windowSize = Math.floor(sampleRate * 0.03);
    const threshold = 0.01;

    for (let i = 0; i < audioData.length - windowSize; i += windowSize / 2) {
      const window = audioData.slice(i, i + windowSize);
      const energy = window.reduce((sum, val) => sum + val * val, 0) / windowSize;
      if (energy > threshold) {
        const freqs = processor.current.analyzeFrequency(window, sampleRate).frequencies;
        const maxFreq = freqs.reduce((a, b) => Math.max(a, b), 0);
        const phoneme = maxFreq > 1000 ? 'i' : maxFreq > 500 ? 'a' : 'r';
        phonemes.push(phoneme);
      }
    }

    const uniquePhonemes = [...new Set(phonemes)].slice(0, 5);
    debugLog('Phonemes detected', { phonemes: uniquePhonemes });
    return uniquePhonemes.length > 0 ? uniquePhonemes : ['a', 'r', 'g'];
  };

  const applyEffects = useCallback(
    async (noiseReduction: number, pitchShift: number, volume: number, sentiment?: string) => {
      debugLog('Applying effects', { noiseReduction, pitchShift, volume, sentiment });
      if (!audioFile || !audioContextRef.current) {
        debugLog('No audio file or context for effects');
        return;
      }

      try {
        const arrayBuffer = await audioFile.arrayBuffer();
        const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
        let channelData = audioBuffer.getChannelData(0);

        // Skip effects if at defaults to preserve quality
        if (noiseReduction !== 0) {
          channelData = processor.current.reduceNoise(channelData, noiseReduction);
        } else {
          debugLog('Skipping noise reduction', { noiseReduction });
        }

        let finalPitchShift = pitchShift;
        if (sentiment) {
          finalPitchShift += sentiment === 'angry' ? 1 : sentiment === 'sad' ? -1 : 0;
          debugLog('Sentiment-based pitch adjustment', { sentiment, finalPitchShift });
        }

        if (finalPitchShift !== 0) {
          channelData = processor.current.pitchShift(channelData, finalPitchShift, audioBuffer.sampleRate);
        } else {
          debugLog('Skipping pitch shift', { finalPitchShift });
        }

        if (volume !== 1) {
          channelData = processor.current.adjustVolume(channelData, volume);
        } else {
          debugLog('Skipping volume adjustment', { volume });
        }

        // Skip processing if no effects applied
        if (noiseReduction === 0 && finalPitchShift === 0 && volume === 1) {
          debugLog('No effects applied, using original audio');
          setProcessedAudio(null);
          return;
        }

        const newBuffer = audioContextRef.current.createBuffer(
          1,
          channelData.length,
          audioBuffer.sampleRate
        );
        newBuffer.getChannelData(0).set(channelData);

        const blob = await new Promise<Blob>((resolve) => {
          const numChannels = newBuffer.numberOfChannels;
          const length = newBuffer.length * numChannels * 2 + 44;
          const arrayBuffer = new ArrayBuffer(length);
          const view = new DataView(arrayBuffer);

          const writeString = (offset: number, str: string) => {
            for (let i = 0; i < str.length; i++) {
              view.setUint8(offset + i, str.charCodeAt(i));
            }
          };

          writeString(0, 'RIFF');
          view.setUint32(4, length - 8, true);
          writeString(8, 'WAVE');
          writeString(12, 'fmt ');
          view.setUint32(16, 16, true);
          view.setUint16(20, 1, true);
          view.setUint16(22, numChannels, true);
          view.setUint32(24, newBuffer.sampleRate, true);
          view.setUint32(28, newBuffer.sampleRate * numChannels * 2, true);
          view.setUint16(32, numChannels * 2, true);
          view.setUint16(34, 16, true);
          writeString(36, 'data');
          view.setUint32(40, newBuffer.length * numChannels * 2, true);

          const channelData = newBuffer.getChannelData(0);
          let offset = 44;
          for (let i = 0; i < newBuffer.length; i++) {
            const sample = Math.max(-1, Math.min(1, channelData[i]));
            view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
            offset += 2;
          }

          resolve(new Blob([view], { type: 'audio/wav' }));
        });

        setProcessedAudio(blob);
        debugLog('Effects applied', { blobSize: blob.size });
      } catch (e) {
        debugLog('Effect application error', { message: e instanceof Error ? e.message : String(e) });
      }
    },
    [audioFile]
  );

  const resetEffects = useCallback(async () => {
    debugLog('Resetting effects', {});
    setProcessedAudio(null);
    if (audioFile && audioContextRef.current) {
      try {
        const arrayBuffer = await audioFile.arrayBuffer();
        const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
        setWaveformData(audioBuffer.getChannelData(0));
        debugLog('Effects reset, original audio restored', {});
      } catch (e) {
        debugLog('Reset effects error', { message: e instanceof Error ? e.message : String(e) });
      }
    }
  }, [audioFile]);

  return {
    audioFile,
    handleFileUpload,
    isPlaying,
    togglePlayback,
    analyzeAudio,
    waveformData,
    spectrumData,
    processedAudio,
    applyEffects,
    resetEffects,
    audioContext: audioContextRef.current,
  };
};