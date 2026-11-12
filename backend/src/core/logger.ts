import type { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'

type Colour = | 'red' | 'green' | 'yellow' | 'blue' | 'purple' | 'cyan' | 'red_bg' | 'green_bg' | 'yellow_bg' | 'blue_bg' | 'purple_bg' | 'cyan_bg' | 'white_bg'

function getLoggerTimestamp(): string {
  return new Date().toISOString()
}

export function colourLog(color: Colour, ...args: any[]) {
  args.unshift(`[${getLoggerTimestamp()}]`)
  // adjust text color
  if (color === 'red')
    console.log('\u001B[31m', ...args, '\u001B[0m')
  else if (color === 'green')
    console.log('\u001B[32m', ...args, '\u001B[0m')
  else if (color === 'yellow')
    console.log('\u001B[33m', ...args, '\u001B[0m')
  else if (color === 'blue')
    console.log('\u001B[34m', ...args, '\u001B[0m')
  else if (color === 'purple')
    console.log('\u001B[35m', ...args, '\u001B[0m')
  else if (color === 'cyan')
    console.log('\u001B[36m', ...args, '\u001B[0m')
  // adjust bg color
  else if (color === 'red_bg')
    console.log('\u001B[41m', ...args, '\u001B[0m')
  else if (color === 'blue_bg')
    console.log('\u001B[44m', ...args, '\u001B[0m')
  else if (color === 'purple_bg')
    console.log('\u001B[45m', ...args, '\u001B[0m')
  else if (color === 'cyan_bg')
    console.log('\u001B[46m', ...args, '\u001B[0m')
  // adjust text and bg color for better visibility
  else if (color === 'green_bg')
    console.log('\u001B[42m\u001B[34m', ...args, '\u001B[0m')
  else if (color === 'yellow_bg')
    console.log('\u001B[43m\u001B[34m', ...args, '\u001B[0m')
  else if (color === 'white_bg')
    console.log('\u001B[47m\u001B[34m', ...args, '\u001B[0m')
  // if you didn't specify a color, log everything with default color
  else console.log(color, ...args)
}

export function loggerMiddleware(app: Hono) {
  app.use(async (c, next) => {
    const start = Date.now()
    try {
      await next()
      const ms = Date.now() - start
      colourLog('cyan', `${c.req.method} ${c.req.path} - ${c.res.status} ${ms}ms`)
    }
    catch (error) {
      const status = error instanceof HTTPException ? error.status : 500
      const ms = Date.now() - start
      colourLog('red', `${c.req.method} ${c.req.path} - ${status} ${ms}ms`, error)
      throw error
    }
  })
}
