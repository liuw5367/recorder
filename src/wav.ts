import { getAudioContext } from './browser'
import { compress, encodePCM, isLittleEndian, mergeMultiChannelsBuffer, sampleRateConverter } from './utils'

export function createWavHeaderBuffer(length: number, sampleRate = 16_000, numberOfChannels = 1, bitDepth = 16): ArrayBuffer {
  const buffer = new ArrayBuffer(44)
  const view = new DataView(buffer)

  writeHeader(view, length, sampleRate, numberOfChannels, bitDepth)

  return view.buffer
}

export function writeHeader(view: DataView, length: number, sampleRate = 16_000, numberOfChannels = 1, bitDepth = 16) {
  const littleEndian = isLittleEndian()
  // RIFF identifier
  writeString(view, 0, 'RIFF')
  // RIFF chunk length
  view.setUint32(4, 36 + length, littleEndian)
  // RIFF type
  writeString(view, 8, 'WAVE')
  // format chunk identifier
  writeString(view, 12, 'fmt ')
  // format chunk length
  view.setUint32(16, 16, littleEndian)
  // sample format (PCM)
  view.setUint16(20, 1, littleEndian)
  // number of channels
  view.setUint16(22, numberOfChannels, littleEndian)
  // sample rate
  view.setUint32(24, sampleRate, littleEndian)
  // byte rate (sample rate * block align)
  view.setUint32(28, sampleRate * numberOfChannels * (bitDepth / 8), littleEndian)
  // block align (channels * bytes per sample)
  view.setUint16(32, numberOfChannels * (bitDepth / 8), littleEndian)
  // bits per sample
  view.setUint16(34, bitDepth, littleEndian)
  // data chunk identifier
  writeString(view, 36, 'data')
  // data chunk length
  view.setUint32(40, length, littleEndian)
}

export function audioBuffer2Wav(audioBuffer: AudioBuffer, bitDepth = 16): DataView {
  const numberOfChannels = audioBuffer.numberOfChannels
  const sampleRate = audioBuffer.sampleRate

  const channelsBuffer: Float32Array[] = []
  for (let i = 0; i < numberOfChannels; i++) {
    channelsBuffer.push(audioBuffer.getChannelData(i))
  }

  const buffers = mergeMultiChannelsBuffer(channelsBuffer)
  return floatBuffer2wav(buffers, numberOfChannels, sampleRate, bitDepth)
}

export function numberArray2wav(
  data: number[],
  numberOfChannels: number = 1,
  sampleRate: number = 16_000,
  bitDepth: number = 16,
): DataView {
  if (bitDepth === 8) {
    const buffer = new Float32Array([...new Int8Array(data)])
    return floatBuffer2wav(buffer, numberOfChannels, sampleRate, bitDepth)
  }
  else if (bitDepth === 16) {
    const buffer = new Float32Array([...new Int16Array(data)])
    return floatBuffer2wav(buffer, numberOfChannels, sampleRate, bitDepth)
  }
  else {
    throw new Error('bitDepth must be 8 or 16')
  }
}

export function floatBuffer2wav(
  data: Float32Array,
  numberOfChannels: number = 1,
  sampleRate: number = 16_000,
  bitDepth: number = 16,
): DataView {
  const buffer = encodePCM(data, bitDepth).buffer

  return buffer2wav(new Uint8Array(buffer), numberOfChannels, sampleRate, bitDepth)
}

export function buffer2wav(data: Uint8Array, sampleRate = 16_000, numChannels = 1, bitDepth = 16): DataView {
  const buffer = new ArrayBuffer(44 + data.length)
  const view = new DataView(buffer)

  writeHeader(view, data.length, sampleRate, numChannels, bitDepth)

  // write PCM data
  for (const [i, datum] of data.entries()) {
    view.setUint8(44 + i, datum)
  }

  return view
}

