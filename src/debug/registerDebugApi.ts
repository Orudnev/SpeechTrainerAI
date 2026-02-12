import { SendDatabaseToCloud_test } from "../helpers/webApiWrapper";
import { clearDb, reseedDb, listAllRows, asrinit, asrshutdown } from "./debugCommands";

export const testReg = ()=>{
    console.log("blablabla");
};

export function registerDebugApi() {
  if (!__DEV__) return;

  // Создаём глобальный объект dbg
  (global as any).dbg = {
    clearDb,
    reseedDb,
    listAllRows,
    testReg,
    asrinit,
    asrshutdown,
    SendDatabaseToCloud_test
  };

  console.log("✅ Debug API registered: globalThis.dbg");
}


