// noinspection JSUnusedGlobalSymbols

"use strict";

class HTML {

    /**
     * Pass-thru for document.createTextNode(). Creates a new Text node. This method can be used to escape HTML characters.
     * @param data A string containing the data to be put in the text node.
     * @returns {Text} A Text node.
     */
    static CreateTextNode(data) {
        return document.createTextNode(data);
    }

    /**
     * Gets the value of a CSS variable by name from the computed style of the page.
     * @param {string} variableName The name of the CSS variable to obtain. Must include the '--' prefix.
     * @returns {string}
     */
    static GetCssVariable(variableName) {
        return getComputedStyle(document.documentElement).getPropertyValue(variableName);
    }

    /**
     * Sets the style of an element using the supplied style object. NOTE: Existing styles will be maintained if not overridden by the style object provided.
     * @param {HTMLElement} element The HTML element whose style will be modified.
     * @param {object} style The style properties to be merged into the element's style.
     */
    static SetStyle(element, style) {

        // Load Style Object
        let styleObject = HTML.StyleRuleToObject(element.getAttribute("style") ?? "");

        // Modify Style Attributes
        for (let propertyName in style) {
            styleObject[propertyName] = style[propertyName];
        }

        // Load new styles into element
        let newStyleEntries = [];

        for (let propertyName in styleObject) {
            newStyleEntries.push(`${propertyName}: ${styleObject[propertyName]}`);
        }

        element.setAttribute("style", newStyleEntries.join(";"));
    }

    /**
     * Creates an element from the specified HTML string. Note: the element is not added to the document.
     * @param {string} htmlString
     * @returns {Node[]}
     */
    static FromHtml(htmlString) {

        let tempDiv = document.createElement('div');

        tempDiv.innerHTML = htmlString.trim();

        let children = [];

        let node = tempDiv.firstChild;

        if (node instanceof Element) {            

            children.push(node);

            /** @type {Element} */ let element = node;

            while (element !== null && element.nextElementSibling != null) {

                children.push(element.nextSibling);

                const childNode = element.nextSibling;

                if (childNode instanceof Element) {
                    element = childNode;
                } else {
                    element = null;
                }
            }
        }

        return children;
    }

    static #ObjectToElement(obj, subs, parentElement = null) {

        const PreProcessedKeys = {
            style: "style",
            attributes: "attributes",
        };

        function subst(value) {

            if (typeof value === 'string') {
                if (value in subs) {
                    return subs[value];
                }
            } else if (value instanceof HTMLElement) {
                return value;
            } else if (typeof value === 'object') {
                for (const key in value) {
                    // Only attempt here. Attributes/properties may be read-only
                    try {
                        value[key] = subst(value[key]);
                    } catch {}
                }
            }

            return value;
        }

        // HTMLCollections cannot be created, so a host element is required for manipulation
        if (parentElement == null) {
            parentElement = document.createElement("div");
        }

        // Ensure substitution dictionary is available
        if (subs == null) {
            subs = {};
        }

        // Exit early
        if (obj instanceof HTMLElement) {
            parentElement.append(obj);
            return parentElement;
        }

        if (obj == null) {
            return parentElement;
        }

        if (Array.isArray(obj)) {
            for (let i = 0; i < obj.length; i++) {
                HTML.#ObjectToElement(obj[i], subs, parentElement);
            }

            return parentElement;
        }

        // Merge Style and Attributes When Both Are specified
        let attributes = {};
        let style = {};

        if (PreProcessedKeys.attributes in obj) {
            attributes = subst(obj[PreProcessedKeys.attributes]);
        }

        if (PreProcessedKeys.style in obj) {
            style = subst(obj[PreProcessedKeys.style]);
        }

        if (PreProcessedKeys.style in attributes) {

            const inlineStyle = HTML.StyleRuleToObject(HTML.ObjectToStyleRule(attributes[PreProcessedKeys.style]));

            Object.assign(inlineStyle, style);

            delete attributes[PreProcessedKeys.attributes];
        }

