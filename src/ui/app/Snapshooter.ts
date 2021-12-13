/* eslint-disable */
// @ts-nocheck
"use strict";

/**
 * Snapshooter is responsible for returning HTML and computed CSS of all nodes from selected DOM subtree.
 *
 * @param HTMLElement root Root node for the subtree that will be processed
 * @returns {*} object with HTML as a string and CSS as an array of arrays of css properties
 */
export function Snapshooter(root) {
    "use strict";
    // list of shorthand properties based on CSSShorthands.in from the Chromium code (https://code.google.com/p/chromium/codesearch)
    // TODO this list should not be hardcoded here
    var shorthandProperties = {
        'animation': 'animation',
        'background': 'background',
        'border': 'border',
        'border-top': 'borderTop',
        'border-right': 'borderRight',
        'border-bottom': 'borderBottom',
        'border-left': 'borderLeft',
        'border-width': 'borderWidth',
        'border-color': 'borderColor',
        'border-style': 'borderStyle',
        'border-radius': 'borderRadius',
        'border-image': 'borderImage',
        'border-spacing': 'borderSpacing',
        'flex': 'flex',
        'flex-flow': 'flexFlow',
        'font': 'font',
        'grid-area': 'gridArea',
        'grid-column': 'gridColumn',
        'grid-row': 'gridRow',
        'list-style': 'listStyle',
        'margin': 'margin',
        'marker': 'marker',
        'outline': 'outline',
        'overflow': 'overflow',
        'padding': 'padding',
        'text-decoration': 'textDecoration',
        'transition': 'transition',
        '-webkit-border-after': 'webkitBorderAfter',
        '-webkit-border-before': 'webkitBorderBefore',
        '-webkit-border-end': 'webkitBorderEnd',
        '-webkit-border-start': 'webkitBorderStart',
        '-webkit-columns': 'webkitBorderColumns',
        '-webkit-column-rule': 'webkitBorderColumnRule',
        '-webkit-margin-collapse': 'webkitMarginCollapse',
        '-webkit-mask': 'webkitMask',
        '-webkit-mask-position': 'webkitMaskPosition',
        '-webkit-mask-repeat': 'webkitMaskRepeat',
        '-webkit-text-emphasis': 'webkitTextEmphasis',
        '-webkit-transition': 'webkitTransition',
        '-webkit-transform-origin': 'webkitTransformOrigin'
    }, idCounter = 1;
    /**
     * Changes CSSStyleDeclaration to simple Object removing unwanted properties ('1','2','parentRule','cssText' etc.) in the process.
     *
     * @param CSSStyleDeclaration style
     * @returns {}
     */
    function styleDeclarationToSimpleObject(style) {
        var i, l, cssName, camelCaseName, output = {};
        const excludeStyles = ["height", "width", "block-size", "perspective-origin", "inline-size", "transform-origin", "-webkit-transform-origin", "webkitTransformOrigin", "grid-template-columns", "grid-template-rows"];
        for (i = 0, l = style.length; i < l; i++) {
            if (!excludeStyles.includes(style[i])) {
                output[style[i]] = style[style[i]];
            }
        }
        // Work around http://crbug.com/313670 (the "content" property is not present as a computed style indexed property value).
        output.content = fixContentProperty(style.content);
        // Since shorthand properties are not available in the indexed array, copy them from named properties
        for (cssName in shorthandProperties) {
            if (shorthandProperties.hasOwnProperty(cssName)) {
                camelCaseName = shorthandProperties[cssName];
                output[cssName] = style[camelCaseName];
            }
        }
        return output;
    }
    // Partial workaround for http://crbug.com/315028 (single words in the "content" property are not wrapped with quotes)
    function fixContentProperty(content) {
        var values, output, value, i, l;
        output = [];
        if (content) {
            //content property can take multiple values - we need to split them up
            //FIXME this won't work for '\''
            values = content.match(/(?:[^\s']+|'[^']*')+/g);
            for (i = 0, l = values.length; i < l; i++) {
                value = values[i];
                if (value.match(/^(url\()|(attr\()|normal|none|open-quote|close-quote|no-open-quote|no-close-quote|chapter_counter|'/g)) {
                    output.push(value);
                }
                else {
                    output.push("'" + value + "'");
                }
            }
        }
        return output.join(' ');
    }
    function createID(node) {
        //":snappysnippet_prefix:" is a prefix placeholder
        return ':snappysnippet_prefix:' + node.tagName + '_' + idCounter++;
    }
    function dumpCSS(node, pseudoElement) {
        var styles;
        // There is no default view when out page is loaded as srcdoc in iFrame
        styles = node.ownerDocument.defaultView?.getComputedStyle(node, pseudoElement);
        if (pseudoElement) {
            //if we are dealing with pseudoelement, check if 'content' property isn't empty
            //if it is, then we can ignore the whole element
            if (!styles.getPropertyValue('content')) {
                return null;
            }
        }
        if (styles) {
            return styleDeclarationToSimpleObject(styles);
        } else {
            return {};
        }
    }
    function cssObjectForElement(element, omitPseudoElements = true) {
        return {
            id: createID(element),
            tagName: element.tagName,
            node: dumpCSS(element, null),
            before: omitPseudoElements ? null : dumpCSS(element, ':before'),
            after: omitPseudoElements ? null : dumpCSS(element, ':after')
        };
    }
    function ancestorTagHTML(element, closingTag) {
        var i, attr, value, idSeen, result, attributes;
        if (closingTag) {
            return '</' + element.tagName + '>';
        }
        result = '<' + element.tagName;
        attributes = element.attributes;
        for (i = 0; i < attributes.length; ++i) {
            attr = attributes[i];
            if (attr.name.toLowerCase() === 'id') {
                value = createID(element);
                idSeen = true;
            }
            else {
                value = attr.value;
            }
            result += ' ' + attributes[i].name + '="' + value + '"';
        }
        if (!idSeen) {
            result += ' id="' + createID(element) + '"';
        }
        result += '>';
        return result;
    }
    /**
     * Replaces all relative URLs (in images, links etc.) with absolute URLs
     * @param element
     */
    function relativeURLsToAbsoluteURLs(element) {
        switch (element.nodeName) {
            case 'A':
            case 'AREA':
            case 'LINK':
            case 'BASE':
                if (element.hasAttribute('href')) {
                    element.setAttribute('href', element.href);
                }
                break;
            case 'IMG':
            case 'IFRAME':
            case 'INPUT':
            case 'FRAME':
            case 'SCRIPT':
                if (element.hasAttribute('src')) {
                    element.setAttribute('src', element.src);
                }
                break;
            case 'FORM':
                if (element.hasAttribute('action')) {
                    element.setAttribute('action', element.action);
                }
                break;
        }
    }
    function init() {
        var css = [], ancestorCss = [], descendants, descendant, htmlSegments, leadingAncestorHtml, trailingAncestorHtml, reverseAncestors = [], i, l, parent, clone;
        descendants = root.getElementsByTagName('*');
        parent = root.parentElement;
        while (parent && parent !== document.body) {
            reverseAncestors.push(parent);
            parent = parent.parentElement;
        }
        // First we go through all nodes and dump all CSS
        css.push(cssObjectForElement(root));
        for (i = 0, l = descendants.length; i < l; i++) {
            css.push(cssObjectForElement(descendants[i]));
        }
        for (i = reverseAncestors.length - 1; i >= 0; i--) {
            ancestorCss.push(cssObjectForElement(reverseAncestors[i], true));
        }
        // Next we dump all HTML and update IDs
        // Since we don't want to touch original DOM and we want to change IDs, we clone the original DOM subtree
        clone = root.cloneNode(true);
        descendants = clone.getElementsByTagName('*');
        idCounter = 1;
        clone.setAttribute('id', createID(clone));
        for (i = 0, l = descendants.length; i < l; i++) {
            descendant = descendants[i];
            descendant.setAttribute('id', createID(descendant));
            relativeURLsToAbsoluteURLs(descendant);
        }
        // Build leading and trailing HTML for ancestors
        htmlSegments = [];
        for (i = reverseAncestors.length - 1; i >= 0; i--) {
            htmlSegments.push(ancestorTagHTML(reverseAncestors[i]));
        }
        leadingAncestorHtml = htmlSegments.join('');
        htmlSegments = [];
        for (i = 0, l = reverseAncestors.length; i < l; i++) {
            htmlSegments.push(ancestorTagHTML(reverseAncestors[i], true));
        }
        trailingAncestorHtml = htmlSegments.join('');
        return JSON.stringify({
            html: clone.outerHTML,
            leadingAncestorHtml: leadingAncestorHtml,
            trailingAncestorHtml: trailingAncestorHtml,
            css: css,
            ancestorCss: ancestorCss
        });
    }
    return init();
}

/**
 * Utility that transforms object representing CSS rules to actual CSS code.
 *
 * @constructor
 */
export function CSSStringifier() {
    "use strict";
    function propertiesToString(properties) {
        var propertyName, output = "";
        for (propertyName in properties) {
            if (properties.hasOwnProperty(propertyName)) {
                output += "    " + propertyName + ": " + properties[propertyName] + ";\n";
            }
        }
        return output;
    }
    function printIDs(ids, pseudoElement) {
        var i, l, idString, output = [];
        if (!(ids instanceof Array)) {
            ids = [ids];
        }
        for (i = 0, l = ids.length; i < l; i++) {
            idString = '#' + ids[i];
            if (pseudoElement) {
                idString += pseudoElement;
            }
            output.push(idString);
        }
        return output.join(', ');
    }
    this.process = function (styles) {
        var i, l, style, output = "";
        for (i = 0, l = styles.length; i < l; i++) {
            style = styles[i];
            output += printIDs(style.id) + ' {\n';
            output += propertiesToString(style.node);
            output += '}/*' + printIDs(style.id) + '*/\n\n';
            if (style.after) {
                output += printIDs(style.id, ':after') + ' {\n';
                output += propertiesToString(style.after);
                output += '}/*' + printIDs(style.id, ':after') + '*/\n\n';
            }
            if (style.before) {
                output += printIDs(style.id, ':before') + ' {\n';
                output += propertiesToString(style.before);
                output += '}/*' + printIDs(style.id, ':before') + '*/\n\n';
            }
        }
        return output;
    };
}
/**
 * Injects the CSS into the HTML as Style attributes.
 *
 * @constructor
 */
export function HTMLStylesCombiner() {
    "use strict";
    var cursor = 0, stylesMap,
    // constants
    ATTRIBUTE_ENCLOSING_CHARACTERS = ['"', "'"], ESCAPING_CHARACTER = '\\', ID_ATTRIBUTE = "id=", STYLE_ATTRIBUTE = "style=";
    /**
     * Looks for the next 'id' attribute inside a tag. Returns -1 if not found.
     */
    function getNextIdAttributePosition(html, lastCursor) {
        var currentCursor, tagStartCursor, tagEndCursor, idCursor;
        while (lastCursor >= 0) {
            tagStartCursor = html.indexOf("<", lastCursor);
            if (tagStartCursor < 0) {
                return -1;
            }
            tagEndCursor = html.indexOf(">", tagStartCursor);
            if (tagEndCursor < 0) {
                return -1;
            }
            currentCursor = tagStartCursor;
            do {
                idCursor = html.indexOf(ID_ATTRIBUTE, currentCursor);
                if (idCursor < 0) {
                    return -1;
                }
                else if (ATTRIBUTE_ENCLOSING_CHARACTERS.indexOf(html.charAt(idCursor + ID_ATTRIBUTE.length)) < 0) {
                    // Not the right 'id=', look for the next
                    currentCursor++;
                }
                else if (idCursor < tagEndCursor) {
                    // Finally!
                    return idCursor;
                }
            } while (idCursor < tagEndCursor);
            lastCursor = tagEndCursor;
        }
    }
    /**
     * Extracts the attribute value that is in the current position.
     * @param html the text to extract from.
     * @param attributeEnclosingChar the string/character that encloses the value.
     * @returns {*} The value that relates to the closest attribute, or null if not found.
     */
    function extractValueInCurrentPosition(html, attributeEnclosingChar) {
        var idStartIndex, idEndIndex;
        idStartIndex = html.indexOf(attributeEnclosingChar, cursor) + 1;
        idEndIndex = html.indexOf(attributeEnclosingChar, idStartIndex + 1);
        if (idStartIndex < 0 || idEndIndex < 0) {
            return null;
        }
        return html.substring(idStartIndex, idEndIndex);
    }
    /**
     * Converts SnappySnippet's CSS object into a string of CSS properties.
     * @param properties The CSS object to extort.
     * @param attributeEnclosingChar The string/character that encloses values.
     * @returns {string} CSS properties contained in the given object.
     */
    function propertiesToString(properties, attributeEnclosingChar) {
        var propertyName, output = "";
        for (propertyName in properties) {
            if (properties.hasOwnProperty(propertyName)) {
                // Treat those special url() functionals, that sometimes have quotation marks although they are not required
                var propertyValue = properties[propertyName].replace(/url\("(.*)"\)/g, "url($1)").replace(/url\('(.*)'\)/g, "url($1)")
                    .replace(attributeEnclosingChar, ESCAPING_CHARACTER + attributeEnclosingChar);
                output += propertyName + ": " + propertyValue + "; ";
            }
        }
        return output;
    }
    /**
     * Injects style attribute to the current position in the HTML.
     * @param html The text to use.
     * @param styleId What key we are currently on.
     * @param attributeEnclosingChar The string/character that encloses values.
     * @returns {*} the modified string.
     */
    function insertStyleAtIndex(html, styleId, attributeEnclosingChar) {
        var cssStyles = stylesMap[styleId] && stylesMap[styleId].node;
        if (!cssStyles) {
            return html;
        }
        return html.substring(0, cursor) + // The head of the string
            STYLE_ATTRIBUTE + attributeEnclosingChar + // The attribute key
            propertiesToString(stylesMap[styleId].node, attributeEnclosingChar) + // The attribute value
            attributeEnclosingChar + " " + // Closing the value just before the next attribute
            html.substring(cursor); // The tail of the string
    }
    this.process = function (html, styles) {
        var currentId, attributeEnclosingChar;
        // Sanity check
        if (Boolean(html) && Boolean(styles)) {
            // Prepare a lookup dictionary of styles by the respective element id
            stylesMap = styles.map(function (styleObj) {
                var keyValuePair = {};
                keyValuePair[styleObj.id] = styleObj;
                return keyValuePair;
            }).reduce(function (mergedObj, currentObj) {
                return Object.assign(mergedObj, currentObj); //$.extend(mergedObj, currentObj);
            });
            cursor = getNextIdAttributePosition(html, 0);
            while (cursor >= 0) {
                // Make use of the fact that attribute value is always enclosed with the same char (either " or ')
                attributeEnclosingChar = html.charAt(cursor + ID_ATTRIBUTE.length);
                currentId = extractValueInCurrentPosition(html, attributeEnclosingChar);
                if (currentId === null)
                    break;
                html = insertStyleAtIndex(html, currentId, attributeEnclosingChar);
                cursor = getNextIdAttributePosition(html, cursor);
            }
        }
        return html;
    };
}
