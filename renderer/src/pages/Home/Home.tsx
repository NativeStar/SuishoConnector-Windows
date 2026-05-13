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
import useLogger from "~/hooks/useLogger";
import ApplicationVersion from "shared/const/ApplicationVersion"
import type { UpdateJson } from "~/types/chaos";
export type StatesListObject = { [key in States]?: ApplicationState };
export type StateAction = [{
  type: "add" | "remove"
  id: States
}];
export default function Home() {
  useLogger();
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
      const stateInstance = getStateInstance(action.id);
      console.debug(`Add application state:${action.id}`);
      return {
        ...state,
        [action.id]: stateInstance
      }
    } else {
      Reflect.deleteProperty(state, action.id);
      //设备状态更新时会触发这个更新Doze模式状态显示 触发太频繁 故将日志降为debug
      console.debug(`Remove application state:${action.id}`);
      return {
        ...state
      }
    }
  }, {});
  // ipc相关初始化
  useEffect(() => {
    ipc.getDeviceBaseInfo().then(value => {
      setAndroidId(value.androidId);
    });
    const rebootConfirmCleanup = ipc.on("rebootConfirm", () => {
      if (hasDialog) return;
      console.debug("Show reboot confirm by ipc message");
      confirm({
        headline: "重启程序",
        description: "确认重启程序?",
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
      console.debug("Show close confirm by ipc message");
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
      console.debug("Show disconnect alert");
      confirm({
        headline: "通讯中断",
        closeOnOverlayClick:false,
        description: reason ?? "由于未知原因 连接断开",
        confirmText: "重启",
        cancelText: "关闭",
        onConfirm() {
          ipc.rebootApplication();
        },
        onCancel() {
          ipc.closeApplication();
        }
      });
      // 应对视频全屏播放时掉线
      if (document.fullscreenElement!==null) {
        document.exitFullscreen();
      }
    }));
    const showAlertCleanup = ipc.on("showAlert", ({ title, content }) => {
      console.debug(`Show alert by ipc message:${title}:${content}`);
      alert({
        headline: title,
        description: content,
      })
    });
    const focusNotificationEventCleanup = ipc.on("focusNotification", () => {
      setPage("notification");
      // 触发滚动
      routeRef.current?.onPageDoubleClick("notification");
      console.debug("Focus notification forward page");
    });
    const dragOpenFileListenerCleanup = ipc.on("transmitDragFile", () => {
      setPage("transmit");
      console.debug("Change to transmit page because drag file");
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
    setColorScheme("#895cad")
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
          console.debug(`Copied text by global hotkey:${selectedText}`);
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
    //屏蔽按下中键的滚动功能
    document.addEventListener("mousedown", event => {
      if (event.button === 1) event.preventDefault();
    });
    //自动检查更新
    ipc.getConfig("autoCheckUpdate", true).then(value => {
      if (value) {
        console.debug("Enabled auto check update.Waiting idle");
        requestIdleCallback(async () => {
          console.log("Start check update");
          try {
            const updateJson: UpdateJson = await (await fetch("https://raw.githubusercontent.com/NativeStar/SuishoConnector-Windows/master/update.json")).json();
            if (ApplicationVersion.APPLICATION_VERSION_CODE < updateJson.versionCode) {
              console.log(`Find new version:${updateJson.versionCode}`);
              sessionStorage.setItem("updateJson", JSON.stringify(updateJson));
              applicationStatesDispatch({
                type: "add",
                id: "info_update_available"
              })
            } else {
              console.log(`Current is latest version:${updateJson.versionCode}`);
            }
          } catch (error) {
            console.error("Check update error");
            console.error(error);
          }
        }, { timeout: 60000 })
      }
    })
  }, []);
  function setPageHandle(targetPage: PageRouteProps["page"]) {
    if (page === targetPage) {
      //重复点击事件 用于滚动列表等
      console.debug(`Trigger route double click event:${page}`);
      routeRef.current?.onPageDoubleClick(page);
      return
    }else{
      console.debug(`Trigger route click event:${page}`);
      routeRef.current?.onPageClick(targetPage);
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
