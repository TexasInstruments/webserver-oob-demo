import { bindingRegistry, valueChangedEventType } from '../../gc-core-databind/lib/CoreDatabind';

window.$test = {};
window.$test.binding = {};

window.$test.binding.reset = () => {
    window.$test.binding.selectedValueChanged = undefined;
    window.$test.binding.selectedIndexChanged = undefined;
    window.$test.binding.selectedLabelChanged = undefined;
};

bindingRegistry.getBinding('prop.selectedLabel').addEventListener(valueChangedEventType, (e) => {
    window.$test.binding.selectedLabelChanged = e;
    console.log(`binding selectedLabel changed = ${e.oldValue} -> ${e.newValue}`);
});
bindingRegistry.getBinding('prop.selectedValue').addEventListener(valueChangedEventType, (e) => {
    window.$test.binding.selectedValueChanged = e;
    console.log(`binding selectedValue changed = ${e.oldValue} -> ${e.newValue}`);
});
bindingRegistry.getBinding('prop.selectedIndex').addEventListener(valueChangedEventType, (e) => {
    window.$test.binding.selectedIndexChanged = e;
    console.log(`binding selectedIndex changed = ${e.oldValue} -> ${e.newValue}`);
});

bindingRegistry.bind('widget.modelSelect.selectedValue', 'prop.selectedValue');
bindingRegistry.bind('widget.modelSelect.selectedLabel', 'prop.selectedLabel');
bindingRegistry.bind('widget.modelSelect.selectedIndex', 'prop.selectedIndex');
bindingRegistry.bind('widget.modelSelect.values', 'prop.values');
bindingRegistry.bind('widget.modelSelect.labels', 'prop.labels');

window.$test.setSelectedValue = value => bindingRegistry.getBinding('prop.selectedValue').setValue(value);
window.$test.setSelectedLabel = value => bindingRegistry.getBinding('prop.selectedLabel').setValue(value);
window.$test.setSelectedIndex = value => bindingRegistry.getBinding('prop.selectedIndex').setValue(value);

window.$test.setValues = values => bindingRegistry.getBinding('prop.values').setValue(values);
window.$test.setLabels = labels => bindingRegistry.getBinding('prop.labels').setValue(labels);

window.$test.getSelectedValue = () => bindingRegistry.getBinding('prop.selectedValue').getValue();
window.$test.getSelectedLabel = () => bindingRegistry.getBinding('prop.selectedLabel').getValue();
window.$test.getSelectedIndex = () => bindingRegistry.getBinding('prop.selectedIndex').getValue();