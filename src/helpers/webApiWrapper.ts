const API_URL = "https://script.google.com/macros/s/AKfycbzZuXZ9rAuUyLuLrwRUzKc9jyDc2T38glJCGNk7OVSEA4AHCPY82XeMPbAJs7hQVxr_Fg/exec";


export async function SendDatabaseToCloud() {
const response = await fetch(API_URL, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ 
  methodName: "UpdateRows",
  payload: [{
    uid:"QUTQJ7PQ",
    variants:"blablabla",
    tsr:55
  }]
}),
});

if (!response.ok) {
  throw new Error("HTTP error " + response.status);
}

const data = await response.json();
console.log(data);
}