
import { useEffect, useRef, useState } from 'react'
import './App.css'
import { analyzeImage, type PngAnalysis } from './engine/pngProcessor'
import { createRegionMask } from './engine/maskEditor'
import { getColorGroupKey, hexToColorGroupKey } from './engine/colorMapping'



function App() {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageName, setImageName] = useState('')
  const [imageSize, setImageSize] = useState('')
  const [brightness, setBrightness] = useState(100)
  const [saturation, setSaturation] = useState(100)
  const [analysis, setAnalysis] = useState<PngAnalysis | null>(null)
  const [selectedColor, setSelectedColor] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [replacementColor, setReplacementColor] = useState('#40A0FF')
  const [replaceMode, setReplaceMode] = useState(false)
  const [colorTolerance, setColorTolerance] = useState(32)

  const [regions, setRegions] = useState<
    ReturnType<typeof createRegionMask>['regions']
  >([])


  const [colorReplacements, setColorReplacements] = useState<
    Record<string, string>
  >({})



  function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.type !== 'image/png') {
      alert('Lütfen PNG formatında bir görsel seç.')
      event.target.value = ''
      return
    }

    const url = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      setImageUrl((previousUrl) => {
        if (previousUrl) URL.revokeObjectURL(previousUrl)
        return url
      })

      setImageName(file.name)
      setImageSize(`${image.width} × ${image.height} px`)
      setAnalysis(analyzeImage(image))

      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight

      const context = canvas.getContext('2d', {
        willReadFrequently: true,
      })

      if (context) {
        context.drawImage(image, 0, 0)

        const imageData = context.getImageData(
          0,
          0,
          canvas.width,
          canvas.height,
        )

        const mask = createRegionMask(imageData)

        setRegions(mask.regions)
      }

      setBrightness(100)
      setSaturation(100)
    }

    image.onerror = () => {
      URL.revokeObjectURL(url)
      alert('Görsel yüklenemedi. Başka bir PNG dosyası dene.')
    }

    image.src = url
    event.target.value = ''
  }

  function resetAdjustments() {
    setBrightness(100)
    setSaturation(100)
  }



  
