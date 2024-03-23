import { getAudioContext } from './browser'
import { compressFloat32, float32Value2Int16, float32Value2Int8, isLittleEndian, mergeMultiChannelsBuffer, sampleRateConverter } from './utils'

/**
 * Creates a WAV header buffer with the specified parameters.
 *
 * @param {number} length - The length of the WAV file in bytes.
 * @param {number} sampleRate - The sample rate of the audio (default is 16,000)
 * @param {number} numberOfChannels - The number of audio channels (default is 1)
 * @param {number} bitDepth - The bit depth of the audio (default is 16)
 * @param {boolean} [littleEndian] - The byte order of the audio.
 * @return {ArrayBuffer} The WAV header buffer.
 */
export function createWavHeaderBuffer(length: number, sampleRate = 16_000, numberOfChannels = 1, bitDepth = 16, littleEndian = isLittleEndian()): ArrayBuffer {
  const buffer = new ArrayBuffer(44)
  const view = new DataView(buffer)

  writeWavHeader(view, length, sampleRate, numberOfChannels, bitDepth, littleEndian)

  return view.buffer
}

/**
 * Writes the header for a WAVE audio file format in the DataView.
 *
 * @param {DataView} view - The DataView to write the header to
 * @param {number} length - The length of the audio data in bytes
 * @param {number} sampleRate - The sample rate of the audio (default is 16,000)
 * @param {number} numberOfChannels - The number of audio channels (default is 1)
 * @param {number} bitDepth - The bit depth of the audio (default is 16)
 * @param {boolean} littleEndian - Flag indicating whether the system is little endian
 */
