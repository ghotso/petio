/**
 * Converts German special characters to their ASCII equivalents
 * @param {string} text - The text to convert
 * @returns {string} - The converted text
 */
function convertGermanChars(text) {
  if (!text) return text;
  
  const germanCharMap = {
    'ä': 'ae',
    'ö': 'oe',
    'ü': 'ue',
    'ß': 'ss',
    'Ä': 'Ae',
    'Ö': 'Oe',
    'Ü': 'Ue'
  };

  return text.replace(/[äöüßÄÖÜ]/g, match => germanCharMap[match] || match);
}

module.exports = convertGermanChars;