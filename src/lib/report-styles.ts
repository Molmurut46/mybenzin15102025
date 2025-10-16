/**
 * НАСТРОЙКИ ОФОРМЛЕНИЯ ОТЧЁТОВ
 * 
 * Этот файл содержит все настройки внешнего вида отчётов.
 * Изменения здесь автоматически применяются к:
 * - Предпросмотру отчёта
 * - Экспорту в PDF
 * - Экспорту в Excel
 */

export const REPORT_STYLES = {
  // === ШРИФТЫ ===
  headerFontSize: 16,           // Размер шрифта заголовка "ОТЧЕТ" (px/pt)
  textFontSize: 14,             // Размер шрифта подзаголовков (px/pt)
  tableFontSize: 11,            // Размер шрифта в таблице (px/pt)
  vehicleInfoFontSize: 12,      // Размер шрифта для информации об автомобиле (px/pt)
  summaryFontSize: 12,          // Размер шрифта для итоговых данных (px/pt)
  signatureFontSize: 11,        // Размер шрифта для подписи (px/pt)
  fontFamily: 'Times New Roman', // Шрифт всего документа
  
  // === ШРИФТЫ ДЛЯ ТАБЛИЦЫ ОБОСНОВАНИЯ (МИНТРАНС) ===
  justificationTitleFontSize: 12,   // Размер заголовка "ОБОСНОВАНИЕ РАСЧЕТА" (pt)
  justificationSubtitleFontSize: 7, // Размер подзаголовка с ссылкой на распоряжение (pt)
  justificationLabelFontSize: 8,    // Размер подписей "ФОРМУЛА:", "БАЗОВЫЕ:" и т.д. (pt)
  justificationFormulaFontSize: 9,  // Размер формулы (pt)
  justificationTextFontSize: 6,     // Размер основного текста (pt)
  
  // === РАМКИ И ГРАНИЦЫ ===
  borderWidth: '1pt',           // Толщина внешней рамки таблицы
  innerBorderWidth: '0.5pt',   // Толщина внутренних линий таблицы
  borderColor: '#000000',       // Цвет границ (чёрный)
  
  // === ОТСТУПЫ ===
  cellPadding: '6px',           // Отступы внутри ячеек таблицы
  headerCellPadding: '8px 6px', // Отступы в заголовках таблицы
  
  // === ОТСТУПЫ СЕКЦИЙ ===
  vehicleInfoMarginTop: '12px', // Отступ сверху для информации об автомобиле
  summaryMargin: '15px 0',      // Отступы для итоговой секции
  summaryItemMargin: '5px 0',   // Отступы между строками итогов
  signatureMarginTop: '30px',   // Отступ сверху для блока подписи
  signaturePaddingBottom: '20px', // Отступ снизу для блока подписи
  
  // === ЦВЕТА ===
  backgroundColor: '#f8f9fa',   // Фон заголовков и итогов
  textColor: '#000000',         // Цвет текста
  
  // === ОТСТУПЫ СТРАНИЦЫ (для PDF и печати) ===
  marginTop: 0.5,              // Верхний отступ (дюймы)
  marginBottom: 0.5,           // Нижний отступ (дюймы)
  marginLeft: 0.5,              // Левый отступ (дюймы)
  marginRight: 0.5,             // Правый отступ (дюймы)
  
  // === НАСТРОЙКИ PDF ===
  pdfScale: 2,                  // Качество рендеринга PDF (1-4, чем выше - тем лучше качество)
  pdfMinScale: 0.65,            // Минимальный масштаб контента (0.65 = 65%, не мельче)
  maxRowsPerPage: 20,           // Максимум строк на одной странице (при превышении - разбивка)
  pdfPageBreakMode: 'css',      // Режим разбивки страниц: 'avoid-all' | 'css' | 'legacy'
  
  // === АВТОМАСШТАБИРОВАНИЕ PDF (аналогично Excel) ===
  pdfFitToPage: true,           // Вписывать простой отчёт в одну страницу
  pdfFitToWidth: true,          // Вписывать по ширине
  pdfAutoScaleThreshold: 0.65,  // Порог автомасштабирования (65% - если меньше, то переносить на 2 страницы)
  pdfMaxRowsOnePage: 25,        // Максимум строк для попытки вместить на 1 страницу
  
  // === ДОПОЛНИТЕЛЬНАЯ НАСТРОЙКА ===
  showBorders: true,            // Показывать рамки таблицы
  
  // === ВЫСОТА СТРОК ===
  rowHeight: 25,                // Высота строк в Excel (пункты)
  lineHeight: 1.4,              // Межстрочный интервал
  
  // === ШИРИНА КОЛОНОК (для Excel) ===
  columnWidths: [10, 58, 6, 8, 6] as const, // Ширина колонок: Дата, Маршрут, Пробег, Норма, Расход

  // === ШИРИНА КОЛОНОК В ВЕБ/ПЕЧАТИ (в процентах) ===
  columnPercents: [10, 58, 10, 12, 10] as const,
  
  // === НАСТРОЙКИ ПЕЧАТИ EXCEL ===
  excelPageSetup: {
    orientation: 'landscape' as const, // Альбомная ориентация
    fitToWidth: 1,                     // Подгонять по ширине на 1 страницу
    fitToHeight: 0,                    // Не ограничивать по высоте (автоперенос на новые листы)
    paperSize: 9,                      // A4 = 9
    scale: 100,                        // Масштаб по умолчанию (если не используется fitTo)
  },
} as const;

/**
 * Получить CSS-стиль для элемента на основе настроек
 */
export const getReportElementStyle = (element: 'header' | 'text' | 'table') => {
  const styles = REPORT_STYLES;
  
  switch (element) {
    case 'header':
      return {
        fontSize: `${styles.headerFontSize}px`,
        fontFamily: styles.fontFamily,
        fontWeight: 'bold',
      };
    case 'text':
      return {
        fontSize: `${styles.textFontSize}px`,
        fontFamily: styles.fontFamily,
      };
    case 'table':
      return {
        fontSize: `${styles.tableFontSize}px`,
        fontFamily: styles.fontFamily,
        lineHeight: styles.lineHeight,
      };
  }
};

/**
 * Получить стили границ для таблицы
 */
export const getTableBorderStyle = (type: 'outer' | 'inner') => {
  const styles = REPORT_STYLES;
  
  if (type === 'outer') {
    return {
      border: `${styles.borderWidth} solid ${styles.borderColor}`,
    };
  }
  
  return {
    border: `${styles.innerBorderWidth} solid ${styles.borderColor}`,
  };
};