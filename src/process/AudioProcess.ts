import Speaker from "speaker";
import dgram from "dgram";
import crypto from "crypto";
let socket: dgram.Socket;
let speaker: Speaker;
process.once("SIGINT", () => {
    socket?.close();
    speaker?.close(true);
    process.exit(0);
})
const deviceAddress = process.argv[process.argv.length - 3];
const key = Buffer.from(process.argv[process.argv.length - 2],"base64");
const iv = Buffer.from(process.argv[process.argv.length - 1],"base64");
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

    const magic = 0x41463032; // "AF02"
    const tagSize = 16;
    const headerSize = 4 + 4 + 8 + 8; // magic + seq + ptsUs + nonceCtr

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

    const buildNonce = (baseIv: Buffer, nonceCtr: bigint): Buffer => {
        const nonce = Buffer.allocUnsafe(12);
        baseIv.copy(nonce, 0, 0, 12);
        for (let i = 0; i < 8; i++) {
            const shift = 56n - BigInt(i) * 8n;
            const b = Number((nonceCtr >> shift) & 0xFFn);
            nonce[4 + i] = nonce[4 + i] ^ b;
        }
        return nonce;
    };

    const decryptPayload = (packet: Buffer): Buffer | null => {
        if (packet.length < headerSize + tagSize) return null;
        if (packet.readUInt32BE(0) !== magic) return null;

        const nonceCtr = packet.readBigUInt64BE(16);
        const nonce = buildNonce(iv, nonceCtr);
        const aad = packet.subarray(0, headerSize);
        const ciphertext = packet.subarray(headerSize, packet.length - tagSize);
        if (ciphertext.length <= 0) return null;
        const tag = packet.subarray(packet.length - tagSize);

        try {
            const decipher = crypto.createDecipheriv("aes-128-gcm", key, nonce);
            decipher.setAAD(aad);
            decipher.setAuthTag(tag);
            const part1 = decipher.update(ciphertext);
            const part2 = decipher.final();
            return part2.length ? Buffer.concat([part1, part2]) : part1;
        } catch {
            return null;
        }
    };

    socket = dgram.createSocket("udp4").bind(26010);
    socket.on("message", (data, remoteInfo) => {
        //拒绝来自其他设备的包
        if (remoteInfo.address !== deviceAddress) return
        try {
            updateDroppingState();
            if (dropping) {
                trimQueueIfNeeded();
                updateDroppingState();
                if (dropping) return;
            }

            if (data.length < headerSize + tagSize) return;
            if (data.readUInt32BE(0) !== magic) return;

            const seq = data.readInt32BE(4);
            if (seq === 0 && lastSeq > 1000) lastSeq = -1;
            if (seq <= lastSeq) return;

            const payload = decryptPayload(data);
            if (!payload) return;
            lastSeq = seq;

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
