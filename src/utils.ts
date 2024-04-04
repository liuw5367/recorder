/**
 * Checks if the system is little endian by creating a buffer and checking its value.
 *
 * @return {boolean} true if the system is little endian, false otherwise
 */
export function isLittleEndian(): boolean {
  const buffer = new ArrayBuffer(2)
  new DataView(buffer).setInt16(0, 256, true)
  return new Int16Array(buffer)[0] === 256
}

/**
 * Calculates the duration of an audio file based on its length and sample rate.
 *
 * @param {number} length - The length of the audio file in bytes.
 * @param {number} sampleRate - The sample rate of the audio file in Hz.
 * @return {number} The duration of the audio file in milliseconds.
 */
export function calculateAudioDuration(length: number, sampleRate: number) {
  return Math.round(Number((length / sampleRate * 1000)))
}

/**
 * Formats a given duration in milliseconds into a string representation of time in the format "mm:ss".
 *
 * @param {number} duration - The duration in milliseconds to be formatted.
 * @return {string} The formatted time string in the format "mm:ss".
 */
export function formatDuration(duration: number) {
  function formatNumber(value: number) {
    if (value < 10) {
      return `0${value}`
    }
    return value
  }

  function formatTimeValue(value: number) {
    value = Math.floor(value / 1000)
    const minute = Math.floor(value / 60)
    const second = value % 60
    return `${formatNumber(minute)}:${formatNumber(second)}`
  }

  return formatTimeValue(duration)
}

/**
 * A function to convert a float32 value to an int8 value within the range of [0, 255].
 *
 * @param {number} data - the float32 value to be converted
 * @return {number} the int8 value within the range of [0, 255]
 */
export function float32Value2Int8(data: number): number {
  // 范围[-1, 1]
  const s = Math.max(-1, Math.min(1, data))
  // 8位采样位划分成2^8=256份，它的范围是0-255;
  // 对于8位的话，负数*128，正数*127，然后整体向上平移128(+128)，即可得到[0,255]范围的数据。
  let val = s < 0 ? s * 128 : s * 127
  val = +val + 128

  return val
}

/**
 * Converts a float32 value to a 16-bit signed integer.
 *
 * @param {number} data - the input float32 value
 * @return {number} the converted 16-bit signed integer value
 */
export function float32Value2Int16(data: number): number {
  const s = Math.max(-1, Math.min(1, data))
  // 16位的划分的是2^16=65536份，范围是-32768到32767
  // 因为我们收集的数据范围在[-1,1]，那么你想转换成16位的话，只需要对负数*32768,对正数*32767,即可得到范围在[-32768,32767]的数据。
  return s < 0 ? s * 0x80_00 : s * 0x7F_FF
}

/**
 * Compresses an array of Uint8Arrays into a single Uint8Array.
 *
 * @param {Uint8Array[]} buffer - an array of Uint8Arrays to compress
 * @return {Uint8Array} a single Uint8Array containing the compressed data
 */
export function compressUint8(buffer: Uint8Array[]): Uint8Array {
  if (buffer.length === 0) {
    return new Uint8Array(0)
  }
  if (buffer.length === 1) {
    return buffer[0]
  }

  let length = 0
  for (const array of buffer) {
    length += array.length
  }

  const result = new Uint8Array(length)

  let offset = 0
  for (const array of buffer) {
    result.set(array, offset)
    offset += array.length
  }
  return result
}

/**
 * Compresses an array of Float32Arrays into a single Float32Array.
 *
 * @param {Float32Array[]} buffer - Array of Float32Arrays to compress
 * @return {Float32Array} The compressed Float32Array
 */
export function compressFloat32(buffer: Float32Array[]): Float32Array {
  if (buffer.length === 0) {
    return new Float32Array(0)
  }
  if (buffer.length === 1) {
    return buffer[0]
  }

  let length = 0
  for (const array of buffer) {
    length += array.length
  }

  const data = new Float32Array(length)

  let offset = 0
  for (const array of buffer) {
    data.set(array, offset)
    offset += array.length
  }
  return data
}

/**
 * Merge multiple channels' buffers into a single Float32Array.
 *
 * @param {Float32Array[]} channels - An array of Float32Array representing the channels to be merged.
 * @return {Float32Array} The merged Float32Array buffer.
 */
