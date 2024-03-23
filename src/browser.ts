let audioContext: AudioContext | null = null

export function getAudioContext() {
  if (audioContext == null) {
    audioContext = createAudioContext()
  }
  return audioContext
}

export function createAudioContext() {
  // @ts-expect-error webkitAudioContext
  return new (window.AudioContext || window.webkitAudioContext)()
}

/**
 * Initializes the user media functionality if it is not already available.
 *
 * @return {void} This function does not return a value.
 */
export function initUserMedia() {
  if (navigator.mediaDevices === undefined) {
    (navigator as any).mediaDevices = {}
  }

  if (navigator.mediaDevices.getUserMedia === undefined) {
    navigator.mediaDevices.getUserMedia = function (constraints) {
      // @ts-expect-error types
      const getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia

      if (!getUserMedia) {
        return Promise.reject(new Error('getUserMedia is not implemented in this browser'))
      }

      return new Promise((resolve, reject) => {
        getUserMedia.call(navigator, constraints, resolve, reject)
      })
    }
  }
}

export async function getAudioInputDevices(): Promise<MediaDeviceInfo[]> {
  initUserMedia()

  return new Promise((resolve, reject) => {
    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        resolve(devices.filter((item) => item.kind === 'audioinput'))
      })
      .catch(reject)
  })
}

export function getSupportChannels(): Promise<number> {
  initUserMedia()

  return new Promise((resolve, reject) => {
    navigator.mediaDevices.getUserMedia({ audio: true }).then(
      (stream) => {
        // @ts-expect-error webkitAudioContext
        const context = new (window.AudioContext || window.webkitAudioContext)()
        const audioInput = context.createMediaStreamSource(stream)
        const channelCount = audioInput.channelCount

        if (stream && stream.getTracks) {
          for (const track of stream.getTracks()) {
            track.stop()
          }
        }

        resolve(channelCount)
      },
      (error) => {
        reject(getErrorMessage(error))
      },
    )
  })
}

export function getLanguage(): string {
  // @ts-expect-error userLanguage
  return navigator.language || navigator.userLanguage
}

export function getErrorMessage(error: any, lang = getLanguage()) {
  if (lang?.toLocaleLowerCase().includes('zh')) {
    return getErrorMessageZh(error)
  }

  return getErrorMessageEn(error)
}

export function getErrorMessageZh(error: any) {
  let message: string

  switch (error.code || error.name) {
    case 'PERMISSION_DENIED':
    case 'PermissionDeniedError': {
      message = '录音权限申请失败'
      break
    }
    case 'NOT_SUPPORTED_ERROR':
    case 'NotSupportedError': {
      message = '浏览器不支持硬件设备'
      break
    }
    case 'MANDATORY_UNSATISFIED_ERROR':
    case 'MandatoryUnsatisfiedError': {
      message = '未发现指定的硬件设备'
      break
    }
    case 'NotAllowedError': {
      message = '请在浏览器设置中开启麦克风权限'
      break
    }
    case 8:
    case 'NotFoundError': {
      message = '未发现指定的硬件设备'
      break
    }
    default: {
      message = `无法打开麦克风：${error.code || error.name}`
      break
    }
  }

  return message
}

export function getErrorMessageEn(error: any) {
  let message: string

  switch (error.code || error.name) {
    case 'PERMISSION_DENIED':
    case 'PermissionDeniedError': {
      message = 'Failed to request recording permission'
      break
    }
    case 'NOT_SUPPORTED_ERROR':
    case 'NotSupportedError':{
      message = 'Browser does not support hardware devices'
      break
    }
    case 'MANDATORY_UNSATISFIED_ERROR':
    case 'MandatoryUnsatisfiedError': {
      message = 'Specified hardware device not found'
      break
    }
    case 'NotAllowedError': {
      message = 'Please enable microphone permission in browser settings'
      break
    }
    case 8:
    case 'NotFoundError': {
      message = 'Specified hardware device not found'
      break
    }
    default:{
      message = `Failed to open microphone: ${error.code || error.name}`
    }
  }

  return message
}
