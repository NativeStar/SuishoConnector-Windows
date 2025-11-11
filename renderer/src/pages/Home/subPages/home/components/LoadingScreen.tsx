import "mdui/components/circular-progress";
export default function LoadingScreen(){
    return (
        <div className="fixed top-[47.5%] left-[47.5%]">
            <mdui-circular-progress/>
        </div>
    )  
}