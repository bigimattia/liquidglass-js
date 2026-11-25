export function bindCopy(button, code) {
  let reset;
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(code.textContent);
      button.textContent = "Copied";
    } catch {
      const range = document.createRange();
      range.selectNodeContents(code);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      button.textContent = "Selected";
    }
    clearTimeout(reset);
    reset = setTimeout(() => { button.textContent = "Copy"; }, 1200);
  });
}
