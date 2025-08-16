// Lightweight DOM-to-PDF using CDN jsPDF + html2canvas (no local deps)
// Loads libraries via script tags to avoid bundler issues.

declare global {
  interface Window {
    html2canvas?: any;
    jsPDF?: any;
    jspdf?: any;
  }
}

let _scriptPromises: Record<string, Promise<void>> = {};
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (_scriptPromises[src]) return _scriptPromises[src].then(resolve).catch(reject);
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

let _pdfLibsPromise: Promise<void> | null = null;
async function ensurePdfLibsLoaded() {
  if (_pdfLibsPromise) return _pdfLibsPromise;
  _pdfLibsPromise = (async () => {
  // html2canvas UMD
  if (!window.html2canvas) {
    await loadScript('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js');
  }
  // jsPDF UMD (exposes window.jspdf.jsPDF or window.jsPDF depending on build)
  if (!window.jsPDF && !(window as any).jspdf?.jsPDF) {
    await loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js');
  }
  })();
  return _pdfLibsPromise;
}

// Public: allow pages to preload the libs to avoid first-use delay
export async function warmupPdfLibs(): Promise<void> {
  await ensurePdfLibsLoaded();
}

let _autoTablePromise: Promise<void> | null = null;
async function ensureAutoTableLoaded() {
  await ensurePdfLibsLoaded();
  if (_autoTablePromise) return _autoTablePromise;
  _autoTablePromise = (async () => {
    // AutoTable needs to patch jsPDF; it attaches to window.jspdf or window.jsPDF
    const hasAutoTable = typeof (window as any).jspdf?.autoTable === 'function' || typeof (window as any).jsPDF?.autoTable === 'function';
    if (!hasAutoTable) {
      await loadScript('https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js');
    }
  })();
  return _autoTablePromise;
}

