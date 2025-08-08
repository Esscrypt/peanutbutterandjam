const { generateValidatorKeys } = require('./src/utils/key-generation');

try {
  const keys = generateValidatorKeys(0);
  console.log('Success! Generated keys:', JSON.stringify(keys, null, 2));
} catch (error) {
  console.error('Error:', error.message);
} 