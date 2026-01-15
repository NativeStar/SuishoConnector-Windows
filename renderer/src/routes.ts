import type { RouteObject } from "react-router";

const Routes: RouteObject[] = [
  {
    path: "/connect-phone",
    lazy: async () => ({ Component: (await import("./pages/ConnectPhone/ConnectPhone")).default }),
  },
  {
    path: "/home",
    lazy: async () => ({ Component: (await import("~/pages/Home/Home")).default }),
  },
  {
    path: "/notification-filter",
    lazy: async () => ({ Component: (await import("./pages/NotificationFilter/NotificationFilter")).default }),
  },
];

export default Routes;