import { isImportToken, isFunctionToken, CodeToken } from "../../common/types";

export interface Parameter {
  name: string;
  type: string;
}

export default class Signature {
  constructor(
    readonly name: string,
    readonly parameters: Parameter[],
    readonly returnType: string,
    readonly parentType: string
  ) {}

  public equals(signature: Signature): boolean {
    return signature.name === this.name;
  }

  public toString(): string {
    let str = "";
    if (this.parentType) {
      str = `${this.parentType}.`;
    }

    return `${str}${this.name}(${this.parameters
      .map((p) => p || "unknown")
      .join(", ")}): ${this.returnType}`;
  }

  public getContextOverlap(tokens: CodeToken[]): boolean[][] {
    return tokens.map((token) => {
      const matches = Array(this.parameters.length + 2).fill(false);
      if (isImportToken(token) && token.name === this.parentType) {
        matches[0] = true;
      } else if (isFunctionToken(token)) {
        for (const param of token.parameters) {
          if (Signature.compareTypes(param.type.name, this.parentType)) {
            matches[0] = true;
          }

          this.parameters.forEach((arg, i) => {
            if (Signature.compareTypes(param.type.name, arg.type)) {
              matches[i + 1] = true;
            }
          });
        }

        for (const vari of token.variables) {
          if (Signature.compareTypes(vari.type.name, this.parentType)) {
            matches[0] = true;
          }

          this.parameters.forEach((arg, i) => {
            if (Signature.compareTypes(vari.type.name, arg.type)) {
              matches[i + 1] = true;
            }
          });
        }

        if (Signature.compareTypes(token.returnType, this.returnType)) {
          matches[matches.length - 1] = true;
        }
      }
      return matches;
    });
  }

  static prettyPrintType(type: string | undefined): string {
    if (type === undefined || type === "any") {
      return "unknown";
    } else if (type === "RegExp") {
      return "regex";
    } else if (type?.endsWith("}[]")) {
      return "object[]";
    } else if (type?.endsWith("[]") && type?.includes("=>")) {
      return "function[]";
    } else if (type?.startsWith("{")) {
      return "object";
    } else if (type?.startsWith("(")) {
      return "function";
    }
    return type;
  }

  static compareTypes = (t1: string, t2: string): boolean => {
    if (!t1 || !t2 || (t1 === "any" && t2 === "any")) {
      return false;
    }

    if (t1.toLowerCase() === t2.toLowerCase()) {
      return true;
    }

    if (t2.includes("|")) {
      return t2.split("|").some((t) => this.compareTypes(t1, t.trim()));
    }

    const isT1Object = t1?.startsWith("{");
    const isT2Object = t2?.startsWith("{");
    if (isT1Object && isT1Object === isT2Object) {
      return true;
    }

    const isT1Array = t1?.endsWith("[]");
    const isT2Array = t2?.endsWith("[]");
    if (isT1Array && isT1Array === isT2Array) {
      return true;
    }

    const isT1Function = t1?.includes("=>");
    const isT2Function = t2?.includes("=>");
    if (isT1Function && isT1Function === isT2Function) {
      return true;
    }

    return false;
  };
}
