import { clearDb, reseedDb, listAllRows } from "./debugCommands";

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
    testReg
  };

  console.log("✅ Debug API registered: globalThis.dbg");
}
