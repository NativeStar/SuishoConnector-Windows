import {Level} from "../../js/class/States.js";
window._firstStateCard=false;
class State extends HTMLElement {
    constructor(){
        super();
    }
    connectedCallback(){
        this.root=this.attachShadow({mode:"open"});
        //css
        const shadowStyle = document.createElement("link");
        shadowStyle.rel = "stylesheet";
        shadowStyle.href = "../css/shadow/stateCard.css";
        this.root.appendChild(shadowStyle);
        const shadowStyleBase = document.createElement("link");
        shadowStyleBase.rel = "stylesheet";
        shadowStyleBase.href = "../css/shadow/baseStyleShadow.css";
        this.root.appendChild(shadowStyleBase);
        //卡片
        const card=document.createElement("mdui-card");
        //图标
        const icon=document.createElement("mdui-icon");
        //标题
        const title=document.createElement("b");
        //内容
        const content=document.createElement("small");
        card.classList.add("card");
        //可点击波纹
        if (this.hasAttribute("clickable")) {
            card.setAttribute("clickable","");
        }
        //覆盖顶部空白
        if (!window._firstStateCard) {
            card.classList.add("firstCard");
            window._firstStateCard=true;
        }
        //图标
        icon.setAttribute("name",this.getLevelIcon(this.getAttribute("level")));
        icon.classList.add("stateIcon");
        //标题和内容
        const texts=document.createElement("div");
        texts.classList.add("stateTexts");
        //标题
        title.innerText=this.getAttribute("state_title");
        // title.classList.add("stateCardTitle");
        content.innerText=this.getAttribute("content");
        // content.classList.add("stateCardContent");
        texts.append(title,content);
        card.append(icon,texts);
        this.root.append(card);
    }
    /**
     * 获取状态图标
     * @param {string} level 
     * @returns 
     */
    getLevelIcon(level){
        const levelInt=parseInt(level);
        if (isNaN(levelInt)) {
            console.error("Invalid state level");
            return "info"
        }
        switch (levelInt) {
            case Level.checked:
                return "check"
            case Level.busy:
                return "hourglass_top"
            case Level.info:
                return "info"
            case Level.warn:
                return "warning_amber"
            case Level.error:
                return "error_outline"
            default:
                console.error("Unknown state level");
                return "info"
        }
    }
}
export default State;