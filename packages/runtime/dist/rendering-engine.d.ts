import { IContainer, IRegistry, IResourceDescriptions } from '@aurelia/kernel';
import { InstructionTypeName, ITargetedInstruction, ITemplateDefinition, TemplateDefinition, TemplatePartDefinitions } from './definitions';
import { IDOM, INode, INodeSequenceFactory } from './dom';
import { LifecycleFlags } from './flags';
import { IController, IRenderContext, IViewFactory, IViewModel } from './lifecycle';
import { IAccessor, ISubscribable, ISubscriberCollection } from './observation';
import { ICustomElementType } from './resources/custom-element';
export interface ITemplateCompiler {
    readonly name: string;
    compile(dom: IDOM, definition: ITemplateDefinition, resources: IResourceDescriptions, viewCompileFlags?: ViewCompileFlags): TemplateDefinition;
}
export declare const ITemplateCompiler: import("@aurelia/kernel").InterfaceSymbol<ITemplateCompiler>;
export declare enum ViewCompileFlags {
    none = 1,
    surrogate = 2,
    shadowDOM = 4
}
export interface ITemplateFactory<T extends INode = INode> {
    create(parentRenderContext: IRenderContext<T>, definition: TemplateDefinition): ITemplate<T>;
}
export declare const ITemplateFactory: import("@aurelia/kernel").InterfaceSymbol<ITemplateFactory<INode>>;
export interface ITemplate<T extends INode = INode> {
    readonly renderContext: IRenderContext<T>;
    readonly dom: IDOM<T>;
    readonly definition: TemplateDefinition;
    render(controller: IController<T>, host?: T, parts?: Record<string, ITemplateDefinition>, flags?: LifecycleFlags): void;
    render(viewModel: IViewModel<T>, host?: T, parts?: Record<string, ITemplateDefinition>, flags?: LifecycleFlags): void;
}
export declare class CompiledTemplate<T extends INode = INode> implements ITemplate {
    readonly factory: INodeSequenceFactory<T>;
    readonly renderContext: IRenderContext<T>;
    readonly dom: IDOM<T>;
    readonly definition: TemplateDefinition;
    constructor(dom: IDOM<T>, definition: TemplateDefinition, factory: INodeSequenceFactory<T>, renderContext: IRenderContext<T>);
    render(viewModel: IViewModel<T>, host?: T, parts?: TemplatePartDefinitions, flags?: LifecycleFlags): void;
    render(controller: IController<T>, host?: T, parts?: TemplatePartDefinitions, flags?: LifecycleFlags): void;
}
export interface IInstructionTypeClassifier<TType extends string = string> {
    instructionType: TType;
}
export interface IInstructionRenderer<TType extends InstructionTypeName = InstructionTypeName> extends Partial<IInstructionTypeClassifier<TType>> {
    render(flags: LifecycleFlags, dom: IDOM, context: IRenderContext, renderable: IController, target: unknown, instruction: ITargetedInstruction, ...rest: unknown[]): void;
}
export declare const IInstructionRenderer: import("@aurelia/kernel").InterfaceSymbol<IInstructionRenderer<string>>;
export interface IRenderer {
    instructionRenderers: Record<string, IInstructionRenderer>;
    render(flags: LifecycleFlags, dom: IDOM, context: IRenderContext, renderable: IController, targets: ArrayLike<INode>, templateDefinition: TemplateDefinition, host?: INode, parts?: TemplatePartDefinitions): void;
}
export declare const IRenderer: import("@aurelia/kernel").InterfaceSymbol<IRenderer>;
export interface IRenderingEngine {
    getElementTemplate<T extends INode = INode>(dom: IDOM<T>, definition: TemplateDefinition, parentContext?: IContainer | IRenderContext<T>, componentType?: ICustomElementType): ITemplate<T>;
    getViewFactory<T extends INode = INode>(dom: IDOM<T>, source: ITemplateDefinition, parentContext?: IContainer | IRenderContext<T>): IViewFactory<T>;
}
export declare const IRenderingEngine: import("@aurelia/kernel").InterfaceSymbol<IRenderingEngine>;
export declare function createRenderContext(dom: IDOM, parent: IRenderContext | IContainer, dependencies: IRegistry[], componentType?: ICustomElementType): IRenderContext;
export interface IChildrenObserver extends IAccessor, ISubscribable, ISubscriberCollection {
}
//# sourceMappingURL=rendering-engine.d.ts.map