export function mergeMultiChannelsBuffer(channels: Float32Array[]): Float32Array {
  if (channels.length === 1) {
    return channels[0]
  }

  let channelLength = channels[0].length
  for (const channel of channels) {
    // 取最长的
    if (channel.length > channelLength) {
      channelLength = channel.length
    }
  }

  const mergedData = new Float32Array(channelLength * channels.length)

  for (let i = 0; i < channelLength; i++) {
    for (let j = 0; j < channels.length; j++) {
      mergedData[i * channels.length + j] = channels[j][i]
    }
  }

  return mergedData
}

/**
 * Encodes a Float32Array into a DataView with the specified bit depth and endianness.
 *
 * @param {Float32Array} bytes - The array of floating-point values to encode.
 * @param {number} [bitDepth] - The bit depth of the encoding. Must be 8 or 16.
 * @param {boolean} [littleEndian] - The endianness of the encoding.
 * @return {DataView} - The encoded DataView.
 * @throws {Error} - If bitDepth is not 8 or 16.
 */
export function encodePCM(bytes: Float32Array, bitDepth = 16, littleEndian = isLittleEndian()): DataView {
  const dataLength = bytes.length * (bitDepth / 8)
  const buffer = new ArrayBuffer(dataLength)
  const view = new DataView(buffer)

  // 写入采样数据
  if (bitDepth === 8) {
    let offset = 0
    for (let i = 0; i < bytes.length; i++, offset++) {
      view.setInt8(offset, float32Value2Int8(bytes[i]))
    }
  }
  else if (bitDepth === 16) {
    let offset = 0
    for (let i = 0; i < bytes.length; i++, offset += 2) {
      view.setInt16(offset, float32Value2Int16(bytes[i]), littleEndian)
    }
  }
  else {
    throw new Error('bitDepth must be 8 or 16')
  }

  return view
}

/**
 * Resamples the given audio data from one sample rate to another.
 *
 * @param {Float32Array[]} data - Array of Float32Array buffers representing audio data in different channels
 * @param {number} inputSampleRate - The sample rate of the input audio data
 * @param {number} outputSampleRate - The sample rate to resample the audio data to (default is 16,000)
 * @return {Promise<Float32Array[]>} A Promise that resolves with the resampled audio data in Float32Array format
 */
export function audioResample(
  data: Float32Array[],
  inputSampleRate: number,
  outputSampleRate: number = 16_000,
): Promise<Float32Array[]> {
  const channels = data.length
  const len = Math.max(...data.map((buffer) => buffer.length))

  const context = new OfflineAudioContext(channels, (len * outputSampleRate) / inputSampleRate, outputSampleRate)
  const bufferSource = context.createBufferSource()
  const audioBuffer = context.createBuffer(channels, len, inputSampleRate)

  for (const [index, buffer] of data.entries()) {
    audioBuffer.copyToChannel(buffer, index)
  }

  bufferSource.buffer = audioBuffer
  bufferSource.connect(context.destination)
  bufferSource.start()

  return new Promise((resolve, reject) => {
    context
      .startRendering()
      .then((audioBuffer) => {
        const channels = audioBuffer.numberOfChannels

        const result: Float32Array[] = []
        for (let i = 0; i < channels; i++) {
          result.push(audioBuffer.getChannelData(i))
        }

        resolve(result)
      })
      .catch(reject)
  })
}

/**
 * Sample rate converter function that takes an input signal, its sample rate, and an optional output sample rate, and returns the converted signal.
 *
 * @param {Float32Array} input - the input signal to be converted
 * @param {number} inputSampleRate - the sample rate of the input signal
 * @param {number} [outputSampleRate] - the desired sample rate of the output signal, default is 16000
 * @return {Float32Array} the converted signal with the specified sample rate
 */
