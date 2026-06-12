"use client"

import React, { useState, useEffect, useRef } from "react"
import { HelpCircle, ChevronRight, ChevronLeft, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Step {
  target: string
  title: string
  content: string
  placement?: "top" | "bottom" | "left" | "right" | "center"
  condition?: () => boolean
}

const DASHBOARD_STEPS: Step[] = [
  {
    target: '[data-tour="profile-card"]',
    title: "Profile & Personal Stats",
    content: "Keep track of your total goals, assists, and clean sheets across all groups here.",
    placement: "bottom"
  },
  {
    target: '[data-tour="pending-rsvp"]',
    title: "Action Required Alerts",
    content: "See matches that need your RSVP. Let your teammates know if you are coming or not!",
    placement: "bottom",
    condition: () => typeof document !== "undefined" && !!document.querySelector('[data-tour="pending-rsvp"]')
  },
  {
    target: '[data-tour="upcoming-matches"]',
    title: "Upcoming Matches",
    content: "View your scheduled matches. Click any card to check rosters, pick teams, or view details.",
    placement: "top"
  },
  {
    target: '[data-tour="my-squads"]',
    title: "My Squads",
    content: "Manage your teams and groups. Click a squad to open its chat forum, schedule new bookings, or view the leaderboard.",
    placement: "top"
  },
  {
    target: '[data-tour="calendar"]',
    title: "Interactive Match Calendar",
    content: "Dots represent match days. Click any date to view match info or export to your calendar.",
    placement: "top"
  },
  {
    target: '[data-tour="bottom-nav"]',
    title: "Navigation Bar",
    content: "Quickly navigate between Dashboard, Groups list, Messages, Discussion Forum, and Profile settings.",
    placement: "top"
  }
]

const GROUP_STEPS: Step[] = [
  {
    target: '[data-tour="group-header"]',
    title: "Group Info & Invite Code",
    content: "See the number of squad members. Share the invite code with your friends to let them join the group!",
    placement: "bottom"
  },
  {
    target: '[data-tour="group-tabs"]',
    title: "Squad Navigation",
    content: "Toggle between the Matches schedule, real-time Group Chat, and the Squad directory/stats.",
    placement: "bottom"
  },
  {
    target: '[data-tour="add-booking-fab"]',
    title: "Schedule a Match",
    content: "Click this button to reserve a slot and schedule a new match for this group.",
    placement: "top"
  }
]

const MATCH_STEPS: Step[] = [
  {
    target: '[data-tour="match-info"]',
    title: "Match Details",
    content: "View the match date, kick-off time, and the field location. You can also click 'Open in Maps' to get directions directly.",
    placement: "bottom"
  },
  {
    target: '[data-tour="match-rsvp"]',
    title: "RSVP Status",
    content: "Let your squad know if you are attending. If the squad is full, you'll be automatically placed on the waitlist.",
    placement: "bottom",
    condition: () => typeof document !== "undefined" && !!document.querySelector('[data-tour="match-rsvp"]')
  },
  {
    target: '[data-tour="match-players"]',
    title: "Squad Rosters",
    content: "See who is in and who is on the waitlist. Admins can also add guests or other squad members manually here.",
    placement: "top"
  },
  {
    target: '[data-tour="match-teams"]',
    title: "Team Divisions",
    content: "Divide confirmed players into custom teams, select captains, and assign player jerseys.",
    placement: "top",
    condition: () => typeof document !== "undefined" && !!document.querySelector('[data-tour="match-teams"]')
  },
  {
    target: '[data-tour="match-schedule"]',
    title: "Matchday Fixtures",
    content: "Generate matches between teams. Click a fixture to expand it and input scores, scorers, and assists.",
    placement: "top",
    condition: () => typeof document !== "undefined" && !!document.querySelector('[data-tour="match-schedule"]')
  },
  {
    target: '[data-tour="match-report"]',
    title: "Matchday Standings",
    content: "Track team points and view top players. You can also generate a Matchday Report card to share with friends!",
    placement: "top",
    condition: () => typeof document !== "undefined" && !!document.querySelector('[data-tour="match-report"]')
  }
]

const PROFILE_STEPS: Step[] = [
  {
    target: '[data-tour="profile-header"]',
    title: "Player Profile Card",
    content: "Edit your name inline, update your player avatar, and change settings like your preferred positions.",
    placement: "bottom"
  },
  {
    target: '[data-tour="profile-stats"]',
    title: "Career Statistics",
    content: "Track your total goals, assists, and clean sheets across all groups. You can also generate a stats card to share with friends!",
    placement: "top"
  },
  {
    target: '[data-tour="profile-group-stats"]',
    title: "Group-Specific Breakdown",
    content: "Expand any squad accordion row to review your exact stats and match counts inside that specific squad.",
    placement: "top",
    condition: () => typeof document !== "undefined" && !!document.querySelector('[data-tour="profile-group-stats"]')
  },
  {
    target: '[data-tour="profile-preferences"]',
    title: "Security & Preferences",
    content: "Toggle email alerts, change your login password securely, configure a recovery question, or sign out.",
    placement: "top"
  }
]

interface TourGuideProps {
  page: "dashboard" | "group" | "match" | "profile"
}

export function TourGuide({ page }: TourGuideProps) {
  const [isActive, setIsActive] = useState(false)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [spotlightStyle, setSpotlightStyle] = useState<React.CSSProperties>({})
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({})
  const tooltipRef = useRef<HTMLDivElement>(null)
  
  const steps = (
    page === "dashboard" ? DASHBOARD_STEPS :
    page === "group" ? GROUP_STEPS :
    page === "match" ? MATCH_STEPS :
    PROFILE_STEPS
  ).filter(step => !step.condition || step.condition())

  const currentStep = steps[currentStepIndex]

  // Auto-start on first load
  useEffect(() => {
    const isCompleted = localStorage.getItem(`tour_${page}_completed`)
    if (!isCompleted) {
      // Small delay to let the page render completely
      const timer = setTimeout(() => {
        setIsActive(true)
        setCurrentStepIndex(0)
      }, 800)
      return () => clearTimeout(timer)
    }
  }, [page])

  // Track target element positions and scroll them into view
  useEffect(() => {
    if (!isActive || !currentStep) return

    const target = document.querySelector(currentStep.target)
    if (!target) {
      // If target is not found, skip to next step
      handleNext()
      return
    }

    // Smooth scroll target into view
    target.scrollIntoView({ behavior: "smooth", block: "center" })

    const updatePosition = () => {
      const rect = target.getBoundingClientRect()
      
      // Spotlight position
      setSpotlightStyle({
        top: rect.top - 8,
        left: rect.left - 8,
        width: rect.width + 16,
        height: rect.height + 16,
        opacity: 1,
      })

      // Tooltip position
      const tooltipWidth = 300
      const tooltipHeight = tooltipRef.current?.offsetHeight || 170
      
      let top = rect.bottom + 12
      let left = rect.left + (rect.width - tooltipWidth) / 2

      // Prevent overflow horizontal boundaries
      if (left < 16) left = 16
      if (left + tooltipWidth > window.innerWidth - 16) {
        left = window.innerWidth - tooltipWidth - 16
      }

      // Respect placement
      if (currentStep.placement === "top") {
        top = rect.top - tooltipHeight - 12
      } else {
        top = rect.bottom + 12
      }

      // Prevent overflow vertical boundaries
      if (top < 16) {
        if (currentStep.placement === "top" && rect.bottom + tooltipHeight + 12 < window.innerHeight - 16) {
          top = rect.bottom + 12
        } else {
          top = 16
        }
      } else if (top + tooltipHeight > window.innerHeight - 16) {
        if (rect.top > tooltipHeight + 20) {
          top = rect.top - tooltipHeight - 12
        } else {
          top = window.innerHeight - tooltipHeight - 16
        }
      }

      setTooltipStyle({
        top,
        left,
        width: tooltipWidth,
      })
    }

    // Short timeout to let scroll complete before calculating rect
    const timer = setTimeout(updatePosition, 100)

    window.addEventListener("resize", updatePosition)
    window.addEventListener("scroll", updatePosition)

    return () => {
      clearTimeout(timer)
      window.removeEventListener("resize", updatePosition)
      window.removeEventListener("scroll", updatePosition)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, currentStepIndex])

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1)
    } else {
      handleComplete()
    }
  }

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1)
    }
  }

  const handleComplete = () => {
    setIsActive(false)
    localStorage.setItem(`tour_${page}_completed`, "true")
  }

  const handleSkip = () => {
    setIsActive(false)
    localStorage.setItem(`tour_${page}_completed`, "true")
  }

  const startTour = () => {
    setCurrentStepIndex(0)
    setIsActive(true)
  }

  return (
    <>
      {/* Floating help button to restart tour */}
      {!isActive && (
        <button
          onClick={startTour}
          className="fixed bottom-20 left-4 w-10 h-10 bg-white border border-neutral-200 rounded-full shadow-md flex items-center justify-center text-neutral-500 hover:text-neutral-700 active:scale-95 transition-transform z-40"
          title="Restart Tour Guide"
        >
          <HelpCircle className="w-5 h-5" />
        </button>
      )}

      {/* Tour Overlay Backdrop & Highlight Cutout */}
      {isActive && currentStep && (
        <div className="fixed inset-0 z-[100] pointer-events-none">
          {/* Spotlight cutout */}
          <div
            className="fixed rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] border border-white/20 transition-all duration-300 pointer-events-auto"
            style={spotlightStyle}
          />

          {/* Floating Tooltip Card */}
          <div
            ref={tooltipRef}
            className="fixed bg-white rounded-2xl shadow-2xl p-5 border border-neutral-100 flex flex-col gap-3 transition-all duration-300 pointer-events-auto animate-in fade-in duration-200 zoom-in-95"
            style={tooltipStyle}
          >
            {/* Header */}
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded uppercase tracking-wider">
                Tour: Step {currentStepIndex + 1} of {steps.length}
              </span>
              <button
                onClick={handleSkip}
                className="text-neutral-400 hover:text-neutral-600 transition-colors"
                title="Skip Tour"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Title & Body */}
            <div>
              <h4 className="font-bold text-neutral-900 text-sm mb-1">{currentStep.title}</h4>
              <p className="text-xs text-neutral-500 leading-relaxed">{currentStep.content}</p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between mt-2 pt-3 border-t border-neutral-100 shrink-0">
              <button
                onClick={handleSkip}
                className="text-xs font-semibold text-neutral-400 hover:text-neutral-600"
              >
                Skip Tour
              </button>

              <div className="flex gap-2">
                {currentStepIndex > 0 && (
                  <Button
                    variant="outline"
                    size="icon-xs"
                    onClick={handleBack}
                    className="h-8 w-8 rounded-lg"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                )}
                <Button
                  onClick={handleNext}
                  className="h-8 px-3 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-1 shadow-sm font-semibold"
                >
                  {currentStepIndex === steps.length - 1 ? (
                    "Finish"
                  ) : (
                    <>
                      Next <ChevronRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
