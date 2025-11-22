export function reconcileList(container, newItems, renderItemFunction, itemIdKey, dataKey, itemSelector) {
    if (!container) return;

    const domMap = new Map();
    container.querySelectorAll(itemSelector).forEach(el => {
        if (el.dataset[dataKey]) {
            domMap.set(el.dataset[dataKey], el);
        }
    });

    const fragment = document.createDocumentFragment();

    newItems.forEach((item) => {
        const itemId = item[itemIdKey].toString();
        const newItemHTML = renderItemFunction(item);
        const existingEl = domMap.get(itemId);

        let elementToAppend = null;

        if (existingEl) {
            if (existingEl.outerHTML !== newItemHTML) {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = newItemHTML;
                elementToAppend = tempDiv.firstElementChild;
            } else {
                elementToAppend = existingEl;
            }
            domMap.delete(itemId);
        } else {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = newItemHTML;
            elementToAppend = tempDiv.firstElementChild;
        }

        if (elementToAppend) {
            fragment.appendChild(elementToAppend);
        }
    });

    domMap.forEach(el => el.remove());
    container.querySelectorAll(itemSelector).forEach(el => el.remove());

    container.appendChild(fragment);
}