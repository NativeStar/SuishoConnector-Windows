import type { RouteObject } from "react-router";
import ConnectPhone from "./pages/ConnectPhone/ConnectPhone";
import Home from "~/pages/Home/Home";

const Routes: RouteObject[] = [
    {
        path: "/connect-phone",
        Component: ConnectPhone
    },{
        path:"/home",
        Component:Home
    }
]
export default Routes;