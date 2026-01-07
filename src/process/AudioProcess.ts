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
    const bytesPerSecondBig = BigInt(bytesPerSecond);

    // 目标延迟更偏保守，优先避免爆音；如需更低可再下调
    const targetLeadUs = 60_000n;
    const maxLeadUs = 120_000n;
    const playoutDelayUs = targetLeadUs;
    const lateDropUs = 80_000n;

    const targetLeadBytes = (bytesPerSecondBig * targetLeadUs) / 1_000_000n;
    const maxLeadBytes = (bytesPerSecondBig * maxLeadUs) / 1_000_000n;

    // 还未提交到 speaker 的队列尽量保持很短，避免“排队变成延迟”
    const targetQueueBytes = (bytesPerSecondBig * 30_000n) / 1_000_000n;
    const maxQueueBytes = (bytesPerSecondBig * 70_000n) / 1_000_000n;

    const magic = 0x41463032; // "AF02"
    const tagSize = 16;
    const headerSize = 4 + 4 + 8 + 8; // magic + seq + ptsUs + nonceCtr

    let lastSeq = -1;

    type PcmFrame = { pcm: Buffer; playAtUs: bigint };
    const pcmQueue: PcmFrame[] = [];
    let queuedBytes = 0n;

    let waitingDrain = false;
    let playbackStartUs: bigint | null = null;
    let submittedBytes = 0n;

    let ptsBaseUs: bigint | null = null;
    let localBaseUs: bigint | null = null;

    const speakerOptions = {
        bitDepth: 16,
        channels,
        sampleRate,
        // 和 48kHz、20ms (960 samples) 对齐，避免 speaker 内部切块造成额外堆积
        samplesPerFrame: 960,
        // 让 Node stream 的背压更敏感一些，减少一次性灌入过多数据
        highWaterMark: Math.floor(bytesPerSecond * 0.02), // ~20ms
    } satisfies Speaker.Options & { samplesPerFrame?: number };

    speaker = new Speaker(speakerOptions);

    const nowUs = () => process.hrtime.bigint() / 1000n;

    const estimatePlayedBytes = () => {
        if (playbackStartUs == null) return 0n;
        const elapsedUs = nowUs() - playbackStartUs;
        if (elapsedUs <= 0n) return 0n;
        return (elapsedUs * bytesPerSecondBig) / 1_000_000n;
    };

    const leadBytes = () => {
        const played = estimatePlayedBytes();
        return submittedBytes > played ? submittedBytes - played : 0n;
    };

    const totalBufferedBytes = () => leadBytes() + queuedBytes;

    const trimQueueIfNeeded = () => {
        while (pcmQueue.length > 0 && queuedBytes > maxQueueBytes) {
            const dropped = pcmQueue.shift()!;
            queuedBytes -= BigInt(dropped.pcm.length);
        }
        while (pcmQueue.length > 0 && queuedBytes > targetQueueBytes && leadBytes() >= targetLeadBytes) {
            const dropped = pcmQueue.shift()!;
            queuedBytes -= BigInt(dropped.pcm.length);
        }
    };

    const dropLateFramesIfNeeded = () => {
        const now = nowUs();
        while (pcmQueue.length > 0) {
            const head = pcmQueue[0]!;
            if (now <= head.playAtUs + lateDropUs) break;
            const dropped = pcmQueue.shift()!;
            queuedBytes -= BigInt(dropped.pcm.length);
        }
    };

    const scheduleFromPts = (ptsUs: bigint) => {
        const now = nowUs();
        if (ptsBaseUs != null && ptsUs < ptsBaseUs) {
            ptsBaseUs = null;
            localBaseUs = null;
        }
        if (ptsBaseUs == null || localBaseUs == null) {
            ptsBaseUs = ptsUs;
            localBaseUs = now;
        }
        return localBaseUs + (ptsUs - ptsBaseUs) + playoutDelayUs;
    };

    const prebufferBytes = (bytesPerSecondBig * 40_000n) / 1_000_000n; // ~40ms

    const tryFeedSpeaker = () => {
        if (waitingDrain) return;

        trimQueueIfNeeded();
        dropLateFramesIfNeeded();

        if (playbackStartUs == null) {
            if (queuedBytes < prebufferBytes) return;
            playbackStartUs = nowUs();
            submittedBytes = 0n;
        }

        let currentLead = leadBytes();
        while (pcmQueue.length > 0 && currentLead < targetLeadBytes) {
            const frame = pcmQueue.shift()!;
            queuedBytes -= BigInt(frame.pcm.length);

            // 如果已经明显落后于计划播放时间，直接丢掉该帧避免把延迟“听出来”
            if (nowUs() > frame.playAtUs + lateDropUs) {
                continue;
            }

            const ok = speaker.write(frame.pcm);
            submittedBytes += BigInt(frame.pcm.length);
            currentLead = leadBytes();

            if (!ok) {
                waitingDrain = true;
                speaker.once("drain", () => {
                    waitingDrain = false;
                    tryFeedSpeaker();
                });
                return;
            }

            // 如果后端已领先太多，停止继续写入，等待播放追上
            if (currentLead > maxLeadBytes) return;
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
            if (data.length < headerSize + tagSize) return;
            if (data.readUInt32BE(0) !== magic) return;

            const seq = data.readInt32BE(4);
            if (seq === 0 && lastSeq > 1000) {
                lastSeq = -1;
                ptsBaseUs = null;
                localBaseUs = null;
                playbackStartUs = null;
                submittedBytes = 0n;
                queuedBytes = 0n;
                pcmQueue.length = 0;
            }
            if (seq <= lastSeq) return;

            const ptsUs = data.readBigInt64BE(8);

            const payload = decryptPayload(data);
            if (!payload) return;
            lastSeq = seq;

            const result = decoder.decodeFrame(payload);
            const mergedBuffer = mergeStereoChannels(result.channelData[0], result.channelData[1]);
            pcmQueue.push({ pcm: mergedBuffer, playAtUs: scheduleFromPts(ptsUs) });
            queuedBytes += BigInt(mergedBuffer.length);
            tryFeedSpeaker();
        } catch (error) {
            console.error("Decode error:", error);
        }
    })

    // 定时限速喂入，避免一次性灌满音频后端造成 300ms+ 延迟
    setInterval(tryFeedSpeaker, 5);
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
