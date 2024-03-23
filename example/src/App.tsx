import 'virtual:uno.css'
import './index.css'

import { Recorder, compressFloat32, createWavBlob, float32Buffer2wav, formatDuration, getAudioInputDevices, mergeMultiChannelBuffer2Wav, sampleRateConverter } from '@lw6/recorder'
import { useEffect, useRef, useState } from 'react'

function App() {
  const [recording, setRecording] = useState(false)
  const [paused, setPaused] = useState(false)
  const [channels, setChannels] = useState(0)
  const [sampleRate, setSampleRate] = useState(48000)

  const recorderRef = useRef<Recorder>()

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>()

  const buffersRef = useRef<Float32Array[][]>([])
  const [wavUrl, setWavUrl] = useState<string>()

  const [wavUrlList, setWavUrlList] = useState<string[]>([])

  const [duration, setDuration] = useState(0)
  const [formatedDuration, setFormatedDuration] = useState('00:00')

  useEffect(() => {
    getDevices()

    return () => {
      recorderRef.current?.stop()
    }
  }, [])

  useEffect(() => {
    return () => {
      if (wavUrl) {
        URL.revokeObjectURL(wavUrl)
      }
    }
  }, [wavUrl])

  useEffect(() => {
    return () => {
      wavUrlList.forEach((url) => {
        URL.revokeObjectURL(url)
      })
    }
  }, [wavUrlList])

  useEffect(() => {
    let interval: NodeJS.Timeout | undefined
    if (recording) {
      interval = setInterval(() => {
        const value = recorderRef?.current?.getDuration() || 0
        setFormatedDuration(formatDuration(value))
      }, 333)
    }
    return () => {
      interval != null && clearInterval(interval)
    }
  }, [recording])

  function getDevices() {
    getAudioInputDevices().then((devices) => {
      console.log('audio input devices:', devices)
      setDevices(devices)
    })
  }

  function handleStartClick() {
    setPaused(false)
    buffersRef.current = []

    console.log('start channels:', channels)
    console.log('start deviceId:', selectedDeviceId)

    const recorder = new Recorder({
      numberOfChannels: channels,
      deviceId: selectedDeviceId,
      // cacheData: true
    })
    recorderRef.current = recorder

    recorder.setOnProgressListener((bufferList) => {
      if (buffersRef.current.length === 0) {
        buffersRef.current = bufferList.map((buffer) => [buffer])
      }
      else {
        bufferList.forEach((buffer, index) => {
          buffersRef.current[index].push(buffer)
        })
      }
    })

    recorder.open(([sampleRate, channels]) => {
      console.log('channels:', channels, 'sampleRate:', sampleRate)
      setSampleRate(sampleRate)
      setRecording(true)

      getDevices()
    }, (error) => {
      setRecording(false)
      alert(error)
    })
  }

  function handlePauseClick() {
    setPaused(true)
    recorderRef.current?.pause()
  }

  function handleResumeClick() {
    setPaused(false)
    recorderRef.current?.resume()
  }

  function handleStopClick() {
    recorderRef.current?.stop()
    setRecording(false)

    const duration = recorderRef.current?.getDuration() || 0
    setDuration(duration)
    setFormatedDuration(formatDuration(duration))
    console.log('duration:', duration, formatDuration(duration))

    const buffer = buffersRef.current
    // const buffer = recorderRef.current?.getBuffers() || []
    single(buffer)
    multi(buffer)
  }

  function single(buffer: Float32Array[][]) {
    const wav = mergeMultiChannelBuffer2Wav(buffer, sampleRate)
    const blob = createWavBlob(wav)
    const url = URL.createObjectURL(blob)
    setWavUrl(url)
  }

  function multi(buffer: Float32Array[][]) {
    if (buffer.length < 2) {
      return
    }
    const urls = buffer
      .map((buffer) => createWavBlob(float32Buffer2wav(sampleRateConverter(compressFloat32(buffer), sampleRate))))
      .map((blob) => window.URL.createObjectURL(blob))
    setWavUrlList(urls)
  }

  return (
    <div className="py-4 space-y-4 flex flex-col items-center w-full">

      <div className="space-x-2">
        <span>Channels: </span>
        <select className="py-1.5 px-3 rounded" onChange={(e) => setChannels(e.target.value as any)}>
          <option value={1}>1</option>
          <option value={2}>2</option>
        </select>
      </div>

      {devices.length > 0 && (
        <div className="space-x-2">
          <span>Audio input devices:</span>
          <select
            className="py-2 px-3 rounded"
            aria-placeholder="Audio input devices"
            onChange={(e) => {
              const value = e.target.value
              setSelectedDeviceId(value)
            }}
          >
            <option value={undefined}>Select a recording device</option>
            {devices.map((item) => (
              <option key={item.deviceId} value={item.deviceId}>{item.label}</option>
            ))}
          </select>
        </div>
      )}

      <div className="space-x-2 flex items-center">
        <span>{formatedDuration}</span>
        <button onClick={handleStartClick} disabled={recording}>Start</button>
        <button onClick={handlePauseClick} disabled={!recording || paused}>Pause</button>
        <button onClick={handleResumeClick} disabled={!recording || !paused}>Resume</button>
        <button onClick={handleStopClick} disabled={!recording}>Stop</button>
      </div>

      {wavUrl && (
        <div className="space-x-2 flex items-center">
          <span>duration:</span>
          <span>{duration}</span>
          <span>ms</span>
          {wavUrl && <audio controls src={wavUrl} />}
        </div>
      )}

      {wavUrlList.length > 1 && (
        <div className="space-x-2 flex">
          {wavUrlList.map((url, index) => (
            <div key={url} className="flex flex-col items-center">
              <div>
                {'channel: '}
                {index}
              </div>
              <audio controls src={url} />
            </div>
          ))}
        </div>
      )}

    </div>
  )
}

export default App
