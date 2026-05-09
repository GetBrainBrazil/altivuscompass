/**
 * Triggers the browser's print/save-as-PDF dialog for a URL
 * without opening a visible tab. Uses a hidden iframe.
 */
export function printPdfFromUrl(url: string) {
  // Remove any leftover iframe
  const existing = document.getElementById("__pdf_print_iframe__");
  if (existing) existing.remove();

  const iframe = document.createElement("iframe");
  iframe.id = "__pdf_print_iframe__";
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  // Signal the inner page to auto-print without showing UI
  const sep = url.includes("?") ? "&" : "?";
  iframe.src = `${url}${sep}autoprint=1`;
  document.body.appendChild(iframe);
}
