import {
  ContextToken,
  LanguageToken,
  LibraryToken,
  CallToken,
} from "../../common/types";

export default class CodeContext {
  constructor(public readonly tokens: ContextToken[] = []) {}

  public get language(): LanguageToken | undefined {
    return this.tokens.find((t): t is LanguageToken => t.kind === "language");
  }

  public get libraries(): readonly LibraryToken[] {
    return this.tokens.filter((t): t is LibraryToken => t.kind === "library");
  }

  public get calls(): readonly CallToken[] {
    return this.tokens.filter((t): t is CallToken => t.kind === "call");
  }

  public get languageName(): string | undefined {
    return this.language?.value;
  }

  public get libraryNames(): readonly string[] {
    return this.libraries.map((lib) => lib.value);
  }

  public get callNames(): readonly string[] {
    return this.calls.map((call) => call.value);
  }

  isEqual(codeContext: CodeContext): boolean {
    return (
      this.tokens
        .map((t) => t.value)
        .sort()
        .join("") ===
      codeContext.tokens
        .map((t) => t.value)
        .sort()
        .join("")
    );
  }
}
