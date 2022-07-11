export interface Parameter {
  name?: string;
  type?: string;
}

export interface IsSignature {
  name: string;
  parameters: string[];
}

export class Signature implements IsSignature {
  constructor(
    readonly name: string,
    readonly parameters: string[],
    readonly returnType: string,
    readonly parentType: string | undefined = undefined,
    readonly usage: string,
    readonly definition: string
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
}
