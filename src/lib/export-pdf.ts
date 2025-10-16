"use client";

import { REPORT_STYLES } from "@/lib/report-styles";
import { toast } from "sonner";

export type ExportPDFContext = {
  month: number;
  year: number;
  reportData: any; // сохранённый report.reportData или report state из редактора
  userName: string; // полное имя пользователя для форматирования
  createdAt?: string; // дата создания отчёта (для дашборда)
};

const MONTH_NAMES = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
];

const formatUserName = (fullName: string): string => {
  const parts = (fullName || "").trim().split(" ");
  if (parts.length >= 2) {
    const lastName = parts[0];
    const firstInitial = (parts[1] || "").charAt(0) + ".";
    const middleInitial = parts.length >= 3 ? (parts[2] || "").charAt(0) + "." : "";
    return `${lastName} ${firstInitial}${middleInitial}`;
  }
  return fullName || "___________";
};

// Расчёт оптимального масштаба как в дашборде
const calculatePDFScale = (rowCount: number): { scale: number; shouldFitOnePage: boolean } => {
  const maxRowsOnePage = REPORT_STYLES.pdfMaxRowsOnePage; // например 25
  const minScale = REPORT_STYLES.pdfMinScale; // жёсткий минимум 65%

  // Чуть уменьшаем базовый порог для учёта заголовков/итогов/подписи
  const baseRows = 19;

  if (rowCount <= baseRows) {
    return { scale: 1.0, shouldFitOnePage: true };
  }
  if (rowCount <= maxRowsOnePage) {
    const scaleRange = 1.0 - minScale;
    const rowRange = maxRowsOnePage - baseRows;
    const rowsOverBase = rowCount - baseRows;
    const calculatedScale = 1.0 - (scaleRange * rowsOverBase / rowRange);
    // ВАЖНО: если упираемся в минимум (<=65%), больше не пытаемся втиснуть на 1 страницу
    if (calculatedScale <= minScale) {
      return { scale: 1.0, shouldFitOnePage: false };
    }
    return { scale: calculatedScale, shouldFitOnePage: true };
  }
  return { scale: 1.0, shouldFitOnePage: false };
};

