import { openSpeechDb } from "../db/speechDb";


export enum DiagramPeriod {
    min1 = 60 * 1000,
    min5 = 5 * 60 * 1000,
    min30 = 30 * 60 * 1000,
    hour = 60 * 60 * 1000
}




export function GetDataForBarDiagram(period: DiagramPeriod,isReverse:boolean) {
    const ts = isReverse ? "tsr" : "tsf"; 
    const mss = isReverse ? "msr" : "msf"; 
    const slqQuery = `
        SELECT uid,
            datetime(CAST((${ts} / ${period}) * ${period} AS INTEGER) / 1000, 'unixepoch', 'localtime') AS access_time,
                CAST((${ts} / ${period}) * ${period} AS INTEGER) AS time_ms,
                    AVG(mssf) AS mssf FROM result 
        WHERE tsf > 0 
        AND uid = 'TEST2' 
        AND tsf >= strftime('%s', 'now', 'start of day', 'localtime') * 1000 
        AND tsf < strftime('%s', 'now', 'start of day', '+1 day', 'localtime') * 1000  
        GROUP BY uid, (tsf / 300000) 
        ORDER BY uid, time_ms;
            `;


    const db = await openSpeechDb();
    const res = await db.executeSql(`SELECT * FROM phrases ORDER BY topic;`);

}





