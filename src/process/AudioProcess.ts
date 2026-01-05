import Speaker from "speaker";
import dgram from "dgram";
let socket: dgram.Socket;
let speaker: Speaker;
process.once("SIGINT", () => {
    socket?.close();
    speaker?.close(true);
    process.exit(0);
})
const deviceAddress = process.argv[process.argv.length - 1];
(async () => {
    const opusImport = await import("opus-decoder");
    const decoder = new opusImport.OpusDecoder({ channels: 2, sampleRate: 48000 });
    await decoder.ready;

    const sampleRate = 48000;
    const channels = 2;
    const bytesPerSample = 2;
    const bytesPerSecond = sampleRate * channels * bytesPerSample; // 192000
    const targetBufferedBytes = Math.floor(bytesPerSecond * 0.08); // ~80ms (含 speaker 内部缓冲)
    const maxBufferedBytes = Math.floor(bytesPerSecond * 0.18); // ~180ms (含 speaker 内部缓冲)

    const magic = 0x41463031; // "AF01"
    const headerSize = 4 + 4 + 8; // magic + seq + ptsUs

    let lastSeq = -1;
    let queuedBytes = 0;
    let dropping = false;
    const pcmQueue: Buffer[] = [];
    let waitingDrain = false;

    const speakerOptions = {
        bitDepth: 16,
        channels,
        sampleRate,
        samplesPerFrame: 480,
        highWaterMark: Math.floor(bytesPerSecond * 0.04), // ~40ms
    } satisfies Speaker.Options & { samplesPerFrame?: number };

    speaker = new Speaker(speakerOptions);

    const totalBufferedBytes = () => queuedBytes + speaker.writableLength;

    const updateDroppingState = () => {
        const total = totalBufferedBytes();
        if (dropping) {
            if (total <= targetBufferedBytes) dropping = false;
        } else {
            if (total > maxBufferedBytes) dropping = true;
        }
    };

    const trimQueueIfNeeded = () => {
        while (pcmQueue.length > 0 && totalBufferedBytes() > targetBufferedBytes) {
            const dropped = pcmQueue.shift()!;
            queuedBytes -= dropped.length;
        }
    };

    const pump = () => {
        if (waitingDrain) return;
        while (pcmQueue.length > 0) {
            const chunk = pcmQueue.shift()!;
            queuedBytes -= chunk.length;
            const ok = speaker.write(chunk);
            if (!ok) {
                waitingDrain = true;
                speaker.once("drain", () => {
                    waitingDrain = false;
                    pump();
                });
                return;
            }
        }
    };

    socket = dgram.createSocket("udp4").bind(8899);
    //TODO 加密
    socket.on("message", (data, remoteInfo) => {
        if (remoteInfo.address !== deviceAddress) {
            //拒绝来自其他设备的包
            return
        }
        try {
            updateDroppingState();
            if (dropping) {
                trimQueueIfNeeded();
                updateDroppingState();
                if (dropping) return;
            }

            let payload = data;
            if (data.length >= headerSize && data.readUInt32BE(0) === magic) {
                const seq = data.readInt32BE(4);
                if (seq === 0 && lastSeq > 1000) lastSeq = -1;
                if (seq <= lastSeq) return;
                lastSeq = seq;
                payload = data.subarray(headerSize);
            }

            const result = decoder.decodeFrame(payload);
            const mergedBuffer = mergeStereoChannels(result.channelData[0], result.channelData[1]);
            pcmQueue.push(mergedBuffer);
            queuedBytes += mergedBuffer.length;
            trimQueueIfNeeded();
            pump();
        } catch (error) {
            console.error("Decode error:", error);
        }
    })
})();
function mergeStereoChannels(leftChannel: Buffer | Float32Array, rightChannel: Buffer | Float32Array, sampleSize: number = 2): Buffer {
    if (leftChannel instanceof Float32Array && rightChannel instanceof Float32Array) {
        const samples = Math.min(leftChannel.length, rightChannel.length);
        const stereoBuffer = Buffer.allocUnsafe(samples * 2 * 2);
        const out = new Int16Array(stereoBuffer.buffer, stereoBuffer.byteOffset, samples * 2);
        let o = 0;
        for (let i = 0; i < samples; i++) {
            const l = Math.max(-1, Math.min(1, leftChannel[i]));
            const r = Math.max(-1, Math.min(1, rightChannel[i]));
            out[o++] = Math.round(l < 0 ? l * 32768 : l * 32767);
            out[o++] = Math.round(r < 0 ? r * 32768 : r * 32767);
        }
        return stereoBuffer;
    }
    const leftBuf = leftChannel as Buffer;
    const rightBuf = rightChannel as Buffer;
    const leftSamples = leftBuf.length / sampleSize;
    const rightSamples = rightBuf.length / sampleSize;
    const samples = Math.min(leftSamples, rightSamples);
    const stereoBuffer = Buffer.allocUnsafe(samples * 2 * sampleSize);
    if (sampleSize === 2) {
        for (let i = 0; i < samples; i++) {
            const leftSample = leftBuf.readInt16LE(i * 2);
            const rightSample = rightBuf.readInt16LE(i * 2);
            stereoBuffer.writeInt16LE(leftSample, (i * 2) * 2);
            stereoBuffer.writeInt16LE(rightSample, (i * 2 + 1) * 2);
        }
    } else if (sampleSize === 4) {
        for (let i = 0; i < samples; i++) {
            const leftSample = leftBuf.readFloatLE(i * 4);
            const rightSample = rightBuf.readFloatLE(i * 4);
            stereoBuffer.writeFloatLE(leftSample, (i * 2) * 4);
            stereoBuffer.writeFloatLE(rightSample, (i * 2 + 1) * 4);
        }
    } else if (sampleSize === 1) {
        for (let i = 0; i < samples; i++) {
            const leftSample = leftBuf.readUInt8(i);
            const rightSample = rightBuf.readUInt8(i);
            stereoBuffer.writeUInt8(leftSample, i * 2);
            stereoBuffer.writeUInt8(rightSample, i * 2 + 1);
        }
    }
    return stereoBuffer;
}
