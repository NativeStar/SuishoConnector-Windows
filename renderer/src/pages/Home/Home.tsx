import { AppBar } from "~/components/AppBar";
import NavigationRail from "./components/NavigationRail";
import useDevMode from "~/hooks/useDevMode";
import PageRoute,{type PageRouteProps } from "./components/PageRoute";
import { useState } from "react";

export default function Home() {
  useDevMode();
  const [page,setPage]=useState<PageRouteProps["page"]>("home");
  return (
    <>
      <AppBar paddingLeft="3%"/>
      <NavigationRail onChange={setPage}/>
      <PageRoute page={page}/>
    </>
  )
}
