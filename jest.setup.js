// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(), // deprecated
        removeListener: jest.fn(), // deprecated
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
    })),
})

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
    constructor() { }
    disconnect() { }
    observe() { }
    takeRecords() {
        return []
    }
    unobserve() { }
}

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
    constructor() { }
    disconnect() { }
    observe() { }
    unobserve() { }
}

// jsdom ships neither TextEncoder/TextDecoder nor Blob's async readers, which
// any code touching binary formats (DBF/XLSX/ZIP parsing) needs. Node has both.
const { TextEncoder, TextDecoder } = require('util')
if (typeof global.TextEncoder === 'undefined') global.TextEncoder = TextEncoder
if (typeof global.TextDecoder === 'undefined') global.TextDecoder = TextDecoder

if (typeof Blob !== 'undefined') {
    if (typeof Blob.prototype.arrayBuffer !== 'function') {
        Blob.prototype.arrayBuffer = function () {
            return new Promise((resolve, reject) => {
                const reader = new FileReader()
                reader.onload = () => resolve(reader.result)
                reader.onerror = () => reject(reader.error)
                reader.readAsArrayBuffer(this)
            })
        }
    }
    if (typeof Blob.prototype.text !== 'function') {
        Blob.prototype.text = function () {
            return this.arrayBuffer().then((buf) => new TextDecoder('utf-8').decode(buf))
        }
    }
}

// Mock fetch globally.
// A bare jest.fn() returns undefined, so any component doing `fetch(...).then(...)`
// threw before it rendered — which is what failed every test touching useBrand().
// The default now resolves to an empty, OK response; tests that care still override it
// with their own mockResolvedValue.
global.fetch = jest.fn(() =>
    Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(''),
    }),
)

// Suppress console errors in tests (optional)
global.console = {
    ...console,
    error: jest.fn(),
    warn: jest.fn(),
}

// jsdom does not implement scrollIntoView; the employee form calls it to jump to
// the first invalid field, which would otherwise throw inside a React event.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = function () {}
}
