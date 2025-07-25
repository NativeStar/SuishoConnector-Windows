import * as md from "../modules/mdui.esm.js";
class RtcConnection {
    constructor(videoElement, maskElement) {
        /** @type {HTMLVideoElement}*/
        this.videoDisplay = videoElement;
        /**@type {HTMLDivElement} */
        this.hoverMaskElement = maskElement;
        /**@type {Window} */
        this.videoWindow = null;
        this.#envInit();
        //测试
        this.#initElement();
    }
    async start() {
        //音频模块
        this.rtcPeer = new RTCPeerConnection();
        this.audioContext = new AudioContext({ sampleRate: 44100 });
        await this.audioContext.audioWorklet.addModule("../modules/AudioProcessor.js");
        this.audioProcessor = new AudioWorkletNode(this.audioContext, "AudioProcessor");
        this.audioProcessor.connect(this.audioContext.destination);
        //连接
        //控制连接
        //而且不主动创建一个连接的话 手机端发起的连接收不到
        this.controlChannel = this.rtcPeer.createDataChannel("Control", { ordered: false });
        this.rtcPeer.addEventListener("track", (event) => {
            //视频轨道
            if (event.track.kind === "video") {
                this.videoStreamObject = event.streams[0];
                this.videoDisplay.srcObject = this.videoStreamObject;
                // this.videoStreamReader = new MediaStreamTrackProcessor({ track: event.streams[0].getVideoTracks()[0]}).readable.getReader();
                this.videoDisplay.play();
                document.getElementById("screenProjectionHoverMaskText").innerText = "点击打开投屏操控窗口"
                document.getElementById("mediaProjectionMaskIcon").setAttribute("name", "open_in_browser");
            }
        });
        this.rtcPeer.addEventListener("icecandidate", (event) => {
            //剔除null和本地回环
            if (event.candidate === null || (event.candidate.candidate.includes("127.0.0.1") || event.candidate.candidate.includes("::1"))) return
            window.electronMainProcess.sendPacket({ packetType: "main_mediaProjectionAddIceCandidate", sdpMid: event.candidate.sdpMid, sdpMLineIndex: event.candidate.sdpMLineIndex, msg: offer.sdp });
        });
        //发出offer
        const offer = await this.rtcPeer.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
        console.log(offer);
        this.rtcPeer.setLocalDescription(offer);
        this.rtcPeer.addEventListener("datachannel", (event) => {
            if (event.channel.label === "AUDIO") {
                console.log("Audio channel registered");
                event.channel.addEventListener("message", (audioDataEvent) => {
                    this.audioProcessor.port.postMessage(this.#processPCMData(audioDataEvent.data));
                });
            }
        });
        const remote = await window.electronMainProcess.sendRequestPacket({ packetType: "main_initMediaProjection", msg: offer.sdp });
        console.log(remote);
        this.rtcPeer.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: remote.sdp }));
        this.#initElement();
    }
    #processPCMData(arrayBuffer) {
        const pcmData = new Float32Array(arrayBuffer.byteLength / 2);
        const view = new DataView(arrayBuffer);
        for (let i = 0; i < pcmData.length; i++) {
            pcmData[i] = view.getInt16(i * 2, true) / 32768;
        }
        return pcmData;
    }
    #initElement() {
        //遮罩被点击 打开窗口
        this.videoDisplay.addEventListener("click", () => {
            //未连接 初始化
            if (this.rtcPeer == null) {
                //检查权限
                window.electronMainProcess.sendRequestPacket({ packetType: "main_hasMediaProjectionPermission" }).then(value => {
                    if (value.hasPermission) {
                        //有媒体投射权限
                        this.start();
                        document.getElementById("screenProjectionHoverMaskText").innerText = "正在连接"
                    } else {
                        md.snackbar({
                            message: "安卓端未获得媒体投射权限",
                            autoCloseDelay: 2000
                        });
                    }
                })
                return
            }
            //打开窗口 需要已成功连接且不存在已打开的窗口
            if (this.videoStreamObject == null || this.videoWindow === null || this.videoWindow.closed) {
                this.videoWindow = window.open("../html/mediaProjection.html");
                const videoStreamReadable = new MediaStreamTrackProcessor({ track: this.videoStreamObject.getVideoTracks()[0] }).readable;
                //利用videoFrame转发视频帧
                this.videoWindow.addEventListener("DOMContentLoaded", () => {
                    //视频读取流中断
                    const abortController=new AbortController();
                    const canvasVideoWritableStream = new WritableStream({
                        write:(chunk)=>{
                            this.videoWindow.postMessage(chunk, "*", [chunk]);
                        }
                    });
                    videoStreamReadable.pipeTo(canvasVideoWritableStream,{
                        signal:abortController.signal
                    }).catch(()=>{
                        //中断后释放
                        videoStreamReadable.cancel();
                        canvasVideoWritableStream.abort("Final close");
                    });
                    //关闭主页的预览 降低占用
                    this.videoDisplay.pause();
                    this.videoDisplay.srcObject = null;
                    //关闭窗口 恢复播放
                    //不知道为啥 刚打开也会触发一次 放在这吧
                    this.videoWindow.addEventListener("unload", async () => {
                        abortController.abort("Window closed");
                        this.videoDisplay.srcObject = this.videoStreamObject;
                        this.videoDisplay.play();
                    });
                });
            }
            this.videoWindow.focus();

        });
        //视频元素hover
        this.videoDisplay.addEventListener("mouseenter", () => {
            this.hoverMaskElement.hidden = false;
        });
        this.videoDisplay.addEventListener("mouseleave", () => {
            this.hoverMaskElement.hidden = true;
        });
    }
    #envInit() {
        //处理远程控制操作事件
        //chrome要130版本才支持把RTCDataChannel通过postmessage发到新窗口中
        //但目前最新的electron只支持到128
        window.addEventListener("message", (event) => {
            //test 按arrayBuffer算
            this.controlChannel.send(event.data);
        });
    }
    /**
     * 转发视频帧
     * @type {MessageEvent} 
     * 
    */
    // #forwardVideoFrame(frameEvent){
    //     this.videoWindow.postMessage(event.data);
    // }
    addIceCandidate(data) {
        console.log(data);
        this.rtcPeer.addIceCandidate(data)
    }
    //掉线时关闭连接和窗口
    onDisconnect() {
        this.rtcPeer.close();
        this.rtcPeer = null;
        if (this.videoWindow !== null && !this.videoWindow.closed) {
            this.videoWindow.close();
        }
    }
}
export default RtcConnection;