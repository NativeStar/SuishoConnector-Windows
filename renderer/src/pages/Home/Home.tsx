import { AppBar } from "~/components/AppBar";
import { confirm } from "mdui/functions/confirm"
import { alert } from "mdui/functions/alert";
import NavigationRail from "./components/NavigationRail";
import useDevMode from "~/hooks/useDevMode";
import PageRoute, { type PageRouteProps, type PageRouteRef } from "./components/PageRoute";
import { useEffect, useReducer, useRef, useState } from "react";
import AndroidIdContext from "~/context/AndroidIdContext";
import { getStateInstance, type ApplicationState, type States } from "~/types/applicationState";
import useMainWindowIpc from "~/hooks/ipc/useMainWindowIpc";
import LoadingScreen from "./subPages/home/components/LoadingScreen";
import { setColorScheme } from "mdui";
import { releaseFfmpeg } from "~/utils";
export type StatesListObject = { [key in States]?: ApplicationState };
export type StateAction = [{
  type: "add" | "remove",
  id: States,
  onClick?: () => void
}];
export default function Home() {
  useDevMode();
  let hasDialog: boolean = false;
  const ipc = useMainWindowIpc();
  const [page, setPage] = useState<PageRouteProps["page"]>("home");
  const [androidId, setAndroidId] = useState<string>("");
  const [hasNewTransmitMessage, setHasNewTransmitMessage] = useState<boolean>(false);
  const [hasNewNotification, setHasNewNotification] = useState<boolean>(false);
  const routeRef = useRef<PageRouteRef>(null);
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
  // ipc相关初始化
  useEffect(() => {
    setColorScheme("#895cad")
    ipc.getDeviceBaseInfo().then(value => {
      setAndroidId(value.androidId);
    });
    const rebootConfirmCleanup = ipc.on("rebootConfirm", () => {
      if (hasDialog) return;
      confirm({
        headline: "重启程序",
        description: "确认重启程序?所有连接将关闭",
        confirmText: "重启",
        cancelText: "取消",
        onOpened() {
          hasDialog = true
        },
        onClose() {
          hasDialog = false
        },
        onConfirm: () => {
          ipc.rebootApplication();
        }
      }).catch(() => { })
    });
    const closeConfirmCleanup = ipc.on("closeConfirm", () => {
      if (hasDialog) return;
      confirm({
        headline: "关闭程序",
        description: "确认关闭程序?",
        confirmText: "关闭",
        cancelText: "取消",
        onOpened() {
          hasDialog = true
        },
        onClose() {
          hasDialog = false
        },
        onConfirm: () => {
          ipc.closeApplication();
        }
      }).catch(() => { })
    });
    const disconnectEventCleanup = ipc.on("disconnect", (reason => {
      alert({
        headline: "通讯中断",
        description: reason ?? "由于未知原因 连接断开",
        onConfirm() {
          ipc.rebootApplication();
        },
      })
    }));
    const showAlertCleanup = ipc.on("showAlert", ({ title, content }) => {
      alert({
        headline: title,
        description: content,
      })
    });
    const focusNotificationEventCleanup = ipc.on("focusNotification", () => {
      setPage("notification");
      // 触发滚动
      routeRef.current?.onPageDoubleClick("notification");
    });
    const dragOpenFileListenerCleanup = ipc.on("transmitDragFile", () => {
      setPage("transmit");
    });
    return () => {
      rebootConfirmCleanup();
      closeConfirmCleanup();
      disconnectEventCleanup();
      showAlertCleanup();
      focusNotificationEventCleanup();
      dragOpenFileListenerCleanup();
    }
  }, []);
  // 普通初始化
  useEffect(() => {
    document.addEventListener("keydown", event => {
      //接管系统复制 防止背景样式可能被粘贴到word类软件中
      if (event.key.toUpperCase() === "C" && event.ctrlKey) {
        event.stopPropagation();
        event.stopImmediatePropagation();
        event.preventDefault();
        //写入
        const selectedText = getSelection()?.toString();
        if (selectedText && selectedText !== "") {
          navigator.clipboard.writeText(selectedText);
          getSelection()?.removeAllRanges();
        }
      }
      // 屏蔽tab键
      if (event.key === "Tab") {
        event.preventDefault();
        event.stopPropagation();
      }
    });
    // 阻止拖动文本
    document.addEventListener("dragstart", event => {
      const target = event.target as HTMLElement;
      if (target.nodeName === "#text") event.preventDefault();
    });
  }, []);
  function setPageHandle(targetPage: PageRouteProps["page"]) {
    if (page === targetPage) {
      //重复点击事件 用于滚动列表等
      routeRef.current?.onPageDoubleClick(page);
      return
    }
    setPage(targetPage);
    releaseFfmpeg();
  }
  return (
    <>
      <AppBar paddingLeft="3%" />
      <AndroidIdContext.Provider value={{ androidId, setAndroidId }}>
        {androidId !== "" && <NavigationRail value={page} onChange={setPageHandle} hasNewTransmitMessage={hasNewTransmitMessage} hasNewNotification={hasNewNotification} />}
        {androidId !== "" ? <PageRoute ref={routeRef} page={page} applicationStatesDispatch={applicationStatesDispatch} applicationStates={applicationStates} setHasNewTransmitMessage={setHasNewTransmitMessage} setHasNewNotification={setHasNewNotification} /> : <LoadingScreen />}
      </AndroidIdContext.Provider>
    </>
  )
}
