import { executeSql } from "../db/speechDb";
import { getDataForBarDiagram } from "../helpers/statistics";
import { clearDb, reseedDb, list,listc, asrinit, asrshutdown, 
grantFullAccess, fireSpeechResultEvent,getSelTopicItems,printObjectArray,test } from "./debugCommands";
export const testReg = ()=>{
    console.log("blablabla");
};

export function registerDebugApi() {
  if (!__DEV__) return;

  // Создаём глобальный объект dbg
  (global as any).dbg = {
    clearDb,
    reseedDb,
    list,
    listc,
    testReg,
    asrinit,
    asrshutdown,
    grantFullAccess,
    fireSpeechResultEvent,
    executeSql,
    getSelTopicItems,
    printObjectArray,
    test
  };

  console.log("✅ Debug API registered: globalThis.dbg");
}


