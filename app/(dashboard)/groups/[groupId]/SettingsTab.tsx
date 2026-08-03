/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState } from 'react'
import { Settings, Save, RotateCcw, Loader2, CheckCircle, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { updateGroupScoringSettingsAction } from './actions'
import { DEFAULT_GROUP_SCORING, GroupScoringSettings, getGroupScoringSettings } from '@/lib/tournamentScoring'

interface SettingsTabProps {
  groupId: string
  group: any
  isAdmin: boolean
}

export default function SettingsTab({ groupId, group, isAdmin }: SettingsTabProps) {
  const [scoring, setScoring] = useState<GroupScoringSettings>(
    getGroupScoringSettings(group?.custom_scoring_settings)
  )
  const [activePos, setActivePos] = useState<'GK' | 'DEF' | 'MID' | 'ATT'>('GK')
  const [isSaving, setIsSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const handleStatChange = (pos: 'GK' | 'DEF' | 'MID' | 'ATT', field: string, val: number) => {
    setScoring((prev) => ({
      ...prev,
      [pos]: {
        ...prev[pos],
        [field]: val,
      },
    }))
  }

  const handleResetDefaults = () => {
    setScoring(DEFAULT_GROUP_SCORING)
    setToast('Reset to tournament defaults. Click Save to persist.')
    setTimeout(() => setToast(null), 3000)
  }

  const handleSaveSettings = async () => {
    if (!isAdmin) return
    setIsSaving(true)
    try {
      await updateGroupScoringSettingsAction(groupId, scoring)
      setToast('✅ Group scoring rules saved successfully!')
      setTimeout(() => setToast(null), 3500)
    } catch (err: any) {
      alert(err.message || 'Failed to save group settings')
    } finally {
      setIsSaving(false)
    }
  }

  const positions: { key: 'GK' | 'DEF' | 'MID' | 'ATT'; label: string; icon: string }[] = [
    { key: 'GK', label: 'Goalkeepers (GK)', icon: '🧤' },
    { key: 'DEF', label: 'Defenders (DEF)', icon: '🛡️' },
    { key: 'MID', label: 'Midfielders (MID)', icon: '⚙️' },
    { key: 'ATT', label: 'Forwards (ATT)', icon: '⚽' },
  ]

  const fields: { key: string; label: string; desc: string }[] = [
    { key: 'goal', label: 'Goal Scored', desc: 'Points awarded per goal scored' },
    { key: 'assist', label: 'Assist Provided', desc: 'Points awarded per goal assist' },
    { key: 'cleanSheet', label: 'Clean Sheet', desc: 'Points awarded for 0 goals conceded' },
    { key: 'penaltySave', label: 'Penalty Saved', desc: 'Points awarded for penalty save (GK)' },
    { key: 'goalConceded', label: 'Goal Conceded', desc: 'Points deducted per goal conceded while on pitch' },
    { key: 'ownGoal', label: 'Own Goal', desc: 'Points deducted for scoring an own goal' },
    { key: 'yellowCard', label: 'Yellow Card', desc: 'Points deducted for yellow card' },
    { key: 'redCard', label: 'Red Card', desc: 'Points deducted for red card' },
  ]

  return (
    <div className="space-y-6 pb-20 animate-in fade-in-50 duration-200">
      {/* Header */}
      <div className="bg-white p-5 rounded-3xl border border-neutral-100 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-base font-black text-neutral-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-600" /> Group Points & Scoring Rules
          </h2>
          <p className="text-xs text-neutral-500 font-medium mt-0.5">
            Configure custom point weights per position for leaderboards and awards.
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetDefaults}
              className="rounded-xl text-xs flex-1 sm:flex-initial"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset Defaults
            </Button>
            <Button
              size="sm"
              disabled={isSaving}
              onClick={handleSaveSettings}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex-1 sm:flex-initial"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
              Save Settings
            </Button>
          </div>
        )}
      </div>

      {toast && (
        <div className="p-3 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-2xl border border-emerald-200 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" /> {toast}
        </div>
      )}

      {/* Position Selector Tabs */}
      <div className="flex bg-neutral-100 p-1.5 rounded-2xl overflow-x-auto gap-1">
        {positions.map((pos) => (
          <button
            key={pos.key}
            onClick={() => setActivePos(pos.key)}
            className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all whitespace-nowrap flex items-center justify-center gap-1.5 ${
              activePos === pos.key ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <span>{pos.icon}</span>
            <span>{pos.label}</span>
          </button>
        ))}
      </div>

      {/* Point Rules Grid for Active Position */}
      <div className="bg-white rounded-3xl p-5 border border-neutral-100 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <span className="text-xs font-black text-neutral-900 uppercase tracking-wider">
            {positions.find((p) => p.key === activePos)?.label} Point Matrix
          </span>
          {!isAdmin && (
            <span className="text-[10px] bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded font-bold flex items-center gap-1">
              <Shield className="w-3 h-3 text-neutral-400" /> View Only (Admin Managed)
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {fields.map((f) => {
            const currentVal = (scoring[activePos] as any)?.[f.key] ?? 0
            return (
              <div
                key={f.key}
                className="p-3.5 bg-neutral-50 rounded-2xl border border-neutral-100 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-neutral-800">{f.label}</h4>
                  <p className="text-[10px] text-neutral-400 font-medium">{f.desc}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <input
                    type="number"
                    disabled={!isAdmin}
                    value={currentVal}
                    onChange={(e) => handleStatChange(activePos, f.key, parseInt(e.target.value) || 0)}
                    className="w-16 h-9 text-center bg-white border border-neutral-200 rounded-xl text-xs font-black text-neutral-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-75"
                  />
                  <span className="text-[10px] font-bold text-neutral-400">pts</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
