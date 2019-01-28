import { ILiveLoggingOptions, ITraceInfo, ITraceWriter, PLATFORM, Tracer as RuntimeTracer } from '@aurelia/kernel';
import { IScope, LifecycleFlags } from '@aurelia/runtime';

declare var console: {
  log(...args: unknown[]): void;
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
};

const marker: ITraceInfo = {
  objName: 'marker',
  methodName: 'noop',
  params: PLATFORM.emptyArray,
  depth: -1,
  prev: null,
  next: null
};
class TraceInfo implements ITraceInfo {
  public static head: ITraceInfo = marker;
  public static tail: ITraceInfo = marker;
  public static stack: ITraceInfo[] = [];

  public readonly objName: string;
  public readonly methodName: string;
  public readonly depth: number;
  public params: unknown[] | null;
  public next: ITraceInfo | null;
  public prev: ITraceInfo | null;

  constructor(objName: string, methodName: string, params: unknown[] | null) {
    this.objName = objName;
    this.methodName = methodName;
    this.depth = TraceInfo.stack.length;
    this.params = params;
    this.next = marker;
    this.prev = TraceInfo.tail;
    TraceInfo.tail.next = this;
    TraceInfo.tail = this;
    TraceInfo.stack.push(this);
  }

  public static reset(): void {
    let current = TraceInfo.head;
    let next = null;
    while (current !== null) {
      next = current.next;
      current.next = null;
      current.prev = null;
      current.params = null;
      current = next;
    }
    TraceInfo.head = marker;
    TraceInfo.tail = marker;
    TraceInfo.stack = [];
  }

  public static enter(objName: string, methodName: string, params: unknown[] | null): ITraceInfo {
    return new TraceInfo(objName, methodName, params);
  }

  public static leave(): ITraceInfo {
    return TraceInfo.stack.pop();
  }
}

export const Tracer: typeof RuntimeTracer = {
  ...RuntimeTracer,
  /**
   * A convenience property for the user to conditionally call the tracer.
   * This saves unnecessary `noop` and `slice` calls in non-AOT scenarios even if debugging is disabled.
   * In AOT these calls will simply be removed entirely.
   *
   * This property **only** turns on tracing if `@aurelia/debug` is included and configured as well.
   */
  enabled: false,
  liveLoggingEnabled: false,
  liveWriter: null as ITraceWriter,
  /**
   * Call this at the start of a method/function.
   * Each call to `enter` **must** have an accompanying call to `leave` for the tracer to work properly.
   * @param objName Any human-friendly name to identify the traced object with.
   * @param methodName Any human-friendly name to identify the traced method with.
   * @param args Pass in `Array.prototype.slice.call(arguments)` to also trace the parameters, or `null` if this is not needed (to save memory/cpu)
   */
  enter(objName: string, methodName: string, args: unknown[] | null): void {
    if (this.enabled) {
      const info = TraceInfo.enter(objName, methodName, args);
      if (this.liveLoggingEnabled) {
        this.liveWriter.write(info);
      }
    }
  },
  /**
   * Call this at the end of a method/function. Pops one trace item off the stack.
   */
  leave(): void {
    if (this.enabled) {
      TraceInfo.leave();
    }
  },
  /**
   * Writes only the trace info leading up to the current method call.
   * @param writer An object to write the output to.
   */
  writeStack(writer: ITraceWriter): void {
    let i = 0;
    const stack = TraceInfo.stack;
    const len = stack.length;
    while (i < len) {
      writer.write(stack[i]);
      ++i;
    }
  },
  /**
   * Writes all trace info captured since the previous flushAll operation.
   * @param writer An object to write the output to. Can be null to simply reset the tracer state.
   */
  flushAll(writer: ITraceWriter | null): void {
    if (writer !== null) {
      let current = TraceInfo.head.next; // skip the marker
      while (current !== null && current !== marker) {
        writer.write(current);
        current = current.next;
      }
    }
    TraceInfo.reset();
  },
  enableLiveLogging,
  /**
   * Stops writing out each trace info item as they are traced.
   */
  disableLiveLogging(): void {
    this.liveLoggingEnabled = false;
    this.liveWriter = null;
  }
};

const defaultOptions: ILiveLoggingOptions = Object.freeze({
  rendering: true,
  binding: true,
  observation: true,
  attaching: true,
  mounting: true,
  di: true,
  lifecycle: true,
  jit: true
});

/**
 * Writes out each trace info item as they are traced.
 * @param writer An object to write the output to.
 */
