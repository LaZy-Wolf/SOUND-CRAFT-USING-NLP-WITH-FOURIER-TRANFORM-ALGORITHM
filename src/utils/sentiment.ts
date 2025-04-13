// C:\Projects\Lalana\src\utils\sentiment.ts
import { debugLog } from './debug';
import FFT from 'fft-js';

interface SentimentResult {
  label: string;
  score: number;
}

export const analyzeSentiment = async (audioFile: File): Promise<{ label: string; score: number }> => {
  debugLog('Starting sentiment analysis', { fileName: audioFile.name, size: audioFile.size });

  try {
    const audioBuffer = await audioFile.arrayBuffer();
    debugLog('Audio buffer loaded', { byteLength: audioBuffer.byteLength });

    const audioContext = new AudioContext({ sampleRate: 16000 });
    const decoded = await audioContext.decodeAudioData(audioBuffer);
    const audioData = decoded.getChannelData(0);
    debugLog('Audio decoded', { sampleRate: decoded.sampleRate, length: audioData.length });

    const fftSize = 2048;
    const signal = audioData.slice(0, fftSize);
    const phasors = FFT.fft(Array.from(signal));
    const frequencyData = new Uint8Array(fftSize / 2);
    for (let i = 0; i < frequencyData.length; i++) {
      const mag = Math.sqrt(phasors[i][0] ** 2 + phasors[i][1] ** 2);
      frequencyData[i] = Math.min(255, Math.round(mag * 255));
    }

    const pitch = estimatePitch(audioData, decoded.sampleRate);
    debugLog('Pitch estimated', { pitch });

    const rms = Math.sqrt(audioData.reduce((sum, val) => sum + val * val, 0) / audioData.length);
    debugLog('RMS calculated', { rms });

    const energy = calculateEnergy(frequencyData);
    debugLog('Energy calculated', { energy });

    const result = detectEmotion(pitch, rms, energy);
    debugLog('Emotion detected', { result });

    return result;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    debugLog('Sentiment analysis error, falling back', { message: err.message, stack: err.stack });
    console.error('Sentiment error:', err);
    return { label: 'neutral', score: 0.5 };
  }
};

function estimatePitch(audioData: Float32Array, sampleRate: number): number {
  const windowSize = 2048;
  let maxCorrelation = 0;
  let bestLag = 0;

  for (let lag = 50; lag < 500; lag++) {
    let correlation = 0;
    for (let i = 0; i < windowSize - lag; i++) {
      correlation += audioData[i] * audioData[i + lag];
    }
    if (correlation > maxCorrelation) {
      maxCorrelation = correlation;
      bestLag = lag;
    }
  }

  return bestLag ? sampleRate / bestLag : 0;
}

function calculateEnergy(frequencyData: Uint8Array): number {
  const mean = frequencyData.reduce((sum, val) => sum + val, 0) / frequencyData.length;
  const variance = frequencyData.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / frequencyData.length;
  return variance;
}

function detectEmotion(pitch: number, rms: number, energy: number): SentimentResult {
  debugLog('Audio features', { pitch, rms, energy });

  // Angry: High pitch (200-350 Hz), moderate RMS (> 0.025), moderate energy (> 100)
  if (pitch > 200 && pitch < 350 && rms > 0.025 && energy > 100) {
    return { label: 'angry', score: 0.8 };
  }

  // Fear: Wide pitch range (50-350 Hz), high RMS (> 0.1), high energy (> 1000)
  if (pitch > 50 && pitch < 350 && rms > 0.1 && energy > 1000) {
    return { label: 'fear', score: 0.75 };
  }

  // Happy: Moderate pitch (150-350 Hz), moderate-high RMS (> 0.05), moderate energy (> 200)
  if (pitch > 150 && pitch < 350 && rms > 0.05 && energy > 200) {
    return { label: 'happy', score: 0.7 };
  }

  // Sad: Low to moderate pitch (< 200 Hz), low RMS (< 0.03), low-moderate energy (> 50)
  if (pitch < 200 && rms < 0.03 && energy > 50) {
    return { label: 'sad', score: 0.7 };
  }

  // Disgust: Moderate pitch (150-200 Hz), moderate RMS (0.03-0.05), moderate-high energy (> 300)
  if (pitch > 150 && pitch < 200 && rms > 0.03 && rms < 0.05 && energy > 300) {
    return { label: 'disgust', score: 0.7 };
  }

  return { label: 'neutral', score: 0.6 };
}