export function writeWavHeader(view: DataView, length: number, sampleRate = 16_000, numberOfChannels = 1, bitDepth = 16, littleEndian = isLittleEndian()) {
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

/**
 * Converts an AudioBuffer to a WAV DataView.
 *
 * @param {AudioBuffer} audioBuffer - the input AudioBuffer to convert
 * @param {number} bitDepth - the bit depth of the output WAV (default: 16)
 * @param {boolean} littleEndian - indicates whether the output WAV is little endian (default: determined by system)
 * @return {DataView} the converted WAV DataView
 */
export function audioBuffer2Wav(
  audioBuffer: AudioBuffer,
  bitDepth = 16,
  littleEndian = isLittleEndian(),
): DataView {
  const numberOfChannels = audioBuffer.numberOfChannels
  const sampleRate = audioBuffer.sampleRate

  const channelsBuffer: Float32Array[] = []
  for (let i = 0; i < numberOfChannels; i++) {
    channelsBuffer.push(audioBuffer.getChannelData(i))
  }

  const buffers = mergeMultiChannelsBuffer(channelsBuffer)
  return float32Buffer2wav(buffers, numberOfChannels, sampleRate, bitDepth, littleEndian)
}

/**
 * Converts a Float32Array buffer to a DataView representing a WAV audio file.
 *
 * @param {Float32Array} data - The input buffer to be converted
 * @param {number} numberOfChannels - The number of audio channels (default is 1)
 * @param {number} sampleRate - The sample rate of the audio (default is 16,000)
 * @param {number} bitDepth - The bit depth of the audio (default is 16)
 * @param {boolean} [littleEndian] - Whether the WAV audio file should be in little endian format
 * @return {DataView} The DataView representing the WAV audio file
 */
export function float32Buffer2wav(
  data: Float32Array,
  numberOfChannels: number = 1,
  sampleRate: number = 16_000,
  bitDepth: number = 16,
  littleEndian = isLittleEndian(),
): DataView {
  let array: number[]

  if (bitDepth === 8) {
    const int8array = new Int8Array(data.length)
    for (const [i, sample] of data.entries()) {
      int8array[i] = float32Value2Int8(sample)
    }
    array = [...int8array]
  }
  else if (bitDepth === 16) {
    const int16array = new Int16Array(data.length)
    for (const [i, sample] of data.entries()) {
      int16array[i] = float32Value2Int16(sample)
    }
    array = [...int16array]
  }
  else {
    throw new Error('bitDepth must be 8 or 16')
  }

  return numberArray2wav(array, numberOfChannels, sampleRate, bitDepth, littleEndian)
}

/**
 * Generates a WAV file from an array of numbers.
 *
 * @param {number[]} data - The array of numbers to convert to WAV format
 * @param {number} numberOfChannels - The number of audio channels (default is 1)
 * @param {number} sampleRate - The sample rate of the audio (default is 16,000)
 * @param {number} bitDepth - The number of bits per sample (default is 16)
 * @param {boolean} littleEndian - Flag indicating if the data is in little-endian format
 * @return {ArrayBuffer} The generated WAV file as an ArrayBuffer
 */
export function numberArray2wav(
  data: number[],
  numberOfChannels: number = 1,
  sampleRate: number = 16_000,
  bitDepth: number = 16,
  littleEndian = isLittleEndian(),
) {
  const offset = 44
  const length = (data.length * bitDepth) / 8

  const buffer = new ArrayBuffer(offset + length)
  const view = new DataView(buffer)

  writeWavHeader(view, length, sampleRate, numberOfChannels, bitDepth)

  const dataView = new DataView(buffer, offset)

  if (bitDepth === 8) {
    for (const [i, sample] of data.entries()) {
      dataView.setInt8(i, sample)
    }
  }
  else if (bitDepth === 16) {
    for (const [i, sample] of data.entries()) {
      dataView.setInt16(i * 2, sample, littleEndian)
    }
  }
  else {
    throw new Error('bitDepth must be 8 or 16')
  }

  return view
}

/**
 * Converts a Uint8Array buffer to a WAV DataView with the specified sample rate, number of channels, and bit depth.
 *
 * @param {Uint8Array} data - The input Uint8Array buffer.
 * @param {number} sampleRate - The sample rate of the WAV data. Defaults to 16,000.
 * @param {number} numberOfChannels - The number of channels in the WAV data. Defaults to 1.
 * @param {number} bitDepth - The bit depth of the WAV data. Defaults to 16.
 * @return {DataView} The DataView representing the WAV data.
 */
export function uint8Buffer2wav(
  data: Uint8Array,
  sampleRate = 16_000,
  numberOfChannels = 1,
  bitDepth = 16,
): DataView {
  const buffer = new ArrayBuffer(44 + data.length)
  const view = new DataView(buffer)

  writeWavHeader(view, data.length, sampleRate, numberOfChannels, bitDepth)

  for (const [i, datum] of data.entries()) {
    view.setUint8(44 + i, datum)
  }

  return view
}

/**
 * Writes a string into a DataView starting at a specified offset.
 *
 * @param {DataView} view - The DataView to write the string into
 * @param {number} offset - The offset in the DataView where writing starts
 * @param {string} content - The string content to write into the DataView
 */
function writeString(view: DataView, offset: number, content: string) {
  for (let i = 0; i < content.length; i++) {
    view.setUint8(offset + i, content.charCodeAt(i))
  }
}

/**
 * Creates a Blob of type 'audio/wav' from the provided BlobPart view.
 *
 * @param {BlobPart} view - the BlobPart to be converted into a Blob of type 'audio/wav'
 * @return {Blob} a Blob of type 'audio/wav'
 */
export function createWavBlob(view: BlobPart): Blob {
  return new Blob([view], { type: 'audio/wav' })
}

/**
 * Reads a WAV file from a Blob and converts it to an AudioBuffer using promises.
 *
 * @param {Blob} blob - The Blob containing the WAV file data.
 * @return {Promise<AudioBuffer>} A Promise that resolves to an AudioBuffer representing the WAV file.
 */
export function readWav2AudioBuffer(blob: Blob): Promise<AudioBuffer> {
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

/**
 * Takes a WAV file as input and returns a promise with an array of Float32Arrays representing the audio channels and the sample rate.
 *
 * @param {Blob} wav - The input WAV file
 * @return {Promise<[Float32Array[], number]>} A promise with an array of Float32Arrays representing audio channels and the sample rate
 */
export function readWav2Buffer(wav: Blob): Promise<[Float32Array[], number]> {
  return new Promise((resolve, reject) => {
    readWav2AudioBuffer(wav)
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
 * Splits a multi-channel WAV blob into multiple single-channel WAV blobs.
 *
 * @param {Blob} blob - The multi-channel WAV blob to split.
 * @return {Promise<Blob[]>} A promise that resolves to an array of single-channel WAV blobs.
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
 * Merge multiple channel buffers into a single WAV file buffer.
 *
 * @param {Float32Array[][]} data - The multi-channel audio data to merge
 * @param {number} sampleRate - The sample rate of the input audio data (default is 16,000)
 * @param {number} outputSampleRate - The sample rate of the output audio data (default is 16,000)
 * @param {number} outputBitDepth - The bit depth of the output audio data (default is 16)
 * @return {DataView} The merged WAV file buffer
 */
export function mergeMultiChannelBuffer2Wav(
  data: Float32Array[][],
  sampleRate = 16_000,
  outputSampleRate = 16_000,
  outputBitDepth: number = 16,
): DataView {
  const numberOfChannels = data.length

  const channelsBuffer = data.map((buffer) => sampleRateConverter(compressFloat32(buffer), sampleRate, outputSampleRate))

  const buffers = mergeMultiChannelsBuffer(channelsBuffer)
  return float32Buffer2wav(buffers, numberOfChannels, outputSampleRate, outputBitDepth)
}

/**
 * Merges multiple WAV blobs into a single Blob with the specified output sample rate and bit depth.
 *
 * @param {Blob[]} blobs - Array of input WAV blobs to be merged
 * @param {number} outputSampleRate - The sample rate of the output WAV Blob (default is 16,000)
 * @param {number} bitDepth - The bit depth of the output WAV Blob (default is 16)
 * @return {Promise<Blob>} A Promise that resolves to the merged WAV Blob
 */
export async function mergeWavBlob(blobs: Blob[], outputSampleRate = 16_000, bitDepth = 16): Promise<Blob> {
  const loadWavAudioBuffer = async (blob: Blob) => {
    return await readWav2AudioBuffer(blob)
  }

  const audioBuffers = await Promise.all(blobs.map((blob) => loadWavAudioBuffer(blob)))

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
  const wav = float32Buffer2wav(buffers, numberOfChannels, outputSampleRate, bitDepth)
  return createWavBlob(wav)
}
