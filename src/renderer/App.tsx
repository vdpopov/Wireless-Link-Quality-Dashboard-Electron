import { useEffect, useState } from 'react'
import { useSettingsStore } from './stores/settings-store'
import { useMonitorStore } from './stores/monitor-store'
import InterfaceDialog from './components/ui/InterfaceDialog'
import TimeWindowSelector from './components/ui/TimeWindowSelector'
import RefreshControl from './components/ui/RefreshControl'
import PingHostBar from './components/ui/PingHostBar'
import SignalChart from './components/charts/SignalChart'
import PingChart from './components/charts/PingChart'
import RateChart from './components/charts/RateChart'
import BandwidthChart from './components/charts/BandwidthChart'
import ChannelHeatmap from './components/heatmap/ChannelHeatmap'

export default function App() {
  const [activeTab, setActiveTab] = useState<'monitor' | 'heatmap'>('monitor')
  const [showInterfaceDialog, setShowInterfaceDialog] = useState(true)

  const selectedInterface = useSettingsStore((s) => s.selectedInterface)
  const setSelectedInterface = useSettingsStore((s) => s.setSelectedInterface)
  const isZoomed = useSettingsStore((s) => s.isZoomed)
  const resetZoom = useSettingsStore((s) => s.resetZoom)
  const paused = useSettingsStore((s) => s.paused)
  const togglePaused = useSettingsStore((s) => s.togglePaused)


  
useEffect(() => {
  if (!selectedInterface) return

  const unsubData = window.api.onMonitorData((data) => {
    useMonitorStore.getState().updateData(data)
  })

  const unsubHosts = window.api.onPingHostsChanged((hosts) => {
    useMonitorStore.getState().setPingHosts(hosts)
  })

  window.api.getPingHosts().then((hosts) => {
    useMonitorStore.getState().setPingHosts(hosts)
  })

  return () => {
    unsubData()
    unsubHosts()
  }
}, [selectedInterface])

  const handleInterfaceSelect = async (iface: string) => {
    await window.api.selectInterface(iface)
    setSelectedInterface(iface)
    setShowInterfaceDialog(false)
  }

  if (showInterfaceDialog) {
    return <InterfaceDialog onSelect={handleInterfaceSelect} />
  }

  return (
    <div className="h-screen flex flex-col bg-surface text-gray-200 overflow-hidden">
      {/* Top Bar */}
      <header className="flex items-center gap-2 px-4 py-2 bg-surface-light border-b border-gray-700">
        <TimeWindowSelector />

        {isZoomed && (
          <button onClick={resetZoom} className="btn btn-small">
            Reset Zoom
          </button>
        )}

        <div className="w-px h-6 bg-gray-600 mx-2" />

        <RefreshControl />

        <div className="w-px h-6 bg-gray-600 mx-2" />

        <button onClick={togglePaused} className="btn btn-small">
          {paused ? 'Resume' : 'Pause'}
        </button>

        <div className="flex-1" />

        <span className="text-sm text-gray-500">{selectedInterface}</span>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-gray-700 bg-surface-light">
        <button
          className={`tab ${activeTab === 'monitor' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('monitor')}
        >
          Live Monitor
        </button>
        <button
          className={`tab ${activeTab === 'heatmap' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('heatmap')}
        >
          Channel Heatmap
        </button>
      </div>

      {/* Content */}
      {activeTab === 'monitor' ? (
        <div className="flex-1 grid grid-rows-[1fr_auto_1fr_1fr_1fr] gap-2 p-4 overflow-hidden">
          <div className="bg-surface-light rounded overflow-hidden">
            <SignalChart />
          </div>

          <PingHostBar />

          <div className="bg-surface-light rounded overflow-hidden">
            <PingChart />
          </div>

          <div className="bg-surface-light rounded overflow-hidden">
            <RateChart />
          </div>

          <div className="bg-surface-light rounded overflow-hidden">
            <BandwidthChart />
          </div>
        </div>
      ) : (
        <div className="flex-1 p-4 overflow-hidden">
          <ChannelHeatmap />
        </div>
      )}
    </div>
  )
}