        // Process Pre-processed Keys
        for (let attribName in attributes) {
            parentElement.setAttribute(attribName, `${attributes[attribName]}`);
        }

        if (Object.keys(style).length > 0) {
            HTML.SetStyle(parentElement, style);
        }

        // Process Other Keys
        for (const key in obj) {

            if (Object.keys(PreProcessedKeys).includes(key)) continue;

            let value = subst(obj[key]);

            if (key === "children") {

                for (let i = 0; i < value.length; i++) {
                    HTML.#ObjectToElement(value[i], subs, parentElement);
                }

            } else if (key === "properties") {

                for (let propName in value) {
                    parentElement[propName] = value[propName];
                }

            } else if (key === "events") {

                for (let eventName in value) {
                    parentElement.addEventListener(eventName, value[eventName]);
                }

            } else if (key === "inlineModifier") {

                value(parentElement);

            } else if (key === "text") {

                    parentElement.append(HTML.CreateTextNode(value));

            } else {
                parentElement.append(HTML.#ObjectToElement(value, subs, document.createElement(key)));
            }
        }

        return parentElement;
    }

    /**
     * Converts a JavaScript object into an array of HTMLElements.
     * @param {object} obj Object containing specific keys or other objects that will be used to generate HTML elements.
     * @return HTMLElement[]
     */
    static FromObject(obj) {

        // This function expects arrays only.
        if (!Array.isArray(obj)) {
            obj = [obj];
        }

        let elementList = [];

        for (let i = 0; i < obj.length; i++) {

            let childObj = obj[i];

            if (typeof childObj === 'object') {

                if ("tag" in childObj) {

                    // Substitute children for actual HTMLElements
                    if ("children" in childObj && !(childObj.children[0] instanceof HTMLElement)) {
                        childObj.children = HTML.FromObject(childObj.children);
                    }

                    elementList.push(HTML.Create(childObj));
                }
            }
        }

        return elementList;
    }

    /**
     * Creates an HTML element for the specified tag. Note: the element is not added to the document.
     * @param {object} def A JavaScript object representing the definition of the HTML element to be created.
     * @param {string} def.tag The HTML element type (tag) to be created.
     * @param {Object.<string, object>} [def.attributes] An object whose keys will be used to set attributes of the element, such as HREF or SRC. Note that a Style attribute can be passed in as an object, but all other attributes will be handled as strings.
     * @param {Object.<string, any>} [def.style] An object whose keys will be used to set style declarations of the element. This parameter can be included in the attributes object, and if style declarations are specified here and also in the attributes parameter, the style declarations will be merged, with the `style` parameter's declarations taking priority.
     * @param {Object.<string, object>} [def.properties] An object whose keys will be used to set properties of the element, such as innerHTML or innerText.
     * @param {Array.<HTMLElement>} [def.children] An array of HTMLElements which will be registered as child elements for the new element.
     * @param {Object.<string, (event: Event) => void>} [def.events] An object whose keys will be used to create event listeners for the new element.
     * @param {(element: HTMLElement) => void} [def.inlineModifier] A callback allowing custom in-line modification of the element. One example use is to grab a reference to the specific element rather than having to create the element externally and pass it in.
     * @returns {HTMLElement}
     */
    static Create({tag, attributes = null, style = null, properties = null, children = null, events = null, inlineModifier = null}) {

        const styleKey = "style";

        // Provide Default Parameters
        if (attributes === undefined || attributes == null) {
            attributes = {};
        }

        if (!(style === undefined || style == null)) {

            // If present in attributes as well, merge Style object into Attributes Style object
            if (styleKey in attributes) {

                attributes[styleKey] = HTML.StyleRuleToObject(HTML.ObjectToStyleRule(attributes[styleKey]));

                Object.assign(attributes[styleKey], style);
            } else {
                attributes[styleKey] = style;
            }
        }

        if (properties === undefined || properties == null) {
            properties = {};
        }

        if (children === undefined || children == null) {
            children = [];
        }

        if (events === undefined || events == null) {
            // noinspection JSValidateTypes
            events = {};
        }

        // Generate element and set configuration
        let element = document.createElement(tag);

        for (let attribName in attributes) {

            if (attribName.toLowerCase() === styleKey) {
                element.setAttribute(attribName, HTML.ObjectToStyleRule(attributes[attribName]));
            } else {
                element.setAttribute(attribName, `${attributes[attribName]}`);
            }
        }

        for (let propName in properties) {
            element[propName] = properties[propName];
        }

        for (let childIndex = 0; childIndex < children.length; childIndex++) {
            if (children[childIndex] != null) {
                element.append(children[childIndex]);
            }
        }

        for (let eventName in events) {
            element.addEventListener(eventName, events[eventName]);
        }

        if (inlineModifier !== undefined && inlineModifier !== null) {
            inlineModifier(element);
        }

        return element;
    }

