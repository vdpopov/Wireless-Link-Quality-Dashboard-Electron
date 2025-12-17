import { useState } from 'react'
import { useMonitorStore } from '../../stores/monitor-store'
import { PING_COLORS } from '@shared/constants'

export default function PingHostBar() {
  const [inputValue, setInputValue] = useState('')
  const pingHosts = useMonitorStore((s) => s.pingHosts)
  const addPingHost = useMonitorStore((s) => s.addPingHost)
  const removePingHost = useMonitorStore((s) => s.removePingHost)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const host = inputValue.trim()
    if (!host) return

    // Basic validation: IP or domain
    const pattern = /^[\d]{1,3}\.[\d]{1,3}\.[\d]{1,3}\.[\d]{1,3}$|^[a-zA-Z0-9][a-zA-Z0-9.\-]*$/
    if (!pattern.test(host)) return

    // Check for duplicates
    const exists = pingHosts.some((h) => h.host === host || h.label === host)
    if (exists) return

    await addPingHost(host)
    setInputValue('')
  }

  const handleRemove = async (hostId: string) => {
    await removePingHost(hostId)
  }

  return (
    <div className="flex items-center gap-3 py-1">
      <span className="text-sm text-gray-400">Ping:</span>

      {/* Host buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        {pingHosts.map((host, index) => {
          const color = PING_COLORS[index % PING_COLORS.length]
          const displayLabel =
            host.label !== host.host ? `${host.label} (${host.host})` : host.host

          return (
            <button
              key={host.id}
              onClick={() => handleRemove(host.id)}
              className="ping-host-btn"
              style={{ color }}
              title={`Click to remove ${host.host}`}
            >
              <span className="remove-icon">✕</span>
              <span>{displayLabel}</span>
            </button>
          )
        })}
      </div>

      <div className="flex-1" />

      {/* Add host form */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="IP or domain"
          className="input w-36 h-7 "
        />
        <button type="submit" className="btn btn-small">
          Add
        </button>
      </form>
    </div>
  )
}