/**
 * Row fixtures in exactly the shape Stein returns: everything is a string, because a
 * Google Sheets cell comes back as text even when it holds a number. Tests that use
 * numeric literals here would pass while the real app broke on `"1" === 1`.
 */

/** Three students, four sessions, one blank trailing column and one blank row. */
export const rows = [
  { 'S. No': 'ID', period: '', 1: 'RS200301', 2: 'RS200302', 3: 'RS200303', 4: '' },
  { 'S. No': 'NAME', period: '', 1: 'Anitha Adari', 2: 'Bhargav Rao', 3: 'Chaitra Devi', 4: '' },
  { 'S. No': '2023-03-06', period: 'period-1', 1: '1', 2: '0', 3: '1', 4: '' },
  { 'S. No': '2023-03-06', period: 'period-4', 1: '1', 2: '1', 3: '1', 4: '' },
  { 'S. No': '2023-03-07', period: 'period-1', 1: '0', 2: '1', 3: '1', 4: '' },
  // Chaitra joined late: a blank cell must not count as an absence.
  { 'S. No': '2023-03-08', period: 'period-2', 1: '1', 2: '1', 3: '', 4: '' },
  // Sheets routinely come back with fully blank trailing rows.
  { 'S. No': '', period: '', 1: '', 2: '', 3: '', 4: '' },
];

/** A workbook with no "period" column, which is how the earliest sheets were laid out. */
export const rowsWithoutPeriod = [
  { 'S. No': 'ID', 1: 'RS200301', 2: 'RS200302' },
  { 'S. No': 'NAME', 1: 'Anitha Adari', 2: 'Bhargav Rao' },
  { 'S. No': '2023-03-06', 1: '1', 2: '0' },
];

export const emptyRoster = [
  { 'S. No': 'ID', period: '' },
  { 'S. No': 'NAME', period: '' },
];
