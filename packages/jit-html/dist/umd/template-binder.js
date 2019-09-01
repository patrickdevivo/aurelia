(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "@aurelia/jit", "@aurelia/kernel", "@aurelia/runtime"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const jit_1 = require("@aurelia/jit");
    const kernel_1 = require("@aurelia/kernel");
    const runtime_1 = require("@aurelia/runtime");
    const slice = Array.prototype.slice;
    const { enter, leave } = kernel_1.Profiler.createTimer('TemplateBinder');
    const invalidSurrogateAttribute = {
        'id': true,
        'part': true,
        'replace-part': true
    };
    const attributesToIgnore = {
        'as-element': true,
        'part': true,
        'replace-part': true
    };
    /**
     * TemplateBinder. Todo: describe goal of this class
     */
    class TemplateBinder {
        constructor(dom, resources, attrParser, exprParser, attrSyntaxModifier) {
            this.dom = dom;
            this.resources = resources;
            this.attrParser = attrParser;
            this.exprParser = exprParser;
            this.attrSyntaxTransformer = attrSyntaxModifier;
            this.surrogate = null;
            this.manifest = null;
            this.manifestRoot = null;
            this.parentManifestRoot = null;
            this.partName = null;
        }
        bind(node) {
            const surrogateSave = this.surrogate;
            const parentManifestRootSave = this.parentManifestRoot;
            const manifestRootSave = this.manifestRoot;
            const manifestSave = this.manifest;
            const manifest = this.surrogate = this.manifest = new jit_1.PlainElementSymbol(node);
            const attributes = node.attributes;
            let i = 0;
            while (i < attributes.length) {
                const attr = attributes[i];
                const attrSyntax = this.attrParser.parse(attr.name, attr.value);
                if (invalidSurrogateAttribute[attrSyntax.target] === true) {
                    throw new Error(`Invalid surrogate attribute: ${attrSyntax.target}`);
                    // TODO: use reporter
                }
                const attrInfo = this.resources.getAttributeInfo(attrSyntax);
                if (attrInfo == null) {
                    this.bindPlainAttribute(attrSyntax, attr);
                }
                else if (attrInfo.isTemplateController) {
                    throw new Error('Cannot have template controller on surrogate element.');
                    // TODO: use reporter
                }
                else {
                    this.bindCustomAttribute(attrSyntax, attrInfo);
                }
                ++i;
            }
            this.bindChildNodes(node);
            this.surrogate = surrogateSave;
            this.parentManifestRoot = parentManifestRootSave;
            this.manifestRoot = manifestRootSave;
            this.manifest = manifestSave;
            return manifest;
        }
        bindManifest(parentManifest, node) {
            switch (node.nodeName) {
                case 'LET':
                    // let cannot have children and has some different processing rules, so return early
                    this.bindLetElement(parentManifest, node);
                    return;
                case 'SLOT':
                    this.surrogate.hasSlots = true;
            }
            // nodes are processed bottom-up so we need to store the manifests before traversing down and
            // restore them again afterwards
            const parentManifestRootSave = this.parentManifestRoot;
            const manifestRootSave = this.manifestRoot;
            const manifestSave = this.manifest;
            const partNameSave = this.partName;
            // get the part name to override the name of the compiled definition
            this.partName = node.getAttribute('part');
            if (this.partName === '' || (this.partName === null && node.hasAttribute('replaceable'))) {
                this.partName = 'default';
            }
            let manifestRoot = (void 0);
            let name = node.getAttribute('as-element');
            if (name == null) {
                name = node.nodeName.toLowerCase();
            }
            const elementInfo = this.resources.getElementInfo(name);
            if (elementInfo == null) {
                // there is no registered custom element with this name
                // @ts-ignore
                this.manifest = new jit_1.PlainElementSymbol(node);
            }
            else {
                // it's a custom element so we set the manifestRoot as well (for storing replace-parts)
                this.parentManifestRoot = this.manifestRoot;
                // @ts-ignore
                manifestRoot = this.manifestRoot = this.manifest = new jit_1.CustomElementSymbol(this.dom, node, elementInfo);
            }
            // lifting operations done by template controllers and replace-parts effectively unlink the nodes, so start at the bottom
            this.bindChildNodes(node);
            // the parentManifest will receive either the direct child nodes, or the template controllers / replace-parts
            // wrapping them
            this.bindAttributes(node, parentManifest);
            if (manifestRoot != null && manifestRoot.isContainerless) {
                node.parentNode.replaceChild(manifestRoot.marker, node);
            }
            else if (this.manifest.isTarget) {
                node.classList.add('au');
            }
            // restore the stored manifests so the attributes are processed on the correct lavel
            this.parentManifestRoot = parentManifestRootSave;
            this.manifestRoot = manifestRootSave;
            this.manifest = manifestSave;
            this.partName = partNameSave;
        }
        bindLetElement(parentManifest, node) {
            const symbol = new jit_1.LetElementSymbol(this.dom, node);
            parentManifest.childNodes.push(symbol);
            const attributes = node.attributes;
            let i = 0;
            while (i < attributes.length) {
                const attr = attributes[i];
                if (attr.name === 'to-view-model') {
                    node.removeAttribute('to-view-model');
                    symbol.toViewModel = true;
                    continue;
                }
                const attrSyntax = this.attrParser.parse(attr.name, attr.value);
                const command = this.resources.getBindingCommand(attrSyntax, false);
                const bindingType = command == null ? 2048 /* Interpolation */ : command.bindingType;
                const expr = this.exprParser.parse(attrSyntax.rawValue, bindingType);
                const to = kernel_1.camelCase(attrSyntax.target);
                const info = new jit_1.BindableInfo(to, runtime_1.BindingMode.toView);
                symbol.bindings.push(new jit_1.BindingSymbol(command, info, expr, attrSyntax.rawValue, to));
                ++i;
            }
            node.parentNode.replaceChild(symbol.marker, node);
        }
        bindAttributes(node, parentManifest) {
            const { parentManifestRoot, manifestRoot, manifest } = this;
            // This is the top-level symbol for the current depth.
            // If there are no template controllers or replace-parts, it is always the manifest itself.
            // If there are template controllers, then this will be the outer-most TemplateControllerSymbol.
            let manifestProxy = manifest;
            let replacePart = this.declareReplacePart(node);
            let previousController = (void 0);
            let currentController = (void 0);
            const attributes = node.attributes;
            let i = 0;
            while (i < attributes.length) {
                const attr = attributes[i];
                ++i;
                if (attributesToIgnore[attr.name] === true) {
                    continue;
                }
                const attrSyntax = this.attrParser.parse(attr.name, attr.value);
                const bindingCommand = this.resources.getBindingCommand(attrSyntax, true);
                if (bindingCommand === null || (bindingCommand.bindingType & 4096 /* IgnoreCustomAttr */) === 0) {
                    const attrInfo = this.resources.getAttributeInfo(attrSyntax);
                    if (attrInfo == null) {
                        // map special html attributes to their corresponding properties
                        this.attrSyntaxTransformer.transform(node, attrSyntax);
                        // it's not a custom attribute but might be a regular bound attribute or interpolation (it might also be nothing)
                        this.bindPlainAttribute(attrSyntax, attr);
                    }
                    else if (attrInfo.isTemplateController) {
                        // the manifest is wrapped by the inner-most template controller (if there are multiple on the same element)
                        // so keep setting manifest.templateController to the latest template controller we find
                        currentController = manifest.templateController = this.declareTemplateController(attrSyntax, attrInfo);
                        // the proxy and the manifest are only identical when we're at the first template controller (since the controller
                        // is assigned to the proxy), so this evaluates to true at most once per node
                        if (manifestProxy === manifest) {
                            currentController.template = manifest;
                            // @ts-ignore
                            manifestProxy = currentController;
                        }
                        else {
                            currentController.templateController = previousController;
                            currentController.template = previousController.template;
                            // @ts-ignore
                            previousController.template = currentController;
                        }
                        previousController = currentController;
                    }
                    else {
                        // a regular custom attribute
                        this.bindCustomAttribute(attrSyntax, attrInfo);
                    }
                }
                else {
                    // map special html attributes to their corresponding properties
                    this.attrSyntaxTransformer.transform(node, attrSyntax);
                    // it's not a custom attribute but might be a regular bound attribute or interpolation (it might also be nothing)
                    this.bindPlainAttribute(attrSyntax, attr);
                }
            }
            processTemplateControllers(this.dom, manifestProxy, manifest);
            if (replacePart == null) {
                // the proxy is either the manifest itself or the outer-most controller; add it directly to the parent
                parentManifest.childNodes.push(manifestProxy);
            }
            else {
                // if the current manifest is also the manifestRoot, it means the replace-part sits on a custom
                // element, so add the part to the parent wrapping custom element instead
                const partOwner = manifest === manifestRoot ? parentManifestRoot : manifestRoot;
                // Tried a replace part with place to put it (process normal)
                if (!partOwner) {
                    replacePart = (void 0);
                    parentManifest.childNodes.push(manifestProxy);
                    return;
                }
                // there is a replace-part attribute on this node, so add it to the parts collection of the manifestRoot
                // instead of to the childNodes
                replacePart.parent = parentManifest;
                replacePart.template = manifestProxy;
                partOwner.parts.push(replacePart);
                if (parentManifest.templateController != null) {
                    parentManifest.templateController.parts.push(replacePart);
                }
                processReplacePart(this.dom, replacePart, manifestProxy);
            }
        }
        bindChildNodes(node) {
            let childNode;
            if (node.nodeName === 'TEMPLATE') {
                childNode = node.content.firstChild;
            }
            else {
                childNode = node.firstChild;
            }
            let nextChild;
            while (childNode != null) {
                switch (childNode.nodeType) {
                    case 1 /* Element */:
                        nextChild = childNode.nextSibling;
                        this.bindManifest(this.manifest, childNode);
                        childNode = nextChild;
                        break;
                    case 3 /* Text */:
                        childNode = this.bindText(childNode).nextSibling;
                        break;
                    case 4 /* CDATASection */:
                    case 7 /* ProcessingInstruction */:
                    case 8 /* Comment */:
                    case 10 /* DocumentType */:
                        childNode = childNode.nextSibling;
                        break;
                    case 9 /* Document */:
                    case 11 /* DocumentFragment */:
                        childNode = childNode.firstChild;
                }
            }
        }
        bindText(node) {
            const interpolation = this.exprParser.parse(node.wholeText, 2048 /* Interpolation */);
            if (interpolation != null) {
                const symbol = new jit_1.TextSymbol(this.dom, node, interpolation);
                this.manifest.childNodes.push(symbol);
                processInterpolationText(symbol);
            }
            while (node.nextSibling != null && node.nextSibling.nodeType === 3 /* Text */) {
                node = node.nextSibling;
            }
            return node;
        }
        declareTemplateController(attrSyntax, attrInfo) {
            let symbol;
            // dynamicOptions logic here is similar to (and explained in) bindCustomAttribute
            const command = this.resources.getBindingCommand(attrSyntax, false);
            if (command == null && attrInfo.hasDynamicOptions) {
                symbol = new jit_1.TemplateControllerSymbol(this.dom, attrSyntax, attrInfo, this.partName);
                this.bindMultiAttribute(symbol, attrInfo, attrSyntax.rawValue);
            }
            else {
                symbol = new jit_1.TemplateControllerSymbol(this.dom, attrSyntax, attrInfo, this.partName);
                const bindingType = command == null ? 2048 /* Interpolation */ : command.bindingType;
                const expr = this.exprParser.parse(attrSyntax.rawValue, bindingType);
                symbol.bindings.push(new jit_1.BindingSymbol(command, attrInfo.bindable, expr, attrSyntax.rawValue, attrSyntax.target));
            }
            return symbol;
        }
        bindCustomAttribute(attrSyntax, attrInfo) {
            const command = this.resources.getBindingCommand(attrSyntax, false);
            let symbol;
            if (command == null && attrInfo.hasDynamicOptions) {
                // a dynamicOptions (semicolon separated binding) is only valid without a binding command;
                // the binding commands must be declared in the dynamicOptions expression itself
                symbol = new jit_1.CustomAttributeSymbol(attrSyntax, attrInfo);
                this.bindMultiAttribute(symbol, attrInfo, attrSyntax.rawValue);
            }
            else {
                // we've either got a command (with or without dynamicOptions, the latter maps to the first bindable),
                // or a null command but without dynamicOptions (which may be an interpolation or a normal string)
                symbol = new jit_1.CustomAttributeSymbol(attrSyntax, attrInfo);
                const bindingType = command == null ? 2048 /* Interpolation */ : command.bindingType;
                const expr = this.exprParser.parse(attrSyntax.rawValue, bindingType);
                symbol.bindings.push(new jit_1.BindingSymbol(command, attrInfo.bindable, expr, attrSyntax.rawValue, attrSyntax.target));
            }
            this.manifest.attributes.push(symbol);
            this.manifest.isTarget = true;
        }
        bindMultiAttribute(symbol, attrInfo, value) {
            const attributes = parseMultiAttributeBinding(value);
            let attr;
            for (let i = 0, ii = attributes.length; i < ii; ++i) {
                attr = attributes[i];
                const attrSyntax = this.attrParser.parse(attr.name, attr.value);
                const command = this.resources.getBindingCommand(attrSyntax, false);
                const bindingType = command == null ? 2048 /* Interpolation */ : command.bindingType;
                const expr = this.exprParser.parse(attrSyntax.rawValue, bindingType);
                let bindable = attrInfo.bindables[attrSyntax.target];
                if (bindable === undefined) {
                    // everything in a dynamicOptions expression must be used, so if it's not a bindable then we create one on the spot
                    bindable = attrInfo.bindables[attrSyntax.target] = new jit_1.BindableInfo(attrSyntax.target, runtime_1.BindingMode.toView);
                }
                symbol.bindings.push(new jit_1.BindingSymbol(command, bindable, expr, attrSyntax.rawValue, attrSyntax.target));
            }
        }
        bindPlainAttribute(attrSyntax, attr) {
            const command = this.resources.getBindingCommand(attrSyntax, false);
            const bindingType = command == null ? 2048 /* Interpolation */ : command.bindingType;
            const manifest = this.manifest;
            let expr;
            if (attrSyntax.rawValue.length === 0
                && (bindingType & 53 /* BindCommand */ | 49 /* OneTimeCommand */ | 50 /* ToViewCommand */ | 52 /* TwoWayCommand */) > 0) {
                if ((bindingType & 53 /* BindCommand */ | 49 /* OneTimeCommand */ | 50 /* ToViewCommand */ | 52 /* TwoWayCommand */) > 0) {
                    // Default to the name of the attr for empty binding commands
                    expr = this.exprParser.parse(kernel_1.camelCase(attrSyntax.target), bindingType);
                }
                else {
                    return;
                }
            }
            else {
                expr = this.exprParser.parse(attrSyntax.rawValue, bindingType);
            }
            if (manifest.flags & 16 /* isCustomElement */) {
                const bindable = manifest.bindables[attrSyntax.target];
                if (bindable != null) {
                    // if the attribute name matches a bindable property name, add it regardless of whether it's a command, interpolation, or just a plain string;
                    // the template compiler will translate it to the correct instruction
                    manifest.bindings.push(new jit_1.BindingSymbol(command, bindable, expr, attrSyntax.rawValue, attrSyntax.target));
                    manifest.isTarget = true;
                }
                else if (expr != null || attrSyntax.target === 'ref') {
                    // if it does not map to a bindable, only add it if we were able to parse an expression (either a command or interpolation)
                    manifest.attributes.push(new jit_1.PlainAttributeSymbol(attrSyntax, command, expr));
                    manifest.isTarget = true;
                }
            }
            else if (expr != null || attrSyntax.target === 'ref') {
                // either a binding command, an interpolation, or a ref
                manifest.attributes.push(new jit_1.PlainAttributeSymbol(attrSyntax, command, expr));
                manifest.isTarget = true;
            }
            else if (manifest === this.surrogate) {
                // any attributes, even if they are plain (no command/interpolation etc), should be added if they
                // are on the surrogate element
                manifest.attributes.push(new jit_1.PlainAttributeSymbol(attrSyntax, command, expr));
            }
            if (command == null && expr != null) {
                // if it's an interpolation, clear the attribute value
                attr.value = '';
            }
        }
        declareReplacePart(node) {
            const name = node.getAttribute('replace-part');
            if (name == null) {
                const root = this.manifestRoot || this.parentManifestRoot;
                if (root && root.flags & 16 /* isCustomElement */ /* isCustomElement */ && root.isTarget && root.isContainerless) {
                    const physicalNode = root.physicalNode;
                    if (physicalNode.childElementCount === 1) {
                        return new jit_1.ReplacePartSymbol('default');
                    }
                }
                return null;
            }
            return name === '' ? new jit_1.ReplacePartSymbol('default') : new jit_1.ReplacePartSymbol(name);
        }
    }
    exports.TemplateBinder = TemplateBinder;
    function processInterpolationText(symbol) {
        const node = symbol.physicalNode;
        const parentNode = node.parentNode;
        while (node.nextSibling != null && node.nextSibling.nodeType === 3 /* Text */) {
            parentNode.removeChild(node.nextSibling);
        }
        node.textContent = '';
        parentNode.insertBefore(symbol.marker, node);
    }
    /**
     * A (temporary) standalone function that purely does the DOM processing (lifting) related to template controllers.
     * It's a first refactoring step towards separating DOM parsing/binding from mutations.
     */
    function processTemplateControllers(dom, manifestProxy, manifest) {
        const manifestNode = manifest.physicalNode;
        let current = manifestProxy;
        let currentTemplate;
        while (current !== manifest) {
            if (current.template === manifest) {
                // the DOM linkage is still in its original state here so we can safely assume the parentNode is non-null
                manifestNode.parentNode.replaceChild(current.marker, manifestNode);
                // if the manifest is a template element (e.g. <template repeat.for="...">) then we can skip one lift operation
                // and simply use the template directly, saving a bit of work
                if (manifestNode.nodeName === 'TEMPLATE') {
                    current.physicalNode = manifestNode;
                    // the template could safely stay without affecting anything visible, but let's keep the DOM tidy
                    manifestNode.remove();
                }
                else {
                    // the manifest is not a template element so we need to wrap it in one
                    currentTemplate = current.physicalNode = dom.createTemplate();
                    currentTemplate.content.appendChild(manifestNode);
                }
            }
            else {
                currentTemplate = current.physicalNode = dom.createTemplate();
                currentTemplate.content.appendChild(current.marker);
            }
            manifestNode.removeAttribute(current.syntax.rawName);
            current = current.template;
        }
    }
    function processReplacePart(dom, replacePart, manifestProxy) {
        let proxyNode;
        let currentTemplate;
        if (manifestProxy.flags & 512 /* hasMarker */) {
            proxyNode = manifestProxy.marker;
        }
        else {
            proxyNode = manifestProxy.physicalNode;
        }
        if (proxyNode.nodeName === 'TEMPLATE') {
            // if it's a template element, no need to do anything special, just assign it to the replacePart
            replacePart.physicalNode = proxyNode;
        }
        else {
            // otherwise wrap the replace-part in a template
            currentTemplate = replacePart.physicalNode = dom.createTemplate();
            currentTemplate.content.appendChild(proxyNode);
        }
    }
    /**
     * ParserState. Todo: describe goal of this class
     */
    class ParserState {
        constructor(input) {
            this.input = input;
            this.index = 0;
            this.length = input.length;
        }
    }
    const fromCharCode = String.fromCharCode;
    // TODO: move to expression parser
    function parseMultiAttributeBinding(input) {
        const attributes = [];
        const state = new ParserState(input);
        const length = state.length;
        let name;
        let value;
        while (state.index < length) {
            name = scanAttributeName(state);
            if (name.length === 0) {
                return attributes;
            }
            value = scanAttributeValue(state);
            attributes.push({ name, value });
        }
        return attributes;
    }
    function scanAttributeName(state) {
        const start = state.index;
        const { length, input } = state;
        while (state.index < length && input.charCodeAt(++state.index) !== 58 /* Colon */)
            ;
        return input.slice(start, state.index).trim();
    }
    var Char;
    (function (Char) {
        Char[Char["DoubleQuote"] = 34] = "DoubleQuote";
        Char[Char["SingleQuote"] = 39] = "SingleQuote";
        Char[Char["Slash"] = 47] = "Slash";
        Char[Char["Semicolon"] = 59] = "Semicolon";
        Char[Char["Colon"] = 58] = "Colon";
    })(Char || (Char = {}));
    function scanAttributeValue(state) {
        ++state.index;
        const { length, input } = state;
        let token = '';
        let inString = false;
        let quote = null;
        let ch = 0;
        while (state.index < length) {
            ch = input.charCodeAt(state.index);
            switch (ch) {
                case 59 /* Semicolon */:
                    ++state.index;
                    return token.trim();
                case 47 /* Slash */:
                    ch = input.charCodeAt(++state.index);
                    if (ch === 34 /* DoubleQuote */) {
                        if (inString === false) {
                            inString = true;
                            quote = 34 /* DoubleQuote */;
                        }
                        else if (quote === 34 /* DoubleQuote */) {
                            inString = false;
                            quote = null;
                        }
                    }
                    token += `\\${fromCharCode(ch)}`;
                    break;
                case 39 /* SingleQuote */:
                    if (inString === false) {
                        inString = true;
                        quote = 39 /* SingleQuote */;
                    }
                    else if (quote === 39 /* SingleQuote */) {
                        inString = false;
                        quote = null;
                    }
                    token += '\'';
                    break;
                default:
                    token += fromCharCode(ch);
            }
            ++state.index;
        }
        return token.trim();
    }
});
//# sourceMappingURL=template-binder.js.map