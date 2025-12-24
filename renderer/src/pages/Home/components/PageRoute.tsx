import type { ApplicationState, States } from "~/types/applicationState"
import type { StateAction } from "../Home"
import HomePage from "../subPages/home/HomePage"
import TransmitPage, { type TransmitPageRef } from "../subPages/transmit/TransmitPage"
import { forwardRef, useImperativeHandle, useRef } from "react"
import NotificationPage, { type NotificationPageRef } from "../subPages/notification/NotificationPage"
import SettingPage from "../subPages/setting/SettingPage"
import FileManagerPage from "../subPages/file/FileManagerPage"

export interface PageRouteProps {
    page: "home" | "transmit" | "notification" | "file" | "setting",
    applicationStates: { [key in States]?: ApplicationState },
    applicationStatesDispatch: React.ActionDispatch<StateAction>,
    setHasNewTransmitMessage: React.Dispatch<React.SetStateAction<boolean>>,
    setHasNewNotification: React.Dispatch<React.SetStateAction<boolean>>

}
export interface PageRouteRef {
    onPageDoubleClick: (targetPage:PageRouteProps["page"]) => void
}
const PageRoute = forwardRef<PageRouteRef, PageRouteProps>(({ page, applicationStates, applicationStatesDispatch, setHasNewTransmitMessage ,setHasNewNotification}, ref) => {
    const transmitPageRef = useRef<TransmitPageRef>(null);
    const notificationPageRef = useRef<NotificationPageRef>(null);
    useImperativeHandle(ref,()=>({
        onPageDoubleClick: (targetPage)=>{
            if (targetPage==="transmit") {
                transmitPageRef.current?.scrollToBottom();
            }else if (targetPage==="notification") {
                notificationPageRef.current?.scrollToBottom();
            }
        },
    }))
    return (
        <div className="fixed left-20 top-9.5 right-0 bottom-0">
            <HomePage hidden={page !== "home"} applicationStatesDispatch={applicationStatesDispatch} applicationStates={applicationStates} />
            <TransmitPage ref={transmitPageRef} hidden={page !== "transmit"} setHasNewTransmitMessage={setHasNewTransmitMessage} />
            <NotificationPage ref={notificationPageRef} hidden={page !== "notification"} setHasNewNotification={setHasNewNotification}/>
            <FileManagerPage hidden={page !== "file"} />
            <SettingPage hidden={page !== "setting"}/>
        </div>
    )
});

export default PageRoute