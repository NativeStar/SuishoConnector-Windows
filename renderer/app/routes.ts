import { type RouteConfig, index,route } from "@react-router/dev/routes";

export default [
    // index("pages/ConnectPhone/ConnectPhone.tsx"),
    route("connect-phone","pages/ConnectPhone/ConnectPhone.tsx"),
    route("home","pages/Home/Home.tsx")
] satisfies RouteConfig;
