// Any element with a data-tip attribute shows its text in one shared tooltip. The listeners are on the document,
// so buttons and other elements only need the attribute. Importing this module installs them once.

const GAP = 6;
const MARGIN = 8;

// A popover sits in the top layer, so it shows above the help dialog, which would otherwise cover it.
const tooltip = document.createElement("div");
tooltip.id = "tooltip";
tooltip.className = "item-tooltip";
tooltip.setAttribute("role", "tooltip");
tooltip.popover = "manual";
document.body.append(tooltip);

let anchor: HTMLElement | null = null;
// Tabs re-render on filter changes, which can remove the anchor under a resting pointer with no event to hide the tip.
// It only watches while a tip is open, so idle pages pay nothing.
const removalObserver = new MutationObserver(() => {
  if (anchor && !anchor.isConnected) hide();
});

function tipOf(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>("[data-tip]") : null;
}

// Shown at once, like TF2's inventory item tooltips: no hover delay and no transition.
function show(element: HTMLElement): void {
  hide();
  // A focused select may have its option list open, and a popover in the top layer would close that list.
  if (document.activeElement instanceof HTMLSelectElement) return;
  anchor = element;
  tooltip.textContent = element.dataset.tip ?? "";
  tooltip.showPopover();
  element.setAttribute("aria-describedby", "tooltip");
  removalObserver.observe(document, { childList: true, subtree: true });

  // Measure from the origin: a tooltip left at its old spot near the right edge would be squeezed narrower.
  tooltip.style.left = "0px";
  tooltip.style.top = "0px";
  const box = element.getBoundingClientRect();
  const { offsetWidth: width, offsetHeight: height } = tooltip;
  const left = Math.min(Math.max(box.left + box.width / 2 - width / 2, MARGIN), innerWidth - width - MARGIN);
  const below = box.bottom + GAP;
  const top = Math.max(MARGIN, below + height > innerHeight ? box.top - GAP - height : below);
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function hide(): void {
  // Pointer and focus events call this constantly, so it returns before touching the DOM when no tip is open.
  if (!tooltip.matches(":popover-open")) return;
  removalObserver.disconnect();
  anchor?.removeAttribute("aria-describedby");
  anchor = null;
  if (tooltip.matches(":popover-open")) tooltip.hidePopover();
}

document.addEventListener("pointerover", (event) => {
  // Pointer events over a select (its open option list included) never show a tip
  if (event.target instanceof Element && event.target.closest("select")) return;
  const element = tipOf(event.target);
  if (element && element !== anchor) show(element);
});

document.addEventListener("pointerout", (event) => {
  const element = tipOf(event.target);
  if (!element || element !== anchor) return;
  // Moving between children of the same tip is not leaving it.
  if (tipOf(event.relatedTarget) === element) return;
  hide();
});

// Only keyboard focus shows a tip at once. A mouse click also focuses the button, and the tip would reappear over the pointer.
document.addEventListener("focusin", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (target instanceof HTMLSelectElement) {
    hide();
    return;
  }
  if (!target.matches(":focus-visible")) return;
  const element = tipOf(target);
  if (element) show(element);
});

document.addEventListener("focusout", hide);
document.addEventListener("pointerdown", hide);
document.addEventListener("scroll", hide, { capture: true, passive: true });
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") hide();
});