function enableLiveLogging(this: typeof Tracer, writer: ITraceWriter): void;
/**
 * Writes out each trace info item as they are traced.
 * @param options Optional. Specify which logging categories to output. If omitted, all will be logged.
 */
function enableLiveLogging(this: typeof Tracer, options?: ILiveLoggingOptions): void;
function enableLiveLogging(this: typeof Tracer, optionsOrWriter?: ILiveLoggingOptions | ITraceWriter): void {
  this.liveLoggingEnabled = true;
  if (optionsOrWriter && 'write' in optionsOrWriter) {
    this.liveWriter = optionsOrWriter;
  } else {
    const options = (optionsOrWriter as ILiveLoggingOptions) || defaultOptions;
    this.liveWriter = createLiveTraceWriter(options);
  }
}

type Instance = {
  constructor?: {
    prototype: unknown;
    name: string;
    description?: {
      name: string;
    };
  };
};

const toString = Object.prototype.toString;
function flagsText(info: ITraceInfo, i: number = 0): string {
  if (info.params.length > i) {
    return stringifyLifecycleFlags(info.params[i] as LifecycleFlags);
  }
  return 'none';
}
function _ctorName(obj: Instance): string {
  if (obj && obj.constructor) {
    if (obj.constructor.description) {
      return `Resource{'${obj.constructor.description.name}'}`;
    }
    return obj.constructor.name;
  }
  if (obj === undefined) {
    return 'undefined';
  } else if (obj === null) {
    return 'null';
  } else if (typeof obj === 'string') {
    return `'${obj}'`;
  }
  return toString.call(obj);
}
function ctorName(info: ITraceInfo, i: number = 0): string {
  if (info.params.length > i) {
    return _ctorName(info.params[i] as Instance);
  }
  return 'undefined';
}
function scopeText(info: ITraceInfo, i: number = 0): string {
  let $ctorName: string;
  if (info.params.length > i) {
    const $scope = info.params[i] as IScope;
    if ($scope && $scope.bindingContext) {
      $ctorName = _ctorName($scope.bindingContext as Instance);
    } else {
      $ctorName = 'undefined';
    }
    return `Scope{${$ctorName}}`;
  }
  return 'undefined';
}
function keyText(info: ITraceInfo, i: number = 0): string {
  if (info.params.length > i) {
    const $key = info.params[i] as object;
    if (typeof $key === 'string') {
      return `'${$key}'`;
    }
    if ($key && Reflect.has($key, 'friendlyName')) {
      return $key['friendlyName'];
    }
    return _ctorName($key);
  }
  return 'undefined';
}

const RenderingArgsProcessor = {
  $hydrate(info: ITraceInfo): string {
    return flagsText(info);
  },
  render(info: ITraceInfo): string {
    return `${flagsText(info)},IDOM,IRenderContext,${ctorName(info, 3)}`;
  },
  addBinding(info: ITraceInfo): string {
    return `${ctorName(info)},${ctorName(info, 1)}`;
  },
  addComponent(info: ITraceInfo): string {
    return `${ctorName(info)},${ctorName(info, 1)}`;
  }
};

const BindingArgsProcessor = {
  $bind(info: ITraceInfo): string {
    return flagsText(info);
  },
  $unbind(info: ITraceInfo): string {
    return flagsText(info);
  },
  connect(info: ITraceInfo): string {
    return flagsText(info);
  },
  // currently only observers trace constructor calls but keep an eye on this if others are added, then we'd need additional filtering
  constructor(info: ITraceInfo): string {
    switch (info.objName) {
      case 'ArrayObserver':
      case 'MapObserver':
      case 'SetObserver':
        return flagsText(info);
      case 'SetterObserver':
      case 'SelfObserver':
        return `${flagsText(info)},${ctorName(info, 1)},'${info.params[2]}'`;
      case 'ProxyObserver':
        return ctorName(info);
      case 'ProxySubscriberCollection':
      case 'DirtyCheckProperty':
        return `${ctorName(info, 1)},'${info.params[2]}'`;
      case 'PrimitiveObserver':
      case 'PropertyAccessor':
        return `${ctorName(info)},'${info.params[1]}'`;
      default:
        return '';
    }
  },
  lockedBind(info: ITraceInfo): string {
    return flagsText(info);
  },
  lockedUnbind(info: ITraceInfo): string {
    return flagsText(info);
  },
  InternalObserversLookup(info: ITraceInfo): string {
    return `${flagsText(info)},${ctorName(info, 1)},'${info.params[2]}'`;
  },
  BindingContext(info: ITraceInfo): string {
    switch (info.methodName) {
      case 'get':
        return `${scopeText(info)},'${info.params[1]}',${info.params[2]},${flagsText(info, 3)}`;
      case 'getObservers':
        return flagsText(info);
    }
  },
  Scope(info: ITraceInfo): string {
    switch (info.methodName) {
      case 'create':
        return `${flagsText(info)},${ctorName(info, 1)},${ctorName(info, 2)}`;
      case 'fromOverride':
        return `${flagsText(info)},${ctorName(info, 1)}`;
      case 'fromParent':
        return `${flagsText(info)},${scopeText(info, 1)},${ctorName(info, 2)}`;
    }
  },
  OverrideContext(info: ITraceInfo): string {
    switch (info.methodName) {
      case 'create':
        return `${flagsText(info)},${ctorName(info, 1)},${ctorName(info, 2)}`;
      case 'getObservers':
        return '';
    }
  }
};

