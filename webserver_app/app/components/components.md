# Components requirements and guidelines
The following rules must be followed when implementing a component, such that the proper metadata and online help documentation can be generated.

## Component requirements
The component doc string must be placed before the Stencil `@component` declaration.
It should contain a short description of the component's function and the following attributes.

* `@demo` the demo page relative path to the component folder.
* `@label` the name to display in the designer's palette.
* `@group` the group name to put the component into in the designer's palette.
* `@container` sets to `true` and indicates the element can container other elements.
* `@border` sets to `true` and indicates the element can have border styles in the Designer's styles view.
* `@hidden` sets to `true` and hides the component in the designer's palette.
* `@archetype` the html template string for the element that the designer will add (optional).
* `@css` a custom css variable used for the component.

## Property requirements
The property doc string must be placed before the `@Prop()` declaration.
It contains a short description of the property's function and the following attributes.

* `@hidden` sets to `true` and hides the property in the designer's properties view.
* `@order` specifies the order of the property to display in the designer's properties view.
* `@nosave` sets to `true` and does not save property changes to the element's attribute.
* `@if` sets to `true` for making the property visible if and only if another property has the specified value.
* `@displayAs` TODO: how to override the widget to use select for text value.

#### Usage
The `@Prop()` declaration must include the **type** and its **default value**:
```
@Prop() value: string = 'hello world!';
```

## Event requirements
The event doc string with a short description of the event's function must be placed before the `@Event()` declaration.

To support two way data binding, any internal property value change must `emit` a property changed event to propagate the change to other bounded properties. The event detail object must contain both `value` and `oldValue` properties.

#### Usage
The `@Event` declaration must have the `eventName` attribute in **dash case** and the `EventEmitter` must have include the type declaration.
```
@Event({ eventName: 'value-changed' })
valueChanged: EventEmitter<{ value: string, oldValue: string }>;
```

## Method requirements
The method doc string with a short description of the method's function must be placed before the `@Method()` declaration.

#### Usage
The `@Method` declaration must be `async` with camel casing method name and parameter(s). Parameter(s) and return value must be typed.
```
@Method()
async refresh(force: boolean): Promise<void> { ... }
```

# CSS Styles
Component local css style rules need to be defined in an external `scss` file. Font stylings and color values should be defined in the global `variables.scss` file and not in the component local `scss` file.

## Custom CSS variable requirements
Use the `@css` tag in the component docstring for each custom css variable used.

#### Usage
It must be documented in this format:

`custom-css-property` | String Description | `defaultValue`

The CSS custom variable name must be in **dash-case** and be prefixed with two hyphens.
#### Example

```
// inside the docstring
@css `--gc-widget-label-color`| label color | `--ti-font-color`
@css `--gc-widget-label-hover-color` | on hover font color | `--gc-widget-label-color`
@css `--gc-widget-label-hover-underline-color` | on hover underline color | `unset`
```

# Demo index.html guidelines
// TODO

# Usage documentation guidelines
Note: `usage.md` will not be shown in the documentation page yet.

Include a markdown file in the root folder of the component titled `usage.md`.

For each example you want to show, use the following template.

 ```
 <!-- example-start -->
 <div>
    <!-- Regular -->
    <ti-component-example value="some text value"></ti-component-example>

    <!-- Disabled  -->
    <ti-component-example value="some text value" disabled></ti-component-example>
 </div>
 <!-- example-end -->
 ```

# Component order values guidelines
The following `@order` value should be used to group and to order the property in the Properties view based on frequency when the user changes the property value.
The properties are display from smallest value to highest value in the Properties view. Duplicated values are grouped together.

 | Categories/Properties       | Values    | Examples                                                                 |
 | --------------------------- | --------- | ------------------------------------------------------------------------ |
 | **Primary**                 | 2 - 99    | value, checked, text, on, etc                                            |
 | **Secondary**               | 100 - 199 | legend, display format, etc                                              |
 | **Tertiary**                | 200 - 299 | hidden, readonly, disabled, caption, info-text, error-text, tooltip, etc |
 | &nbsp;&nbsp;&nbsp;hidden    | 200       |
 | &nbsp;&nbsp;&nbsp;readonly  | 201       |
 | &nbsp;&nbsp;&nbsp;disabled  | 202       |
 | &nbsp;&nbsp;&nbsp;caption   | 207       |
 | &nbsp;&nbsp;&nbsp;infoText  | 208       |
 | &nbsp;&nbsp;&nbsp;errorText | 209       |
 | &nbsp;&nbsp;&nbsp;tooltip   | 210       |
