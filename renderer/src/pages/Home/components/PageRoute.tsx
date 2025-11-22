import type { ApplicationState, States } from "~/types/applicationState"
import type { StateAction } from "../Home"
import HomePage from "../subPages/home/HomePage"
import TransmitPage, { type TransmitPageRef } from "../subPages/transmit/TransmitPage"
import { forwardRef, useImperativeHandle, useRef } from "react"

export interface PageRouteProps {
    page: "home" | "transmit" | "notification" | "file" | "extension" | "setting",
    applicationStates: { [key in States]?: ApplicationState },
    applicationStatesDispatch: React.ActionDispatch<StateAction>,
    setHasNewTransmitMessage: React.Dispatch<React.SetStateAction<boolean>>
}
// export default function PageRoute({ page ,applicationStates,applicationStatesDispatch,setHasNewTransmitMessage}: PageRouteProps) {
//     return (
//         <div className="fixed left-20 top-9.5 right-0 bottom-0">
//             <HomePage hidden={page !== "home"} applicationStatesDispatch={applicationStatesDispatch} applicationStates={applicationStates}/>
//             <TransmitPage hidden={page !== "transmit"} setHasNewTransmitMessage={setHasNewTransmitMessage}/>
//             <div hidden={page !== "notification"}>notification</div>
//             <div hidden={page !== "file"}>file</div>
//             <div hidden={page !== "extension"}>extension</div>
//             <div hidden={page !== "setting"}>setting</div>
//         </div>
//     )
// }
export interface PageRouteRef {
    onPageDoubleClick: (targetPage:PageRouteProps["page"]) => void
}
const PageRoute = forwardRef<PageRouteRef, PageRouteProps>(({ page, applicationStates, applicationStatesDispatch, setHasNewTransmitMessage }, ref) => {
    const transmitPageRef = useRef<TransmitPageRef>(null);
    useImperativeHandle(ref,()=>({
        onPageDoubleClick: (targetPage)=>{
            if (targetPage==="transmit") {
                transmitPageRef.current?.scrollToBottom();
            }
        },
    }))
    return (
        <div className="fixed left-20 top-9.5 right-0 bottom-0">
            <HomePage hidden={page !== "home"} applicationStatesDispatch={applicationStatesDispatch} applicationStates={applicationStates} />
            <TransmitPage ref={transmitPageRef} hidden={page !== "transmit"} setHasNewTransmitMessage={setHasNewTransmitMessage} />
            <div hidden={page !== "notification"}>notification</div>
            <div hidden={page !== "file"}>file</div>
            <div hidden={page !== "extension"}>extension</div>
            <div hidden={page !== "setting"}>setting</div>
        </div>
    )
});

export default PageRoute