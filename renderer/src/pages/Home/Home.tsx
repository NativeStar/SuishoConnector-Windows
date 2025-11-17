import { AppBar } from "~/components/AppBar";
import { confirm } from "mdui/functions/confirm"
import { alert } from "mdui/functions/alert";
import NavigationRail from "./components/NavigationRail";
import useDevMode from "~/hooks/useDevMode";
import PageRoute, { type PageRouteProps } from "./components/PageRoute";
import { useEffect, useReducer, useState } from "react";
import AndroidIdContext from "~/context/AndroidIdContext";
import { getStateInstance, type ApplicationState, type States } from "~/types/applicationState";
import useMainWindowIpc from "~/hooks/ipc/useMainWindowIpc";
import LoadingScreen from "./subPages/home/components/LoadingScreen";
export type StatesListObject = { [key in States]?: ApplicationState };
export type StateAction = [{
  type: "add" | "remove",
  id: States,
  onClick?: () => void
}];
export default function Home() {
  useDevMode();
  let hasDialog: boolean=false;
  const ipc = useMainWindowIpc();
  const [page, setPage] = useState<PageRouteProps["page"]>("home");
  const [androidId, setAndroidId] = useState<string>("");
  const [hasNewTransmitMessage,setHasNewTransmitMessage]=useState<boolean>(false);
  const [applicationStates, applicationStatesDispatch] = useReducer<StatesListObject, StateAction>((state, action) => {
    if (action.type === "add") {
      const stateInstance = getStateInstance(action.id, action.onClick);
      return {
        ...state,
        [action.id]: stateInstance
      }
    } else {
      Reflect.deleteProperty(state, action.id);
      return {
        ...state
      }
    }
  }, {});
  useEffect(() => {
    ipc.getDeviceBaseInfo().then(value => {
      setAndroidId(value.androidId);
    });
    const rebootConfirmCleanup=ipc.on("rebootConfirm", () => {
      if (hasDialog) return;
      confirm({
        headline: "重启程序",
        description: "确认重启程序?所有连接将关闭",
        confirmText: "重启",
        cancelText: "取消",
        onOpened() {
          hasDialog=true
        },
        onClose() {
          hasDialog=false
        },
        onConfirm: () => {
          ipc.rebootApplication();
        }
      }).catch(() => {})
    });
    const closeConfirmCleanup=ipc.on("closeConfirm", () => {
      if (hasDialog) return;
      confirm({
        headline: "关闭程序",
        description: "确认关闭程序?",
        confirmText: "关闭",
        cancelText: "取消",
        onOpened() {
          hasDialog=true
        },
        onClose() {
          hasDialog=false
        },
        onConfirm: () => {
          ipc.closeApplication();
        }
      }).catch(() => {})
    });
    const disconnectEventCleanup=ipc.on("disconnect",(reason=>{
      alert({
        headline:"通讯中断",
        description:reason??"由于未知原因 连接断开",
        onConfirm() {
          ipc.rebootApplication();
        },
      })
    }));
    const showAlertCleanup=ipc.on("showAlert",({title,content})=>{
      alert({
        headline:title,
        description:content,
      })
    });
    return () => {
      rebootConfirmCleanup();
      closeConfirmCleanup();
      disconnectEventCleanup();
      showAlertCleanup();
    }
  }, [])
  return (
    <>
      <AppBar paddingLeft="3%" />
      <AndroidIdContext.Provider value={{ androidId, setAndroidId }}>
        {androidId !== "" && <NavigationRail onChange={setPage} hasNewTransmitMessage={hasNewTransmitMessage}/>}
        {androidId !== "" ? <PageRoute page={page} applicationStatesDispatch={applicationStatesDispatch} applicationStates={applicationStates} setHasNewTransmitMessage={setHasNewTransmitMessage}/> : <LoadingScreen />}
      </AndroidIdContext.Provider>
    </>
  )
}
