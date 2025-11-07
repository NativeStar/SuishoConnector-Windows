import { AppBar } from "~/components/AppBar";
import NavigationRail from "./components/NavigationRail";
import useDevMode from "~/hooks/useDevMode";
import PageRoute, { type PageRouteProps } from "./components/PageRoute";
import { useReducer, useState } from "react";
import AndroidIdContext from "~/context/AndroidIdContext";
import { getStateInstance, type ApplicationState, type States } from "~/types/applicationState";
export type StatesListObject={[key in States]?:ApplicationState};
export type StateAction = [{
  type: "add" | "remove",
  id: States,
  onClick?: () => void
}];
export default function Home() {
  useDevMode();
  const [page, setPage] = useState<PageRouteProps["page"]>("home");
  const [androidId, setAndroidId] = useState<string | null>(null);
  const [applicationStates, applicationStatesDispatch] = useReducer<StatesListObject, StateAction>((state, action) => {
    if (action.type==="add") {
      const stateInstance=getStateInstance(action.id,action.onClick);
      return {
        ...state,
        [action.id]: stateInstance
      }
    }else{
      Reflect.deleteProperty(state,action.id);
      return {
        ...state
      }
    }
  }, {});
  return (
    <>
      <AppBar paddingLeft="3%" />
      <NavigationRail onChange={setPage} />
      <AndroidIdContext.Provider value={{ androidId, setAndroidId }}>
        <PageRoute page={page} applicationStatesDispatch={applicationStatesDispatch} applicationStates={applicationStates}/>
      </AndroidIdContext.Provider>
    </>
  )
}
