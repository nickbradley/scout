export interface LanguageToken {
    kind: "language";
    value: string;
}
export interface LibraryToken {
    kind: "library";
    value: string;
    docSites: string[];
    typings: string[];
}
export interface CallToken {
    kind: "call";
    value: string;
}
export declare type ContextToken = LanguageToken | LibraryToken | CallToken;
export interface AppConfig {
    bingApiToken: string;
    serpApiToken: string;
}
