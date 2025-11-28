import type { RouteObject } from "react-router";
import ConnectPhone from "./pages/ConnectPhone/ConnectPhone";
import Home from "~/pages/Home/Home";
import NotificationFilter from "./pages/NotificationFilter/NotificationFilter";

const Routes: RouteObject[] = [
    {
        path: "/connect-phone",
        Component: ConnectPhone
    },{
        path:"/home",
        Component:Home
    },
    {
        path:"/notification-filter",
        Component:NotificationFilter
    }
]
export default Routes;