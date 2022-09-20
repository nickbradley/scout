export interface ContextToken {
  value: string;
  kind: "language" | "library" | "call";
  position?: TokenPosition;
}

export interface LanguageToken {
  kind: "language";
  value: string;
}

export interface LibraryToken {
  kind: "library";
  value: string;
}

export interface CallToken {
  kind: "call";
  value: string;
}

// export type ContextToken = LanguageToken | LibraryToken | CallToken;


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
  readonly source: string;
}

export type StackOverflowCallSignature = CallSignature & {
  answerId: string;
  answerUrl: string;
  voteCount: number;
  isAccepted: boolean;
  lastModified?: Date;
};

export interface TokenPosition {
  start: number;
  end: number;
}

export interface CodeToken {
  name: string;
  position: TokenPosition | undefined;
  source?: string;
}

export type VariableToken = CodeToken & { type: CodeToken };
export type BoundToken = CodeToken & { type: string, value: any };
export type ImportToken = CodeToken & { module: CodeToken, references: Array<TokenPosition | undefined> };
export type FunctionToken = CodeToken & {
  returnType: string;
  variables: VariableToken[];
  parameters: VariableToken[];
};
export type FunctionCallToken = CodeToken & {
  returnType: string;
  variables: BoundToken[];
  arguments: BoundToken[];
};

export function isImportToken(token: CodeToken): token is ImportToken {
  return typeof (token as any)["module"] === "object";
}

export function isFunctionToken(token: CodeToken): token is FunctionToken {
  return typeof (token as any)["parameters"] === "object";
}

export function isFunctionCallToken(token: CodeToken): token is FunctionCallToken {
  return typeof (token as any)["arguments"] === "object";
}

export interface Recommendation {
  readonly text: string;
  readonly name: string;
  readonly parameters: string[];
  readonly returnType: string;
  readonly parentType: string | undefined;
  readonly examples: Array<{
    answerId: string;
    answerURL: string;
    call: string;
    declaration: string;
    text: string;
  }>;
  readonly metrics: {
    occurrences: number;
    isFromAcceptedAnswer: boolean;
    isFromPopularAnswer: boolean;
    isFromLatestAnswer: boolean;
  };
}