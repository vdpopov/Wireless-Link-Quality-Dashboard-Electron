import { useSettingsStore } from '../../stores/settings-store'

const REFRESH_OPTIONS = [
  { label: '500ms', value: 500 },
  { label: '1 sec', value: 1000 },
  { label: '2 sec', value: 2000 },
  { label: '3 sec', value: 3000 },
  { label: '5 sec', value: 5000 }
]

export default function RefreshControl() {
  const refreshInterval = useSettingsStore((s) => s.refreshInterval)
  const setRefreshInterval = useSettingsStore((s) => s.setRefreshInterval)

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-400">Refresh:</label>
      <select
        value={refreshInterval}
        onChange={(e) => setRefreshInterval(Number(e.target.value))}
        className="select !text-xs h-7 !py-0"
      >
        {REFRESH_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}