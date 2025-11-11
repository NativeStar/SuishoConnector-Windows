import { useContext, useMemo } from "react";
import { Dexie } from "dexie";
import AndroidIdContext from "~/context/AndroidIdContext";
type DatabaseType = "transmit" | "notification";
function useDatabase() {
    const { androidId } = useContext(AndroidIdContext);
    const database = useMemo(() => {
        const db = new Dexie(androidId);
        db.version(1).stores({
            transmit: "&timestamp,type,message,from,name,displayName,size,isDeleted,extData",
            notification: "&timestamp,appName,title,content,packageName,extData"
        });
        return db
    }, [androidId]);
    return {
        getAllData:(type:DatabaseType)=>{
            return database.table(type).toArray();
        }
    }
}
export default useDatabase;