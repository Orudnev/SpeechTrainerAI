export type TSettingName = 'fullAccess'|'reverseMode'|'rowsCloudDataSource'|'selectedTopics';
export type TServiceCommandName = 'downloadRowsFromCloud'|'uploadRowsToCloud';

export type TsettingsItem = {
    name: TSettingName;
    value?: any;
    defaultValue: any;
    needAdvancedRights?: boolean;
}

export const AppSettings: TsettingsItem[] = [
    {
        name: 'fullAccess',
        defaultValue: false,
    },   
    {
        name: 'reverseMode',
        defaultValue: false,
    },
    {
        name: 'selectedTopics',
        defaultValue: [],
    },
    {
        name: 'rowsCloudDataSource',
        defaultValue: '',
        needAdvancedRights: true,
    }
]
