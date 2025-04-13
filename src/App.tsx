// C:\Projects\Lalana\src\App.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { Music, Upload, Play, Pause, Sparkles, Volume2, Wand2, Download, RefreshCw } from 'lucide-react';
import { useAudioAnalyzer } from './hooks/useAudioAnalyzer';
import WaveSurfer from 'wavesurfer.js';
import { debugLog } from './utils/debug';

function App() {
  const {
    audioFile,
    handleFileUpload,
    isPlaying,
    togglePlayback,
    analyzeAudio,
    waveformData,
    spectrumData,
    processedAudio,
    applyEffects,
    audioContext,
    resetEffects,
  } = useAudioAnalyzer();

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<{
    pitch: number;
    amplitude: number;
    phonemes: string[];
    sentiment: { label: string; score: number };
    clarity: number;
    summary: string;
  } | null>(null);
  const [noiseReduction, setNoiseReduction] = useState(50);
  const [pitchShift, setPitchShift] = useState(0);
  const [volume, setVolume] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const waveformRef = useRef<HTMLDivElement>(null);
  const spectrumRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const spectrumSurferRef = useRef<WaveSurfer | null>(null);
  const isMounted = useRef(false);

  const initVisualizers = useCallback(() => {
    debugLog('Initializing visualizers', {
      waveformRef: !!waveformRef.current,
      spectrumRef: !!spectrumRef.current,
    });

    if (!waveformRef.current || !spectrumRef.current) {
      debugLog('Missing ref containers - aborting init');
      return;
    }

    try {
      if (wavesurferRef.current) wavesurferRef.current.destroy();
      wavesurferRef.current = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: '#00ffcc',
        progressColor: '#33ccff',
        height: 100,
        barWidth: 2,
        cursorWidth: 0,
        interact: false,
        normalize: true,
      });

      wavesurferRef.current.on('ready', () => {
        const canvasExists = !!waveformRef.current?.querySelector('canvas');
        debugLog('Waveform ready', {
          duration: wavesurferRef.current?.getDuration(),
          canvas: canvasExists,
          containerHTML: waveformRef.current?.innerHTML.length,
          canvasCount: waveformRef.current?.querySelectorAll('canvas').length,
        });
      });
      wavesurferRef.current.on('error', (err) => {
        debugLog('Wavesurfer error', { message: err.message });
        setError('Waveform display error');
      });
      debugLog('Waveform initialized', {
        params: wavesurferRef.current.getActivePlugins(),
        container: !!waveformRef.current,
      });

      if (spectrumSurferRef.current) spectrumSurferRef.current.destroy();
      spectrumSurferRef.current = WaveSurfer.create({
        container: spectrumRef.current,
        waveColor: '#33ccff',
        height: 100,
        barWidth: 2,
        interact: false,
        normalize: true,
      });

      spectrumSurferRef.current.on('ready', () => {
        const canvasExists = !!spectrumRef.current?.querySelector('canvas');
        debugLog('Spectrum ready', {
          duration: spectrumSurferRef.current?.getDuration(),
          canvas: canvasExists,
          containerHTML: spectrumRef.current?.innerHTML.length,
          canvasCount: spectrumRef.current?.querySelectorAll('canvas').length,
        });
      });
      spectrumSurferRef.current.on('error', (err) => {
        debugLog('Spectrum error', { message: err.message });
        setError('Spectrum display error');
      });
      debugLog('Spectrum initialized', {
        params: spectrumSurferRef.current.getActivePlugins(),
        container: !!spectrumRef.current,
      });
    } catch (e) {
      debugLog('Visualizer init error', { message: e instanceof Error ? e.message : String(e) });
      setError('Failed to initialize visualizers');
    }
  }, []);

  useEffect(() => {
    if (!isMounted.current) {
      requestAnimationFrame(() => {
        initVisualizers();
        isMounted.current = true;
      });
    }

    return () => {
      wavesurferRef.current?.destroy();
      spectrumSurferRef.current?.destroy();
      debugLog('Visualizers destroyed');
    };
  }, [initVisualizers]);

  const audioBufferToBlob = (buffer: AudioBuffer): Blob => {
    const numChannels = buffer.numberOfChannels;
    const length = buffer.length * numChannels * 2 + 44;
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
    view.setUint32(24, buffer.sampleRate, true);
    view.setUint32(28, buffer.sampleRate * numChannels * 2, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, buffer.length * numChannels * 2, true);

    const channelData = buffer.getChannelData(0);
    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }

    const blob = new Blob([view], { type: 'audio/wav' });
    debugLog('Audio buffer converted to blob', { size: blob.size });
    return blob;
  };

  const updateVisualizations = useCallback(async () => {
    debugLog('Updating visualizations', {
      waveformData: !!waveformData,
      spectrumData: !!spectrumData,
      processedAudio: !!processedAudio,
      waveformRef: !!waveformRef.current?.childElementCount,
      spectrumRef: !!spectrumRef.current?.childElementCount,
      audioContext: !!audioContext,
    });

    if (!audioContext || !waveformRef.current || !spectrumRef.current) {
      debugLog('Visualization update skipped - missing dependencies', {
        audioContext: !!audioContext,
        waveformRef: !!waveformRef.current,
        spectrumRef: !!spectrumRef.current,
      });
      return;
    }

    if (!wavesurferRef.current || !spectrumSurferRef.current) {
      debugLog('WaveSurfer instances missing - reinitializing');
      initVisualizers();
      if (!wavesurferRef.current || !spectrumSurferRef.current) return;
    }

    try {
      if (processedAudio) {
        debugLog('Loading processed audio into waveform', { size: processedAudio.size });
        await wavesurferRef.current.loadBlob(processedAudio);
      } else if (waveformData) {
        debugLog('Loading waveform data', { length: waveformData.length });
        const audioBuffer = audioContext.createBuffer(1, waveformData.length, audioContext.sampleRate);
        audioBuffer.getChannelData(0).set(waveformData);
        const blob = audioBufferToBlob(audioBuffer);
        await wavesurferRef.current.loadBlob(blob);
      } else if (audioFile) {
        debugLog('Loading raw audio file', { size: audioFile.size });
        await wavesurferRef.current.loadBlob(audioFile);
      }

      if (spectrumData) {
        debugLog('Loading spectrum data', { length: spectrumData.magnitudes.length });
        const scaledMagnitudes = spectrumData.magnitudes.map((m) => m * 1000);
        const spectrumArray = new Float32Array(scaledMagnitudes);
        const spectrumBuffer = audioContext.createBuffer(1, spectrumArray.length, audioContext.sampleRate);
        spectrumBuffer.getChannelData(0).set(spectrumArray);
        const blob = audioBufferToBlob(spectrumBuffer);
        await spectrumSurferRef.current.loadBlob(blob);
      }
    } catch (e) {
      debugLog('Visualization update error', { message: e instanceof Error ? e.message : String(e) });
      setError('Failed to update visualizations');
    }
  }, [audioFile, processedAudio, waveformData, spectrumData, audioContext, initVisualizers]);

  useEffect(() => {
    if (audioContext) {
      updateVisualizations();
    }
  }, [audioContext, audioFile, processedAudio, waveformData, spectrumData, updateVisualizations]);

  const handleFileUploadWrapper = async (file: File) => {
    try {
      setError(null);
      await handleFileUpload(file);
    } catch (e) {
      debugLog('File upload wrapper error', { message: e instanceof Error ? e.message : String(e) });
      setError('Failed to process audio file. Please try a different file.');
    }
  };

  const handleAnalyze = async () => {
    try {
      setIsAnalyzing(true);
      setError(null);
      const results = await analyzeAudio();
      setAnalysisResults(results);
      await applyEffects(noiseReduction, pitchShift, volume, results.sentiment.label);
    } catch (e) {
      debugLog('Analysis error', { message: e instanceof Error ? e.message : String(e) });
      setError('Failed to analyze audio');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApplyEffects = async () => {
    try {
      setError(null);
      await applyEffects(noiseReduction, pitchShift, volume, analysisResults?.sentiment.label);
    } catch (e) {
      debugLog('Effects error', { message: e instanceof Error ? e.message : String(e) });
      setError('Failed to apply effects');
    }
  };

  const handleResetEffects = async () => {
    try {
      setError(null);
      setNoiseReduction(50);
      setPitchShift(0);
      setVolume(1);
      await resetEffects();
    } catch (e) {
      debugLog('Reset effects error', { message: e instanceof Error ? e.message : String(e) });
      setError('Failed to reset effects');
    }
  };

  const handleExport = () => {
    try {
      if (processedAudio) {
        const url = URL.createObjectURL(processedAudio);
        const a = document.createElement('a');
        a.href = url;
        a.download = `processed_${audioFile?.name || 'audio.wav'}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      debugLog('Export error', { message: e instanceof Error ? e.message : String(e) });
      setError('Failed to export audio');
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <header className="p-6 flex items-center justify-between border-b border-[#2a2a3c]">
        <div className="flex items-center space-x-2">
          <Music className="w-8 h-8 text-[#00ffcc]" />
          <h1 className="text-2xl font-bold bg-gradient-to-r from-[#00ffcc] to-[#33ccff] bg-clip-text text-transparent">
            SoundCraft
          </h1>
        </div>
      </header>

      <main className="container mx-auto p-6">
        {error && (
          <div className="mb-6 p-4 bg-red-900/50 border border-red-500 rounded-lg">
            <p className="text-red-200">{error}</p>
          </div>
        )}

        <div className="grid gap-6 mb-8">
          <div className="h-48 bg-[#1a1a2e] rounded-lg p-4">
            <h3 className="text-[#00ffcc] mb-2">Waveform</h3>
            <div key="waveform" ref={waveformRef} className="h-32"></div>
            {!audioFile && <p className="text-gray-500 text-center">Upload audio to visualize</p>}
          </div>

          <div className="h-48 bg-[#1a1a2e] rounded-lg p-4">
            <h3 className="text-[#33ccff] mb-2">Frequency Spectrum</h3>
            <div key="spectrum" ref={spectrumRef} className="h-32"></div>
            {!audioFile && <p className="text-gray-500 text-center">Upload audio to visualize</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-[#1a1a2e] rounded-lg p-6">
            <h3 className="text-xl mb-4 text-[#00ffcc]">Input</h3>
            <input
              type="file"
              accept=".wav,.mp3,.ogg,.aac"
              onChange={(e) => e.target.files?.[0] && handleFileUploadWrapper(e.target.files[0])}
              className="hidden"
              id="audio-upload"
            />
            <label
              htmlFor="audio-upload"
              className="flex items-center space-x-2 bg-[#2a2a3c] hover:bg-[#3a3a4c] px-4 py-2 rounded-lg transition-all duration-300 cursor-pointer mb-4"
            >
              <Upload className="w-5 h-5 text-[#00ffcc]" />
              <span>Upload File</span>
            </label>

            <button
              onClick={handleExport}
              disabled={!processedAudio}
              className="flex items-center space-x-2 bg-[#2a2a3c] hover:bg-[#3a3a4c] px-4 py-2 rounded-lg transition-all duration-300 disabled:opacity-50 w-full"
            >
              <Download className="w-5 h-5 text-[#33ccff]" />
              <span>Export Processed Audio</span>
            </button>
          </div>

          <div className="bg-[#1a1a2e] rounded-lg p-6">
            <h3 className="text-xl mb-4 text-[#33ccff]">Playback</h3>
            <button
              onClick={togglePlayback}
              disabled={!audioFile && !processedAudio}
              className="flex items-center space-x-2 bg-[#2a2a3c] hover:bg-[#3a3a4c] px-4 py-2 rounded-lg transition-all duration-300 disabled:opacity-50 mb-4 w-full"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 text-[#00ffcc]" />
              ) : (
                <Play className="w-5 h-5 text-[#00ffcc]" />
              )}
              <span>{isPlaying ? 'Pause' : 'Play'}</span>
            </button>

            <button
              onClick={handleAnalyze}
              disabled={!audioFile || isAnalyzing}
              className="flex items-center space-x-2 bg-[#2a2a3c] hover:bg-[#3a3a4c] px-4 py-2 rounded-lg transition-all duration-300 disabled:opacity-50 w-full"
            >
              <Sparkles className={`w-5 h-5 text-[#00ffcc] ${isAnalyzing ? 'animate-spin' : ''}`} />
              <span>{isAnalyzing ? 'Analyzing...' : 'Analyze Audio'}</span>
            </button>
          </div>
        </div>

        <div className="bg-[#1a1a2e] rounded-lg p-6 mb-8">
          <h3 className="text-xl mb-6 text-[#00ffcc]">Audio Effects</h3>
          <div className="grid gap-6">
            <div className="space-y-2">
              <label className="flex items-center text-sm">
                <Volume2 className="w-4 h-4 mr-2 text-[#33ccff]" />
                Noise Reduction: {noiseReduction}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={noiseReduction}
                onChange={(e) => setNoiseReduction(parseInt(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none bg-[#2a2a3c] cursor-pointer"
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center text-sm">
                <Wand2 className="w-4 h-4 mr-2 text-[#33ccff]" />
                Pitch Shift: {pitchShift > 0 ? `+${pitchShift}` : pitchShift} semitones
              </label>
              <input
                type="range"
                min="-12"
                max="12"
                value={pitchShift}
                onChange={(e) => setPitchShift(parseInt(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none bg-[#2a2a3c] cursor-pointer"
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center text-sm">
                <Volume2 className="w-4 h-4 mr-2 text-[#33ccff]" />
                Volume: {(volume * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none bg-[#2a2a3c] cursor-pointer"
              />
            </div>
            <div className="flex space-x-4">
              <button
                onClick={handleApplyEffects}
                disabled={!audioFile}
                className="flex items-center space-x-2 bg-[#2a2a3c] hover:bg-[#3a3a4c] px-4 py-2 rounded-lg transition-all duration-300 disabled:opacity-50 flex-1"
              >
                <Sparkles className="w-5 h-5 text-[#00ffcc]" />
                <span>Apply Effects</span>
              </button>
              <button
                onClick={handleResetEffects}
                disabled={!audioFile}
                className="flex items-center space-x-2 bg-[#2a2a3c] hover:bg-[#3a3a4c] px-4 py-2 rounded-lg transition-all duration-300 disabled:opacity-50 flex-1"
              >
                <RefreshCw className="w-5 h-5 text-[#00ffcc]" />
                <span>Reset Effects</span>
              </button>
            </div>
          </div>
        </div>

        {analysisResults && (
          <div className="bg-[#1a1a2e] rounded-lg p-6">
            <h3 className="text-xl mb-6 text-[#33ccff]">Analysis Results</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-[#2a2a3c] p-4 rounded-lg">
                <h4 className="text-sm text-gray-400 mb-2">Dominant Pitch</h4>
                <p className="text-2xl font-bold text-[#00ffcc]">
                  {analysisResults.pitch.toFixed(2)} Hz
                </p>
              </div>
              <div className="bg-[#2a2a3c] p-4 rounded-lg">
                <h4 className="text-sm text-gray-400 mb-2">Amplitude</h4>
                <p className="text-2xl font-bold text-[#00ffcc]">
                  {(analysisResults.amplitude * 100).toFixed(2)}%
                </p>
              </div>
              <div className="bg-[#2a2a3c] p-4 rounded-lg">
                <h4 className="text-sm text-gray-400 mb-2">Speech Clarity</h4>
                <p className="text-2xl font-bold text-[#00ffcc]">
                  {(analysisResults.clarity * 100).toFixed(0)}%
                </p>
                <p className="text-sm text-gray-400">
                  {analysisResults.clarity > 0.8 ? 'Confident speech' : 'Moderate clarity'}
                </p>
              </div>
              <div className="bg-[#2a2a3c] p-4 rounded-lg">
                <h4 className="text-sm text-gray-400 mb-2">Detected Phonemes</h4>
                <div className="flex flex-wrap gap-2">
                  {analysisResults.phonemes.length > 0 ? (
                    analysisResults.phonemes.map((p, i) => (
                      <span key={i} className="px-2 py-1 bg-[#1a1a2e] rounded text-[#33ccff]">
                        {p}
                      </span>
                    ))
                  ) : (
                    <span className="text-gray-500">None detected</span>
                  )}
                </div>
              </div>
              <div className="bg-[#2a2a3c] p-4 rounded-lg">
                <h4 className="text-sm text-gray-400 mb-2">Sentiment</h4>
                <p className="text-2xl font-bold text-[#00ffcc] capitalize">
                  {analysisResults.sentiment.label}
                </p>
                <p className="text-sm text-gray-400">
                  {(analysisResults.sentiment.score * 100).toFixed(1)}% confidence
                </p>
              </div>
              <div className="bg-[#2a2a3c] p-4 rounded-lg">
                <h4 className="text-sm text-gray-400 mb-2">Summary</h4>
                <p className="text-lg text-[#00ffcc]">{analysisResults.summary}</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;