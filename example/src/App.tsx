import 'virtual:uno.css'
import './index.css'

import { Recorder, compressFloat32, createWavBlob, float32Buffer2wav, getAudioInputDevices, mergeMultiChannelBuffer2Wav, sampleRateConverter } from 'recorder'
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

    const buffer = buffersRef.current
    single(buffer)
    multi(buffer)
  }

  function single(buffer: Float32Array[][]) {
    console.log('stop', buffer)

    const wav = mergeMultiChannelBuffer2Wav(buffer, sampleRate)
    console.log('wav', wav)

    const blob = createWavBlob(wav)
    const url = URL.createObjectURL(blob)

    console.log('url', [url])

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
    <div className="space-y-2 p-4">
      <div className="space-x-2">
        <span>Audio input devices:</span>
        <select
          className="py-2 px-3 rounded"
          onChange={(e) => {
            const value = e.target.value
            if (value === 'default') {
              setSelectedDeviceId(undefined)
            }
            else {
              setSelectedDeviceId(value)
            }
          }}
        >
          {devices.map((item) => (
            <option key={item.deviceId} value={item.deviceId}>{item.label}</option>
          ))}
        </select>
      </div>

      <div className="space-x-2">
        <span>
          SampleRate:
        </span>
        <span>
          {sampleRate}
        </span>
      </div>

      <div className="space-x-2">
        <span>Channels: </span>
        <select className="py-2 px-3 rounded" onChange={(e) => setChannels(e.target.value as any)}>
          <option value={1}>1</option>
          <option value={2}>2</option>
        </select>
      </div>

      <div className="space-x-2 flex items-center">

        <button onClick={handleStartClick} disabled={recording}>开始</button>
        <button onClick={handlePauseClick} disabled={!recording || paused}>暂停</button>
        <button onClick={handleResumeClick} disabled={!recording || !paused}>继续</button>
        <button onClick={handleStopClick} disabled={!recording}>结束</button>
      </div>

      {wavUrl && (
        <div className="space-x-2">
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
          ),
          )}
        </div>
      )}

    </div>
  )
}

export default App
