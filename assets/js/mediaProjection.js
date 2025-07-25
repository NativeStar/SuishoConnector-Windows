import developing from "../modules/developing.js";
/** @type {HTMLCanvasElement} */
let canvas=null;
/** @type {CanvasRenderingContext2D}  */
let rendererContext;
/**@type {Window} */
const windowOpener=window.opener;
//手机屏幕大小
const screenSize={
    width:0,
    height:0,
    widthRatio:0,
    heightRatio:0
}
window.sendTest=()=>{
    sendControlAction(ControlAction.CLICK);
}
async function envInit(){
    //是否有父窗口
    if (windowOpener==null) {
        //异常
        window.close();
    }
    const detail=await window.electronMainProcess.getDeviceDetailInfo();
    screenSize.width=detail.screenWidth;
    screenSize.height=detail.screenHeight;
    //初始化 设置canvas大小
    setCanvasSize();
    calcClickRatio();
    //大小更新监听器
    window.addEventListener("resize",()=>{
        setCanvasSize();
        calcClickRatio();
    });
    addEventListener("message",async (event)=>{
        rendererContext.drawImage(event.data,0,0,canvas.width,canvas.height);
        event.data.close();
    });
}
function setCanvasSize(){
    canvas.width=window.innerWidth*window.devicePixelRatio;
    canvas.height=window.innerHeight*window.devicePixelRatio;
    canvas.style.width=window.innerWidth+"px";
    canvas.style.height=window.innerHeight+"px";
}
function calcClickRatio(){
    screenSize.widthRatio=screenSize.width/window.innerWidth;
    screenSize.heightRatio=screenSize.height/window.innerHeight;
}
/**
 * 
 * @param {ControlAction} action 
 * @param {number} clickX 
 * @param {number} clickY
 * @param {ScrollDirection|null} scrollDirection
 * @param {GlobalAction|null} globalAction 
 */
async function sendControlAction(action,clickX,clickY,scrollDirection=null,globalAction=null) {
    switch (action) {
        //点击
        case ControlAction.CLICK:
            windowOpener.postMessage(new Int8Array([action,...short2Byte(clickX*screenSize.widthRatio),...short2Byte(clickY*screenSize.heightRatio)]));
            break;
        case ControlAction.SCROLL:
            //使用滚轮滑动
            windowOpener.postMessage(new Int8Array([action,...short2Byte(clickX*screenSize.widthRatio),...short2Byte(clickY*screenSize.heightRatio),scrollDirection]));
            break;
        case 2:
            //全局事件
            windowOpener.postMessage(new Int8Array([action,0,0,0,0,0,globalAction]));
            break;
        default:
            console.error("Unknown action:"+action)
            break;
    }
}
function domInit(){
    canvas.addEventListener("mousedown",(event)=>{
        // console.log(event);
        switch (event.button) {
            //左键
            case 0:
                sendControlAction(ControlAction.CLICK,event.offsetX,event.offsetY);
                break;
            //右键或部分鼠标的肩键
            case 2:
            case 3:
                sendControlAction(ControlAction.ACTION,null,null,null,GlobalAction.BACK);
                break;
            default:
                break;
        }
    });
    canvas.addEventListener("wheel",(event)=>{
        sendControlAction(ControlAction.SCROLL,event.x,event.y,event.deltaY>0?ScrollDirection.DOWN:ScrollDirection.UP);
    })
}
function short2Byte(number){
    const tmpArray=[];
    //转为byte
    for (let i = 0; i < 2; i++) {
        tmpArray.push(number&0xff);
        number>>=8;
    }
    return new Int8Array(tmpArray);
}
//byte转short
function byte2Short(byteArray){
    let result=0;
    for (let i = byteArray.length; i > 0; i--) {
        result<<=8;
        result|=byteArray[i-1];
    }
    return result;
}
window.addEventListener("DOMContentLoaded",()=>{
    //开发用功能
    window.electronMainProcess.isDeveloping().then(value=>{
        if (value) {
            developing.inject();
        }
    });
    canvas=document.getElementById("renderer");
    rendererContext=canvas.getContext("2d",{alpha:false});
    envInit();
    domInit();
});
// 控制动作enum
class ControlAction{
    static CLICK=0;
    static SCROLL=1;
    static ACTION=2;
}
//滚轮方向
class ScrollDirection{
    static UP=0;
    static DOWN=1;
}
//返回等全局事件 具体值跟android内的键值对应
class GlobalAction{
    static BACK=1;
}