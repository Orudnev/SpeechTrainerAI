declare module "react-native-sqlite-storage" {
  export interface SQLiteDatabase {
    executeSql(
      statement: string,
      params?: any[]
    ): Promise<[any]>;
  }

  export interface OpenDatabaseParams {
    name: string;
    location?: string;
  }

  export function enablePromise(value: boolean): void;

  export function openDatabase(
    params: OpenDatabaseParams
  ): Promise<SQLiteDatabase>;

  const SQLite: {
    enablePromise: typeof enablePromise;
    openDatabase: typeof openDatabase;
  };

  export default SQLite;
}
