import { useContext, useMemo } from "react";
import { Dexie } from "dexie";
import AndroidIdContext from "~/context/AndroidIdContext";
import type { TransmitTextMessage, TransmitFileMessage, NotificationItem } from "~/types/database";
interface DatabaseObject {
    "transmit": TransmitTextMessage | TransmitFileMessage,
    "notification": NotificationItem
}

function useDatabase<T extends keyof DatabaseObject>(type: T) {
    const { androidId } = useContext(AndroidIdContext);
    const database = useMemo(() => {
        const db = new Dexie(androidId);
        db.version(1).stores({
            transmit: "&timestamp,type,message,from,name,displayName,size,isDeleted,extData",
            notification: "&timestamp,appName,title,content,packageName,extData"
        });
        console.info(`Database type "${type}" initd`);
        return db
    }, [androidId]);
    return {
        getAllData: () => {
            console.debug(`Database "${type}" called getAllData method`);
            return database.table<DatabaseObject[T]>(type).toArray();
        },
        addData: (data: DatabaseObject[T]) => {
            console.debug(`Database "${type}" called addData method`);
            return database.table<DatabaseObject[T]>(type).add(data);
        },
        deleteData: (timestamp: number) => {
            console.debug(`Database "${type}" called deleteData method`);
            return database.table<DatabaseObject[T]>(type).delete(timestamp);
        },
        getData: (timestamp: number) => {
            console.debug(`Database "${type}" called getData method`);
            return database.table<DatabaseObject[T]>(type).get(timestamp);
        },
        clearData: () => {
            console.debug(`Database "${type}" called clearData method`);
            return database.table<DatabaseObject[T]>(type).clear();
        },
        putData: (data: DatabaseObject[T]) => {
            console.debug(`Database "${type}" called putData method`);
            return database.table<DatabaseObject[T]>(type).put(data);
        }
    }
}
export default useDatabase;