export async function downloadElementAsPdf(elementId: string, filename: string = 'export.pdf') {
  const el = document.getElementById(elementId);
  if (!el) return;

  await ensurePdfLibsLoaded();
  const html2canvas = window.html2canvas;
  const jsPDFCtor = window.jsPDF || (window as any).jspdf?.jsPDF;
  if (!html2canvas || !jsPDFCtor) {
    // Fallback to print if libs fail
    window.print();
    return;
  }

  // Determine export mode
  const pdfSizeAttr = el.getAttribute('data-pdf-size');
  const isCard = pdfSizeAttr === 'card';
  // Optional custom size provided by element
  const customWidthMmAttr = el.getAttribute('data-pdf-width-mm');
  const customHeightMmAttr = el.getAttribute('data-pdf-height-mm');
  const customWidthMm = customWidthMmAttr ? parseFloat(customWidthMmAttr) : undefined;
  const customHeightMm = customHeightMmAttr ? parseFloat(customHeightMmAttr) : undefined;

  // Adaptive scale: keep canvas width around target for speed; enable fast mode for big grids
  const clientWidth = (el as HTMLElement).clientWidth || el.getBoundingClientRect().width || 800;
  const isFast = el.hasAttribute('data-export-fast') || elementId === 'idCardsGridExport';
  const targetWidth = isFast ? 1200 : 1800; // px
  const rawScale = targetWidth / Math.max(1, clientWidth);
  const scale = Math.max(isFast ? 1 : 1.25, Math.min(isFast ? 1.25 : 2, rawScale));

  const canvas: HTMLCanvasElement = await html2canvas(el, {
    scale,
    useCORS: true,
    backgroundColor: '#ffffff',
    imageTimeout: isFast ? 1500 : 3000,
    logging: false,
    ignoreElements: (node: Element) => {
      const hn = node as HTMLElement;
      return !!(hn && (hn.getAttribute?.('data-export-exclude') !== null));
    }
  });

  const imgData = canvas.toDataURL('image/png');
  if (isCard) {
    // Default: CR80 card 54 x 85.6mm; allow override via data attributes
    const cardWidthMm = customWidthMm ?? 54;
    const cardHeightMm = customHeightMm ?? 85.6;
    const orientation = cardWidthMm > cardHeightMm ? 'l' : 'p';
    const pdf = new jsPDFCtor(orientation, 'mm', [cardWidthMm, cardHeightMm]);
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 2; // small margin
    // Fit image within page while preserving aspect ratio
    const maxWidth = pageWidth - margin * 2;
    const maxHeight = pageHeight - margin * 2;
    const imgRatio = canvas.width / canvas.height;
    const pageRatio = maxWidth / maxHeight;
    let drawWidth = maxWidth;
    let drawHeight = maxHeight;
    if (imgRatio > pageRatio) {
      drawHeight = drawWidth / imgRatio;
    } else {
      drawWidth = drawHeight * imgRatio;
    }
    const x = (pageWidth - drawWidth) / 2;
    const y = (pageHeight - drawHeight) / 2;
    pdf.addImage(imgData, 'PNG', x, y, drawWidth, drawHeight);
    pdf.save(filename);
    return;
  } else {
    // Default: paginate onto A4
    const pdf = new jsPDFCtor('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(filename);
    return;
  }
}

function sanitizeText(s: string): string {
  return (s || '').replace(/\s+/g, ' ').trim();
}

function extractTableFromContainer(container: HTMLElement): { head: string[]; body: string[][] } | null {
  const table = container.querySelector('table');
  if (!table) return null;
  const head: string[] = [];
  const headerRow = table.querySelector('thead tr');
  if (headerRow) {
    headerRow.querySelectorAll('th').forEach(th => head.push(sanitizeText((th as HTMLElement).textContent || '')));
  } else {
    const firstRow = table.querySelector('tr');
    firstRow?.querySelectorAll('td,th').forEach(cell => head.push(sanitizeText((cell as HTMLElement).textContent || '')));
  }
  const body: string[][] = [];
  table.querySelectorAll('tbody tr').forEach(tr => {
    const row: string[] = [];
    tr.querySelectorAll('td').forEach(td => {
      const el = td as HTMLElement;
      // Prefer a label span if present, else textContent
      const txt = sanitizeText(el.getAttribute('data-export') || el.textContent || '');
      row.push(txt);
    });
    if (row.length) body.push(row);
  });
  // Filter out empty/utility columns like 'Actions'
  const dropIdx: number[] = [];
  head.forEach((h, i) => {
    const key = (h || '').toLowerCase();
    if (!key || key === 'actions' || key === 'action') dropIdx.push(i);
  });
  const filteredHead = head.filter((_, i) => !dropIdx.includes(i));
  const filteredBody = body.map(r => r.filter((_, i) => !dropIdx.includes(i)));
  return { head: filteredHead, body: filteredBody };
}

export async function downloadTableAsPdf(containerId: string, filename: string = 'export.pdf') {
  const container = document.getElementById(containerId);
  if (!container) return;
  const data = extractTableFromContainer(container);
  if (!data) {
    await downloadElementAsPdf(containerId, filename);
    return;
  }

  await ensureAutoTableLoaded();
  const jsPDFCtor = window.jsPDF || (window as any).jspdf?.jsPDF;
  if (!jsPDFCtor) {
    await downloadElementAsPdf(containerId, filename);
    return;
  }

  const doc = new jsPDFCtor('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  const heading = container.querySelector('h2, h1');
  const title = heading ? (heading as HTMLElement).innerText.trim() : 'Export';
  doc.setFontSize(14);
  doc.setTextColor(20);
  doc.text(title, margin, 16);
  doc.setFontSize(10);
  const now = new Date();
  const meta = `Generated: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
  doc.setTextColor(80);
  doc.text(meta, pageWidth - margin, 16, { align: 'right' as any });

  const docAny = doc as any;
  const globalAutoTable = (window as any).jspdf?.autoTable || (window as any).jsPDF?.autoTable;
  const runAutoTable = typeof docAny.autoTable === 'function'
    ? (opts: any) => docAny.autoTable(opts)
    : (typeof globalAutoTable === 'function' ? (opts: any) => globalAutoTable(doc, opts) : null);

  // Build numbered head/body
  const headWithNo = ['Sl. No.', ...data.head];
  const bodyWithNo = data.body.map((row, i) => [String(i + 1), ...row]);
  if (!runAutoTable) {
    // As a last resort, keep text-based guarantee by creating a simple text list
    let y = 24;
    doc.setFontSize(10);
    // header
    doc.setFont(undefined, 'bold');
    doc.text(headWithNo.join('  |  '), margin, y);
    doc.setFont(undefined, 'normal');
    y += 6;
    bodyWithNo.forEach(row => {
      const line = row.join('  |  ');
      doc.text(line, margin, y);
      y += 6;
      if (y > doc.internal.pageSize.getHeight() - 12) {
        doc.addPage();
        y = 16;
      }
    });
  } else {
    runAutoTable({
      head: [headWithNo],
      body: bodyWithNo,
      startY: 22,
      theme: 'grid',
      styles: {
        fontSize: 10,
        cellPadding: 3,
        textColor: 20,
        lineColor: [200, 200, 200],
        lineWidth: 0.2,
        overflow: 'linebreak',
      },
      headStyles: {
        fillColor: [245, 245, 245],
        textColor: 20,
        halign: 'left',
        fontStyle: 'bold',
      },
      alternateRowStyles: { fillColor: [252, 252, 252] },
      margin: { left: margin, right: margin },
      tableWidth: pageWidth - margin * 2,
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
      },
      didDrawPage: (dataArg: any) => {
        // Footer with page numbers
        const str = `Page ${doc.getNumberOfPages()}`;
        doc.setFontSize(9);
        doc.setTextColor(120);
        doc.text(str, pageWidth - margin, pageHeight - 8, { align: 'right' as any });
      },
    });
  }

  doc.save(filename);
}
