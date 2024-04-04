<div align="center">

  <h1>Recorder</h1>

  <p>
    A simple browser recording tool.
    Functions for simple processing of PCM and WAV data.
  </p>

<!-- Badges -->

[![npm version][npm-version-src]][npm-version-href]
[![bundle][bundle-src]][bundle-href]
[![JSDocs][jsdocs-src]][jsdocs-href]
[![License][license-src]][license-href]
[![contributors][contributors-src]][contributors-href]
[![last-commit][last-commit-src]][last-commit-href]
[![issues-commit][issues-src]][issues-href]
[![forks-commit][forks-src]][forks-href]
[![stars-commit][stars-src]][stars-href]

<!-- [![npm downloads][npm-downloads-src]][npm-downloads-href] -->

<!-- [![-commit][-src]][-herf] -->

<h4>
    <a href="https://liuw5367.github.io/recorder/">View Demo</a>
  <span> · </span>
    <a href="https://www.jsdocs.io/package/@lw6/recorder">Documentation</a>
  <span> · </span>
    <a href="https://github.com/liuw5367/recorder/issues/">Report Bug</a>
  <span> · </span>
    <a href="https://github.com/liuw5367/recorder/issues/">Request Feature</a>
  </h4>
</div>

### Features

- Support recording via the browser.
- Support for specifying recording devices.
- Functions for simple processing of PCM and WAV data.
- Support for multi-channel PCM data and WAV conversion.

## Getting Started

```bash
pnpm add @lw6/recorder
```

## Usage

```typescript
import { Recorder, getAudioInputDevices } from '@lw6/recorder'

const devices = await getAudioInputDevices();

const recorder = new Recorder({
  numberOfChannels: 1,
  // "undefined" represents using the system default device.
  // deviceId: devices[0].deviceId,
  deviceId: undefined,
})

recorder.open()
    .then(([sampleRate, channels]) => {
      console.log('channels:', channels, 'sampleRate:', sampleRate)
    })
    .catch((error) => {
      alert(error)
    })

recorder.pause();
recorder.resume();

recorder.stop();
recorder.getDuration();
```

## Roadmap

- [ ] Speech To Text

## Contributing

<a href="https://github.com/liuw5367/recorder/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=liuw5367/recorder" />
</a>

<!-- Contributions are always welcome! -->

<!-- See `contributing.md` for ways to get started. -->

## License

[MIT](./LICENSE)

## Contact

Email: liuw5367@gmail.com

Project Link: [https://github.com/liuw5367/recorder](https://github.com/liuw5367/recorder)

<!-- Badges -->

[npm-version-src]: https://img.shields.io/npm/v/@lw6/recorder?style=flat&colorA=080f12&colorB=1fa669
[npm-version-href]: https://npmjs.com/package/@lw6/recorder
[npm-downloads-src]: https://img.shields.io/npm/dm/@lw6/recorder?style=flat&colorA=080f12&colorB=1fa669
[npm-downloads-href]: https://npmjs.com/package/@lw6/recorder
[bundle-src]: https://img.shields.io/bundlephobia/minzip/@lw6/recorder?style=flat&colorA=080f12&colorB=1fa669&label=minzip
[bundle-href]: https://bundlephobia.com/result?p=@lw6/recorder
[license-src]: https://img.shields.io/github/license/liuw5367/recorder.svg?style=flat&colorA=080f12&colorB=1fa669
[license-href]: https://github.com/liuw5367/recorder/blob/main/LICENSE
[jsdocs-src]: https://img.shields.io/badge/jsdocs-reference-080f12?style=flat&colorA=080f12&colorB=1fa669
[jsdocs-href]: https://www.jsdocs.io/package/@lw6/recorder
[contributors-src]: https://img.shields.io/github/contributors/liuw5367/recorder
[contributors-href]: https://github.com/liuw5367/recorder/graphs/contributors
[last-commit-src]: https://img.shields.io/github/last-commit/liuw5367/recorder
[last-commit-href]: https://github.com/liuw5367/recorder
[forks-src]: https://img.shields.io/github/forks/liuw5367/recorder
[forks-href]: https://github.com/liuw5367/recorder/network/members
[stars-src]: https://img.shields.io/github/stars/liuw5367/recorder
[stars-href]: https://github.com/liuw5367/recorder/stargazers
[issues-src]: https://img.shields.io/github/issues/liuw5367/recorder
[issues-href]: https://github.com/liuw5367/recorder/issues/
