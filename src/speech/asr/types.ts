export type AsrEngineId =
  | "vosk-en"
  | "vosk-ru"
  | "android-en"
  | "android-ru";

export type AsrResultEvent = {
  engine: AsrEngineId;
  type: "partial" | "final";
  text: string;
  isError?: boolean;
  errorCode?: number;
};

export type AsrSessionConfig = {
  engineId: AsrEngineId;
};

