class RemoteAudio extends AudioWorkletProcessor {
    constructor() {
        super();
        this.buffer = [];
        this.port.onmessage = (event) => {
            this.buffer.push(...event.data);
        };
    }
    process(inputs, outputs, parameters) {
        //长视频 游戏等音频不断的 可能炸缓冲区
        //检测并清理
        if (this.buffer.length>=22050) {
            this.buffer.splice(0,11025);
            console.warn(`Cleared audio buffer,new size:${this.buffer.length}`);
        }
        let output = outputs[0][0];
        // 无数据时输出空
        //缓解重新收到数据时大概率破音
        if (this.buffer.length === 0) {
            for (let i = 0; i < output.length; i++) {
                output[i] = 0;
            }
            return true;
        }
        for (let i = 0; i < output.length; i++) {
            output[i] = this.buffer.shift();
        }
        return true;
    }
}
registerProcessor("AudioProcessor", RemoteAudio);