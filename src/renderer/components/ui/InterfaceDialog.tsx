import { useEffect, useState } from 'react'
import type { WirelessInterface } from '@shared/types'

interface InterfaceDialogProps {
  onSelect: (iface: string) => void
}

export default function InterfaceDialog({ onSelect }: InterfaceDialogProps) {
  const [interfaces, setInterfaces] = useState<WirelessInterface[]>([])
  const [selected, setSelected] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadInterfaces()
  }, [])

  const loadInterfaces = async () => {
    setLoading(true)
    setError(null)

    try {
      const ifaces = await window.api.getInterfaces()

      if (ifaces.length === 0) {
        setError('No wireless interfaces found')
      } else {
        setInterfaces(ifaces)
        // Auto-select first active interface, or just first one
        const active = ifaces.find((i) => i.isActive)
        setSelected(active?.name || ifaces[0].name)
      }
    } catch (err) {
      setError('Failed to get interfaces')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (selected) {
      onSelect(selected)
    }
  }

  return (
    <div className="dialog-backdrop">
      <div className="dialog">
        <h2 className="dialog-title">WiFi Monitor</h2>

        {loading ? (
          <div className="flex items-center gap-2 text-gray-400">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span>Detecting interfaces...</span>
          </div>
        ) : error ? (
          <div className="space-y-4">
            <p className="text-red-400">{error}</p>
            <button onClick={loadInterfaces} className="btn">
              Retry
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Select wireless interface:
              </label>
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="select w-full"
              >
                {interfaces.map((iface) => (
                  <option key={iface.name} value={iface.name}>
                    {iface.name} {iface.isActive ? '(connected)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end">
              <button type="submit" className="btn btn-primary" disabled={!selected}>
                Start Monitoring
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}