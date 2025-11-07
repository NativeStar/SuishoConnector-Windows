import { createContext } from "react";

export default createContext<{androidId:string|null,setAndroidId:(id:string)=>void}>({
    androidId:null,
    setAndroidId:()=>{}
});