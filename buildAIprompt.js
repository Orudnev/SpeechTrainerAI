const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const { spawn } = require("child_process");

//SpeechTrainerAI.promptOnly.txt
const promptUrl = "https://drive.google.com/file/d/1wY6x0kFFt3jk2EhFrbVPNbGSiMR88kIM/view?usp=sharing";

const promptUrlTxt = convertGoogleDriveUrlToDownload(promptUrl);
var result = "";

//1 Чтение текста промпта из Google Drive
fetchText(promptUrlTxt)
  .then((data) => { 
    result = data+"\r\n\r\n";
    addFilesContent();
  })
  .catch((err) => {
    console.error("Ошибка при получении текста:", err);
  });


function addFilesContent() {
    // 2 Чтение файлов из проекта
    result += "________________________________________________________________________________________________\r\n";
    result += "Приложение 2. TypeScript Layer\r\n";
    result += "________________________________________________________________________________________________\r\n";
    var filesOfTsLayer = ["App.tsx"];
    filesOfTsLayer.push(...getFilesByMask("./src/*.ts"));
    filesOfTsLayer.push(...getFilesByMask("./src/components/*.tsx"));
    result += getFilesContent(filesOfTsLayer);
    result += "________________________________________________________________________________________________\r\n";
    result += "Приложение 3. Java Layer\r\n";
    result += "________________________________________________________________________________________________\r\n";
    var filesOfJavaLayer = getFilesByMask("./android/app/src/main/java/com/speechtrainerai/*.java");
    filesOfJavaLayer.push(...getFilesByMask("./android/app/src/main/java/com/speechtrainerai/rn_java_connector/*.java"));
    result += getFilesContent(filesOfJavaLayer);

    result += "________________________________________________________________________________________________\r\n";
    result += "Приложение 4. C++ Layer\r\n";
    result += "________________________________________________________________________________________________\r\n";
    var filesOfCppLayer = getFilesByMask("./android/app/src/main/cpp/engine/*.*");
    filesOfCppLayer.push(...getFilesByMask("./android/app/src/main/cpp/jni/*.*"));
    console.log("cpp files:"+filesOfCppLayer);
    result += getFilesContent(filesOfCppLayer);


    // 3 Копирование в буфер обмена
    copyToClipboard(result);
}



function copyToClipboard(text) {
  const ps = spawn("powershell.exe", [
    "-NoProfile",
    "-Command",
    `
    [Console]::InputEncoding = [System.Text.Encoding]::UTF8;
    $text = [Console]::In.ReadToEnd();
    Set-Clipboard -Value $text
    `
  ]);

  ps.stdin.write(text, "utf8");
  ps.stdin.end();

  ps.on("close", (code) => {
    if (code === 0) {
      console.log("✅ Скопировано в буфер обмена (UTF-8 корректно)!");
    } else {
      console.error("❌ Ошибка PowerShell, код:", code);
    }
  });
}

function getFilesContent(fileList) {
  let resultString = "";

  for (let i = 0; i < fileList.length; i++) {
    const filePath = fileList[i];

    // 1.1.1 Получаем имя файла + расширение
    const fileNameAndExt = path.basename(filePath);

    resultString +=
      fileNameAndExt +
      "\r\n" +
      "--------------------------------------\r\n";

    // 1.1.2 Читаем содержимое файла
    const fileText = fs.readFileSync(filePath, "utf8");

    resultString += fileText + "\r\n\r\n";
  }

  return resultString;

  // 1.2 Отправляем результат в буфер обмена
    copyToClipboard(resultString);
  
}

function fetchText(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;

    client
      .get(url, (res) => {
        // --- РЕДИРЕКТЫ ---
        if (
          [301, 302, 303, 307, 308].includes(res.statusCode) &&
          res.headers.location
        ) {
          if (maxRedirects === 0) {
            reject(new Error("Too many redirects"));
            return;
          }

          const newUrl = res.headers.location;
          console.log("➡ Redirect to:", newUrl);

          resolve(fetchText(newUrl, maxRedirects - 1));
          return;
        }

        // --- ОШИБКА ---
        if (res.statusCode !== 200) {
          reject(
            new Error(
              `HTTP Error: ${res.statusCode} (${res.statusMessage})`
            )
          );
          return;
        }

        // --- ЧТЕНИЕ ДАННЫХ ---
        let data = "";

        res.on("data", (chunk) => {
          data += chunk.toString("utf8");
        });

        res.on("end", () => {
          resolve(data);
        });
      })
      .on("error", reject);
  });
}


function convertGoogleDriveUrlToDownload(url) {
  const match = url.match(/file\/d\/([^/]+)/);

  if (!match) {
    throw new Error("Это не ссылка Google Drive file");
  }

  const fileId = match[1];

  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

function convertGoogleDocUrlToTxt(url) {
  const match = url.match(/document\/d\/([^/]+)/);

  if (!match) {
    throw new Error("Это не ссылка Google Docs document");
  }

  const docId = match[1];

  return `https://docs.google.com/document/d/${docId}/export?format=txt`;
}

function getFilesByMask(pattern) {
  // Пример: "C:\folder\*.js"
  const folder = path.dirname(pattern);      // "C:\folder"
  const mask = path.basename(pattern);       // "*.js"

  // Получаем расширение из маски
  const ext = mask.replace("*", "");         // ".js"

  // Читаем все файлы в папке
  const files = fs.readdirSync(folder);

  // Фильтруем по расширению
  if(mask == "*.*" ) {
    return files.map(file => path.join(folder, file));
  }
  const matchedFiles = files
    .filter(file => file.endsWith(ext))
    .map(file => path.join(folder, file));

  return matchedFiles;
}



