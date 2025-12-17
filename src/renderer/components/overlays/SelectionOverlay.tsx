interface SelectionOverlayProps {
  startX: number
  endX: number
}

export default function SelectionOverlay({ startX, endX }: SelectionOverlayProps) {
  const width = endX - startX

  if (width <= 0) return null

  return (
    <div
      className="overlay-selection"
      style={{
        left: startX,
        top: 0,
        width,
        height: '100%'
      }}
    />
  )
}