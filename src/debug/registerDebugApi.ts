import { executeSql } from "../db/speechDb";
import { clearDb, reseedDb, list,listc, asrinit, asrshutdown, grantFullAccess, fireSpeechResultEvent } from "./debugCommands";
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
    executeSql
  };

  console.log("✅ Debug API registered: globalThis.dbg");
}


