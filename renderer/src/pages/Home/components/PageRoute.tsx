import type { ApplicationState, States } from "~/types/applicationState"
import type { StateAction } from "../Home"
import HomePage from "../subPages/home/HomePage"
import TransmitPage from "../subPages/transmit/TransmitPage"

export interface PageRouteProps {
    page: "home" | "transmit" | "notification" | "file" | "extension" | "setting",
    applicationStates:{[key in States]?:ApplicationState},
    applicationStatesDispatch:React.ActionDispatch<StateAction>
}
export default function PageRoute({ page ,applicationStates,applicationStatesDispatch}: PageRouteProps) {
    return (
        <div className="fixed left-20 top-9.5">
            <HomePage hidden={page !== "home"} applicationStatesDispatch={applicationStatesDispatch} applicationStates={applicationStates}/>
            <TransmitPage hidden={page !== "transmit"}></TransmitPage>
            <div hidden={page !== "notification"}>notification</div>
            <div hidden={page !== "file"}>file</div>
            <div hidden={page !== "extension"}>extension</div>
            <div hidden={page !== "setting"}>setting</div>
            {/* {(() => {
                switch (page) {
                    case "home":
                        return <HomePage/>
                    case "transmit":
                        return <>transmit</>
                    case "notification":
                        return <>notification</>
                    case "file":
                        return <>file</>
                    case "extension":
                        return <>extension</>
                    case "setting":
                        return <>setting</>
                    default:
                        return <>error!!!</>
                }
            })()} */}
        </div>
    )
}