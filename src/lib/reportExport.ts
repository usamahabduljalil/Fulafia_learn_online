export interface ExportReportRow {
  student: string;
  email: string;
  attendanceMinutes: number;
  overall: number;
  attention: number;
  screenFocus: number;
  voice: number;
  speakingMinutes: number;
  turns: number;
  words: number;
  nudges: number;
  alerts: number;
  overrides: number;
}

const columns: Array<[keyof ExportReportRow, string]> = [
  ["student", "Student"], ["email", "Email"], ["attendanceMinutes", "Attendance minutes"],
  ["overall", "Overall %"], ["attention", "Attention %"], ["screenFocus", "Screen focus %"],
  ["voice", "Voice activity %"], ["speakingMinutes", "Speaking minutes"], ["turns", "Speaking turns"],
  ["words", "Word count"], ["nudges", "Nudges"], ["alerts", "Teacher alerts"], ["overrides", "Access overrides"],
];

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = fileName; anchor.click();
  URL.revokeObjectURL(url);
}

export function exportReportCsv(rows: ExportReportRow[], fileName: string) {
  const escape = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
  const csv = [columns.map(([, label]) => escape(label)).join(","), ...rows.map((row) => columns.map(([key]) => escape(row[key])).join(","))].join("\n");
  download(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${fileName}.csv`);
}

export async function exportReportPdf(title: string, subtitle: string, rows: ExportReportRow[], fileName: string) {
  const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const document = new jsPDF({ orientation: "landscape" });
  document.setTextColor(29, 78, 216); document.setFontSize(18); document.text("FULAFIA Online Class", 14, 16);
  document.setTextColor(20, 30, 50); document.setFontSize(14); document.text(title, 14, 25);
  document.setTextColor(90, 100, 115); document.setFontSize(9); document.text(subtitle, 14, 32);
  autoTableModule.default(document, { startY: 38, head: [columns.map(([, label]) => label)], body: rows.map((row) => columns.map(([key]) => row[key])), styles: { fontSize: 7 }, headStyles: { fillColor: [29, 78, 216] } });
  document.save(`${fileName}.pdf`);
}