export function sampleRateConverter(input: Float32Array, inputSampleRate: number, outputSampleRate: number = 16_000): Float32Array {
  if (input == null) {
    throw new Error('input data is null')
  }

  if (inputSampleRate <= 1 || outputSampleRate <= 1) {
    throw new Error('sample rate must be greater than 1')
  }

  if (inputSampleRate === outputSampleRate) {
    return input
  }

  const inputLength = input.length
  const outputLength = Math.round((inputLength * outputSampleRate) / inputSampleRate)

  const output = new Float32Array(outputLength)
  const S = new Float32Array(inputLength)
  const T = new Float32Array(outputLength)

  // 输入信号归一化
  for (let i = 0; i < inputLength; i++) {
    S[i] = input[i] / 32_768
  }

  // 计算输入输出个数比
  const f = (inputLength - 1) / (outputLength - 1)
  let fn = 0
  let ceil = 0
  let floor = 0
  output[0] = input[0]

  for (let n = 1; n < outputLength; n++) {
    // 计算输出对应输入的相邻下标
    fn = f * n
    ceil = Math.ceil(fn)
    floor = Math.floor(fn)

    // 防止下标溢出
    if (ceil >= inputLength && floor < inputLength) {
      ceil = floor
    }
    else if (ceil >= inputLength && floor >= inputLength) {
      ceil = inputLength - 1
      floor = inputLength - 1
    }

    // 相似三角形法计算输出点近似值
    T[n] = S[floor] + (fn - floor) * (S[ceil] - S[floor])
  }

  for (let i = 1; i < outputLength; i++) {
    output[i] = T[i] * 32_768
  }

  return output
}

/**
 * Convert the input data from one sample rate to another using a simple sample rate conversion algorithm.
 *
 * @param {Uint8Array} data - The input data to be converted
 * @param {number} inputSampleRate - The input sample rate of the data
 * @param {number} [outputSampleRate] - the desired sample rate of the output signal, default is 16000
 * @return {Uint8Array} The converted data at the specified output sample rate
 */
export function sampleRateConverterSimple(data: Uint8Array, inputSampleRate: number, outputSampleRate = 16_000): Uint8Array {
  const rate = inputSampleRate / outputSampleRate
  if (rate === 1) {
    return data
  }

  const compression = Math.max(rate, 1)
  const length = Math.floor(data.length / rate)
  const result = new Uint8Array(length)
  let index = 0
  let j = 0

  // 循环间隔 compression 位取一位数据
  while (index < length) {
    // 取整是因为存在比例compression不是整数的情况
    const temp = Math.floor(j)

    result[index] = data[temp]
    index++
    j += compression
  }
  return result
}

/**
 * Convert multi-channel audio data to mono.
 *
 * @param {Float32Array[]} multiChannelData - Array of Float32Array representing multi-channel audio data
 * @return {Float32Array} - Combined mono audio data
 */
export function convertToMono(multiChannelData: Float32Array[]): Float32Array {
  const channels = multiChannelData.length
  if (channels === 1) {
    return multiChannelData[0]
  }

  const samples = multiChannelData[0].length

  const monoData = new Float32Array(samples)

  for (let i = 0; i < samples; i++) {
    let sum = 0
    for (let j = 0; j < channels; j++) {
      sum += multiChannelData[j][i]
    }
    monoData[i] = sum / channels
  }

  return monoData
}

/**
 * Calculate the absolute sum of the PCM values from the provided Float32Array buffers.
 *
 * @param {Float32Array[]} buffers - An array of Float32Array buffers containing PCM data.
 * @return {number} The absolute sum of the PCM values.
 */
export function calcPcmAbsSum(buffers: Float32Array[]) {
  const data = convertToMono(buffers)
  const length = data.length

  const pcm = new Int16Array(length)
  let sum = 0

  for (let j = 0; j < length; j++) {
    // floatTo16BitPCM
    const value = float32Value2Int16(data[j])
    pcm[j] = value
    sum += Math.abs(value)
  };

  return sum
}

/**
 * A method to calculate the volume percentage.
 *
 * @param {number} pcmAbsSum - Sum of absolute values of all PCM Int16 samples
 * @param {number} pcmLength - Length of PCM
 * @return {number} 0-100, mainly used as a percentage
 */
export function calcVolumePercentage(pcmAbsSum: number, pcmLength: number) {
  /* 计算音量 https://blog.csdn.net/jody1989/article/details/73480259
  更高灵敏度算法:
    限定最大感应值10000
      线性曲线：低音量不友好
        power/10000*100
      对数曲线：低音量友好，但需限定最低感应值
        (1+Math.log10(power/10000))*100
  */
  const power = (pcmAbsSum / pcmLength) || 0// NaN
  let level
  if (power < 1251) { // 1250的结果10%，更小的音量采用线性取值
    level = Math.round(power / 1250 * 10)
  }
  else {
    level = Math.round(Math.min(100, Math.max(0, (1 + Math.log(power / 10000) / Math.log(10)) * 100)))
  };
  return level
}