    /**
     * Converts a Style-rule string into an object representing Style declarations.
     * @param {string} styleString The style-rule string containing styling declarations.
     * @returns {object} An object representing Style declarations.
     */
    static StyleRuleToObject(styleString) {

        let styleObj = {};

        if (styleString.length < 1) return styleObj;

        let inQuote = false;

        // Extract Declarations
        let declaration = [];
        let key = "";

        for (let i = 0; i < styleString.length; i++) {

            const c = styleString[i];

            if (c === "\"") {
                inQuote = !inQuote;
            }

            if (c === ":" && key.length < 1) {
                key = declaration.join("").trim();
                declaration = [];
                continue;
            }

            if (c === ";" && !inQuote) {

                if (key.length > 0) {
                    styleObj[key] = declaration.join("").trim();
                }

                key = "";
                declaration = [];

            } else {
                declaration.push(c);
            }
        }

        if (key.length > 0) {
            styleObj[key] = declaration.join("").trim();
        }

        return styleObj;
    }

    /**
     * Converts an object representing Style declarations into a Style-rule string.
     * @param {object} styleObj The object containing style declarations. If this parameter is not an object, the parameter is returned immediately, with the assumption it is already a string formatted as a style rule.
     * @returns {*|string} A style-rule string consisting of style declarations separated by semicolons.
     */
    static ObjectToStyleRule(styleObj) {

        if (!(typeof styleObj === 'object' && styleObj !== null)) return styleObj;

        let sb = [];

        for (let styleAttrib in styleObj) {
            sb.push(`${styleAttrib}: ${styleObj[styleAttrib]};`);
        }

        return sb.join(" ");
    }

    /**
     * Gets the minimum and maximum numeric z-indexes of a parent element's children using computed styles.
     * @param {HTMLElement} parentElement The parent element to evaluate for z-indexes.
     * @returns {{min: number, max: number}}
     */
    static GetZIndexRange(parentElement) {

        const InitialMinZIndex = 32000;
        const InitialMaxZIndex = -32000;

        let minZIndex = InitialMinZIndex;
        let maxZIndex = InitialMaxZIndex;
        let allElements = parentElement.getElementsByTagName('*');

        for (let i = 0; i < allElements.length; i++) {

            let zIndex = parseFloat(window.getComputedStyle(allElements[i]).zIndex);

            if (!isNaN(zIndex) && zIndex < minZIndex) {
                minZIndex = zIndex;
            }

            if (!isNaN(zIndex) && zIndex > maxZIndex) {
                maxZIndex = zIndex;
            }
        }

        if (minZIndex === InitialMinZIndex) {
            minZIndex = 0;
        }

        if (maxZIndex === InitialMaxZIndex) {
            maxZIndex = 0;
        }

        return {min: minZIndex, max: maxZIndex};
    }

    /**
     * Converts an HTMLCollection to a simple array.
     * @param {HTMLCollection} htmlCollection
     */
    static HtmlCollectionToArray(htmlCollection) {

        let array = [];

        for (let i = 0; i < htmlCollection.length; i++) {
            array.push(htmlCollection[i]);
        }

        return array;
    }
}