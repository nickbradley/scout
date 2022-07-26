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

export type ContextToken = LanguageToken | LibraryToken | CallToken;


export interface AppConfig {
  // bingApiToken: string;
  serpApiToken: string;
  // studyMode: "baseline" | "treatment";
}

export interface CancellationToken {
  cancel: () => void;
}

export interface Identifier {
  name: string;
  type?: string;
}

export interface CallSignature {
  readonly text: string;
  readonly name: string;
  readonly arguments: Array<{ name: string; type: string }>;
  readonly returnType: string;
  readonly parentType: string | undefined;
  readonly usage: string;
  readonly definition: string;
}

export type StackOverflowCallSignature = CallSignature & {
  answerId: string;
  answerUrl: string;
  voteCount: number;
  isAccepted: boolean;
  lastModified?: Date;
};