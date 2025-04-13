// C:\Users\gugul\Downloads\SOUND-CRAFT-USING-NLP-WITH-FOURIER-TRANFORM-ALGORITHM-main\src\utils\audioProcessor.ts
import { fft } from 'fft-js';
import { debugLog } from './debug';

export class AudioProcessor {
  public analyzeFrequency(audioData: Float32Array, sampleRate: number): { frequencies: number[]; magnitudes: number[] } {
    debugLog('Analyzing frequency', { length: audioData.length });
    const windowedData = this.applyHannWindow(audioData);
    const fftSize = Math.pow(2, Math.floor(Math.log2(audioData.length)));
    const signal = new Float32Array(fftSize);
    signal.set(windowedData.slice(0, fftSize));

    const phasors = fft(signal);
    const frequencies = Array.from({ length: fftSize / 2 }, (_, i) => (i * sampleRate) / fftSize);
    const magnitudes = Array.from({ length: fftSize / 2 }, (_, i) => {
      const re = phasors[i][0];
      const im = phasors[i][1];
      const mag = Math.sqrt(re * re + im * im) / (fftSize / 2);
      return isNaN(mag) ? 0 : mag;
    });

    debugLog('Frequency analysis complete', { freqCount: frequencies.length });
    return { frequencies, magnitudes };
  }

