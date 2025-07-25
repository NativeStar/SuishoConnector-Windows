export default {
    inject:()=>{
        //控制台和刷新
        document.addEventListener("keydown",event=>{
            if(event.key==="F5"){
                window.location.reload()
            }else if (event.key==="F12") {
                window.electronMainProcess.devtools();
            }
        });
    }
}