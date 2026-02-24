import { clearDb, reseedDb, list,listc, asrinit, asrshutdown, grantFullAccess } from "./debugCommands";
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
  };

  console.log("✅ Debug API registered: globalThis.dbg");
}


