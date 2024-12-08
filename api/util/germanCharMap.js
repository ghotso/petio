/**
 * Converts between German special characters and their ASCII equivalents
 */
const germanCharMap = {
  // ASCII to Umlaut
  'ae': 'ä',
  'oe': 'ö',
  'ue': 'ü',
  'ss': 'ß',
  'Ae': 'Ä',
  'Oe': 'Ö',
  'Ue': 'Ü',
  // Umlaut to ASCII
  'ä': 'ae',
  'ö': 'oe',
  'ü': 'ue',
  'ß': 'ss',
  'Ä': 'Ae',
  'Ö': 'Oe',
  'Ü': 'Ue'
};

/**
 * Converts ASCII characters to German umlauts
 * @param {string} text - The text to convert
 * @returns {string} - The converted text
 */
function toUmlauts(text) {
  if (!text) return text;
  
  // Convert two-character combinations first
  let result = text.replace(/([AOUaou])e/g, (match, p1) => {
    const key = match;
    return germanCharMap[key] || match;
  });
  
  // Convert 'ss' to 'ß'
  result = result.replace(/ss/g, 'ß');
  
  return result;
}

/**
 * Converts German umlauts to ASCII characters
 * @param {string} text - The text to convert
 * @returns {string} - The converted text
 */
function toAscii(text) {
  if (!text) return text;
  
  return text.replace(/[äöüßÄÖÜ]/g, match => germanCharMap[match] || match);
}

/**
 * Gets all possible variants of a search term
 * @param {string} text - The search term
 * @returns {string[]} - Array of possible variants
 */
function getAllVariants(text) {
  if (!text) return [];
  
  const variants = new Set();
  
  // Add original text
  variants.add(text);
  
  // Add umlaut version
  variants.add(toUmlauts(text));
  
  // Add ASCII version
  variants.add(toAscii(text));
  
  // Remove duplicates and empty strings
  return [...variants].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
}

module.exports = {
  toUmlauts,
  toAscii,
  getAllVariants
};