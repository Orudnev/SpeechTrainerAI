import { AppSettings } from "../db/settings";
import { loadAllPhrases, SpItem } from "../db/speechDb";
const API_URL = "https://script.google.com/macros/s/AKfycbz4WxbxI8mHZZFF70H2awGjtF_7JvvwmOoXEIcESlMh1sfQzz-FZROtADzhZcwvCf_mKw/exec";


async function backupSettings(){ 
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      methodName: "BackupSettings",
      payload: AppSettings
    }),
  });
  
}

export async function restoreSettings(){ 
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      methodName: "GetSettings",
    }),
  });

  if (!response.ok) {
    throw new Error("HTTP error " + response.status);
  }

  return response.json();
}


export async function SendDatabaseToCloud(Payload: any) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      methodName: "UpdateRows",
      payload: Payload
    }),
  });

  if (!response.ok) {
    throw new Error("HTTP error " + response.status);
  }

  const data = await response.json();
  console.log(data);
  backupSettings();
}

export async function ReceiveAllRowsFromCloud() {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      methodName: "GetAllRows",
    }),
  });
  return response;
}
