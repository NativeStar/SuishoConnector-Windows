import type { ApplicationState, States } from "~/types/applicationState"
import type { StateAction } from "../Home"
import HomePage from "../subPages/home/HomePage"
import TransmitPage, { type TransmitPageRef } from "../subPages/transmit/TransmitPage"
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import NotificationPage, { type NotificationPageRef } from "../subPages/notification/NotificationPage"
import SettingPage from "../subPages/setting/SettingPage"
import FileManagerPage from "../subPages/file/FileManagerPage"
import FileSyncPage from "../subPages/fileSync/FileSyncPage"
import useMainWindowIpc from "~/hooks/ipc/useMainWindowIpc"
import { snackbar } from "mdui"

export interface PageRouteProps {
    page: "home" | "transmit" | "notification" | "file" |"fileSync"| "setting",
    applicationStates: { [key in States]?: ApplicationState },
    applicationStatesDispatch: React.ActionDispatch<StateAction>,
    setHasNewTransmitMessage: React.Dispatch<React.SetStateAction<boolean>>,
    setHasNewNotification: React.Dispatch<React.SetStateAction<boolean>>

}
export interface PageRouteRef {
    onPageDoubleClick: (targetPage:PageRouteProps["page"]) => void
    onPageClick: (targetPage:PageRouteProps["page"]) => void
}
const PageRoute = forwardRef<PageRouteRef, PageRouteProps>(({ page, applicationStates, applicationStatesDispatch, setHasNewTransmitMessage ,setHasNewNotification}, ref) => {
    const transmitPageRef = useRef<TransmitPageRef>(null);
    const notificationPageRef = useRef<NotificationPageRef>(null);
    const [clientProtocolVersion, setClientProtocolVersion] = useState<number>(1);
    const ipc=useMainWindowIpc();
    useImperativeHandle(ref,()=>({
        onPageDoubleClick: (targetPage)=>{
            if (targetPage==="transmit") {
                transmitPageRef.current?.scrollToBottom();
            }else if (targetPage==="notification") {
                notificationPageRef.current?.scrollToBottom();
            }
        },
        onPageClick(targetPage) {
            if (targetPage==="fileSync"&& clientProtocolVersion<2) {
                console.debug("Show low client warning snack in file sync page");
                snackbar({
                    message: "需更新Android客户端此功能才能正常工作",
                    autoCloseDelay:2500
                })
            }
        },
    }));
    useEffect(()=>{
        ipc.getDeviceBaseInfo().then(info=>setClientProtocolVersion(info.protocolVersion))
    },[]);
    return (
        <div className="fixed left-20 top-9.5 right-0 bottom-0">
            <HomePage hidden={page !== "home"} applicationStatesDispatch={applicationStatesDispatch} applicationStates={applicationStates} />
            <TransmitPage ref={transmitPageRef} hidden={page !== "transmit"} setHasNewTransmitMessage={setHasNewTransmitMessage} />
            <NotificationPage ref={notificationPageRef} hidden={page !== "notification"} setHasNewNotification={setHasNewNotification}/>
            <FileManagerPage hidden={page !== "file"} />
            <FileSyncPage hidden={page !== "fileSync"}/>
            <SettingPage hidden={page !== "setting"}/>
        </div>
    )
});

export default PageRoute