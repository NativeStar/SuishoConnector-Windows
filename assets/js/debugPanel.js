import developing from "../modules/developing.js";
developing.inject();
const invokeButtonList=document.getElementsByClassName("invoke");
for (const element of invokeButtonList) {
    element.addEventListener("click", async() => {
        const result=await window.electronMainProcess.invokeCommand(element.getAttribute("cmd"));
        if (element.hasAttribute("hasResult")) {
            alert(result instanceof Object?objectToString(result):result);
        }
    });
}
let trustMode=true;
document.getElementById("changeTrustModeButton").addEventListener("click",()=>{
    trustMode=!trustMode;
    window.electronMainProcess.invokeCommand("debug_fakeMessage",JSON.stringify({
        packetType:"trustModeChange",
        trusted:trustMode
    }));
});
document.getElementById("appendTransmitPlaneTextButton").addEventListener("click",()=>{
    showInputAlert("互传追加文本",[
        {label:"内容"}
    ],(data)=>{
        const value=data[0].value;
        if (value==="") {
            return
        }
        window.electronMainProcess.invokeCommand("debug_fakeMessage",JSON.stringify({
            packetType:"action_transmit",
            messageType:"planeText",
            data:value
        }));
    })
});
document.getElementById("appendNotificationButton").addEventListener("click",()=>{
    showInputAlert("通知追加",[
        {label:"包名",extraData:{ext_type:"packageName"}},
        {label:"标题",extraData:{ext_type:"title"}},
        {label:"内容",extraData:{ext_type:"content"}},
        {label:"应用名",extraData:{ext_type:"appName"}}
    ],(data)=>{
        const pkgName=data[0].value;
        const title=data[1].value;
        const content=data[2].value;
        const appName=data[3].value;
        if (title===""||pkgName==="") {
            return
        }
       window.electronMainProcess.invokeCommand("debug_fakeMessage",JSON.stringify({
            packetType:"action_notificationForward",
            package:pkgName,
            title:title,
            content:content,
            appName:appName,
            time:Date.now(),
            ongoing:false
       }))
    })
});
document.getElementById("addStateButton").addEventListener("click",()=>{
    showInputAlert("添加状态",[
        {
            label:"状态ID",
        }
    ],(data)=>{
        const value=data[0].value;
        if(value==="") return;
        window.electronMainProcess.invokeCommand("debug_sendMainWindowEvent","add_state",value);
    })
});
document.getElementById("openApplicationNotificationProfile").addEventListener("click",()=>{
    showInputAlert("打开应用通知转发配置",[
        {
            label:"包名",
        },
        {
            label:"应用名",
        }
    ],(data)=>{
        const input0=data[0].value;
        const input1=data[1].value;
        if (input0==""||input1=="") {
            return
        }
        window.electronMainProcess.invokeCommand("notification_openConfigWindow",input0,input1);
    })
})
document.getElementById("removeStateButton").addEventListener("click",()=>{
    showInputAlert("移除状态",[
        {
            label:"状态ID",
        }
    ],(data)=>{
        const value=data[0].value;
        if(value==="") return;
        window.electronMainProcess.invokeCommand("debug_sendMainWindowEvent","remove_state",value);
    })
});
document.getElementById("checkAndroidClientPermissionButton").addEventListener("click",()=>{
    showInputAlert("检测权限",[
        {
            label:"权限ID",
        }
    ],async (data)=>{
        const value=data[0].value;
        if(value==="") return;
        alert(objectToString(await window.electronMainProcess.invokeCommand("main_checkAndroidClientPermission",value)));
    })
})
function objectToString(obj) {
    let str = "";
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            //处理对象嵌套
            if (obj[key] instanceof Object) {
                str += `${key}:\n${objectToString(obj[key])}\n`;
                continue
            }            
            str += `${key}: ${obj[key]}\n`;
        }
    }
    return str;
};
function showInputAlert(title="Input",props=[],confirmCallback=()=>{}) {
    const elements=[];
    const dialog=document.createElement("dialog");
    for (const prop of props) {
        const inputElement=document.createElement("input");
        inputElement.setAttribute("placeholder",prop.label);
        if (prop.extraData) {
            for (const extDataKey of Object.keys(prop.extraData)) {
                inputElement.setAttribute(extDataKey,prop.extraData[extDataKey])
            }
        }
        elements.push(inputElement);
    }
    const titleElement=document.createElement("h2");
    titleElement.innerText=title;
    dialog.appendChild(titleElement);
    for (const inputs of elements) {
        dialog.appendChild(document.createElement("br"));
        dialog.append(inputs);
    }
    const confirmButton=document.createElement("button");
    confirmButton.innerText="确定";
    confirmButton.addEventListener("click",()=>{
        confirmCallback(elements);
        dialog.close();
        dialog.remove();
    });
    const cancelButton=document.createElement("button");
    cancelButton.innerText="取消";
    cancelButton.addEventListener("click",()=>{
        dialog.close();
        dialog.remove();
    });
    dialog.append(document.createElement("br"),cancelButton,confirmButton);
    document.body.appendChild(dialog);
    dialog.showModal();
}