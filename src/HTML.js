class HTML {

    /**
     * Pass-thru for document.createTextNode(). Creates a new Text node. This method can be used to escape HTML characters.
     * @param {string} data A string containing the data to be put in the text node.
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
     * @param {Object.<string, string>} style The style properties to be merged into the element's style.
     */
    static SetStyle(element, style) {

        // Load Style Object
        /** @type {Object.<string, any>} */
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
     * @returns {ChildNode[]}
     */
    static FromHtml(htmlString) {

        let tempDiv = document.createElement('div');

        tempDiv.innerHTML = htmlString.trim();

        /** @type {ChildNode[]} */
        let children = [];

        let node = tempDiv.firstChild;

        if (node instanceof Element) {            

            children.push(node);

            /** @type {Element?} */ let element = node;

            while (element !== null && element.nextElementSibling != null) {

                /** @type {ChildNode?} */
                const childNode = element.nextSibling;

                if (childNode !== null) children.push(childNode);

                if (childNode instanceof Element) {
                    element = childNode;
                } else {
                    element = null;
                }
            }
        }

        return children;
    }

    /**
     * Compose a DOM element from a source object. Full syntax specification in README.md associated with this library. **Syntax below**.
     * 
     * @param {Object.<string, any>} source A JavaScript object that defines the source of the element. Full syntax specification in README.md associated with this library.
     * @returns {Element} An element composed from the source definition.
     * 
     * ---
     * 
     * **Syntax**
     * 
     * ```text
     * tagName ::= any valid HTML/SVG/MathML tag name, optionally prefixed with a namespace: "namespace:tag"
     * 
     * source  ::= elementObject          elementObject ::= { tagName: config }
     * 
     * config  ::= object | source[]      object        ::= { key: value, ... }
     * ````
     * 
     * **Key/Value Semantics**
     * 
     * ```text
     *   $children       - object or array representing child elements
     *   $inlineModifier - function(element) called after attributes/events/children applied
     *   any other key:
     *       - value is function - attach as event listener (key = event name)
     *       - value is array    - treated as children
     *       - otherwise         - apply as property or attribute
     * ```
     */

    /**
     * Compose a DOM element from a source object, an existing Element, or a Text node.
     *
     * @param {(
     *   {
     *     [tagName: string]: (
     *       {
     *         style?: object | string,
     *         class?: string,
     *         $children?: (Object|Element|Text) | Array<Object|Element|Text>,
     *         $inlineModifier?: (el: Element) => void,
     *         [key: string]: any
     *       } | Array<Object|Element|Text> | Element | Text
     *     )
     *   }
     * )} source The element source definition.
     *
     * @returns {Element} The composed DOM element.
     * 
     * **Extended Backus-Naur Form**
     * 
     * ```text
     * source        ::= elementObject
     *
     * elementObject ::= { tagName: config }
     *
     * tagName       ::= any valid HTML/SVG/MathML tag name
     *                  optionally prefixed with a namespace: "prefix:tag"
     *
     * config        ::= object
     *                 | array   // array shorthand → children
     *
     * object        ::= { key: value, ... }
     *
     * key/value semantics:
     *
     *   style           → applied via HTML.SetStyle(element, value)
     *   class           → space-separated string, added to element.classList
     *   $children       → object, Element, Text, or array representing child elements
     *   $inlineModifier → function(element) called after children, attributes, events, style/class applied
     *   any other key:
     *       - value is function → attach as event listener (key = event name)
     *       - value is array    → treated as children
     *       - otherwise         → apply as property or attribute
     * ```
     */
    static Compose(source) {

        if (source == null) {
            throw new Error("No composition source provided.");
        }

        if (typeof source === "object") {

            const [tag, config] = Object.entries(source)[0];

            const element = this.#ComposeCreateElementFromTag(tag);

            // Helper to process a child (Element, Text, string, or object)
            const appendChild = (/** @type {Element|Text|Object.<string, any>} */ child) => {

                if (child instanceof Element || child instanceof Text) {
                    element.appendChild(child);
                } else if (typeof child === "object") {
                    element.appendChild(this.Compose(child));
                }
            };

            // Array shorthand - multiple children
            if (Array.isArray(config)) {
                for (const child of config) {
                    appendChild(child);
                }
            }
            // Object config - process keys
            else if (config && typeof config === "object") {

                for (const [key, value] of Object.entries(config)) {

                    if (key === "style") {

                        if (!(element instanceof HTMLElement)) continue;

                        HTML.SetStyle(element, value);
                    }
                    else if (key === "class") {

                        const classList = String(value).split(" ");

                        for (const className of classList) {
                            element.classList.add(className);
                        }
                    }
                    else if (key === "$children") {
                        if (Array.isArray(value)) {
                            for (const child of value) appendChild(child);
                        } else {
                            appendChild(value);
                        }
                    }
                    else if (key === "$inlineModifier") {
                        // Skip for now, call after loop
                        continue;
                    }
                    else if (typeof value === "function") {
                        element.addEventListener(key, value);
                    }
                    else if (Array.isArray(value)) {
                        for (const child of value) appendChild(child);
                    }
                    else {
                        this.#ComposeApplyAttributeOrProperty(element, key, value);
                    }
                }

                // Call inline modifier if present
                if ("$inlineModifier" in config && typeof config["$inlineModifier"] === "function") {
                    config["$inlineModifier"](element);
                }
            }

            return element;
        }

        throw new Error("Invalid composition source.");
    }


    /**
     * @param {string} tagSpec Tag names can include a namespace. Format: <namespace>:<tag>
     * @returns {Element}
     */
    static #ComposeCreateElementFromTag(tagSpec) {

        if (tagSpec == null) {
            throw new Error("No tag specification provided.")
        }

        tagSpec = tagSpec.toLowerCase();

        /** @type {Object.<string, string>} */
        const nsMap = {
            svg: "http://www.w3.org/2000/svg",
            math: "http://www.w3.org/1998/Math/MathML"
        };

        const lastColon = tagSpec.lastIndexOf(":");

        let namespace = null;
        let tag = tagSpec;

        if (lastColon > 0) {

            namespace = tagSpec.slice(0, lastColon);

            tag = tagSpec.slice(lastColon + 1);

            if (!(namespace.includes("/") || namespace.includes(":"))) {

                // This is a prefix like "svg" or "math"
                namespace = nsMap[namespace];

                if (!namespace) throw new Error(`Unknown namespace prefix: ${namespace}`);
            }
        } else { // Hard-coded detection for common SVG/MathML tags if no prefix is given

            const svgTags = new Set([
                "svg","circle","rect","ellipse","line","polygon","polyline",
                "path","g","text","tspan","defs","use","clipPath","mask",
                "symbol","marker"
            ]);

            const mathTags = new Set([
                "math","mi","mn","mo","mfrac","msqrt","msub","msup",
                "msubsup","mrow","mtable","mtr","mtd"
            ]);

            if (svgTags.has(tag)) namespace = nsMap["svg"];

            else if (mathTags.has(tag)) namespace = nsMap["math"];
        }

        return namespace ? document.createElementNS(namespace, tag) : document.createElement(tag);
    }

    /**
     * Applies a value to the specified property of an element.
     * @param {Element} element Element to be modified.
     * @param {string} propertyName Name of property to be modified.
     * @param {any} value Value to assign to the property.
     */
    static SetElementProperty(element, propertyName, value) {
        /** @type {any} */
        const elementAsAny = element;

        elementAsAny[propertyName] = value;
    }

    
    /**
     * Set either a property or attribute value.
     * 
     * @param {Element} element 
     * @param {string} key 
     * @param {any} value 
     */
    static #ComposeApplyAttributeOrProperty(element, key, value) {
        
        if (key in element) {

            HTML.SetElementProperty(element, key, value);

        } else {
            element.setAttribute(key, String(value));
        }
    }

    /**
     * Creates an HTML element for the specified tag. Note: the element is not added to the document.
     * @param {object} def A JavaScript object representing the definition of the HTML element to be created.
     * @param {string} def.tag The HTML element type (tag) to be created.
     * @param {Object.<string, any>?} [def.attributes] An object whose keys will be used to set attributes of the element, such as HREF or SRC. Note that a Style attribute can be passed in as an object, but all other attributes will be handled as strings.
     * @param {Object.<string, any>?} [def.style] An object whose keys will be used to set style declarations of the element. This parameter can be included in the attributes object, and if style declarations are specified here and also in the attributes parameter, the style declarations will be merged, with the `style` parameter's declarations taking priority.
     * @param {Object.<string, any>?} [def.properties] An object whose keys will be used to set properties of the element, such as innerHTML or innerText.
     * @param {Array.<HTMLElement>?} [def.children] An array of HTMLElements which will be registered as child elements for the new element.
     * @param {Object.<string, (event: Event) => void>?} [def.events] An object whose keys will be used to create event listeners for the new element.
     * @param {((element: HTMLElement) => void)?} [def.inlineModifier] A callback allowing custom in-line modification of the element. One example use is to grab a reference to the specific element rather than having to create the element externally and pass it in.
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

            HTML.SetElementProperty(element, propName, properties[propName]);
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

        /** @type {Object.<string, any>} */
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
     * @param {any} styleObj The object containing style declarations. If this parameter is not an object, the parameter is returned immediately, with the assumption it is already a string formatted as a style rule.
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