export const exportReportToPDF = async (ctx: ExportPDFContext) => {
  const html2pdf = (await import("html2pdf.js")).default;

  const reportData = ctx.reportData || {};
  const entries = reportData.entries || [];
  const fuelPrice = reportData.fuelPrice || 55;
  const isMintrans = reportData?.calculationMethod === "mintrans";

  const selectedFuelType = reportData.selectedFuelType || reportData.profile?.fuelType || "АИ-92";
  const fixedConsumptionRate = selectedFuelType.includes("95")
    ? (reportData.profile?.fuelConsumption95 || 0)
    : (reportData.profile?.fuelConsumption92 || 0);

  const totalMileage = entries.reduce((sum: number, e: any) => sum + (e.mileage || 0), 0);
  const totalFuel = entries.reduce((sum: number, e: any) => sum + (e.fuelUsed || 0), 0);
  const totalCost = totalFuel * parseFloat(fuelPrice.toString());

  const formattedName = formatUserName(ctx.userName || "___________");
  const monthValue = ctx.month;
  const yearValue = ctx.year;

  if (!monthValue || !yearValue) {
    toast.error("Ошибка: месяц или год отчета не указаны");
    return;
  }

  const monthIndex = monthValue - 1;
  const monthName = MONTH_NAMES[monthIndex];

  // Дата отчёта: приоритет reportData.reportDate, затем из createdAt (дашборд), иначе из правил редактора (текущий день, следующая от месяца)
  let finalReportDate = reportData.reportDate as string | undefined;
  if (!finalReportDate) {
    if (ctx.createdAt) {
      const d = new Date(ctx.createdAt);
      const dd = d.getDate();
      const mm = d.getMonth() + 1;
      const yy = d.getFullYear();
      finalReportDate = `${dd.toString().padStart(2, '0')}.${mm.toString().padStart(2, '0')}.${yy}`;
    } else {
      const currentDate = new Date();
      const currentDay = currentDate.getDate();
      let compilationMonth = monthValue;
      let compilationYear = yearValue;
      if (compilationMonth === 12) { compilationMonth = 1; compilationYear = yearValue + 1; } else { compilationMonth = monthValue + 1; }
      finalReportDate = `${currentDay.toString().padStart(2, '0')}.${compilationMonth.toString().padStart(2, '0')}.${compilationYear}`;
    }
  }
  const finalEmployeeName = reportData.employeeName || formattedName;

  let vehicleInfo = `${reportData.profile?.carBrand || ""} ${reportData.profile?.carModel || ""}`.trim();
  if (reportData.profile?.licensePlate) {
    vehicleInfo += `, гос.номер ${reportData.profile.licensePlate}`;
  }

  // ВЕТКА SIMPLE: авто-масштабирование и пагинация как в дашборде
  if (!isMintrans) {
    let { scale, shouldFitOnePage } = calculatePDFScale(entries.length);
    const scalePercent = Math.round(scale * 100);

    let htmlContent = "";
    if (shouldFitOnePage) {
      // Реальное уменьшение размеров (без CSS transform), чтобы не было ложных переносов
      const s = scale;
      const headerFS = Math.max(12, Math.round(REPORT_STYLES.headerFontSize * s));
      const textFS = Math.max(10, Math.round(REPORT_STYLES.textFontSize * s));
      const vehicleInfoFS = Math.max(9, Math.round(REPORT_STYLES.vehicleInfoFontSize * s));
      const tableFS = Math.max(9, Math.round(REPORT_STYLES.tableFontSize * s));
      const summaryFS = Math.max(9, Math.round(REPORT_STYLES.summaryFontSize * s));
      const signatureFS = Math.max(9, Math.round(REPORT_STYLES.signatureFontSize * s));
      const lineH = Number(REPORT_STYLES.lineHeight) * (s < 1 ? 0.95 : 1);

      const headPadV = Math.max(4, Math.round(6 * s));
      const headPadH = Math.max(3, Math.round(4 * s));
      const cellPad = Math.max(3, Math.round(4 * s));
      const totalPadV = Math.max(5, Math.round(6 * s));

      const headPad = `${headPadV}px ${headPadH}px`;
      const cellPadStr = `${cellPad}px`;
      const totalPad = `${totalPadV}px ${headPadH}px`;

      const headerMb = Math.max(10, Math.round(12 * s));
      const headerH1Mb = Math.max(3, Math.round(4 * s));
      const subLineMb = Math.max(2, Math.round(3 * s));
      const vehicleTop = Math.max(4, Math.round(6 * s));

      const summaryMarginV = Math.max(4, Math.round(6 * s));
      const summaryItemMarginV = Math.max(2, Math.round(3 * s));
      const signatureTop = Math.max(6, Math.round(8 * s));
      const signatureBottom = Math.max(4, Math.round(6 * s));

      htmlContent = `
        <div style="font-family: '${REPORT_STYLES.fontFamily}', serif; line-height: ${lineH}; padding: 0; page-break-inside: avoid; break-inside: avoid; page-break-after: avoid;">
          <div style="text-align: center; margin-bottom: ${headerMb}px;">
            <h1 style="font-size: ${headerFS}px; font-weight: bold; margin: 0 0 ${headerH1Mb}px 0;">ОТЧЕТ</h1>
            <p style="font-size: ${textFS}px; margin: ${subLineMb}px 0;">об использовании личного автомобиля в служебных целях</p>
            <p style="font-size: ${textFS}px; margin: ${subLineMb}px 0;">за ${monthName} ${yearValue} года</p>
            <p style="font-size: ${vehicleInfoFS}px; margin: ${vehicleTop}px 0 0 0;">${vehicleInfo}</p>
          </div>
          <div style="border: ${REPORT_STYLES.borderWidth} solid ${REPORT_STYLES.borderColor};">
            <table style="width: 100%; border-collapse: collapse; font-size: ${tableFS}px; margin: 0;">
              <thead>
                <tr>
                  <th style="padding: ${headPad}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}; background: ${REPORT_STYLES.backgroundColor}; width: ${REPORT_STYLES.columnPercents[0]}%">Дата</th>
                  <th style="padding: ${headPad}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}; background: ${REPORT_STYLES.backgroundColor}; width: ${REPORT_STYLES.columnPercents[1]}%">Маршрут</th>
                  <th style="padding: ${headPad}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}; background: ${REPORT_STYLES.backgroundColor}; width: ${REPORT_STYLES.columnPercents[2]}%">Пробег, км</th>
                  <th style="padding: ${headPad}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}; background: ${REPORT_STYLES.backgroundColor}; width: ${REPORT_STYLES.columnPercents[3]}%">Норма, л/100км</th>
                  <th style="padding: ${headPad}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}; background: ${REPORT_STYLES.backgroundColor}; width: ${REPORT_STYLES.columnPercents[4]}%">Расход, л</th>
                </tr>
              </thead>
              <tbody>
                ${entries.map((entry: any) => `
                  <tr>
                    <td style="padding: ${cellPadStr}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${entry.date}</td>
                    <td style="padding: ${cellPadStr}; text-align: left; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${entry.clients}</td>
                    <td style="padding: ${cellPadStr}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${Number(entry.mileage || 0).toFixed(1)}</td>
                    <td style="padding: ${cellPadStr}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${Number(fixedConsumptionRate).toFixed(2)}</td>
                    <td style="padding: ${cellPadStr}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${Number(entry.fuelUsed || 0).toFixed(1)}</td>
                  </tr>
                `).join("")}
                <tr style="font-weight: bold; background: ${REPORT_STYLES.backgroundColor};">
                  <td colspan="2" style="padding: ${totalPad}; text-align: right; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">ИТОГО:</td>
                  <td style="padding: ${totalPad}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${totalMileage.toFixed(1)}</td>
                  <td style="padding: ${totalPad}; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};"></td>
                  <td style="padding: ${totalPad}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${totalFuel.toFixed(1)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div style="margin: ${summaryMarginV}px 0; font-size: ${summaryFS}px; text-align: right;">
            <p style="margin: ${summaryItemMarginV}px 0;"><strong>Стоимость бензина:</strong> ${parseFloat(fuelPrice.toString()).toFixed(2)} ₽/л</p>
            <p style="margin: ${summaryItemMarginV}px 0; font-size: ${summaryFS + 1}px;"><strong>ВСЕГО:</strong> ${totalCost.toFixed(2)} ₽</p>
          </div>
          <div style="margin-top: ${signatureTop}px; padding-bottom: ${signatureBottom}px; font-size: ${signatureFS}px; display: flex; justify-content: space-between; break-inside: avoid; page-break-inside: avoid;">
            <div>Дата отчёта: ${finalReportDate}</div>
            <div>Составитель _____________ ${finalEmployeeName}</div>
          </div>
        </div>`;
    } else {
      const maxRowsPerPage = REPORT_STYLES.maxRowsPerPage;
      const pages: any[][] = [];
      for (let i = 0; i < entries.length; i += maxRowsPerPage) {
        pages.push(entries.slice(i, i + maxRowsPerPage));
      }
      htmlContent = pages.map((pageEntries, pageIndex) => {
        const isLastPage = pageIndex === pages.length - 1;
        const pageMileage = pageEntries.reduce((sum: number, e: any) => sum + (e.mileage || 0), 0);
        const pageFuel = pageEntries.reduce((sum: number, e: any) => sum + (e.fuelUsed || 0), 0);
        return `
          <div style="font-family: '${REPORT_STYLES.fontFamily}', serif; line-height: ${REPORT_STYLES.lineHeight}; padding: 0; ${pageIndex > 0 ? 'page-break-before: always;' : ''}">
            <div style="text-align: center; margin-bottom: 15px;">
              <h1 style="font-size: ${REPORT_STYLES.headerFontSize}px; font-weight: bold; margin: 0 0 6px 0;">ОТЧЕТ${pageIndex > 0 ? ' (продолжение)' : ''}</h1>
              <p style="font-size: ${REPORT_STYLES.textFontSize}px; margin: 3px 0;">об использовании личного автомобиля в служебных целях</p>
              <p style="font-size: ${REPORT_STYLES.textFontSize}px; margin: 3px 0;">за ${monthName} ${yearValue} года</p>
              <p style="font-size: 11px; margin: 8px 0 0 0;">${vehicleInfo}</p>
              ${pageIndex > 0 ? `<p style=\"font-size: 10px; margin: 4px 0; color: #666;\">Страница ${pageIndex + 1} из ${pages.length}</p>` : ''}
            </div>
            <div style="border: ${REPORT_STYLES.borderWidth} solid ${REPORT_STYLES.borderColor};">
              <table style="width: 100%; border-collapse: collapse; font-size: ${REPORT_STYLES.tableFontSize}px; margin: 0;">
                <thead>
                  <tr>
                    <th style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}; background: ${REPORT_STYLES.backgroundColor}; width: ${REPORT_STYLES.columnPercents[0]}%">Дата</th>
                    <th style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}; background: ${REPORT_STYLES.backgroundColor}; width: ${REPORT_STYLES.columnPercents[1]}%">Маршрут</th>
                    <th style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}; background: ${REPORT_STYLES.backgroundColor}; width: ${REPORT_STYLES.columnPercents[2]}%">Пробег,<br/>км</th>
                    <th style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}; background: ${REPORT_STYLES.backgroundColor}; width: ${REPORT_STYLES.columnPercents[3]}%">Норма,<br/>л/100км</th>
                    <th style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}; background: ${REPORT_STYLES.backgroundColor}; width: ${REPORT_STYLES.columnPercents[4]}%">Расход,<br/>л</th>
                  </tr>
                </thead>
                <tbody>
                  ${pageEntries.map((entry: any) => `
                    <tr>
                      <td style="padding: ${REPORT_STYLES.cellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${entry.date}</td>
                      <td style="padding: ${REPORT_STYLES.cellPadding}; text-align: left; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${entry.clients}</td>
                      <td style="padding: ${REPORT_STYLES.cellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${Number(entry.mileage || 0).toFixed(1)}</td>
                      <td style="padding: ${REPORT_STYLES.cellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${Number(fixedConsumptionRate).toFixed(2)}</td>
                      <td style="padding: ${REPORT_STYLES.cellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${Number(entry.fuelUsed || 0).toFixed(1)}</td>
                    </tr>
                  `).join("")}
                  <tr style="font-weight: bold; background: ${REPORT_STYLES.backgroundColor};">
                    <td colspan="2" style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: right; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${isLastPage ? 'ИТОГО:' : 'Итого на странице:'}</td>
                    <td style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${pageMileage.toFixed(1)}</td>
                    <td style="padding: ${REPORT_STYLES.headerCellPadding}; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};"></td>
                    <td style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${pageFuel.toFixed(1)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            ${isLastPage ? `
              <div style="margin: 12px 0; font-size: 12px; text-align: right;">
                <p style="margin: 4px 0;"><strong>ИТОГО за весь период:</strong> Пробег ${totalMileage.toFixed(1)} км, Расход ${totalFuel.toFixed(1)} л</p>
                <p style="margin: 4px 0;"><strong>Стоимость бензина:</strong> ${parseFloat(fuelPrice.toString()).toFixed(2)} ₽/л</p>
                <p style="margin: 4px 0; font-size: 13px;"><strong>ВСЕГО:</strong> ${totalCost.toFixed(2)} ₽</p>
              </div>
              <div style="margin-top: 30px; padding-bottom: 20px; font-size: 11px; display: flex; justify-content: space-between; break-inside: avoid; page-break-inside: avoid;">
                <div>Дата отчёта: ${finalReportDate}</div>
                <div>Составитель _____________ ${finalEmployeeName}</div>
              </div>
            ` : `
              <div style="margin: 8px 0; font-size: 10px; text-align: center; color: #666;">
                <p style="margin: 0;">Продолжение на следующей странице...</p>
              </div>
            `}
          </div>`;
      }).join("");
    }

    // --- Добавляем проверку реальной высоты и фоллбэк на постраничный режим ---
    const PX_PER_MM = 96 / 25.4;
    let finalShouldFit = shouldFitOnePage;
    if (shouldFitOnePage) {
      const testEl = document.createElement('div');
      testEl.style.position = 'absolute';
      testEl.style.visibility = 'hidden';
      testEl.style.left = '-9999px';
      testEl.innerHTML = htmlContent;
      document.body.appendChild(testEl);
      const topMm = REPORT_STYLES.marginTop * 25.4;
      const bottomMm = REPORT_STYLES.marginBottom * 25.4;
      const availableMm = 210 - (topMm + bottomMm); // высота A4 в альбомной ориентации
      const availablePx = availableMm * PX_PER_MM;
      const contentPx = testEl.scrollHeight;
      document.body.removeChild(testEl);
      if (contentPx > availablePx) {
        // Перестраиваем как многостраничный отчёт без обрезаний
        finalShouldFit = false;
        const maxRowsPerPage = REPORT_STYLES.maxRowsPerPage;
        const pages: any[][] = [];
        for (let i = 0; i < entries.length; i += maxRowsPerPage) {
          pages.push(entries.slice(i, i + maxRowsPerPage));
        }
        htmlContent = pages.map((pageEntries, pageIndex) => {
          const isLastPage = pageIndex === pages.length - 1;
          const pageMileage = pageEntries.reduce((sum: number, e: any) => sum + (e.mileage || 0), 0);
          const pageFuel = pageEntries.reduce((sum: number, e: any) => sum + (e.fuelUsed || 0), 0);
          return `
            <div style="font-family: '${REPORT_STYLES.fontFamily}', serif; line-height: ${REPORT_STYLES.lineHeight}; padding: 0; ${pageIndex > 0 ? 'page-break-before: always;' : ''}">
              <div style="text-align: center; margin-bottom: 15px;">
                <h1 style="font-size: ${REPORT_STYLES.headerFontSize}px; font-weight: bold; margin: 0 0 6px 0;">ОТЧЕТ${pageIndex > 0 ? ' (продолжение)' : ''}</h1>
                <p style="font-size: ${REPORT_STYLES.textFontSize}px; margin: 3px 0;">об использовании личного автомобиля в служебных целях</p>
                <p style="font-size: ${REPORT_STYLES.textFontSize}px; margin: 3px 0;">за ${monthName} ${yearValue} года</p>
                <p style="font-size: 11px; margin: 8px 0 0 0;">${vehicleInfo}</p>
                ${pageIndex > 0 ? `<p style=\"font-size: 10px; margin: 4px 0; color: #666;\">Страница ${pageIndex + 1} из ${pages.length}</p>` : ''}
              </div>
              <div style="border: ${REPORT_STYLES.borderWidth} solid ${REPORT_STYLES.borderColor};">
                <table style="width: 100%; border-collapse: collapse; font-size: ${REPORT_STYLES.tableFontSize}px; margin: 0;">
                  <thead>
                    <tr>
                      <th style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}; background: ${REPORT_STYLES.backgroundColor}; width: ${REPORT_STYLES.columnPercents[0]}%">Дата</th>
                      <th style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}; background: ${REPORT_STYLES.backgroundColor}; width: ${REPORT_STYLES.columnPercents[1]}%">Маршрут</th>
                      <th style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}; background: ${REPORT_STYLES.backgroundColor}; width: ${REPORT_STYLES.columnPercents[2]}%">Пробег,<br/>км</th>
                      <th style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}; background: ${REPORT_STYLES.backgroundColor}; width: ${REPORT_STYLES.columnPercents[3]}%">Норма,<br/>л/100км</th>
                      <th style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}; background: ${REPORT_STYLES.backgroundColor}; width: ${REPORT_STYLES.columnPercents[4]}%">Расход,<br/>л</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${pageEntries.map((entry: any) => `
                      <tr>
                        <td style="padding: ${REPORT_STYLES.cellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${entry.date}</td>
                        <td style="padding: ${REPORT_STYLES.cellPadding}; text-align: left; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${entry.clients}</td>
                        <td style="padding: ${REPORT_STYLES.cellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${Number(entry.mileage || 0).toFixed(1)}</td>
                        <td style="padding: ${REPORT_STYLES.cellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${Number(fixedConsumptionRate).toFixed(2)}</td>
                        <td style="padding: ${REPORT_STYLES.cellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${Number(entry.fuelUsed || 0).toFixed(1)}</td>
                      </tr>
                    `).join("")}
                    <tr style="font-weight: bold; background: ${REPORT_STYLES.backgroundColor};">
                      <td colspan="2" style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: right; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${isLastPage ? 'ИТОГО:' : 'Итого на странице:'}</td>
                      <td style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${pageMileage.toFixed(1)}</td>
                      <td style="padding: ${REPORT_STYLES.headerCellPadding}; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};"></td>
                      <td style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${pageFuel.toFixed(1)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              ${isLastPage ? `
                <div style=\"margin: 12px 0; font-size: 12px; text-align: right;\">
                  <p style=\"margin: 4px 0;\"><strong>ИТОГО за весь период:</strong> Пробег ${totalMileage.toFixed(1)} км, Расход ${totalFuel.toFixed(1)} л</p>
                  <p style=\"margin: 4px 0;\"><strong>Стоимость бензина:</strong> ${parseFloat(fuelPrice.toString()).toFixed(2)} ₽/л</p>
                  <p style=\"margin: 4px 0; font-size: 13px;\"><strong>ВСЕГО:</strong> ${totalCost.toFixed(2)} ₽</p>
                </div>
                <div style=\"margin-top: 30px; padding-bottom: 20px; font-size: 11px; display: flex; justify-content: space-between; break-inside: avoid; page-break-inside: avoid;\">
                  <div>Дата отчёта: ${finalReportDate}</div>
                  <div>Составитель _____________ ${finalEmployeeName}</div>
                </div>
              ` : `
                <div style=\"margin: 8px 0; font-size: 10px; text-align: center; color: #666;\">\n                  <p style=\"margin: 0;\">Продолжение на следующей странице...</p>\n                </div>
              `}
            </div>`;
        }).join("");
      }
    }

    const marginTopMm = REPORT_STYLES.marginTop * 25.4;
    const marginBottomMm = REPORT_STYLES.marginBottom * 25.4;
    const marginLeftMm = REPORT_STYLES.marginLeft * 25.4;
    const marginRightMm = REPORT_STYLES.marginRight * 25.4;

    const element = document.createElement('div');
    element.innerHTML = htmlContent;

    // Финальная проверка переполнения уже собранного элемента: если не помещается — переключаемся на многостраничный режим
    if (finalShouldFit) {
      try {
        const pageWidthMm = 297; // A4 landscape
        const pageHeightMm = 210;
        const availHeightMm = pageHeightMm - marginTopMm - marginBottomMm;
        const availWidthMm = pageWidthMm - marginLeftMm - marginRightMm;
        const safetyBufferMm = 12; // консервативный буфер
        const testHeightMm = Math.max(0, availHeightMm - safetyBufferMm);
        const mmToPx = (mm: number) => (mm * 96) / 25.4;
        const availWidthPx = Math.round(mmToPx(availWidthMm));
        const testHeightPx = Math.round(mmToPx(testHeightMm));

        const frame = document.createElement('div');
        frame.style.position = 'absolute';
        frame.style.left = '-10000px';
        frame.style.top = '0';
        frame.style.width = `${availWidthPx}px`;
        frame.style.height = `${testHeightPx}px`;
        frame.style.overflow = 'hidden';
        const probe = document.createElement('div');
        probe.style.width = `${availWidthPx}px`;
        probe.style.maxWidth = `${availWidthPx}px`;
        probe.innerHTML = htmlContent;
        frame.appendChild(probe);
        document.body.appendChild(frame);
        const overflowed = probe.scrollHeight > frame.clientHeight;
        document.body.removeChild(frame);
        if (overflowed) {
          // перестроить как многостраничный
          const maxRowsPerPage = REPORT_STYLES.maxRowsPerPage;
          const pages: any[][] = [];
          for (let i = 0; i < entries.length; i += maxRowsPerPage) {
            pages.push(entries.slice(i, i + maxRowsPerPage));
          }
          htmlContent = pages.map((pageEntries, pageIndex) => {
            const isLastPage = pageIndex === pages.length - 1;
            const pageMileage = pageEntries.reduce((sum: number, e: any) => sum + (e.mileage || 0), 0);
            const pageFuel = pageEntries.reduce((sum: number, e: any) => sum + (e.fuelUsed || 0), 0);
            return `
              <div style="font-family: '${REPORT_STYLES.fontFamily}', serif; line-height: ${REPORT_STYLES.lineHeight}; padding: 0; ${pageIndex > 0 ? 'page-break-before: always;' : ''}">
                <div style="text-align: center; margin-bottom: 15px;">
                  <h1 style="font-size: ${REPORT_STYLES.headerFontSize}px; font-weight: bold; margin: 0 0 6px 0;">ОТЧЕТ${pageIndex > 0 ? ' (продолжение)' : ''}</h1>
                  <p style="font-size: ${REPORT_STYLES.textFontSize}px; margin: 3px 0;">об использовании личного автомобиля в служебных целях</p>
                  <p style="font-size: ${REPORT_STYLES.textFontSize}px; margin: 3px 0;">за ${monthName} ${yearValue} года</p>
                  <p style="font-size: 11px; margin: 8px 0 0 0;">${vehicleInfo}</p>
                  ${pageIndex > 0 ? `<p style=\"font-size: 10px; margin: 4px 0; color: #666;\">Страница ${pageIndex + 1} из ${pages.length}</p>` : ''}
                </div>
                <div style="border: ${REPORT_STYLES.borderWidth} solid ${REPORT_STYLES.borderColor};">
                  <table style="width: 100%; border-collapse: collapse; font-size: ${REPORT_STYLES.tableFontSize}px; margin: 0;">
                    <thead>
                      <tr>
                        <th style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}; background: ${REPORT_STYLES.backgroundColor}; width: ${REPORT_STYLES.columnPercents[0]}%">Дата</th>
                        <th style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}; background: ${REPORT_STYLES.backgroundColor}; width: ${REPORT_STYLES.columnPercents[1]}%">Маршрут</th>
                        <th style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}; background: ${REPORT_STYLES.backgroundColor}; width: ${REPORT_STYLES.columnPercents[2]}%">Пробег,<br/>км</th>
                        <th style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}; background: ${REPORT_STYLES.backgroundColor}; width: ${REPORT_STYLES.columnPercents[3]}%">Норма,<br/>л/100км</th>
                        <th style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}; background: ${REPORT_STYLES.backgroundColor}; width: ${REPORT_STYLES.columnPercents[4]}%">Расход,<br/>л</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${pageEntries.map((entry: any) => `
                        <tr>
                          <td style="padding: ${REPORT_STYLES.cellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${entry.date}</td>
                          <td style="padding: ${REPORT_STYLES.cellPadding}; text-align: left; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${entry.clients}</td>
                          <td style="padding: ${REPORT_STYLES.cellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${Number(entry.mileage || 0).toFixed(1)}</td>
                          <td style="padding: ${REPORT_STYLES.cellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${Number(fixedConsumptionRate).toFixed(2)}</td>
                          <td style="padding: ${REPORT_STYLES.cellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${Number(entry.fuelUsed || 0).toFixed(1)}</td>
                        </tr>
                      `).join("")}
                      <tr style="font-weight: bold; background: ${REPORT_STYLES.backgroundColor};">
                        <td colspan="2" style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: right; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${isLastPage ? 'ИТОГО:' : 'Итого на странице:'}</td>
                        <td style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${pageMileage.toFixed(1)}</td>
                        <td style="padding: ${REPORT_STYLES.headerCellPadding}; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};"></td>
                        <td style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${pageFuel.toFixed(1)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                ${isLastPage ? `
                  <div style="margin: 12px 0; font-size: 12px; text-align: right;">
                    <p style="margin: 4px 0;"><strong>ИТОГО за весь период:</strong> Пробег ${totalMileage.toFixed(1)} км, Расход ${totalFuel.toFixed(1)} л</p>
                    <p style="margin: 4px 0;"><strong>Стоимость бензина:</strong> ${parseFloat(fuelPrice.toString()).toFixed(2)} ₽/л</p>
                    <p style="margin: 4px 0; font-size: 13px;"><strong>ВСЕГО:</strong> ${totalCost.toFixed(2)} ₽</p>
                  </div>
                  <div style="margin-top: 30px; padding-bottom: 20px; font-size: 11px; display: flex; justify-content: space-between; break-inside: avoid; page-break-inside: avoid;">
                    <div>Дата отчёта: ${finalReportDate}</div>
                    <div>Составитель _____________ ${finalEmployeeName}</div>
                  </div>
                ` : `
                  <div style="margin: 8px 0; font-size: 10px; text-align: center; color: #666;">
                    <p style="margin: 0;">Продолжение на следующей странице...</p>
                  </div>
                `}
              </div>`;
          }).join("");
          element.innerHTML = htmlContent;
          finalShouldFit = false;
        }
      } catch {}
    }

    const opt = {
      // html2pdf ожидает порядок [top, right, bottom, left]
      margin: [marginTopMm, marginRightMm, marginBottomMm, marginLeftMm],
      filename: `Отчёт_${finalEmployeeName}_${monthName}_${yearValue}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: REPORT_STYLES.pdfScale, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape', putOnlyUsedFonts: true, compress: true },
      pagebreak: { mode: finalShouldFit ? 'avoid-all' as any : (REPORT_STYLES.pdfPageBreakMode as any) }
    };

    await html2pdf().set(opt).from(element).save();
    if (finalShouldFit && scalePercent < 100) {
      toast.success(`Отчёт экспортирован в PDF (масштаб ${scalePercent}%)`);
    } else {
      toast.success("Отчёт экспортирован в PDF");
    }
    return;
  }

  // ВЕТКА MINTRANS: основной лист + обоснование, как в дашборде
  const mintransCoeffs = reportData.mintransCoefficients;
  const dailyBreakdown = reportData.dailyBreakdown || [];

  // Постраничный основной отчёт (Минтранс): без масштабирования, разбивка по строкам, подпись на последней странице
  const maxRowsPerPageMain = REPORT_STYLES.maxRowsPerPage;
  const mainPages: any[][] = [];
  for (let i = 0; i < entries.length; i += maxRowsPerPageMain) {
    mainPages.push(entries.slice(i, i + maxRowsPerPageMain));
  }

  const pagesMainHTML = mainPages.map((pageEntries, pageIndex) => {
    const isLastPage = pageIndex === mainPages.length - 1;
    const pageMileage = pageEntries.reduce((sum: number, e: any) => sum + (e.mileage || 0), 0);
    const pageFuel = pageEntries.reduce((sum: number, e: any) => sum + (e.fuelUsed || 0), 0);
    return `
      <div style="font-family: '${REPORT_STYLES.fontFamily}', serif; line-height: ${REPORT_STYLES.lineHeight}; padding: 0; ${pageIndex > 0 ? 'page-break-before: always;' : ''}">
        <div style="text-align: center; margin-bottom: 15px;">
          <h1 style="font-size: ${REPORT_STYLES.headerFontSize}px; font-weight: bold; margin: 0 0 6px 0;">ОТЧЕТ${pageIndex > 0 ? ' (продолжение)' : ''}</h1>
          <p style="font-size: ${REPORT_STYLES.textFontSize}px; margin: 3px 0;">об использовании личного автомобиля в служебных целях</p>
          <p style="font-size: ${REPORT_STYLES.textFontSize}px; margin: 3px 0;">за ${monthName} ${yearValue} года</p>
          <p style="font-size: 12px; margin: 8px 0 0 0;">${vehicleInfo}</p>
          ${pageIndex > 0 ? `<p style=\"font-size: 10px; margin: 4px 0; color: #666;\">Страница ${pageIndex + 1} из ${mainPages.length}</p>` : ''}
        </div>
        <div style="border: ${REPORT_STYLES.borderWidth} solid ${REPORT_STYLES.borderColor};">
          <table style="width: 100%; border-collapse: collapse; font-size: ${REPORT_STYLES.tableFontSize}px; margin: 0;">
            <thead>
              <tr>
                <th style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}; background: ${REPORT_STYLES.backgroundColor}; width: ${REPORT_STYLES.columnPercents[0]}%">Дата</th>
                <th style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}; background: ${REPORT_STYLES.backgroundColor}; width: ${REPORT_STYLES.columnPercents[1]}%">Маршрут</th>
                <th style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}; background: ${REPORT_STYLES.backgroundColor}; width: ${REPORT_STYLES.columnPercents[2]}%">Пробег, км</th>
                <th style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}; background: ${REPORT_STYLES.backgroundColor}; width: ${REPORT_STYLES.columnPercents[3]}%">Норма, л/100км</th>
                <th style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}; background: ${REPORT_STYLES.backgroundColor}; width: ${REPORT_STYLES.columnPercents[4]}%">Расход, л</th>
              </tr>
            </thead>
            <tbody>
              ${pageEntries.map((entry: any) => {
                const individualRate = (entry.mileage || 0) > 0 ? ((entry.fuelUsed || 0) / (entry.mileage || 0)) * 100 : 0;
                return `
                  <tr>
                    <td style="padding: ${REPORT_STYLES.cellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${entry.date}</td>
                    <td style="padding: ${REPORT_STYLES.cellPadding}; text-align: left; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${entry.clients}</td>
                    <td style="padding: ${REPORT_STYLES.cellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${Number(entry.mileage || 0).toFixed(1)}</td>
                    <td style="padding: ${REPORT_STYLES.cellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${individualRate.toFixed(2)}</td>
                    <td style="padding: ${REPORT_STYLES.cellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${Number(entry.fuelUsed || 0).toFixed(1)}</td>
                  </tr>
                `;
              }).join("")}
              <tr style="font-weight: bold; background: ${REPORT_STYLES.backgroundColor};">
                <td colspan="2" style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: right; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${isLastPage ? 'ИТОГО:' : 'Итого на странице:'}</td>
                <td style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${pageMileage.toFixed(1)}</td>
                <td style="padding: ${REPORT_STYLES.headerCellPadding}; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};"></td>
                <td style="padding: ${REPORT_STYLES.headerCellPadding}; text-align: center; border: ${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor};">${pageFuel.toFixed(1)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        ${isLastPage ? `
          <div style="margin: 12px 0; font-size: 12px; text-align: right;">
            <p style="margin: 4px 0;"><strong>ИТОГО за весь период:</strong> Пробег ${totalMileage.toFixed(1)} км, Расход ${totalFuel.toFixed(1)} л</p>
            <p style="margin: 4px 0;"><strong>Стоимость бензина:</strong> ${parseFloat(fuelPrice.toString()).toFixed(2)} ₽/л</p>
            <p style="margin: 4px 0; font-size: 13px;"><strong>ВСЕГО:</strong> ${totalCost.toFixed(2)} ₽</p>
          </div>
          <div style="margin-top: 20px; font-size: 11px; display: flex; justify-content: space-between; break-inside: avoid; page-break-inside: avoid;">
            <div>Дата отчёта: ${finalReportDate}</div>
            <div>Составитель _____________ ${finalEmployeeName}</div>
          </div>
        ` : `
          <div style="margin: 8px 0; font-size: 10px; text-align: center; color: #666;">
            <p style="margin: 0;">Продолжение на следующей странице...</p>
          </div>
        `}
      </div>
    `;
  }).join("");

  let justificationHTML = "";
  if (mintransCoeffs) {
    const Hbase = mintransCoeffs.baseConsumption;
    let calcTableRows = "";
    if (dailyBreakdown && dailyBreakdown.length > 0) {
      calcTableRows = dailyBreakdown.map((day: any) => {
        const ageCoeff = day.coefficients?.vehicleAge || 1.0;
        const modeCoeff = day.coefficients?.drivingMode || 1.15;
        const tempCoeff = day.coefficients?.temperature || 1.0;
        const terrainCoeff = day.coefficients?.terrain || 1.0;
        const roadCoeff = day.coefficients?.roadCondition || 1.0;
        const modeLabel = day.drivingMode === "city" ? "Город" : day.drivingMode === "highway" ? "Трасса" : "Смеш.";
        const terrainLabel = day.terrainType === "plain" ? "Равн." : day.terrainType === "hilly" ? "Холм." : "Горы";
        const roadLabel = day.roadQuality === "good" ? "Хор." : day.roadQuality === "fair" ? "Уд." : "Плох.";
        const formula = `${Hbase}×${ageCoeff}×${modeCoeff}×${(tempCoeff as number).toFixed(2)}×${terrainCoeff}×${roadCoeff}×${day.mileage || 0}`;
        return `
          <tr>
            <td style="padding: 4px 3px; text-align: center; vertical-align: middle; border: 0.5pt solid #000; font-size: ${REPORT_STYLES.tableFontSize}pt;">${day.date}</td>
            <td style="padding: 4px 3px; text-align: center; vertical-align: middle; border: 0.5pt solid #000; font-size: ${REPORT_STYLES.tableFontSize}pt;">${day.temperature > 0 ? '+' : ''}${day.temperature}</td>
            <td style="padding: 4px 3px; text-align: center; vertical-align: middle; border: 0.5pt solid #000; font-size: ${REPORT_STYLES.tableFontSize}pt;">${modeLabel}</td>
            <td style="padding: 4px 3px; text-align: center; vertical-align: middle; border: 0.5pt solid #000; font-size: ${REPORT_STYLES.tableFontSize}pt;">${ageCoeff}</td>
            <td style="padding: 4px 3px; text-align: center; vertical-align: middle; border: 0.5pt solid #000; font-size: ${REPORT_STYLES.tableFontSize}pt;">${terrainLabel}</td>
            <td style="padding: 4px 3px; text-align: center; vertical-align: middle; border: 0.5pt solid #000; font-size: ${REPORT_STYLES.tableFontSize}pt;">${roadLabel}</td>
            <td style="padding: 4px 3px; text-align: left; vertical-align: middle; border: 0.5pt solid #000; font-size: ${REPORT_STYLES.tableFontSize - 1}pt; font-family: 'Courier New', monospace; word-wrap: break-word;">0.01×${formula}</td>
            <td style="padding: 4px 3px; text-align: center; vertical-align: middle; border: 0.5pt solid #000; font-size: ${REPORT_STYLES.tableFontSize}pt; font-weight: bold;">${(day.fuelUsed ?? 0).toFixed(2)}</td>
          </tr>`;
      }).join("");
    }

    justificationHTML = `
      <div style="font-family: '${REPORT_STYLES.fontFamily}', serif; line-height: ${REPORT_STYLES.lineHeight}; padding: 0; page-break-before: always;">
        <h2 style="font-size: ${REPORT_STYLES.justificationTitleFontSize}pt; font-weight: bold; text-align: center; margin: 0 0 3px 0; border-bottom: 1.5pt solid #000; padding-bottom: 2px;">ОБОСНОВАНИЕ РАСЧЕТА</h2>
        <p style="font-size: ${REPORT_STYLES.justificationSubtitleFontSize}pt; text-align: center; margin: 1px 0 4px 0; font-style: italic;">Распоряжение Минтранса России от 14.03.2008 N АМ-23-р (ред. от 30.09.2021)</p>
        <div style="border: 1pt solid #000; padding: 3px; margin: 3px 0; background: #f5f5f5;">
          <p style="font-size: ${REPORT_STYLES.justificationLabelFontSize}pt; font-weight: bold; margin: 0 0 1px 0;">ФОРМУЛА:</p>
          <div style="padding: 2px; font-family: 'Courier New', monospace; font-size: ${REPORT_STYLES.justificationFormulaFontSize}pt; text-align: center; font-weight: bold; line-height: 1.4;">
            Q = 0.01 × H<sub style="font-size: ${REPORT_STYLES.justificationSubtitleFontSize}pt;">base</sub> × K<sub style="font-size: ${REPORT_STYLES.justificationSubtitleFontSize}pt;">возраст</sub> × K<sub style="font-size: ${REPORT_STYLES.justificationSubtitleFontSize}pt;">режим</sub> × K<sub style="font-size: ${REPORT_STYLES.justificationSubtitleFontSize}pt;">темп</sub> × K<sub style="font-size: ${REPORT_STYLES.justificationSubtitleFontSize}pt;">местн</sub> × K<sub style="font-size: ${REPORT_STYLES.justificationSubtitleFontSize}pt;">дороги</sub> × S
          </div>
          <p style="font-size: ${REPORT_STYLES.justificationSubtitleFontSize}pt; margin: 1px 0 0 0; text-align: center; color: #0066cc;">Все коэффициенты применяются индивидуально для каждого дня и ПЕРЕМНОЖАЮТСЯ</p>
        </div>
        ${calcTableRows ? `
        <div style="margin: 3px 0;">
          <table style="width: 100%; border-collapse: collapse; border: 1pt solid #000; margin: 2px 0;">
            <thead>
              <tr style="background: #f0f0f0;">
                <th style="padding: 4px 3px; text-align: center; vertical-align: middle; border: 0.5pt solid #000; font-size: ${REPORT_STYLES.tableFontSize}pt; line-height: 1.3;">Дата</th>
                <th style="padding: 4px 3px; text-align: center; vertical-align: middle; border: 0.5pt solid #000; font-size: ${REPORT_STYLES.tableFontSize}pt; line-height: 1.3;">T°C</th>
                <th style="padding: 4px 3px; text-align: center; vertical-align: middle; border: 0.5pt solid #000; font-size: ${REPORT_STYLES.tableFontSize}pt; line-height: 1.3;">Режим</th>
                <th style="padding: 4px 3px; text-align: center; vertical-align: middle; border: 0.5pt solid #000; font-size: ${REPORT_STYLES.tableFontSize}pt; line-height: 1.3;">K<sub style="font-size: ${REPORT_STYLES.tableFontSize - 2}pt;">возр</sub></th>
                <th style="padding: 4px 3px; text-align: center; vertical-align: middle; border: 0.5pt solid #000; font-size: ${REPORT_STYLES.tableFontSize}pt; line-height: 1.3;">Местн.</th>
                <th style="padding: 4px 3px; text-align: center; vertical-align: middle; border: 0.5pt solid #000; font-size: ${REPORT_STYLES.tableFontSize}pt; line-height: 1.3;">Дор.</th>
                <th style="padding: 4px 3px; text-align: center; vertical-align: middle; border: 0.5pt solid #000; font-size: ${REPORT_STYLES.tableFontSize}pt; line-height: 1.3;">Расчет</th>
                <th style="padding: 4px 3px; text-align: center; vertical-align: middle; border: 0.5pt solid #000; font-size: ${REPORT_STYLES.tableFontSize}pt; line-height: 1.3;">л</th>
              </tr>
            </thead>
            <tbody>
              ${calcTableRows}
              <tr style="background: #f0f0f0; font-weight: bold;">
                <td colspan="6" style="padding: 4px 3px; text-align: right; vertical-align: middle; border: 0.5pt solid #000; font-size: ${REPORT_STYLES.tableFontSize}pt;">ИТОГО:</td>
                <td style="padding: 4px 3px; vertical-align: middle; border: 0.5pt solid #000;"></td>
                <td style="padding: 4px 3px; text-align: center; vertical-align: middle; border: 0.5pt solid #000; font-size: ${REPORT_STYLES.tableFontSize}pt;">${totalFuel.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>` : ''}
      </div>`;
  }

  const element = document.createElement('div');
  element.innerHTML = pagesMainHTML + justificationHTML;

  const marginTopMm = REPORT_STYLES.marginTop * 25.4;
  const marginBottomMm = REPORT_STYLES.marginBottom * 25.4;
  const marginLeftMm = REPORT_STYLES.marginLeft * 25.4;
  const marginRightMm = REPORT_STYLES.marginRight * 25.4;

  const opt = {
    // html2pdf ожидает порядок [top, right, bottom, left] в ДЮЙМАХ
    margin: [
      REPORT_STYLES.marginTop,
      REPORT_STYLES.marginRight,
      REPORT_STYLES.marginBottom,
      REPORT_STYLES.marginLeft
    ],
    filename: `Отчёт_${finalEmployeeName}_${monthName}_${yearValue}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: REPORT_STYLES.pdfScale, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape', putOnlyUsedFonts: true, compress: true },
    pagebreak: { mode: 'css' as any }
  };

  await html2pdf().set(opt).from(element).save();
  toast.success("Отчёт экспортирован в PDF");
};