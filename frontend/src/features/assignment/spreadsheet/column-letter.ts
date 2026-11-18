export function columnLetter(index: number): string {
  if (!Number.isSafeInteger(index) || index < 0 || index >= 16384) return ''
  let letters = ''
  for (let next = index + 1; next > 0; next = Math.floor((next - 1) / 26)) {
    letters = String.fromCharCode(65 + ((next - 1) % 26)) + letters
  }
  return letters
}
