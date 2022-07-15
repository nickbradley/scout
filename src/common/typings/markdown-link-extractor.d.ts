declare module "markdown-link-extractor" {
    function markdownLinkExtractor<T extends boolean>(markdown: string, extended: T): LinkType<T>[];
    export = markdownLinkExtractor;
}

interface LinkMetadata {
    type: "link";
    raw: string;
    href: string;
    title: string | null;
    text: string;
    tokens: any[];
}

type LinkType<T> = T extends false ? string : LinkMetadata;
