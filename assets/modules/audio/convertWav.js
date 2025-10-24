//修改自以下项目 感谢
//这玩意太难了
//https://github.com/eshaz/wasm-audio-decoders/blob/main/demo/index.html
function floatToInt(val) { 
    return val > 0 ? Math.min(val * 32767, 32767) : Math.max(val * 32767, -32768) 
};
function getInterleaved(channelData, samples){
    const interleaved = new Int16Array(samples * channelData.length);
    for (
        let offset = 0, interleavedOffset = 0;
        offset < samples;
        offset++
    ) {
        for (let channel = 0; channel < channelData.length; channel++) {
            interleaved[interleavedOffset++] = floatToInt(
                channelData[channel][offset],
            );
        }
    }
    return new Uint8Array(interleaved.buffer);
};
function stringToUint8Array(string) {
    const buf = new Uint8Array(string.length);
    for (let i = 0; i < string.length; i++) buf[i] = string.charCodeAt(i);
    return buf;
};
function generateHeader({dataLength,channels,sampleRate,bitDepth}) {
    const RIFF = stringToUint8Array("RIFF");
    const WAVE = stringToUint8Array("WAVE");
    const fmt = stringToUint8Array("fmt ");
    const data = stringToUint8Array("data");
    const format = 1; // raw PCM
    const headerLength = 44;
    const fileSize = dataLength + headerLength;
    const header = new Uint8Array(headerLength);
    const headerView = new DataView(header.buffer);
    let offset = 0;
    header.set(RIFF, offset);
    offset += RIFF.length;
    headerView.setInt32(offset, fileSize - 8, true);
    offset += 4;
    header.set(WAVE, offset);
    offset += WAVE.length;
    header.set(fmt, offset);
    offset += fmt.length;
    // Write the size of the "fmt " chunk.
    // Value of 16 is hard-coded for raw PCM format. other formats have different size.
    headerView.setUint32(offset, 16, true);
    offset += 4;
    headerView.setUint16(offset, format, true);
    offset += 2;
    headerView.setUint16(offset, channels, true);
    offset += 2;
    headerView.setUint32(offset, sampleRate, true);
    offset += 4;
    const byteRate = (sampleRate * channels * bitDepth) / 8;
    headerView.setUint32(offset, byteRate, true);
    offset += 4;
    const blockAlign = (channels * bitDepth) / 8;
    headerView.setUint16(offset, blockAlign, true);
    offset += 2;
    headerView.setUint16(offset, bitDepth, true);
    offset += 2;
    header.set(data, offset);
    offset += data.length;
    headerView.setUint32(offset, dataLength, true);
    offset += 4;
    return header;
};
function encodeToWav(channelData, sampleRate, samplesDecoded) {
    const interleaved = getInterleaved(channelData, samplesDecoded);
    const waveHeader = generateHeader({
        dataLength: interleaved.length * Int16Array.BYTES_PER_ELEMENT,
        channels: channelData.length,
        sampleRate,
        bitDepth: 16,
    });
    const decoded = new Uint8Array(
        waveHeader.length + interleaved.length,
    );
    decoded.set(waveHeader);
    decoded.set(interleaved, waveHeader.length);
    return decoded;
};