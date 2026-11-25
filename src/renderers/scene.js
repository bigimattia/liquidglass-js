// A visual approximation of a scene, not a screenshot of the browser's compositor.
export function makeSceneLens(host, source, schedule) {
  const document = host.ownerDocument;
  const view = document.defaultView;
  const layer = document.createElement("div");
  layer.className = "liquid-glass-scene";
  layer.setAttribute("aria-hidden", "true");
  layer.inert = true;
  let dirty = true;
  let copy;
  let pairs = [];
  const mutations = new view.MutationObserver((records) => {
    if (!records.some(({ target }) => !(target === host || host.contains(target) ||
      (target.nodeType === 1 ? target : target.parentElement)?.closest(".liquid-glass")))) return;
    dirty = true;
    schedule();
  });
  mutations.observe(source, { subtree: true, childList: true, attributes: true, characterData: true });

  function clone(node) {
    if (node.nodeType === 3) return node.cloneNode();
    if (node.nodeType !== 1 || /^(script|style|iframe|canvas|video|audio|object|embed)$/i.test(node.localName) || node.localName.includes("-")) return null;
    const target = node.cloneNode(false);
    for (const attribute of [...target.attributes]) {
      if (/^on/i.test(attribute.name)) target.removeAttribute(attribute.name);
    }
    target.removeAttribute("id");
    target.removeAttribute("liquid-glass");
    target.removeAttribute("liquid-glass-scene");
    target.removeAttribute("autofocus");
    target.removeAttribute("name");
    const style = view.getComputedStyle(node);
    for (let i = 0; i < style.length; i++) {
      const property = style.item(i);
      target.style.setProperty(property, style.getPropertyValue(property), style.getPropertyPriority(property));
    }
    if (target.localName === "img") target.loading = "eager";
    pairs.push([node, target]);
    // Preserve layout but never clone a glass host or its generated layers.
    if (node === host || node.classList.contains("liquid-glass") || node.hasAttribute("liquid-glass")) {
      target.style.visibility = "hidden";
      return target;
    }
    for (const child of node.childNodes) {
      const childCopy = clone(child);
      if (childCopy) target.append(childCopy);
    }
    return target;
  }

  function render() {
    if (!source.isConnected || source === host || host.contains(source)) return false;
    if (dirty) {
      pairs = [];
      copy = clone(source);
      if (!copy) return false;
      layer.replaceChildren(copy);
      dirty = false;
    }
    const scene = source.getBoundingClientRect();
    const bounds = host.getBoundingClientRect();
    if (!scene.width || !scene.height || !bounds.width || !bounds.height) return false;
    Object.assign(copy.style, { position: "absolute", margin: "0", left: `${scene.left - bounds.left}px`,
      top: `${scene.top - bounds.top}px`, width: `${scene.width}px`, height: `${scene.height}px`,
      transform: "none", pointerEvents: "none" });
    for (const [original, duplicate] of pairs) {
      if (duplicate.scrollTop !== original.scrollTop) duplicate.scrollTop = original.scrollTop;
      if (duplicate.scrollLeft !== original.scrollLeft) duplicate.scrollLeft = original.scrollLeft;
    }
    return true;
  }

  return { layer, render, refresh() { dirty = true; }, destroy() { mutations.disconnect(); layer.remove(); } };
}
