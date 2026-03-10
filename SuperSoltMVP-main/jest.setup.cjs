require('@testing-library/jest-dom')

// Polyfill for TextEncoder/TextDecoder needed by pg library
const { TextEncoder, TextDecoder } = require('util')
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder
