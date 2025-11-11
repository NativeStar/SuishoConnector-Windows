import { createContext } from "react";

export default createContext<{androidId:string,setAndroidId:(id:string)=>void}>({
    androidId:"",
    setAndroidId:()=>{}
});