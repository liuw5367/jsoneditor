export const DEFAULT_SMART_FORMAT_LINE_LENGTH = 120;
export const MIN_SMART_FORMAT_LINE_LENGTH = 40;
export const MAX_SMART_FORMAT_LINE_LENGTH = 500;

const SMART_FORMAT_LINE_LENGTH_KEY = 'clean-json-editor:smart-format-line-length';

export function parseSmartFormatLineLength(value) {
  const lineLength = Number(value);

  if (!Number.isInteger(lineLength)) {
    throw new Error('最大行宽必须是整数');
  }

  if (lineLength < MIN_SMART_FORMAT_LINE_LENGTH || lineLength > MAX_SMART_FORMAT_LINE_LENGTH) {
    throw new Error(`最大行宽必须在 ${MIN_SMART_FORMAT_LINE_LENGTH} 到 ${MAX_SMART_FORMAT_LINE_LENGTH} 之间`);
  }

  return lineLength;
}

export function loadSmartFormatLineLength(storage = globalThis.localStorage) {
  try {
    const storedValue = storage.getItem(SMART_FORMAT_LINE_LENGTH_KEY);

    return storedValue === null
      ? DEFAULT_SMART_FORMAT_LINE_LENGTH
      : parseSmartFormatLineLength(storedValue);
  } catch {
    return DEFAULT_SMART_FORMAT_LINE_LENGTH;
  }
}

export function saveSmartFormatLineLength(storage = globalThis.localStorage, value) {
  const lineLength = parseSmartFormatLineLength(value);

  try {
    storage.setItem(SMART_FORMAT_LINE_LENGTH_KEY, String(lineLength));
  } catch {
    // The setting still applies for this session when browser storage is unavailable.
  }

  return lineLength;
}

export async function formatJsonSmart(text, { indentation = 2, maxLineLength = DEFAULT_SMART_FORMAT_LINE_LENGTH } = {}) {
  const {
    Formatter,
    FracturedJsonOptions,
    NumberListAlignment,
    TableCommaPlacement
  } = await import('fracturedjsonjs');
  const options = new FracturedJsonOptions();

  options.MaxTotalLineLength = parseSmartFormatLineLength(maxLineLength);
  options.CommaPadding = true;
  options.MaxCompactArrayComplexity = 1;
  options.UseTabToIndent = indentation === '\t';
  options.IndentSpaces = typeof indentation === 'number' ? indentation : indentation.length;
  options.MaxInlineComplexity = 2;
  options.NumberListAlignment = NumberListAlignment.Decimal;
  options.TableCommaPlacement = TableCommaPlacement.BeforePadding;

  const formatter = new Formatter();
  formatter.Options = options;

  return formatter.Reformat(text);
}
