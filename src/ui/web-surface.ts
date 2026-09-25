/** Browser affordances share the theater palette; native controls keep their OS behavior. */
export function installWebSurfaceStyles(): () => void {
  const sheet = document.createElement('style');
  sheet.textContent = `
    html, body { background: #090807; color-scheme: dark; }
    ::selection { background: #e8b44f; color: #090807; }
    :focus-visible { outline: 2px solid #e8b44f; outline-offset: 4px; }
    [role="radio"]:focus-visible { outline-color: #8c5e14; }
    input, textarea { caret-color: #e8b44f; }
    * { scrollbar-width: thin; scrollbar-color: #6b4b18 #15120f; }
    @media (hover: hover) {
      [role="button"]:not([aria-disabled="true"]):hover { filter: brightness(1.12); }
    }
  `;
  document.head.appendChild(sheet);
  return () => sheet.remove();
}
