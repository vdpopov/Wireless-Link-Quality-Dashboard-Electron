interface HoverOverlayProps {
  x: number
  y: number
  content: string
  visible: boolean
}

export default function HoverOverlay({ x, y, content, visible }: HoverOverlayProps) {
  if (!visible || !content) return null

  const flipToLeft = x > window.innerWidth - 200

  const style: React.CSSProperties = flipToLeft
    ? {
        right: window.innerWidth - x + 10,
        top: y - 10,
        transform: 'translateY(-100%)'
      }
    : {
        left: x + 10,
        top: y - 10,
        transform: 'translateY(-100%)'
      }

  return (
    <div className="tooltip" style={style}>
      {content}
    </div>
  )
}