  private applyHannWindow(data: Float32Array): Float32Array {
    const windowed = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) {
      const multiplier = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (data.length - 1)));
      windowed[i] = data[i] * multiplier;
    }
    return windowed;
  }

  public detectPitch(audioData: Float32Array, sampleRate: number): number {
    debugLog('Detecting pitch', { length: audioData.length });
    const { frequencies, magnitudes } = this.analyzeFrequency(audioData, sampleRate);

    const amplifiedMagnitudes = magnitudes.map(m => m * 100000);
    debugLog('Magnitudes amplified', { max: Math.max(...amplifiedMagnitudes) });

    const hps = new Float32Array(frequencies.length);
    for (let i = 0; i < frequencies.length; i++) {
      hps[i] = amplifiedMagnitudes[i];
      if (i * 2 < frequencies.length) hps[i] *= amplifiedMagnitudes[i * 2];
      if (i * 3 < frequencies.length) hps[i] *= amplifiedMagnitudes[i * 3];
    }

    const peaks: { freq: number; value: number }[] = [];
    for (let i = 1; i < hps.length - 1; i++) {
      if (hps[i] > hps[i - 1] && hps[i] > hps[i + 1] && hps[i] > 0.001) {
        peaks.push({ freq: frequencies[i], value: hps[i] });
      }
    }

    peaks.sort((a, b) => b.value - a.value);
    const pitch = peaks.find(p => p.freq >= 50 && p.freq <= 500)?.freq || peaks[0]?.freq || 0;
    debugLog('Pitch detected', { pitch });
    return pitch;
  }

  public getAmplitude(audioData: Float32Array): number {
    const rms = Math.sqrt(audioData.reduce((sum, val) => sum + val * val, 0) / audioData.length);
    const normalized = Math.min(0.5, rms);
    debugLog('Amplitude calculated', { rms, normalized });
    return normalized;
  }

  public calculateClarity(audioData: Float32Array, sampleRate: number): number {
    debugLog('Calculating clarity', { length: audioData.length });
    
    const signalPower = audioData.reduce((sum, val) => sum + val * val, 0) / audioData.length;
    const noiseData = this.reduceNoise(audioData, 50);
    const noisePower = noiseData.reduce((sum, val) => sum + (Math.abs(val) < 0.01 ? val * val : 0), 0) / noiseData.length;
    const snr = signalPower / (noisePower + 1e-10);
    const snrScore = Math.min(1, Math.log10(snr + 1) / 2);

    const { frequencies, magnitudes } = this.analyzeFrequency(audioData, sampleRate);
    const peaks: { freq: number; mag: number }[] = [];
    for (let i = 1; i < magnitudes.length - 1; i++) {
      if (magnitudes[i] > magnitudes[i - 1] && magnitudes[i] > magnitudes[i + 1] && magnitudes[i] > 0.001) {
        peaks.push({ freq: frequencies[i], mag: magnitudes[i] });
      }
    }
    const peakDistances = peaks.slice(1).map((p, i) => Math.abs(p.freq - peaks[i].freq));
    const avgPeakDistance = peakDistances.length > 0 
      ? peakDistances.reduce((sum, d) => sum + d, 0) / peakDistances.length 
      : 0;
    const distinctnessScore = Math.min(1, avgPeakDistance / 1000);

    const clarity = (0.6 * snrScore + 0.4 * distinctnessScore);
    debugLog('Clarity calculated', { clarity });
    return clarity;
  }

  public reduceNoise(audioData: Float32Array, amount: number): Float32Array {
    debugLog('Reducing noise', { amount });
    const result = new Float32Array(audioData.length);
    const energy = Math.sqrt(audioData.reduce((sum, val) => sum + val * val, 0) / audioData.length);
    const threshold = Math.min(0.02, (amount / 100) * energy * 0.5);
    debugLog('Noise reduction threshold', { threshold, energy });

    for (let i = 0; i < audioData.length; i++) {
      result[i] = Math.abs(audioData[i]) < threshold ? audioData[i] * 0.5 : audioData[i];
    }

    debugLog('Noise reduced');
    return result;
  }

  public pitchShift(audioData: Float32Array, semitones: number): Float32Array {
    debugLog('Shifting pitch', { semitones, length: audioData.length });
    if (Math.abs(semitones) < 0.001) {
      debugLog('No pitch shift applied', { semitones });
      return audioData.slice();
    }

    const pitchFactor = Math.pow(2, semitones / 12);
    const outputLength = Math.round(audioData.length / pitchFactor);
    const shiftedData = new Float32Array(outputLength);

    try {
      for (let i = 0; i < outputLength; i++) {
        const srcIndex = i * pitchFactor;
        const floorIndex = Math.floor(srcIndex);
        const frac = srcIndex - floorIndex;

        if (floorIndex + 1 < audioData.length) {
          const sample1 = audioData[floorIndex];
          const sample2 = audioData[floorIndex + 1];
          shiftedData[i] = sample1 + frac * (sample2 - sample1);
        } else if (floorIndex < audioData.length) {
          shiftedData[i] = audioData[floorIndex];
        }
      }

      const energy = Math.sqrt(shiftedData.reduce((sum, val) => sum + val * val, 0) / shiftedData.length);
      debugLog('Pitch shift output energy', { energy });

      if (energy < 1e-6) {
        debugLog('Warning: Pitch shift produced near-silent output');
        return audioData.slice();
      }

      debugLog('Pitch shift complete', { newLength: shiftedData.length });
      return shiftedData;
    } catch (e) {
      debugLog('Pitch shift error', { message: e instanceof Error ? e.message : String(e) });
      return audioData.slice();
    }
  }

  public adjustVolume(audioData: Float32Array, gain: number): Float32Array {
    debugLog('Adjusting volume', { gain });
    const adjusted = new Float32Array(audioData.length);
    const effectiveGain = Math.max(0, Math.min(3, gain)); // Allow 0 to mute
    debugLog('Effective gain applied', { effectiveGain });

    for (let i = 0; i < audioData.length; i++) {
      adjusted[i] = Math.max(-1, Math.min(1, audioData[i] * effectiveGain));
    }

    // Check output energy
    const energy = Math.sqrt(adjusted.reduce((sum, val) => sum + val * val, 0) / adjusted.length);
    debugLog('Volume adjustment energy', { energy });

    debugLog('Volume adjusted');
    return adjusted;
  }
}
