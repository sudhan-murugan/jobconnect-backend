/**
 * Escapes characters that have a special meaning in regular expressions.
 *
 * Needed whenever user input goes into a RegExp: otherwise input like ".*" or
 * "(a+)+" changes what the search matches, or makes it extremely slow (ReDoS).
 */
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = escapeRegex;
