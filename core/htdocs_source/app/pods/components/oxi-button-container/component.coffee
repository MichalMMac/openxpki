import Component from '@ember/component'

OxiButtonContainerComponent = Component.extend
    classNameBindings: ["buttons:oxi-button-container"]

    hasDescription: Em.computed "buttons.@each.description", ->
        @get("buttons")?.isAny "description"

    actions:
        click: (button) -> @sendAction "buttonClick", button

export default OxiButtonContainerComponent
