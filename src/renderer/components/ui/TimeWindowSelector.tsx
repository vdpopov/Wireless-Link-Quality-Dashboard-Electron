import { useSettingsStore } from '../../stores/settings-store'
import { TIME_WINDOW_LABELS } from '@shared/constants'
import type { TimeWindowKey } from '@shared/types'

export default function TimeWindowSelector() {
  const timeWindow = useSettingsStore((s) => s.timeWindow)
  const setTimeWindow = useSettingsStore((s) => s.setTimeWindow)

  return (
    <div className="flex items-center gap-1">
      {TIME_WINDOW_LABELS.map((label) => (
        <button
          key={label}
          onClick={() => setTimeWindow(label as TimeWindowKey)}
          className={`btn btn-small ${timeWindow === label ? 'btn-active' : ''}`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}