export function getWordCount(text: string): number {
  return text.split(" ").filter((word) => word !== " ").length;
}

export function getLineCount(text: string): number {
  return text.split("\n").filter((line) => line.length >= 1).length;
}
