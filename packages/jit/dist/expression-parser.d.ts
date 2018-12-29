import { IRegistry } from '@aurelia/kernel';
import { BindingType, ForOfStatement, Interpolation, IsBindingBehavior } from '@aurelia/runtime';
export declare const ParserRegistration: IRegistry;
export declare function parseExpression<TType extends BindingType = BindingType.BindCommand>(input: string, bindingType?: TType): TType extends BindingType.Interpolation ? Interpolation : TType extends BindingType.ForCommand ? ForOfStatement : IsBindingBehavior;
//# sourceMappingURL=expression-parser.d.ts.map