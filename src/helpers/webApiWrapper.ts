import { loadAllPhrases, SpItem } from "../db/speechDb";

const API_URL = "https://script.google.com/macros/s/AKfycbxhGEMHBsJAuJmpVaZZN0sxu5VTcnX2XE_TOI005QgLoP0NcENfFMZFQ9wWtkoZ99f8-w/exec";


export async function SendDatabaseToCloud_test() {
  let items = await loadAllPhrases();
  //   let payload = [{
  //   uid:"QUTQJ7PQ",
  //   variants:"blablabla",
  //   tsr:55
  // }];
  let payload: any = items.map(r => {
    return { uid: r.uid, topic: r.topic, q: r.q, a: r.a, variants: r.variants }
  });
  SendDatabaseToCloud(payload);
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
}