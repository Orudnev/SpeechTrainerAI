import { TBarChartDataItem, TBarChartItem } from "../components/BarChart";
import { getAppSettingValue } from "../db/settings";
import { openSpeechDb, SpItem } from "../db/speechDb";

export type TDiagramPeriodName = "1 min"|"5 min"|"30 min"|"1 hour"|"1 day"|"5 days";
export const AllDiagramPeriods = '"1 min"|"5 min"|"30 min"|"1 hour"|"1 day"|"5 days"'.replace(/"/g,"").split("|");
export function getDiagramPeriodValue(period:TDiagramPeriodName){
    switch (period){
        case "1 min":
            return 60 * 1000;
        case "5 min":
            return 5 * 60 * 1000;     
        case "30 min":
            return 30 * 60 * 1000;     
        case "1 hour":
            return 60 * 60 * 1000;     
        case "1 day":
            return 24 * 60 * 60 * 1000;     
        case "5 days":
            return 5 * 24 * 60 * 60 * 1000;     
        default:
            throw `Wrong period ${period}`;                
    }
}

export type TDiagramScopeName = "Phrase"|"Current Topic"|"All Selected";
export const AllDiagramScopes = '"Phrase"|"Current Topic"|"All Selected"'.replace(/"/g,"").split("|");

export type TResultData = {
    uid:string,
    dateTime:string,
    ts:number,
    mss:number
}

export async function getDataForBarDiagram(isReverse: boolean,currItem?: SpItem) {
    const ts = isReverse ? "tsr" : "tsf";
    const mss = isReverse ? "mssr" : "mssf";
    const periodName = getAppSettingValue('groupingPeriod') as TDiagramPeriodName;
    const scopeName = getAppSettingValue('groupingScope') as TDiagramScopeName;
    const period = getDiagramPeriodValue(periodName);
    let sqlQuery = "";
    if(scopeName === 'Phrase' && currItem){
        sqlQuery = `
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
    } else if(scopeName === 'Current Topic' && currItem){
        sqlQuery = `
            SELECT 
                a.uid,
                datetime(CAST((a.${ts} / ${period}) * ${period} AS INTEGER) / 1000, 'unixepoch', 'localtime') AS dateTime,
                CAST((a.${ts} / ${period}) * ${period} AS INTEGER) AS ts,
                AVG(${mss}) AS mss,
                b.topic
            FROM result a
            INNER JOIN phrases b ON a.uid = b.uid
            WHERE a.${ts} > 0 AND b.topic = '${currItem.topic}'
            GROUP BY (a.${ts} / ${period}) 
            ORDER BY ts;
            `;
    } else if(scopeName === 'All Selected'){
        sqlQuery = `
            SELECT 
                uid,
                datetime(CAST((${ts} / ${period}) * ${period} AS INTEGER) / 1000, 'unixepoch', 'localtime') AS dateTime,
                CAST((${ts} / ${period}) * ${period} AS INTEGER) AS ts,
                AVG(${mss}) AS mss
            FROM result 
            WHERE ${ts} > 0 
            GROUP BY (${ts} / ${period}) 
            ORDER BY ts;
            `;
    }
    const db = await openSpeechDb();
    const res = await db.executeSql(sqlQuery);
    const rows = res[0].rows;
    const items: TBarChartDataItem[] = [];

    function getLabel(sday:string,shours:string,sminutes:string){
        if(periodName.includes('day')){
           return `${sday}`
        } 
        return `${shours}:${sminutes}`; 
    }
    let currMonth = "";
    let currDate = "";
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
        if(periodName.includes('day')){
            if(month !== currMonth){
                currMonth = month; 
                items.push(`${year}-${month}`)
            }
        } else {
            if(currDate !== date){
                currDate = date;
                items.push(date);
            }
        }
        const newItem:TBarChartItem = {
            bottomLabel:getLabel(day,hours,minutes),
            value:resData.mss
        }
        items.push(newItem);
    }
    return items;
}





