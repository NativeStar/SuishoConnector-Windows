import Speaker from "speaker";
import dgram from "dgram";
let socket: dgram.Socket;
let speaker: Speaker;
process.once("SIGINT", () => {
    socket.close();
    speaker.close(true);
    process.exit(0);
})
const deviceAddress = process.argv[process.argv.length - 1];
(async () => {
    const opusImport = await import("opus-decoder");
    const decoder = new opusImport.OpusDecoder({ channels: 2, sampleRate: 48000 });
    await decoder.ready;
    speaker = new Speaker({ bitDepth: 16, channels: 2, sampleRate: 48000 });
    socket = dgram.createSocket("udp4").bind(8899);
    //TODO 加密
    socket.on("message", (data, remoteInfo) => {
        if (remoteInfo.address !== deviceAddress) {
            //拒绝来自其他设备的包
            return
        }
        try {
            const result = decoder.decodeFrame(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
            const mergedBuffer = mergeStereoChannels(result.channelData[0], result.channelData[1]);
            speaker.write(mergedBuffer)
        } catch (error) {
            console.error("Decode error:", error);
        }
    })
})();
function mergeStereoChannels(leftChannel: Buffer | Float32Array, rightChannel: Buffer | Float32Array, sampleSize: number = 2): Buffer {
    if (leftChannel instanceof Float32Array && rightChannel instanceof Float32Array) {
        const samples = Math.min(leftChannel.length, rightChannel.length);
        const stereoBuffer = Buffer.allocUnsafe(samples * 2 * 2);
        for (let i = 0; i < samples; i++) {
            const leftSample = Math.round(Math.max(-1, Math.min(1, leftChannel[i])) * 32767);
            const rightSample = Math.round(Math.max(-1, Math.min(1, rightChannel[i])) * 32767);
            stereoBuffer.writeInt16LE(leftSample, (i * 2) * 2);
            stereoBuffer.writeInt16LE(rightSample, (i * 2 + 1) * 2);
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