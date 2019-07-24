import { DI } from '@aurelia/kernel';
import { Lifecycle } from './lifecycle';
import { ObserverLocator } from './observation/observer-locator';
import { CallBindingRenderer, CustomAttributeRenderer, CustomElementRenderer, InterpolationBindingRenderer, IteratorBindingRenderer, LetElementRenderer, PropertyBindingRenderer, RefBindingRenderer, Renderer, SetPropertyRenderer, TemplateControllerRenderer } from './renderer';
import { FromViewBindingBehavior, OneTimeBindingBehavior, ToViewBindingBehavior, TwoWayBindingBehavior } from './resources/binding-behaviors/binding-mode';
import { DebounceBindingBehavior } from './resources/binding-behaviors/debounce';
import { PriorityBindingBehavior } from './resources/binding-behaviors/priority';
import { SignalBindingBehavior } from './resources/binding-behaviors/signals';
import { ThrottleBindingBehavior } from './resources/binding-behaviors/throttle';
import { Else, If } from './resources/custom-attributes/if';
import { Repeat } from './resources/custom-attributes/repeat';
import { Replaceable } from './resources/custom-attributes/replaceable';
import { With } from './resources/custom-attributes/with';
import { SanitizeValueConverter } from './resources/value-converters/sanitize';
export const IObserverLocatorRegistration = ObserverLocator;
export const ILifecycleRegistration = Lifecycle;
export const IRendererRegistration = Renderer;
/**
 * Default implementations for the following interfaces:
 * - `IObserverLocator`
 * - `ILifecycle`
 * - `IRenderer`
 */
export const DefaultComponents = [
    IObserverLocatorRegistration,
    ILifecycleRegistration,
    IRendererRegistration
];
export const IfRegistration = If;
export const ElseRegistration = Else;
export const RepeatRegistration = Repeat;
export const ReplaceableRegistration = Replaceable;
export const WithRegistration = With;
export const SanitizeValueConverterRegistration = SanitizeValueConverter;
export const DebounceBindingBehaviorRegistration = DebounceBindingBehavior;
export const OneTimeBindingBehaviorRegistration = OneTimeBindingBehavior;
export const ToViewBindingBehaviorRegistration = ToViewBindingBehavior;
export const FromViewBindingBehaviorRegistration = FromViewBindingBehavior;
export const SignalBindingBehaviorRegistration = SignalBindingBehavior;
export const ThrottleBindingBehaviorRegistration = ThrottleBindingBehavior;
export const TwoWayBindingBehaviorRegistration = TwoWayBindingBehavior;
export const PriorityBindingBehaviorRegistration = PriorityBindingBehavior;
/**
 * Default resources:
 * - Template controllers (`if`/`else`, `repeat`, `replaceable`, `with`)
 * - Value Converters (`sanitize`)
 * - Binding Behaviors (`oneTime`, `toView`, `fromView`, `twoWay`, `signal`, `debounce`, `throttle`)
 */
export const DefaultResources = [
    IfRegistration,
    ElseRegistration,
    RepeatRegistration,
    ReplaceableRegistration,
    WithRegistration,
    SanitizeValueConverterRegistration,
    DebounceBindingBehaviorRegistration,
    OneTimeBindingBehaviorRegistration,
    ToViewBindingBehaviorRegistration,
    FromViewBindingBehaviorRegistration,
    SignalBindingBehaviorRegistration,
    PriorityBindingBehaviorRegistration,
    ThrottleBindingBehaviorRegistration,
    TwoWayBindingBehaviorRegistration
];
export const CallBindingRendererRegistration = CallBindingRenderer;
export const CustomAttributeRendererRegistration = CustomAttributeRenderer;
export const CustomElementRendererRegistration = CustomElementRenderer;
export const InterpolationBindingRendererRegistration = InterpolationBindingRenderer;
export const IteratorBindingRendererRegistration = IteratorBindingRenderer;
export const LetElementRendererRegistration = LetElementRenderer;
export const PropertyBindingRendererRegistration = PropertyBindingRenderer;
export const RefBindingRendererRegistration = RefBindingRenderer;
export const SetPropertyRendererRegistration = SetPropertyRenderer;
export const TemplateControllerRendererRegistration = TemplateControllerRenderer;
/**
 * Default renderers for:
 * - PropertyBinding: `bind`, `one-time`, `to-view`, `from-view`, `two-way`
 * - IteratorBinding: `for`
 * - CallBinding: `call`
 * - RefBinding: `ref`
 * - InterpolationBinding: `${}`
 * - SetProperty
 * - `customElement` hydration
 * - `customAttribute` hydration
 * - `templateController` hydration
 * - `let` element hydration
 */
export const DefaultRenderers = [
    PropertyBindingRendererRegistration,
    IteratorBindingRendererRegistration,
    CallBindingRendererRegistration,
    RefBindingRendererRegistration,
    InterpolationBindingRendererRegistration,
    SetPropertyRendererRegistration,
    CustomElementRendererRegistration,
    CustomAttributeRendererRegistration,
    TemplateControllerRendererRegistration,
    LetElementRendererRegistration
];
/**
 * A DI configuration object containing environment/runtime-agnostic registrations:
 * - `DefaultComponents`
 * - `DefaultResources`
 * - `DefaultRenderers`
 */
export const RuntimeBasicConfiguration = {
    /**
     * Apply this configuration to the provided container.
     */
    register(container) {
        return container.register(...DefaultComponents, ...DefaultResources, ...DefaultRenderers);
    },
    /**
     * Create a new container with this configuration applied to it.
     */
    createContainer() {
        return this.register(DI.createContainer());
    }
};
//# sourceMappingURL=configuration.js.map