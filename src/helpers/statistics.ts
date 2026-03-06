import { TBarChartDataItem, TBarChartItem } from "../components/BarChart";
import { openSpeechDb, SpItem } from "../db/speechDb";


// export enum DiagramPeriod {
//     min1 = 60 * 1000,
//     min5 = 5 * 60 * 1000,
//     min30 = 30 * 60 * 1000,
//     hour = 60 * 60 * 1000
// }

export type TDiagramPeriodName = "1 minute"|"5 minutes"|"30 minutes"|"1 hour"|"1 day"|"5 days";
export const AllDiagramPeriods = '"1 minute"|"5 minutes"|"30 minutes"|"1 hour"|"1 day"|"5 days"'.replace(/"/g,"").split("|");
export function getDiagramPeriodValue(period:TDiagramPeriodName){
    switch (period){
        case "1 minute":
            return 60 * 1000;
        case "5 minutes":
            return 5 * 60 * 1000;     
        case "30 minutes":
            return 30 * 60 * 1000;     
        case "1 hour":
            return 60 * 60 * 1000;     
        case "1 day":
            return 24 * 60 * 60 * 1000;     
        case "5 days":
            return 24 * 60 * 60 * 1000;     
        default:
            throw `Wrong period ${period}`;                
    }
}

export type TResultData = {
    uid:string,
    dateTime:string,
    ts:number,
    mss:number
}

export async function getDataForBarDiagram(currItem: SpItem, periodName: TDiagramPeriodName, isReverse: boolean) {
    const ts = isReverse ? "tsr" : "tsf";
    const mss = isReverse ? "mssr" : "mssf";
    const period = getDiagramPeriodValue(periodName);
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





