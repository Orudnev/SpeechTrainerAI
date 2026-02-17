export type AsrEngineId =
  | "vosk-en"
  | "android-en"
  | "android-ru";

export type AsrResultEvent = {
  engine: AsrEngineId;
  type: "partial" | "final";
  text: string;
};

export type AsrSessionConfig = {
  engineId: AsrEngineId;
};