function writeString(view: DataView, offset: number, content: string) {
  for (let i = 0; i < content.length; i++) {
    view.setUint8(offset + i, content.charCodeAt(i))
  }
}

export function createWavBlob(view: BlobPart): Blob {
  return new Blob([view], { type: 'audio/wav' })
}

export function readWavAsAudioBuffer(blob: Blob): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    blob
      .arrayBuffer()
      .then((arrayBuffer) => {
        getAudioContext()
          .decodeAudioData(arrayBuffer)
          .then((audioBuffer) => {
            resolve(audioBuffer)
          })
          .catch(reject)
      })
      .catch(reject)
  })
}

export function readWav2Buffer(wav: Blob): Promise<[Float32Array[], number]> {
  return new Promise((resolve, reject) => {
    readWavAsAudioBuffer(wav)
      .then((audioBuffer) => {
        const channels = audioBuffer.numberOfChannels
        const sampleRate = audioBuffer.sampleRate

        const splitBuffers: Float32Array[] = []
        for (let i = 0; i < channels; i++) {
          const channelData = audioBuffer.getChannelData(i)
          splitBuffers.push(channelData)
        }

        resolve([splitBuffers, sampleRate])
      })
      .catch(reject)
  })
}

/**
 * 分离多声道音频为多个单声道音频
 */
export function splitMultiWavBlob(blob: Blob): Promise<Blob[]> {
  return new Promise((resolve, reject) => {
    readWav2Buffer(blob)
      .then(([buffers, sampleRate]) => {
        const audioContext = getAudioContext()

        const audioBuffers = buffers.map((channelData) => {
          const audioBuffers = audioContext.createBuffer(1, channelData.length, sampleRate)
          audioBuffers.getChannelData(0).set(channelData)
          return audioBuffers
        })

        const wavBlobs = audioBuffers.map((buffer) => createWavBlob(audioBuffer2Wav(buffer)))
        resolve(wavBlobs)
      })
      .catch(reject)
  })
}

/**
 * @param data 数组类型，Float32Array[] 为单声道数据
 * @param sampleRate 16k
 * @param outputSampleRate 16k
 * @param outputBitDepth 16
 */
export function mergeMultiChannelBuffer2Wav(
  data: Float32Array[][],
  sampleRate = 16_000,
  outputSampleRate = 16_000,
  outputBitDepth: number = 16,
): DataView {
  const channelsBuffer = data.map((inputBuffer) => sampleRateConverter(compress(inputBuffer), sampleRate, outputSampleRate))
  // 合并多声道数据
  const buffers = mergeMultiChannelsBuffer(channelsBuffer)
  // 转 wav
  const numberOfChannels = data.length
  const wav = floatBuffer2wav(buffers, numberOfChannels, outputSampleRate, outputBitDepth)
  // console.log('merged wav: channel:', numberOfChannels, wav)
  return wav
}

/**
 * 合成多个单声道 wav 文件为一个多声道 wav 文件
 */
export async function mergeWavBlob(blobs: Blob[], outputSampleRate = 16_000, bitDepth = 16): Promise<Blob> {
  // 加载单声道 wav 文件
  const loadWav = async (blob: Blob) => {
    return await readWavAsAudioBuffer(blob)
  }

  const audioBuffers = await Promise.all(blobs.map((blob) => loadWav(blob)))

  let numberOfChannels = 0

  const channelsBuffer: Float32Array[] = []
  for (const buffer of audioBuffers) {
    const num = buffer.numberOfChannels
    numberOfChannels += num
    for (let i = 0; i < num; i++) {
      const channelData = buffer.getChannelData(i)
      const data = sampleRateConverter(channelData, buffer.sampleRate, outputSampleRate)
      channelsBuffer.push(data)
    }
  }

  const buffers = mergeMultiChannelsBuffer(channelsBuffer)
  const wav = floatBuffer2wav(buffers, numberOfChannels, outputSampleRate, bitDepth)
  return createWavBlob(wav)
}
