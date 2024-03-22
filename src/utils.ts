export function isLittleEndian(): boolean {
  const buffer = new ArrayBuffer(2)
  new DataView(buffer).setInt16(0, 256, true)
  return new Int16Array(buffer)[0] === 256
}

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

export function compress(buffer: Float32Array[]): Float32Array {
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
 * 合并多声道数据
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

export function encodePCM(bytes: Float32Array, bitDepth = 16, littleEndian = isLittleEndian()): DataView {
  let offset = 0
  const dataLength = bytes.length * (bitDepth / 8)
  const buffer = new ArrayBuffer(dataLength)
  const data = new DataView(buffer)

  // 写入采样数据
  if (bitDepth === 8) {
    for (let i = 0; i < bytes.length; i++, offset++) {
      // 范围[-1, 1]
      const s = Math.max(-1, Math.min(1, bytes[i]))
      // 8位采样位划分成2^8=256份，它的范围是0-255;
      // 对于8位的话，负数*128，正数*127，然后整体向上平移128(+128)，即可得到[0,255]范围的数据。
      let val = s < 0 ? s * 128 : s * 127
      val = +val + 128
      data.setInt8(offset, val)
    }
  }
  else if (bitDepth === 16) {
    for (let i = 0; i < bytes.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, bytes[i]))
      // 16位的划分的是2^16=65536份，范围是-32768到32767
      // 因为我们收集的数据范围在[-1,1]，那么你想转换成16位的话，只需要对负数*32768,对正数*32767,即可得到范围在[-32768,32767]的数据。
      data.setInt16(offset, s < 0 ? s * 0x80_00 : s * 0x7F_FF, littleEndian)
    }
  }
  else {
    throw new Error('bitDepth must be 8 or 16')
  }

  return data
}

/**
 * 采样率转换
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
 * 采样率转换
 */
export function sampleRateConverter(input: Float32Array, inputSampleRate: number, outputSampleRate: number = 16_000): Float32Array {
  // 输入为空检验
  if (input == null) {
    throw new Error('输入音频为空数组')
  }

  // 采样率合法检验
  if (inputSampleRate <= 1 || outputSampleRate <= 1) {
    throw new Error('输入或输出音频采样率不合法')
  }

  if (inputSampleRate === outputSampleRate) {
    return input
  }

  // 输入音频长度
  const len = input.length

  // 输出音频长度
  const outlen = Math.round((len * outputSampleRate) / inputSampleRate)

  const output = new Float32Array(outlen)
  const S = new Float32Array(len)
  const T = new Float32Array(outlen)
  // 输入信号归一化
  for (let i = 0; i < len; i++) {
    S[i] = input[i] / 32_768
  }

  // 计算输入输出个数比
  const f = (len - 1) / (outlen - 1)
  let fn = 0
  let ceil = 0
  let floor = 0
  output[0] = input[0]

  for (let n = 1; n < outlen; n++) {
    // 计算输出对应输入的相邻下标
    fn = f * n
    ceil = Math.ceil(fn)
    floor = Math.floor(fn)

    // 防止下标溢出
    if (ceil >= len && floor < len) {
      ceil = floor
    }
    else if (ceil >= len && floor >= len) {
      ceil = len - 1
      floor = len - 1
    }

    // 相似三角形法计算输出点近似值
    T[n] = S[floor] + (fn - floor) * (S[ceil] - S[floor])
  }

  for (let i = 1; i < outlen; i++) {
    output[i] = T[i] * 32_768
  }

  return output
}

/**
 * 采样率转换
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
