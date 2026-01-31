
# HTML.js

A repository of HTML-specific client-side JavaScript functions.

## Table of Contents

- [HTML.js](#htmljs)
  - [Table of Contents](#table-of-contents)
  - [Code Documentation](#code-documentation)
  - [Compose Method](#compose-method)
    - [Syntax](#syntax)
      - [Key/Value Semantics](#keyvalue-semantics)
    - [Tree Diagram](#tree-diagram)
    - [Examples](#examples)
      - [1. Simple element](#1-simple-element)
      - [2. Element with attributes and events](#2-element-with-attributes-and-events)
      - [3. Element with multiple children (array shorthand)](#3-element-with-multiple-children-array-shorthand)
      - [4. Element with single child (explicit `$children`)](#4-element-with-single-child-explicit-children)
      - [5. Element with inline modifier](#5-element-with-inline-modifier)
      - [6. Nested Structure](#6-nested-structure)
    - [Usage](#usage)
    - [Notes](#notes)

## Code Documentation

A majority of the usage information for logic in this repository is documented in the JSDocs of the methods in HTML.js. Please see that documentation for details.

## Compose Method

```js
/**
 * @param {Object.<string, any>} source
 */
static Compose(source)
```

Compose a DOM element from a source object or tag string.

Parameter:

- **Name**: source
- **Data Type**: A JavaScript object with a single key and whose value is an object or array. The key is interpreted as the tag name, and value is interpreted as specified below.

You can define:

- Element tags (with optional namespace)
- Attributes and properties
- Event listeners
- Children (single or multiple)
- Inline modifier functions

### Syntax

```text
  source        ::= elementObject

  elementObject ::= { tagName: config }

  tagName       ::= any valid HTML/SVG/MathML tag name
  optionally prefixed with a namespace: "prefix:tag"

  config        ::= object
  | array   // array shorthand - children

  object        ::= { key: value, ... }
````

#### Key/Value Semantics

```text
  style           - applied via HTML.SetStyle(element, value)
  class           - space-separated string, added to element.classList
  $children       - object, Element, Text, or array representing child elements
  $inlineModifier - function(element) called after children, attributes, events, style/class applied
  any other key:
  - value is function - attach as event listener (key = event name)
  - value is array    - treated as children
  - otherwise         - apply as property or attribute
```

### Tree Diagram

Visualizing nested structure:

```text
source
 ├── Element
 ├── Text
 └── Object
      └── tagName
           └── config
                ├── Array
                │     └── children[]
                │           ├── Element
                │           ├── Text
                │           └── Object → recursive elementObject
                │
                └── Object
                      ├── style → style application
                      ├── class → classList.add(...)
                      ├── $children
                      │     ├── single child
                      │     └── array of children
                      ├── $inlineModifier → function(element)
                      ├── eventName → function → addEventListener
                      ├── otherKey → attribute/property
                      └── array value → children shorthand

```

This shows how `Compose()` processes the object:

1. Creates the element
2. Apply attributes and properties
3. Attach event listeners
4. Append children (from `$children` or array shorthand)
5. Call `$inlineModifier` function (if present)
6. Return element

### Examples

#### 1. Simple element

```js
HTML.Compose({ div: {} });
```

#### 2. Element with attributes and events

```js
HTML.Compose({
  div: {
    id: "root",
    click: () => alert("clicked")
  }
});
```

#### 3. Element with multiple children (array shorthand)

```js
HTML.Compose({
  div: [
    "div",
    { div: { click: () => alert("child") } }
  ]
});
```

#### 4. Element with single child (explicit `$children`)

```js
HTML.Compose({
  div: {
    click: () => console.log("root clicked"),
    $children: { div: { click: () => console.log("single child clicked") } }
  }
});
```

#### 5. Element with inline modifier

```js
HTML.Compose({
  div: {
    id: "root",
    $inlineModifier: el => { el.style.border = "2px solid red"; }
  }
});
```

#### 6. Nested Structure

```js
HTML.Compose({
  div: {
    id: "app",
    $children: [
      {
        header: {
          $children: {
            h1: { innerText: "My App" }
          }
        }
      },
      {
        main: {
          $children: [
            { p: { innerText: "Welcome!" } },
            { button: { click: () => alert("Clicked!") } }
          ]
        }
      }
    ]
  }
});
```

### Usage

```js
const element = HTML.Compose({
  div: {
    id: "container",
    class: "card",
    click: () => console.log("container clicked"),
    $children: [
      { h2: { innerText: "Title" } },
      { p: { innerText: "This is a paragraph." } },
      {
        button: {
          innerText: "Click Me",
          click: () => alert("Button clicked!")
        }
      }
    ],
    $inlineModifier: el => el.classList.add("initialized")
  }
});

document.body.appendChild(element);
```

### Notes

- Arrays as config - children shorthand
- `$children` - explicit single or multiple children
- `$inlineModifier` - called after all children, attributes, and events
- Supports HTML, SVG, and MathML elements with namespace detection
- Events are detected automatically when a property value is a function
