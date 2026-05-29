export function normalizarTelefono(tel) {
  let n = String(tel || '').replace(/\D/g, '')
  if (n.startsWith('0054')) n = n.slice(2)
  if (n.startsWith('054'))  n = n.slice(1)
  if (n.startsWith('54') && n.length >= 12) return n
  if (n.startsWith('0')) n = n.slice(1)
  if (!n.startsWith('54')) n = '54' + n
  return n
}
