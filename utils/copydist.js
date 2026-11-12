import fs from 'node:fs'

fs.cp('frontend/dist', 'backend/dist/dist', { recursive: true }, (err) => {
  if (err) {
    console.error(`Error copying frontend dist: ${err}`)
  }
  console.log('Frontend dist copied to backend dist')
})