const ObservationArgsProcessor = {
  $patch(info: ITraceInfo): string {
    return flagsText(info);
  },
  callSource(info: ITraceInfo): string {
    switch (info.objName) {
      case 'Listener':
        return (info.params[0] as { type: string }).type;
      case 'Call':
        const names: string[] = [];
        for (let i = 0, ii = info.params.length; i < ii; ++i) {
          names.push(ctorName(info, i));
        }
        return names.join(',');
    }
  },
  setValue(info: ITraceInfo): string {
    let valueText: string;
    const value = info.params[0];
    switch (typeof value) {
      case 'undefined':
        valueText = 'undefined';
        break;
      case 'object':
        if (value === null) {
          valueText = 'null';
        } else {
          valueText = _ctorName(value);
        }
        break;
      case 'string':
        valueText = `'${value}'`;
        break;
      case 'number':
        valueText = value.toString();
        break;
      default:
        valueText = _ctorName(value as Instance);
    }
    return `${valueText},${flagsText(info, 1)}`;
  },
  flush(info: ITraceInfo): string {
    return flagsText(info);
  },
  handleChange(info: ITraceInfo): string {
    return `${info.params[0]},${info.params[1]},${flagsText(info, 2)}`;
  },
  lockScope(info: ITraceInfo): string {
    return scopeText(info);
  }
};

const AttachingArgsProcessor = {
  $attach(info: ITraceInfo): string {
    return flagsText(info);
  },
  $detach(info: ITraceInfo): string {
    return flagsText(info);
  },
  $cache(info: ITraceInfo): string {
    return flagsText(info);
  },
  hold(info: ITraceInfo): string {
    return `Node{'${(info.params[0] as { textContent: string }).textContent}'}`;
  },
  release(info: ITraceInfo): string {
    return flagsText(info);
  }
};

const MountingArgsProcessor = {
  $mount(info: ITraceInfo): string {
    return flagsText(info);
  },
  $unmount(info: ITraceInfo): string {
    return flagsText(info);
  },
  project(info: ITraceInfo): string {
    return ctorName(info);
  },
  take(info: ITraceInfo): string {
    return ctorName(info);
  }
};

const DIArgsProcessor = {
  construct(info: ITraceInfo): string {
    return ctorName(info);
  },
  Container(info: ITraceInfo): string {
    switch (info.methodName) {
      case 'get':
      case 'getAll':
        return keyText(info);
      case 'register':
        const names: string[] = [];
        for (let i = 0, ii = info.params.length; i < ii; ++i) {
          names.push(keyText(info, i));
        }
        return names.join(',');
      case 'createChild':
        return '';
    }
  }
};

const LifecycleArgsProcessor = {
  Lifecycle(info: ITraceInfo): string {
    switch (info.methodName.slice(0, 3)) {
      case 'beg':
        return '';
      case 'enq':
        return ctorName(info);
      case 'end':
      case 'pro':
        return flagsText(info);
    }
  },
  CompositionCoordinator(info: ITraceInfo): string {
    switch (info.methodName) {
      case 'enqueue':
        return 'IView';
      case 'swap':
        return `IView,${flagsText(info, 1)}`;
      case 'processNext':
        return '';
    }
  },
  AggregateLifecycleTask(info: ITraceInfo): string {
    switch (info.methodName) {
      case 'addTask':
      case 'removeTask':
        return ctorName(info);
      case 'complete':
        return `${info.params[0]}`;
    }
  }
};

