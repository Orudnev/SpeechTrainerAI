import { TBarChartDataItem, TBarChartItem } from "../components/BarChart";
import { openSpeechDb, SpItem } from "../db/speechDb";


export enum DiagramPeriod {
    min1 = 60 * 1000,
    min5 = 5 * 60 * 1000,
    min30 = 30 * 60 * 1000,
    hour = 60 * 60 * 1000
}

export type TResultData = {
    uid:string,
    dateTime:string,
    ts:number,
    mss:number
}

export async function getDataForBarDiagram(currItem: SpItem, period: DiagramPeriod, isReverse: boolean) {
    const ts = isReverse ? "tsr" : "tsf";
    const mss = isReverse ? "mssr" : "mssf";
    const slqQuery = `
        SELECT 
            uid,
            datetime(CAST((${ts} / ${period}) * ${period} AS INTEGER) / 1000, 'unixepoch', 'localtime') AS dateTime,
            CAST((${ts} / ${period}) * ${period} AS INTEGER) AS ts,
            AVG(${mss}) AS mss 
        FROM result 
        WHERE ${ts} > 0 
        AND uid = '${currItem.uid}' 
        AND ${ts} >= strftime('%s', 'now', 'localtime','start of day','utc') * 1000 
        AND ${ts} < strftime('%s', 'now', 'localtime','start of day','utc','+1 day') * 1000  
        GROUP BY (${ts} / ${period}) 
        ORDER BY ts;
            `;
    const db = await openSpeechDb();
    const res = await db.executeSql(slqQuery);
    const rows = res[0].rows;
    const items: TBarChartDataItem[] = [];

    // 1 minute interval
    for (let i = 0; i < rows.length; i++) {
        const row = rows.item(i);
        const resData:TResultData = {...row};
        const date = resData.dateTime.substring(0,10);
        const year = date.substring(0,4);
        const month = date.substring(5,7);
        const day = date.substring(8,10);
        const time = resData.dateTime.substring(11);
        const hours = time.substring(0,2);
        const minutes = time.substring(3,5);
        const newItem:TBarChartItem = {
            bottomLabel:`${hours}:${minutes}`,
            value:resData.mss
        }
        items.push(newItem);
    }
    return items;
}





