import { States,Level } from "../class/States.js";
class StateBarInit{
    //当前状态列表
    static stateList=new Set();
    static onAppLoaded(){
        document.getElementById("stateBarDropdown").addEventListener("open",event=>{
            //无状态时阻止打开列表
            if (this.stateList.size===0) {
                event.preventDefault();
            }
        })
    }
    /**
     * 添加状态
     * @param {string} id 
     * @returns 
     */
    static async addState(id){
        const state=States.get(id);
        if (state===null) return
        this.stateList.add(state);
        this.#refreshStateBar();
    }
    static async removeState(id){
        const state=States.get(id);
        if (state===null) return
        this.stateList.delete(state);
        this.#refreshStateBar();
    }
    static #getStateLevel(){
        let maxStateLevel=0;
        this.stateList.forEach((key,value)=>{
            if (value.level>maxStateLevel) maxStateLevel=value.level;
        });
        return maxStateLevel;
    }
    static #refreshStateBar(){
        const stateBar=document.getElementById("stateBar");
        //更改显示
        switch (this.#getStateLevel()) {
            case Level.checked:
                stateBar.setAttribute("icon","check");
                stateBar.innerText="正常"
                break;
            case Level.busy:
                stateBar.setAttribute("icon","hourglass_top");
                stateBar.innerText="忙碌"
                break;
            case Level.info:
                stateBar.setAttribute("icon","info");
                stateBar.innerText="提醒"
                break
            case Level.warn:
                stateBar.setAttribute("icon","warning_amber");
                stateBar.innerText="警告"
                break
            case Level.error:
                stateBar.setAttribute("icon","error_outline");
                stateBar.innerText="异常"
                break
            default:
                break;
        }
        //添加列表
        const fragment=document.createDocumentFragment();
        this.stateList.forEach(state=>{
            const stateElement=document.createElement("suisho-state-card");
            stateElement.setAttribute("level",state.level);
            stateElement.setAttribute("state_title",state.title);
            stateElement.setAttribute("content",state.content);
            //支持点击事件
            if (state.clickable) {
                stateElement.setAttribute("clickable","");
                stateElement.addEventListener("click",event=>{
                    state.onclick(event);
                })
            }
            fragment.append(stateElement);
        });
        const stateBarMenu=document.getElementById("stateBarMenu");
        if (this.stateList.size===0) {
            //关闭列表
            document.getElementById("stateBarDropdown").open=false;
            //修复动画效果错位
            setTimeout(() => {
                stateBarMenu.replaceChildren(fragment);
            }, 200);
            return
        }
        stateBarMenu.replaceChildren(fragment);
    }
}
export default StateBarInit;