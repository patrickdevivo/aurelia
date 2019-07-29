export class AttributeNSAccessor {
    constructor(lifecycle, flags, obj, propertyKey, namespace) {
        this.lifecycle = lifecycle;
        this.obj = obj;
        this.propertyKey = propertyKey;
        this.currentValue = null;
        this.oldValue = null;
        this.namespace = namespace;
        this.hasChanges = false;
        this.priority = 12288 /* propagate */;
        this.persistentFlags = flags & 1610612751 /* targetObserverFlags */;
    }
    getValue() {
        return this.currentValue;
    }
    setValue(newValue, flags) {
        this.currentValue = newValue;
        this.hasChanges = newValue !== this.oldValue;
        if ((flags & 4096 /* fromBind */) > 0 || this.persistentFlags === 536870912 /* noTargetObserverQueue */) {
            this.flushRAF(flags);
        }
        else if (this.persistentFlags !== 1073741824 /* persistentTargetObserverQueue */) {
            this.lifecycle.enqueueRAF(this.flushRAF, this, this.priority, true);
        }
    }
    flushRAF(flags) {
        if (this.hasChanges) {
            this.hasChanges = false;
            const { currentValue } = this;
            this.oldValue = currentValue;
            if (currentValue == void 0) {
                this.obj.removeAttributeNS(this.namespace, this.propertyKey);
            }
            else {
                this.obj.setAttributeNS(this.namespace, this.propertyKey, currentValue);
            }
        }
    }
    bind(flags) {
        if (this.persistentFlags === 1073741824 /* persistentTargetObserverQueue */) {
            this.lifecycle.enqueueRAF(this.flushRAF, this, this.priority);
        }
        this.currentValue = this.oldValue = this.obj.getAttributeNS(this.namespace, this.propertyKey);
    }
    unbind(flags) {
        if (this.persistentFlags === 1073741824 /* persistentTargetObserverQueue */) {
            this.lifecycle.dequeueRAF(this.flushRAF, this);
        }
    }
}
//# sourceMappingURL=attribute-ns-accessor.js.map