const JitArgsProcessor = {
  TemplateBinder(info: ITraceInfo): string {
    return ''; // TODO
  }
};

function createLiveTraceWriter(options: ILiveLoggingOptions): ITraceWriter {
  const Processors: Record<string, (info: ITraceInfo) => string> = {};
  if (options.rendering) {
    Object.assign(Processors, RenderingArgsProcessor);
  }
  if (options.binding) {
    Object.assign(Processors, BindingArgsProcessor);
  }
  if (options.observation) {
    Object.assign(Processors, ObservationArgsProcessor);
  }
  if (options.attaching) {
    Object.assign(Processors, AttachingArgsProcessor);
  }
  if (options.mounting) {
    Object.assign(Processors, MountingArgsProcessor);
  }
  if (options.di) {
    Object.assign(Processors, DIArgsProcessor);
  }
  if (options.lifecycle) {
    Object.assign(Processors, LifecycleArgsProcessor);
  }
  if (options.jit) {
    Object.assign(Processors, JitArgsProcessor);
  }

  return {
    write(info: ITraceInfo): void {
      let output: string;
      if (Processors[info.methodName] !== undefined) {
        output = Processors[info.methodName](info);
      } else if (Processors[info.objName] !== undefined) {
        output = Processors[info.objName](info);
      } else {
        return;
      }
      // tslint:disable-next-line:no-console
      console.debug(`${'-'.repeat(info.depth)}${info.objName}.${info.methodName}(${output})`);
    }
  };
}

export function stringifyLifecycleFlags(flags: LifecycleFlags): string {
  const flagNames: string[] = [];

  if (flags & LifecycleFlags.mustEvaluate) { flagNames.push('mustEvaluate'); }
  if (flags & LifecycleFlags.isCollectionMutation) { flagNames.push('isCollectionMutation'); }
  if (flags & LifecycleFlags.isInstanceMutation) { flagNames.push('isInstanceMutation'); }
  if (flags & LifecycleFlags.updateTargetObserver) { flagNames.push('updateTargetObserver'); }
  if (flags & LifecycleFlags.updateTargetInstance) { flagNames.push('updateTargetInstance'); }
  if (flags & LifecycleFlags.updateSourceExpression) { flagNames.push('updateSourceExpression'); }
  if (flags & LifecycleFlags.fromAsyncFlush) { flagNames.push('fromAsyncFlush'); }
  if (flags & LifecycleFlags.fromSyncFlush) { flagNames.push('fromSyncFlush'); }
  if (flags & LifecycleFlags.fromStartTask) { flagNames.push('fromStartTask'); }
  if (flags & LifecycleFlags.fromStopTask) { flagNames.push('fromStopTask'); }
  if (flags & LifecycleFlags.fromBind) { flagNames.push('fromBind'); }
  if (flags & LifecycleFlags.fromUnbind) { flagNames.push('fromUnbind'); }
  if (flags & LifecycleFlags.fromAttach) { flagNames.push('fromAttach'); }
  if (flags & LifecycleFlags.fromDetach) { flagNames.push('fromDetach'); }
  if (flags & LifecycleFlags.fromCache) { flagNames.push('fromCache'); }
  if (flags & LifecycleFlags.fromDOMEvent) { flagNames.push('fromDOMEvent'); }
  if (flags & LifecycleFlags.fromObserverSetter) { flagNames.push('fromObserverSetter'); }
  if (flags & LifecycleFlags.fromBindableHandler) { flagNames.push('fromBindableHandler'); }
  if (flags & LifecycleFlags.fromLifecycleTask) { flagNames.push('fromLifecycleTask'); }
  if (flags & LifecycleFlags.parentUnmountQueued) { flagNames.push('parentUnmountQueued'); }
  if (flags & LifecycleFlags.doNotUpdateDOM) { flagNames.push('doNotUpdateDOM'); }
  if (flags & LifecycleFlags.isTraversingParentScope) { flagNames.push('isTraversingParentScope'); }
  if (flags & LifecycleFlags.allowParentScopeTraversal) { flagNames.push('allowParentScopeTraversal'); }
  if (flags & LifecycleFlags.useProxies) { flagNames.push('useProxies'); }
  if (flags & LifecycleFlags.keyedMode) { flagNames.push('keyedMode'); }
  if (flags & LifecycleFlags.patchMode) { flagNames.push('patchMode'); }

  if (flagNames.length === 0) {
    return 'none';
  }
  return flagNames.join('|');
}