useEffect(() => {
  const canvas = canvasRef.current
  if (!canvas || !imageUrl) return

  const context = canvas.getContext('2d', {
    willReadFrequently: true,
  })

  if (!context) return

  const image = new Image()

  image.onload = () => {
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight

    context.clearRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0)

    const imageData = context.getImageData(
      0,
      0,
      canvas.width,
      canvas.height,
    )

    const pixels = imageData.data

    // Önce kaydedilmiş bütün renk değişikliklerini uygula.
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] === 0) continue

      const groupKey = getColorGroupKey(
        pixels[i],
        pixels[i + 1],
        pixels[i + 2],
        colorTolerance,
      )

      const replacement = colorReplacements[groupKey]

      if (replacement) {
        const hex = replacement.replace('#', '')

        pixels[i] = parseInt(hex.slice(0, 2), 16)
        pixels[i + 1] = parseInt(hex.slice(2, 4), 16)
        pixels[i + 2] = parseInt(hex.slice(4, 6), 16)
      }
    }

    // Ardından seçili, henüz değiştirilmemiş grubu vurgula.
    if (selectedColor && !replaceMode) {
      const selectedGroup = hexToColorGroupKey(
        selectedColor,
        colorTolerance,
      )

      if (selectedGroup && !colorReplacements[selectedGroup]) {
        for (let i = 0; i < pixels.length; i += 4) {
          if (pixels[i + 3] === 0) continue

          const pixelGroup = getColorGroupKey(
            pixels[i],
            pixels[i + 1],
            pixels[i + 2],
            colorTolerance,
          )

          if (pixelGroup === selectedGroup) {
            pixels[i] = 255
            pixels[i + 1] = 40
            pixels[i + 2] = 220
          }
        }
      }
    }

    context.putImageData(imageData, 0, 0)
  }

  image.src = imageUrl
}, [
  imageUrl,
  selectedColor,
  replacementColor,
  replaceMode,
  colorTolerance,
  colorReplacements,
])


  function handleCanvasClick(
    event: React.MouseEvent<HTMLCanvasElement>,
  ) {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()

    const x = Math.floor(
      ((event.clientX - rect.left) / rect.width) * canvas.width,
    )

    const y = Math.floor(
      ((event.clientY - rect.top) / rect.height) * canvas.height,
    )

    if (
      x < 0 ||
      y < 0 ||
      x >= canvas.width ||
      y >= canvas.height
    ) {
      return
    }

    const context = canvas.getContext('2d')
    if (!context) return

    const pixel = context.getImageData(x, y, 1, 1).data

    // Şeffaf piksele tıklanırsa seçim yapma.
    if (pixel[3] === 0) return

    const hex =
      '#' +
      [pixel[0], pixel[1], pixel[2]]
        .map((value) => value.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase()

    const clickedGroup = hexToColorGroupKey(hex)

    const matchingColor = analysis?.palette.find(
      (color) => hexToColorGroupKey(color.hex) === clickedGroup,
    )

    setSelectedColor(matchingColor?.hex ?? hex)

    setReplaceMode(false)
  }





  function exportPng() {
    if (!imageUrl) return

    const image = new Image()

    image.onload = () => {
      const sourceCanvas = document.createElement('canvas')
      sourceCanvas.width = image.naturalWidth
      sourceCanvas.height = image.naturalHeight

      const sourceContext = sourceCanvas.getContext('2d', {
        willReadFrequently: true,
      })

      if (!sourceContext) return

      sourceContext.drawImage(image, 0, 0)

      // Seçilen renk grubunu değiştir.
      if (selectedColor && replaceMode) {
        const imageData = sourceContext.getImageData(
          0,
          0,
          sourceCanvas.width,
          sourceCanvas.height,
        )

        const selectedGroup = hexToColorGroupKey(
          selectedColor,
          colorTolerance,
        )

        const replacement = replacementColor.match(/[0-9A-F]{2}/gi)

        if (selectedGroup && replacement?.length === 3) {
          const pixels = imageData.data

          const newR = parseInt(replacement[0], 16)
          const newG = parseInt(replacement[1], 16)
          const newB = parseInt(replacement[2], 16)

          for (let i = 0; i < pixels.length; i += 4) {
            if (pixels[i + 3] === 0) continue

            const pixelGroup = getColorGroupKey(
              pixels[i],
              pixels[i + 1],
              pixels[i + 2],
              colorTolerance,
            )

            if (pixelGroup === selectedGroup) {
              pixels[i] = newR
              pixels[i + 1] = newG
              pixels[i + 2] = newB
            }
          }

          sourceContext.putImageData(imageData, 0, 0)
        }
      }

      // Parlaklık ve doygunluk ayarlarını uygula.
      const exportCanvas = document.createElement('canvas')
      exportCanvas.width = sourceCanvas.width
      exportCanvas.height = sourceCanvas.height

      const exportContext = exportCanvas.getContext('2d')
      if (!exportContext) return

      exportContext.filter =
        `brightness(${brightness}%) saturate(${saturation}%)`

      exportContext.drawImage(sourceCanvas, 0, 0)
      exportContext.filter = 'none'

      // PNG olarak indir.
      exportCanvas.toBlob((blob) => {
        if (!blob) {
          alert('PNG dışa aktarılamadı.')
          return
        }

        const downloadUrl = URL.createObjectURL(blob)
        const link = document.createElement('a')

        link.href = downloadUrl
        link.download = `${imageName.replace(/\.png$/i, '')}-edited.png`

        document.body.appendChild(link)
        link.click()
        link.remove()

        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000)
      }, 'image/png')
    }

    image.onerror = () => {
      alert('Görsel dışa aktarım için yüklenemedi.')
    }

    image.src = imageUrl
  }

  return (
    <main className="app">
      <header className="app-header">
        <div>
          <h1>Item Art Studio</h1>
          <p>Pixel art item editor & variant generator</p>
        </div>

        <button
          className="export-button"
          disabled={!imageUrl}
          onClick={exportPng}
        >
          Export PNG
        </button>
      </header>

      <section className="workspace">
        <aside className="panel">
          <h2>Source Item</h2>
          <p>Upload a PNG to get started.</p>

          <label className="upload-button">
            Choose PNG
            <input
              type="file"
              accept="image/png"
              hidden
              onChange={handleImageUpload}
            />
          </label>

          {imageName && (
            <div className="image-info">
              <p>{imageName}</p>
              <p>{imageSize}</p>
            </div>
          )}
          {analysis && (
            <div className="analysis-info">
              <h3>Image Analysis</h3>
              <p>Dimensions: {analysis.width} × {analysis.height}</p>
              <p>Colors: {analysis.uniqueColors.toLocaleString()}</p>
              <p>Transparent: {analysis.transparencyPercent.toFixed(1)}%</p>
              <p>
                Alpha channel:{' '}
                {analysis.hasTransparency ? 'Present' : 'No transparent pixels'}
              </p>
              <p>
                Partial transparency:{' '}
                {analysis.hasPartialTransparency ? 'Yes' : 'No'}
              </p>
            </div>
          )}


          {analysis && (
            <div className="palette-section">
              <h3>Color Palette</h3>
              {selectedColor && (
                <p>
                  Selected: <strong>{selectedColor}</strong>
                  <button type="button" onClick={() => setSelectedColor(null)}>
                    Clear selection
                  </button>
                </p>
              )}
              <div className="palette-grid">

                {selectedColor && (
                  <div className="recolor-controls">
                    <p>Selected color: {selectedColor}</p>

                    <label>
                      Replacement color
                      <input
                        type="color"
                        value={replacementColor}
                        onChange={(event) => setReplacementColor(event.target.value.toUpperCase())}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => setReplaceMode(true)}
                    >
                      Preview replacement
                    </button>

                    <button
                      type="button"

                      onClick={() => {
                        if (!selectedColor) return

                        const groupKey = hexToColorGroupKey(
                          selectedColor,
                          colorTolerance,
                        )

                        setColorReplacements((previous) => ({
                          ...previous,
                          [groupKey]: replacementColor,
                        }))

                        setReplaceMode(true)
                      }}

                    >
                      Highlight selected color
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setReplaceMode(false)
                        setSelectedColor(null)
                        setReplacementColor('#40A0FF')
                        setBrightness(100)
                        setSaturation(100)
                      }}
                    >
                      Reset all adjustments
                    </button>
                  </div>
                )}



                {analysis.palette.slice(0, 24).map((color) => (
                  <button
                    className={`palette-color ${selectedColor === color.hex ? 'selected' : ''}`}
                    key={color.hex}
                    title={`Select ${color.hex}`}
                    onClick={() =>
                      setSelectedColor((current) => current === color.hex ? null : color.hex)
                    }
                    type="button"
                  >                    <span
                      className="palette-swatch"
                      style={{ backgroundColor: color.hex }}
                    />
                    <span className="palette-hex">{color.hex}</span>
                    <span className="palette-count">
                      {color.count.toLocaleString()} px
                    </span>
                  </button>))}
              </div>

              <p>
                Showing {Math.min(analysis.palette.length, 24)} of{' '}
                {analysis.palette.length} colors
              </p>
            </div>
          )}

        </aside>

        <section className="preview-panel">
          <h2>Preview</h2>

          <div className="preview-canvas">
            {imageUrl ? (
              <canvas
                ref={canvasRef}
                className="item-image"
                onClick={handleCanvasClick}
                style={{
                  filter: `brightness(${brightness}%) saturate(${saturation}%)`,
                }}
                aria-label="Uploaded item preview"
              />
            ) : (
              <span>128 × 128</span>
            )}
          </div>

          <p className="muted">
            {imageUrl ? 'Live preview' : 'Your item will appear here.'}
          </p>
        </section>

        <aside className="panel">
          <h2>Appearance</h2>

          <label>
            Material
            <select defaultValue="plastic">
              <option value="plastic">Plastic</option>
              <option value="metal">Metal</option>
              <option value="gold">Gold</option>
              <option value="carbon">Carbon Fiber</option>
            </select>
          </label>

          <label>
            Brightness: {brightness}%
            <input
              type="range"
              min="0"
              max="200"
              value={brightness}
              onChange={(event) => setBrightness(Number(event.target.value))}
            />
          </label>

          <label>
            Saturation: {saturation}%
            <input
              type="range"
              min="0"
              max="200"
              value={saturation}
              onChange={(event) => setSaturation(Number(event.target.value))}
            />
          </label>

          <div className="control-group">
            <label htmlFor="color-tolerance">
              Color Grouping: {colorTolerance}
            </label>

            <input
              id="color-tolerance"
              type="range"
              min="8"
              max="64"
              step="4"
              value={colorTolerance}
              onChange={(event) => setColorTolerance(Number(event.target.value))}
            />

            <p className="control-hint">
              Higher values group more color shades together.
            </p>
          </div>


          <button
            className="reset-button"
            type="button"
            onClick={resetAdjustments}
          >
            Reset adjustments
          </button>
        </aside>
      </section>

      <section className="variants-panel">
        <h2>Variants</h2>
        <p>Generated item variants will appear here.</p>
      </section>
    </main>
  )
}

export default App
