import { AppSettings } from "../db/settings";
import { loadAllPhrases, SpItem } from "../db/speechDb";
const API_URL = "https://script.google.com/macros/s/AKfycbwBXGOkKmUKYpnUywHlYvT9eK8e2-KZ6ys34VhLHkatjqcX3LF2fjs4OfOV4TcMPqsp8w/exec";


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
