export type AsrEngineId =
  | "vosk-en"
  | "android-ru"; // будущий

export type AsrResultEvent = {
  engine: AsrEngineId;
  type: "partial" | "final";
  text: string;
};

export type AsrSessionConfig = {
  engineId: AsrEngineId;
};

