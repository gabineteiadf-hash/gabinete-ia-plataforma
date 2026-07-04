/**
 * Google Drive and Sheets API Services
 */

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
}

export interface SheetInfo {
  properties: {
    title: string;
    index: number;
  };
}

export interface SpreadsheetDetails {
  spreadsheetId: string;
  properties: {
    title: string;
  };
  sheets: SheetInfo[];
}

export interface SheetData {
  range: string;
  majorDimension: string;
  values: string[][];
}

// 1. List Google Sheets / Excel files from user's Drive
export async function listSpreadsheets(accessToken: string): Promise<DriveFile[]> {
  const query = encodeURIComponent("mimeType = 'application/vnd.google-apps.spreadsheet' or mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' and trashed = false");
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,mimeType,modifiedTime)&orderBy=modifiedTime+desc&pageSize=20`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || "Erro ao buscar arquivos no Google Drive");
  }

  const data = await response.json();
  return data.files || [];
}

// 2. Fetch Spreadsheet Details (to get sheets/tabs list)
export async function getSpreadsheetDetails(accessToken: string, spreadsheetId: string): Promise<SpreadsheetDetails> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || "Erro ao buscar detalhes da planilha");
  }

  return response.json();
}

// 3. Fetch Sheet Values (rows/columns content)
export async function getSheetValues(
  accessToken: string,
  spreadsheetId: string,
  sheetRange: string
): Promise<SheetData> {
  const rangeEncoded = encodeURIComponent(sheetRange);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${rangeEncoded}?majorDimension=ROWS`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || "Erro ao buscar valores da planilha");
  }

  return response.json();
}
