import { Fragment } from "./Page";

export default class Block {
  private rect: DOMRect;

  constructor(
    public readonly identifier: string,
    public readonly element: HTMLElement,
    public fragments: Fragment[] | null = null
  ) {
    this.rect = element.getBoundingClientRect();
  }

  public get top(): number {
    return this.rect.top;
  }

  public get right(): number {
    return this.rect.right;
  }

  public get bottom(): number {
    return this.rect.bottom;
  }

  public get left(): number {
    return this.rect.left;
  }

  public get width(): number {
    return this.rect.width;
  }

  public get height(): number {
    return this.rect.height;
  }

  public getBox(): {
    top: number;
    right: number;
    bottom: number;
    left: number;
    width: number;
    height: number;
  } {
    this.rect = this.element.getBoundingClientRect();
    return {
      top: this.top,
      right: this.right,
      bottom: this.bottom,
      left: this.left,
      width: this.width,
      height: this.height,
    };
  }

  public toJSON(): Record<string, any> {
    return {
      identifier: this.identifier,
      top: this.top,
      bottom: this.bottom,
      right: this.right,
      left: this.left,
      width: this.width,
      height: this.height,
    };
  }
}
