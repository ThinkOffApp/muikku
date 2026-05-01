export class AudioManager {
    private audioCtx: AudioContext | null = null;
    private analyser: AnalyserNode | null = null;
    private source: MediaStreamAudioSourceNode | null = null;
    private dataArray: Uint8Array | null = null;
    private isRunning: boolean = false;

    constructor() {
        // Lazy init
    }

    async start() {
        if (this.isRunning) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            this.analyser = this.audioCtx.createAnalyser();
            this.analyser.fftSize = 512; // 256 freq bins

            this.source = this.audioCtx.createMediaStreamSource(stream);
            this.source.connect(this.analyser);

            const bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(bufferLength);
            this.isRunning = true;
        } catch (err) {
            console.error("Error accessing microphone:", err);
        }
    }

    stop() {
        if (this.source) {
            this.source.mediaStream.getTracks().forEach(t => t.stop());
            this.source.disconnect();
        }
        if (this.audioCtx) {
            this.audioCtx.close();
        }
        this.isRunning = false;
        this.audioCtx = null;
        this.analyser = null;
    }

    // Returns normalized 0..1 values for 4 bands (Bass, Low-Mid, High-Mid, Treble)
    getFeatures(): [number, number, number, number] {
        if (!this.analyser || !this.dataArray) return [0, 0, 0, 0];

        this.analyser.getByteFrequencyData(this.dataArray as any);

        // Simple averaging of bins
        // const binCount = this.analyser.frequencyBinCount;
        // const quarter = Math.floor(binCount / 4);

        const getAvg = (start: number, end: number) => {
            let sum = 0;
            for (let i = start; i < end; i++) {
                sum += this.dataArray![i];
            }
            return (sum / (end - start)) / 255;
        };

        const b1 = getAvg(0, 4); // Deep Bass (very low index)
        const b2 = getAvg(4, 16); // Bass
        const b3 = getAvg(16, 64); // Mids
        const b4 = getAvg(64, 128); // Highs

        return [b1, b2, b3, b4];
    }

    // Total energy (0..1)
    getEnergy(): number {
        if (!this.analyser || !this.dataArray) return 0;
        // Optimization: utilize the loop above if performance needed
        const features = this.getFeatures();
        return (features[0] + features[1] + features[2] + features[3]) / 4;
    }
}

export const audioManager = new AudioManager();
