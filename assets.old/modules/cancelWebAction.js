/**
 *@description 干掉一些烦人的网页特色 如元素可拖出屏幕保存 文本随便选择等
 *
 */
function ex() {
    //禁止拖动
    document.addEventListener("dragstart", e => e.preventDefault());
    //禁止选择
    // document.addEventListener("selectstart", e => {
    //     if (!e.target.classList.contains("selectable")) {
    //         e.preventDefault();
    //         return false
    //     }
    // });
    // document.addEventListener("select", e => {
    //     console.log(e.target);
    //     if (!e.target.classList.contains("selectable")) {
    //         e.preventDefault();
    //         return false
    //     }
    // });
}
export default ex