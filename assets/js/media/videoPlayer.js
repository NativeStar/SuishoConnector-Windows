/**
 * @type {HTMLVideoElement}
 */
const videoElement = document.getElementById("video");
const params = new URLSearchParams(location.search);
window.addEventListener("resize", () => {
    videoElement.width = window.innerWidth;
    videoElement.height = window.innerHeight;
});
videoElement.addEventListener("loadedmetadata", () => {
    videoElement.width  = videoElement.videoWidth;
    videoElement.height = videoElement.videoHeight;
    resizeTo(videoElement.videoWidth, videoElement.videoHeight);
});
//防止出现选择框
window.addEventListener("keydown",(event)=>{
    if(event.key==="Tab"){
        event.preventDefault();
        event.stopPropagation();
    }
});
videoElement.addEventListener("keydown",(event)=>{
    if(event.key==="Tab"){
        event.preventDefault();
        event.stopPropagation();
        return
    };
    if (event.key==="F11") {
        videoElement.requestFullscreen();
    }
});
window.addEventListener("load", () => {
    videoElement.width = window.innerWidth;
    videoElement.height = window.innerHeight;
    videoElement.src=`https://${params.get("remoteAddr")}:30767?filePath=${params.get("filePath")}`;
});