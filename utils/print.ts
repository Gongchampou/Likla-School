export function printElementById(id: string) {
  try {
    const el = document.getElementById(id);
    if (!el) {
      window.print();
      return;
    }
    const hadAttr = el.hasAttribute('data-print-root');
    const prev = el.getAttribute('data-print-root');
    el.setAttribute('data-print-root', 'true');
    // Allow style to apply
    setTimeout(() => {
      window.print();
      // Cleanup soon after
      setTimeout(() => {
        if (!hadAttr) el.removeAttribute('data-print-root');
        else if (prev !== null) el.setAttribute('data-print-root', prev);
      }, 0);
    }, 0);
  } catch {
    window.print();
  }
}
