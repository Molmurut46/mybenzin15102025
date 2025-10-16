"use client";

import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";
import { REPORT_STYLES } from "@/lib/report-styles";
import { useEffect, useRef, useState } from "react";

interface ReportPreviewProps {
  report: any;
  userName: string;
  onClose?: () => void;
}

const MONTH_NAMES = [
"Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
"Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];

export function ReportPreview({ report, userName, onClose }: ReportPreviewProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const sourceRef = useRef<HTMLDivElement>(null)
  const [pdfLoaded, setPdfLoaded] = useState(false)
  const isPrintingRef = useRef(false)

  const handlePrint = () => {
    if (!pdfUrl || isPrintingRef.current) return

    const tryPrint = () => {
      const win = iframeRef.current?.contentWindow
      if (win) {
        isPrintingRef.current = true
        // Увеличенная задержка для стабильности печати во встроенном PDF-вьювере (Яндекс/Chrome)
        setTimeout(() => {
          try {
            win.focus()
            win.print()
          } finally {
            // Сбрасываем флаг чуть позже, чтобы избежать двойного окна печати
            setTimeout(() => { isPrintingRef.current = false }, 1400)
          }
        }, 900)
      }
    }

    if (pdfLoaded) {
      tryPrint()
    } else {
      const onLoadOnce = () => {
        setPdfLoaded(true)
        tryPrint()
        iframeRef.current?.removeEventListener("load", onLoadOnce)
      }
      iframeRef.current?.addEventListener("load", onLoadOnce)
    }
  };

  const reportData = report.reportData;
  const entries = reportData.entries || [];
  const fuelPrice = reportData.fuelPrice || 55;
  const isMintrans = reportData?.calculationMethod === "mintrans";

  // Автомасштабирование как в PDF экспорте: пытаемся вписать простой отчёт на 1 страницу
  const calculatePDFScale = (rowCount: number): { scale: number; shouldFitOnePage: boolean } => {
    if (isMintrans) return { scale: 1.0, shouldFitOnePage: false }; // расширенный на 2 страницы
    const maxRowsOnePage = REPORT_STYLES.pdfMaxRowsOnePage;
    const minScale = REPORT_STYLES.pdfAutoScaleThreshold; // 0.75

    if (rowCount <= 20) return { scale: 1.0, shouldFitOnePage: true };
    if (rowCount <= maxRowsOnePage) {
      const scaleRange = 1.0 - minScale; // 0.25
      const rowRange = maxRowsOnePage - 20; // 5
      const rowsOverBase = rowCount - 20;
      const calculatedScale = 1.0 - (scaleRange * rowsOverBase / rowRange);
      return { scale: Math.max(calculatedScale, minScale), shouldFitOnePage: calculatedScale >= minScale };
    }
    return { scale: 1.0, shouldFitOnePage: false };
  };

  const { scale, shouldFitOnePage } = calculatePDFScale(entries.length);

  const selectedFuelType = reportData.selectedFuelType || reportData.profile?.fuelType || "АИ-92";
  const fixedConsumptionRate = selectedFuelType.includes("95") ?
  reportData.profile?.fuelConsumption95 || 0 :
  reportData.profile?.fuelConsumption92 || 0;

  const totalMileage = entries.reduce((sum: number, e: any) => sum + e.mileage, 0);
  const totalFuel = entries.reduce((sum: number, e: any) => sum + e.fuelUsed, 0);
  const totalCost = totalFuel * parseFloat(fuelPrice as any);

  const formatUserName = (fullName: string): string => {
    const parts = fullName.trim().split(' ');
    if (parts.length >= 2) {
      const lastName = parts[0];
      const firstInitial = parts[1].charAt(0) + '.';
      const middleInitial = parts.length >= 3 ? parts[2].charAt(0) + '.' : '';
      return `${lastName} ${firstInitial}${middleInitial}`;
    }
    return fullName;
  };

  const formattedName = formatUserName(userName);
  const monthValue = report.month || reportData.month;
  const yearValue = report.year || reportData.year;
  const monthIndex = monthValue - 1;
  const monthName = MONTH_NAMES[monthIndex];

  const currentDate = new Date();
  const currentDay = currentDate.getDate();

  let compilationMonth = monthValue;
  let compilationYear = yearValue;

  if (compilationMonth === 12) {
    compilationMonth = 1;
    compilationYear = yearValue + 1;
  } else {
    compilationMonth = monthValue + 1;
  }

  const compilationDate = `${currentDay.toString().padStart(2, '0')}.${compilationMonth.toString().padStart(2, '0')}.${compilationYear}`;
  const finalReportDate = reportData.reportDate || compilationDate;
  const finalEmployeeName = reportData.employeeName || formattedName;

  let vehicleInfo = `${reportData.profile?.carBrand || ""} ${reportData.profile?.carModel || ""}`;
  if (reportData.profile?.licensePlate) {
    vehicleInfo += `, гос.номер ${reportData.profile.licensePlate}`;
  }

  const mintransCoeffs = reportData.mintransCoefficients;
  const dailyBreakdown = reportData.dailyBreakdown || [];

  // Генерация готового PDF и показ в iframe
  useEffect(() => {
    let revokedUrl: string | null = null

    const generate = async () => {
      if (!sourceRef.current) return
      setIsGenerating(true)
      try {
        const html2pdf = (await import("html2pdf.js")).default

        const marginTopMm = REPORT_STYLES.marginTop * 25.4
        const marginBottomMm = REPORT_STYLES.marginBottom * 25.4
        const marginLeftMm = REPORT_STYLES.marginLeft * 25.4
        const marginRightMm = REPORT_STYLES.marginRight * 25.4

        const opt = {
          margin: [marginTopMm, marginLeftMm, marginBottomMm, marginRightMm],
          filename: `Отчёт_${finalEmployeeName}_${monthName}_${yearValue}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: REPORT_STYLES.pdfScale, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape', putOnlyUsedFonts: true, compress: true },
          pagebreak: { mode: shouldFitOnePage ? 'avoid-all' as any : (REPORT_STYLES.pdfPageBreakMode as any) }
        }

        // Генерируем PDF БЕЗ сохранения: получаем data URL и показываем (надёжнее для некоторых браузеров)
        const worker = html2pdf().set(opt).from(sourceRef.current)
        await worker.toPdf()
        const pdf = await worker.get('pdf')
        const dataUrl: string = pdf.output('datauristring')
        setPdfLoaded(false)
        setPdfUrl(dataUrl)
        // removed blob revoke logic — data URL не требует освобождения
      } catch (e) {
        // Если не удалось — откатываемся на показ HTML как раньше
        setPdfUrl(null)
      } finally {
        setIsGenerating(false)
      }
    }

    // Сбрасываем старый URL и генерируем заново при смене отчёта
    if (pdfUrl) {
      // если ранее был blob: URL, его уже не создаём; очистка не требуется для data URL
      setPdfUrl(null)
    }
    setPdfLoaded(false)
    generate()

    return () => {
      // cleanup not required for data URL
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report?.id])

  return (
    <div className="relative">
      {/* Toolbar */}
      <div className="print-hide sticky top-0 z-10 bg-background border-b p-4 flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Предпросмотр отчёта</h2>
        <div className="flex gap-2">
          <Button onClick={handlePrint} className="gap-2" disabled={!pdfUrl || isGenerating}>
            <Printer className="w-4 h-4" />
            Печать
          </Button>
          {onClose &&
          <Button onClick={onClose} variant="outline" size="icon">
              <X className="w-4 h-4" />
            </Button>
          }
        </div>
      </div>

      {/* PDF iframe (основной вид предпросмотра и печати) */}
      {pdfUrl ? (
        <div className="print-content w-full" style={{ height: "80vh" }}>
          <iframe
            key={pdfUrl || 'pdf-frame'}
            ref={iframeRef}
            src={pdfUrl}
            className="w-full h-full bg-white"
            title="Report PDF Preview"
            loading="eager"
            referrerPolicy="no-referrer"
            style={{ border: 'none' }}
            onLoad={() => setPdfLoaded(true)}
          />
        </div>
      ) : (
        // Фолбэк: временно показываем HTML, пока генерируется PDF
        <div
          className="print-content w-full bg-white"
          style={{
            fontFamily: REPORT_STYLES.fontFamily,
            lineHeight: REPORT_STYLES.lineHeight
          }}>

          {/* Page 1: Main Report */}
          <div className="report-page">
            {/* Автомасштабирование контейнера страницы для предпросмотра/печати */}
            <div style={shouldFitOnePage ? {
              transform: `scale(${scale})`,
              transformOrigin: 'top center',
              width: `${100 / scale}%`
            } : undefined}>
              <div style={{ textAlign: 'center', marginBottom: shouldFitOnePage ? '12px' : '20px' }}>
                <h1 style={{ 
                  fontSize: `${REPORT_STYLES.headerFontSize}px`, 
                  fontWeight: 'bold', 
                  margin: '0 0 8px 0' 
                }}>
                  ОТЧЕТ
                </h1>
                <p style={{ 
                  fontSize: `${REPORT_STYLES.textFontSize}px`, 
                  fontWeight: 'normal', 
                  margin: '4px 0' 
                }}>
                  об использовании личного автомобиля в служебных целях
                </p>
                <p style={{ 
                  fontSize: `${REPORT_STYLES.textFontSize}px`, 
                  fontWeight: 'normal', 
                  margin: '4px 0' 
                }}>
                  за {monthName} {yearValue} года
                </p>
                <p style={{ 
                  fontSize: `${REPORT_STYLES.vehicleInfoFontSize}px`, 
                  margin: `${REPORT_STYLES.vehicleInfoMarginTop} 0 0 0` 
                }}>
                  {vehicleInfo}
                </p>
              </div>

              <div style={{ border: `${REPORT_STYLES.borderWidth} solid ${REPORT_STYLES.borderColor}` }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: `${REPORT_STYLES.tableFontSize}px`,
                  margin: 0
                }}>
                  <thead>
                    <tr>
                      <th style={{
                        padding: REPORT_STYLES.headerCellPadding,
                        textAlign: 'center',
                        border: `${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}`,
                        fontWeight: 'bold',
                        background: REPORT_STYLES.backgroundColor,
                        width: `${REPORT_STYLES.columnPercents[0]}%`
                      }}>Дата</th>
                      <th style={{
                        padding: REPORT_STYLES.headerCellPadding,
                        textAlign: 'center',
                        border: `${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}`,
                        fontWeight: 'bold',
                        background: REPORT_STYLES.backgroundColor,
                        width: `${REPORT_STYLES.columnPercents[1]}%`
                      }}>Маршрут</th>
                      <th style={{
                        padding: REPORT_STYLES.headerCellPadding,
                        textAlign: 'center',
                        border: `${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}`,
                        fontWeight: 'bold',
                        background: REPORT_STYLES.backgroundColor,
                        width: `${REPORT_STYLES.columnPercents[2]}%`
                      }}>Пробег,<br />км</th>
                      <th style={{
                        padding: REPORT_STYLES.headerCellPadding,
                        textAlign: 'center',
                        border: `${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}`,
                        fontWeight: 'bold',
                        background: REPORT_STYLES.backgroundColor,
                        width: `${REPORT_STYLES.columnPercents[3]}%`
                      }}>Норма,<br />л/100км</th>
                      <th style={{
                        padding: REPORT_STYLES.headerCellPadding,
                        textAlign: 'center',
                        border: `${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}`,
                        fontWeight: 'bold',
                        background: REPORT_STYLES.backgroundColor,
                        width: `${REPORT_STYLES.columnPercents[4]}%`
                      }}>Расход,<br />л</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry: any, idx: number) => {
                      const individualRate = isMintrans ?
                      entry.mileage > 0 ? entry.fuelUsed / entry.mileage * 100 : 0 :
                      fixedConsumptionRate;
                      return (
                        <tr key={idx}>
                          <td style={{
                            padding: REPORT_STYLES.cellPadding,
                            textAlign: 'center',
                            verticalAlign: 'middle',
                            border: `${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}`
                          }}>{entry.date}</td>
                          <td style={{
                            padding: REPORT_STYLES.cellPadding,
                            textAlign: 'left',
                            verticalAlign: 'middle',
                            border: `${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}`
                          }}>{entry.clients}</td>
                          <td style={{
                            padding: REPORT_STYLES.cellPadding,
                            textAlign: 'center',
                            verticalAlign: 'middle',
                            border: `${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}`
                          }}>{entry.mileage.toFixed(1)}</td>
                          <td style={{
                            padding: REPORT_STYLES.cellPadding,
                            textAlign: 'center',
                            verticalAlign: 'middle',
                            border: `${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}`
                          }}>{individualRate.toFixed(2)}</td>
                          <td style={{
                            padding: REPORT_STYLES.cellPadding,
                            textAlign: 'center',
                            verticalAlign: 'middle',
                            border: `${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}`
                          }}>{entry.fuelUsed.toFixed(1)}</td>
                        </tr>);

                    })}
                    <tr style={{ fontWeight: 'bold', background: REPORT_STYLES.backgroundColor }}>
                      <td colSpan={2} style={{
                        padding: REPORT_STYLES.headerCellPadding,
                        textAlign: 'right',
                        border: `${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}`
                      }}>ИТОГО:</td>
                      <td style={{
                        padding: REPORT_STYLES.headerCellPadding,
                        textAlign: 'center',
                        border: `${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}`
                      }}>{totalMileage.toFixed(1)}</td>
                      <td style={{
                        padding: REPORT_STYLES.headerCellPadding,
                        border: `${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}`
                      }}></td>
                      <td style={{
                        padding: REPORT_STYLES.headerCellPadding,
                        textAlign: 'center',
                        border: `${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}`
                      }}>{totalFuel.toFixed(1)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div style={{
                margin: shouldFitOnePage ? '8px 0' : REPORT_STYLES.summaryMargin,
                fontSize: `${REPORT_STYLES.summaryFontSize}px`,
                textAlign: 'right',
                pageBreakInside: 'avoid'
              }}>
                <p style={{ margin: REPORT_STYLES.summaryItemMargin }}>
                  <strong>Стоимость бензина:</strong> {parseFloat(fuelPrice as any).toFixed(2)} ₽/л
                </p>
                <p style={{ 
                  margin: REPORT_STYLES.summaryItemMargin, 
                  fontSize: `${REPORT_STYLES.summaryFontSize + 1}px` 
                }}>
                  <strong>ВСЕГО:</strong> {totalCost.toFixed(2)} ₽
                </p>
              </div>

              <div style={{
                marginTop: shouldFitOnePage ? 8 : REPORT_STYLES.signatureMarginTop,
                paddingBottom: shouldFitOnePage ? 8 : REPORT_STYLES.signaturePaddingBottom,
                fontSize: `${REPORT_STYLES.signatureFontSize}px`,
                display: 'flex',
                justifyContent: 'space-between',
                pageBreakInside: 'avoid'
              }}>
                <div>Дата отчёта: {finalReportDate}</div>
                <div>Составитель _____________ {finalEmployeeName}</div>
              </div>
            </div>
          </div>

          {/* Page 2: Mintrans Breakdown (if applicable) */}
          {isMintrans && mintransCoeffs && dailyBreakdown.length > 0 &&
          <div className="report-page print-page-break" style={{ marginTop: '40px' }}>
              <h2 style={{
                fontSize: `${REPORT_STYLES.justificationTitleFontSize}pt`,
                fontWeight: 'bold',
                textAlign: 'center',
                margin: '0 0 4px 0',
                borderBottom: '2pt solid #000',
                paddingBottom: '3px'
              }}>
                ОБОСНОВАНИЕ РАСЧЕТА
              </h2>
              <p style={{
                fontSize: `${REPORT_STYLES.justificationSubtitleFontSize}pt`,
                textAlign: 'center',
                margin: '2px 0 6px 0',
                fontStyle: 'italic'
              }}>
                Распоряжение Минтранса России от 14.03.2008 N АМ-23-р (ред. от 30.09.2021)
              </p>

              <div style={{
                border: '1pt solid #000',
                padding: '4px',
                margin: '4px 0',
                background: '#f5f5f5'
              }}>
                <p style={{
                  fontSize: `${REPORT_STYLES.justificationLabelFontSize}pt`,
                  fontWeight: 'bold',
                  margin: '0 0 2px 0'
                }}>ФОРМУЛА:</p>
                <div style={{
                  padding: '3px',
                  fontFamily: 'Courier New, monospace',
                  fontSize: `${REPORT_STYLES.justificationFormulaFontSize}pt`,
                  textAlign: 'center',
                  fontWeight: 'bold',
                  lineHeight: 1.5
                }}>
                  Q = 0.01 × H<sub style={{ fontSize: `${REPORT_STYLES.justificationSubtitleFontSize}pt` }}>base</sub> × K<sub style={{ fontSize: `${REPORT_STYLES.justificationSubtitleFontSize}pt` }}>режим</sub> × K<sub style={{ fontSize: `${REPORT_STYLES.justificationSubtitleFontSize}pt` }}>темп</sub> × K<sub style={{ fontSize: `${REPORT_STYLES.justificationSubtitleFontSize}pt` }}>местн</sub> × K<sub style={{ fontSize: `${REPORT_STYLES.justificationSubtitleFontSize}pt` }}>дороги</sub> × S
                </div>
                <p style={{
                  fontSize: `${REPORT_STYLES.justificationSubtitleFontSize}pt`,
                  margin: '2px 0 0 0',
                  textAlign: 'center',
                  color: '#0066cc'
                }}>
                  Все коэффициенты применяются индивидуально для каждого дня и ПЕРЕМНОЖАЮТСЯ
                </p>
              </div>

              <div style={{ display: 'flex', gap: '4px', margin: '4px 0' }}>
                <div style={{ flex: 1, border: '1pt solid #000', padding: '4px' }}>
                  <p style={{ 
                    fontSize: `${REPORT_STYLES.justificationLabelFontSize}pt`, 
                    fontWeight: 'bold', 
                    margin: '0 0 2px 0' 
                  }}>БАЗОВЫЕ:</p>
                  <div style={{ 
                    fontSize: `${REPORT_STYLES.justificationTextFontSize}pt`, 
                    lineHeight: 1.4 
                  }}>
                    <p style={{ margin: '1px 0', lineHeight: 1.4 }}>
                      <strong>H<sub style={{ fontSize: '6pt' }}>base</sub>:</strong> {mintransCoeffs.baseConsumption} л/100км
                    </p>
                  </div>
                </div>
                
                <div style={{ flex: 2, border: '1pt solid #000', padding: '4px' }}>
                  <p style={{ 
                    fontSize: `${REPORT_STYLES.justificationLabelFontSize}pt`, 
                    fontWeight: 'bold', 
                    margin: '0 0 2px 0' 
                  }}>ИНДИВИДУАЛЬНЫЕ КОЭФФИЦИЕНТЫ ДНЯ:</p>
                  <div style={{ 
                    fontSize: `${REPORT_STYLES.justificationTextFontSize}pt`, 
                    lineHeight: 1.4 
                  }}>
                    <p style={{ margin: '1px 0', lineHeight: 1.4 }}>
                      <strong>K<sub style={{ fontSize: '6pt' }}>возр</sub>:</strong> 1.0 (&lt;5л) • 1.05 (≥5л)
                    </p>
                    <p style={{ margin: '1px 0', lineHeight: 1.4 }}>
                      <strong>K<sub style={{ fontSize: '6pt' }}>реж</sub>:</strong> город 1.15 • трасса 1.0 • смеш. 1.075
                    </p>
                    <p style={{ margin: '1px 0', lineHeight: 1.4 }}>
                      <strong>K<sub style={{ fontSize: '6pt' }}>темп</sub>:</strong> 1.03-1.18 (+ прогрев 5% при t&lt;0°C)
                    </p>
                    <p style={{ margin: '1px 0', lineHeight: 1.4 }}>
                      <strong>K<sub style={{ fontSize: '6pt' }}>мест</sub>:</strong> равн. 1.0 • холмы 1.05 • горы 1.10
                    </p>
                    <p style={{ margin: '1px 0', lineHeight: 1.4 }}>
                      <strong>K<sub style={{ fontSize: '6pt' }}>дор</sub>:</strong> хор. 1.0 • удовл. 1.05 • плох. 1.10
                    </p>
                  </div>
                </div>
              </div>

              <div style={{ margin: '4px 0' }}>
                <table style={{ 
                  width: '100%', 
                  borderCollapse: 'collapse', 
                  border: '1pt solid #000', 
                  margin: '2px 0' 
                }}>
                  <thead>
                    <tr style={{ background: '#f0f0f0' }}>
                      <th style={{ 
                        padding: REPORT_STYLES.headerCellPadding, 
                        textAlign: 'center', 
                        verticalAlign: 'middle', 
                        border: '0.5pt solid #000', 
                        fontSize: `${REPORT_STYLES.tableFontSize}pt`, 
                        lineHeight: 1.3 
                      }}>Дата</th>
                      <th style={{ 
                        padding: REPORT_STYLES.headerCellPadding, 
                        textAlign: 'center', 
                        verticalAlign: 'middle', 
                        border: '0.5pt solid #000', 
                        fontSize: `${REPORT_STYLES.tableFontSize}pt`, 
                        lineHeight: 1.3 
                      }}>T°C</th>
                      <th style={{ 
                        padding: REPORT_STYLES.headerCellPadding, 
                        textAlign: 'center', 
                        verticalAlign: 'middle', 
                        border: '0.5pt solid #000', 
                        fontSize: `${REPORT_STYLES.tableFontSize}pt`, 
                        lineHeight: 1.3 
                      }}>Режим</th>
                      <th style={{ 
                        padding: REPORT_STYLES.headerCellPadding, 
                        textAlign: 'center', 
                        verticalAlign: 'middle', 
                        border: '0.5pt solid #000', 
                        fontSize: `${REPORT_STYLES.tableFontSize}pt`, 
                        lineHeight: 1.3 
                      }}>K<sub style={{ fontSize: `${REPORT_STYLES.tableFontSize - 2}pt` }}>возр</sub></th>
                      <th style={{ 
                        padding: REPORT_STYLES.headerCellPadding, 
                        textAlign: 'center', 
                        verticalAlign: 'middle', 
                        border: '0.5pt solid #000', 
                        fontSize: `${REPORT_STYLES.tableFontSize}pt`, 
                        lineHeight: 1.3 
                      }}>Местн.</th>
                      <th style={{ 
                        padding: REPORT_STYLES.headerCellPadding, 
                        textAlign: 'center', 
                        verticalAlign: 'middle', 
                        border: '0.5pt solid #000', 
                        fontSize: `${REPORT_STYLES.tableFontSize}pt`, 
                        lineHeight: 1.3 
                      }}>Дор.</th>
                      <th style={{ 
                        padding: REPORT_STYLES.headerCellPadding, 
                        textAlign: 'center', 
                        verticalAlign: 'middle', 
                        border: '0.5pt solid #000', 
                        fontSize: `${REPORT_STYLES.tableFontSize}pt`, 
                        lineHeight: 1.3 
                      }}>Расчет</th>
                      <th style={{ 
                        padding: REPORT_STYLES.headerCellPadding, 
                        textAlign: 'center', 
                        verticalAlign: 'middle', 
                        border: '0.5pt solid #000', 
                        fontSize: `${REPORT_STYLES.tableFontSize}pt`, 
                        lineHeight: 1.3 
                      }}>л</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyBreakdown.map((day: any, idx: number) => {
                      const ageCoeff = day.coefficients?.vehicleAge || 1.0;
                      const modeCoeff = day.coefficients?.drivingMode || 1.15;
                      const tempCoeff = day.coefficients?.temperature || 1.0;
                      const terrainCoeff = day.coefficients?.terrain || 1.0;
                      const roadCoeff = day.coefficients?.roadCondition || 1.0;

                      const modeLabel = day.drivingMode === "city" ? "Город" : day.drivingMode === "highway" ? "Трасса" : "Смеш.";
                      const terrainLabel = day.terrainType === "plain" ? "Равн." : day.terrainType === "hilly" ? "Холм." : "Горы";
                      const roadLabel = day.roadQuality === "good" ? "Хор." : day.roadQuality === "fair" ? "Уд." : "Плох.";

                      const formula = `${mintransCoeffs.baseConsumption}×${ageCoeff}×${modeCoeff}×${(tempCoeff as number).toFixed(2)}×${terrainCoeff}×${roadCoeff}×${day.mileage || 0}`;

                      return (
                        <tr key={idx}>
                          <td style={{ 
                            padding: REPORT_STYLES.cellPadding, 
                            textAlign: 'center', 
                            verticalAlign: 'middle', 
                            border: '0.5pt solid #000', 
                            fontSize: `${REPORT_STYLES.tableFontSize}pt` 
                          }}>{day.date}</td>
                          <td style={{ 
                            padding: REPORT_STYLES.cellPadding, 
                            textAlign: 'center', 
                            verticalAlign: 'middle', 
                            border: '0.5pt solid #000', 
                            fontSize: `${REPORT_STYLES.tableFontSize}pt` 
                          }}>{day.temperature > 0 ? '+' : ''}{day.temperature}</td>
                          <td style={{ 
                            padding: REPORT_STYLES.cellPadding, 
                            textAlign: 'center', 
                            verticalAlign: 'middle', 
                            border: '0.5pt solid #000', 
                            fontSize: `${REPORT_STYLES.tableFontSize}pt` 
                          }}>{modeLabel}</td>
                          <td style={{ 
                            padding: REPORT_STYLES.cellPadding, 
                            textAlign: 'center', 
                            verticalAlign: 'middle', 
                            border: '0.5pt solid #000', 
                            fontSize: `${REPORT_STYLES.tableFontSize}pt` 
                          }}>{ageCoeff}</td>
                          <td style={{ 
                            padding: REPORT_STYLES.cellPadding, 
                            textAlign: 'center', 
                            verticalAlign: 'middle', 
                            border: '0.5pt solid #000', 
                            fontSize: `${REPORT_STYLES.tableFontSize}pt` 
                          }}>{terrainLabel}</td>
                          <td style={{ 
                            padding: REPORT_STYLES.cellPadding, 
                            textAlign: 'center', 
                            verticalAlign: 'middle', 
                            border: '0.5pt solid #000', 
                            fontSize: `${REPORT_STYLES.tableFontSize}pt` 
                          }}>{roadLabel}</td>
                          <td style={{ 
                            padding: REPORT_STYLES.cellPadding, 
                            textAlign: 'left', 
                            verticalAlign: 'middle', 
                            border: '0.5pt solid #000', 
                            fontSize: `${REPORT_STYLES.tableFontSize - 1}pt`, 
                            fontFamily: 'Courier New, monospace', 
                            wordWrap: 'break-word' 
                          }}>0.01×{formula}</td>
                          <td style={{ 
                            padding: REPORT_STYLES.cellPadding, 
                            textAlign: 'center', 
                            verticalAlign: 'middle', 
                            border: '0.5pt solid #000', 
                            fontSize: `${REPORT_STYLES.tableFontSize}pt`, 
                            fontWeight: 'bold' 
                          }}>{(day.fuelUsed ?? 0).toFixed(2)}</td>
                        </tr>
                      );
                    })}
                    <tr style={{ background: '#f0f0f0', fontWeight: 'bold' }}>
                      <td colSpan={6} style={{ 
                        padding: REPORT_STYLES.headerCellPadding, 
                        textAlign: 'right', 
                        verticalAlign: 'middle', 
                        border: '0.5pt solid #000', 
                        fontSize: `${REPORT_STYLES.tableFontSize}pt` 
                      }}>ИТОГО:</td>
                      <td style={{ 
                        padding: REPORT_STYLES.headerCellPadding, 
                        verticalAlign: 'middle', 
                        border: '0.5pt solid #000' 
                      }}></td>
                      <td style={{ 
                        padding: REPORT_STYLES.headerCellPadding, 
                        textAlign: 'center', 
                        verticalAlign: 'middle', 
                        border: '0.5pt solid #000', 
                        fontSize: `${REPORT_STYLES.tableFontSize}pt` 
                      }}>{totalFuel.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          }
        </div>
      )}

      {/* Невидимый источник для генерации PDF (не печатается, не отображается) */}
      <div aria-hidden ref={sourceRef} style={{ position: 'absolute', left: '-10000px', top: 0 }}>
        {/* Клонируем тот же HTML отчёта, что и в фолбэке, чтобы html2pdf генерировал идентичный PDF */}
        <div style={{ fontFamily: REPORT_STYLES.fontFamily, lineHeight: REPORT_STYLES.lineHeight }}>
          {/* Page 1 */}
          <div>
            <div style={{ textAlign: 'center', marginBottom: shouldFitOnePage ? '10px' : '15px' }}>
              <h1 style={{ fontSize: REPORT_STYLES.headerFontSize, fontWeight: 'bold', margin: '0 0 6px 0' }}>ОТЧЕТ</h1>
              <p style={{ fontSize: REPORT_STYLES.textFontSize, margin: '3px 0' }}>об использовании личного автомобиля в служебных целях</p>
              <p style={{ fontSize: REPORT_STYLES.textFontSize, margin: '3px 0' }}>за {monthName} {yearValue} года</p>
              <p style={{ fontSize: REPORT_STYLES.vehicleInfoFontSize, margin: '8px 0 0 0' }}>{vehicleInfo}</p>
            </div>
            <div style={{ border: `${REPORT_STYLES.borderWidth} solid ${REPORT_STYLES.borderColor}` }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: REPORT_STYLES.tableFontSize, margin: 0 }}>
                <thead>
                  <tr>
                    <th style={{ padding: REPORT_STYLES.headerCellPadding, textAlign: 'center', border: `${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}`, background: REPORT_STYLES.backgroundColor, width: `${REPORT_STYLES.columnPercents[0]}%` }}>Дата</th>
                    <th style={{ padding: REPORT_STYLES.headerCellPadding, textAlign: 'center', border: `${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}`, background: REPORT_STYLES.backgroundColor, width: `${REPORT_STYLES.columnPercents[1]}%` }}>Маршрут</th>
                    <th style={{ padding: REPORT_STYLES.headerCellPadding, textAlign: 'center', border: `${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}`, background: REPORT_STYLES.backgroundColor, width: `${REPORT_STYLES.columnPercents[2]}%` }}>Пробег,<br/>км</th>
                    <th style={{ padding: REPORT_STYLES.headerCellPadding, textAlign: 'center', border: `${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}`, background: REPORT_STYLES.backgroundColor, width: `${REPORT_STYLES.columnPercents[3]}%` }}>Норма,<br/>л/100км</th>
                    <th style={{ padding: REPORT_STYLES.headerCellPadding, textAlign: 'center', border: `${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}`, background: REPORT_STYLES.backgroundColor, width: `${REPORT_STYLES.columnPercents[4]}%` }}>Расход,<br/>л</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry: any, idx: number) => {
                    const individualRate = isMintrans ?
                      entry.mileage > 0 ? entry.fuelUsed / entry.mileage * 100 : 0 :
                      fixedConsumptionRate;
                    return (
                      <tr key={idx}>
                        <td style={{ padding: REPORT_STYLES.cellPadding, textAlign: 'center', border: `${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}` }}>{entry.date}</td>
                        <td style={{ padding: REPORT_STYLES.cellPadding, textAlign: 'left', border: `${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}` }}>{entry.clients}</td>
                        <td style={{ padding: REPORT_STYLES.cellPadding, textAlign: 'center', border: `${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}` }}>{entry.mileage.toFixed(1)}</td>
                        <td style={{ padding: REPORT_STYLES.cellPadding, textAlign: 'center', border: `${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}` }}>{individualRate.toFixed(2)}</td>
                        <td style={{ padding: REPORT_STYLES.cellPadding, textAlign: 'center', border: `${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}` }}>{entry.fuelUsed.toFixed(1)}</td>
                      </tr>
                    )
                  })}
                  <tr style={{ fontWeight: 'bold', background: REPORT_STYLES.backgroundColor }}>
                    <td colSpan={2} style={{ padding: REPORT_STYLES.headerCellPadding, textAlign: 'right', border: `${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}` }}>ИТОГО:</td>
                    <td style={{ padding: REPORT_STYLES.headerCellPadding, textAlign: 'center', border: `${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}` }}>{totalMileage.toFixed(1)}</td>
                    <td style={{ padding: REPORT_STYLES.headerCellPadding, border: `${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}` }}></td>
                    <td style={{ padding: REPORT_STYLES.headerCellPadding, textAlign: 'center', border: `${REPORT_STYLES.innerBorderWidth} solid ${REPORT_STYLES.borderColor}` }}>{totalFuel.toFixed(1)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div style={{ margin: shouldFitOnePage ? '8px 0' : '12px 0', fontSize: REPORT_STYLES.summaryFontSize, textAlign: 'right' }}>
              <p style={{ margin: '4px 0' }}><strong>Стоимость бензина:</strong> {parseFloat(fuelPrice as any).toFixed(2)} ₽/л</p>
              <p style={{ margin: '4px 0', fontSize: REPORT_STYLES.summaryFontSize + 1 }}><strong>ВСЕГО:</strong> {totalCost.toFixed(2)} ₽</p>
            </div>
            <div style={{ marginTop: shouldFitOnePage ? 8 : 20, paddingBottom: shouldFitOnePage ? 8 : 15, fontSize: REPORT_STYLES.signatureFontSize, display: 'flex', justifyContent: 'space-between' }}>
              <div>Дата отчёта: {finalReportDate}</div>
              <div>Составитель _____________ {finalEmployeeName}</div>
            </div>
          </div>
          {/* Page 2 */}
          {isMintrans && mintransCoeffs && dailyBreakdown.length > 0 && (
            <div style={{ pageBreakBefore: 'always' as any }}>
              <h2 style={{ fontSize: REPORT_STYLES.justificationTitleFontSize, fontWeight: 'bold', textAlign: 'center', margin: '0 0 3px 0', borderBottom: '1.5pt solid #000', paddingBottom: 2 }}>ОБОСНОВАНИЕ РАСЧЕТА</h2>
              <p style={{ fontSize: REPORT_STYLES.justificationSubtitleFontSize, textAlign: 'center', margin: '1px 0 4px 0', fontStyle: 'italic' }}>Распоряжение Минтранса России от 14.03.2008 N АМ-23-р (ред. от 30.09.2021)</p>
              <div style={{ border: '1pt solid #000', padding: 3, margin: '3px 0', background: '#f5f5f5' }}>
                <p style={{ fontSize: REPORT_STYLES.justificationLabelFontSize, fontWeight: 'bold', margin: '0 0 1px 0' }}>ФОРМУЛА:</p>
                <div style={{ padding: 2, fontFamily: 'Courier New, monospace', fontSize: REPORT_STYLES.justificationFormulaFontSize, textAlign: 'center', fontWeight: 'bold', lineHeight: 1.4 }}>
                  Q = 0.01 × H<sub style={{ fontSize: REPORT_STYLES.justificationSubtitleFontSize }}>base</sub> × K<sub style={{ fontSize: REPORT_STYLES.justificationSubtitleFontSize }}>режим</sub> × K<sub style={{ fontSize: REPORT_STYLES.justificationSubtitleFontSize }}>темп</sub> × K<sub style={{ fontSize: REPORT_STYLES.justificationSubtitleFontSize }}>местн</sub> × K<sub style={{ fontSize: REPORT_STYLES.justificationSubtitleFontSize }}>дороги</sub> × S
                </div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1pt solid #000', margin: '2px 0' }}>
                <thead>
                  <tr style={{ background: '#f0f0f0' }}>
                    <th style={{ padding: 4, textAlign: 'center', border: '0.5pt solid #000' }}>Дата</th>
                    <th style={{ padding: 4, textAlign: 'center', border: '0.5pt solid #000' }}>T°C</th>
                    <th style={{ padding: 4, textAlign: 'center', border: '0.5pt solid #000' }}>Режим</th>
                    <th style={{ padding: 4, textAlign: 'center', border: '0.5pt solid #000' }}>Kвозр</th>
                    <th style={{ padding: 4, textAlign: 'center', border: '0.5pt solid #000' }}>Местн.</th>
                    <th style={{ padding: 4, textAlign: 'center', border: '0.5pt solid #000' }}>Дор.</th>
                    <th style={{ padding: 4, textAlign: 'center', border: '0.5pt solid #000' }}>Расчет</th>
                    <th style={{ padding: 4, textAlign: 'center', border: '0.5pt solid #000' }}>л</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyBreakdown.map((day: any, idx: number) => {
                    const ageCoeff = day.coefficients?.vehicleAge || 1.0;
                    const modeCoeff = day.coefficients?.drivingMode || 1.15;
                    const tempCoeff = day.coefficients?.temperature || 1.0;
                    const terrainCoeff = day.coefficients?.terrain || 1.0;
                    const roadCoeff = day.coefficients?.roadCondition || 1.0;
                    const formula = `${mintransCoeffs.baseConsumption}×${ageCoeff}×${modeCoeff}×${(tempCoeff as number).toFixed(2)}×${terrainCoeff}×${roadCoeff}×${day.mileage || 0}`;
                    return (
                      <tr key={idx}>
                        <td style={{ padding: 4, textAlign: 'center', border: '0.5pt solid #000' }}>{day.date}</td>
                        <td style={{ padding: 4, textAlign: 'center', border: '0.5pt solid #000' }}>{day.temperature > 0 ? '+' : ''}{day.temperature}</td>
                        <td style={{ padding: 4, textAlign: 'center', border: '0.5pt solid #000' }}>{day.drivingMode === "city" ? "Город" : day.drivingMode === "highway" ? "Трасса" : "Смеш."}</td>
                        <td style={{ padding: 4, textAlign: 'center', border: '0.5pt solid #000' }}>{ageCoeff}</td>
                        <td style={{ padding: 4, textAlign: 'center', border: '0.5pt solid #000' }}>{day.terrainType === "plain" ? "Равн." : day.terrainType === "hilly" ? "Холм." : "Горы"}</td>
                        <td style={{ padding: 4, textAlign: 'center', border: '0.5pt solid #000' }}>{day.roadQuality === "good" ? "Хор." : day.roadQuality === "fair" ? "Уд." : "Плох."}</td>
                        <td style={{ padding: 4, textAlign: 'left', border: '0.5pt solid #000', fontFamily: 'Courier New, monospace' }}>0.01×{formula}</td>
                        <td style={{ padding: 4, textAlign: 'center', border: '0.5pt solid #000', fontWeight: 'bold' }}>{(day.fuelUsed ?? 0).toFixed(2)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}