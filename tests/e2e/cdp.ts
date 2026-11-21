/**
 * Cliente mínimo do Chrome DevTools Protocol (CDP), sem dependências:
 * usa child_process para abrir o Chrome headless e o WebSocket nativo do Node 24.
 */
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void }

export class Browser {
  private ws!: WebSocket
  private id = 0
  private pending = new Map<number, Pending>()
  private listeners = new Map<string, Array<(params: unknown) => void>>()
  private proc!: ChildProcess
  private profile!: string
  consoleErrors: string[] = []

  static async launch(chromePath: string, port = 9333): Promise<Browser> {
    const b = new Browser()
    b.profile = mkdtempSync(join(tmpdir(), 'prainha-e2e-'))
    b.proc = spawn(
      chromePath,
      [
        '--headless=new',
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${b.profile}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-extensions',
        '--enable-unsafe-swiftshader',
        '--window-size=1366,900',
        'about:blank',
      ],
      { stdio: 'ignore' },
    )
    let wsUrl = ''
    for (let i = 0; i < 50 && !wsUrl; i++) {
      await new Promise((r) => setTimeout(r, 200))
      try {
        const list = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()) as Array<{
          type: string
          webSocketDebuggerUrl: string
        }>
        wsUrl = list.find((t) => t.type === 'page')?.webSocketDebuggerUrl ?? ''
      } catch {
        /* Chrome ainda iniciando */
      }
    }
    if (!wsUrl) throw new Error('Não foi possível conectar ao Chrome headless.')
    b.ws = new WebSocket(wsUrl)
    await new Promise<void>((resolve, reject) => {
      b.ws.onopen = () => resolve()
      b.ws.onerror = () => reject(new Error('Falha no WebSocket do CDP'))
    })
    b.ws.onmessage = (ev) => {
      const msg = JSON.parse(String(ev.data)) as { id?: number; result?: unknown; error?: { message: string }; method?: string; params?: unknown }
      if (msg.id !== undefined) {
        const p = b.pending.get(msg.id)
        b.pending.delete(msg.id)
        if (msg.error) p?.reject(new Error(msg.error.message))
        else p?.resolve(msg.result)
      } else if (msg.method) {
        for (const fn of b.listeners.get(msg.method) ?? []) fn(msg.params)
      }
    }
    await b.send('Page.enable')
    await b.send('Runtime.enable')
    b.on('Runtime.exceptionThrown', (p) => {
      const d = p as { exceptionDetails: { text: string; exception?: { description?: string } } }
      b.consoleErrors.push(d.exceptionDetails.exception?.description ?? d.exceptionDetails.text)
    })
    b.on('Runtime.consoleAPICalled', (p) => {
      const d = p as { type: string; args: Array<{ value?: unknown; description?: string }> }
      if (d.type === 'error') b.consoleErrors.push(d.args.map((a) => a.value ?? a.description).join(' '))
    })
    return b
  }

  send<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const id = ++this.id
    this.ws.send(JSON.stringify({ id, method, params }))
    return new Promise<T>((resolve, reject) => this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject }))
  }

  on(method: string, fn: (params: unknown) => void) {
    this.listeners.set(method, [...(this.listeners.get(method) ?? []), fn])
  }

  once(method: string, timeout = 15000): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`Timeout aguardando ${method}`)), timeout)
      const fn = (p: unknown) => {
        clearTimeout(t)
        this.listeners.set(method, (this.listeners.get(method) ?? []).filter((x) => x !== fn))
        resolve(p)
      }
      this.on(method, fn)
    })
  }

  async eval<T = unknown>(expression: string): Promise<T> {
    const r = await this.send<{ result: { value: T }; exceptionDetails?: { text: string; exception?: { description?: string } } }>(
      'Runtime.evaluate',
      { expression, awaitPromise: true, returnByValue: true },
    )
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
    return r.result.value
  }

  async goto(url: string) {
    const loaded = this.once('Page.loadEventFired')
    await this.send('Page.navigate', { url })
    await loaded
    await this.waitFor('#conteudo')
  }

  async reload() {
    const loaded = this.once('Page.loadEventFired')
    await this.send('Page.reload')
    await loaded
    await this.waitFor('#conteudo')
  }

  async waitFor(selector: string, timeout = 8000): Promise<void> {
    const start = Date.now()
    while (Date.now() - start < timeout) {
      if (await this.eval<boolean>(`!!document.querySelector(${JSON.stringify(selector)})`)) return
      await new Promise((r) => setTimeout(r, 80))
    }
    throw new Error(`Elemento não encontrado: ${selector}`)
  }

  async waitUntil(expression: string, timeout = 8000): Promise<void> {
    const start = Date.now()
    while (Date.now() - start < timeout) {
      if (await this.eval<boolean>(`!!(${expression})`)) return
      await new Promise((r) => setTimeout(r, 80))
    }
    throw new Error(`Condição não satisfeita: ${expression}`)
  }

  click(selector: string) {
    return this.eval(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw new Error('não achei ' + ${JSON.stringify(selector)}); el.click(); return true })()`)
  }

  /** Preenche um input controlado pelo React (usa o setter nativo + evento input). */
  type(selector: string, value: string) {
    return this.eval(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true })()`)
  }

  async viewport(width: number, height: number, mobile = false) {
    await this.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile })
  }

  async media(features: Array<{ name: string; value: string }>) {
    await this.send('Emulation.setEmulatedMedia', { features })
  }

  async screenshot(fullPage = false): Promise<Buffer> {
    const params: Record<string, unknown> = { format: 'png' }
    if (fullPage) params.captureBeyondViewport = true
    if (fullPage) {
      const h = await this.eval<number>('Math.min(document.documentElement.scrollHeight, 6000)')
      const w = await this.eval<number>('window.innerWidth')
      params.clip = { x: 0, y: 0, width: w, height: h, scale: 1 }
    }
    const r = await this.send<{ data: string }>('Page.captureScreenshot', params)
    return Buffer.from(r.data, 'base64')
  }

  async close() {
    try {
      await this.send('Browser.close')
    } catch {
      /* ignorado */
    }
    this.ws.close()
    this.proc.kill()
    await new Promise((r) => setTimeout(r, 500))
    try {
      rmSync(this.profile, { recursive: true, force: true })
    } catch {
      /* perfil temporário pode ficar bloqueado no Windows por alguns instantes */
    }
  }
}
