// Test regex pattern
const testName = "$eazmfw2yl$lnfadmdb25zt$su4rkx2wvptpjafrelrkqnvbknaxes"
const regex = /^\$e\$[a-z2-7\$]+$/

console.log('Test name:', testName)
console.log('Regex test:', regex.test(testName))
console.log('Starts with $e$:', testName.startsWith('$e$'))
console.log('Length:', testName.length)
console.log('After $e$:', testName.substring(3))
console.log('Valid chars only:', /^[a-z2-7\$]+$/.test(testName.substring(3))) 