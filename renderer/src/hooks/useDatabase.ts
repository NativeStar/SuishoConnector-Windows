import { useContext, useMemo } from "react";
import { Dexie } from "dexie";
import AndroidIdContext from "~/context/AndroidIdContext";
import type { TransmitTextMessage ,TransmitFileMessage} from "~/types/database";
interface DatabaseObject {
    "transmit": TransmitTextMessage|TransmitFileMessage,
    "notification": {},
}

function useDatabase<T extends keyof DatabaseObject>(type: T) {
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
        getAllData: () => {
            return database.table<DatabaseObject[T]>(type).toArray();
        },
        addData: (data: DatabaseObject[T]) => {
            return database.table<DatabaseObject[T]>(type).add(data);
        },
        deleteData: (timestamp: number) => {
            return database.table<DatabaseObject[T]>(type).delete(timestamp);
        },
        getData: (timestamp: number) => {
            return database.table<DatabaseObject[T]>(type).get(timestamp);
        },
        clearData: () => {
            return database.table<DatabaseObject[T]>(type).clear();
        },
        putData: (data: DatabaseObject[T]) => {
            return database.table<DatabaseObject[T]>(type).put(data);
        }
    }
}
export default useDatabase;