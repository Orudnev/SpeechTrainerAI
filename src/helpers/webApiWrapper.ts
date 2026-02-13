import { loadAllPhrases, SpItem } from "../db/speechDb";

const API_URL = "https://script.google.com/macros/s/AKfycbwS8blQc2ycTE2m4bLFKFmlEbHBmTRlWTXPWcvZCwcMOBobTFjG6ERxDtlolrw6Nrv3Cg/exec";




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
