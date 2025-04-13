// C:\Projects\Lalana\src\utils\audioProcessor.ts
import { fft, ifft } from 'fft-js';
import { debugLog } from './debug';

export class AudioProcessor {
  public analyzeFrequency(audioData: Float32Array, sampleRate: number): { frequencies: number[]; magnitudes: number[] } {
    debugLog('Analyzing frequency', { length: audioData.length, sampleRate });
    const windowedData = this.applyHannWindow(audioData);
    const fftSize = Math.pow(2, Math.floor(Math.log2(audioData.length)));
    const signal = new Float32Array(fftSize);
    signal.set(windowedData.slice(0, fftSize));

    // Convert Float32Array to number[] for fft-js
    const signalArray = Array.from(signal);
    const phasors = fft(signalArray);
    const frequencies = Array.from({ length: fftSize / 2 }, (_, i) => (i * sampleRate) / fftSize);
    const magnitudes = Array.from({ length: fftSize / 2 }, (_, i) => {
      const re = phasors[i][0];
      const im = phasors[i][1];
      const mag = Math.sqrt(re * re + im * im) / (fftSize / 2);
      return isNaN(mag) ? 0 : mag;
    });

    debugLog('Frequency analysis complete', { freqCount: frequencies.length, magMax: Math.max(...magnitudes) });
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

    const amplifiedMagnitudes = magnitudes.map((m) => m * 100000);
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
    const pitch = peaks.find((p) => p.freq >= 50 && p.freq <= 500)?.freq || peaks[0]?.freq || 0;
    debugLog('Pitch detected', { pitch, peaks: peaks.slice(0, 5) });
    return pitch;
  }

  public getAmplitude(audioData: Float32Array): number {
    const rms = Math.sqrt(audioData.reduce((sum, val) => sum + val * val, 0) / audioData.length);
    const normalized = Math.min(1, rms / 0.5);
    debugLog('Amplitude calculated', { rms, normalized });
    return normalized;
  }

  public calculateClarity(audioData: Float32Array, sampleRate: number): number {
    debugLog('Calculating clarity', { length: audioData.length, sampleRate });

    // SNR: Signal power vs. noise floor
    const signalPower = audioData.reduce((sum, val) => sum + val * val, 0) / audioData.length;
    const noiseData = this.reduceNoise(audioData, 50);
    const noisePower = noiseData.reduce((sum, val) => sum + (Math.abs(val) < 0.01 ? val * val : 0), 0) / noiseData.length;
    const snr = signalPower / (noisePower + 1e-10); // Avoid division by zero
    const snrScore = Math.min(1, Math.log10(snr + 1) / 2); // Normalize to 0-1

    // Phoneme distinctness: Frequency peak separation
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
    const distinctnessScore = Math.min(1, avgPeakDistance / 1000); // Normalize based on typical phoneme separation

    const clarity = 0.6 * snrScore + 0.4 * distinctnessScore; // Weighted average
    debugLog('Clarity calculated', { snrScore, distinctnessScore, clarity });
    return clarity;
  }

  public reduceNoise(audioData: Float32Array, amount: number): Float32Array {
    debugLog('Reducing noise', { amount });
    const result = new Float32Array(audioData.length);
    const threshold = (amount / 100) * 0.1;
    const statsBefore = {
      min: Math.min(...audioData),
      max: Math.max(...audioData),
      avg: audioData.reduce((a, b) => a + b, 0) / audioData.length,
    };
    debugLog('Before noise reduction', statsBefore);

    for (let i = 0; i < audioData.length; i++) {
      result[i] = Math.abs(audioData[i]) < threshold ? 0 : audioData[i];
    }

    const statsAfter = {
      min: Math.min(...result),
      max: Math.max(...result),
      avg: result.reduce((a, b) => a + b, 0) / result.length,
    };
    debugLog('Noise reduced', statsAfter);
    return result;
  }

  public pitchShift(audioData: Float32Array, semitones: number, sampleRate: number): Float32Array {
    debugLog('Shifting pitch', { semitones });
    if (semitones === 0) return audioData.slice();

    const shiftFactor = Math.pow(2, semitones / 12);
    const windowSize = 2048; // Increased for better quality
    const hopSize = windowSize / 8; // More overlap for smoother transitions
    const outputLength = Math.floor(audioData.length / shiftFactor);
    const shiftedData = new Float32Array(outputLength);
    let phase = new Float32Array(windowSize / 2 + 1);

    try {
      for (let i = 0; i < outputLength; i += hopSize) {
        const start = Math.min(Math.floor(i * shiftFactor), audioData.length - windowSize);
        if (start < 0) continue;

        const window = audioData.slice(start, start + windowSize);
        const windowed = this.applyHannWindow(window.length < windowSize ? new Float32Array(windowSize) : window);
        // Convert to number[] for fft-js
        const windowedArray = Array.from(windowed);
        const phasors = fft(windowedArray);

        const magnitudes = new Float32Array(windowSize / 2 + 1);
        for (let j = 0; j < magnitudes.length; j++) {
          const re = phasors[j]?.[0] || 0;
          const im = phasors[j]?.[1] || 0;
          magnitudes[j] = Math.sqrt(re * re + im * im);
        }

        const shiftedPhasors = Array.from({ length: windowSize }, () => [0, 0]);
        for (let j = 0; j < magnitudes.length; j++) {
          const freqShift = (j * sampleRate) / windowSize * (shiftFactor - 1);
          phase[j] += (freqShift * 2 * Math.PI) / sampleRate;
          shiftedPhasors[j][0] = magnitudes[j] * Math.cos(phase[j]);
          shiftedPhasors[j][1] = magnitudes[j] * Math.sin(phase[j]);
        }

        const outputPhasors = ifft(shiftedPhasors);
        // Convert complex numbers to real values
        for (let j = 0; j < hopSize && i + j < outputLength; j++) {
          shiftedData[i + j] += (outputPhasors[j][0] || 0) / windowSize;
        }
      }

      // Normalize output to prevent amplitude artifacts
      const maxAmplitude = Math.max(...shiftedData.map(Math.abs));
      if (maxAmplitude > 0) {
        for (let i = 0; i < shiftedData.length; i++) {
          shiftedData[i] = shiftedData[i] / maxAmplitude * 0.95; // Slight headroom
        }
      }
    } catch (e) {
      debugLog('Pitch shift error', { message: e instanceof Error ? e.message : String(e) });
      throw new Error('Failed to apply pitch shift');
    }

    debugLog('Pitch shift complete', { newLength: shiftedData.length });
    return shiftedData;
  }

  public adjustVolume(audioData: Float32Array, gain: number): Float32Array {
    debugLog('Adjusting volume', { gain });
    const adjusted = new Float32Array(audioData.length);
    const statsBefore = {
      min: Math.min(...audioData),
      max: Math.max(...audioData),
      avg: audioData.reduce((a, b) => a + b, 0) / audioData.length,
    };
    debugLog('Before volume adjust', statsBefore);

    for (let i = 0; i < audioData.length; i++) {
      const sample = audioData[i] * gain;
      // Clamp to [-1, 1] to prevent clipping
      adjusted[i] = Math.max(-1, Math.min(1, sample));
    }

    const statsAfter = {
      min: Math.min(...adjusted),
      max: Math.max(...adjusted),
      avg: adjusted.reduce((a, b) => a + b, 0) / adjusted.length,
    };
    debugLog('Volume adjusted', statsAfter);
    return adjusted;
  }
}