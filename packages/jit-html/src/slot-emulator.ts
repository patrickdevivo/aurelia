import { toArray, DI, IContainer, IResolver, Registration } from '@aurelia/kernel';
import { IDOM } from '@aurelia/runtime';
import { NodeType } from '@aurelia/runtime-html';

export interface ISlotEmulator {
  emulateDefinition(root: HTMLElement | DocumentFragment): void;
  emulateUsage(root: HTMLElement | DocumentFragment): void;
}
export const ISlotEmulator = DI.createInterface<ISlotEmulator>("ISlotEmulator").noDefault();

export class SlotEmulator implements ISlotEmulator {
  public constructor(
    @IDOM private readonly dom: IDOM,
  ) { }

  public static register(container: IContainer): IResolver<ISlotEmulator> {
    return Registration.singleton(ISlotEmulator, this).register(container);
  }

  /**
   *```html
   * <!--from -->
   * ... <!-- <- root -->
   * <slot>[default content]</slot>
   * <slot name="777">[default content]</slot>
   * ...
   *
   * <!-- to -->
   * <template>
   *   ...
   *   <template replaceable>[default content]</template>
   *   <template replaceable="777">[default content]</template>
   *   ...
   * </template>
   * ```
   */
  public emulateDefinition(root: HTMLElement | DocumentFragment) {
    const slots = toArray(root.querySelectorAll('slot'));
    if (slots.length === 0) { return; }
    const dom = this.dom;
    for (const slot of slots) {
      const template = dom.createTemplate() as HTMLTemplateElement;
      template.setAttribute('replaceable', slot.getAttribute('name') ?? '');
      slot.parentElement!.replaceChild(template, slot);
      template.content.append(...toArray(slot.childNodes));
    }
    if (root.firstElementChild?.tagName !== 'TEMPLATE') {
      const template = dom.createTemplate() as HTMLTemplateElement;
      template.content.append(...toArray(root.childNodes));
      root.append(template);
    }
  }

  /**
   *```html
   *<!-- from -->
   *<custom-element>  <!-- <- root -->
   *
   *  <content-to-project-to-default-slot>
   *  </content-to-project-to-default-slot>
   *
   *  <content-to-project-to-named-slot slot="777">
   *  </content-to-project-to-named-slot>
   *
   *</custom-element>
   *
   *<!-- to -->
   *<custom-element>
   *  <template replace>
   *    <content-to-project>
   *    </content-to-project>
   *  </template>
   *
   *  <template replace="777">
   *    <content-to-project-to-slot>
   *    </content-to-project-to-slot>
   *  </template>
   *
   *</custom-element>
   *```
   */
  public emulateUsage(root: HTMLElement | DocumentFragment): void {

    const dom = this.dom;
    const insert = (
      child: Node,
      slotName: string
    ) => {
      const newTemplate = dom.createTemplate() as HTMLTemplateElement;
      if (!root.contains(newTemplate)) {
        newTemplate.setAttribute('replace', slotName);
        root.insertBefore(newTemplate, child);
      }
      newTemplate.content.appendChild(child);
    };

    let child = root.firstChild;
    let nextChild;
    while (child !== null) {
      nextChild = child.nextSibling;
      switch (child.nodeType) {
        case NodeType.Text:
          if ((child.textContent?.trim() ?? '') !== '') {
            insert(child, '');
          }
          break;
        case NodeType.Element: {
          const slotName = (child as Element).getAttribute('slot') ?? '';
          (child as Element).removeAttribute('slot');
          insert(child, slotName);
          break;
        }
      }
      child = nextChild;
    }
  }
}
