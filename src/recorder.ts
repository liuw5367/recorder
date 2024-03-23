import { getErrorMessage, initUserMedia } from './browser'
import { calculateAudioDuration } from './utils'

export interface OnProgressListener {
  (bufferList: Float32Array[], sampleRate: number): void
}

export interface RecorderConfig {
  deviceId?: string

  numberOfChannels: number

  sampleRate: number

  cacheData: boolean
}

export class Recorder {
  private context?: AudioContext

  private recorder?: ScriptProcessorNode

  private stream?: MediaStream

  private audioInput?: MediaStreamAudioSourceNode

  private onProgress?: OnProgressListener

  private readonly config: RecorderConfig = {
    deviceId: undefined,

    numberOfChannels: 1,

    sampleRate: 16_000,

    cacheData: false,
  }

  private buffers: Float32Array[][] = []

  private isPaused = false

  private isStoped = false

  private dataLength = 0

  constructor(options: Partial<RecorderConfig> = {}) {
    this.config = { ...this.config, ...options }
    initUserMedia()
  }

  /**
   * Open recording
   *
   * @param onSuccess Promise<[sampleRate, numberOfChannels]>
   * @param onError Error message
   */
  public open = async (onSuccess?: (value: [number, number]) => void, onError?: (msg: string) => void) => {
    await this.stop()
    this.reset()

    const start = new Promise<[number, number]>((resolve, reject) => {
      // @ts-expect-error webkitAudioContext
      const context = new (window.AudioContext || window.webkitAudioContext)()
      this.context = context

      // @ts-expect-error createJavaScriptNode
      const createScript = context.createScriptProcessor || context.createJavaScriptNode

      const numberOfChannels = this.config.numberOfChannels || 1

      const recorder = createScript.apply(context, [4096, numberOfChannels, numberOfChannels])
      this.recorder = recorder

      recorder.addEventListener('audioprocess', (e) => {
        if (this.isPaused) {
          return
        }

        const list: Float32Array[] = []
        for (let i = 0; i < numberOfChannels; i++) {
          const data = e.inputBuffer.getChannelData(i)
          list.push(new Float32Array(data))
        }

        this.onProgress?.(list, this.config.sampleRate)

        this.dataLength += (list[0]?.length || 0)

        if (this.config.cacheData) {
          if (this.buffers.length === 0) {
            this.buffers = list.map((buffer) => [buffer])
          }
          else {
            for (const [index, buffer] of list.entries()) {
              this.buffers[index].push(buffer)
            }
          }
        }
      })

      return navigator.mediaDevices
        .getUserMedia({
          audio: {
            sampleRate: this.config.sampleRate,
            channelCount: numberOfChannels,
            deviceId: this.config.deviceId ? { exact: this.config.deviceId } : undefined,
          },
        })
        .then(
          (stream) => {
            this.stream = stream

            const audioInput = context.createMediaStreamSource(stream)
            this.audioInput = audioInput

            const channelCount = audioInput.channelCount
            const resultChannels = numberOfChannels < channelCount ? numberOfChannels : channelCount
            this.config.numberOfChannels = resultChannels

            try {
              audioInput.connect(recorder)
              recorder.connect(context.destination)

              const sampleRate = context.sampleRate
              this.config.sampleRate = sampleRate

              resolve([sampleRate, resultChannels])
            }
            catch (error: any) {
              reject(new Error(`Error: $：${error.code || error.name}`))
            }
          },
          (error) => {
            reject(getErrorMessage(error))
          },
        )
    })

    start.then(onSuccess).catch(onError)
  }

  public pause = () => {
    this.isPaused = true
  }

  public resume = () => {
    this.isPaused = false
  }

  public stop = async () => {
    this.isPaused = false
    this.isStoped = true

    this.audioInput?.disconnect()
    this.audioInput = undefined

    this.recorder?.disconnect()
    this.recorder = undefined

    if (this.stream && this.stream.getTracks) {
      for (const track of this.stream.getTracks()) {
        track.stop()
      }
      this.stream = undefined
    }

    if (this.context && this.context.close && this.context.state !== 'closed') {
      await this.context.close()
      this.context = undefined
    }
  }

  private reset = () => {
    this.isPaused = false
    this.isStoped = false
    this.resetBuffer()
  }

  public resetBuffer = () => {
    this.buffers = []
    this.dataLength = 0
  }

  public getConfig = () => {
    return this.config
  }

  public getBuffers = () => {
    return [...this.buffers]
  }

  public setOnProgressListener = (listener?: OnProgressListener) => {
    this.onProgress = listener
  }

  public getDuration() {
    return calculateAudioDuration(this.dataLength, this.config.sampleRate)
  }
}
